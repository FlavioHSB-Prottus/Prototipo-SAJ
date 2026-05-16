# -*- coding: utf-8 -*-
"""Gerador de eventos da importacao GM (fases 1-3). Usado pelo SSE em ``app.py`` e pelo modo background.

Nao importa Flask. Recebe callbacks e caminhos para evitar dependencia circular com ``app.py``.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import Any, Callable, Dict, Iterator, Optional

# Mesmo diretorio que import_only / tracker (subprocess com script em Python/).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gm_txt_io import collect_dates_from_txt_root


def _job_set_active(job: Optional[Dict[str, Any]], proc: Optional[subprocess.Popen]) -> None:
    if job is not None:
        job['active_proc'] = proc


def _job_clear_active(job: Optional[Dict[str, Any]]) -> None:
    if job is not None:
        job['active_proc'] = None


def _job_cancelled(job: Optional[Dict[str, Any]]) -> bool:
    return job is not None and bool(job.get('cancel_requested'))


def iter_importacao_events(
    temp_dir: str,
    job: Optional[Dict[str, Any]],
    *,
    python_dir: str,
    python_exe: str,
    subprocess_env: dict,
    popen_extra: dict,
    schema_pronto: Callable[[], tuple],
    classify_log: Callable[[str], str],
) -> Iterator[Dict[str, Any]]:
    """Emite dicts no formato dos eventos SSE (type log|progress|status|done|error)."""

    def _terminate_proc(proc: Optional[subprocess.Popen]) -> None:
        if proc is None:
            return
        try:
            proc.terminate()
            proc.wait(timeout=8)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    ok_schema, err_schema = schema_pronto()
    if not ok_schema:
        yield {'type': 'log', 'level': 'alert', 'text': err_schema}
        yield {
            'type': 'status',
            'text': 'Importacao nao iniciada: crie o schema do banco primeiro.',
        }
        yield {'type': 'progress', 'value': 0}
        yield {
            'type': 'done',
            'summary': err_schema,
            'distribuicao_ready': False,
            'schema_error': True,
        }
        return

    yield {'type': 'status', 'text': 'Fase 1/3 - Importando Arquivos para o Banco...'}
    yield {'type': 'progress', 'value': 5}

    script1 = os.path.join(python_dir, 'import_only_arquivos_gm.py')
    proc1 = subprocess.Popen(
        [python_exe, '-u', script1, temp_dir],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        env=subprocess_env,
        **popen_extra,
    )
    _job_set_active(job, proc1)

    total_files = sum(
        1
        for root, _dirs, files in os.walk(temp_dir)
        for f in files
        if f.lower().endswith('.txt')
    )
    imported_count = 0
    line_i = 0

    try:
        for line in iter(proc1.stdout.readline, ''):
            if _job_cancelled(job):
                _terminate_proc(proc1)
                yield {'type': 'log', 'level': 'alert', 'text': 'Importacao cancelada pelo usuario.'}
                yield {
                    'type': 'done',
                    'summary': 'Importacao cancelada. Dados parciais podem ter sido gravados no banco.',
                    'distribuicao_ready': False,
                    'cancelled': True,
                }
                shutil.rmtree(temp_dir, ignore_errors=True)
                return
            line_i += 1
            line = line.rstrip('\n\r')
            if not line:
                continue
            level = classify_log(line)
            yield {'type': 'log', 'level': level, 'text': line}

            if 'importado com sucesso' in line.lower():
                imported_count += 1
                progress = 5 + int((imported_count / max(total_files, 1)) * 40)
                yield {'type': 'progress', 'value': min(progress, 45)}
    finally:
        _job_clear_active(job)

    proc1.wait()
    yield {'type': 'progress', 'value': 48}

    if proc1.returncode and proc1.returncode != 0:
        yield {
            'type': 'log',
            'level': 'alert',
            'text': f'Script de importacao finalizou com codigo {proc1.returncode}',
        }

    if _job_cancelled(job):
        yield {'type': 'log', 'level': 'alert', 'text': 'Importacao cancelada pelo usuario.'}
        yield {
            'type': 'done',
            'summary': 'Importacao cancelada.',
            'distribuicao_ready': False,
            'cancelled': True,
        }
        shutil.rmtree(temp_dir, ignore_errors=True)
        return

    yield {'type': 'status', 'text': 'Fase 2/3 - Processando Contratos e Rastreando Deltas...'}
    yield {'type': 'progress', 'value': 50}

    session_dates = collect_dates_from_txt_root(temp_dir)
    if not session_dates:
        yield {'type': 'log', 'level': 'alert', 'text': 'Nenhuma data valida encontrada nos arquivos importados.'}
        yield {'type': 'progress', 'value': 100}
        yield {
            'type': 'done',
            'summary': f'{imported_count} arquivos importados. Nenhuma data para tracker.',
            'distribuicao_ready': False,
        }
        shutil.rmtree(temp_dir, ignore_errors=True)
        return

    yield {
        'type': 'log',
        'level': 'info',
        'text': (
            f'Datas da sessao ({len(session_dates)}): '
            f'{session_dates[0]} ate {session_dates[-1]}'
        ),
    }

    script2 = os.path.join(python_dir, 'tracker_gm_range_date_contratos.py')
    proc2 = subprocess.Popen(
        [python_exe, '-u', script2, temp_dir],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        env=subprocess_env,
        **popen_extra,
    )
    _job_set_active(job, proc2)

    line_count = 0
    try:
        for line in iter(proc2.stdout.readline, ''):
            if _job_cancelled(job):
                _terminate_proc(proc2)
                yield {'type': 'log', 'level': 'alert', 'text': 'Importacao cancelada pelo usuario.'}
                yield {
                    'type': 'done',
                    'summary': 'Importacao cancelada.',
                    'distribuicao_ready': False,
                    'cancelled': True,
                }
                shutil.rmtree(temp_dir, ignore_errors=True)
                return
            line = line.rstrip('\n\r')
            if not line:
                continue
            level = classify_log(line)
            yield {'type': 'log', 'level': level, 'text': line}

            line_count += 1
            progress = 50 + min(int(line_count * 2), 40)
            yield {'type': 'progress', 'value': min(progress, 92)}
    finally:
        _job_clear_active(job)

    proc2.wait()

    if proc2.returncode and proc2.returncode != 0:
        yield {
            'type': 'log',
            'level': 'alert',
            'text': f'Script tracker finalizou com codigo {proc2.returncode}',
        }

    if _job_cancelled(job):
        yield {'type': 'log', 'level': 'alert', 'text': 'Importacao cancelada pelo usuario.'}
        yield {
            'type': 'done',
            'summary': 'Importacao cancelada.',
            'distribuicao_ready': False,
            'cancelled': True,
        }
        shutil.rmtree(temp_dir, ignore_errors=True)
        return

    yield {
        'type': 'status',
        'text': 'Fase 3/3 - Distribuindo contratos entre os funcionarios de cobranca...',
    }
    yield {'type': 'progress', 'value': 96}

    script3 = os.path.join(python_dir, 'distribuir_funcionarios_cobranca.py')
    proc3 = subprocess.Popen(
        [python_exe, '-u', script3],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        env=subprocess_env,
        **popen_extra,
    )
    _job_set_active(job, proc3)

    try:
        for line in iter(proc3.stdout.readline, ''):
            if _job_cancelled(job):
                _terminate_proc(proc3)
                yield {'type': 'log', 'level': 'alert', 'text': 'Importacao cancelada pelo usuario.'}
                yield {
                    'type': 'done',
                    'summary': 'Importacao cancelada.',
                    'distribuicao_ready': False,
                    'cancelled': True,
                }
                shutil.rmtree(temp_dir, ignore_errors=True)
                return
            line = line.rstrip('\n\r')
            if not line:
                continue
            level = classify_log(line)
            yield {'type': 'log', 'level': level, 'text': line}
    finally:
        _job_clear_active(job)

    proc3.wait()
    distribuicao_ok = proc3.returncode == 0

    if not distribuicao_ok:
        yield {
            'type': 'log',
            'level': 'alert',
            'text': f'Script de distribuicao finalizou com codigo {proc3.returncode}',
        }

    shutil.rmtree(temp_dir, ignore_errors=True)

    yield {'type': 'progress', 'value': 100}
    yield {'type': 'status', 'text': 'Processamento Concluido com Sucesso!'}
    yield {
        'type': 'done',
        'summary': f'{imported_count} arquivos importados e processados.',
        'distribuicao_ready': distribuicao_ok,
    }
