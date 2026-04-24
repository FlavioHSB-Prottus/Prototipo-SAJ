# -*- coding: utf-8 -*-
"""
Carrega / atualiza os 4 funcionarios reais de cobranca da empresa na
tabela `funcionario`.

Comportamento:
    - Detecta dinamicamente as colunas da tabela `funcionario` via
      INFORMATION_SCHEMA (nao precisa conhecer o schema a priori).
    - Para cada funcionario:
        * procura por `cpf_cnpj` (UNIQUE) e, se nao achar, por `login`;
        * se existir, faz UPDATE com os campos do `DADOS`;
        * se nao existir, faz INSERT.
    - E idempotente: rodar N vezes produz o mesmo estado final.

Observacao sobre senha:
    As senhas reais dos funcionarios aparecem mascaradas (****) nos prints
    do sistema antigo, portanto NAO temos acesso a elas. Usamos um
    placeholder configuravel via `SENHA_PADRAO` para que o admin possa
    alterar manualmente depois da carga.

Uso:
    python scripts/seed_funcionarios.py

Ambiente (opcional):
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, SENHA_PADRAO
"""
import os
import sys

import pymysql


# -----------------------------------------------------------------------------
# Senha de fallback (as reais estao mascaradas nos prints originais).
# Troque via env var SENHA_PADRAO ou atualize diretamente no banco depois.
# -----------------------------------------------------------------------------
SENHA_PADRAO = os.environ.get("SENHA_PADRAO", "Trocar@123")


# -----------------------------------------------------------------------------
# Funcionarios reais de cobranca da Joao Barbosa, extraidos dos prints
# do sistema antigo. Mantem exatamente o que aparecia nas telas.
#
# Mapeamentos de campos do form antigo -> colunas da tabela `funcionario`:
#     Login               -> login
#     Senha               -> senha         (mascarada nos prints; ver acima)
#     Nivel de Acesso     -> nivel_acesso
#     Usuario Ativo       -> ativo         (Sim=1, Nao=0)
#     CPF                 -> cpf_cnpj
#     Matricula           -> matricula
#     Departamento        -> departamento  ("-- Selecione --" vira NULL)
#     Nome                -> nome
#     Data de Nascimento  -> data_nascimento
#     Sexo                -> sexo          (Masculino=M, Feminino=F)
#     Endereco            -> logradouro    (rua + numero juntos)
#     Complemento         -> complemento
#     Estado              -> estado        (sigla UF)
#     Cidade              -> cidade
#     Bairro              -> bairro
#     CEP                 -> cep
#     Celular             -> ddd + numero  (ex.: 81 / 996640148)
#     E-mail              -> email
# -----------------------------------------------------------------------------
DADOS = [
    {
        # -------- Imagem 1 --------
        "login":            "ARTHUR.JOSE.T",
        "senha":            SENHA_PADRAO,
        "nivel_acesso":     "Cobranca",
        "ativo":            1,
        "cpf_cnpj":         "12553467443",
        "matricula":        "matricula",
        "departamento":     None,
        "nome":             "PAULO ARTHUR JOSE DE SANTANA",
        "data_nascimento":  "1996-01-19",
        "sexo":             "M",
        "logradouro":       "RUA RODRIOGO DELAMARE, 19 A",
        "complemento":      None,
        "estado":           "PE",
        "cidade":           "Recife",
        "bairro":           "VARZEA",
        "cep":              "50970410",
        "ddd":              "81",
        "numero":           "996640148",
        "email":            None,
        "acesso_externo":   0,
    },
    {
        # -------- Imagem 2 --------
        "login":            "angela.m",
        "senha":            SENHA_PADRAO,
        "nivel_acesso":     "Cobranca",
        "ativo":            1,
        "cpf_cnpj":         "91944244468",
        "matricula":        "matricula",
        "departamento":     "Administrativo",
        "nome":             "Angela Maria pereira",
        "data_nascimento":  "1973-10-10",
        "sexo":             "F",
        "logradouro":       "Rua Dr. Miguel Vieira Ferreira, no 33",
        "complemento":      None,
        "estado":           "PE",
        "cidade":           "Recife",
        "bairro":           "Cordeiro",
        "cep":              "50721230",
        "ddd":              "81",
        "numero":           "999015875",
        "email":            "atendimento@joaobarbosa.com.br",
        "acesso_externo":   0,
    },
    {
        # -------- Imagem 3 --------
        "login":            "MAISA.T",
        "senha":            SENHA_PADRAO,
        "nivel_acesso":     "Cobranca",
        "ativo":            1,
        "cpf_cnpj":         "05809238432",
        "matricula":        "matricula",
        "departamento":     "Administrativo",
        "nome":             "MAISA BERNARDO DE SENA",
        "data_nascimento":  "1984-01-26",
        "sexo":             "F",
        "logradouro":       "RUA 72, 308",
        "complemento":      None,
        "estado":           "PE",
        "cidade":           "Olinda",
        "bairro":           "IV ETAPA - RIO DOCE",
        "cep":              "53090470",
        "ddd":              "81",
        "numero":           "987055611",
        "email":            None,
        "acesso_externo":   0,
    },
    {
        # -------- Imagem 4 --------
        "login":            "alzeni.m",
        "senha":            SENHA_PADRAO,
        "nivel_acesso":     "Cobranca",
        "ativo":            1,
        "cpf_cnpj":         "09598628469",
        "matricula":        "matricula",
        "departamento":     "Administrativo",
        "nome":             "Alzeni Maria de Lira do Nascimento",
        "data_nascimento":  "1991-07-06",
        "sexo":             "F",
        "logradouro":       "RUA COMPOSITOR JOSE DANTAS, 154",
        "complemento":      None,
        "estado":           "PE",
        "cidade":           "Recife",
        "bairro":           "VASCO DA GAMA",
        "cep":              "52081180",
        "ddd":              "81",
        "numero":           "989095550",
        "email":            None,
        "acesso_externo":   0,
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


def buscar_existente(cursor, cpf, login):
    """Procura primeiro por CPF (chave logica preferida); se nao achar,
    tenta por login. Retorna o id ou None."""
    cursor.execute(
        "SELECT id FROM funcionario WHERE cpf_cnpj = %s LIMIT 1", (cpf,)
    )
    row = cursor.fetchone()
    if row:
        return row["id"]
    if login:
        cursor.execute(
            "SELECT id FROM funcionario WHERE login = %s LIMIT 1", (login,)
        )
        row = cursor.fetchone()
        if row:
            return row["id"]
    return None


def montar_payload(dados, cols_tabela):
    """Devolve apenas os pares (coluna, valor) cujo coluna existe na tabela."""
    return {k: v for k, v in dados.items() if k in cols_tabela}


def inserir(cursor, payload):
    if "nome" not in payload:
        raise RuntimeError("payload sem 'nome'")
    cols = list(payload.keys())
    col_sql = ", ".join("`" + c + "`" for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))
    sql = f"INSERT INTO funcionario ({col_sql}) VALUES ({placeholders})"
    cursor.execute(sql, [payload[c] for c in cols])
    return cursor.lastrowid


def atualizar(cursor, func_id, payload):
    if not payload:
        return 0
    set_sql = ", ".join("`" + c + "` = %s" for c in payload.keys())
    sql = f"UPDATE funcionario SET {set_sql} WHERE id = %s"
    cursor.execute(sql, list(payload.values()) + [func_id])
    return cursor.rowcount


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
    print(f"Senha padrao usada nos registros: {SENHA_PADRAO!r}")
    print("")

    inseridos = 0
    atualizados = 0
    sem_mudanca = 0

    for func in DADOS:
        payload = montar_payload(func, cols_tabela)
        nome = func.get("nome", "<sem nome>")
        try:
            existente_id = buscar_existente(
                cursor, func.get("cpf_cnpj"), func.get("login")
            )
            if existente_id:
                rows = atualizar(cursor, existente_id, payload)
                if rows > 0:
                    atualizados += 1
                    print(f" -> ATUALIZADO id={existente_id}: {nome}")
                else:
                    sem_mudanca += 1
                    print(f" -> sem alteracao id={existente_id}: {nome}")
            else:
                novo_id = inserir(cursor, payload)
                inseridos += 1
                print(f" -> INSERIDO id={novo_id}: {nome}")
        except Exception as e:
            print(f" -> ERRO ao processar {nome}: {e}")
            conn.rollback()
            cursor.close()
            conn.close()
            sys.exit(1)

    conn.commit()
    print("")
    print(
        f"Seed finalizado: {inseridos} inseridos, "
        f"{atualizados} atualizados, {sem_mudanca} ja estavam identicos."
    )

    cursor.execute(
        "SELECT id, nome, login, cpf_cnpj, nivel_acesso, ativo "
        "FROM funcionario ORDER BY id"
    )
    print("")
    print("Estado final da tabela funcionario:")
    for r in cursor.fetchall():
        ativo_txt = "SIM" if r["ativo"] else "nao"
        nivel = r["nivel_acesso"] or "-"
        print(
            f"   [{r['id']:>3}] {r['nome']:<40}  "
            f"login={r['login'] or '-':<18}  "
            f"cpf={r['cpf_cnpj']:<14}  "
            f"nivel={nivel:<10}  ativo={ativo_txt}"
        )

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
