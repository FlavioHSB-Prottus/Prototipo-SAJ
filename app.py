import datetime
import decimal
import json
import os
import shutil
import subprocess
import sys
import tempfile

import pymysql
from flask import Flask, Response, render_template, request, redirect, url_for, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts')
PYTHON_EXE = sys.executable

_SUBPROCESS_ENV = {**os.environ, 'PYTHONUNBUFFERED': '1'}
_POPEN_EXTRA = {}
if sys.platform == 'win32':
    _POPEN_EXTRA['creationflags'] = subprocess.CREATE_NO_WINDOW

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

def _safe_txt_dest(temp_dir, upload_filename):
    """Monta caminho seguro dentro de temp_dir para upload (inclui subpastas de importacao por pasta)."""
    if not upload_filename:
        return None
    rel = upload_filename.replace('\\', '/').strip('/')
    parts = []
    for p in rel.split('/'):
        if not p or p in ('.', '..'):
            continue
        s = secure_filename(p)
        if s:
            parts.append(s)
    if not parts or not parts[-1].lower().endswith('.txt'):
        return None
    dest = os.path.join(temp_dir, *parts)
    dest_abs = os.path.abspath(dest)
    temp_abs = os.path.abspath(temp_dir)
    try:
        common = os.path.commonpath([temp_abs, dest_abs])
    except ValueError:
        return None
    if common != temp_abs:
        return None
    return dest_abs


@app.route('/api/upload', methods=['POST'])
def api_upload():
    """Recebe multiplos arquivos TXT e salva em pasta temporaria (estrutura de subpastas preservada)."""
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    temp_dir = tempfile.mkdtemp(prefix='saj_import_')
    saved = []
    for f in files:
        dest = _safe_txt_dest(temp_dir, f.filename)
        if not dest:
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        f.save(dest)
        rel_name = os.path.relpath(dest, temp_dir).replace(os.sep, '/')
        saved.append({'name': rel_name, 'size': os.path.getsize(dest)})

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
            [PYTHON_EXE, '-u', script1, temp_dir],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=_SUBPROCESS_ENV,
            **_POPEN_EXTRA,
        )

        total_files = sum(
            1
            for root, _dirs, files in os.walk(temp_dir)
            for f in files
            if f.lower().endswith('.txt')
        )
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
            [PYTHON_EXE, '-u', script2],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=_SUBPROCESS_ENV,
            **_POPEN_EXTRA,
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


# ---------------------------------------------------------------------------
# Helpers para API de Busca
# ---------------------------------------------------------------------------

def _get_db():
    return pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor)


def _serialize(obj):
    """Converte tipos nao-serializaveis do MySQL para JSON."""
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    if isinstance(obj, bytes):
        return obj.decode('latin-1', errors='replace')
    return str(obj)


def _clean_rows(rows):
    return [{k: _serialize(v) if v is not None else None for k, v in r.items()} for r in rows]


def _clean_row(row):
    if not row:
        return None
    return {k: _serialize(v) if v is not None else None for k, v in row.items()}


# ---------------------------------------------------------------------------
# API: Busca por Pessoa / Contrato
# ---------------------------------------------------------------------------

@app.route('/api/busca')
def api_busca():
    tipo = request.args.get('tipo', '').strip()
    termo = request.args.get('termo', '').strip()
    if not termo:
        return jsonify({'results': [], 'tipo': tipo})

    conn = _get_db()
    cursor = conn.cursor()

    results = []
    if tipo == 'pessoa':
        cursor.execute(
            "SELECT id, cpf_cnpj, nome_completo, profissao "
            "FROM pessoa "
            "WHERE cpf_cnpj LIKE %s OR nome_completo LIKE %s "
            "LIMIT 50",
            (f'%{termo}%', f'%{termo}%'),
        )
        results = _clean_rows(cursor.fetchall())

    elif tipo == 'contrato':
        status_filtro = request.args.get('status', '').strip()
        base_select = (
            "SELECT c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
            "       p.nome_completo AS nome_devedor "
            "FROM contrato c "
            "LEFT JOIN pessoa p ON c.id_pessoa = p.id "
        )
        parts = [p.strip() for p in termo.replace('-', '/').split('/')]
        if len(parts) == 2:
            grupo, cota = parts
            where = "WHERE c.grupo LIKE %s AND c.cota LIKE %s"
            params = [f'%{grupo}%', f'%{cota}%']
        else:
            where = "WHERE (c.grupo LIKE %s OR c.numero_contrato LIKE %s)"
            params = [f'%{termo}%', f'%{termo}%']

        if status_filtro:
            where += " AND c.status = %s"
            params.append(status_filtro)

        cursor.execute(base_select + where + " LIMIT 50", params)
        results = _clean_rows(cursor.fetchall())

    cursor.close()
    conn.close()
    return jsonify({'results': results, 'tipo': tipo})


@app.route('/api/pessoa/<int:pessoa_id>')
def api_pessoa_detalhe(pessoa_id):
    conn = _get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM pessoa WHERE id = %s", (pessoa_id,))
    pessoa = _clean_row(cursor.fetchone())
    if not pessoa:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Pessoa nao encontrada'}), 404

    cursor.execute("SELECT * FROM endereco WHERE id_pessoa = %s", (pessoa_id,))
    enderecos = _clean_rows(cursor.fetchall())

    cursor.execute("SELECT * FROM telefone WHERE id_pessoa = %s", (pessoa_id,))
    telefones = _clean_rows(cursor.fetchall())

    cursor.execute("SELECT * FROM email WHERE id_pessoa = %s", (pessoa_id,))
    emails = _clean_rows(cursor.fetchall())

    cursor.execute(
        "SELECT c.*, p_dev.nome_completo AS nome_devedor, p_aval.nome_completo AS nome_avalista "
        "FROM contrato c "
        "LEFT JOIN pessoa p_dev ON c.id_pessoa = p_dev.id "
        "LEFT JOIN pessoa p_aval ON c.id_avalista = p_aval.id "
        "WHERE c.id_pessoa = %s OR c.id_avalista = %s",
        (pessoa_id, pessoa_id),
    )
    contratos = _clean_rows(cursor.fetchall())

    cursor.close()
    conn.close()
    return jsonify({
        'pessoa': pessoa,
        'enderecos': enderecos,
        'telefones': telefones,
        'emails': emails,
        'contratos': contratos,
    })


@app.route('/api/contrato/<int:contrato_id>')
def api_contrato_detalhe(contrato_id):
    conn = _get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM contrato WHERE id = %s", (contrato_id,))
    contrato = _clean_row(cursor.fetchone())
    if not contrato:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Contrato nao encontrado'}), 404

    devedor = None
    devedor_end = []
    devedor_tel = []
    devedor_email = []
    if contrato.get('id_pessoa'):
        cursor.execute("SELECT * FROM pessoa WHERE id = %s", (contrato['id_pessoa'],))
        devedor = _clean_row(cursor.fetchone())
        pid = contrato['id_pessoa']
        cursor.execute("SELECT * FROM endereco WHERE id_pessoa = %s", (pid,))
        devedor_end = _clean_rows(cursor.fetchall())
        cursor.execute("SELECT * FROM telefone WHERE id_pessoa = %s", (pid,))
        devedor_tel = _clean_rows(cursor.fetchall())
        cursor.execute("SELECT * FROM email WHERE id_pessoa = %s", (pid,))
        devedor_email = _clean_rows(cursor.fetchall())

    avalista = None
    avalista_end = []
    avalista_tel = []
    avalista_email = []
    if contrato.get('id_avalista'):
        cursor.execute("SELECT * FROM pessoa WHERE id = %s", (contrato['id_avalista'],))
        avalista = _clean_row(cursor.fetchone())
        aid = contrato['id_avalista']
        cursor.execute("SELECT * FROM endereco WHERE id_pessoa = %s", (aid,))
        avalista_end = _clean_rows(cursor.fetchall())
        cursor.execute("SELECT * FROM telefone WHERE id_pessoa = %s", (aid,))
        avalista_tel = _clean_rows(cursor.fetchall())
        cursor.execute("SELECT * FROM email WHERE id_pessoa = %s", (aid,))
        avalista_email = _clean_rows(cursor.fetchall())

    cursor.execute(
        "SELECT * FROM parcela WHERE id_contrato = %s ORDER BY numero_parcela",
        (contrato_id,),
    )
    parcelas = _clean_rows(cursor.fetchall())

    cursor.execute(
        "SELECT * FROM ocorrencia WHERE id_contrato = %s ORDER BY data_arquivo DESC",
        (contrato_id,),
    )
    ocorrencias = _clean_rows(cursor.fetchall())

    cursor.close()
    conn.close()
    return jsonify({
        'contrato': contrato,
        'devedor': devedor,
        'devedor_enderecos': devedor_end,
        'devedor_telefones': devedor_tel,
        'devedor_emails': devedor_email,
        'avalista': avalista,
        'avalista_enderecos': avalista_end,
        'avalista_telefones': avalista_tel,
        'avalista_emails': avalista_email,
        'parcelas': parcelas,
        'ocorrencias': ocorrencias,
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
