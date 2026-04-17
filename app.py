import json
import os
import shutil
import subprocess
import sys
import tempfile

import pymysql
from flask import Flask, Response, render_template, request, redirect, url_for, jsonify

app = Flask(__name__)

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts')
PYTHON_EXE = sys.executable

DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': 'root',
    'database': 'consorcio_gm',
}

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        return redirect(url_for('home'))
    return render_template('login.html')

@app.route('/home', methods=['GET', 'POST'])
def home():
    return render_template('home.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/busca')
def busca():
    return render_template('busca.html')

@app.route('/relatorios')
def relatorios():
    return render_template('relatorios.html')

@app.route('/performance')
def performance():
    return render_template('performance.html')

@app.route('/tramitacao')
def tramitacao():
    return render_template('tramitacao.html')

@app.route('/agenda')
def agenda():
    return render_template('agenda.html')

@app.route('/cadastro')
def cadastro():
    return render_template('cadastro.html')

@app.route('/importacao')
def importacao():
    return render_template('importacao.html')

@app.route('/recuperar_senha')
def recuperar_senha():
    return render_template('recuperar_senha.html')


# ---------------------------------------------------------------------------
# API: Upload + Processamento com SSE
# ---------------------------------------------------------------------------

@app.route('/api/upload', methods=['POST'])
def api_upload():
    """Recebe multiplos arquivos TXT e salva em pasta temporaria."""
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    temp_dir = tempfile.mkdtemp(prefix='saj_import_')
    saved = []
    for f in files:
        if f.filename and f.filename.lower().endswith('.txt'):
            dest = os.path.join(temp_dir, f.filename)
            f.save(dest)
            saved.append({'name': f.filename, 'size': os.path.getsize(dest)})

    if not saved:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({'error': 'Nenhum arquivo .txt valido enviado'}), 400

    return jsonify({'temp_dir': temp_dir, 'files': saved})


def _classify_log_level(line):
    """Classifica o nivel do log com base no conteudo da linha."""
    upper = line.upper()
    if 'ERRO' in upper or 'FALHA' in upper or 'ERROR' in upper:
        return 'alert'
    if 'SUCESSO' in upper or 'CONCLU' in upper or 'SUCCESS' in upper or 'FINALIZ' in upper:
        return 'success'
    if 'UPDATE' in upper or 'TRACKING' in upper or 'DELTA' in upper:
        return 'update'
    return 'info'


def _sse_event(data_dict):
    """Formata um dict como evento SSE."""
    return f"data: {json.dumps(data_dict, ensure_ascii=False)}\n\n"


@app.route('/api/processar')
def api_processar():
    """Endpoint SSE que executa os 2 scripts em sequencia, streamando stdout."""
    temp_dir = request.args.get('dir', '')
    if not temp_dir or not os.path.isdir(temp_dir):
        def err():
            yield _sse_event({'type': 'error', 'text': 'Pasta temporaria invalida ou nao encontrada.'})
        return Response(err(), mimetype='text/event-stream')

    def generate():
        # ------------------------------------------------------------------
        # FASE 1: Importacao bruta (import_only_arquivos_gm.py)
        # ------------------------------------------------------------------
        yield _sse_event({'type': 'status', 'text': 'Fase 1/2 - Importando Arquivos para o Banco...'})
        yield _sse_event({'type': 'progress', 'value': 5})

        script1 = os.path.join(SCRIPTS_DIR, 'import_only_arquivos_gm.py')
        proc1 = subprocess.Popen(
            [PYTHON_EXE, script1, temp_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
        )

        total_files = len([f for f in os.listdir(temp_dir) if f.lower().endswith('.txt')])
        imported_count = 0

        for line in iter(proc1.stdout.readline, ''):
            line = line.rstrip('\n\r')
            if not line:
                continue
            level = _classify_log_level(line)
            yield _sse_event({'type': 'log', 'level': level, 'text': line})

            if 'importado com sucesso' in line.lower():
                imported_count += 1
                progress = 5 + int((imported_count / max(total_files, 1)) * 40)
                yield _sse_event({'type': 'progress', 'value': min(progress, 45)})

        proc1.wait()
        yield _sse_event({'type': 'progress', 'value': 48})

        if proc1.returncode and proc1.returncode != 0:
            yield _sse_event({'type': 'log', 'level': 'alert', 'text': f'Script de importacao finalizou com codigo {proc1.returncode}'})

        # ------------------------------------------------------------------
        # FASE 2: Tracker (tracker_gm_range_date_contratos.py)
        # ------------------------------------------------------------------
        yield _sse_event({'type': 'status', 'text': 'Fase 2/2 - Processando Contratos e Rastreando Deltas...'})
        yield _sse_event({'type': 'progress', 'value': 50})

        try:
            conn = pymysql.connect(**DB_CONFIG)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT MIN(data_arquivo) AS dt_min, MAX(data_arquivo) AS dt_max "
                "FROM arquivos_gm WHERE data_processamento IS NULL"
            )
            row = cursor.fetchone()
            cursor.close()
            conn.close()

            if row and row[0] and row[1]:
                start_date = str(row[0])
                end_date = str(row[1])
            else:
                yield _sse_event({'type': 'log', 'level': 'alert', 'text': 'Nenhum arquivo pendente encontrado no banco para processar.'})
                yield _sse_event({'type': 'progress', 'value': 100})
                yield _sse_event({'type': 'done', 'summary': f'{imported_count} arquivos importados. Nenhum pendente para tracker.'})
                shutil.rmtree(temp_dir, ignore_errors=True)
                return
        except Exception as e:
            yield _sse_event({'type': 'error', 'text': f'Erro ao consultar banco: {e}'})
            shutil.rmtree(temp_dir, ignore_errors=True)
            return

        yield _sse_event({'type': 'log', 'level': 'info', 'text': f'Range de datas detectado: {start_date} ate {end_date}'})

        script2 = os.path.join(SCRIPTS_DIR, 'tracker_gm_range_date_contratos.py')
        proc2 = subprocess.Popen(
            [PYTHON_EXE, script2],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
        )

        proc2.stdin.write(start_date + '\n')
        proc2.stdin.write(end_date + '\n')
        proc2.stdin.flush()
        proc2.stdin.close()

        line_count = 0
        for line in iter(proc2.stdout.readline, ''):
            line = line.rstrip('\n\r')
            if not line:
                continue
            level = _classify_log_level(line)
            yield _sse_event({'type': 'log', 'level': level, 'text': line})

            line_count += 1
            progress = 50 + min(int(line_count * 2), 45)
            yield _sse_event({'type': 'progress', 'value': min(progress, 95)})

        proc2.wait()

        if proc2.returncode and proc2.returncode != 0:
            yield _sse_event({'type': 'log', 'level': 'alert', 'text': f'Script tracker finalizou com codigo {proc2.returncode}'})

        # ------------------------------------------------------------------
        # Limpeza e finalizacao
        # ------------------------------------------------------------------
        shutil.rmtree(temp_dir, ignore_errors=True)

        yield _sse_event({'type': 'progress', 'value': 100})
        yield _sse_event({'type': 'status', 'text': 'Processamento Concluido com Sucesso!'})
        yield _sse_event({'type': 'done', 'summary': f'{imported_count} arquivos importados e processados.'})

    return Response(generate(), mimetype='text/event-stream')


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
