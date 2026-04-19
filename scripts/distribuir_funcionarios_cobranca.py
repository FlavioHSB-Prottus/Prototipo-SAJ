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

Regras de balanceamento (aplicadas apenas aos contratos ainda nao
atribuidos):
    1. Mesma media de VALOR TOTAL em cobranca por funcionario (por
       situacao critico / atencao / recente).
    2. Mesma media de QUANTIDADE de contratos em cobranca por
       funcionario (por situacao critico / atencao / recente).

Contratos ja presentes em funcionario_cobranca sao preservados (nao
trocam de funcionario automaticamente).

Uso:
    python distribuir_funcionarios_cobranca.py

Ambiente (opcional):
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
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


def init_estados(funcionarios_ids):
    """Matriz de carga (count + valor) por funcionario x situacao."""
    return {
        fid: {s: {"count": 0, "value": 0.0} for s in STATUS_LIST}
        for fid in funcionarios_ids
    }


def distribuir_balanceado(contratos, existentes, funcionarios_ids):
    """
    Distribui cada contrato NAO-existente ao funcionario com a MENOR
    carga (valor acumulado, contagem) naquela situacao. Dentro de cada
    situacao, os contratos sao processados em ordem decrescente de valor
    (LPT), o que produz o melhor balanceamento online para makespan.

    Retorna:
      - atribuicoes: dict {id_contrato: id_funcionario}
      - estados:     estado final de carga por funcionario x situacao
      - fixos:       dict {id_contrato: id_funcionario} com os que ja
                     existiam e nao foram remexidos
    """
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
    #    valor (LPT).
    por_status = {s: [] for s in STATUS_LIST}
    for c in contratos:
        cid = int(c["id_contrato"])
        if cid in fixos:
            continue
        sit = get_situacao(c.get("dias_atraso"))
        por_status[sit].append(c)
    for s in STATUS_LIST:
        por_status[s].sort(key=lambda x: float(x["valor_credito"] or 0), reverse=True)

    # 3) Greedy: menor (valor, count) na situacao.
    atribuicoes = {}
    for s in STATUS_LIST:
        for c in por_status[s]:
            cid = int(c["id_contrato"])
            valor = float(c["valor_credito"] or 0)

            def score(fid, _s=s):
                st = estados[fid][_s]
                return (st["value"], st["count"])

            fid_escolhido = min(funcionarios_ids, key=score)
            atribuicoes[cid] = fid_escolhido
            estados[fid_escolhido][s]["count"] += 1
            estados[fid_escolhido][s]["value"] += valor

    return atribuicoes, estados, fixos


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

    atribuicoes, estados, _fixos = distribuir_balanceado(
        contratos, existentes, ids_func
    )

    inseridos = persist(cursor, atribuicoes)
    conn.commit()
    print(f"Novas atribuicoes inseridas: {inseridos}")

    print_resumo(contratos, estados, funcionarios)
    print("SUCESSO: Distribuicao de funcionarios finalizada.")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
