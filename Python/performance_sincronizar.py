# -*- coding: utf-8 -*-
"""
Preenche a tabela `performance` a partir de ocorrencia, contrato e parcela
(parcela fechada de menor vencimento por contrato, p_antiga), alinhado a query
usada no relatorio de Performance (mesmos JOINs e regra de atraso).

Cobertura (padrao, recomendado):
    python3 performance_sincronizar.py

    Reconstroi a tabela inteira para todas as ocorrencia em aberto, sem filtrar
    `data_arquivo` aqui. As faixas (5/10/15/20) e o recorte de periodo sao
    responsabilidade da tela (filtro no app); na base mantemos o universo em
    cobranca.

`recovery_code` (d30/d60/d90/dplus) e `grupo_atraso` batem com os buckets
DATEDIFF do relatorio; o painel Performance aplica teto cumulativo 30/60/90 dias
sobre essa mesma escala (90 = ate 90 dias, sem a fatia 90+).

Janela opcional (reimportacao, debug - mesmo criterio da referencia, so que
cortado por data_arquivo):
    python3 performance_sincronizar.py 2026-01-10 2026-01-12
"""
import datetime
import os
import sys

import pymysql


def connect_db():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "root"),
        database=os.environ.get("DB_NAME", "consorcio_gm"),
        charset="utf8mb4",
        autocommit=False,
        cursorclass=pymysql.cursors.DictCursor,
    )


_SQL_DELETE_TUDO = """
DELETE FROM performance
"""

_SQL_DELETE_INTERVALO = """
DELETE p FROM performance p
INNER JOIN ocorrencia o ON o.id = p.id_ocorrencia
WHERE o.status = 'aberto'
  AND o.data_arquivo >= %s
  AND o.data_arquivo <= %s
"""

# Alinhado a referencia: o LEFT c; INNER p_antiga em c.id; parcela "mais antiga" fechada
_SQL_INSERT = """
INSERT INTO performance (
    id_ocorrencia, id_contrato, id_arquivo_gm, data_arquivo,
    grupo, cota, ocorrencia_status, descricao,
    id_parcela_ancora, vencimento_mais_antigo, data_pagamento, valor_parcela,
    is_performado, grupo_atraso, recovery_code
)
SELECT
    o.id,
    c.id,
    o.id_arquivo_gm,
    o.data_arquivo,
    c.grupo,
    c.cota,
    o.status,
    o.descricao,
    p_antiga.id,
    p_antiga.vencimento,
    p_antiga.data_pagamento,
    p_antiga.valor_total,
    1,
    CASE
        WHEN p_antiga.data_pagamento IS NULL
             OR p_antiga.vencimento IS NULL
        THEN NULL
        WHEN DATEDIFF(p_antiga.data_pagamento, p_antiga.vencimento) <= 30
        THEN 'At\u00e9 30 dias'
        WHEN DATEDIFF(p_antiga.data_pagamento, p_antiga.vencimento) <= 60
        THEN 'At\u00e9 60 dias'
        WHEN DATEDIFF(p_antiga.data_pagamento, p_antiga.vencimento) <= 90
        THEN 'At\u00e9 90 dias'
        ELSE 'Mais de 90 dias'
    END,
    CASE
        WHEN p_antiga.data_pagamento IS NULL
             OR p_antiga.vencimento IS NULL
        THEN NULL
        WHEN DATEDIFF(p_antiga.data_pagamento, p_antiga.vencimento) <= 30
        THEN 'd30'
        WHEN DATEDIFF(p_antiga.data_pagamento, p_antiga.vencimento) <= 60
        THEN 'd60'
        WHEN DATEDIFF(p_antiga.data_pagamento, p_antiga.vencimento) <= 90
        THEN 'd90'
        ELSE 'dplus'
    END
FROM ocorrencia o
LEFT JOIN contrato c ON c.id = o.id_contrato
INNER JOIN (
    SELECT
        p1.id,
        p1.id_contrato,
        p1.vencimento,
        p1.data_pagamento,
        p1.valor_total
    FROM parcela p1
    INNER JOIN (
        SELECT
            id_contrato,
            MIN(vencimento) AS min_vencimento
        FROM parcela
        WHERE status = 'fechado'
        GROUP BY id_contrato
    ) p2
        ON p1.id_contrato = p2.id_contrato
       AND p1.vencimento = p2.min_vencimento
    WHERE p1.status = 'fechado'
) p_antiga ON p_antiga.id_contrato = c.id
WHERE o.status = 'aberto'
"""

_SQL_OU_INTERVALO = """
  AND o.data_arquivo >= %s
  AND o.data_arquivo <= %s
"""


def _parse_data(s, label):
    try:
        datetime.datetime.strptime(s, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(f"Data invalida ({label}): {s!r}. Use YYYY-MM-DD.") from exc


def sincronizar_tudo(*, verbose=True):
    """
    Limpa `performance` e reconstroi a partir de todas ocorrencia com status=aberto
    que participam do mesmo SELECT da referencia (INNER p_antiga; sem filtro de data).
    """
    deleted = 0
    inserted = 0
    conn = connect_db()
    try:
        with conn.cursor() as cur:
            cur.execute(_SQL_DELETE_TUDO)
            deleted = cur.rowcount
            cur.execute(_SQL_INSERT)
            inserted = cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    if verbose:
        print(
            f"performance: sincronizacao COMPLETA | "
            f"removidas(aprox) {deleted} | inseridas {inserted}"
        )
    return {"deleted": deleted, "inserted": inserted}


def sincronizar_intervalo(data_inicio, data_fim, *, verbose=True):
    """
    data_inicio / data_fim: 'YYYY-MM-DD' (inclusive) em `o.data_arquivo`.
    Apaga linhas nesse janela e reinsere; uso opcional (ex. reprocessar import).
    """
    deleted = 0
    inserted = 0
    conn = connect_db()
    try:
        with conn.cursor() as cur:
            cur.execute(_SQL_DELETE_INTERVALO, (data_inicio, data_fim))
            deleted = cur.rowcount
            cur.execute(_SQL_INSERT + _SQL_OU_INTERVALO, (data_inicio, data_fim))
            inserted = cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    if verbose:
        print(
            f"performance: intervalo {data_inicio} .. {data_fim} | "
            f"removidas(aprox) {deleted} | inseridas {inserted}"
        )
    return {"deleted": deleted, "inserted": inserted}


def main():
    if len(sys.argv) == 1:
        try:
            sincronizar_tudo()
        except Exception as e:
            print(f"ERRO: {e}")
            sys.exit(1)
        return
    if len(sys.argv) == 3:
        d0, d1 = sys.argv[1].strip(), sys.argv[2].strip()
        try:
            _parse_data(d0, "inicio")
            _parse_data(d1, "fim")
            sincronizar_intervalo(d0, d1)
        except ValueError as e:
            print(e)
            sys.exit(1)
        except Exception as e:
            print(f"ERRO: {e}")
            sys.exit(1)
        return
    print("Uso: python3 performance_sincronizar.py")
    print("      (sincroniza todas as ocorrencias aberto no criterio da referencia)")
    print("  ou: python3 performance_sincronizar.py YYYY-MM-DD YYYY-MM-DD")
    print("      (opcional: reprocessa apenas o intervalo de data_arquivo)")
    sys.exit(1)


if __name__ == "__main__":
    main()
