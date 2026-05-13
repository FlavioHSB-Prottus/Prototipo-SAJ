# -*- coding: utf-8 -*-
"""SERASA-CONVEM layout: fixed 600-char lines, CRLF (negativacao/inclusao 1I e positivacao/exclusao 1E).

Examples under TXT Negativacao e Positivacao/. Generic PROREDE manual uses 256 chars; CONVEM samples use 600.

Optional env vars: see montar_arquivo_txt docstring.
"""
from __future__ import annotations

import os
import re
import unicodedata
from datetime import date, datetime
from pathlib import Path

LINHA_LEN = 600

# Primeira coluna (1-based) do codigo do credor (4 digitos), conforme layout SERASA-CONVEM / exemplo operacional.
_POS_INICIO_CODIGO_CREDOR_1 = 527

# 40-digit block between CEP and J1 from SERASA_GM_040520264912.TXT detail line.
_MEIO_ZEROS40_PADRAO = '0000000002279090000000847630259000000000'


def _ascii_latin1(s: str | None, upper: bool = False) -> str:
    if s is None:
        return ''
    t = unicodedata.normalize('NFKD', str(s))
    t = ''.join(c for c in t if ord(c) < 127 or c in '\t')
    if upper:
        t = t.upper()
    return t.encode('latin-1', errors='replace').decode('latin-1')


def _fit(s: str | None, width: int, align: str = 'left', pad: str = ' ') -> str:
    raw = _ascii_latin1(s or '', upper=False)
    if len(raw) > width:
        raw = raw[:width]
    if align == 'right':
        return raw.rjust(width, pad)[:width]
    return raw.ljust(width, pad)[:width]


def _fit_num_digits(val: str | None, width: int) -> str:
    d = re.sub(r'\D', '', str(val or ''))
    return d[-width:].zfill(width) if d else '0' * width


def _ler_primeira_linha_txt(path: Path) -> str:
    text = path.read_bytes().decode('latin-1', errors='replace')
    line = text.splitlines()[0] if text else ''
    if len(line) != LINHA_LEN:
        raise ValueError(
            f'Model header in {path} must be {LINHA_LEN} chars, got {len(line)}.'
        )
    return line


def patch_header_data_remessa(header_template: str, data_yyyymmdd: str) -> str:
    if len(header_template) != LINHA_LEN:
        raise ValueError('invalid header_template length')
    if not re.fullmatch(r'\d{8}', data_yyyymmdd):
        raise ValueError('data_yyyymmdd must be YYYYMMDD')
    new_h, n = re.subn(r'(20\d{6})', data_yyyymmdd, header_template, count=1)
    if n != 1:
        raise ValueError('Could not find YYYYMMDD in model header.')
    return new_h


def patch_header_identificacao(header_line: str, trecho_identificacao: str) -> str:
    h = header_line
    start = h.find('SERASA-CONVEM')
    if start < 0:
        raise ValueError('SERASA-CONVEM not found in model header.')
    end = start
    while end < len(h) and h[end] not in (' ', '\t'):
        end += 1
    old = h[start:end]
    novo = _fit(trecho_identificacao, len(old), align='left')
    return h[:start] + novo + h[end:]


def montar_j1_ref(grupo, cota) -> str:
    g = re.sub(r'\D', '', str(grupo or ''))
    c = re.sub(r'\D', '', str(cota or ''))
    core = (g + c)[:15].zfill(15)
    return 'J1' + core


def montar_meio_67(uf: str | None, cep: str | None, grupo, cota, zeros40: str | None = None) -> str:
    uf2 = _fit(uf or 'SP', 2, align='left').upper()[:2].ljust(2)[:2]
    cep8 = _fit_num_digits(cep, 8)
    z40 = (zeros40 or _MEIO_ZEROS40_PADRAO)[:40].ljust(40)[:40]
    j17 = montar_j1_ref(grupo, cota).ljust(17)[:17]
    seg = uf2 + cep8 + z40 + j17
    return seg[:67].ljust(67)[:67]


def montar_credor_113(nome_credor: str | None, codigo_produto: str = '5016') -> str:
    nome = _ascii_latin1(nome_credor or '', upper=True)[:37].ljust(37)
    bloco46 = nome + (' ' * 9) + _fit_num_digits(codigo_produto, 4)[-4:]
    return bloco46.ljust(113)[:113]


# Bloco credor no detalhe (legado PHP: "J10" + 14 digitos CNPJ + razao 37 = 51 chars).
_GMAC_CNPJ14 = '49937055000111'
_GMAC_NOME37_PAD = 'GMAC ADMINISTRADORA DE CONSORCIO LTDA'


def _montar_j10_bloco_credor_51(
    cnpj14: str | None,
    nome_razao37: str | None,
    codigo_credor: str,
) -> str:
    """51 caracteres: CNPJ 14 + nome credor 37 (como sistema.geracao.arquivo.negativacao.serasa.php)."""
    cod = _fit_num_digits(codigo_credor, 4)[-4:]
    if cod == '5015':
        cnpj_d = _fit_num_digits(cnpj14, 14) if cnpj14 else '61074175000138'
        nome_d = (nome_razao37 or 'MAPFRE SEGUROS GERAIS S.A.').strip() or 'MAPFRE SEGUROS GERAIS S.A.'
    else:
        cnpj_d = _fit_num_digits(cnpj14, 14) if cnpj14 else _GMAC_CNPJ14
        nome_d = (nome_razao37 or _GMAC_NOME37_PAD).strip() or _GMAC_NOME37_PAD
    nome37 = _ascii_latin1(nome_d, upper=True)[:37].ljust(37)
    return (cnpj_d + nome37)[:51].ljust(51)[:51]


def montar_linha_detalhe_inclusao(
    seq_linha_arquivo: int,
    seq_interno6: int,
    data_ref: date | None,
    data_vencimento: date | None,
    cx: str,
    cpf_cnpj: str | None,
    nome: str | None,
    data_nasc: date | str | None,
    logradouro: str | None,
    cidade: str | None,
    uf: str | None,
    cep: str | None,
    grupo,
    cota,
    nome_credor: str | None,
    codigo_credor: str = '5016',
    zeros40: str | None = None,
    *,
    bairro: str | None = None,
    tipo_operacao_ie: str = 'I',
    valor_centavos: int | None = None,
    cnpj_credor: str | None = None,
) -> str:
    """Linha de detalhe 600 chars alinhada ao legado PHP (inclusao 1I / exclusao 1E, motivo 00/02).

    ``zeros40`` mantido na assinatura por compatibilidade com ``montar_arquivo_txt``; o layout PHP
    posiciona valor e contrato apos o CEP (sem o bloco intermedio de 40 zeros do modelo antigo).
    """
    _ = zeros40  # nao usado neste layout

    def _ymd(d: date | str | None, default: str = '00000000') -> str:
        if d is None:
            return default
        if isinstance(d, date):
            return d.strftime('%Y%m%d')
        ds = str(d)[:10].replace('-', '')
        return ds if len(ds) == 8 and ds.isdigit() else default

    tipo_ie = (tipo_operacao_ie or 'I').strip().upper()[:1]
    if tipo_ie not in ('I', 'E'):
        tipo_ie = 'I'
    motivo_baixa = '00' if tipo_ie == 'I' else '02'
    _ = seq_interno6  # legado PHP usa campo fixo 000127; parametro mantido por compatibilidade de chamadas

    doc_digits = re.sub(r'\D', '', str(cpf_cnpj or ''))
    juridica = len(doc_digits) >= 14
    tipo_pessoa = 'J' if juridica else 'F'
    tipo_doc_dig = '1' if juridica else '2'
    doc15 = doc_digits.zfill(15)[-15:] if doc_digits else '0' * 15
    bloco_doc_motivo = tipo_pessoa + tipo_doc_dig + doc15 + motivo_baixa
    brancos55 = ' ' * 55

    dt1 = _ymd(data_ref)
    dt2 = _ymd(data_vencimento, default=dt1)

    dtnasc_linha = '00000000' if juridica else _ymd(data_nasc)

    g = re.sub(r'\D', '', str(grupo or ''))
    c = re.sub(r'\D', '', str(cota or ''))
    contrato_nrs = (g + c)[:16].zfill(16) if (g + c) else '0' * 16

    try:
        vc = int(valor_centavos) if valor_centavos is not None else 0
    except (TypeError, ValueError):
        vc = 0
    if vc < 0:
        vc = 0
    valor15 = str(vc)[-15:].zfill(15)

    uf2 = _fit(uf or 'SP', 2, align='left').upper()[:2].ljust(2)[:2]
    cep8 = _fit_num_digits(cep, 8)

    nome_credor_37 = _ascii_latin1(nome_credor or '', upper=True)[:37]
    bloco51 = _montar_j10_bloco_credor_51(cnpj_credor, nome_credor_37 or None, codigo_credor)
    cod4 = _fit_num_digits(codigo_credor, 4)[-4:]

    prefix = ''.join(
        [
            '1' + tipo_ie,
            '000127',
            dt1,
            dt2,
            _fit(cx, 2, align='left').upper()[:2].ljust(2)[:2],
            ' ' * 5,
            bloco_doc_motivo,
            brancos55,
            _fit(_ascii_latin1(nome, upper=True), 70, align='left', pad=' '),
            dtnasc_linha,
            ' ' * 140,
            _fit(_ascii_latin1(logradouro, upper=True), 45, align='left', pad=' '),
            _fit(_ascii_latin1(bairro, upper=True), 20, align='left', pad=' '),
            _fit(_ascii_latin1(cidade, upper=True), 25, align='left', pad=' '),
            uf2,
            cep8,
            valor15,
            contrato_nrs,
            '000000000',
            'J10',
            bloco51,
            '  ',
        ]
    )
    cod_start0 = _POS_INICIO_CODIGO_CREDOR_1 - 1
    pad_before = cod_start0 - len(prefix)
    if pad_before < 0:
        raise RuntimeError(
            f'Prefixo SERASA ({len(prefix)} chars) excede a posicao do codigo credor ({_POS_INICIO_CODIGO_CREDOR_1}).'
        )
    seq7 = str(seq_linha_arquivo).zfill(7)
    pad_after = LINHA_LEN - len(prefix) - pad_before - len(cod4) - len(seq7)
    if pad_after < 0:
        raise RuntimeError('Espaco insuficiente apos codigo credor na linha SERASA.')

    line = prefix + (' ' * pad_before) + cod4 + (' ' * pad_after) + seq7
    if len(line) != LINHA_LEN:
        raise RuntimeError(f'detail line length {len(line)}, expected {LINHA_LEN}')
    return line


def montar_linha_trailer(seq_linha_arquivo: int) -> str:
    body = '9'.ljust(LINHA_LEN - 7, ' ') + str(seq_linha_arquivo).zfill(7)
    if len(body) != LINHA_LEN:
        raise RuntimeError('invalid trailer')
    return body


def montar_arquivo_txt(
    modo: str,
    linhas_detalhe_payload: list[dict],
    *,
    template_dir: Path | None = None,
    data_remessa: date | None = None,
    trecho_ident_inclusao: str | None = None,
    trecho_ident_exclusao: str | None = None,
    cx_detalhe: str | None = None,
    zeros40: str | None = None,
    codigo_credor_padrao: str | None = None,
) -> tuple[bytes, str]:
    """Build file bytes (latin-1, CRLF) and suggested filename.

    modo: inclusao (negativacao, linhas **1I**, motivo 00) ou exclusao (positivacao, linhas **1E**,
    motivo 02), ambos com cabecalho + detalhes 600 chars + rodape, alinhado ao legado PHP
    ``sistema.geracao.arquivo.negativacao.serasa.php``.

    Env:
      SERASA_CONV_TEMPLATE_DIR - folder with SERASA_GM_*4912*.TXT and *4910*.TXT
      SERASA_CONV_IDENT_INCLUSAO / SERASA_CONV_IDENT_EXCLUSAO - full SERASA-CONVEM... token length as model
      SERASA_CONV_CX_DETALHE - 2 chars (default C3)
      SERASA_CONV_MEIO_ZEROS40 - 40 chars
      SERASA_CONV_CODIGO_CREDOR - 4 digits (default 5016)
    """
    modo = (modo or '').strip().lower()
    if modo not in ('inclusao', 'exclusao'):
        raise ValueError('modo must be inclusao or exclusao')

    root = Path(__file__).resolve().parent.parent
    tdir = template_dir or Path(
        os.environ.get('SERASA_CONV_TEMPLATE_DIR') or (root / 'TXT Negativacao e Positivacao')
    )

    glob4912 = sorted(tdir.glob('SERASA_GM_*4912*.TXT'))
    glob4910 = sorted(tdir.glob('SERASA_GM_*4910*.TXT'))
    if not glob4912 or not glob4910:
        raise FileNotFoundError(
            f'Missing SERASA_GM_*4912*.TXT or *4910*.TXT under {tdir}'
        )

    hdr_inc = _ler_primeira_linha_txt(glob4912[0])
    hdr_exc = _ler_primeira_linha_txt(glob4910[0])

    dr = data_remessa or date.today()
    ymd = dr.strftime('%Y%m%d')

    ident_i = (
        trecho_ident_inclusao
        or os.environ.get('SERASA_CONV_IDENT_INCLUSAO')
        or 'SERASA-CONVEM04004912E000400437789202'
    )
    ident_e = (
        trecho_ident_exclusao
        or os.environ.get('SERASA_CONV_IDENT_EXCLUSAO')
        or 'SERASA-CONVEM04004910E000400437789202'
    )

    cx = (cx_detalhe or os.environ.get('SERASA_CONV_CX_DETALHE') or 'C3').strip().upper()[:2].ljust(2)
    z40 = zeros40 or os.environ.get('SERASA_CONV_MEIO_ZEROS40')
    cod_cred = (codigo_credor_padrao or os.environ.get('SERASA_CONV_CODIGO_CREDOR') or '5016').strip()[-4:].zfill(4)

    out_lines: list[str] = []

    if modo == 'inclusao':
        if not linhas_detalhe_payload:
            raise ValueError('inclusao requires at least one parcel row.')
        h = patch_header_data_remessa(hdr_inc, ymd)
        h = patch_header_identificacao(h, ident_i)
        out_lines.append(h)
        seq = 2
        for i, payload in enumerate(linhas_detalhe_payload, start=1):
            pl = dict(payload)
            cod_linha = pl.pop('codigo_credor', None) or cod_cred
            pl.setdefault('tipo_operacao_ie', 'I')
            out_lines.append(
                montar_linha_detalhe_inclusao(
                    seq_linha_arquivo=seq,
                    seq_interno6=i,
                    cx=cx,
                    zeros40=z40,
                    codigo_credor=cod_linha,
                    **pl,
                )
            )
            seq += 1
        out_lines.append(montar_linha_trailer(seq))
    else:
        if not linhas_detalhe_payload:
            raise ValueError('exclusao requires at least one parcel row.')
        h = patch_header_data_remessa(hdr_exc, ymd)
        h = patch_header_identificacao(h, ident_e)
        out_lines.append(h)
        seq = 2
        for i, payload in enumerate(linhas_detalhe_payload, start=1):
            pl = dict(payload)
            cod_linha = pl.pop('codigo_credor', None) or cod_cred
            pl.setdefault('tipo_operacao_ie', 'E')
            out_lines.append(
                montar_linha_detalhe_inclusao(
                    seq_linha_arquivo=seq,
                    seq_interno6=i,
                    cx=cx,
                    zeros40=z40,
                    codigo_credor=cod_linha,
                    **pl,
                )
            )
            seq += 1
        out_lines.append(montar_linha_trailer(seq))

    body = '\r\n'.join(out_lines) + '\r\n'
    # Nome do ficheiro para o operador (layout interno segue inclusao/exclusao SERASA-CONVEM).
    tag = 'NEGATIVACAO' if modo == 'inclusao' else 'POSITIVACAO'
    nome = f"SERASA_GM_{datetime.now().strftime('%d%m%Y%H%M')}_{tag}.TXT"
    return body.encode('latin-1', errors='replace'), nome
