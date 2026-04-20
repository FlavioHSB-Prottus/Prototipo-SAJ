# -*- coding: utf-8 -*-
"""
Insere 1 registro de `tramitacao` de teste para cada contrato existente
(ou apenas contratos 'aberto', configuravel).

Estrategia (mesmo padrao do seed_funcionarios.py):
    1. Le INFORMATION_SCHEMA.COLUMNS para descobrir quais colunas existem
       na tabela `tramitacao` do banco atual.
    2. Para cada contrato, monta dinamicamente um INSERT usando apenas as
       colunas que existem na tabela E estao no dicionario de dados.
    3. Idempotente: marca a descricao com o prefixo `[SEED-TESTE]`. Se ja
       houver uma tramitacao com esse prefixo para o contrato, NAO
       duplica.

Uso:
    python scripts/seed_tramitacao.py              # todos os contratos
    python scripts/seed_tramitacao.py --abertos    # so os status=aberto
    python scripts/seed_tramitacao.py --limit 50   # no maximo 50 contratos
    python scripts/seed_tramitacao.py --remove     # remove os seeds

Ambiente (opcional):
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
"""
import argparse
import datetime
import os
import random
import re
import sys

import pymysql


SEED_MARKER = "[SEED-TESTE]"

# Variacoes para dar realismo aos registros (ciclicamente aplicadas).
# O frontend trata cpc: 'sim' -> verde, 'nao' -> vermelho, resto -> amarelo.
TIPOS = [
    "Ligacao",
    "Email",
    "SMS",
    "Visita",
    "Acordo",
    "Carta Registrada",
    "WhatsApp",
]
CPCS = ["sim", "nao", "parcial"]
FRASES = [
    "Contato efetuado com o devedor. Devedor informou dificuldades financeiras e solicitou prazo.",
    "Mensagem enviada ao numero cadastrado. Sem resposta ate o momento.",
    "Visita realizada no endereco do devedor. Local encontrado, deixado aviso.",
    "Devedor retornou a ligacao e sinalizou intencao de pagar a proxima parcela.",
    "Acordo verbal realizado para pagamento em 3 parcelas. Formalizacao pendente.",
    "E-mail de cobranca enviado. Entregue com sucesso segundo o servidor.",
    "Carta registrada enviada via Correios. Aguardando comprovante de entrega.",
    "Tentativa de contato sem sucesso - numero fora de area.",
    "Devedor solicitou segunda via do boleto. Reenviado por e-mail.",
    "Negociacao em andamento: proposta de desconto de 10% para quitacao a vista.",
]


def connect_db():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "root"),
        database=os.environ.get("DB_NAME", "consorcio_gm"),
        cursorclass=pymysql.cursors.DictCursor,
        charset="utf8mb4",
    )


def colunas_da_tabela(cursor, schema, tabela):
    """Retorna dict {col_name: {DATA_TYPE, COLUMN_TYPE, MAX_LEN, ENUM_VALUES}}."""
    cursor.execute(
        """
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        """,
        (schema, tabela),
    )
    out = {}
    for r in cursor.fetchall():
        col_type = (r["COLUMN_TYPE"] or "").lower()
        enum_values = None
        if col_type.startswith("enum("):
            inner = col_type[5:-1]
            enum_values = [
                p.replace("''", "'")
                for p in re.findall(r"'((?:[^']|'')*)'", inner)
            ]
        out[r["COLUMN_NAME"]] = {
            "data_type": r["DATA_TYPE"],
            "column_type": r["COLUMN_TYPE"],
            "max_len": r["CHARACTER_MAXIMUM_LENGTH"],
            "enum_values": enum_values,
        }
    return out


def pick_valor_valido(col_info, default_pool, idx):
    """Escolhe um valor compativel com a coluna.

    - ENUM: cicla entre os valores permitidos pelo banco.
    - VARCHAR: pega do pool default e trunca para max_len, se necessario.
    - Outros: devolve o default do pool.
    """
    if not col_info:
        return default_pool[idx % len(default_pool)]

    if col_info.get("enum_values"):
        vals = col_info["enum_values"]
        return vals[idx % len(vals)] if vals else None

    val = default_pool[idx % len(default_pool)]
    max_len = col_info.get("max_len")
    if max_len and isinstance(val, str) and len(val) > int(max_len):
        val = val[: int(max_len)]
    return val


def ja_tem_seed(cursor, id_contrato):
    """Retorna True se ja existe tramitacao de seed para o contrato."""
    cursor.execute(
        "SELECT id FROM tramitacao "
        "WHERE id_contrato = %s AND descricao LIKE %s LIMIT 1",
        (id_contrato, SEED_MARKER + "%"),
    )
    return cursor.fetchone() is not None


def montar_registro(contrato, idx, id_funcionario, cols_info):
    """Retorna um dict com o conjunto maximo de colunas que pode existir.
    O INSERT usara apenas as chaves que tambem forem colunas da tabela."""
    tipo = pick_valor_valido(cols_info.get("tipo"), TIPOS, idx)
    cpc = pick_valor_valido(cols_info.get("cpc"), CPCS, idx)
    frase = FRASES[idx % len(FRASES)]

    # Data entre 1 e 60 dias atras (para variar na timeline).
    dias = random.randint(1, 60)
    data = datetime.datetime.now() - datetime.timedelta(
        days=dias,
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )

    id_contrato = int(contrato["id"])
    descricao = f"{SEED_MARKER} {frase} (contrato #{id_contrato})"

    # Garante que 'status' (se existir como ENUM) use um valor valido.
    status_val = pick_valor_valido(
        cols_info.get("status"), ["aberto", "ativo", "pendente"], idx
    )

    # Superset de chaves: o script so insere as que tambem existem na tabela.
    return {
        "id_contrato": id_contrato,
        "id_pessoa": contrato.get("id_pessoa"),
        "id_funcionario": id_funcionario,
        "data": data.strftime("%Y-%m-%d %H:%M:%S"),
        "data_tramitacao": data.strftime("%Y-%m-%d %H:%M:%S"),
        "tipo": tipo,
        "cpc": cpc,
        "descricao": descricao,
        "observacao": descricao,  # fallback caso nao haja 'descricao'
        "status": status_val,
    }


def fetch_contratos(cursor, somente_abertos, limite):
    """Retorna lista de contratos com id e id_pessoa."""
    where = "WHERE status = 'aberto'" if somente_abertos else ""
    limit_sql = f"LIMIT {int(limite)}" if limite else ""
    cursor.execute(
        f"SELECT id, id_pessoa FROM contrato {where} ORDER BY id {limit_sql}"
    )
    return cursor.fetchall()


def fetch_funcionarios(cursor):
    """Retorna lista de ids de funcionarios ativos (fallback: todos)."""
    try:
        cursor.execute(
            "SELECT id FROM funcionario "
            "WHERE ativo IS NULL OR ativo = 1 ORDER BY id"
        )
        rows = cursor.fetchall()
    except Exception:
        cursor.execute("SELECT id FROM funcionario ORDER BY id")
        rows = cursor.fetchall()
    return [int(r["id"]) for r in rows]


def remover_seeds(cursor):
    cursor.execute(
        "DELETE FROM tramitacao WHERE descricao LIKE %s",
        (SEED_MARKER + "%",),
    )
    return cursor.rowcount


def main():
    parser = argparse.ArgumentParser(description="Seed de tramitacoes de teste.")
    parser.add_argument("--abertos", action="store_true",
                        help="Apenas contratos com status='aberto'.")
    parser.add_argument("--limit", type=int, default=0,
                        help="Maximo de contratos (0 = sem limite).")
    parser.add_argument("--remove", action="store_true",
                        help="Remove todos os seeds inseridos anteriormente.")
    args = parser.parse_args()

    schema = os.environ.get("DB_NAME", "consorcio_gm")
    try:
        conn = connect_db()
        cursor = conn.cursor()
    except Exception as e:
        print(f"ERRO: falha ao conectar no banco: {e}")
        sys.exit(1)

    cols_info = colunas_da_tabela(cursor, schema, "tramitacao")
    if not cols_info:
        print("ERRO: tabela 'tramitacao' nao existe no schema.")
        cursor.close()
        conn.close()
        sys.exit(1)
    cols_tabela = set(cols_info.keys())
    print(f"Colunas detectadas em tramitacao: {sorted(cols_tabela)}")

    # Log dos ENUMs detectados (ajuda debug do usuario).
    for cname in ("tipo", "cpc", "status"):
        info = cols_info.get(cname)
        if info and info.get("enum_values"):
            print(f"  - ENUM em '{cname}': {info['enum_values']}")

    if args.remove:
        n = remover_seeds(cursor)
        conn.commit()
        print(f"Seeds removidos: {n} registro(s).")
        cursor.close()
        conn.close()
        return

    if "id_contrato" not in cols_tabela:
        print("ERRO: tabela 'tramitacao' nao possui coluna 'id_contrato'.")
        cursor.close()
        conn.close()
        sys.exit(1)

    contratos = fetch_contratos(cursor, args.abertos, args.limit)
    if not contratos:
        print("ALERTA: nenhum contrato encontrado.")
        cursor.close()
        conn.close()
        return
    print(f"Contratos localizados: {len(contratos)}")

    # Se a tabela exige id_funcionario, precisamos ter ao menos 1 funcionario.
    funcs_ids = []
    if "id_funcionario" in cols_tabela:
        funcs_ids = fetch_funcionarios(cursor)
        if not funcs_ids:
            print("ERRO: tabela 'tramitacao' exige id_funcionario mas nao ha "
                  "funcionarios cadastrados. Rode seed_funcionarios.py antes.")
            cursor.close()
            conn.close()
            sys.exit(1)
        print(f"Funcionarios disponiveis para round-robin: {len(funcs_ids)}")

    inseridos = 0
    pulados = 0
    sem_pessoa = 0
    for idx, contrato in enumerate(contratos):
        id_contrato = int(contrato["id"])

        # id_pessoa NOT NULL e exigido na maioria dos schemas: pula contratos
        # que nao tem id_pessoa (evita explodir o insert).
        if "id_pessoa" in cols_tabela and not contrato.get("id_pessoa"):
            sem_pessoa += 1
            continue

        if ja_tem_seed(cursor, id_contrato):
            pulados += 1
            continue

        id_func = funcs_ids[idx % len(funcs_ids)] if funcs_ids else None
        reg = montar_registro(contrato, idx, id_func, cols_info)
        usar = {k: v for k, v in reg.items() if k in cols_tabela}

        col_list = list(usar.keys())
        placeholders = ", ".join(["%s"] * len(col_list))
        col_sql = ", ".join("`" + c + "`" for c in col_list)
        sql = f"INSERT INTO tramitacao ({col_sql}) VALUES ({placeholders})"
        try:
            cursor.execute(sql, [usar[c] for c in col_list])
            inseridos += 1
            if inseridos % 200 == 0:
                print(f"  ... {inseridos} inseridos ate agora")
                conn.commit()
        except Exception as e:
            print(f" -> ERRO ao inserir tramitacao p/ contrato {id_contrato}: {e}")
            conn.rollback()
            cursor.close()
            conn.close()
            sys.exit(1)

    conn.commit()
    print("")
    print(
        f"Seed finalizado: {inseridos} inseridos, {pulados} pulados "
        f"(ja tinham seed), {sem_pessoa} pulados (contrato sem id_pessoa)."
    )

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
