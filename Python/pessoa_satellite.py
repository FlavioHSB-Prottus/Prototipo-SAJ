"""
Upserts nas tabelas satelite endereco, telefone, email (FK pessoa.id).
Usado pelos trackers apos INSERT/UPDATE em pessoa a partir de registro_1 e registro5.
"""

from __future__ import annotations


def _s(val) -> str:
    if val is None or val == "None":
        return ""
    return str(val).strip()


def _null_if_empty(s: str):
    s = _s(s)
    return s if s else None


def upsert_endereco(
    cursor,
    pessoa_id: int,
    tipo: str,
    logradouro,
    bairro,
    complemento,
    cep,
    cidade,
    estado,
) -> None:
    if not any(
        map(
            _s,
            (logradouro, bairro, complemento, cep, cidade, estado),
        )
    ):
        return
    cursor.execute(
        """
        INSERT INTO endereco (id_pessoa, tipo, logradouro, bairro, complemento, cep, cidade, estado)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            logradouro = VALUES(logradouro),
            bairro = VALUES(bairro),
            complemento = VALUES(complemento),
            cep = VALUES(cep),
            cidade = VALUES(cidade),
            estado = VALUES(estado),
            updated_at = CURRENT_TIMESTAMP
        """,
        (
            pessoa_id,
            tipo,
            _null_if_empty(logradouro),
            _null_if_empty(bairro),
            _null_if_empty(complemento),
            _null_if_empty(cep),
            _null_if_empty(cidade),
            _null_if_empty(estado),
        ),
    )


def upsert_telefone(cursor, pessoa_id: int, tipo: str, numero_completo, ramal=None) -> None:
    num = _s(numero_completo)
    ram = _s(ramal)
    if not num and not ram:
        return
    cursor.execute(
        """
        INSERT INTO telefone (id_pessoa, tipo, ddd, numero, ramal)
        VALUES (%s, %s, NULL, %s, %s)
        ON DUPLICATE KEY UPDATE
            numero = VALUES(numero),
            ramal = VALUES(ramal),
            updated_at = CURRENT_TIMESTAMP
        """,
        (pessoa_id, tipo, num or "", _null_if_empty(ramal)),
    )


def upsert_email_row(cursor, pessoa_id: int, tipo: str, email) -> None:
    em = _s(email)
    if not em:
        return
    cursor.execute(
        """
        INSERT INTO email (id_pessoa, tipo, email)
        VALUES (%s, %s, %s)
        ON DUPLICATE KEY UPDATE
            email = VALUES(email),
            updated_at = CURRENT_TIMESTAMP
        """,
        (pessoa_id, tipo, em),
    )


def upsert_devedor_contatos(cursor, pessoa_id: int, row: dict) -> None:
    """row: dict do registro_1 (chaves do layout / clean_name)."""
    upsert_endereco(
        cursor,
        pessoa_id,
        "principal",
        row.get("endereco"),
        row.get("bairro"),
        row.get("compl"),
        row.get("cep"),
        row.get("cidade"),
        row.get("estado"),
    )
    upsert_endereco(
        cursor,
        pessoa_id,
        "secundario",
        row.get("endereco2"),
        row.get("bairro2"),
        row.get("compl_2"),
        row.get("cep2"),
        row.get("cidade2"),
        row.get("estado2"),
    )

    tel_fixo = f"{_s(row.get('ddd_telefone'))}{_s(row.get('telefone'))}".strip()
    upsert_telefone(cursor, pessoa_id, "fixo", tel_fixo, None)

    tel_cel = f"{_s(row.get('ddd_celular'))}{_s(row.get('celular'))}".strip()
    upsert_telefone(cursor, pessoa_id, "celular", tel_cel, None)

    tel_com = f"{_s(row.get('ddd2'))}{_s(row.get('telefone2'))}".strip()
    upsert_telefone(cursor, pessoa_id, "comercial_devedor", tel_com, row.get("ramal_coml_devedor"))

    tel_conj = f"{_s(row.get('ddd_coml_conj'))}{_s(row.get('fon_coml_conj'))}".strip()
    upsert_telefone(cursor, pessoa_id, "comercial_conjuge", tel_conj, row.get("ramal_coml_conj_devedor"))

    upsert_email_row(cursor, pessoa_id, "principal", row.get("email"))


def upsert_avalista_contatos(cursor, pessoa_id: int, row: dict) -> None:
    """row: dict do registro5."""
    log = row.get("end_aval") or row.get("endereco_1")
    upsert_endereco(
        cursor,
        pessoa_id,
        "avalista_principal",
        log,
        row.get("bairro"),
        row.get("compl_aval"),
        row.get("cep_aval"),
        row.get("cidade_aval"),
        row.get("estado_aval"),
    )
    upsert_endereco(
        cursor,
        pessoa_id,
        "avalista_secundario",
        row.get("endereco2_aval"),
        row.get("bairro2"),
        None,
        row.get("cep2_aval"),
        row.get("cidade2_aval"),
        row.get("estado2_aval"),
    )

    tel_f = f"{_s(row.get('ddd_aval'))}{_s(row.get('telefone_aval'))}".strip()
    upsert_telefone(cursor, pessoa_id, "avalista_fixo", tel_f, None)

    tel_c = f"{_s(row.get('ddd_celular_aval'))}{_s(row.get('celular_aval'))}".strip()
    upsert_telefone(cursor, pessoa_id, "avalista_celular", tel_c, None)

    tel_c2 = f"{_s(row.get('ddd2_coml_aval'))}{_s(row.get('telefone2_aval'))}".strip()
    upsert_telefone(cursor, pessoa_id, "avalista_comercial", tel_c2, row.get("ramal_coml_aval"))

    upsert_email_row(cursor, pessoa_id, "avalista", row.get("email_aval"))
