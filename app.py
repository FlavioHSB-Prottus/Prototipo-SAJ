import calendar
import datetime
import decimal
import io
import json
import secrets
import os
import shutil
import subprocess
import sys
import tempfile

import pymysql
from flask import Flask, Response, render_template, request, redirect, url_for, jsonify, send_file, session, flash, abort
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'dev-consorcio-gm-altere-em-producao')

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

def _funcionario_esta_ativo(val):
    """Interpreta a coluna `ativo` (bit(1)) retornada pelo PyMySQL."""
    if val is None:
        return False
    if isinstance(val, (bytes, bytearray)):
        return len(val) > 0 and val != b'\x00'
    if isinstance(val, int):
        return val != 0
    return bool(val)


FOTO_MAX_BYTES = 5 * 1024 * 1024


def _guess_image_mimetype(data):
    """Retorna MIME se os bytes parecem JPEG, PNG, GIF ou WebP; caso contrário None."""
    if not data or len(data) < 12:
        return None
    if data[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    if len(data) >= 6 and data[:6] in (b'GIF87a', b'GIF89a'):
        return 'image/gif'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'image/webp'
    return None


def _mimetype_for_stored_blob(data):
    return _guess_image_mimetype(data) or 'application/octet-stream'


@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        login_val = (request.form.get('login') or '').strip()
        senha_val = request.form.get('senha') or ''
        if not login_val:
            flash('Informe o login.', 'error')
            return render_template('login.html')
        conn = None
        try:
            conn = _get_db()
            with conn.cursor() as cursor:
                cursor.execute(
                    'SELECT id, nome, senha, ativo FROM funcionario WHERE login = %s LIMIT 1',
                    (login_val,),
                )
                row = cursor.fetchone()
        except Exception:
            app.logger.exception('login: falha ao consultar funcionario')
            flash('Não foi possível validar o login. Tente novamente.', 'error')
            return render_template('login.html')
        finally:
            if conn is not None:
                conn.close()

        if not row or not _funcionario_esta_ativo(row.get('ativo')):
            flash('Login ou senha incorretos.', 'error')
            return render_template('login.html')

        db_senha = row.get('senha')
        if db_senha is None:
            db_senha = ''
        else:
            db_senha = str(db_senha)
        if not secrets.compare_digest(str(senha_val), db_senha):
            flash('Login ou senha incorretos.', 'error')
            return render_template('login.html')

        session.clear()
        session['funcionario_id'] = int(row['id'])
        session['funcionario_nome'] = row.get('nome') or ''
        return redirect(url_for('home'))

    if session.get('funcionario_id'):
        return redirect(url_for('home'))
    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/minha-foto', methods=['GET', 'POST'])
def minha_foto():
    fid = session.get('funcionario_id')
    if not fid:
        if request.method == 'POST':
            return jsonify({'error': 'Não autenticado'}), 401
        abort(404)

    if request.method == 'GET':
        conn = None
        try:
            conn = _get_db()
            with conn.cursor() as cursor:
                cursor.execute(
                    'SELECT foto FROM funcionario WHERE id = %s',
                    (int(fid),),
                )
                row = cursor.fetchone()
        finally:
            if conn is not None:
                conn.close()

        if not row:
            abort(404)
        foto = row.get('foto')
        if foto is None:
            abort(404)
        if isinstance(foto, memoryview):
            foto = foto.tobytes()
        elif not isinstance(foto, (bytes, bytearray)):
            foto = bytes(foto) if foto else b''
        if not foto:
            abort(404)
        mt = _mimetype_for_stored_blob(foto)
        return Response(
            foto,
            mimetype=mt,
            headers={'Cache-Control': 'private, max-age=3600'},
        )

    f = request.files.get('foto')
    if not f or not getattr(f, 'filename', None):
        return jsonify({'error': 'Envie um ficheiro de imagem.'}), 400
    raw = f.read()
    if len(raw) > FOTO_MAX_BYTES:
        return jsonify({'error': 'Imagem demasiado grande (máx. 5 MB).'}), 400
    if not _guess_image_mimetype(raw):
        return jsonify({'error': 'Formato não suportado. Use JPEG, PNG, GIF ou WebP.'}), 400

    conn = None
    try:
        conn = _get_db()
        with conn.cursor() as cursor:
            cursor.execute(
                'UPDATE funcionario SET foto = %s WHERE id = %s',
                (raw, int(fid)),
            )
        conn.commit()
    except Exception:
        app.logger.exception('minha_foto POST')
        if conn is not None:
            conn.rollback()
        return jsonify({'error': 'Não foi possível guardar a foto.'}), 500
    finally:
        if conn is not None:
            conn.close()
    return jsonify({'ok': True})


@app.before_request
def _require_login():
    """Exige sessão de funcionário para todas as rotas, exceto login, logout, estáticos e recuperação de senha."""
    if request.endpoint is None:
        return None
    public = {'login', 'static', 'recuperar_senha', 'logout'}
    if request.endpoint in public:
        return None
    if session.get('funcionario_id'):
        return None
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Não autenticado'}), 401
    return redirect(url_for('login'))

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

@app.route('/agenda')
def agenda():
    return render_template('agenda.html')

@app.route('/cadastro')
def cadastro():
    return render_template('cadastro.html')

@app.route('/importacao')
def importacao():
    return render_template('importacao.html')

@app.route('/cobranca')
def cobranca():
    return render_template('cobranca.html')

@app.route('/operadores')
def operadores():
    return render_template('operadores.html')

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


def _validate_incoming_temp_dir(incoming):
    """Aceita apenas pastas criadas por este endpoint (prefixo 'saj_import_' dentro do tempdir)."""
    if not incoming:
        return None
    tmp_root = os.path.abspath(tempfile.gettempdir())
    inc_abs = os.path.abspath(incoming)
    base_name = os.path.basename(inc_abs)
    if not os.path.isdir(inc_abs):
        return None
    if os.path.dirname(inc_abs) != tmp_root:
        return None
    if not base_name.startswith('saj_import_'):
        return None
    return inc_abs


@app.route('/api/upload', methods=['POST'])
def api_upload():
    """Recebe multiplos arquivos TXT e salva em pasta temporaria (estrutura de subpastas preservada).

    Suporta upload em lotes: se o cliente informar o campo 'temp_dir' de um lote
    anterior, os novos arquivos sao acumulados na mesma pasta temporaria.
    """
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    incoming_temp = (request.form.get('temp_dir') or '').strip()
    created_new = False
    if incoming_temp:
        temp_dir = _validate_incoming_temp_dir(incoming_temp)
        if not temp_dir:
            return jsonify({'error': 'temp_dir invalido ou expirado'}), 400
    else:
        temp_dir = tempfile.mkdtemp(prefix='saj_import_')
        created_new = True

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
        if created_new:
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
        # Pre-check: banco com tabelas (evita 11x o mesmo ERRO 1146 no log)
        # ------------------------------------------------------------------
        ok_schema, err_schema = _schema_pronto_para_importacao()
        if not ok_schema:
            yield _sse_event(
                {'type': 'log', 'level': 'alert', 'text': err_schema}
            )
            yield _sse_event(
                {
                    'type': 'status',
                    'text': 'Importacao nao iniciada: crie o schema do banco primeiro.',
                }
            )
            yield _sse_event({'type': 'progress', 'value': 0})
            yield _sse_event(
                {
                    'type': 'done',
                    'summary': err_schema,
                    'distribuicao_ready': False,
                    'schema_error': True,
                }
            )
            return

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

        all_dates = []
        for root, _dirs, files in os.walk(temp_dir):
            for fname in files:
                if not fname.lower().endswith('.txt'):
                    continue
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, 'r', encoding='latin1') as fh:
                        header = fh.readline().replace('\r', '').replace('\n', '')
                    if not header.startswith('H') or len(header) < 73:
                        continue
                    ts = header[65:73]
                    if not ts.isdigit() or len(ts) != 8:
                        continue
                    all_dates.append(f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]}")
                except Exception:
                    continue

        if not all_dates:
            yield _sse_event({'type': 'log', 'level': 'alert', 'text': 'Nenhuma data valida encontrada nos arquivos importados.'})
            yield _sse_event({'type': 'progress', 'value': 100})
            yield _sse_event({'type': 'done', 'summary': f'{imported_count} arquivos importados. Nenhuma data para tracker.'})
            shutil.rmtree(temp_dir, ignore_errors=True)
            return

        start_date = min(all_dates)
        end_date = max(all_dates)

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
            progress = 50 + min(int(line_count * 2), 40)
            yield _sse_event({'type': 'progress', 'value': min(progress, 92)})

        proc2.wait()

        if proc2.returncode and proc2.returncode != 0:
            yield _sse_event({'type': 'log', 'level': 'alert', 'text': f'Script tracker finalizou com codigo {proc2.returncode}'})

        # ------------------------------------------------------------------
        # FASE 3: Distribuicao de funcionarios de cobranca
        # ------------------------------------------------------------------
        yield _sse_event({'type': 'status', 'text': 'Fase 3/3 - Distribuindo contratos entre os funcionarios de cobranca...'})
        yield _sse_event({'type': 'progress', 'value': 96})

        script3 = os.path.join(SCRIPTS_DIR, 'distribuir_funcionarios_cobranca.py')
        proc3 = subprocess.Popen(
            [PYTHON_EXE, '-u', script3],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=_SUBPROCESS_ENV,
            **_POPEN_EXTRA,
        )

        for line in iter(proc3.stdout.readline, ''):
            line = line.rstrip('\n\r')
            if not line:
                continue
            level = _classify_log_level(line)
            yield _sse_event({'type': 'log', 'level': level, 'text': line})

        proc3.wait()
        distribuicao_ok = (proc3.returncode == 0)

        if not distribuicao_ok:
            yield _sse_event({'type': 'log', 'level': 'alert', 'text': f'Script de distribuicao finalizou com codigo {proc3.returncode}'})

        # ------------------------------------------------------------------
        # Limpeza e finalizacao
        # ------------------------------------------------------------------
        shutil.rmtree(temp_dir, ignore_errors=True)

        yield _sse_event({'type': 'progress', 'value': 100})
        yield _sse_event({'type': 'status', 'text': 'Processamento Concluido com Sucesso!'})
        yield _sse_event({
            'type': 'done',
            'summary': f'{imported_count} arquivos importados e processados.',
            'distribuicao_ready': distribuicao_ok,
        })

    return Response(generate(), mimetype='text/event-stream')


# ---------------------------------------------------------------------------
# API: Distribuicao de funcionarios de cobranca (resumo pos-importacao)
# ---------------------------------------------------------------------------
#
# A tabela `funcionario_cobranca` e puramente relacional:
#
#    funcionario_cobranca(id, id_funcionario FK funcionario, id_contrato FK contrato, ...)
#
# Situacao (critico/atencao/recente), valor_credito e dias_atraso NAO estao
# nessa tabela - sao calculados on-the-fly via JOIN com contrato/parcela.


def _sit_key(sit):
    """Normaliza 'atenção' -> 'atencao' (chave JSON / atributo)."""
    if sit == 'atenção':
        return 'atencao'
    return sit or ''


def _situacao_from_dias(dias):
    try:
        d = int(dias or 0)
    except (TypeError, ValueError):
        d = 0
    if d >= 61:
        return 'critico'
    if d >= 31:
        return 'atenção'
    return 'recente'


def _empty_func_stats():
    return {
        'count': 0, 'value': 0.0,
        'critico_count': 0, 'critico_value': 0.0,
        'atencao_count': 0, 'atencao_value': 0.0,
        'recente_count': 0, 'recente_value': 0.0,
    }


@app.route('/api/importacao/distribuicao')
def api_distribuicao():
    """Retorna a distribuicao atual gravada em funcionario_cobranca."""
    conn = _get_db()
    cursor = conn.cursor()

    # Lista de funcionarios disponiveis (para popular o select de reatribuicao).
    cursor.execute("SELECT id, nome FROM funcionario ORDER BY nome")
    funcionarios_disponiveis = _clean_rows(cursor.fetchall())

    # Contratos atribuidos, com valor/dias calculados via JOIN.
    cursor.execute(
        """
        SELECT fc.id                              AS fc_id,
               fc.id_funcionario,
               fc.id_contrato,
               f.nome                             AS nome_funcionario,
               c.grupo, c.cota, c.numero_contrato,
               c.valor_credito,
               p.nome_completo                    AS nome_devedor,
               p.cpf_cnpj,
               (SELECT DATEDIFF(CURDATE(), MIN(vencimento))
                  FROM parcela
                 WHERE id_contrato = c.id AND status = 'aberto') AS dias_atraso
        FROM funcionario_cobranca fc
        INNER JOIN funcionario f ON f.id = fc.id_funcionario
        INNER JOIN contrato c    ON c.id = fc.id_contrato
        LEFT JOIN pessoa p       ON p.id = c.id_pessoa
        WHERE c.status = 'aberto'
        ORDER BY f.nome, c.valor_credito DESC
        """
    )
    rows = _clean_rows(cursor.fetchall())

    # Inicializa o mapa com todos os funcionarios (mesmo sem contratos).
    funcionarios_map = {
        int(f['id']): {
            'id': int(f['id']),
            'nome': f['nome'],
            'stats': _empty_func_stats(),
            'contratos': [],
        }
        for f in funcionarios_disponiveis
    }
    totais = _empty_func_stats()

    for r in rows:
        fid = int(r['id_funcionario'])
        if fid not in funcionarios_map:
            funcionarios_map[fid] = {
                'id': fid,
                'nome': r.get('nome_funcionario') or f'#{fid}',
                'stats': _empty_func_stats(),
                'contratos': [],
            }

        try:
            v = float(r['valor_credito']) if r['valor_credito'] is not None else 0.0
        except (TypeError, ValueError):
            v = 0.0

        situacao = _situacao_from_dias(r.get('dias_atraso'))
        sk = _sit_key(situacao)
        r['situacao'] = situacao  # injeta para o frontend exibir a badge

        bucket = funcionarios_map[fid]
        bucket['contratos'].append(r)
        bucket['stats']['count'] += 1
        bucket['stats']['value'] += v
        if sk in ('critico', 'atencao', 'recente'):
            bucket['stats'][f'{sk}_count'] += 1
            bucket['stats'][f'{sk}_value'] += v

        totais['count'] += 1
        totais['value'] += v
        if sk in ('critico', 'atencao', 'recente'):
            totais[f'{sk}_count'] += 1
            totais[f'{sk}_value'] += v

    cursor.close()
    conn.close()

    return jsonify({
        'funcionarios': list(funcionarios_map.values()),
        'totais': totais,
        'funcionarios_disponiveis': [
            {'id': int(f['id']), 'nome': f['nome']}
            for f in funcionarios_disponiveis
        ],
    })


@app.route('/api/importacao/distribuicao/reassign', methods=['POST'])
def api_distribuicao_reassign():
    """Altera manualmente o funcionario responsavel por um contrato."""
    data = request.get_json(silent=True) or {}
    try:
        fc_id = int(data.get('id'))
        novo_fid = int(data.get('id_funcionario'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Parametros invalidos'}), 400

    conn = _get_db()
    cursor = conn.cursor()

    # Garante que o novo funcionario existe (evita FK error silencioso).
    cursor.execute("SELECT 1 FROM funcionario WHERE id = %s", (novo_fid,))
    if not cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({'error': 'Funcionario nao encontrado'}), 404

    cursor.execute(
        "UPDATE funcionario_cobranca SET id_funcionario = %s WHERE id = %s",
        (novo_fid, fc_id),
    )
    conn.commit()
    affected = cursor.rowcount
    cursor.close()
    conn.close()

    if affected == 0:
        return jsonify({'error': 'Registro nao encontrado'}), 404
    return jsonify({'ok': True})


@app.route('/api/importacao/distribuicao/transferir', methods=['POST'])
def api_distribuicao_transferir():
    """Transfere todos os contratos atribuidos a um funcionario de origem
    para outro(s) funcionario(s).

    Body JSON:
        id_origem       (int)   - obrigatorio, funcionario que vai ficar sem carga
        modo            (str)   - 'especifico' ou 'igualitaria'
        id_destino      (int)   - obrigatorio quando modo='especifico'

    No modo 'igualitaria' os contratos sao re-balanceados entre os demais
    funcionarios seguindo as mesmas metricas do seed
    (scripts/distribuir_funcionarios_cobranca.py): mesma media de valor e
    mesma media de quantidade POR SITUACAO (critico / atencao / recente),
    usando LPT greedy a partir da carga atual dos destinos.
    """
    data = request.get_json(silent=True) or {}
    try:
        id_origem = int(data.get('id_origem'))
    except (TypeError, ValueError):
        return jsonify({'error': 'id_origem invalido'}), 400

    modo = (data.get('modo') or '').strip()
    if modo not in ('especifico', 'igualitaria'):
        return jsonify({'error': "modo deve ser 'especifico' ou 'igualitaria'"}), 400

    id_destino = None
    if modo == 'especifico':
        try:
            id_destino = int(data.get('id_destino'))
        except (TypeError, ValueError):
            return jsonify({'error': 'id_destino invalido'}), 400
        if id_destino == id_origem:
            return jsonify({'error': 'Destino deve ser diferente da origem'}), 400

    conn = _get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, nome FROM funcionario WHERE id = %s", (id_origem,)
        )
        origem = cursor.fetchone()
        if not origem:
            return jsonify({'error': 'Funcionario de origem nao encontrado'}), 404

        if modo == 'especifico':
            cursor.execute(
                "SELECT id, nome FROM funcionario WHERE id = %s", (id_destino,)
            )
            destino = cursor.fetchone()
            if not destino:
                return jsonify({'error': 'Funcionario de destino nao encontrado'}), 404

            cursor.execute(
                "UPDATE funcionario_cobranca SET id_funcionario = %s "
                "WHERE id_funcionario = %s",
                (id_destino, id_origem),
            )
            transferidos = cursor.rowcount
            conn.commit()
            return jsonify({
                'ok': True,
                'modo': modo,
                'transferidos': transferidos,
                'origem': {'id': int(origem['id']), 'nome': origem['nome']},
                'destino': {'id': int(destino['id']), 'nome': destino['nome']},
            })

        # modo == 'igualitaria' ---------------------------------------------
        # 1) Busca os demais funcionarios (destinos possiveis).
        cursor.execute(
            "SELECT id, nome FROM funcionario WHERE id <> %s "
            "AND (ativo IS NULL OR ativo = 1) ORDER BY nome",
            (id_origem,),
        )
        destinos = _clean_rows(cursor.fetchall())
        if not destinos:
            return jsonify({
                'error': 'Nao ha outros funcionarios disponiveis para redistribuir',
            }), 400
        destino_ids = [int(d['id']) for d in destinos]

        # 2) Contratos atualmente atribuidos a origem, com valor e dias de atraso.
        cursor.execute(
            """
            SELECT fc.id                AS fc_id,
                   fc.id_contrato,
                   c.valor_credito,
                   (SELECT DATEDIFF(CURDATE(), MIN(vencimento))
                      FROM parcela
                     WHERE id_contrato = c.id AND status = 'aberto') AS dias_atraso
            FROM funcionario_cobranca fc
            INNER JOIN contrato c ON c.id = fc.id_contrato
            WHERE fc.id_funcionario = %s AND c.status = 'aberto'
            """,
            (id_origem,),
        )
        pendentes = _clean_rows(cursor.fetchall())

        # Inclui tambem contratos ja fechados/indenizados que porventura
        # estejam ligados ao origem (para esvaziar totalmente a carga dele).
        cursor.execute(
            "SELECT fc.id AS fc_id FROM funcionario_cobranca fc "
            "WHERE fc.id_funcionario = %s AND fc.id_contrato NOT IN ("
            "SELECT id_contrato FROM funcionario_cobranca fc2 "
            "INNER JOIN contrato c ON c.id = fc2.id_contrato "
            "WHERE fc2.id_funcionario = %s AND c.status = 'aberto')",
            (id_origem, id_origem),
        )
        fechados = [int(r['fc_id']) for r in cursor.fetchall()]

        if not pendentes and not fechados:
            return jsonify({
                'ok': True, 'modo': modo, 'transferidos': 0,
                'origem': {'id': int(origem['id']), 'nome': origem['nome']},
                'por_destino': [],
                'detalhe': 'Origem nao possuia contratos atribuidos.',
            })

        # 3) Carga atual dos destinos por situacao (ponto de partida do LPT).
        cursor.execute(
            """
            SELECT fc.id_funcionario,
                   c.valor_credito,
                   (SELECT DATEDIFF(CURDATE(), MIN(vencimento))
                      FROM parcela
                     WHERE id_contrato = c.id AND status = 'aberto') AS dias_atraso
            FROM funcionario_cobranca fc
            INNER JOIN contrato c ON c.id = fc.id_contrato
            WHERE c.status = 'aberto' AND fc.id_funcionario IN (%s)
            """ % (",".join(["%s"] * len(destino_ids))),
            destino_ids,
        )
        cargas_rows = _clean_rows(cursor.fetchall())

        estados = {
            fid: {s: {'count': 0, 'value': 0.0}
                  for s in ('critico', 'atencao', 'recente')}
            for fid in destino_ids
        }

        def _sit_norm(dias):
            try:
                d = int(dias or 0)
            except (TypeError, ValueError):
                d = 0
            if d >= 61: return 'critico'
            if d >= 31: return 'atencao'
            return 'recente'

        def _to_float(v):
            try:
                return float(v) if v is not None else 0.0
            except (TypeError, ValueError):
                return 0.0

        for cr in cargas_rows:
            fid = int(cr['id_funcionario'])
            if fid not in estados:
                continue
            sit = _sit_norm(cr.get('dias_atraso'))
            estados[fid][sit]['count'] += 1
            estados[fid][sit]['value'] += _to_float(cr.get('valor_credito'))

        # 4) LPT greedy: ordena contratos da origem (abertos) por valor desc
        #    dentro de cada situacao e aloca ao destino de menor carga.
        por_sit = {'critico': [], 'atencao': [], 'recente': []}
        for p in pendentes:
            por_sit[_sit_norm(p.get('dias_atraso'))].append(p)
        for s in por_sit:
            por_sit[s].sort(key=lambda x: _to_float(x.get('valor_credito')),
                            reverse=True)

        por_destino = {fid: {'count': 0, 'value': 0.0, 'fc_ids': []}
                       for fid in destino_ids}
        updates = []  # (novo_fid, fc_id)

        for s in ('critico', 'atencao', 'recente'):
            for p in por_sit[s]:
                valor = _to_float(p.get('valor_credito'))
                def score(fid, _s=s):
                    st = estados[fid][_s]
                    return (st['value'], st['count'])
                chosen = min(destino_ids, key=score)
                estados[chosen][s]['count'] += 1
                estados[chosen][s]['value'] += valor
                por_destino[chosen]['count'] += 1
                por_destino[chosen]['value'] += valor
                por_destino[chosen]['fc_ids'].append(int(p['fc_id']))
                updates.append((chosen, int(p['fc_id'])))

        # Distribui tambem os fechados (round-robin simples).
        for idx, fc_id in enumerate(fechados):
            chosen = destino_ids[idx % len(destino_ids)]
            por_destino[chosen]['fc_ids'].append(fc_id)
            updates.append((chosen, fc_id))

        if updates:
            cursor.executemany(
                "UPDATE funcionario_cobranca SET id_funcionario = %s WHERE id = %s",
                updates,
            )
            conn.commit()

        nome_by_id = {int(d['id']): d['nome'] for d in destinos}
        resumo = [
            {
                'id': fid,
                'nome': nome_by_id.get(fid, f'#{fid}'),
                'count': por_destino[fid]['count'],
                'value': round(por_destino[fid]['value'], 2),
            }
            for fid in destino_ids
        ]

        return jsonify({
            'ok': True,
            'modo': modo,
            'transferidos': len(updates),
            'origem': {'id': int(origem['id']), 'nome': origem['nome']},
            'por_destino': resumo,
        })

    except Exception as exc:
        conn.rollback()
        app.logger.exception('api_distribuicao_transferir: erro inesperado')
        return jsonify({'error': 'Erro na transferencia: ' + str(exc)}), 500
    finally:
        try: cursor.close()
        except Exception: pass
        try: conn.close()
        except Exception: pass


@app.route('/api/importacao/distribuicao/restaurar', methods=['POST'])
def api_distribuicao_restaurar():
    """Reverte a distribuicao atual para a baseline gerada pelo algoritmo
    original (scripts/distribuir_funcionarios_cobranca.py).

    Estrategia:
        1. Apaga TODAS as linhas de funcionario_cobranca (remove as
           transferencias manuais / em lote feitas pelo usuario).
        2. Executa o script de distribuicao, que e deterministico: dado o
           mesmo conjunto de contratos abertos e de funcionarios cadastrados,
           produz exatamente a mesma atribuicao da importacao original.

    Resposta:
        { ok: true, total, logs: [..], restauracao_ok: bool }
    """
    conn = _get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM funcionario_cobranca")
        conn.commit()
    except Exception as exc:
        conn.rollback()
        cursor.close()
        conn.close()
        app.logger.exception('restaurar: falha ao apagar funcionario_cobranca')
        return jsonify({'error': f'Falha ao limpar a distribuicao atual: {exc}'}), 500

    script = os.path.join(SCRIPTS_DIR, 'distribuir_funcionarios_cobranca.py')
    try:
        proc = subprocess.run(
            [PYTHON_EXE, '-u', script],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            env=_SUBPROCESS_ENV,
            timeout=300,
        )
    except Exception as exc:
        cursor.close()
        conn.close()
        app.logger.exception('restaurar: erro ao rodar script de distribuicao')
        return jsonify({'error': f'Erro ao executar o script de distribuicao: {exc}'}), 500

    logs = []
    if proc.stdout:
        logs.extend([ln for ln in proc.stdout.splitlines() if ln.strip()])
    if proc.stderr:
        logs.extend([f'[stderr] {ln}' for ln in proc.stderr.splitlines() if ln.strip()])

    cursor.execute("SELECT COUNT(*) AS total FROM funcionario_cobranca")
    row = cursor.fetchone() or {}
    total = int(row.get('total') or 0)
    cursor.close()
    conn.close()

    return jsonify({
        'ok': True,
        'restauracao_ok': (proc.returncode == 0),
        'returncode': proc.returncode,
        'total': total,
        'logs': logs[-80:],  # limita o payload - logs completos ficam no servidor
    })


@app.route('/api/importacao/distribuicao/aprovar', methods=['POST'])
def api_distribuicao_aprovar():
    """No-op de aprovacao. A tabela funcionario_cobranca nao tem coluna de
    status de aprovacao - qualquer linha presente JA e considerada efetiva.
    O endpoint existe apenas para o frontend confirmar que o usuario revisou
    e aceitou a distribuicao proposta."""
    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS total FROM funcionario_cobranca")
    row = cursor.fetchone() or {}
    total = int(row.get('total') or 0)
    cursor.close()
    conn.close()
    return jsonify({'ok': True, 'total': total})


# ---------------------------------------------------------------------------
# Helpers para API de Busca
# ---------------------------------------------------------------------------

def _get_db():
    return pymysql.connect(**DB_CONFIG, cursorclass=pymysql.cursors.DictCursor)


def _schema_pronto_para_importacao():
    """Garante que o schema basico foi aplicado (scripts/criar_banco.py).

    Retorna (True, None) ou (False, mensagem para o operador).
    """
    tabelas_obrigatorias = (
        "arquivos_gm",
        "empresa",
        "contrato",
        "parcela",
    )
    try:
        conn = _get_db()
        cur = conn.cursor()
        for nome in tabelas_obrigatorias:
            cur.execute("SHOW TABLES LIKE %s", (nome,))
            if not cur.fetchone():
                cur.close()
                conn.close()
                dbn = DB_CONFIG.get("database", "consorcio_gm")
                return (
                    False,
                    (
                        f"Schema ausente: a tabela '{nome}' nao existe no banco '{dbn}'. "
                        "Aplique o script de criacao:  python3 scripts/criar_banco.py  "
                        "(em seguida, se desejar: scripts/seed_funcionarios.py e "
                        "scripts/seed_tramitacao.py). Depois repita a importacao."
                    ),
                )
        cur.close()
        conn.close()
        return True, None
    except Exception as e:
        return (
            False,
            "Nao foi possivel acessar o MariaDB. Verifique se o servico esta no ar, "
            "usuario/senha em app.py (DB_CONFIG) e se o banco existe. "
            f"Detalhe: {e}",
        )


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
# Introspeccao da tabela de bens
# ---------------------------------------------------------------------------
# A tabela de bens pode se chamar `bem` ou `bens` e seu schema pode
# variar (descricao, modelo, marca, codigo, etc). Tambem pode estar
# ligada ao contrato por `id_contrato` OU por (`grupo`, `cota`).
#
# Este helper inspeciona INFORMATION_SCHEMA uma unica vez por processo
# e devolve um dicionario com:
#     {
#         'table':    'bens' | 'bem' | None,
#         'text_cols': [<nomes das colunas textuais>],
#         'join_on':  'id_contrato' | 'grupo_cota' | None,
#     }
# Quando o tracker for ajustado e a tabela for populada, nada precisa
# mudar aqui: a busca passa a encontrar resultados automaticamente.

_BEM_SCHEMA_CACHE = None


def _get_bem_schema():
    """Retorna metadados da tabela de bens. Faz cache por processo."""
    global _BEM_SCHEMA_CACHE
    if _BEM_SCHEMA_CACHE is not None:
        return _BEM_SCHEMA_CACHE

    info = {'table': None, 'text_cols': [], 'join_on': None}
    try:
        conn = _get_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME IN ('bem', 'bens')
            """
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if not rows:
            _BEM_SCHEMA_CACHE = info
            return info

        # Se ambas existirem, preferimos 'bens' (plural costuma ser o novo).
        tables = {r['TABLE_NAME']: [] for r in rows}
        for r in rows:
            tables[r['TABLE_NAME']].append(r)
        chosen = 'bens' if 'bens' in tables else 'bem'
        cols_rows = tables[chosen]

        text_types = {'varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext'}
        all_cols = {r['COLUMN_NAME'].lower() for r in cols_rows}
        text_cols = [r['COLUMN_NAME'] for r in cols_rows
                     if str(r['DATA_TYPE']).lower() in text_types]

        # Prioriza colunas com semantica de descricao.
        preferred = ['descricao', 'descricao_bem', 'desc_bem', 'modelo',
                     'marca', 'categoria', 'codigo', 'codigo_bem', 'nome']
        ordered = [c for c in preferred if c in text_cols]
        ordered += [c for c in text_cols if c not in ordered]

        join_on = None
        if 'id_contrato' in all_cols:
            join_on = 'id_contrato'
        elif 'grupo' in all_cols and 'cota' in all_cols:
            join_on = 'grupo_cota'

        info = {'table': chosen, 'text_cols': ordered, 'join_on': join_on}
    except Exception:
        # Qualquer falha -> nenhum bem disponivel, busca devolve vazio.
        info = {'table': None, 'text_cols': [], 'join_on': None}

    _BEM_SCHEMA_CACHE = info
    return info


def _bem_join_clause(alias_contrato='c', alias_bem='b'):
    """Retorna string do JOIN com a tabela de bens (ou None se indisponivel)."""
    info = _get_bem_schema()
    if not info['table'] or not info['join_on']:
        return None
    if info['join_on'] == 'id_contrato':
        return (f"INNER JOIN {info['table']} {alias_bem} "
                f"ON {alias_bem}.id_contrato = {alias_contrato}.id ")
    # grupo + cota
    return (f"INNER JOIN {info['table']} {alias_bem} "
            f"ON {alias_bem}.grupo = {alias_contrato}.grupo "
            f"AND {alias_bem}.cota = {alias_contrato}.cota ")


def _bem_where_clause(termo, alias_bem='b'):
    """Retorna (sql_fragment, params) para filtrar por termo nas colunas textuais do bem.

    Se nao houver colunas textuais, devolve (None, []).
    """
    info = _get_bem_schema()
    if not info['text_cols']:
        return None, []
    parts = [f"{alias_bem}.`{c}` LIKE %s" for c in info['text_cols']]
    params = [f'%{termo}%'] * len(info['text_cols'])
    return "(" + " OR ".join(parts) + ")", params


def _bem_concat_expr(alias_bem='b'):
    """Expressao SQL que concatena as colunas textuais para mostrar no resultado.

    Exemplo: "CONCAT_WS(' / ', b.descricao, b.modelo)".
    """
    info = _get_bem_schema()
    if not info['text_cols']:
        return "''"
    cols = ", ".join(f"{alias_bem}.`{c}`" for c in info['text_cols'])
    return f"CONCAT_WS(' / ', {cols})"


def _fetch_bens_para_contrato(cursor, contrato):
    """Retorna lista de bens (dicts) ligados ao contrato informado.

    Usa a chave de join detectada automaticamente (id_contrato ou grupo+cota).
    Devolve lista vazia quando a tabela nao existe ou nao possui chave de join.
    """
    info = _get_bem_schema()
    if not info['table'] or not info['join_on']:
        return []

    table = info['table']
    try:
        if info['join_on'] == 'id_contrato':
            cursor.execute(
                f"SELECT * FROM `{table}` WHERE id_contrato = %s",
                (contrato['id'],),
            )
        else:
            cursor.execute(
                f"SELECT * FROM `{table}` WHERE grupo = %s AND cota = %s",
                (contrato.get('grupo'), contrato.get('cota')),
            )
        return _clean_rows(cursor.fetchall())
    except Exception:
        return []


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

    elif tipo == 'bem':
        # Busca contratos por descricao do bem (modelo, marca, etc).
        # Schema da tabela de bens e detectado dinamicamente.
        status_filtro = request.args.get('status', '').strip()
        join_clause = _bem_join_clause('c', 'b')
        bem_where, bem_params = _bem_where_clause(termo, 'b')

        if not join_clause or not bem_where:
            # Tabela de bens indisponivel ou sem colunas textuais.
            results = []
        else:
            bem_expr = _bem_concat_expr('b')
            sql = (
                "SELECT c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
                "       p.nome_completo AS nome_devedor, "
                f"       GROUP_CONCAT(DISTINCT {bem_expr} SEPARATOR ' | ') AS bem_descricao "
                "FROM contrato c "
                + join_clause +
                "LEFT JOIN pessoa p ON c.id_pessoa = p.id "
                "WHERE " + bem_where + " "
            )
            params = list(bem_params)
            if status_filtro:
                sql += "AND c.status = %s "
                params.append(status_filtro)
            sql += (
                "GROUP BY c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
                "         p.nome_completo "
                "LIMIT 50"
            )
            cursor.execute(sql, params)
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

    def _safe_all(sql, params=()):
        """Executa SELECT isoladamente; retorna [] em caso de erro (tabela
        ausente, coluna faltando, etc) sem quebrar a resposta inteira."""
        try:
            cursor.execute(sql, params)
            return _clean_rows(cursor.fetchall())
        except Exception as exc:
            app.logger.warning('api_contrato_detalhe: falha em %r (%s)', sql, exc)
            return []

    def _safe_one(sql, params=()):
        try:
            cursor.execute(sql, params)
            return _clean_row(cursor.fetchone())
        except Exception as exc:
            app.logger.warning('api_contrato_detalhe: falha em %r (%s)', sql, exc)
            return None

    try:
        contrato = _safe_one("SELECT * FROM contrato WHERE id = %s", (contrato_id,))
        if not contrato:
            return jsonify({'error': 'Contrato nao encontrado'}), 404

        devedor = None
        devedor_end = devedor_tel = devedor_email = []
        if contrato.get('id_pessoa'):
            pid = contrato['id_pessoa']
            devedor = _safe_one("SELECT * FROM pessoa WHERE id = %s", (pid,))
            devedor_end = _safe_all("SELECT * FROM endereco WHERE id_pessoa = %s", (pid,))
            devedor_tel = _safe_all("SELECT * FROM telefone WHERE id_pessoa = %s", (pid,))
            devedor_email = _safe_all("SELECT * FROM email WHERE id_pessoa = %s", (pid,))

        avalista = None
        avalista_end = avalista_tel = avalista_email = []
        if contrato.get('id_avalista'):
            aid = contrato['id_avalista']
            avalista = _safe_one("SELECT * FROM pessoa WHERE id = %s", (aid,))
            avalista_end = _safe_all("SELECT * FROM endereco WHERE id_pessoa = %s", (aid,))
            avalista_tel = _safe_all("SELECT * FROM telefone WHERE id_pessoa = %s", (aid,))
            avalista_email = _safe_all("SELECT * FROM email WHERE id_pessoa = %s", (aid,))

        parcelas = _safe_all(
            "SELECT * FROM parcela WHERE id_contrato = %s ORDER BY numero_parcela",
            (contrato_id,),
        )
        ocorrencias = _safe_all(
            "SELECT * FROM ocorrencia WHERE id_contrato = %s ORDER BY data_arquivo DESC",
            (contrato_id,),
        )
        tramitacoes = _safe_all(
            "SELECT t.*, f.nome AS funcionario_nome "
            "FROM tramitacao t "
            "LEFT JOIN funcionario f ON t.id_funcionario = f.id "
            "WHERE t.id_contrato = %s ORDER BY t.data DESC",
            (contrato_id,),
        )

        try:
            bens = _fetch_bens_para_contrato(cursor, contrato)
        except Exception as exc:
            app.logger.warning('api_contrato_detalhe: falha em bens (%s)', exc)
            bens = []

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
            'tramitacoes': tramitacoes,
            'bens': bens,
        })
    except Exception as exc:
        app.logger.exception('api_contrato_detalhe: erro inesperado')
        return jsonify({'error': 'Erro ao carregar contrato: ' + str(exc)}), 500
    finally:
        try: cursor.close()
        except Exception: pass
        try: conn.close()
        except Exception: pass


# ---------------------------------------------------------------------------
# API: Relatorios
# ---------------------------------------------------------------------------

_RELATORIO_COLUMNS = [
    ('Grupo / Cota', 'grupo'),
    ('CPF / CNPJ', 'cpf_cnpj'),
    ('Nome Devedor', 'nome_devedor'),
    ('Status', 'status'),
    ('Data Arquivo', 'data_arquivo'),
]


def _build_relatorio_query(tipo, data_inicial, data_final, prioridade=None):
    """Retorna (sql, params) para o relatorio solicitado (exceto 'abertos' — ver _build_relatorio_query_abertos)."""
    params = []

    # Demais tipos: pagos, indenizados, novos
    params = [data_inicial, data_final]

    base = (
        "SELECT DISTINCT c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
        "       p.nome_completo AS nome_devedor, p.cpf_cnpj, o.data_arquivo "
        "FROM ocorrencia o "
        "LEFT JOIN contrato c ON c.id = o.id_contrato "
        "LEFT JOIN pessoa p ON c.id_pessoa = p.id "
    )

    if tipo == 'novos':
        where = "WHERE o.status = 'aberto' AND o.descricao LIKE '%%novo%%'"
    elif tipo == 'voltaram':
        where = "WHERE o.status = 'aberto' AND o.descricao LIKE '%%contrato voltou%%'"
    elif tipo == 'pagos':
        where = "WHERE c.status = 'fechado' AND o.status = 'fechado'"
    elif tipo == 'indenizados':
        where = "WHERE c.status = 'indenizado' AND o.status = 'indenizado'"
    else:
        where = "WHERE 1=1"

    where += " AND o.data_arquivo >= %s AND o.data_arquivo <= %s"
    sql = base + where + " ORDER BY o.data_arquivo, c.grupo, c.cota"
    return sql, params


def _fetch_relatorio_rows(tipo, data_inicial, data_final, prioridade=None):
    conn = _get_db()
    cursor = conn.cursor()
    try:
        if tipo == 'abertos':
            _ensure_cobranca_table(cursor)
            data_ref = _parse_data_final_relatorio_abertos(data_final)
            sql, params = _build_relatorio_query_abertos(data_ref, prioridade)
        else:
            sql, params = _build_relatorio_query(tipo, data_inicial, data_final, prioridade)
        cursor.execute(sql, params)
        rows = _clean_rows(cursor.fetchall())
    finally:
        cursor.close()
        conn.close()
    return rows


def _validate_relatorio_params():
    tipo = request.args.get('tipo', '').strip()
    data_inicial = request.args.get('data_inicial', '').strip()
    data_final = request.args.get('data_final', '').strip()
    prioridade = request.args.get('prioridade', '').strip()

    if not tipo:
        return None, None, None, None, 'Parametro tipo e obrigatorio.'
    # 'abertos': Data Final = data_arquivo em `cobranca` (obrigatoria; Data Inicial ignorada).
    if tipo == 'abertos' and not data_final:
        return (
            None, None, None, None,
            "Para 'Contratos Abertos', informe a Data Final (data_arquivo na tabela cobranca).",
        )
    if tipo == 'abertos' and data_final:
        try:
            datetime.date.fromisoformat(str(data_final).strip()[:10])
        except ValueError:
            return None, None, None, None, "Data Final invalida. Use o formato AAAA-MM-DD (ex.: 2026-04-22)."
    if tipo != 'abertos' and (not data_inicial or not data_final):
        return None, None, None, None, 'Parametros data_inicial e data_final sao obrigatorios.'
    return tipo, data_inicial or None, data_final or None, prioridade or None, None


def _relatorio_export_periodo_titulo(tipo, dt_ini, dt_fim):
    """Texto de periodo para cabecalhos de export (Excel/PDF)."""
    if tipo != 'abertos':
        return f"{dt_ini or '—'} a {dt_fim or '—'}"
    conn = _get_db()
    cursor = conn.cursor()
    try:
        _ensure_cobranca_table(cursor)
        ref = _relatorio_data_ref_abertos(cursor, dt_fim)
        if ref:
            return f"Snapshot (data GM): {ref.isoformat()}"
        return "Snapshot: —"
    finally:
        cursor.close()
        conn.close()


def _relatorio_export_filename_suffix(tipo, dt_ini, dt_fim):
    if tipo == 'abertos':
        conn = _get_db()
        cursor = conn.cursor()
        try:
            _ensure_cobranca_table(cursor)
            ref = _relatorio_data_ref_abertos(cursor, dt_fim)
            return ref.isoformat() if ref else 'sem_data'
        finally:
            cursor.close()
            conn.close()
    return f"{dt_ini}_{dt_fim}"


_TIPO_LABELS = {
    'abertos': 'Contratos Abertos',
    'pagos': 'Contratos Pagos/Fechados',
    'indenizados': 'Contratos Indenizados',
    'novos': 'Contratos Novos',
    'voltaram': 'Contratos que Voltaram',
}


@app.route('/api/relatorios')
def api_relatorios():
    tipo, dt_ini, dt_fim, prioridade, err = _validate_relatorio_params()
    if err:
        return jsonify({'error': err}), 400
    rows = _fetch_relatorio_rows(tipo, dt_ini, dt_fim, prioridade)
    return jsonify({'results': rows, 'tipo': tipo, 'total': len(rows)})


@app.route('/api/relatorios/excel')
def api_relatorios_excel():
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    tipo, dt_ini, dt_fim, prioridade, err = _validate_relatorio_params()
    if err:
        return jsonify({'error': err}), 400

    rows = _fetch_relatorio_rows(tipo, dt_ini, dt_fim, prioridade)
    titulo = _TIPO_LABELS.get(tipo, tipo)
    periodo_titulo = _relatorio_export_periodo_titulo(tipo, dt_ini, dt_fim)
    fname_suffix = _relatorio_export_filename_suffix(tipo, dt_ini, dt_fim)

    wb = Workbook()
    ws = wb.active
    ws.title = 'Relatorio'

    header_font = Font(bold=True, color='FFFFFF', size=11)
    header_fill = PatternFill(start_color='3B82F6', end_color='3B82F6', fill_type='solid')
    header_align = Alignment(horizontal='center', vertical='center')
    thin_border = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='D1D5DB'),
        bottom=Side(style='thin', color='D1D5DB'),
    )

    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(_RELATORIO_COLUMNS))
    title_cell = ws.cell(row=1, column=1, value=f'{titulo}  |  {periodo_titulo}')
    title_cell.font = Font(bold=True, size=13)
    title_cell.alignment = Alignment(horizontal='center')

    for col_idx, (label, _key) in enumerate(_RELATORIO_COLUMNS, start=1):
        cell = ws.cell(row=3, column=col_idx, value=label)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    alt_fill = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
    for row_idx, row in enumerate(rows, start=4):
        for col_idx, (_label, key) in enumerate(_RELATORIO_COLUMNS, start=1):
            val = row.get(key, '')
            cell = ws.cell(row=row_idx, column=col_idx, value=val if val is not None else '')
            cell.border = thin_border
            if (row_idx - 4) % 2 == 1:
                cell.fill = alt_fill

    for col_idx, (_label, _key) in enumerate(_RELATORIO_COLUMNS, start=1):
        max_len = len(_label)
        for row_idx in range(4, 4 + len(rows)):
            cell_val = str(ws.cell(row=row_idx, column=col_idx).value or '')
            max_len = max(max_len, len(cell_val))
        ws.column_dimensions[ws.cell(row=3, column=col_idx).column_letter].width = min(max_len + 4, 40)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    fname = f'relatorio_{tipo}_{fname_suffix}.xlsx'
    return send_file(buf, as_attachment=True, download_name=fname,
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')


@app.route('/api/relatorios/pdf')
def api_relatorios_pdf():
    from fpdf import FPDF

    tipo, dt_ini, dt_fim, prioridade, err = _validate_relatorio_params()
    if err:
        return jsonify({'error': err}), 400

    rows = _fetch_relatorio_rows(tipo, dt_ini, dt_fim, prioridade)
    titulo = _TIPO_LABELS.get(tipo, tipo)
    periodo_titulo = _relatorio_export_periodo_titulo(tipo, dt_ini, dt_fim)
    fname_suffix = _relatorio_export_filename_suffix(tipo, dt_ini, dt_fim)

    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_font('Helvetica', 'B', 14)
    pdf.cell(0, 10, titulo, ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, f'Periodo: {periodo_titulo}', ln=True, align='C')
    pdf.ln(6)

    col_widths = [30, 25, 40, 90, 40, 35]
    headers = [label for label, _key in _RELATORIO_COLUMNS]

    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_fill_color(59, 130, 246)
    pdf.set_text_color(255, 255, 255)
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 8, h, border=1, align='C', fill=True)
    pdf.ln()

    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(30, 41, 59)
    for row_idx, row in enumerate(rows):
        if row_idx % 2 == 1:
            pdf.set_fill_color(248, 250, 252)
            fill = True
        else:
            pdf.set_fill_color(255, 255, 255)
            fill = True

        for i, (_label, key) in enumerate(_RELATORIO_COLUMNS):
            val = str(row.get(key, '') or '')
            pdf.cell(col_widths[i], 7, val[:50], border=1, align='C', fill=fill)
        pdf.ln()

    pdf.ln(4)
    pdf.set_font('Helvetica', 'I', 8)
    pdf.cell(0, 5, f'Total de registros: {len(rows)}', ln=True)

    buf = io.BytesIO()
    pdf.output(buf)
    buf.seek(0)

    fname = f'relatorio_{tipo}_{fname_suffix}.pdf'
    return send_file(buf, as_attachment=True, download_name=fname, mimetype='application/pdf')


# ---------------------------------------------------------------------------
# API: Dashboard
# ---------------------------------------------------------------------------

@app.route('/api/dashboard')
def api_dashboard():
    """Dashboard totalmente reativo.

    Retorna, para os ultimos 12 meses, series mensais com contagens de:
      - pagos       (ocorrencia.status = 'fechado')
      - indenizados (ocorrencia.status = 'indenizado')
      - novos       (ocorrencia.descricao = 'contrato novo')
      - retomados   (ocorrencia.descricao = 'contrato voltou')

    Todo o recorte (periodo / series) e feito no front-end sobre esse payload,
    sem novas requisicoes.
    """
    conn = _get_db()
    cursor = conn.cursor()
    try:
        _ensure_cobranca_table(cursor)
    except Exception:
        app.logger.exception('api_dashboard: falha ao garantir tabela cobranca')

    now = datetime.date.today()

    # --- Gera lista continua de 12 meses (mais antigo -> mais recente) ---
    start_month = now.replace(day=1)
    for _ in range(11):
        start_month = (start_month - datetime.timedelta(days=1)).replace(day=1)
    window_start = start_month.isoformat()

    all_months = []
    cursor_d = start_month
    while cursor_d <= now:
        all_months.append(cursor_d.strftime('%Y-%m'))
        if cursor_d.month == 12:
            cursor_d = cursor_d.replace(year=cursor_d.year + 1, month=1)
        else:
            cursor_d = cursor_d.replace(month=cursor_d.month + 1)

    def _series(where_clause, params):
        cursor.execute(
            "SELECT DATE_FORMAT(o.data_arquivo, '%%Y-%%m') AS mes, "
            "       COUNT(DISTINCT o.id_contrato) AS total "
            "FROM ocorrencia o "
            + where_clause +
            " AND o.data_arquivo >= %s "
            "GROUP BY mes ORDER BY mes",
            tuple(params) + (window_start,),
        )
        by_month = {r['mes']: int(r['total']) for r in cursor.fetchall()}
        return [by_month.get(m, 0) for m in all_months]

    serie_pagos = _series("WHERE o.status = 'fechado'", [])
    serie_indenizados = _series("WHERE o.status = 'indenizado'", [])
    serie_novos = _series("WHERE o.descricao = 'contrato novo'", [])
    serie_retomados = _series("WHERE o.descricao = 'contrato voltou'", [])

    # --- KPIs snapshot (tabela `cobranca` = contratos em aberto no ultimo dia GM) ---
    data_dash_ref = _get_data_referencia_arquivos_gm(cursor)
    kpi_em_cobranca = _em_cobranca_count_por_data_ref(cursor, data_dash_ref)

    # --- Grafico doughnut: distribuicao da carteira ---
    cursor.execute("SELECT status, COUNT(*) AS total FROM contrato GROUP BY status")
    pie_raw = {r['status']: int(r['total']) for r in cursor.fetchall()}

    cursor.close()
    conn.close()

    return jsonify({
        'meses': all_months,
        'series': {
            'pagos': serie_pagos,
            'indenizados': serie_indenizados,
            'novos': serie_novos,
            'retomados': serie_retomados,
        },
        'snapshot': {
            'em_cobranca': kpi_em_cobranca,
        },
        'pie_chart': pie_raw,
    })


# ---------------------------------------------------------------------------
# API: Cobrança — Contratos agrupados por prioridade de parcelas
# ---------------------------------------------------------------------------

def _get_data_referencia_arquivos_gm(cursor):
    """Ultima data de arquivo GM importada. Usada em DATEDIFF de atraso para
    alinhar o painel ao tracker, ao relatorio e ao script de distribuicao
    (nao usar CURDATE() isolado, que desloca a janela 30-90 dias se o
    relogio nao bate com o fim de semana/feriado)."""
    try:
        cursor.execute("SELECT MAX(data_arquivo) AS dr FROM arquivos_gm")
        row = cursor.fetchone()
        if not row or row.get("dr") is None:
            return datetime.date.today()
        dr = row["dr"]
        if isinstance(dr, datetime.datetime):
            return dr.date()
        if isinstance(dr, datetime.date):
            return dr
        s = str(dr)[:10]
        return datetime.date.fromisoformat(s)
    except Exception:
        return datetime.date.today()


def _ensure_cobranca_table(cursor):
    """Cria a tabela `cobranca` (snapshot diario de id_contrato x data do GM) se ainda nao existir."""
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS cobranca (
            id BIGINT(20) NOT NULL AUTO_INCREMENT,
            id_contrato BIGINT(20) NOT NULL,
            data_arquivo DATE NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY cobranca_id_contrato_IDX (id_contrato, data_arquivo) USING BTREE,
            KEY cobranca_arquivos_gm_fk (data_arquivo),
            CONSTRAINT cobranca_contrato_fk FOREIGN KEY (id_contrato)
                REFERENCES contrato(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def _em_cobranca_count_por_data_ref(cursor, data_ref):
    """Conta registros em `cobranca` para a data (alinha a Em Cobranca / snapshot do painel)."""
    if data_ref is None:
        data_ref = _get_data_referencia_arquivos_gm(cursor)
    if isinstance(data_ref, datetime.datetime):
        d = data_ref.date()
    elif isinstance(data_ref, datetime.date):
        d = data_ref
    else:
        s = str(data_ref)[:10]
        try:
            d = datetime.date.fromisoformat(s)
        except ValueError:
            return 0
    cursor.execute(
        "SELECT COUNT(*) AS n FROM cobranca WHERE data_arquivo = %s",
        (d.isoformat(),),
    )
    row = cursor.fetchone()
    return int(row.get('n') or 0) if row else 0


def _parse_data_final_relatorio_abertos(data_final):
    """Converte a Data Final do relatorio (YYYY-MM-DD) em date — obrigatoria para tipo abertos."""
    s = str(data_final).strip()[:10]
    if len(s) != 10:
        raise ValueError('Data Final invalida')
    return datetime.date.fromisoformat(s)


def _relatorio_data_ref_abertos(cursor, data_final):
    """Data de snapshot para textos de export. Preferir Data Final; fallback so ultima GM se vazio."""
    if data_final:
        s = str(data_final).strip()[:10]
        if len(s) == 10:
            try:
                return datetime.date.fromisoformat(s)
            except ValueError:
                pass
    return _get_data_referencia_arquivos_gm(cursor)


def _build_relatorio_query_abertos(data_ref, prioridade=None):
    """Contratos abertos: 1 linha por linha de `cobranca` na data (id_contrato, data_arquivo).

    Nao se usa INNER JOIN em parcela aberto para nao excluir contratos que
    constavam no snapshot daquela `data_arquivo` mas cujas parcelas hoje estao
    fechadas (bater count(*) em cobranca = COUNT no relatorio "Todas").

    Vencimento/dias de atraso: estado *atual* das parcelas abertas (ou NULL se nao houver).
    """
    if isinstance(data_ref, datetime.datetime):
        d = data_ref.date()
    elif isinstance(data_ref, datetime.date):
        d = data_ref
    else:
        d = datetime.date.fromisoformat(str(data_ref)[:10])
    s = d.isoformat()

    sql = (
        "SELECT c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
        "       p.nome_completo AS nome_devedor, p.cpf_cnpj, "
        "       snap.data_arquivo AS data_arquivo, "
        "       parc.min_v AS vencimento_mais_antigo, "
        "       (CASE WHEN parc.min_v IS NOT NULL "
        "             THEN DATEDIFF(snap.data_arquivo, parc.min_v) END) AS dias_atraso "
        "FROM contrato c "
        "INNER JOIN ( "
        "  SELECT id, id_contrato, data_arquivo "
        "  FROM cobranca "
        "  WHERE data_arquivo = %s "
        ") AS snap ON snap.id_contrato = c.id "
        "LEFT JOIN pessoa p ON c.id_pessoa = p.id "
        "LEFT JOIN ( "
        "  SELECT id_contrato, MIN(vencimento) AS min_v "
        "  FROM parcela "
        "  WHERE status = 'aberto' "
        "  GROUP BY id_contrato "
        ") parc ON parc.id_contrato = c.id "
        "WHERE 1=1 "
    )
    params = [s]

    if prioridade == 'critico':
        sql += (
            "AND parc.min_v IS NOT NULL "
            "AND DATEDIFF(snap.data_arquivo, parc.min_v) >= 60 "
        )
    elif prioridade == 'atencao':
        sql += (
            "AND parc.min_v IS NOT NULL "
            "AND DATEDIFF(snap.data_arquivo, parc.min_v) >= 30 "
            "AND DATEDIFF(snap.data_arquivo, parc.min_v) < 60 "
        )
    elif prioridade == 'recente':
        sql += (
            "AND parc.min_v IS NOT NULL "
            "AND DATEDIFF(snap.data_arquivo, parc.min_v) >= 1 "
            "AND DATEDIFF(snap.data_arquivo, parc.min_v) < 30 "
        )

    # Contratos sem parcela aberta hoje: NULL em dias; ordena por atraso depois por grupo
    sql += (
        "ORDER BY (parc.min_v IS NULL) ASC, "
        "         DATEDIFF(snap.data_arquivo, parc.min_v) DESC, "
        "         c.grupo, c.cota"
    )
    return sql, params


@app.route('/api/cobranca')
def api_cobranca():
    """Retorna contratos abertos divididos em 3 faixas de prioridade
    baseadas no vencimento mais antigo de parcelas em aberto.

    O filtro de "operador" agora usa a tabela `funcionario_cobranca`
    (id_funcionario + id_contrato). Aceita tanto `funcionario_id`
    (numerico, preferencial) quanto `operador` (string, retrocompat).
    """
    funcionario_id_raw = request.args.get('funcionario_id', '').strip()
    operador_nome = request.args.get('operador', '').strip()

    funcionario_id = None
    if funcionario_id_raw:
        try:
            funcionario_id = int(funcionario_id_raw)
        except ValueError:
            funcionario_id = None

    conn = _get_db()
    cursor = conn.cursor()

    # Garante que a tabela de negativacao existe antes do SELECT que a
    # referencia (evita erro quando ainda e a primeira execucao).
    try:
        _ensure_negativacao_table(cursor)
    except Exception:
        # Se a criacao falhar (permissao, schema bloqueado, etc.), seguimos
        # sem o flag de negativacao em vez de derrubar a tela inteira.
        app.logger.exception('api_cobranca: falha ao garantir tabela negativacao')
    try:
        _ensure_cobranca_table(cursor)
    except Exception:
        app.logger.exception('api_cobranca: falha ao garantir tabela cobranca')

    # Query base: contratos do snapshot `cobranca` (ultimo dia GM) com parcelas
    # em aberto, com join
    # opcional em funcionario_cobranca/funcionario para expor o
    # responsavel de cobranca e (se a tabela existir) com a descricao
    # do bem associado ao contrato.
    data_ref = _get_data_referencia_arquivos_gm(cursor)

    bem_info = _get_bem_schema()
    bem_select = "NULL"
    bem_join = ""
    if bem_info['table'] and bem_info['join_on']:
        bem_concat = _bem_concat_expr('b')
        bem_select = f"GROUP_CONCAT(DISTINCT {bem_concat} SEPARATOR ' | ')"
        if bem_info['join_on'] == 'id_contrato':
            bem_join = f"LEFT JOIN {bem_info['table']} b ON b.id_contrato = c.id "
        else:
            bem_join = (
                f"LEFT JOIN {bem_info['table']} b "
                "ON b.grupo = c.grupo AND b.cota = c.cota "
            )

    # A parcela ALVO e a parcela em aberto mais antiga do contrato. E ela
    # que sera (ou ja foi) negativada. O subquery correlacionado abaixo
    # devolve o ID dessa parcela por contrato (ordena por vencimento e
    # id para ser deterministico).
    base_sql = (
        "SELECT c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
        "       p.nome_completo AS nome_devedor, p.cpf_cnpj, "
        "       c.valor_credito, "
        "       MIN(par.vencimento) AS vencimento_mais_antigo, "
        "       DATEDIFF(%s, MIN(par.vencimento)) AS dias_atraso, "
        # DISTINCT: o JOIN com `bens` pode duplicar linhas (varios bens no mesmo
        # contrato); o numero de parcelas abertas e por id de parcela, nao por linha.
        "       COUNT(DISTINCT par.id) AS parcelas_abertas, "
        "       fc.id_funcionario AS id_funcionario, "
        "       f.nome AS nome_funcionario, "
        "       ( "
        "         SELECT p2.id FROM parcela p2 "
        "         WHERE p2.id_contrato = c.id AND p2.status = 'aberto' "
        "         ORDER BY p2.vencimento ASC, p2.id ASC LIMIT 1 "
        "       ) AS id_parcela_alvo, "
        "       ( "
        "         SELECT p3.numero_parcela FROM parcela p3 "
        "         WHERE p3.id_contrato = c.id AND p3.status = 'aberto' "
        "         ORDER BY p3.vencimento ASC, p3.id ASC LIMIT 1 "
        "       ) AS numero_parcela_alvo, "
        f"       {bem_select} AS bem_descricao "
        "FROM contrato c "
        "INNER JOIN cobranca cob ON cob.id_contrato = c.id AND cob.data_arquivo = %s "
        "INNER JOIN parcela par ON par.id_contrato = c.id AND par.status = 'aberto' "
        "LEFT JOIN pessoa p ON c.id_pessoa = p.id "
        "LEFT JOIN funcionario_cobranca fc ON fc.id_contrato = c.id "
        "LEFT JOIN funcionario f ON f.id = fc.id_funcionario "
        + bem_join +
        "WHERE c.status = 'aberto' "
    )
    params = [data_ref, data_ref]

    if funcionario_id is not None:
        base_sql += " AND fc.id_funcionario = %s "
        params.append(funcionario_id)
    elif operador_nome:
        base_sql += " AND f.nome = %s "
        params.append(operador_nome)

    base_sql += (
        "GROUP BY c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
        "         p.nome_completo, p.cpf_cnpj, c.valor_credito, "
        "         fc.id_funcionario, f.nome "
        "ORDER BY dias_atraso DESC"
    )

    cursor.execute(base_sql, params)
    rows = _clean_rows(cursor.fetchall())

    # -------------------------------------------------------------------------
    # Classificacao de negativacao (3 estados):
    #
    #   'negativado'    -> a parcela-alvo ja consta em `negativacao` como
    #                      id_parcela, OU ha registro legado (id_parcela NULL
    #                      de versao antiga do schema) para o id_contrato.
    #   'pendente'      -> 30 < dias_atraso < 90, parcela-alvo ainda nao
    #                      consta em `negativacao` (inclui 1 so parcela em
    #                      aberto, se a janela bater) — "Falta negativar".
    #   'nao_elegivel'  -> fora da janela 31-89, ou ainda sem criterio Serasa
    #                      p/ envio. Nao e o "Ativo" do filtro: ver front.
    #
    # NOTA: a versao anterior consultava `WHERE id_parcela IN (parcelas alvo
    # desta resposta)` e descartava linhas de `negativacao` cujo id_parcela
    # nao estava nessa lista (p.ex. registro legado, ou o IN nao trazia o
    # id exato). Agora buscamos por id_contrato (completo) e comparamos no
    # Python com a parcela-alvo atual.
    #
    # `negativado` (boolean) e mantido apenas para backcompat do front.
    # -------------------------------------------------------------------------
    cids = []
    for r in rows:
        try:
            cids.append(int(r['id']))
        except (TypeError, ValueError, KeyError):
            pass

    try:
        neg_por_contrato = _mapa_parcelas_negativadas_por_contrato(cursor, cids)
    except Exception:
        app.logger.exception('api_cobranca: falha ao consultar negativacao')
        neg_por_contrato = {}

    for r in rows:
        try:
            cid = int(r['id'])
        except (TypeError, ValueError, KeyError):
            cid = None

        try:
            dias_i = int(r.get('dias_atraso') or 0)
        except (TypeError, ValueError):
            dias_i = 0
        try:
            qtd_abertas = int(r.get('parcelas_abertas') or 0)
        except (TypeError, ValueError):
            qtd_abertas = 0

        id_alvo_raw = r.get('id_parcela_alvo')
        id_alvo = None
        if id_alvo_raw is not None:
            try:
                id_alvo = int(id_alvo_raw)
            except (TypeError, ValueError):
                id_alvo = None

        neg_set = neg_por_contrato.get(cid, set()) if cid is not None else set()
        # Historico: negativacao sem id_parcela = contrato ja foi tratado
        # no modelo antigo. Parcela-alvo ja registrada = negativado atual.
        ja_neg = (_NEG_NULL_PARCELA in neg_set) or (
            id_alvo is not None and id_alvo in neg_set
        )
        # Janela Serasa: 31-89 dias na parcela-alvo (1 ou N parcelas abertas).
        elegivel = 30 < dias_i < 90

        if ja_neg:
            status = 'negativado'
        elif elegivel:
            status = 'pendente'
        else:
            status = 'nao_elegivel'

        r['status_negativacao'] = status
        r['elegivel_negativacao'] = elegivel
        r['negativado'] = ja_neg  # backcompat

    # Dividir em 3 blocos de prioridade
    critico = []   # 60-90+ dias
    atencao = []   # 30-60 dias
    recente = []   # 1-30 dias

    for r in rows:
        dias = r.get('dias_atraso') or 0
        if isinstance(dias, str):
            dias = int(float(dias))
        if dias >= 60:
            critico.append(r)
        elif dias >= 30:
            atencao.append(r)
        elif dias >= 1:
            recente.append(r)
        # dias <= 0 => parcela ainda nao venceu, nao entra nos blocos

    # Lista de funcionarios (para popular o <select> do filtro no front).
    try:
        cursor.execute("SELECT id, nome FROM funcionario ORDER BY nome")
        funcionarios = [
            {'id': int(r['id']), 'nome': r['nome']}
            for r in cursor.fetchall()
        ]
    except Exception:
        funcionarios = []

    cursor.close()
    conn.close()

    return jsonify({
        'critico': critico,
        'atencao': atencao,
        'recente': recente,
        'total': len(critico) + len(atencao) + len(recente),
        'funcionarios': funcionarios,
        # Mantem a chave antiga por compatibilidade (apenas nomes).
        'operadores': [f['nome'] for f in funcionarios],
    })


# ---------------------------------------------------------------------------
# API: Consorciados e Avalistas
# ---------------------------------------------------------------------------

def _build_pessoa_query(join_field, q, tipo):
    """Helper para construir query de listagem de pessoas vinculadas a contratos."""
    sql = (
        "SELECT p.id, p.nome_completo, p.cpf_cnpj, "
        "       COUNT(DISTINCT c.id) AS total_contratos "
        "FROM pessoa p "
        "INNER JOIN contrato c ON c." + join_field + " = p.id "
    )
    params = []
    where_parts = []

    if q and tipo:
        if tipo == 'nome':
            where_parts.append("p.nome_completo LIKE %s")
            params.append('%' + q + '%')
        elif tipo == 'cpf':
            where_parts.append("p.cpf_cnpj LIKE %s")
            params.append('%' + q + '%')
        elif tipo == 'grupo_cota':
            where_parts.append("(c.grupo LIKE %s OR c.cota LIKE %s OR CONCAT(c.grupo, '/', c.cota) LIKE %s)")
            params.extend(['%' + q + '%', '%' + q + '%', '%' + q + '%'])
        elif tipo == 'bem':
            bem_join = _bem_join_clause('c', 'b')
            bem_where, bem_params = _bem_where_clause(q, 'b')
            if bem_join and bem_where:
                sql += bem_join
                where_parts.append(bem_where)
                params.extend(bem_params)
            else:
                # Tabela de bens indisponivel -> nenhum resultado.
                where_parts.append("1 = 0")
    elif q:
        where_parts.append("(p.nome_completo LIKE %s OR p.cpf_cnpj LIKE %s)")
        params.extend(['%' + q + '%', '%' + q + '%'])

    if where_parts:
        sql += "WHERE " + " AND ".join(where_parts) + " "

    sql += "GROUP BY p.id, p.nome_completo, p.cpf_cnpj "
    sql += "ORDER BY p.nome_completo "

    return sql, params


@app.route('/api/consorciados')
def api_consorciados():
    """Lista pessoas (devedores) vinculadas a contratos via id_pessoa."""
    q = request.args.get('q', '').strip()
    tipo = request.args.get('tipo', '').strip()

    sql, params = _build_pessoa_query('id_pessoa', q, tipo)

    # Sem busca = limite 10 (preview); com busca = todos os resultados
    if not q:
        sql += "LIMIT 10"

    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute(sql, params)
    rows = _clean_rows(cursor.fetchall())
    cursor.close()
    conn.close()

    return jsonify({'results': rows, 'total': len(rows)})


@app.route('/api/avalistas')
def api_avalistas():
    """Lista pessoas (avalistas) vinculadas a contratos via id_avalista."""
    q = request.args.get('q', '').strip()
    tipo = request.args.get('tipo', '').strip()

    sql, params = _build_pessoa_query('id_avalista', q, tipo)

    # Sem busca = limite 10 (preview); com busca = todos os resultados
    if not q:
        sql += "LIMIT 10"

    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute(sql, params)
    rows = _clean_rows(cursor.fetchall())
    cursor.close()
    conn.close()

    return jsonify({'results': rows, 'total': len(rows)})

@app.route('/api/operadores/dashboard')
def api_operadores_dashboard():
    """Retorna estatisticas e lista de contratos agrupados por operador.

    Contratos considerados: snapshot `cobranca` na data do ultimo `arquivos_gm`
    (mesma base do KPI "Em cobranca" do Dashboard e do modulo Cobranca), cruzado
    com `funcionario_cobranca`. dias_atraso = DATEDIFF(data_GM, vencimento mais
    antigo em aberto), nao CURDATE().
    """
    conn = _get_db()
    cursor = conn.cursor()
    try:
        _ensure_cobranca_table(cursor)
    except Exception:
        app.logger.exception('api_operadores_dashboard: falha ao garantir tabela cobranca')
    data_ref = _get_data_referencia_arquivos_gm(cursor)
    if isinstance(data_ref, datetime.datetime):
        dref = data_ref.date()
    elif isinstance(data_ref, datetime.date):
        dref = data_ref
    else:
        dref = datetime.date.fromisoformat(str(data_ref)[:10])
    s_ref = dref.isoformat()

    # 1) Lista todos os funcionarios (para que operadores sem contratos ainda
    #    apareçam no <select> de filtros e no bloco do dashboard).
    cursor.execute(
        """
        SELECT id, nome, COALESCE(ativo, 1) AS ativo
        FROM funcionario
        ORDER BY nome
        """
    )
    funcionarios = _clean_rows(cursor.fetchall())

    def _status_from_ativo(val):
        try:
            return 'ativo' if int(val or 0) == 1 else 'inativo'
        except (TypeError, ValueError):
            return 'ativo'

    operators_map = {}
    for f in funcionarios:
        fid = int(f['id'])
        operators_map[fid] = {
            'id': fid,
            'nome': f['nome'],
            'status_operador': _status_from_ativo(f.get('ativo')),
            'contratos': [],
            'stats': {'total': 0, 'critico': 0, 'atencao': 0, 'recente': 0},
        }

    # 2) Mesma logica de /api/cobranca e do KPI Dashboard: so contratos no
    #    snapshot `cobranca` na data do ultimo GM; atraso com DATEDIFF nessa
    #    data (nao CURDATE()).
    cursor.execute(
        """
        SELECT fc.id_funcionario,
               c.id, c.grupo, c.cota, c.numero_contrato, c.valor_credito,
               p.nome_completo AS nome_devedor, p.cpf_cnpj,
               (SELECT DATEDIFF(%s, MIN(vencimento))
                  FROM parcela
                 WHERE id_contrato = c.id AND status = 'aberto') AS dias_atraso,
               (SELECT COUNT(*)
                  FROM parcela
                 WHERE id_contrato = c.id AND status = 'aberto') AS parcelas_abertas,
               (SELECT MIN(vencimento)
                  FROM parcela
                 WHERE id_contrato = c.id AND status = 'aberto') AS vencimento_mais_antigo
        FROM funcionario_cobranca fc
        INNER JOIN contrato c ON c.id = fc.id_contrato
        INNER JOIN cobranca cob ON cob.id_contrato = c.id AND cob.data_arquivo = %s
        LEFT JOIN pessoa p    ON p.id = c.id_pessoa
        WHERE c.status = 'aberto'
        ORDER BY fc.id_funcionario, c.valor_credito DESC
        """,
        (s_ref, s_ref),
    )
    rows = _clean_rows(cursor.fetchall())

    kpis = {'total': 0, 'critico': 0, 'atencao': 0, 'recente': 0}

    for r in rows:
        fid = int(r['id_funcionario'])
        if fid not in operators_map:
            # Funcionario que nao esta mais na tabela `funcionario` mas ainda
            # tem vinculo na tabela `funcionario_cobranca` (edge case).
            operators_map[fid] = {
                'id': fid,
                'nome': f'#{fid}',
                'status_operador': 'inativo',
                'contratos': [],
                'stats': {'total': 0, 'critico': 0, 'atencao': 0, 'recente': 0},
            }

        situacao = _situacao_from_dias(r.get('dias_atraso'))
        r['situacao'] = situacao  # o frontend usa essa chave para pintar badges
        # Normaliza campos exibidos pelo frontend
        if r.get('dias_atraso') is None:
            r['dias_atraso'] = 0
        if r.get('parcelas_abertas') is None:
            r['parcelas_abertas'] = 0

        bucket = operators_map[fid]
        bucket['contratos'].append(r)
        bucket['stats']['total'] += 1
        kpis['total'] += 1

        sk = _sit_key(situacao)
        if sk in ('critico', 'atencao', 'recente'):
            bucket['stats'][sk] += 1
            kpis[sk] += 1

    cursor.close()
    conn.close()

    # Preserva ordem alfabetica por nome.
    operadores = sorted(operators_map.values(), key=lambda x: (x['nome'] or '').lower())

    return jsonify({
        'operadores': operadores,
        'kpis': kpis,
    })


# ---------------------------------------------------------------------------
# API: Performance (safras x ocorrencias)
# ---------------------------------------------------------------------------

def _safra_bounds(year, month, parte):
    """parte 0..3: (1-9), (10-12), (13-19), (20-fim). Retorna (date_start, date_end)."""
    last = calendar.monthrange(year, month)[1]
    bounds = [(1, 9), (10, 12), (13, 19), (20, last)]
    d1, d2 = bounds[parte]
    return datetime.date(year, month, d1), datetime.date(year, month, d2)


def _shift_month(year, month, delta):
    idx = year * 12 + (month - 1) + delta
    return idx // 12, idx % 12 + 1


def _count_distinct_ocorrencias(cursor, date_ranges, status_filter=None, desc_novo_only=False):
    """date_ranges: lista de (d_start, d_end) inclusive. status_filter: None (todos), ou lista de status."""
    if not date_ranges:
        return 0
    parts = []
    params = []
    for d1, d2 in date_ranges:
        parts.append('(o.data_arquivo >= %s AND o.data_arquivo <= %s)')
        params.extend([d1.isoformat(), d2.isoformat()])
    where = '(' + ' OR '.join(parts) + ')'
    extra = ''
    if status_filter:
        ph = ','.join(['%s'] * len(status_filter))
        extra += f' AND o.status IN ({ph})'
        params.extend(status_filter)
    if desc_novo_only:
        extra += " AND o.status = 'aberto' AND o.descricao LIKE '%%novo%%'"
    sql = f'SELECT COUNT(DISTINCT o.id_contrato) AS n FROM ocorrencia o WHERE {where}{extra}'
    cursor.execute(sql, params)
    row = cursor.fetchone()
    return int(row['n'] or 0)


def _daily_series(cursor, d1, d2):
    """Retorna series com UMA barra por dia entre d1 e d2 (inclusive).

    Labels vem no formato 'dd/mm' e as 3 series sao:
      - novos       : ocorrencias com descricao 'contrato novo' (status=aberto)
      - pagos       : ocorrencias com status='fechado'
      - indenizados : ocorrencias com status='indenizado'
    """
    if d2 < d1:
        return {'barLabels': [], 'novos': [], 'pagos': [], 'indenizados': []}

    labels = []
    day_keys = []
    cursor_d = d1
    while cursor_d <= d2:
        day_keys.append(cursor_d.isoformat())
        labels.append(cursor_d.strftime('%d/%m'))
        cursor_d = cursor_d + datetime.timedelta(days=1)

    def _group_by_day(sql_where, params):
        cursor.execute(
            "SELECT DATE(o.data_arquivo) AS dia, "
            "       COUNT(DISTINCT o.id_contrato) AS n "
            "FROM ocorrencia o "
            "WHERE o.data_arquivo >= %s AND o.data_arquivo <= %s "
            + sql_where +
            " GROUP BY DATE(o.data_arquivo)",
            (d1.isoformat(), d2.isoformat()) + tuple(params),
        )
        return {str(r['dia']): int(r['n'] or 0) for r in cursor.fetchall()}

    novos_map = _group_by_day(
        " AND o.status = 'aberto' AND o.descricao LIKE '%%novo%%'", []
    )
    pagos_map = _group_by_day(" AND o.status = 'fechado'", [])
    inden_map = _group_by_day(" AND o.status = 'indenizado'", [])

    return {
        'barLabels': labels,
        'novos': [novos_map.get(k, 0) for k in day_keys],
        'pagos': [pagos_map.get(k, 0) for k in day_keys],
        'indenizados': [inden_map.get(k, 0) for k in day_keys],
    }


@app.route('/api/performance')
def api_performance():
    mes = request.args.get('mes', '').strip()
    if not mes or len(mes) < 7:
        return jsonify({'error': 'Parametro mes obrigatorio (YYYY-MM)'}), 400
    try:
        y, m = int(mes[:4]), int(mes[5:7])
        datetime.date(y, m, 1)
    except ValueError:
        return jsonify({'error': 'mes invalido'}), 400

    conn = _get_db()
    cursor = conn.cursor()

    # KPI: novos contratos no mes (qualquer dia)
    cursor.execute(
        "SELECT COUNT(DISTINCT o.id_contrato) AS n FROM ocorrencia o "
        "WHERE o.status = 'aberto' AND o.descricao LIKE '%%novo%%' "
        "AND YEAR(o.data_arquivo) = %s AND MONTH(o.data_arquivo) = %s",
        (y, m),
    )
    kpi_novos = int(cursor.fetchone()['n'] or 0)

    # KPI: safra em destaque (hoje)
    today = datetime.date.today()
    parte_hoje = None
    for p in range(4):
        d1, d2 = _safra_bounds(today.year, today.month, p)
        if d1 <= today <= d2:
            parte_hoje = p
            break
    safra_labels = [
        'Safra 1 (01 - 09)',
        'Safra 2 (10 - 12)',
        'Safra 3 (13 - 19)',
        'Safra 4 (20 - fim)',
    ]
    kpi_safra_label = safra_labels[parte_hoje] if parte_hoje is not None else '—'

    # KPI: taxa recuperacao no mes (fechado+indenizado vs total ocorrencias com status relevante)
    cursor.execute(
        "SELECT COUNT(*) AS n FROM ocorrencia o "
        "WHERE YEAR(o.data_arquivo) = %s AND MONTH(o.data_arquivo) = %s "
        "AND o.status IN ('aberto', 'fechado', 'indenizado')",
        (y, m),
    )
    total_mov = int(cursor.fetchone()['n'] or 0)
    cursor.execute(
        "SELECT COUNT(*) AS n FROM ocorrencia o "
        "WHERE YEAR(o.data_arquivo) = %s AND MONTH(o.data_arquivo) = %s "
        "AND o.status IN ('fechado', 'indenizado')",
        (y, m),
    )
    mov_rec = int(cursor.fetchone()['n'] or 0)
    kpi_rec_pct = round(100.0 * mov_rec / total_mov, 1) if total_mov else 0.0

    # KPI: parcelas criticas (aberto, vencimento ha mais de 90 dias)
    cursor.execute(
        "SELECT COUNT(*) AS n FROM parcela par "
        "INNER JOIN contrato c ON c.id = par.id_contrato "
        "WHERE par.status = 'aberto' AND c.status = 'aberto' "
        "AND par.vencimento < DATE_SUB(CURDATE(), INTERVAL 90 DAY)"
    )
    kpi_parcelas_crit = int(cursor.fetchone()['n'] or 0)

    safras_out = []
    bar_novos = []
    bar_pagos = []
    bar_indenizados = []

    for parte in range(4):
        d_m0a, d_m0b = _safra_bounds(y, m, parte)
        y1, m1 = _shift_month(y, m, 1)
        d_m1a, d_m1b = _safra_bounds(y1, m1, parte)
        y2, m2 = _shift_month(y, m, 2)
        d_m2a, d_m2b = _safra_bounds(y2, m2, parte)

        ranges_m = [(d_m0a, d_m0b)]
        ranges_m_m1 = [(d_m0a, d_m0b), (d_m1a, d_m1b)]
        ranges_m_m2 = [(d_m0a, d_m0b), (d_m1a, d_m1b), (d_m2a, d_m2b)]

        volume = _count_distinct_ocorrencias(cursor, ranges_m, None, False)
        d30 = _count_distinct_ocorrencias(cursor, ranges_m, ['fechado', 'indenizado'], False)
        d60 = _count_distinct_ocorrencias(cursor, ranges_m_m1, ['fechado', 'indenizado'], False)
        d90 = _count_distinct_ocorrencias(cursor, ranges_m_m2, ['fechado', 'indenizado'], False)

        detail = _daily_series(cursor, d_m0a, d_m0b)
        doughnut_safra = [d30, max(0, d60 - d30), max(0, d90 - d60)]

        safras_out.append({
            'index': parte,
            'label': safra_labels[parte],
            'volume': volume,
            'd30': d30,
            'd60': d60,
            'd90': d90,
            'detail': {**detail, 'doughnut': doughnut_safra},
        })

        novos_safra = _count_distinct_ocorrencias(cursor, ranges_m, None, desc_novo_only=True)
        pagos_safra = _count_distinct_ocorrencias(cursor, ranges_m, ['fechado'], False)
        inden_safra = _count_distinct_ocorrencias(cursor, ranges_m, ['indenizado'], False)
        bar_novos.append(novos_safra)
        bar_pagos.append(pagos_safra)
        bar_indenizados.append(inden_safra)

    # Doughnut global: contratos abertos com parcela vencida, por dias de atraso (min vencimento)
    cursor.execute(
        """
        SELECT CASE
            WHEN DATEDIFF(CURDATE(), v.min_v) BETWEEN 1 AND 30 THEN 'd30'
            WHEN DATEDIFF(CURDATE(), v.min_v) BETWEEN 31 AND 60 THEN 'd60'
            WHEN DATEDIFF(CURDATE(), v.min_v) > 60 THEN 'd90'
            ELSE 'out'
        END AS faixa, COUNT(*) AS n
        FROM (
            SELECT c.id, MIN(par.vencimento) AS min_v
            FROM contrato c
            INNER JOIN parcela par ON par.id_contrato = c.id AND par.status = 'aberto'
            WHERE c.status = 'aberto'
            GROUP BY c.id
            HAVING min_v < CURDATE()
        ) v
        GROUP BY faixa
        """
    )
    dg = {'d30': 0, 'd60': 0, 'd90': 0}
    for r in cursor.fetchall():
        if r['faixa'] in dg:
            dg[r['faixa']] = int(r['n'] or 0)
    doughnut_global = [dg['d30'], dg['d60'], dg['d90']]

    cursor.close()
    conn.close()

    return jsonify({
        'mes': mes,
        'kpis': {
            'novos_mes': kpi_novos,
            'safra_destaque': kpi_safra_label,
            'recuperacao_pct': kpi_rec_pct,
            'parcelas_criticas_90d': kpi_parcelas_crit,
        },
        'safras': safras_out,
        'chart_all': {
            'barLabels': safra_labels,
            'novos': bar_novos,
            'pagos': bar_pagos,
            'indenizados': bar_indenizados,
            'doughnut': doughnut_global,
        },
    })


# ---------------------------------------------------------------------------
# API: Performance — exportacao (xlsx / pdf / powerbi)
# ---------------------------------------------------------------------------

_SERIES_LABELS_EXPORT = {
    'novos': 'Contratos Novos',
    'pagos': 'Contratos Pagos',
    'indenizados': 'Contratos Indenizados',
}
_FAIXA_LABELS_EXPORT = {
    'd30': 'Ate 30 dias',
    'd60': '31 a 60 dias',
    'd90': 'Acima de 60 dias',
}
_SAFRA_LABELS_EXPORT = [
    'Safra 1 (01 - 09)',
    'Safra 2 (10 - 12)',
    'Safra 3 (13 - 19)',
    'Safra 4 (20 - fim)',
]


def _resolve_export_payload():
    """Le o JSON do POST de exportacao e valida / normaliza o conteudo."""
    payload = request.get_json(silent=True) or {}
    mes = str(payload.get('mes', '')).strip()
    if not mes or len(mes) < 7:
        return None, 'Parametro mes obrigatorio (YYYY-MM)'
    try:
        y, m = int(mes[:4]), int(mes[5:7])
        datetime.date(y, m, 1)
    except ValueError:
        return None, 'mes invalido'

    raw_idx = payload.get('safra_index')
    if raw_idx in (None, '', 'all'):
        safra_index = None
    else:
        try:
            safra_index = int(raw_idx)
            if safra_index < 0 or safra_index > 3:
                safra_index = None
        except (TypeError, ValueError):
            safra_index = None

    series = [s for s in (payload.get('series') or []) if s in _SERIES_LABELS_EXPORT]
    if not series:
        series = list(_SERIES_LABELS_EXPORT.keys())
    faixas = [f for f in (payload.get('faixas') or []) if f in _FAIXA_LABELS_EXPORT]
    if not faixas:
        faixas = list(_FAIXA_LABELS_EXPORT.keys())

    return {
        'mes': mes,
        'y': y,
        'm': m,
        'safra_index': safra_index,
        'series': series,
        'faixas': faixas,
        'bar_image': payload.get('bar_image') or '',
        'pie_image': payload.get('pie_image') or '',
    }, None


def _fetch_export_dataset(cursor, ctx):
    """Monta os tres blocos de dados que sao usados em qualquer formato."""
    y, m = ctx['y'], ctx['m']
    safra_index = ctx['safra_index']
    series = ctx['series']

    # --- Resumo por safra (sempre as 4, para contexto) ---
    safras_summary = []
    for parte in range(4):
        d_a, d_b = _safra_bounds(y, m, parte)
        y1, m1 = _shift_month(y, m, 1)
        y2, m2 = _shift_month(y, m, 2)
        d_a1, d_b1 = _safra_bounds(y1, m1, parte)
        d_a2, d_b2 = _safra_bounds(y2, m2, parte)
        ranges_m = [(d_a, d_b)]
        ranges_m1 = [(d_a, d_b), (d_a1, d_b1)]
        ranges_m2 = [(d_a, d_b), (d_a1, d_b1), (d_a2, d_b2)]
        safras_summary.append({
            'label': _SAFRA_LABELS_EXPORT[parte],
            'inicio': d_a.isoformat(),
            'fim': d_b.isoformat(),
            'volume': _count_distinct_ocorrencias(cursor, ranges_m, None, False),
            'd30': _count_distinct_ocorrencias(cursor, ranges_m, ['fechado', 'indenizado'], False),
            'd60': _count_distinct_ocorrencias(cursor, ranges_m1, ['fechado', 'indenizado'], False),
            'd90': _count_distinct_ocorrencias(cursor, ranges_m2, ['fechado', 'indenizado'], False),
        })

    # --- Serie para o grafico de barras ---
    series_rows = []
    if safra_index is None:
        # Visao geral: uma linha por safra, uma entrada por serie
        for parte in range(4):
            d_a, d_b = _safra_bounds(y, m, parte)
            ranges_m = [(d_a, d_b)]
            values = {
                'novos': _count_distinct_ocorrencias(cursor, ranges_m, None, desc_novo_only=True),
                'pagos': _count_distinct_ocorrencias(cursor, ranges_m, ['fechado'], False),
                'indenizados': _count_distinct_ocorrencias(cursor, ranges_m, ['indenizado'], False),
            }
            for s in series:
                series_rows.append({
                    'safra': _SAFRA_LABELS_EXPORT[parte],
                    'data': d_a.isoformat(),
                    'serie': _SERIES_LABELS_EXPORT[s],
                    'valor': values[s],
                })
    else:
        d_a, d_b = _safra_bounds(y, m, safra_index)
        daily = _daily_series(cursor, d_a, d_b)
        for i, label in enumerate(daily['barLabels']):
            for s in series:
                series_rows.append({
                    'safra': _SAFRA_LABELS_EXPORT[safra_index],
                    'data': label,
                    'serie': _SERIES_LABELS_EXPORT[s],
                    'valor': daily[s][i],
                })

    # --- Distribuicao (doughnut global) ---
    cursor.execute(
        """
        SELECT CASE
            WHEN DATEDIFF(CURDATE(), v.min_v) BETWEEN 1 AND 30 THEN 'd30'
            WHEN DATEDIFF(CURDATE(), v.min_v) BETWEEN 31 AND 60 THEN 'd60'
            WHEN DATEDIFF(CURDATE(), v.min_v) > 60 THEN 'd90'
            ELSE 'out'
        END AS faixa, COUNT(*) AS n
        FROM (
            SELECT c.id, MIN(par.vencimento) AS min_v
            FROM contrato c
            INNER JOIN parcela par ON par.id_contrato = c.id AND par.status = 'aberto'
            WHERE c.status = 'aberto'
            GROUP BY c.id
            HAVING min_v < CURDATE()
        ) v
        GROUP BY faixa
        """
    )
    dg = {'d30': 0, 'd60': 0, 'd90': 0}
    for r in cursor.fetchall():
        if r['faixa'] in dg:
            dg[r['faixa']] = int(r['n'] or 0)
    faixas_rows = [
        {'faixa': _FAIXA_LABELS_EXPORT[k], 'total': dg[k]}
        for k in ctx['faixas']
    ]

    # --- Contratos envolvidos na selecao ---
    # Monta filtro de datas conforme safra selecionada (ou uniao das 4)
    if safra_index is None:
        date_ranges = [_safra_bounds(y, m, p) for p in range(4)]
    else:
        date_ranges = [_safra_bounds(y, m, safra_index)]

    date_parts = []
    date_params = []
    for d1, d2 in date_ranges:
        date_parts.append('(o.data_arquivo >= %s AND o.data_arquivo <= %s)')
        date_params += [d1.isoformat(), d2.isoformat()]
    where_date = '(' + ' OR '.join(date_parts) + ')'

    status_filters = []
    serie_params = []
    if 'pagos' in series or 'indenizados' in series:
        status_set = []
        if 'pagos' in series: status_set.append('fechado')
        if 'indenizados' in series: status_set.append('indenizado')
        ph = ','.join(['%s'] * len(status_set))
        status_filters.append('(o.status IN (' + ph + '))')
        serie_params += status_set
    if 'novos' in series:
        status_filters.append("(o.status = 'aberto' AND o.descricao LIKE '%%novo%%')")
    where_series = '(' + ' OR '.join(status_filters) + ')' if status_filters else '1=1'

    sql = (
        "SELECT DISTINCT c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
        "       c.valor_credito, c.data_adesao, "
        "       p.nome_completo AS devedor, p.cpf_cnpj AS devedor_cpf_cnpj "
        "FROM ocorrencia o "
        "INNER JOIN contrato c ON c.id = o.id_contrato "
        "LEFT JOIN pessoa p ON p.id = c.id_pessoa "
        f"WHERE {where_date} AND {where_series} "
        "ORDER BY c.grupo, c.cota"
    )
    cursor.execute(sql, tuple(date_params) + tuple(serie_params))
    contratos = _clean_rows(cursor.fetchall())

    return {
        'resumo': safras_summary,
        'series': series_rows,
        'faixas': faixas_rows,
        'contratos': contratos,
    }


def _export_context_labels(ctx):
    safra_lbl = 'Visao geral (todas as safras)' if ctx['safra_index'] is None else _SAFRA_LABELS_EXPORT[ctx['safra_index']]
    series_lbl = ', '.join(_SERIES_LABELS_EXPORT[s] for s in ctx['series'])
    faixas_lbl = ', '.join(_FAIXA_LABELS_EXPORT[f] for f in ctx['faixas'])
    return safra_lbl, series_lbl, faixas_lbl


def _export_to_xlsx(ctx, dataset):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    wb = Workbook()
    header_font = Font(bold=True, color='FFFFFF', size=11)
    header_fill = PatternFill(start_color='3B82F6', end_color='3B82F6', fill_type='solid')
    header_align = Alignment(horizontal='center', vertical='center')
    thin = Side(style='thin', color='D1D5DB')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    def _write_sheet(ws, headers, rows):
        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = border
        for row_idx, r in enumerate(rows, start=2):
            for col_idx, val in enumerate(r, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.border = border
        for col_idx, h in enumerate(headers, start=1):
            max_len = len(str(h))
            for row_idx in range(2, 2 + len(rows)):
                v = ws.cell(row=row_idx, column=col_idx).value
                max_len = max(max_len, len(str(v)) if v is not None else 0)
            ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = min(max_len + 4, 40)

    # Aba 1: Contexto
    ws0 = wb.active
    ws0.title = 'Parametros'
    safra_lbl, series_lbl, faixas_lbl = _export_context_labels(ctx)
    ws0['A1'] = 'Parametros da exportacao'
    ws0['A1'].font = Font(bold=True, size=13)
    info = [
        ('Mes/Ano', ctx['mes']),
        ('Safra em analise', safra_lbl),
        ('Series selecionadas', series_lbl),
        ('Faixas de atraso', faixas_lbl),
        ('Gerado em', datetime.datetime.now().strftime('%d/%m/%Y %H:%M')),
    ]
    for i, (k, v) in enumerate(info, start=3):
        ws0.cell(row=i, column=1, value=k).font = Font(bold=True)
        ws0.cell(row=i, column=2, value=v)
    ws0.column_dimensions['A'].width = 24
    ws0.column_dimensions['B'].width = 60

    # Aba 2: Resumo das safras
    ws1 = wb.create_sheet('Resumo Safras')
    _write_sheet(
        ws1,
        ['Safra', 'Inicio', 'Fim', 'Volume', 'Ate 30 dias', 'Ate 60 dias', 'Ate 90 dias'],
        [[r['label'], r['inicio'], r['fim'], r['volume'], r['d30'], r['d60'], r['d90']]
         for r in dataset['resumo']],
    )

    # Aba 3: Series (tidy long-format, ideal para PowerBI tambem)
    ws2 = wb.create_sheet('Series Graficas')
    _write_sheet(
        ws2,
        ['Safra', 'Data/Dia', 'Serie', 'Valor'],
        [[r['safra'], r['data'], r['serie'], r['valor']] for r in dataset['series']],
    )

    # Aba 4: Distribuicao
    ws3 = wb.create_sheet('Faixas de Atraso')
    _write_sheet(
        ws3,
        ['Faixa', 'Total de contratos'],
        [[r['faixa'], r['total']] for r in dataset['faixas']],
    )

    # Aba 5: Contratos selecionados
    ws4 = wb.create_sheet('Contratos')
    contratos = dataset['contratos']
    headers = ['ID', 'Grupo', 'Cota', 'Nro Contrato', 'Status', 'Valor do Credito',
               'Data de Adesao', 'Devedor', 'CPF/CNPJ']
    keys = ['id', 'grupo', 'cota', 'numero_contrato', 'status', 'valor_credito',
            'data_adesao', 'devedor', 'devedor_cpf_cnpj']
    _write_sheet(ws4, headers, [[c.get(k, '') for k in keys] for c in contratos])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _export_to_csv_powerbi(ctx, dataset):
    """Gera um .csv tidy long-format otimizado para 'Get Data -> Text/CSV' no Power BI.

    Cada linha descreve uma observacao unica com as dimensoes necessarias.
    """
    import csv

    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=';')
    # Cabecalho com metadados (PowerBI ignora e o usuario entende)
    safra_lbl, series_lbl, faixas_lbl = _export_context_labels(ctx)
    writer.writerow(['# Performance JB - export Power BI'])
    writer.writerow(['# Mes/Ano', ctx['mes']])
    writer.writerow(['# Safra', safra_lbl])
    writer.writerow(['# Series', series_lbl])
    writer.writerow(['# Faixas', faixas_lbl])
    writer.writerow(['# Gerado em', datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow([])

    # Tabela 1 - Series (tidy)
    writer.writerow(['tabela', 'safra', 'data', 'serie', 'valor'])
    for r in dataset['series']:
        writer.writerow(['series', r['safra'], r['data'], r['serie'], r['valor']])

    # Tabela 2 - Resumo safras
    for r in dataset['resumo']:
        writer.writerow(['resumo_safra', r['label'], r['inicio'], 'volume', r['volume']])
        writer.writerow(['resumo_safra', r['label'], r['inicio'], 'd30', r['d30']])
        writer.writerow(['resumo_safra', r['label'], r['inicio'], 'd60', r['d60']])
        writer.writerow(['resumo_safra', r['label'], r['inicio'], 'd90', r['d90']])

    # Tabela 3 - Faixas
    for r in dataset['faixas']:
        writer.writerow(['faixas', '-', '-', r['faixa'], r['total']])

    # Tabela 4 - Contratos
    for c in dataset['contratos']:
        writer.writerow([
            'contratos',
            str(c.get('grupo') or '') + '/' + str(c.get('cota') or ''),
            c.get('data_adesao') or '',
            c.get('status') or '',
            c.get('valor_credito') or 0,
            c.get('devedor') or '',
            c.get('devedor_cpf_cnpj') or '',
            c.get('numero_contrato') or '',
        ])

    data = buf.getvalue().encode('utf-8-sig')  # BOM para Power BI detectar UTF-8
    out = io.BytesIO(data)
    out.seek(0)
    return out


def _decode_data_url_png(data_url):
    """Aceita 'data:image/png;base64,xxxx' -> bytes. Retorna None se invalido."""
    import base64
    if not data_url or ',' not in data_url:
        return None
    try:
        _, b64 = data_url.split(',', 1)
        return base64.b64decode(b64)
    except Exception:
        return None


def _export_to_pdf(ctx, dataset):
    from fpdf import FPDF

    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    safra_lbl, series_lbl, faixas_lbl = _export_context_labels(ctx)

    # Cabecalho
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, 'Performance JB - Relatorio Exportado', ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, 'Mes/Ano: ' + ctx['mes'] + '   |   Safra: ' + safra_lbl, ln=True, align='C')
    pdf.cell(0, 6, 'Series: ' + series_lbl, ln=True, align='C')
    pdf.cell(0, 6, 'Faixas: ' + faixas_lbl, ln=True, align='C')
    pdf.cell(0, 6, 'Gerado em ' + datetime.datetime.now().strftime('%d/%m/%Y %H:%M'), ln=True, align='C')
    pdf.ln(4)

    # Graficos (imagens vindas do client)
    tmp_files = []
    try:
        bar_bytes = _decode_data_url_png(ctx['bar_image'])
        pie_bytes = _decode_data_url_png(ctx['pie_image'])

        page_w = pdf.w - 2 * pdf.l_margin
        if bar_bytes and pie_bytes:
            tf_bar = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tf_bar.write(bar_bytes); tf_bar.close(); tmp_files.append(tf_bar.name)
            tf_pie = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tf_pie.write(pie_bytes); tf_pie.close(); tmp_files.append(tf_pie.name)
            img_h = 75
            col_w = (page_w - 6) / 2
            y0 = pdf.get_y()
            pdf.image(tf_bar.name, x=pdf.l_margin, y=y0, w=col_w, h=img_h)
            pdf.image(tf_pie.name, x=pdf.l_margin + col_w + 6, y=y0, w=col_w, h=img_h)
            pdf.set_y(y0 + img_h + 6)
        elif bar_bytes:
            tf_bar = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tf_bar.write(bar_bytes); tf_bar.close(); tmp_files.append(tf_bar.name)
            pdf.image(tf_bar.name, x=pdf.l_margin, w=page_w, h=90)
            pdf.ln(4)

        # Tabela: Resumo das safras
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 7, 'Resumo das safras', ln=True)
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_fill_color(59, 130, 246); pdf.set_text_color(255, 255, 255)
        headers = ['Safra', 'Inicio', 'Fim', 'Volume', 'Ate 30d', 'Ate 60d', 'Ate 90d']
        col_w = [70, 30, 30, 25, 30, 30, 30]
        for i, h in enumerate(headers):
            pdf.cell(col_w[i], 7, h, border=1, align='C', fill=True)
        pdf.ln()
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(30, 41, 59)
        for idx, r in enumerate(dataset['resumo']):
            fill = idx % 2 == 1
            if fill: pdf.set_fill_color(248, 250, 252)
            else: pdf.set_fill_color(255, 255, 255)
            vals = [r['label'], r['inicio'], r['fim'], r['volume'], r['d30'], r['d60'], r['d90']]
            for i, v in enumerate(vals):
                pdf.cell(col_w[i], 7, str(v), border=1, align='C', fill=True)
            pdf.ln()
        pdf.ln(4)

        # Tabela: Contratos (ate 300)
        contratos = dataset['contratos'][:300]
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 7, 'Contratos selecionados (' + str(len(dataset['contratos'])) + ' total, mostrando ' + str(len(contratos)) + ')', ln=True)
        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_fill_color(59, 130, 246); pdf.set_text_color(255, 255, 255)
        ch = ['Grupo/Cota', 'Nro Contrato', 'Status', 'Valor Credito', 'Adesao', 'Devedor', 'CPF/CNPJ']
        cw = [28, 32, 22, 32, 24, 90, 40]
        for i, h in enumerate(ch):
            pdf.cell(cw[i], 6, h, border=1, align='C', fill=True)
        pdf.ln()
        pdf.set_font('Helvetica', '', 7)
        pdf.set_text_color(30, 41, 59)
        for idx, c in enumerate(contratos):
            fill = idx % 2 == 1
            if fill: pdf.set_fill_color(248, 250, 252)
            else: pdf.set_fill_color(255, 255, 255)
            valor = c.get('valor_credito')
            try:
                valor_fmt = 'R$ ' + f"{float(valor):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            except Exception:
                valor_fmt = str(valor or '-')
            row = [
                str(c.get('grupo') or '') + '/' + str(c.get('cota') or ''),
                str(c.get('numero_contrato') or '-'),
                str(c.get('status') or '-'),
                valor_fmt,
                str(c.get('data_adesao') or '-'),
                (str(c.get('devedor') or '-'))[:50],
                str(c.get('devedor_cpf_cnpj') or '-'),
            ]
            for i, v in enumerate(row):
                pdf.cell(cw[i], 6, v, border=1, align='C', fill=True)
            pdf.ln()

        buf = io.BytesIO()
        pdf.output(buf)
        buf.seek(0)
        return buf
    finally:
        for p in tmp_files:
            try: os.unlink(p)
            except Exception: pass


@app.route('/api/performance/export/<formato>', methods=['POST'])
def api_performance_export(formato):
    formato = (formato or '').lower()
    if formato not in ('xlsx', 'pdf', 'powerbi'):
        return jsonify({'error': 'formato invalido'}), 400

    ctx, err = _resolve_export_payload()
    if err:
        return jsonify({'error': err}), 400

    conn = _get_db()
    cursor = conn.cursor()
    try:
        dataset = _fetch_export_dataset(cursor, ctx)
    finally:
        cursor.close()
        conn.close()

    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M')
    safra_slug = 'geral' if ctx['safra_index'] is None else 'safra' + str(ctx['safra_index'] + 1)
    base = f'performance_{ctx["mes"]}_{safra_slug}_{ts}'

    if formato == 'xlsx':
        buf = _export_to_xlsx(ctx, dataset)
        return send_file(buf, as_attachment=True, download_name=base + '.xlsx',
                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    if formato == 'pdf':
        buf = _export_to_pdf(ctx, dataset)
        return send_file(buf, as_attachment=True, download_name=base + '.pdf',
                         mimetype='application/pdf')
    # powerbi -> csv
    buf = _export_to_csv_powerbi(ctx, dataset)
    return send_file(buf, as_attachment=True, download_name=base + '_powerbi.csv',
                     mimetype='text/csv')


# ---------------------------------------------------------------------------
# API: Dashboard — exportacao (xlsx / pdf / powerbi)
# ---------------------------------------------------------------------------

_DASH_SERIES_LABELS = {
    'pagos':       'Contratos Pagos',
    'indenizados': 'Contratos Indenizados',
    'novos':       'Contratos Novos',
    'retomados':   'Contratos que Voltaram',
}
_DASH_SERIES_WHERE = {
    'pagos':       ("o.status = 'fechado'", []),
    'indenizados': ("o.status = 'indenizado'", []),
    'novos':       ("o.descricao = 'contrato novo'", []),
    'retomados':   ("o.descricao = 'contrato voltou'", []),
}
_DASH_PIE_LABELS = {
    'aberto':     'Em Cobranca',
    'fechado':    'Pagos',
    'indenizado': 'Indenizados',
}


def _month_range_from_yyyymm(ym_start, ym_end):
    """Aceita 'YYYY-MM' start e end (inclusivo) -> lista de meses em ordem."""
    def _parse(ym):
        y, m = int(ym[:4]), int(ym[5:7])
        return y, m
    y1, m1 = _parse(ym_start)
    y2, m2 = _parse(ym_end)
    out = []
    while (y1, m1) <= (y2, m2):
        out.append(f'{y1:04d}-{m1:02d}')
        if m1 == 12:
            y1, m1 = y1 + 1, 1
        else:
            m1 += 1
    return out


def _last_day_of(y, m):
    return calendar.monthrange(y, m)[1]


def _resolve_dash_export_payload():
    payload = request.get_json(silent=True) or {}
    ps = str(payload.get('period_start', '')).strip()
    pe = str(payload.get('period_end', '')).strip()
    try:
        if not ps or not pe or len(ps) < 7 or len(pe) < 7:
            raise ValueError
        y1, m1 = int(ps[:4]), int(ps[5:7])
        y2, m2 = int(pe[:4]), int(pe[5:7])
        datetime.date(y1, m1, 1)
        datetime.date(y2, m2, 1)
        if (y1, m1) > (y2, m2):
            ps, pe = pe, ps
    except (TypeError, ValueError):
        return None, 'Periodo invalido (period_start / period_end no formato YYYY-MM)'

    series = [s for s in (payload.get('series') or []) if s in _DASH_SERIES_LABELS]
    if not series:
        series = ['pagos', 'indenizados']

    pie = [p for p in (payload.get('pie') or []) if p in _DASH_PIE_LABELS]
    if not pie:
        pie = list(_DASH_PIE_LABELS.keys())

    return {
        'period_start': ps,
        'period_end': pe,
        'series': series,
        'pie': pie,
        'line_image': payload.get('line_image') or '',
        'pie_image': payload.get('pie_image') or '',
    }, None


def _fetch_dash_export_dataset(cursor, ctx):
    try:
        _ensure_cobranca_table(cursor)
    except Exception:
        app.logger.exception('_fetch_dash_export: falha ao garantir tabela cobranca')

    meses = _month_range_from_yyyymm(ctx['period_start'], ctx['period_end'])

    # --- Series mensais (long format / tidy) ---
    series_rows = []
    # SQL date window
    y1, m1 = int(ctx['period_start'][:4]), int(ctx['period_start'][5:7])
    y2, m2 = int(ctx['period_end'][:4]), int(ctx['period_end'][5:7])
    d_ini = datetime.date(y1, m1, 1).isoformat()
    d_fim = datetime.date(y2, m2, _last_day_of(y2, m2)).isoformat()

    series_totals = {}  # key -> total no periodo
    series_by_month = {}  # key -> {mes: count}

    for key in ctx['series']:
        where, params = _DASH_SERIES_WHERE[key]
        cursor.execute(
            "SELECT DATE_FORMAT(o.data_arquivo, '%%Y-%%m') AS mes, "
            "       COUNT(DISTINCT o.id_contrato) AS total "
            "FROM ocorrencia o "
            f"WHERE {where} "
            "AND o.data_arquivo >= %s AND o.data_arquivo <= %s "
            "GROUP BY mes ORDER BY mes",
            tuple(params) + (d_ini, d_fim),
        )
        by_m = {r['mes']: int(r['total']) for r in cursor.fetchall()}
        series_by_month[key] = by_m
        series_totals[key] = sum(by_m.values())
        for mes in meses:
            series_rows.append({
                'mes': mes,
                'serie': _DASH_SERIES_LABELS[key],
                'valor': by_m.get(mes, 0),
            })

    # --- Pie chart (distribuicao global atual) ---
    cursor.execute("SELECT status, COUNT(*) AS total FROM contrato GROUP BY status")
    pie_raw = {r['status']: int(r['total']) for r in cursor.fetchall()}
    pie_rows = [
        {'status': _DASH_PIE_LABELS[k], 'total': pie_raw.get(k, 0)}
        for k in ctx['pie']
    ]

    # --- KPIs do periodo: Em Cobranca = snapshot `cobranca` (ultimo dia GM) ---
    data_dash_ref = _get_data_referencia_arquivos_gm(cursor)
    em_cobranca = _em_cobranca_count_por_data_ref(cursor, data_dash_ref)
    kpis = {'em_cobranca': em_cobranca}
    for k in ctx['series']:
        kpis[k] = series_totals.get(k, 0)

    # --- Contratos envolvidos (ocorrencias no periodo x series selecionadas) ---
    # Monta um WHERE que combine todos os filtros das series ativas com OR.
    or_parts = []
    or_params = []
    for k in ctx['series']:
        where, params = _DASH_SERIES_WHERE[k]
        or_parts.append('(' + where + ')')
        or_params += params
    where_series = '(' + ' OR '.join(or_parts) + ')' if or_parts else '1=0'

    sql = (
        "SELECT DISTINCT c.id, c.grupo, c.cota, c.numero_contrato, c.status, "
        "       c.valor_credito, c.data_adesao, "
        "       p.nome_completo AS devedor, p.cpf_cnpj AS devedor_cpf_cnpj "
        "FROM ocorrencia o "
        "INNER JOIN contrato c ON c.id = o.id_contrato "
        "LEFT JOIN pessoa p ON p.id = c.id_pessoa "
        f"WHERE {where_series} "
        "AND o.data_arquivo >= %s AND o.data_arquivo <= %s "
        "ORDER BY c.grupo, c.cota"
    )
    cursor.execute(sql, tuple(or_params) + (d_ini, d_fim))
    contratos = _clean_rows(cursor.fetchall())

    return {
        'meses': meses,
        'series_rows': series_rows,
        'pie_rows': pie_rows,
        'kpis': kpis,
        'contratos': contratos,
    }


def _dash_export_context_labels(ctx):
    series_lbl = ', '.join(_DASH_SERIES_LABELS[s] for s in ctx['series'])
    pie_lbl = ', '.join(_DASH_PIE_LABELS[p] for p in ctx['pie'])
    periodo_lbl = ctx['period_start'] + ' a ' + ctx['period_end']
    return series_lbl, pie_lbl, periodo_lbl


def _dash_export_to_xlsx(ctx, dataset):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    wb = Workbook()
    header_font = Font(bold=True, color='FFFFFF', size=11)
    header_fill = PatternFill(start_color='3B82F6', end_color='3B82F6', fill_type='solid')
    header_align = Alignment(horizontal='center', vertical='center')
    thin = Side(style='thin', color='D1D5DB')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    def _write_sheet(ws, headers, rows):
        for col_idx, h in enumerate(headers, start=1):
            cell = ws.cell(row=1, column=col_idx, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = border
        for row_idx, r in enumerate(rows, start=2):
            for col_idx, val in enumerate(r, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=val)
                cell.border = border
        for col_idx, h in enumerate(headers, start=1):
            max_len = len(str(h))
            for row_idx in range(2, 2 + len(rows)):
                v = ws.cell(row=row_idx, column=col_idx).value
                max_len = max(max_len, len(str(v)) if v is not None else 0)
            ws.column_dimensions[ws.cell(row=1, column=col_idx).column_letter].width = min(max_len + 4, 40)

    ws0 = wb.active
    ws0.title = 'Parametros'
    series_lbl, pie_lbl, periodo_lbl = _dash_export_context_labels(ctx)
    ws0['A1'] = 'Parametros da exportacao (Dashboard)'
    ws0['A1'].font = Font(bold=True, size=13)
    info = [
        ('Periodo', periodo_lbl),
        ('Series comparadas', series_lbl),
        ('Distribuicao (pizza)', pie_lbl),
        ('Gerado em', datetime.datetime.now().strftime('%d/%m/%Y %H:%M')),
    ]
    for i, (k, v) in enumerate(info, start=3):
        ws0.cell(row=i, column=1, value=k).font = Font(bold=True)
        ws0.cell(row=i, column=2, value=v)
    ws0.column_dimensions['A'].width = 24
    ws0.column_dimensions['B'].width = 60

    ws1 = wb.create_sheet('KPIs')
    k = dataset['kpis']
    kpi_headers = ['KPI', 'Valor']
    kpi_rows = [['Em Cobranca (atual)', k.get('em_cobranca', 0)]]
    for key in ctx['series']:
        kpi_rows.append([_DASH_SERIES_LABELS[key] + ' (periodo)', k.get(key, 0)])
    _write_sheet(ws1, kpi_headers, kpi_rows)

    ws2 = wb.create_sheet('Series Evolucao')
    _write_sheet(ws2, ['Mes', 'Serie', 'Valor'],
                 [[r['mes'], r['serie'], r['valor']] for r in dataset['series_rows']])

    ws3 = wb.create_sheet('Distribuicao Carteira')
    _write_sheet(ws3, ['Status', 'Total'], [[r['status'], r['total']] for r in dataset['pie_rows']])

    ws4 = wb.create_sheet('Contratos')
    headers = ['ID', 'Grupo', 'Cota', 'Nro Contrato', 'Status', 'Valor do Credito',
               'Data de Adesao', 'Devedor', 'CPF/CNPJ']
    keys = ['id', 'grupo', 'cota', 'numero_contrato', 'status', 'valor_credito',
            'data_adesao', 'devedor', 'devedor_cpf_cnpj']
    _write_sheet(ws4, headers, [[c.get(kk, '') for kk in keys] for c in dataset['contratos']])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _dash_export_to_csv_powerbi(ctx, dataset):
    import csv
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=';')
    series_lbl, pie_lbl, periodo_lbl = _dash_export_context_labels(ctx)
    writer.writerow(['# Dashboard JB - export Power BI'])
    writer.writerow(['# Periodo', periodo_lbl])
    writer.writerow(['# Series', series_lbl])
    writer.writerow(['# Distribuicao', pie_lbl])
    writer.writerow(['# Gerado em', datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
    writer.writerow([])

    # Tabela series (tidy long-format)
    writer.writerow(['tabela', 'mes', 'serie', 'valor'])
    for r in dataset['series_rows']:
        writer.writerow(['series', r['mes'], r['serie'], r['valor']])

    # KPIs
    writer.writerow(['kpi', '-', 'Em Cobranca (atual)', dataset['kpis'].get('em_cobranca', 0)])
    for key in ctx['series']:
        writer.writerow(['kpi', '-', _DASH_SERIES_LABELS[key] + ' (periodo)', dataset['kpis'].get(key, 0)])

    # Pie
    for r in dataset['pie_rows']:
        writer.writerow(['pie', '-', r['status'], r['total']])

    # Contratos
    for c in dataset['contratos']:
        writer.writerow([
            'contratos',
            str(c.get('grupo') or '') + '/' + str(c.get('cota') or ''),
            c.get('data_adesao') or '',
            c.get('status') or '',
            c.get('valor_credito') or 0,
            c.get('devedor') or '',
            c.get('devedor_cpf_cnpj') or '',
            c.get('numero_contrato') or '',
        ])

    data = buf.getvalue().encode('utf-8-sig')
    out = io.BytesIO(data)
    out.seek(0)
    return out


def _dash_export_to_pdf(ctx, dataset):
    from fpdf import FPDF

    pdf = FPDF(orientation='L', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    series_lbl, pie_lbl, periodo_lbl = _dash_export_context_labels(ctx)

    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, 'Dashboard JB - Relatorio Exportado', ln=True, align='C')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, 'Periodo: ' + periodo_lbl, ln=True, align='C')
    pdf.cell(0, 6, 'Series: ' + series_lbl, ln=True, align='C')
    pdf.cell(0, 6, 'Distribuicao: ' + pie_lbl, ln=True, align='C')
    pdf.cell(0, 6, 'Gerado em ' + datetime.datetime.now().strftime('%d/%m/%Y %H:%M'), ln=True, align='C')
    pdf.ln(4)

    tmp_files = []
    try:
        line_bytes = _decode_data_url_png(ctx['line_image'])
        pie_bytes = _decode_data_url_png(ctx['pie_image'])

        page_w = pdf.w - 2 * pdf.l_margin
        if line_bytes and pie_bytes:
            tf_l = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tf_l.write(line_bytes); tf_l.close(); tmp_files.append(tf_l.name)
            tf_p = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tf_p.write(pie_bytes); tf_p.close(); tmp_files.append(tf_p.name)
            img_h = 75
            col_w = (page_w - 6) / 2
            y0 = pdf.get_y()
            pdf.image(tf_l.name, x=pdf.l_margin, y=y0, w=col_w, h=img_h)
            pdf.image(tf_p.name, x=pdf.l_margin + col_w + 6, y=y0, w=col_w, h=img_h)
            pdf.set_y(y0 + img_h + 6)
        elif line_bytes:
            tf_l = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tf_l.write(line_bytes); tf_l.close(); tmp_files.append(tf_l.name)
            pdf.image(tf_l.name, x=pdf.l_margin, w=page_w, h=90)
            pdf.ln(4)

        # KPIs
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 7, 'KPIs', ln=True)
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_fill_color(59, 130, 246); pdf.set_text_color(255, 255, 255)
        kpi_headers = ['KPI', 'Valor']
        kcw = [200, 45]
        for i, h in enumerate(kpi_headers):
            pdf.cell(kcw[i], 7, h, border=1, align='C', fill=True)
        pdf.ln()
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(30, 41, 59)
        kpi_items = [('Em Cobranca (atual)', dataset['kpis'].get('em_cobranca', 0))]
        for key in ctx['series']:
            kpi_items.append((_DASH_SERIES_LABELS[key] + ' (periodo)', dataset['kpis'].get(key, 0)))
        for idx, (lab, val) in enumerate(kpi_items):
            fill = idx % 2 == 1
            pdf.set_fill_color(248 if fill else 255, 250 if fill else 255, 252 if fill else 255)
            pdf.cell(kcw[0], 7, str(lab), border=1, align='L', fill=True)
            pdf.cell(kcw[1], 7, str(val), border=1, align='C', fill=True)
            pdf.ln()
        pdf.ln(4)

        # Contratos (ate 300)
        contratos = dataset['contratos'][:300]
        pdf.set_font('Helvetica', 'B', 11)
        pdf.cell(0, 7, 'Contratos envolvidos (' + str(len(dataset['contratos'])) + ' total, mostrando ' + str(len(contratos)) + ')', ln=True)
        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_fill_color(59, 130, 246); pdf.set_text_color(255, 255, 255)
        ch = ['Grupo/Cota', 'Nro Contrato', 'Status', 'Valor Credito', 'Adesao', 'Devedor', 'CPF/CNPJ']
        cw = [28, 32, 22, 32, 24, 90, 40]
        for i, h in enumerate(ch):
            pdf.cell(cw[i], 6, h, border=1, align='C', fill=True)
        pdf.ln()
        pdf.set_font('Helvetica', '', 7)
        pdf.set_text_color(30, 41, 59)
        for idx, c in enumerate(contratos):
            fill = idx % 2 == 1
            pdf.set_fill_color(248 if fill else 255, 250 if fill else 255, 252 if fill else 255)
            valor = c.get('valor_credito')
            try:
                valor_fmt = 'R$ ' + f"{float(valor):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
            except Exception:
                valor_fmt = str(valor or '-')
            row = [
                str(c.get('grupo') or '') + '/' + str(c.get('cota') or ''),
                str(c.get('numero_contrato') or '-'),
                str(c.get('status') or '-'),
                valor_fmt,
                str(c.get('data_adesao') or '-'),
                (str(c.get('devedor') or '-'))[:50],
                str(c.get('devedor_cpf_cnpj') or '-'),
            ]
            for i, v in enumerate(row):
                pdf.cell(cw[i], 6, v, border=1, align='C', fill=True)
            pdf.ln()

        buf = io.BytesIO()
        pdf.output(buf)
        buf.seek(0)
        return buf
    finally:
        for p in tmp_files:
            try: os.unlink(p)
            except Exception: pass


@app.route('/api/dashboard/export/<formato>', methods=['POST'])
def api_dashboard_export(formato):
    formato = (formato or '').lower()
    if formato not in ('xlsx', 'pdf', 'powerbi'):
        return jsonify({'error': 'formato invalido'}), 400

    ctx, err = _resolve_dash_export_payload()
    if err:
        return jsonify({'error': err}), 400

    conn = _get_db()
    cursor = conn.cursor()
    try:
        dataset = _fetch_dash_export_dataset(cursor, ctx)
    finally:
        cursor.close()
        conn.close()

    ts = datetime.datetime.now().strftime('%Y%m%d_%H%M')
    base = f'dashboard_{ctx["period_start"]}_a_{ctx["period_end"]}_{ts}'

    if formato == 'xlsx':
        buf = _dash_export_to_xlsx(ctx, dataset)
        return send_file(buf, as_attachment=True, download_name=base + '.xlsx',
                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    if formato == 'pdf':
        buf = _dash_export_to_pdf(ctx, dataset)
        return send_file(buf, as_attachment=True, download_name=base + '.pdf',
                         mimetype='application/pdf')
    buf = _dash_export_to_csv_powerbi(ctx, dataset)
    return send_file(buf, as_attachment=True, download_name=base + '_powerbi.csv',
                     mimetype='text/csv')


# ==========================================
# AGENDA
# ==========================================
@app.route('/api/funcionarios', methods=['GET'])
def api_funcionarios():
    conn = _get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, nome FROM funcionario WHERE ativo = 1 ORDER BY nome")
        funcis = cursor.fetchall()
        return jsonify(funcis)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/funcionario/perfil', methods=['GET'])
def api_funcionario_perfil():
    """Dados do funcionário logado (sem id, senha nem foto)."""
    fid = session.get('funcionario_id')
    if not fid:
        return jsonify({'error': 'Não autenticado'}), 401
    conn = None
    try:
        conn = _get_db()
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT nome, data_nascimento, cpf_cnpj, ativo, created_at, updated_at,
                       login, acesso_externo, email, ddd, numero, logradouro, bairro,
                       complemento, cep, cidade, estado, departamento, nivel_acesso,
                       sexo, matricula
                FROM funcionario WHERE id = %s
                """,
                (int(fid),),
            )
            row = cursor.fetchone()
    except Exception as e:
        app.logger.exception('api_funcionario_perfil')
        return jsonify({'error': str(e)}), 500
    finally:
        if conn is not None:
            conn.close()
    if not row:
        return jsonify({'error': 'Funcionário não encontrado.'}), 404
    return jsonify({'funcionario': _clean_row(row)})


@app.route('/api/agenda', methods=['GET', 'POST'])
def api_agenda():
    conn = _get_db()
    cursor = conn.cursor()
    try:
        if request.method == 'GET':
            month = request.args.get('month')
            year = request.args.get('year')
            
            where = "1=1"
            params = []
            if month and year:
                where = "MONTH(a.data) = %s AND YEAR(a.data) = %s"
                params = [int(month), int(year)]
            
            query = f"""
                SELECT a.*, f.nome as funcionario_nome, c.numero_contrato, c.grupo, c.cota 
                FROM agenda a
                LEFT JOIN funcionario f ON a.id_funcionario = f.id
                LEFT JOIN contrato c ON a.id_contrato = c.id
                WHERE {where}
                ORDER BY a.data ASC
            """
            cursor.execute(query, params)
            tarefas = cursor.fetchall()
            for t in tarefas:
                t['data'] = t['data'].isoformat() if t['data'] else None
            return jsonify(tarefas)

        if request.method == 'POST':
            data = request.json
            atividade = data.get('atividade')
            descricao = data.get('descricao', '')
            data_agenda = data.get('data') # "YYYY-MM-DDTHH:MM" format
            prioridade = data.get('prioridade', 'media')
            id_funcionario = data.get('id_funcionario')
            grupo_cota = data.get('grupo_cota', '').strip()
            
            id_contrato = None
            if grupo_cota:
                parts = tuple(p.strip() for p in grupo_cota.replace('-', '/').split('/', 1))
                if len(parts) == 2:
                    cursor.execute("SELECT id FROM contrato WHERE grupo = %s AND cota = %s", parts)
                    c_row = cursor.fetchone()
                    if c_row:
                        id_contrato = c_row['id']
                    else:
                        return jsonify({'error': 'Contrato com Grupo/Cota informado não foi encontrado.'}), 404
                else:
                    return jsonify({'error': 'Formato de Contrato inválido. Use Grupo/Cota (ex: 50A/0101)'}), 400

            sql = """INSERT INTO agenda 
                     (atividade, descricao, data, prioridade, id_contrato, id_funcionario) 
                     VALUES (%s, %s, %s, %s, %s, %s)"""
            cursor.execute(sql, (atividade, descricao, data_agenda, prioridade, id_contrato, id_funcionario))
            conn.commit()
            return jsonify({'success': True, 'id': cursor.lastrowid})

    except Exception as e:
        app.logger.error("api_agenda error: %s", str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/agenda/<int:id_agenda>', methods=['PATCH', 'DELETE'])
def api_agenda_item(id_agenda):
    conn = _get_db()
    cursor = conn.cursor()
    try:
        if request.method == 'PATCH':
            data = request.json
            status = data.get('status')
            if status in ('pendente', 'concluido'):
                cursor.execute("UPDATE agenda SET status = %s WHERE id = %s", (status, id_agenda))
                conn.commit()
                return jsonify({'success': True})
            return jsonify({'error': 'status invalid'}), 400
        
        elif request.method == 'DELETE':
            cursor.execute("DELETE FROM agenda WHERE id = %s", (id_agenda,))
            conn.commit()
            return jsonify({'success': True})
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        conn.close()


# =============================================================================
# Mural de Avisos (persistencia em JSON, pasta data/)
# =============================================================================

_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
_AVISOS_FILE = os.path.join(_DATA_DIR, 'avisos.json')


def _avisos_load():
    """Le a lista de avisos do arquivo JSON. Cria seed na 1a execucao."""
    if not os.path.isdir(_DATA_DIR):
        os.makedirs(_DATA_DIR, exist_ok=True)
    if not os.path.isfile(_AVISOS_FILE):
        hoje = datetime.date.today()
        seed = [
            {
                'id': 1,
                'titulo': 'Nova Politica de Juros',
                'descricao': 'Atualizacao nas planilhas de calculo exigidas para grupos GM.',
                'data_iso': hoje.isoformat(),
            },
            {
                'id': 2,
                'titulo': 'Manutencao no Servidor',
                'descricao': 'Agendada uma breve pausa no servidor neste domingo, as 02h.',
                'data_iso': (hoje - datetime.timedelta(days=1)).isoformat(),
            },
            {
                'id': 3,
                'titulo': 'Fechamento Mensal',
                'descricao': 'Lembrete: Os arquivos de repasse devem ser consolidados ate o dia 15.',
                'data_iso': (hoje - datetime.timedelta(days=10)).isoformat(),
            },
        ]
        _avisos_save(seed)
        return seed
    try:
        with open(_AVISOS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        return []
    except Exception:
        return []


def _avisos_save(lista):
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp = _AVISOS_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(lista, f, ensure_ascii=False, indent=2)
    os.replace(tmp, _AVISOS_FILE)


def _avisos_next_id(lista):
    if not lista:
        return 1
    return max(int(a.get('id') or 0) for a in lista) + 1


def _avisos_sorted(lista):
    """Ordena por data_iso desc (mais recentes primeiro)."""
    return sorted(
        lista,
        key=lambda a: (a.get('data_iso') or '', a.get('id') or 0),
        reverse=True,
    )


@app.route('/api/avisos', methods=['GET', 'POST'])
def api_avisos_collection():
    if request.method == 'GET':
        return jsonify(_avisos_sorted(_avisos_load()))

    payload = request.get_json(silent=True) or {}
    titulo = (payload.get('titulo') or '').strip()
    descricao = (payload.get('descricao') or '').strip()
    data_iso = (payload.get('data_iso') or '').strip()

    if not titulo:
        return jsonify({'error': 'titulo obrigatorio'}), 400
    if not data_iso:
        data_iso = datetime.date.today().isoformat()
    try:
        datetime.date.fromisoformat(data_iso)
    except ValueError:
        return jsonify({'error': 'data_iso invalida (formato YYYY-MM-DD)'}), 400

    lista = _avisos_load()
    novo = {
        'id': _avisos_next_id(lista),
        'titulo': titulo,
        'descricao': descricao,
        'data_iso': data_iso,
        'created_at': datetime.datetime.now().isoformat(timespec='seconds'),
        'updated_at': datetime.datetime.now().isoformat(timespec='seconds'),
    }
    lista.append(novo)
    _avisos_save(lista)
    return jsonify(novo), 201


@app.route('/api/avisos/<int:aviso_id>', methods=['PUT', 'DELETE'])
def api_avisos_item(aviso_id):
    lista = _avisos_load()
    idx = next((i for i, a in enumerate(lista) if int(a.get('id') or 0) == aviso_id), -1)
    if idx < 0:
        return jsonify({'error': 'aviso nao encontrado'}), 404

    if request.method == 'DELETE':
        removido = lista.pop(idx)
        _avisos_save(lista)
        return jsonify({'success': True, 'removed': removido})

    payload = request.get_json(silent=True) or {}
    atual = lista[idx]
    if 'titulo' in payload:
        titulo = (payload.get('titulo') or '').strip()
        if not titulo:
            return jsonify({'error': 'titulo obrigatorio'}), 400
        atual['titulo'] = titulo
    if 'descricao' in payload:
        atual['descricao'] = (payload.get('descricao') or '').strip()
    if 'data_iso' in payload:
        data_iso = (payload.get('data_iso') or '').strip()
        try:
            datetime.date.fromisoformat(data_iso)
        except ValueError:
            return jsonify({'error': 'data_iso invalida (formato YYYY-MM-DD)'}), 400
        atual['data_iso'] = data_iso
    atual['updated_at'] = datetime.datetime.now().isoformat(timespec='seconds')
    lista[idx] = atual
    _avisos_save(lista)
    return jsonify(atual)


# =============================================================================
# Negativação (Serasa) - tabela auto-criada na primeira utilização
# -----------------------------------------------------------------------------
# Regra de negocio:
#   * Um contrato se torna ELEGIVEL a negativacao quando sua parcela em aberto
#     mais antiga tem entre 31 e 89 dias de atraso (inclusive).
#   * Uma vez enviado ao Serasa, NAO e re-enviado automaticamente (o usuario
#     tem que expressamente desejar uma nova negativacao -- futuro).
# =============================================================================

def _ensure_negativacao_table(cursor):
    """Cria a tabela `negativacao` se ainda nao existir.

    Negativacao acontece por PARCELA (nao por contrato). `id_parcela` e a
    chave de unicidade: uma parcela so pode ser gravada aqui uma unica
    vez. Isso resolve o bug anterior em que o simples EXISTS por
    id_contrato fazia o contrato aparecer "negativado" indefinidamente,
    mesmo quando a parcela atual em aberto era outra.
    """
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS negativacao (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            id_contrato BIGINT NOT NULL,
            id_parcela  BIGINT NOT NULL,
            numero_parcela INT NULL,
            dias_atraso INT NULL,
            data_negativacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(32) NOT NULL DEFAULT 'enviado',
            resposta_api TEXT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_negativacao_parcela (id_parcela),
            KEY idx_negativacao_contrato (id_contrato),
            CONSTRAINT fk_negativacao_contrato FOREIGN KEY (id_contrato)
                REFERENCES contrato(id) ON DELETE CASCADE,
            CONSTRAINT fk_negativacao_parcela FOREIGN KEY (id_parcela)
                REFERENCES parcela(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


# Registros de `negativacao` muito antigos podem nao ter `id_parcela` (modelo
# por contrato). O sentinel abaixo marca isso no mapa de conjuntos.
_NEG_NULL_PARCELA = object()


def _mapa_parcelas_negativadas_por_contrato(cursor, contrato_ids):
    """{id_contrato: set} onde cada set contem id_parcela (int) e, se
    houver negativacao legada sem parcela, o valor _NEG_NULL_PARCELA.

    Necessario em vez de `WHERE id_parcela IN (lista de alvos desta tela)`:
    essa lista nao abrange parcelas de outros contratos nem linhas cujo
    id_parcela nao e o alvo atual, o que deixava o filtro "Ja negativados"
    vazio apesar de existir negativacao no banco.
    """
    if not contrato_ids:
        return {}
    out = {}
    ph = ','.join(['%s'] * len(contrato_ids))
    cursor.execute(
        f"SELECT id_contrato, id_parcela FROM negativacao "
        f"WHERE id_contrato IN ({ph})",
        list(contrato_ids),
    )
    for row in cursor.fetchall():
        cid = int(row['id_contrato'])
        s = out.setdefault(cid, set())
        if row.get('id_parcela') is None:
            s.add(_NEG_NULL_PARCELA)
        else:
            try:
                s.add(int(row['id_parcela']))
            except (TypeError, ValueError):
                s.add(_NEG_NULL_PARCELA)
    return out


# =============================================================================
# Automacoes de cobranca (SMS, e-mail, ligacao)
# -----------------------------------------------------------------------------
# Endpoints proxy entre o frontend e a API que o colega Flavio esta criando.
# Por enquanto retornam sucesso simulado e logam o payload no console; quando a
# API estiver pronta basta substituir o bloco TODO por uma chamada real
# (requests.post / httpx) e propagar a resposta.
# =============================================================================

_AUTOMACAO_TIPOS = {'sms', 'email', 'ligacao'}


def _automacao_log(tipo, payload, extra=None):
    try:
        print(f"[automacao:{tipo}] payload={json.dumps(payload, ensure_ascii=False)}"
              + (f" extra={extra}" if extra else ''),
              flush=True)
    except Exception:
        pass


def _validar_ids_contratos(ids):
    if not isinstance(ids, list):
        return None, 'contrato_ids deve ser uma lista.'
    out = []
    for v in ids:
        try:
            out.append(int(v))
        except (TypeError, ValueError):
            return None, f'ID invalido na lista: {v!r}'
    if not out:
        return None, 'Nenhum contrato informado.'
    return out, None


@app.route('/api/automacao/<tipo>', methods=['POST'])
def api_automacao(tipo):
    """Disparo em lote de SMS / e-mail OU disparo unitario de ligacao."""
    if tipo not in _AUTOMACAO_TIPOS:
        return jsonify({'error': f'Tipo desconhecido: {tipo}'}), 400

    payload = request.get_json(silent=True) or {}
    nivel = (payload.get('nivel') or 'na').strip().lower()

    if tipo == 'ligacao':
        # Disparo unitario - o frontend faz o sequenciamento.
        try:
            contrato_id = int(payload.get('contrato_id'))
        except (TypeError, ValueError):
            return jsonify({'error': 'contrato_id obrigatorio (inteiro).'}), 400

        _automacao_log('ligacao', {
            'contrato_id': contrato_id,
            'nivel': nivel,
            'nome': payload.get('nome'),
            'telefone': payload.get('telefone'),
        })

        # TODO: integrar com a API real do discador.
        # Exemplo (descomente e adapte quando a API estiver pronta):
        #   import requests
        #   r = requests.post('http://api-flavio/discador/chamada',
        #                     json={'contrato_id': contrato_id,
        #                           'telefone': payload.get('telefone')},
        #                     timeout=15)
        #   data = r.json()
        #   return jsonify(data), r.status_code

        return jsonify({
            'success': True,
            'tipo': 'ligacao',
            'contrato_id': contrato_id,
            'status_chamada': 'iniciada',
            'mensagem': 'Discagem disparada (mock).',
            'mock': True,
        })

    # SMS / email - lote
    ids, err = _validar_ids_contratos(payload.get('contrato_ids'))
    if err:
        return jsonify({'error': err}), 400

    _automacao_log(tipo, {
        'nivel': nivel,
        'qtd': len(ids),
        'ids': ids[:50],  # log nao precisa imprimir milhares
    })

    # TODO: substituir pelo POST real para a API do Flavio.
    # Exemplo:
    #   import requests
    #   r = requests.post(f'http://api-flavio/{tipo}/lote',
    #                     json={'contrato_ids': ids, 'nivel': nivel},
    #                     timeout=30)
    #   data = r.json()
    #   return jsonify(data), r.status_code

    return jsonify({
        'success': True,
        'tipo': tipo,
        'nivel': nivel,
        'enviados': len(ids),
        'falhas': 0,
        'mensagem': f'{len(ids)} {tipo} disparados (mock).',
        'mock': True,
    })


# =============================================================================
# API: Negativacao (Serasa) - POR PARCELA
# -----------------------------------------------------------------------------
# Regras de negocio (versao 2):
#   - A negativacao e registrada no nivel de PARCELA (nao contrato).
#   - Uma parcela ELEGIVEL: parcela aberto mais antiga com 30 < dias < 90
#     (1 ou N parcelas em aberto) e ainda NAO consta em `negativacao`.
#   - A unicidade e reforcada pelo UNIQUE KEY (id_parcela) + INSERT IGNORE.
#     Isso protege contra:
#       * race condition (dois cliques / dois usuarios simultaneos);
#       * re-envios logicos (o front deveria evitar, mas nunca se confia).
#   - O INSERT ocorre ANTES do disparo para a API externa para que a proxima
#     leitura do painel de cobranca ja apresente o contrato como "negativado"
#     mesmo se a API externa demorar ou falhar. Se a API externa falhar,
#     atualizamos `status` para 'falhou' e guardamos a resposta.
# =============================================================================

def _info_negativacao_por_contrato(cursor, ids, data_referencia):
    """Retorna dict {id_contrato: {...dados da parcela alvo}}.

    ``data_referencia`` = mesma data de referencia de /api/cobranca
    (MAX(data_arquivo) em arquivos_gm) para o calculo de dias de atraso.
    """
    if not ids:
        return {}
    placeholders = ','.join(['%s'] * len(ids))
    q = f"""
        SELECT c.id AS id_contrato,
               c.grupo, c.cota, c.numero_contrato,
               (
                 SELECT COUNT(*) FROM parcela p
                 WHERE p.id_contrato = c.id AND p.status = 'aberto'
               ) AS parcelas_abertas,
               (
                 SELECT p.id FROM parcela p
                 WHERE p.id_contrato = c.id AND p.status = 'aberto'
                 ORDER BY p.vencimento ASC, p.id ASC LIMIT 1
               ) AS id_parcela_alvo,
               (
                 SELECT p.numero_parcela FROM parcela p
                 WHERE p.id_contrato = c.id AND p.status = 'aberto'
                 ORDER BY p.vencimento ASC, p.id ASC LIMIT 1
               ) AS numero_parcela_alvo,
               (
                 SELECT DATEDIFF(%s, MIN(p.vencimento)) FROM parcela p
                 WHERE p.id_contrato = c.id AND p.status = 'aberto'
               ) AS dias_atraso
        FROM contrato c
        WHERE c.id IN ({placeholders}) AND c.status = 'aberto'
    """
    cursor.execute(q, (data_referencia, *ids))
    info = _clean_rows(cursor.fetchall())
    return {int(r['id_contrato']): r for r in info}


@app.route('/api/negativacao/enviar', methods=['POST'])
def api_negativacao_enviar():
    payload = request.get_json(silent=True) or {}
    ids, err = _validar_ids_contratos(payload.get('contrato_ids'))
    if err:
        return jsonify({'error': err}), 400

    conn = _get_db()
    cursor = conn.cursor()
    _ensure_negativacao_table(cursor)

    data_ref = _get_data_referencia_arquivos_gm(cursor)

    # --- Fase 1: coleta ------------------------------------------------------
    info_por_id = _info_negativacao_por_contrato(cursor, ids, data_ref)

    # --- Fase 2: CHECK BEFORE CLASSIFICATION --------------------------------
    # Mesma logica de /api/cobranca: mapa por id_contrato (legado NULL + ids).
    neg_map = _mapa_parcelas_negativadas_por_contrato(cursor, ids)

    # --- Fase 3: classificacao (Needs Negative / Already / Not Negative) ----
    elegiveis    = []  # "Needs Negative": serao gravados e enviados agora
    ja_negativ   = []  # "Already Negative": parcela-alvo ja esta registrada
    fora_janela  = []  # atraso fora de (30, 90)
    ausentes     = []  # contrato nao encontrado ou nao-aberto

    for cid in ids:
        r = info_por_id.get(cid)
        if not r:
            ausentes.append({'id_contrato': cid})
            continue

        id_alvo_raw = r.get('id_parcela_alvo')
        try:
            id_alvo = int(id_alvo_raw) if id_alvo_raw is not None else None
        except (TypeError, ValueError):
            id_alvo = None
        try:
            dias_i = int(r.get('dias_atraso') or 0)
        except (TypeError, ValueError):
            dias_i = 0

        neg_set = neg_map.get(cid, set())
        if _NEG_NULL_PARCELA in neg_set or (
            id_alvo is not None and id_alvo in neg_set
        ):
            ja_negativ.append({'id_contrato': cid, 'id_parcela': id_alvo})
            continue
        if not (30 < dias_i < 90):
            fora_janela.append({'id_contrato': cid, 'dias_atraso': dias_i})
            continue
        if id_alvo is None:
            ausentes.append({'id_contrato': cid})
            continue

        elegiveis.append({
            'id_contrato':     cid,
            'id_parcela':      id_alvo,
            'numero_parcela':  r.get('numero_parcela_alvo'),
            'dias_atraso':     dias_i,
            'grupo_cota':      f"{r.get('grupo')}/{r.get('cota')}",
        })

    _automacao_log('negativacao', {
        'qtd_total':         len(ids),
        'qtd_elegiveis':     len(elegiveis),
        'qtd_ja_negativados': len(ja_negativ),
        'qtd_fora_janela':   len(fora_janela),
        'qtd_ausentes':      len(ausentes),
    })

    # --- Fase 4: INSERT primeiro (locking via UNIQUE KEY) -------------------
    # INSERT IGNORE faz o uk_negativacao_parcela virar "seletor": se outra
    # request concorrente ja gravou a mesma parcela, esta tentativa e
    # silenciosamente descartada e rowcount reflete isso.
    gravados = 0
    if elegiveis:
        cursor.executemany(
            "INSERT IGNORE INTO negativacao "
            "  (id_contrato, id_parcela, numero_parcela, dias_atraso, status, resposta_api) "
            "VALUES (%s, %s, %s, %s, 'enviado', %s)",
            [
                (
                    e['id_contrato'],
                    e['id_parcela'],
                    e['numero_parcela'],
                    e['dias_atraso'],
                    '{"mock": true}',
                )
                for e in elegiveis
            ],
        )
        conn.commit()
        gravados = cursor.rowcount if cursor.rowcount is not None else 0

    # --- Fase 5: disparo para a API externa (mock hoje; Flavio depois) ------
    # TODO: substituir pelo POST real. Se falhar, atualizar status p/ 'falhou':
    #   import requests
    #   for e in elegiveis:
    #       try:
    #           r = requests.post('http://api-flavio/serasa/negativacao',
    #                             json={'id_contrato': e['id_contrato'],
    #                                   'id_parcela':  e['id_parcela'],
    #                                   'dias_atraso': e['dias_atraso']},
    #                             timeout=30)
    #           if r.status_code >= 400:
    #               raise RuntimeError(r.text)
    #           cursor.execute(
    #               "UPDATE negativacao SET status='enviado', resposta_api=%s "
    #               "WHERE id_parcela=%s",
    #               (r.text, e['id_parcela']),
    #           )
    #       except Exception as exc:
    #           cursor.execute(
    #               "UPDATE negativacao SET status='falhou', resposta_api=%s "
    #               "WHERE id_parcela=%s",
    #               (str(exc), e['id_parcela']),
    #           )
    #   conn.commit()

    cursor.close()
    conn.close()

    return jsonify({
        'success': True,
        'tipo': 'negativacao',
        'enviados':         len(elegiveis),
        'gravados':         gravados,
        'ja_negativados':   len(ja_negativ),
        'fora_janela':      len(fora_janela),
        'ausentes':         len(ausentes),
        'falhas':           0,
        'mock':             True,
        'mensagem': (
            f'{len(elegiveis)} parcela(s) negativada(s). '
            f'{len(ja_negativ)} parcela(s) ja estavam negativadas. '
            f'{len(fora_janela)} fora da janela (30 < dias < 90).'
        ),
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
