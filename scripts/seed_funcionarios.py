# -*- coding: utf-8 -*-
"""
Insere 4 funcionarios de teste na tabela `funcionario`.

Estrategia:
    1. Le INFORMATION_SCHEMA.COLUMNS para descobrir quais colunas existem
       na tabela `funcionario` do banco atual (nao precisamos conhecer o
       schema a priori).
    2. Para cada funcionario a inserir, monta dinamicamente um INSERT
       usando apenas as colunas que:
         - existem na tabela,
         - estao no dicionario `DADOS` abaixo.
    3. Evita duplicar: se ja existir funcionario com o mesmo `nome`, nao
       insere novamente.

Uso:
    python scripts/seed_funcionarios.py

Ambiente (opcional):
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
"""
import os
import sys

import pymysql


# Funcionarios ficticios (4). Os nomes sao fixos para o script ser
# idempotente: rodar de novo NAO duplica.
# Schema real detectado em consorcio_gm.funcionario:
#     id, nome, cpf_cnpj, login, senha, data_nascimento, ativo,
#     acesso_externo, created_at, updated_at
#
# Campos abaixo sao usados como superset: o script so insere os que
# tambem existem na tabela.
DADOS = [
    {
        "nome": "Ana Paula Ribeiro",
        "cpf_cnpj": "111.222.333-01",
        "login": "ana.ribeiro",
        "senha": "Teste@123",
        "data_nascimento": "1990-04-12",
        "ativo": 1,
        "acesso_externo": 0,
    },
    {
        "nome": "Bruno Carvalho Mendes",
        "cpf_cnpj": "111.222.333-02",
        "login": "bruno.mendes",
        "senha": "Teste@123",
        "data_nascimento": "1988-09-03",
        "ativo": 1,
        "acesso_externo": 0,
    },
    {
        "nome": "Camila Souza Dias",
        "cpf_cnpj": "111.222.333-03",
        "login": "camila.dias",
        "senha": "Teste@123",
        "data_nascimento": "1993-01-27",
        "ativo": 1,
        "acesso_externo": 0,
    },
    {
        "nome": "Diego Almeida Rocha",
        "cpf_cnpj": "111.222.333-04",
        "login": "diego.rocha",
        "senha": "Teste@123",
        "data_nascimento": "1986-06-18",
        "ativo": 1,
        "acesso_externo": 0,
    },
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
    cursor.execute(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
        """,
        (schema, tabela),
    )
    return {r["COLUMN_NAME"] for r in cursor.fetchall()}


def ja_existe(cursor, nome):
    cursor.execute("SELECT id FROM funcionario WHERE nome = %s LIMIT 1", (nome,))
    return cursor.fetchone() is not None


def main():
    schema = os.environ.get("DB_NAME", "consorcio_gm")
    try:
        conn = connect_db()
        cursor = conn.cursor()
    except Exception as e:
        print(f"ERRO: falha ao conectar no banco: {e}")
        sys.exit(1)

    cols_tabela = colunas_da_tabela(cursor, schema, "funcionario")
    if not cols_tabela:
        print("ERRO: tabela 'funcionario' nao existe no schema.")
        cursor.close()
        conn.close()
        sys.exit(1)

    print(f"Colunas detectadas em funcionario: {sorted(cols_tabela)}")

    inseridos = 0
    pulados = 0
    for func in DADOS:
        if ja_existe(cursor, func["nome"]):
            print(f" -> (ja existe) {func['nome']}")
            pulados += 1
            continue

        # Usa apenas as chaves do funcionario que tambem sao colunas da
        # tabela (ignora o resto silenciosamente).
        usar = {k: v for k, v in func.items() if k in cols_tabela}
        if "nome" not in usar:
            print(f" -> ERRO: tabela 'funcionario' nao tem coluna 'nome'.")
            conn.rollback()
            cursor.close()
            conn.close()
            sys.exit(1)

        col_list = list(usar.keys())
        placeholders = ", ".join(["%s"] * len(col_list))
        col_sql = ", ".join("`" + c + "`" for c in col_list)
        sql = f"INSERT INTO funcionario ({col_sql}) VALUES ({placeholders})"
        try:
            cursor.execute(sql, [usar[c] for c in col_list])
            inseridos += 1
            print(f" -> INSERIDO: {func['nome']} (id={cursor.lastrowid})")
        except Exception as e:
            print(f" -> ERRO ao inserir {func['nome']}: {e}")
            conn.rollback()
            cursor.close()
            conn.close()
            sys.exit(1)

    conn.commit()
    print("")
    print(f"Seed finalizado: {inseridos} inseridos, {pulados} pulados (ja existiam).")

    # Lista final.
    cursor.execute("SELECT id, nome FROM funcionario ORDER BY id")
    for r in cursor.fetchall():
        print(f"   [{r['id']}] {r['nome']}")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
