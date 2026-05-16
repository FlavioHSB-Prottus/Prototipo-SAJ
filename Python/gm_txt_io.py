# -*- coding: utf-8 -*-
"""Varredura de TXT GM e extracao de data_arquivo a partir do header (linha H)."""
from __future__ import annotations

import os
from typing import Iterator, List, Optional, Set


def iter_txt_paths(root: str) -> Iterator[str]:
    """Lista caminhos .txt: um ficheiro ou walk recursivo numa pasta."""
    root = os.path.abspath(root)
    if os.path.isfile(root):
        if root.lower().endswith('.txt'):
            yield root
        return
    if not os.path.isdir(root):
        return
    for dir_root, _dirs, files in os.walk(root):
        for name in files:
            if name.lower().endswith('.txt'):
                yield os.path.join(dir_root, name)


def data_arquivo_from_header_line(line: str) -> Optional[str]:
    """Header GM (H): posicao 65-73, YYYYMMDD -> YYYY-MM-DD."""
    line = line.replace('\r', '').replace('\n', '')
    if not line.startswith('H') or len(line) < 73:
        return None
    ts = line[65:73]
    if not ts.isdigit() or len(ts) != 8:
        return None
    return f'{ts[0:4]}-{ts[4:6]}-{ts[6:8]}'


def data_arquivo_from_txt_path(path: str) -> Optional[str]:
    """Le a primeira linha do TXT (latin-1) e devolve data_arquivo ou None."""
    try:
        with open(path, 'r', encoding='latin1') as fh:
            header = fh.readline()
        return data_arquivo_from_header_line(header)
    except OSError:
        return None


def collect_dates_from_txt_root(root: str) -> List[str]:
    """Datas unicas (ordenadas) encontradas nos TXT sob root (ficheiro ou pasta)."""
    found: Set[str] = set()
    for path in iter_txt_paths(root):
        d = data_arquivo_from_txt_path(path)
        if d:
            found.add(d)
    return sorted(found)
