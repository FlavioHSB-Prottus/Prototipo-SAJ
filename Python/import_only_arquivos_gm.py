# -*- coding: utf-8 -*-
"""
Importacao bruta de arquivos TXT GM para a tabela `arquivos_gm`.

Uso (a partir da raiz do projeto ou de qualquer pasta):
    python Python/import_only_arquivos_gm.py [caminho_da_pasta]

Sem argumento, abre seletor de pasta (tkinter).

Ambiente (opcional): DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
"""
import os
import sys
import tkinter as tk
from tkinter import filedialog

import pymysql

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def select_folder():
    """Abre uma janela para o usuario selecionar a pasta principal."""
    try:
        root = tk.Tk()
        root.withdraw()
        folder_path = filedialog.askdirectory(title="Selecione a pasta que contém os arquivos TXT")
        return folder_path
    except Exception:
        return ""


def main():
    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
    else:
        folder_path = select_folder()

    if not folder_path:
        print("Nenhuma pasta selecionada. Encerrando.")
        sys.exit(0)

    print(f"Buscando arquivos .txt na pasta e em todas as subpastas de:\n-> {folder_path}\n")

    txt_files = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith('.txt'):
                txt_files.append(os.path.join(root, file))

    if not txt_files:
        print("Nenhum arquivo .txt encontrado.")
        sys.exit(0)

    print(f"Foram encontrados {len(txt_files)} arquivos .txt. Iniciando ingestão direta!\n")

    try:
        conn = pymysql.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            user=os.environ.get('DB_USER', 'root'),
            password=os.environ.get('DB_PASSWORD', 'root'),
            database=os.environ.get('DB_NAME', 'consorcio_gm'),
            charset='utf8mb4',
        )
        cursor = conn.cursor()
    except Exception as e:
        print(f"Falha ao conectar no banco de dados: {e}")
        sys.exit(1)

    n_ok = 0
    n_err = 0

    for idx, file_path in enumerate(txt_files, 1):
        filename = os.path.basename(file_path)

        try:
            with open(file_path, 'r', encoding='latin1') as f:
                content = f.read()

            primeira_linha = content.split('\n')[0].replace('\r', '')
            if not primeira_linha.startswith('H') or len(primeira_linha) < 73:
                print(f"[{idx}/{len(txt_files)}] ERRO: Arquivo não possui cabeçalho (HEADER) válido em {filename}")
                n_err += 1
                continue

            timestamp_str = primeira_linha[65:73]

            if not timestamp_str.isdigit() or len(timestamp_str) != 8:
                print(f"[{idx}/{len(txt_files)}] ERRO: Data do cabeçalho inválida em {filename} -> '{timestamp_str}'")
                n_err += 1
                continue

            year = timestamp_str[0:4]
            month = timestamp_str[4:6]
            day = timestamp_str[6:8]
            data_arquivo = f"{year}-{month}-{day}"

            stat = os.stat(file_path)
            tamanho = stat.st_size

            query = """
                INSERT INTO arquivos_gm (data_arquivo, conteudo, data_processamento)
                VALUES (%s, %s, NULL)
                ON DUPLICATE KEY UPDATE
                    conteudo = VALUES(conteudo);
            """
            cursor.execute(query, (data_arquivo, content))

            print(f"[{idx}/{len(txt_files)}] {filename} ({tamanho} bytes) importado com sucesso [Data_Arq: {data_arquivo}]!")
            n_ok += 1

        except Exception as e:
            print(f"[{idx}/{len(txt_files)}] ERRO ao importar {filename}: {e}")
            n_err += 1

    conn.commit()
    cursor.close()
    conn.close()

    print("\n----------------------------------------")
    print(f"Importação bruta finalizada! {n_ok} OK, {n_err} falhas.")
    print(f"(Script em: {BASE_DIR})")


if __name__ == "__main__":
    main()
