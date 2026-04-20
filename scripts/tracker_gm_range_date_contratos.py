"""
Tracker por intervalo de datas em arquivos_gm: parse TXT (layout EN002), upsert pessoa/contrato/parcela,
delta vs arquivo anterior e ocorrencias. Baseado em tracker_gm_range_date_corrigido_v3.py.
"""
import datetime
import json
import os
import re
import sys

import pymysql

from pessoa_satellite import upsert_avalista_contatos, upsert_devedor_contatos

OCORRENCIA_ABERTO = "aberto"
OCORRENCIA_FECHADO = "fechado"
OCORRENCIA_INDENIZADO = "indenizado"
OCORRENCIA_PARCELA_PAGA = "parcela paga"
OCORRENCIA_PARCELA_VENCIDA = "parcela vencida"

OCORRENCIA_STATUS = frozenset(
    {
        OCORRENCIA_ABERTO,
        OCORRENCIA_FECHADO,
        OCORRENCIA_INDENIZADO,
        OCORRENCIA_PARCELA_PAGA,
        OCORRENCIA_PARCELA_VENCIDA,
    }
)

DIAS_INDENIZACAO_CONTRATO = 89

OPERADORES = ["Arthur", "Bruna", "Silvania", "Giovanna"]


def get_situacao(dias_atraso):
    if dias_atraso >= 61:
        return "critico"
    elif dias_atraso >= 31:
        return "atenção"
    else:
        return "recente"


def distribuir_operadores(cursor, conn, arquivo_gm_id):
    """
    Distribui contratos abertos entre os operadores de forma equilibrada por situação.
    Garante que contratos já atribuídos permaneçam com o mesmo operador.
    """
    print(f" -> Distribuindo operadores para o arquivo {arquivo_gm_id}...")
    # 1. Obter data do arquivo
    cursor.execute("SELECT data_arquivo FROM arquivos_gm WHERE id_arquivo_gm = %s", (arquivo_gm_id,))
    row_da = cursor.fetchone()
    if not row_da:
        return
    data_arquivo = row_da["data_arquivo"]

    # 2. Garantir que o administrador existe (sem grupo/cota)
    cursor.execute("SELECT 1 FROM operador WHERE perfil = 'administrador' LIMIT 1")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO operador (nome, perfil) VALUES ('João Barbosa', 'administrador')")

    # 3. Identificar contratos abertos que precisam de atribuição ou atualização
    cursor.execute(
        """
        SELECT c.grupo, c.cota, 
               DATEDIFF(%s, MIN(p.vencimento)) as dias_atraso
        FROM contrato c
        INNER JOIN parcela p ON p.id_contrato = c.id AND p.status = 'aberto'
        WHERE c.status = 'aberto'
        GROUP BY c.grupo, c.cota
    """,
        (data_arquivo,),
    )
    contratos_abertos = cursor.fetchall()

    if not contratos_abertos:
        print("    - Nenhum contrato aberto para classificar.")
        return

    # 4. Mapear quem já está atribuído
    cursor.execute("SELECT grupo, cota, nome FROM operador WHERE perfil = 'operador'")
    atribuicoes_existentes = {(r["grupo"], r["cota"]): r["nome"] for r in cursor.fetchall()}

    # 5. Contagem atual para balanceamento
    counts = {op: {"recente": 0, "atenção": 0, "critico": 0} for op in OPERADORES}

    para_atribuir = []

    for c in contratos_abertos:
        g, cot = c["grupo"], c["cota"]
        sit = get_situacao(c["dias_atraso"] or 0)

        if (g, cot) in atribuicoes_existentes:
            op_nome = atribuicoes_existentes[(g, cot)]
            if op_nome in counts:
                counts[op_nome][sit] += 1
            # Atualizamos a situação e a data do arquivo no registro existente
            cursor.execute(
                """
                UPDATE operador 
                SET situacao = %s, data_arquivo = %s, updated_at = NOW()
                WHERE grupo = %s AND cota = %s
            """,
                (sit, data_arquivo, g, cot),
            )
        else:
            para_atribuir.append({"grupo": g, "cota": cot, "situacao": sit})

    # 6. Atribuir os novos (para_atribuir) balanceando
    inserted_count = 0
    for item in para_atribuir:
        sit = item["situacao"]
        # Encontra o operador com menor contagem naquela situação
        op_escolhido = min(OPERADORES, key=lambda op: counts[op][sit])

        cursor.execute(
            """
            INSERT INTO operador (nome, perfil, grupo, cota, data_arquivo, situacao)
            VALUES (%s, 'operador', %s, %s, %s, %s)
        """,
            (op_escolhido, item["grupo"], item["cota"], data_arquivo, sit),
        )

        counts[op_escolhido][sit] += 1
        inserted_count += 1

    conn.commit()
    print(f"    - {len(contratos_abertos)} ativos processados ({inserted_count} novos atribuídos).")

TYPE_TO_TABLE = {
    "1": "registro_1",
    "2": "registro2",
    "3": "registro3",
    "5": "registro5",
}

DECIMAL_COLS = {
    "valor_do_bem_sem_taxas",
    "dif_parc_acumulado",
    "vl_parc",
    "mensal",
    "atras",
    "amort",
    "mensal_c_taxas",
    "seguro_mensal_c_taxas",
    "taxa_adm_do_grupo",
    "percentual_lance",
    "fundo_de_reserva_do_grupo",
    "valorpar",
    "multajur",
    "valortot",
    "tx_adm",
    "fdo_comum",
    "fd_reserva",
    "seguro",
    "vl_avaliacao",
    "valor_parcelas",
    "valor_parcelas_1",
    "qtd_parcelas",
    "total_reg_1",
}


def clean_name(name):
    name = str(name).strip().lower()
    name = re.sub(r"[^\w\s]", "_", name)
    name = re.sub(r"\s+", "_", name)
    name = re.sub(r"_+", "_", name)
    name = name.strip("_")
    if not name or name.isdigit():
        name = "col_" + name
    return name


def build_table_mappings(layout):
    table_mappings = {}
    for sheet, rows in layout.items():
        if not rows:
            continue
        table_name = clean_name(sheet)
        if not table_name:
            continue

        header_mapping = rows[0]
        campo_col = None
        tamanho_col = None
        posicao_col = None
        for k, v in header_mapping.items():
            v_str = str(v).lower()
            if "campo" in v_str:
                campo_col = k
            if "tamanho" in v_str:
                tamanho_col = k
            if "posicao" in v_str or "posi\u00e7\u00e3o" in v_str:
                posicao_col = k

        columns = []
        seen = set()
        for row in rows[1:]:
            campo = str(row.get(campo_col, "")).strip() if campo_col else ""
            tamanho = str(row.get(tamanho_col, "")).strip().replace(".0", "") if tamanho_col else ""
            posicao = str(row.get(posicao_col, "")).strip().replace(".0", "") if posicao_col else ""

            if campo and campo != "nan" and campo != "None":
                col_name = clean_name(campo)
                if col_name in seen:
                    count = 1
                    while f"{col_name}_{count}" in seen:
                        count += 1
                    col_name = f"{col_name}_{count}"
                seen.add(col_name)
                try:
                    start_idx = int(posicao) - 1
                    length = int(tamanho)
                except ValueError:
                    continue
                columns.append({"col_name": col_name, "start": start_idx, "end": start_idx + length})

        table_mappings[table_name] = columns
    return table_mappings


def connect_db():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "root"),
        database=os.environ.get("DB_NAME", "consorcio_gm"),
        cursorclass=pymysql.cursors.DictCursor,
    )


def insert_ocorrencia(cursor, id_contrato, arquivo_gm_id, status, descricao):
    if status not in OCORRENCIA_STATUS:
        raise ValueError(f"status de ocorrencia invalido: {status!r}")
    cursor.execute(
        """
        INSERT INTO ocorrencia (id_contrato, id_arquivo_gm, data_arquivo, status, descricao)
        VALUES (%s, %s, (SELECT data_arquivo FROM arquivos_gm WHERE id_arquivo_gm = %s), %s, %s)
        """,
        (id_contrato, arquivo_gm_id, arquivo_gm_id, status, descricao),
    )


def _extract_field(line, columns_info, field_name):
    for col_info in columns_info:
        if col_info["col_name"] == field_name:
            val = line[col_info["start"]:col_info["end"]].strip() if col_info["start"] < len(line) else ""
            return val or None
    return None


def _format_date_raw(val):
    """Format a raw 8-digit date string to YYYY-MM-DD."""
    if not val or len(val) != 8 or not val.isdigit():
        return None
    if val.startswith("19") or val.startswith("20"):
        return f"{val[0:4]}-{val[4:6]}-{val[6:8]}"
    return f"{val[4:8]}-{val[2:4]}-{val[0:2]}"


def parse_content_sets(conteudo, table_mappings):
    """Parse conteudo and return (r1_set, r2_set, r2_vencimento) without any DB operations."""
    r1_set = set()
    r2_set = set()
    r2_vencimento = {}
    r1_cols = table_mappings.get("registro_1", [])
    r2_cols = table_mappings.get("registro2", [])

    for line in conteudo.split("\n"):
        line = line.replace("\r", "")
        if not line:
            continue
        rt = line[0]
        if rt == "1" and r1_cols:
            grupo = _extract_field(line, r1_cols, "grupo")
            cota = _extract_field(line, r1_cols, "cota")
            if grupo and cota:
                r1_set.add((grupo, cota))
        elif rt == "2" and r2_cols:
            grupo = _extract_field(line, r2_cols, "grupo")
            cota = _extract_field(line, r2_cols, "cota")
            num_p = _extract_field(line, r2_cols, "numero_parcela")
            if grupo and cota and num_p is not None:
                r2_set.add((grupo, cota, num_p))
                venc_raw = _extract_field(line, r2_cols, "vencimento")
                venc_fmt = _format_date_raw(venc_raw) if venc_raw else None
                if venc_fmt:
                    r2_vencimento[(grupo, cota, num_p)] = venc_fmt

    return r1_set, r2_set, r2_vencimento


def process_arquivo(
    cursor,
    conn,
    arquivo_gm_id,
    conteudo,
    table_mappings,
):
    count = 0
    r1_set = set()
    r2_set = set()
    r2_vencimento = {}

    for line in conteudo.split("\n"):
        line = line.replace("\r", "")
        if not line:
            continue

        record_type = line[0]
        table_name = TYPE_TO_TABLE.get(record_type)
        if not table_name:
            continue

        columns_info = table_mappings.get(table_name)
        if not columns_info:
            continue

        col_names = []
        col_values = []

        for col_info in columns_info:
            val = line[col_info["start"] : col_info["end"]].strip() if col_info["start"] < len(line) else ""
            c_name = col_info["col_name"].lower()

            if not val:
                val = None
            else:
                if (
                    ("data" in c_name or "venc" in c_name or c_name == "dt_ult_ass_gr")
                    and len(val) == 8
                    and val.isdigit()
                ):
                    if val.startswith("19") or val.startswith("20"):
                        val = f"{val[0:4]}-{val[4:6]}-{val[6:8]}"
                    else:
                        val = f"{val[4:8]}-{val[2:4]}-{val[0:2]}"
                elif c_name in DECIMAL_COLS:
                    if "," in val:
                        val = val.replace(",", ".")
                    else:
                        try:
                            val = str(float(val))
                        except ValueError:
                            pass

            col_names.append(col_info["col_name"])
            col_values.append(val)

        row_dict = dict(zip(col_names, col_values))
        count += 1

        if table_name == "registro_1" and row_dict.get("cgc_cpf"):
            grupo = row_dict.get("grupo")
            cota = row_dict.get("cota")
            if grupo and cota:
                r1_set.add((grupo, cota))

            q_pes = """INSERT INTO pessoa
            (cpf_cnpj, nome_completo, data_nascimento, profissao, conjuge_nome)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                nome_completo = VALUES(nome_completo), data_nascimento = VALUES(data_nascimento),
                profissao = VALUES(profissao), conjuge_nome = VALUES(conjuge_nome), updated_at = NOW();"""
            cursor.execute(
                q_pes,
                (
                    row_dict.get("cgc_cpf"),
                    row_dict.get("nome"),
                    row_dict.get("data_nascimento"),
                    row_dict.get("profissao"),
                    row_dict.get("conjuge_consorciado"),
                ),
            )

            cursor.execute("SELECT id FROM pessoa WHERE cpf_cnpj = %s", (row_dict.get("cgc_cpf"),))
            p_id = cursor.fetchone()
            if p_id:
                upsert_devedor_contatos(cursor, p_id["id"], row_dict)
                q_cnt = """INSERT INTO contrato
                (id_pessoa, numero_contrato, grupo, cota, versao, status_txt, valor_credito, prazo_meses, data_adesao, encerramento_grupo, taxa_administracao, fundo_reserva, percentual_lance)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    id_pessoa = VALUES(id_pessoa), numero_contrato = VALUES(numero_contrato),
                    versao = VALUES(versao), status_txt = VALUES(status_txt),
                    valor_credito = VALUES(valor_credito), prazo_meses = VALUES(prazo_meses),
                    data_adesao = VALUES(data_adesao), encerramento_grupo = VALUES(encerramento_grupo),
                    taxa_administracao = VALUES(taxa_administracao), fundo_reserva = VALUES(fundo_reserva),
                    percentual_lance = VALUES(percentual_lance), updated_at = NOW();"""
                cursor.execute(
                    q_cnt,
                    (
                        p_id["id"],
                        row_dict.get("numero_do_contrato"),
                        grupo,
                        cota,
                        row_dict.get("versao"),
                        row_dict.get("status"),
                        row_dict.get("valor_do_bem_sem_taxas"),
                        row_dict.get("prazo"),
                        row_dict.get("data_ades\u00e3o"),
                        row_dict.get("dt_ult_ass_gr"),
                        row_dict.get("taxa_adm_do_grupo"),
                        row_dict.get("fundo_de_reserva_do_grupo"),
                        row_dict.get("percentual_lance"),
                    ),
                )

        elif table_name == "registro5" and row_dict.get("cpf_avalista"):
            q_pes = """INSERT INTO pessoa
            (cpf_cnpj, nome_completo)
            VALUES (%s, %s)
            ON DUPLICATE KEY UPDATE
                nome_completo = VALUES(nome_completo), updated_at = NOW();"""
            cursor.execute(
                q_pes,
                (
                    row_dict.get("cpf_avalista"),
                    row_dict.get("avalista"),
                ),
            )
            cursor.execute("SELECT id FROM pessoa WHERE cpf_cnpj = %s", (row_dict.get("cpf_avalista"),))
            pes_res = cursor.fetchone()
            if pes_res:
                upsert_avalista_contatos(cursor, pes_res["id"], row_dict)
            if pes_res and row_dict.get("grupo") and row_dict.get("cota"):
                cursor.execute(
                    "UPDATE contrato SET id_avalista = %s WHERE grupo = %s AND cota = %s",
                    (pes_res["id"], row_dict.get("grupo"), row_dict.get("cota")),
                )

        elif table_name == "registro3":
            grupo = row_dict.get("grupo")
            cota = row_dict.get("cota")
            if grupo and cota:
                cursor.execute("SELECT id, id_pessoa FROM contrato WHERE grupo = %s AND cota = %s", (grupo, cota))
                c_res = cursor.fetchone()
                if c_res:
                    id_contrato = c_res["id"]
                    id_pessoa = c_res["id_pessoa"]
                    chassi = row_dict.get("chassi")
                    placa = row_dict.get("placa")
                    
                    conds = ["id_contrato = %s"]
                    vals = [id_contrato]
                    if chassi:
                        conds.append("chassi = %s")
                        vals.append(chassi)
                    if placa:
                        conds.append("placa = %s")
                        vals.append(placa)
                    
                    where_clause = " AND ".join(conds)
                    cursor.execute(f"SELECT id FROM bens WHERE {where_clause} LIMIT 1", tuple(vals))
                    b_res = cursor.fetchone()
                    
                    vl_aval = row_dict.get("vl_avaliacao")
                    data_nf = row_dict.get("data_nota_fiscal")
                    
                    if b_res:
                        q_upd = """UPDATE bens SET
                            codigo_renavam = %s, modelo = %s, ano_modelo = %s, cor = %s, marca = %s,
                            data_nota_fiscal = %s, matricula = %s, cartorio = %s, vl_avaliacao = %s, updated_at = NOW()
                            WHERE id = %s"""
                        cursor.execute(q_upd, (
                            row_dict.get("codigo_renavam"), row_dict.get("modelo"), row_dict.get("ano_modelo"),
                            row_dict.get("cor"), row_dict.get("marca"), data_nf,
                            row_dict.get("matricula"), row_dict.get("cartorio"), vl_aval, b_res["id"]
                        ))
                    else:
                        q_ins = """INSERT INTO bens
                        (id_contrato, chassi, placa, codigo_renavam, modelo, ano_modelo, cor, marca, data_nota_fiscal, matricula, cartorio, vl_avaliacao)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
                        cursor.execute(q_ins, (
                            id_contrato, chassi, placa, row_dict.get("codigo_renavam"), 
                            row_dict.get("modelo"), row_dict.get("ano_modelo"), row_dict.get("cor"), 
                            row_dict.get("marca"), data_nf,
                            row_dict.get("matricula"), row_dict.get("cartorio"), vl_aval
                        ))

        elif table_name == "registro2":
            grupo = row_dict.get("grupo")
            cota = row_dict.get("cota")
            num_p_raw = row_dict.get("numero_parcela")
            if grupo and cota and num_p_raw is not None:
                r2_set.add((grupo, cota, num_p_raw))
                venc = row_dict.get("vencimento")
                if venc:
                    r2_vencimento[(grupo, cota, num_p_raw)] = venc

            cursor.execute(
                "SELECT id FROM contrato WHERE grupo = %s AND cota = %s",
                (grupo, cota),
            )
            c_res = cursor.fetchone()
            if c_res:
                try:
                    num_p = int(float(num_p_raw or 0))
                except (TypeError, ValueError):
                    num_p = 0
                q_parc = """INSERT INTO parcela
                (id_contrato, numero_parcela, vencimento, valor_nominal, valor_total, multa_juros, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'aberto')
                ON DUPLICATE KEY UPDATE
                    vencimento = VALUES(vencimento), valor_nominal = VALUES(valor_nominal),
                    valor_total = VALUES(valor_total), multa_juros = VALUES(multa_juros),
                    status = VALUES(status), updated_at = NOW();"""
                cursor.execute(
                    q_parc,
                    (
                        c_res["id"],
                        num_p,
                        row_dict.get("vencimento"),
                        row_dict.get("valorpar"),
                        row_dict.get("valortot"),
                        row_dict.get("multajur"),
                    ),
                )

        if count % 1000 == 0:
            conn.commit()

    conn.commit()
    return count, r1_set, r2_set, r2_vencimento


def clear_staging_for_arquivo(cursor, conn, arquivo_gm_id):
    try:
        cursor.execute("DELETE FROM ocorrencia WHERE id_arquivo_gm = %s", (arquivo_gm_id,))
    except Exception:
        pass
    conn.commit()


def _build_contrato_cache(cursor, keys):
    """Build {(grupo, cota): id} cache from the contrato table for the given keys."""
    cache = {}
    for grupo, cota in keys:
        cursor.execute("SELECT id FROM contrato WHERE grupo = %s AND cota = %s", (grupo, cota))
        row = cursor.fetchone()
        if row:
            cache[(grupo, cota)] = row["id"]
    return cache


def apply_delta(cursor, conn, arquivo_gm_id,
                prev_r1_set, prev_r2_set, prev_r2_venc,
                curr_r1_set, curr_r2_set, curr_r2_venc):
    if prev_r1_set is None:
        print(" -> Sem arquivo anterior. Populando estado inicial absoluto (originacao)...")

        contrato_cache = _build_contrato_cache(cursor, curr_r1_set)
        for grupo, cota in curr_r1_set:
            cid = contrato_cache.get((grupo, cota))
            if cid:
                insert_ocorrencia(cursor, cid, arquivo_gm_id, OCORRENCIA_ABERTO, "contrato novo")

        for grupo, cota, num_p_raw in curr_r2_set:
            cid = contrato_cache.get((grupo, cota))
            if cid:
                try:
                    num = int(float(num_p_raw or 0))
                except (TypeError, ValueError):
                    num = num_p_raw
                insert_ocorrencia(cursor, cid, arquivo_gm_id, OCORRENCIA_PARCELA_VENCIDA, f"parcela {num} esta vencida")

        conn.commit()
        return None

    print(" -> Rodando Delta Tracking in-memory...")

    cursor.execute(
        "SELECT data_arquivo FROM arquivos_gm WHERE id_arquivo_gm = %s",
        (arquivo_gm_id,),
    )
    row_da = cursor.fetchone()
    data_arquivo = row_da["data_arquivo"] if row_da else None

    all_keys = {(g, c) for g, c in prev_r1_set} | {(g, c) for g, c in curr_r1_set}
    all_keys |= {(g, c) for g, c, _ in prev_r2_set} | {(g, c) for g, c, _ in curr_r2_set}
    contrato_cache = _build_contrato_cache(cursor, all_keys)

    missing_contracts = prev_r1_set - curr_r1_set
    for grupo, cota in missing_contracts:
        cid = contrato_cache.get((grupo, cota))
        if not cid:
            continue

        prev_parcelas = [(g, c, n) for g, c, n in prev_r2_set if g == grupo and c == cota]

        vencimentos = []
        for key in prev_parcelas:
            v = prev_r2_venc.get(key)
            if v:
                try:
                    vencimentos.append(datetime.datetime.strptime(v, "%Y-%m-%d").date())
                except ValueError:
                    pass

        diff_dias = 0
        if data_arquivo and vencimentos:
            min_venc = min(vencimentos)
            if isinstance(data_arquivo, datetime.datetime):
                data_arquivo_date = data_arquivo.date()
            elif isinstance(data_arquivo, datetime.date):
                data_arquivo_date = data_arquivo
            else:
                try:
                    data_arquivo_date = datetime.datetime.strptime(str(data_arquivo), "%Y-%m-%d").date()
                except ValueError:
                    data_arquivo_date = None
            if data_arquivo_date:
                diff_dias = (data_arquivo_date - min_venc).days

        if diff_dias >= DIAS_INDENIZACAO_CONTRATO:
            status_o = OCORRENCIA_INDENIZADO
            desc = "contrato indenizado"
            status_parc = "indenizado"
        else:
            status_o = OCORRENCIA_FECHADO
            desc = "contrato fechado"
            status_parc = "fechado"

        for _, _, num_p_raw in prev_parcelas:
            try:
                num_p = int(float(num_p_raw or 0))
            except (TypeError, ValueError):
                num_p = 0
            cursor.execute(
                "UPDATE parcela SET status = %s, updated_at = NOW() WHERE id_contrato = %s AND numero_parcela = %s",
                (status_parc, cid, num_p),
            )

        cursor.execute("UPDATE contrato SET status = %s WHERE id = %s", (status_o, cid))
        insert_ocorrencia(cursor, cid, arquivo_gm_id, status_o, desc)

    added_contracts = curr_r1_set - prev_r1_set
    for grupo, cota in added_contracts:
        cid = contrato_cache.get((grupo, cota))
        if not cid:
            continue
        cursor.execute("SELECT 1 FROM ocorrencia WHERE id_contrato = %s LIMIT 1", (cid,))
        has_past = cursor.fetchone()
        desc = "contrato voltou" if has_past else "contrato novo"
        insert_ocorrencia(cursor, cid, arquivo_gm_id, OCORRENCIA_ABERTO, desc)

    added_parcels = curr_r2_set - prev_r2_set
    for grupo, cota, num_p_raw in added_parcels:
        cid = contrato_cache.get((grupo, cota))
        if not cid:
            continue
        try:
            num = int(float(num_p_raw or 0))
        except (TypeError, ValueError):
            num = num_p_raw
        insert_ocorrencia(cursor, cid, arquivo_gm_id, OCORRENCIA_PARCELA_VENCIDA, f"parcela {num} esta vencida")

    removed_parcels = prev_r2_set - curr_r2_set
    paid_parcels = {(g, c, n) for g, c, n in removed_parcels if (g, c) in curr_r1_set}
    for grupo, cota, num_p_raw in paid_parcels:
        cid = contrato_cache.get((grupo, cota))
        if not cid:
            continue
        try:
            num = int(float(num_p_raw or 0))
        except (TypeError, ValueError):
            num = num_p_raw
        cursor.execute(
            "UPDATE parcela SET status = 'fechado' WHERE id_contrato = %s AND numero_parcela = %s",
            (cid, num_p_raw),
        )
        insert_ocorrencia(cursor, cid, arquivo_gm_id, OCORRENCIA_PARCELA_PAGA, f"parcela {num} paga")

    conn.commit()
    return len(missing_contracts), len(added_parcels), len(paid_parcels)


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    layout_path = os.path.join(base_dir, "layout.json")
    with open(layout_path, "r", encoding="utf-8") as f:
        layout = json.load(f)
    table_mappings = build_table_mappings(layout)

    try:
        start_date_str = input("Digite a Data Inicial (yyyy-mm-dd): ").strip()
        end_date_str = input("Digite a Data Final (yyyy-mm-dd): ").strip()
        datetime.datetime.strptime(start_date_str, "%Y-%m-%d")
        datetime.datetime.strptime(end_date_str, "%Y-%m-%d")
    except ValueError:
        print("Datas invalidas. Por favor, utilize o formato yyyy-mm-dd.")
        sys.exit(1)

    conn = connect_db()
    cursor = conn.cursor()

    print(f"Tracking cronologico do range de Datas {start_date_str} ate {end_date_str}...")

    cursor.execute(
        "SELECT id_arquivo_gm FROM arquivos_gm WHERE data_arquivo BETWEEN %s AND %s ORDER BY data_arquivo ASC, id_arquivo_gm ASC",
        (start_date_str, end_date_str),
    )
    arquivos = cursor.fetchall()

    if not arquivos:
        print("Nenhum arquivo encontrado neste range.")
        cursor.close()
        conn.close()
        sys.exit(0)

    prev_r1_set = None
    prev_r2_set = None
    prev_r2_venc = None

    for arq in arquivos:
        arquivo_gm_id = arq["id_arquivo_gm"]

        cursor.execute("SELECT conteudo FROM arquivos_gm WHERE id_arquivo_gm = %s", (arquivo_gm_id,))
        res = cursor.fetchone()
        if not res or not res["conteudo"]:
            continue
        conteudo = res["conteudo"]

        print(f"\n[!] INICIANDO ANALISE DO ARQUIVO {arquivo_gm_id}")

        if prev_r1_set is None:
            cursor.execute(
                """
                SELECT id_arquivo_gm AS prev_id
                FROM arquivos_gm
                WHERE data_arquivo < (SELECT data_arquivo FROM arquivos_gm WHERE id_arquivo_gm = %s)
                ORDER BY data_arquivo DESC, id_arquivo_gm DESC
                LIMIT 1
                """,
                (arquivo_gm_id,),
            )
            res_prev = cursor.fetchone()
            if res_prev:
                prev_id = res_prev["prev_id"]
                cursor.execute("SELECT conteudo FROM arquivos_gm WHERE id_arquivo_gm = %s", (prev_id,))
                prev_res = cursor.fetchone()
                if prev_res and prev_res["conteudo"]:
                    prev_r1_set, prev_r2_set, prev_r2_venc = parse_content_sets(prev_res["conteudo"], table_mappings)
                    print(f" -> Arquivo anterior {prev_id} parseado para delta (r1={len(prev_r1_set)}, r2={len(prev_r2_set)})")

        clear_staging_for_arquivo(cursor, conn, arquivo_gm_id)

        count, curr_r1_set, curr_r2_set, curr_r2_venc = process_arquivo(cursor, conn, arquivo_gm_id, conteudo, table_mappings)
        print(f" -> Arquivo ID {arquivo_gm_id}: Base mapeada ({count} linhas, r1={len(curr_r1_set)}, r2={len(curr_r2_set)}).")

        for grupo, cota in curr_r1_set:
            cursor.execute("UPDATE contrato SET status = 'aberto' WHERE grupo = %s AND cota = %s", (grupo, cota))
        conn.commit()

        stats = apply_delta(cursor, conn, arquivo_gm_id,
                            prev_r1_set, prev_r2_set, prev_r2_venc,
                            curr_r1_set, curr_r2_set, curr_r2_venc)
        if stats:
            n_miss, n_add, n_paid = stats
            print(
                f" -> Tracking Delta Concluido: {n_miss} contratos ausentes no registro_1, {n_add} parcelas novas, {n_paid} parcelas pagas."
            )

        # distribuir_operadores(cursor, conn, arquivo_gm_id)
        # NOTA: a tabela 'operador' nao e mais usada neste projeto. A
        # distribuicao passou para 'funcionario_cobranca' e e feita na
        # Fase 3 da importacao, pelo script distribuir_funcionarios_cobranca.py.

        prev_r1_set = curr_r1_set
        prev_r2_set = curr_r2_set
        prev_r2_venc = curr_r2_venc

        cursor.execute(
            "UPDATE arquivos_gm SET data_processamento = CURRENT_TIMESTAMP WHERE id_arquivo_gm = %s",
            (arquivo_gm_id,),
        )
        conn.commit()

    cursor.close()
    conn.close()
    print("Sincronizacao global concluida!")


if __name__ == "__main__":
    main()
