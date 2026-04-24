import os
import sys
import tkinter as tk
from tkinter import filedialog
import pymysql
from datetime import datetime

def select_folder():
    """Abre uma janela para o usuário selecionar a pasta principal."""
    try:
        root = tk.Tk()
        root.withdraw()
        folder_path = filedialog.askdirectory(title="Selecione a pasta que contém os arquivos TXT")
        return folder_path
    except Exception:
        return ""

def main():
    # Coleta a pasta via argumento ou via interface gráfica nativa
    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
    else:
        folder_path = select_folder()
        
    if not folder_path:
        print("Nenhuma pasta selecionada. Encerrando.")
        sys.exit(0)
        
    print(f"Buscando arquivos .txt na pasta e em todas as subpastas de:\n-> {folder_path}\n")
    
    # Varre a arvore de pastas
    txt_files = []
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            if file.lower().endswith('.txt'):
                txt_files.append(os.path.join(root, file))
                
    if not txt_files:
        print("Nenhum arquivo .txt encontrado.")
        sys.exit(0)
        
    print(f"Foram encontrados {len(txt_files)} arquivos .txt. Iniciando ingestão direta!\n")
    
    # Estabelece conexão com o banco de dados
    try:
        conn = pymysql.connect(host='localhost', user='root', password='root', database='consorcio_gm')
        cursor = conn.cursor()
    except Exception as e:
        print(f"Falha ao conectar no banco de dados: {e}")
        sys.exit(1)
        
    sucessos = 0
    erros = 0
    
    import re
    
    for idx, file_path in enumerate(txt_files, 1):
        filename = os.path.basename(file_path)
        
        try:
            # Abre o arquivo puro sem processar linhas (apenas coleta de conteúdo original bruto)
            with open(file_path, 'r', encoding='latin1') as f:
                content = f.read()
                
            # Extrai a data oficial a partir da primeira linha (HEADER), na Posição 66 (index 65), Tamanho 8
            primeira_linha = content.split('\n')[0].replace('\r', '')
            if not primeira_linha.startswith('H') or len(primeira_linha) < 73:
                print(f"[{idx}/{len(txt_files)}] ERRO: Arquivo não possui cabeçalho (HEADER) válido em {filename}")
                erros += 1
                continue
                
            timestamp_str = primeira_linha[65:73] # formato nativo: YYYYMMDD
            
            if not timestamp_str.isdigit() or len(timestamp_str) != 8:
                print(f"[{idx}/{len(txt_files)}] ERRO: Data do cabeçalho inválida em {filename} -> '{timestamp_str}'")
                erros += 1
                continue
                
            year = timestamp_str[0:4]
            month = timestamp_str[4:6]
            day = timestamp_str[6:8]
            data_arquivo = f"{year}-{month}-{day}"
                
            stat = os.stat(file_path)
            tamanho = stat.st_size
                
            # Dispara para o banco de dados nativo usando o comando oficial do import_v2 (incluindo tratamento de duplicatas)
            query = """
                INSERT INTO arquivos_gm (data_arquivo, conteudo, data_processamento)
                VALUES (%s, %s, NULL)
                ON DUPLICATE KEY UPDATE 
                    conteudo = VALUES(conteudo);
            """
            cursor.execute(query, (data_arquivo, content))
            
            print(f"[{idx}/{len(txt_files)}] {filename} ({tamanho} bytes) importado com sucesso [Data_Arq: {data_arquivo}]!")
            sucessos += 1
            
        except Exception as e:
            print(f"[{idx}/{len(txt_files)}] ERRO ao importar {filename}: {e}")
            erros += 1
            
    # Salva efetivamente os envios acumulados
    conn.commit()
    cursor.close()
    conn.close()
    
    print("\n----------------------------------------")
    print(f"Importação Bruta Finalizada! {sucessos} adicionados, {erros} falhas.")

if __name__ == "__main__":
    main()
