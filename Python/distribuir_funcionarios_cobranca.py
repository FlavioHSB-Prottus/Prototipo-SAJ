# -*- coding: utf-8 -*-
"""
Popula a tabela `funcionario_cobranca` distribuindo os contratos abertos
entre os funcionarios de cobranca cadastrados em `funcionario`.

Esquema (pre-existente, NAO e criado por este script):

    funcionario_cobranca (
        id             BIGINT PK,
        id_funcionario INT  FK -> funcionario.id,
        id_contrato    BIGINT FK -> contrato.id,
        created_at, updated_at
    )

Regras de balanceamento (em ORDEM de prioridade -- cada criterio so e
aplicado se nao quebrar os anteriores):

    1. Mesma media de VALOR TOTAL em cobranca por funcionario (por
       situacao critico / atencao / recente).
    2. Mesma media de QUANTIDADE de contratos em cobranca por
       funcionario (por situacao critico / atencao / recente).
    3. ESTABILIDADE / PREFERENCIA HISTORICA: se um contrato ja foi
       cobrado/atendido por algum funcionario no passado (visto em
       `tramitacao` ou em registros antigos de `funcionario_cobranca`),
       devolver o contrato para esse mesmo funcionario SEMPRE QUE for
       possivel sem quebrar (1) e (2) -- isto e, desde que a carga
       atual desse funcionario, naquele bloco, esteja dentro de uma
       margem de tolerancia em relacao ao funcionario menos carregado.
       Tolerancia configuravel via env var ESTABILIDADE_TOLERANCIA
       (default 0.15 = 15%).

Contratos ja presentes em funcionario_cobranca sao preservados
naturalmente pelo passo (3) -- e tambem pelo "fixos" do passo inicial,
para garantir compatibilidade com o comportamento anterior.

Uso:
    python distribuir_funcionarios_cobranca.py

Ambiente (opcional):
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
    ESTABILIDADE_TOLERANCIA   (default 0.15)
"""
import os
import sys

import pymysql

# Observacao sobre encoding:
# Este arquivo e escrito em ASCII puro. A palavra "atencao" em portugues
# usa as letras c-cedilha e a-til; em vez de escreve-las diretamente no
# fonte (o que depende da codificacao do arquivo), usamos escapes
# unicode nas strings. O valor gravado no banco continua sendo o
# portugues correto: "aten\u00e7\u00e3o" ==> "aten\xe7\xe3o".

SIT_CRITICO = "critico"
SIT_ATENCAO = "aten\u00e7\u00e3o"  # "atencao" com c-cedilha e a-til
SIT_RECENTE = "recente"

STATUS_LIST = [SIT_CRITICO, SIT_ATENCAO, SIT_RECENTE]


def get_situacao(dias_atraso):
    if dias_atraso is None:
        return SIT_RECENTE
    d = int(dias_atraso)
    if d >= 61:
        return SIT_CRITICO
    if d >= 31:
        return SIT_ATENCAO
    return SIT_RECENTE


def fmt_brl(v):
    """Formata numero como moeda BRL (R$ 1.234,56) em ASCII puro."""
    try:
        n = float(v or 0)
    except (TypeError, ValueError):
        n = 0.0
    s = f"{n:,.2f}"  # 1,234.56
    return "R$ " + s.replace(",", "X").replace(".", ",").replace("X", ".")


def connect_db():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "root"),
        database=os.environ.get("DB_NAME", "consorcio_gm"),
        cursorclass=pymysql.cursors.DictCursor,
        charset="utf8mb4",
    )


def fetch_funcionarios(cursor):
    """Lista todos os funcionarios disponiveis.

    Assume colunas (id, nome). Se o schema usar outro nome de coluna,
    ajustar aqui.
    """
    cursor.execute("SELECT id, nome FROM funcionario ORDER BY nome")
    return cursor.fetchall()


def fetch_contratos_abertos(cursor, data_arquivo):
    """Retorna a lista de contratos abertos com id, valor e dias de
    atraso."""
    cursor.execute(
        """
        SELECT c.id        AS id_contrato,
               c.grupo,
               c.cota,
               c.valor_credito,
               DATEDIFF(%s, MIN(p.vencimento)) AS dias_atraso
        FROM contrato c
        INNER JOIN parcela p ON p.id_contrato = c.id AND p.status = 'aberto'
        WHERE c.status = 'aberto'
        GROUP BY c.id, c.grupo, c.cota, c.valor_credito
        """,
        (data_arquivo,),
    )
    return cursor.fetchall()


def fetch_existentes(cursor):
    """Retorna dict {id_contrato: id_funcionario} do que ja esta gravado."""
    cursor.execute("SELECT id_contrato, id_funcionario FROM funcionario_cobranca")
    return {int(r["id_contrato"]): int(r["id_funcionario"]) for r in cursor.fetchall()}


def fetch_historico_funcionarios(cursor, funcionarios_validos):
    """Retorna {id_contrato: id_funcionario_ultimo} para o CRITERIO 3.

    Une duas fontes, com a primeira tendo precedencia (acao mais recente):

      a) Tramitacao (ligacao / sms / email): pega o id_funcionario do
         ultimo registro por contrato.
      b) Funcionario_cobranca: pega o id_funcionario do ultimo registro
         (id maximo) por contrato. Cobre o caso onde um contrato ja foi
         distribuido antes mas perdeu o vinculo por algum motivo.

    Filtra apenas funcionarios que ainda existem em `funcionario` (passados
    em `funcionarios_validos`), para evitar referencia a quem ja saiu da
    empresa.
    """
    historico = {}
    validos = set(int(x) for x in funcionarios_validos)

    # (a) Tramitacao -- pode nao existir em ambientes muito antigos.
    try:
        cursor.execute(
            """
            SELECT t.id_contrato, t.id_funcionario
            FROM tramitacao t
            INNER JOIN (
                SELECT id_contrato, MAX(data) AS max_data
                FROM tramitacao
                GROUP BY id_contrato
            ) ult ON ult.id_contrato = t.id_contrato AND ult.max_data = t.data
            """
        )
        for r in cursor.fetchall():
            fid = int(r["id_funcionario"])
            if fid in validos:
                historico[int(r["id_contrato"])] = fid
    except Exception as exc:
        # Se a tabela nao existe ou esta inacessivel, segue sem ela --
        # ainda temos a fonte (b).
        print(f"AVISO: nao foi possivel ler historico de tramitacao: {exc}")

    # (b) Funcionario_cobranca historico -- so preenche se o contrato AINDA
    # nao tem entrada vinda da tramitacao.
    try:
        cursor.execute(
            """
            SELECT fc.id_contrato, fc.id_funcionario
            FROM funcionario_cobranca fc
            INNER JOIN (
                SELECT id_contrato, MAX(id) AS max_id
                FROM funcionario_cobranca
                GROUP BY id_contrato
            ) ult ON ult.id_contrato = fc.id_contrato AND ult.max_id = fc.id
            """
        )
        for r in cursor.fetchall():
            cid = int(r["id_contrato"])
            fid = int(r["id_funcionario"])
            if fid in validos and cid not in historico:
                historico[cid] = fid
    except Exception as exc:
        print(f"AVISO: nao foi possivel ler historico de funcionario_cobranca: {exc}")

    return historico


def init_estados(funcionarios_ids):
    """Matriz de carga (count + valor) por funcionario x situacao."""
    return {
        fid: {s: {"count": 0, "value": 0.0} for s in STATUS_LIST}
        for fid in funcionarios_ids
    }


def distribuir_balanceado(contratos, existentes, funcionarios_ids, historico=None,
                          tolerancia=0.15):
    """
    Distribui cada contrato NAO-existente seguindo a hierarquia de criterios:

      C1 + C2 -> funcionario com menor (valor_acumulado, qtd_contratos)
                 para a situacao do contrato.
      C3      -> se ha historico para esse contrato, prefere o
                 funcionario historico SEMPRE QUE sua carga atual
                 estiver dentro de `tolerancia` em relacao ao menos
                 carregado (assim nao quebra C1/C2).

    Os contratos ja presentes em `existentes` viram FIXOS (mantem o
    funcionario atual) -- isso ja e uma forma forte do criterio 3.

    Retorna:
      - atribuicoes:    dict {id_contrato: id_funcionario}
      - estados:        estado final de carga por funcionario x situacao
      - fixos:          dict {id_contrato: id_funcionario} (ja existiam)
      - estatisticas:   dict com contadores do criterio 3 aplicado
    """
    historico = historico or {}
    estados = init_estados(funcionarios_ids)

    # 1) Contabiliza o que ja esta fixado (carga previa).
    fixos = {}
    for c in contratos:
        cid = int(c["id_contrato"])
        if cid in existentes:
            fid = existentes[cid]
            if fid in estados:
                sit = get_situacao(c.get("dias_atraso"))
                estados[fid][sit]["count"] += 1
                estados[fid][sit]["value"] += float(c["valor_credito"] or 0)
                fixos[cid] = fid

    # 2) Separa os nao-fixados por situacao, em ordem decrescente de
    #    valor (LPT - Longest Processing Time first).
    por_status = {s: [] for s in STATUS_LIST}
    for c in contratos:
        cid = int(c["id_contrato"])
        if cid in fixos:
            continue
        sit = get_situacao(c.get("dias_atraso"))
        por_status[sit].append(c)
    for s in STATUS_LIST:
        por_status[s].sort(key=lambda x: float(x["valor_credito"] or 0), reverse=True)

    # 3) Greedy com preferencia historica.
    atribuicoes = {}
    estatisticas = {
        "respeitou_historico":   0,  # caiu no funcionario que ja cobrou
        "ignorou_historico":     0,  # tinha historico mas estava saturado
        "sem_historico":         0,  # nunca foi cobrado antes
        "tolerancia_aplicada":   tolerancia,
    }

    for s in STATUS_LIST:
        for c in por_status[s]:
            cid = int(c["id_contrato"])
            valor = float(c["valor_credito"] or 0)

            def score(fid, _s=s):
                st = estados[fid][_s]
                return (st["value"], st["count"])

            # Funcionario com a MENOR carga -- candidato de C1+C2.
            fid_balanceador = min(funcionarios_ids, key=score)
            menor_valor = estados[fid_balanceador][s]["value"]
            menor_count = estados[fid_balanceador][s]["count"]

            fid_escolhido = fid_balanceador
            fid_historico = historico.get(cid)

            if fid_historico is None or fid_historico not in estados:
                estatisticas["sem_historico"] += 1
            elif fid_historico == fid_balanceador:
                # historico ja coincide com o melhor: C3 ja "satisfeito"
                estatisticas["respeitou_historico"] += 1
            else:
                carga_hist_v = estados[fid_historico][s]["value"]
                carga_hist_q = estados[fid_historico][s]["count"]
                # Limites superiores aceitaveis para C3 ainda respeitar
                # C1 (valor) e C2 (quantidade).
                limite_v = (menor_valor * (1.0 + tolerancia)) if menor_valor > 0 else max(valor, 1.0)
                limite_q = (menor_count * (1.0 + tolerancia) + 1) if menor_count > 0 else 1
                if carga_hist_v <= limite_v and carga_hist_q <= limite_q:
                    fid_escolhido = fid_historico
                    estatisticas["respeitou_historico"] += 1
                else:
                    estatisticas["ignorou_historico"] += 1

            atribuicoes[cid] = fid_escolhido
            estados[fid_escolhido][s]["count"] += 1
            estados[fid_escolhido][s]["value"] += valor

    return atribuicoes, estados, fixos, estatisticas


def persist(cursor, atribuicoes):
    """Insere apenas as novas atribuicoes. Linhas existentes permanecem."""
    if not atribuicoes:
        return 0
    rows = [(fid, cid) for cid, fid in atribuicoes.items()]
    cursor.executemany(
        """
        INSERT INTO funcionario_cobranca (id_funcionario, id_contrato)
        VALUES (%s, %s)
        """,
        rows,
    )
    return len(rows)


def print_resumo(contratos, estados, funcionarios):
    total_contratos = len(contratos)
    total_valor = sum(float(c["valor_credito"] or 0) for c in contratos)
    nome_by_id = {int(f["id"]): f["nome"] for f in funcionarios}

    # Nomes das situacoes em ASCII para logs (apenas visual).
    sit_labels = {SIT_CRITICO: "critico", SIT_ATENCAO: "atencao", SIT_RECENTE: "recente"}

    print("")
    print("=== RESUMO DA DISTRIBUICAO ===")
    print(f"Total de contratos em cobranca: {total_contratos}")
    print(f"Valor total em cobranca: {fmt_brl(total_valor)}")
    print("")
    for fid, carga in estados.items():
        nome = nome_by_id.get(fid, f"#{fid}")
        f_count = sum(carga[s]["count"] for s in STATUS_LIST)
        f_value = sum(carga[s]["value"] for s in STATUS_LIST)
        pct_q = (f_count / total_contratos * 100) if total_contratos else 0
        pct_v = (f_value / total_valor * 100) if total_valor else 0
        print(
            f" -> {nome}: {f_count} contratos ({pct_q:.1f}%) | "
            f"{fmt_brl(f_value)} ({pct_v:.1f}%)"
        )
        for s in STATUS_LIST:
            st = carga[s]
            label = sit_labels.get(s, s)
            print(f"      {label:>9}: {st['count']:>4} ctr | {fmt_brl(st['value'])}")
    print("")


def main():
    try:
        conn = connect_db()
        cursor = conn.cursor()
    except Exception as e:
        print(f"ERRO: falha ao conectar no banco de dados: {e}")
        sys.exit(1)

    # Data de referencia: ultimo arquivo_gm importado (usado para DATEDIFF).
    cursor.execute("SELECT MAX(data_arquivo) AS data_arquivo FROM arquivos_gm")
    row = cursor.fetchone()
    if not row or not row["data_arquivo"]:
        print("ALERTA: nenhum arquivo_gm encontrado. Distribuicao abortada.")
        cursor.close()
        conn.close()
        return
    data_arquivo = row["data_arquivo"]
    print(f"Data de referencia: {data_arquivo}")

    funcionarios = fetch_funcionarios(cursor)
    if not funcionarios:
        print("ERRO: nenhum funcionario cadastrado na tabela 'funcionario'.")
        cursor.close()
        conn.close()
        sys.exit(1)
    ids_func = [int(f["id"]) for f in funcionarios]
    print(
        f"Funcionarios disponiveis: {len(funcionarios)} -> "
        + ", ".join(f"[{f['id']}] {f['nome']}" for f in funcionarios)
    )

    contratos = fetch_contratos_abertos(cursor, data_arquivo)
    if not contratos:
        print("ALERTA: nenhum contrato aberto para distribuir.")
        conn.commit()
        cursor.close()
        conn.close()
        return
    print(f"Contratos abertos localizados: {len(contratos)}")

    existentes = fetch_existentes(cursor)
    print(f"Atribuicoes ja gravadas (preservadas): {len(existentes)}")

    historico = fetch_historico_funcionarios(cursor, ids_func)
    print(f"Historico de cobranca encontrado: {len(historico)} contratos com funcionario previo")

    try:
        tolerancia = float(os.environ.get("ESTABILIDADE_TOLERANCIA", "0.15"))
    except ValueError:
        tolerancia = 0.15
    print(f"Tolerancia do criterio 3 (estabilidade): {tolerancia:.0%}")

    atribuicoes, estados, _fixos, estat3 = distribuir_balanceado(
        contratos, existentes, ids_func, historico=historico, tolerancia=tolerancia
    )

    inseridos = persist(cursor, atribuicoes)
    conn.commit()
    print(f"Novas atribuicoes inseridas: {inseridos}")

    print("")
    print("=== CRITERIO 3 (estabilidade historica) ===")
    print(f" -> Mantido com funcionario historico: {estat3['respeitou_historico']}")
    print(f" -> Historico ignorado por sobrecarga: {estat3['ignorou_historico']}")
    print(f" -> Sem historico anterior:            {estat3['sem_historico']}")

    print_resumo(contratos, estados, funcionarios)
    print("SUCESSO: Distribuicao de funcionarios finalizada.")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
