# -*- coding: utf-8 -*-
"""
Migra tipos de telefone/email que continham 'avalista' no nome para tipos
equivalentes, removendo linhas conflitantes (UNIQUE id_pessoa+tipo).

Uso:
    python Python/migrar_remover_avalista_contatos.py
    python Python/migrar_remover_avalista_contatos.py --dry-run

Ambiente: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (igual app.py e outros scripts).

Documentacao do projeto:
    docs/METODOLOGIA-JOAO-BARBOSA.md na raiz do repositorio.
"""
from __future__ import annotations

import argparse
import os
import sys

import pymysql

TEL_MAP = [
    ("avalista_fixo", "fixo"),
    ("avalista_celular", "celular"),
    ("avalista_comercial", "comercial"),
    ("comercial_avalista", "comercial"),
]

EMAIL_MAP = [
    ("avalista", "principal"),
]


def get_conn():
    return pymysql.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", "root"),
        database=os.environ.get("DB_NAME", "consorcio_gm"),
        charset="utf8mb4",
    )


def count_conflicts_tel(cursor, orig: str, dest: str) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) FROM telefone t1
        INNER JOIN telefone t2
          ON t2.id_pessoa = t1.id_pessoa AND t2.tipo = %s
        WHERE t1.tipo = %s
        """,
        (dest, orig),
    )
    return int(cursor.fetchone()[0])


def count_rename_tel(cursor, orig: str) -> int:
    cursor.execute("SELECT COUNT(*) FROM telefone WHERE tipo = %s", (orig,))
    return int(cursor.fetchone()[0])


def migrate_telefone(cursor, dry_run: bool) -> dict:
    total_del = 0
    total_upd = 0
    for orig, dest in TEL_MAP:
        n_conf = count_conflicts_tel(cursor, orig, dest)
        n_orig = count_rename_tel(cursor, orig)
        n_ren = n_orig - n_conf
        print(f"  [telefone] {orig!r} -> {dest!r}: conflitos a remover={n_conf}, a renomear={n_ren} (linhas {orig!r}={n_orig})")
        if not dry_run:
            if n_conf:
                cursor.execute(
                    """
                    DELETE t1 FROM telefone t1
                    INNER JOIN telefone t2
                      ON t2.id_pessoa = t1.id_pessoa AND t2.tipo = %s
                    WHERE t1.tipo = %s
                    """,
                    (dest, orig),
                )
                total_del += cursor.rowcount
            if n_ren:
                cursor.execute(
                    "UPDATE telefone SET tipo = %s WHERE tipo = %s",
                    (dest, orig),
                )
                total_upd += cursor.rowcount
    if dry_run:
        return {"del": 0, "upd": 0, "mode": "dry_run"}
    return {"del": total_del, "upd": total_upd, "mode": "apply"}


def count_conflicts_email(cursor, orig: str, dest: str) -> int:
    cursor.execute(
        """
        SELECT COUNT(*) FROM email t1
        INNER JOIN email t2
          ON t2.id_pessoa = t1.id_pessoa AND t2.tipo = %s
        WHERE t1.tipo = %s
        """,
        (dest, orig),
    )
    return int(cursor.fetchone()[0])


def count_rename_email(cursor, orig: str) -> int:
    cursor.execute("SELECT COUNT(*) FROM email WHERE tipo = %s", (orig,))
    return int(cursor.fetchone()[0])


def migrate_email(cursor, dry_run: bool) -> dict:
    total_del = 0
    total_upd = 0
    for orig, dest in EMAIL_MAP:
        n_conf = count_conflicts_email(cursor, orig, dest)
        n_orig = count_rename_email(cursor, orig)
        n_ren = n_orig - n_conf
        print(f"  [email] {orig!r} -> {dest!r}: conflitos a remover={n_conf}, a renomear={n_ren} (linhas {orig!r}={n_orig})")
        if not dry_run:
            if n_conf:
                cursor.execute(
                    """
                    DELETE t1 FROM email t1
                    INNER JOIN email t2
                      ON t2.id_pessoa = t1.id_pessoa AND t2.tipo = %s
                    WHERE t1.tipo = %s
                    """,
                    (dest, orig),
                )
                total_del += cursor.rowcount
            if n_ren:
                cursor.execute(
                    "UPDATE email SET tipo = %s WHERE tipo = %s",
                    (dest, orig),
                )
                total_upd += cursor.rowcount
    if dry_run:
        return {"del": 0, "upd": 0}
    return {"del": total_del, "upd": total_upd}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Migra tipos avalista_* (telefone) e avalista (email) para tipos sem 'avalista'."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Apenas reporta contadores; nao aplica alteracoes.",
    )
    args = parser.parse_args()
    dry = args.dry_run

    try:
        conn = get_conn()
    except Exception as exc:
        print(f"Falha ao conectar: {exc}", file=sys.stderr)
        return 1

    if dry:
        print("MODO DRY-RUN: nenhuma alteracao sera gravada.\n")
    else:
        print("Aplicando alteracoes (transacao)...\n")

    try:
        with conn.cursor() as cursor:
            r_tel = migrate_telefone(cursor, dry)
            r_email = migrate_email(cursor, dry)
        if dry:
            conn.rollback()
        else:
            conn.commit()
            print(
                f"\nConcluido. Totais aprox. (telefone+email): deletados={r_tel.get('del', 0) + r_email.get('del', 0)} "
                f"renomeados={r_tel.get('upd', 0) + r_email.get('upd', 0)}"
            )
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        print(f"Erro: {exc}", file=sys.stderr)
        return 1
    finally:
        try:
            conn.close()
        except Exception:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
