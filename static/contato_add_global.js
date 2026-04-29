/**
 * Modal global: adicionar telefone ou e-mail a uma pessoa.
 * Botoes: .btn-add-telefone-pessoa e .btn-add-email-pessoa (data-pessoa-id, data-pessoa-nome, data-recurso).
 * Apos sucesso: chama window.__refreshContatoSrc se existir, dispara evento pessoaContatoInserido.
 */
(function (global) {
    'use strict';

    var TIPOS_TEL = [
        'fixo', 'celular', 'comercial', 'comercial_devedor', 'recados', 'outro',
    ];
    var TIPOS_EMAIL = ['principal', 'secundario', 'comercial', 'outro'];

    var state = { pessoaId: null, pessoaNome: '', recurso: null };
    var bound = false;

    function $(id) {
        return document.getElementById(id);
    }

    function showMsg(msg, isErr) {
        var el = $('contatoAddMsg');
        if (!el) return;
        if (!msg) {
            el.style.display = 'none';
            el.textContent = '';
            return;
        }
        el.style.display = 'block';
        el.style.color = isErr ? '#ef4444' : '#15803d';
        el.textContent = msg;
    }

    function openModal() {
        var m = $('contatoAddModal');
        if (m) {
            m.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeModal() {
        var m = $('contatoAddModal');
        if (m) m.classList.remove('active');
        var dm = document.getElementById('detalhesModal');
        if (dm && dm.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            var gpv = document.getElementById('globalPvInsertModal');
            if (gpv && gpv.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
    }

    function ensureSelectOptions() {
        var sTel = $('caTipoTel');
        if (sTel && sTel.options.length === 0) {
            TIPOS_TEL.forEach(function (t) {
                var o = document.createElement('option');
                o.value = t;
                o.textContent = t;
                sTel.appendChild(o);
            });
        }
        var sE = $('caTipoEmail');
        if (sE && sE.options.length === 0) {
            TIPOS_EMAIL.forEach(function (t) {
                var o = document.createElement('option');
                o.value = t;
                o.textContent = t;
                sE.appendChild(o);
            });
        }
    }

    function openContatoAdd(opts) {
        opts = opts || {};
        state.pessoaId = opts.pessoaId;
        state.pessoaNome = opts.pessoaNome || '';
        state.recurso = opts.recurso || 'telefone';
        ensureSelectOptions();
        var tit = $('contatoAddTitle');
        var bTel = $('contatoAddTelBlock');
        var bE = $('contatoAddEmailBlock');
        var rec = state.recurso;
        if (tit) {
            tit.textContent = (rec === 'email' ? 'Novo e-mail' : 'Novo telefone') + (state.pessoaNome ? ' - ' + state.pessoaNome : '');
        }
        if (bTel) bTel.style.display = rec === 'telefone' ? '' : 'none';
        if (bE) bE.style.display = rec === 'email' ? '' : 'none';
        showMsg('');
        var f = $('contatoAddForm');
        if (f) f.reset();
        ensureSelectOptions();
        if (rec === 'telefone' && $('caTipoTel')) {
            $('caTipoTel').selectedIndex = 0;
        }
        if (rec === 'email' && $('caTipoEmail')) {
            $('caTipoEmail').selectedIndex = 0;
        }
        openModal();
    }

    function readNomeAttr(el) {
        var raw = el.getAttribute('data-pessoa-nome') || '';
        if (!raw) return '';
        try {
            return decodeURIComponent(raw);
        } catch (err) {
            return raw;
        }
    }

    function onDelegatedClick(e) {
        var btnTel = e.target.closest('.btn-add-telefone-pessoa');
        var btnE = e.target.closest('.btn-add-email-pessoa');
        if (btnTel) {
            e.preventDefault();
            openContatoAdd({
                pessoaId: btnTel.getAttribute('data-pessoa-id'),
                pessoaNome: readNomeAttr(btnTel),
                recurso: 'telefone',
            });
            return;
        }
        if (btnE) {
            e.preventDefault();
            openContatoAdd({
                pessoaId: btnE.getAttribute('data-pessoa-id'),
                pessoaNome: readNomeAttr(btnE),
                recurso: 'email',
            });
        }
    }

    function onSubmit(e) {
        e.preventDefault();
        showMsg('');
        var id = state.pessoaId;
        if (!id) {
            showMsg('Identificador da pessoa invalido.', true);
            return;
        }
        var rec = state.recurso;
        var url = '/api/pessoa/' + encodeURIComponent(id) + '/' + (rec === 'email' ? 'email' : 'telefone');
        var payload;
        if (rec === 'telefone') {
            var num = ($('caNumero') && $('caNumero').value) ? String($('caNumero').value).trim() : '';
            var ram = ($('caRamal') && $('caRamal').value) ? String($('caRamal').value).trim() : '';
            var ttipo = $('caTipoTel') ? String($('caTipoTel').value) : 'fixo';
            payload = { tipo: ttipo, numero: num, ramal: ram || null };
        } else {
            var em = ($('caEmail') && $('caEmail').value) ? String($('caEmail').value).trim() : '';
            var etipo = $('caTipoEmail') ? String($('caTipoEmail').value) : 'principal';
            payload = { tipo: etipo, email: em };
        }
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
            .then(function (r) {
                return r.json().then(function (d) {
                    return { ok: r.ok, status: r.status, d: d };
                });
            })
            .then(function (res) {
                if (res.d.error) {
                    var msg = res.d.error;
                    if (res.d.telefone_existente && res.d.telefone_existente.numero) {
                        msg += ' (Atual: ' + String(res.d.telefone_existente.numero) + ')';
                    } else if (res.d.email_existente && res.d.email_existente.email) {
                        msg += ' (Atual: ' + String(res.d.email_existente.email) + ')';
                    }
                    showMsg(msg, true);
                    return;
                }
                if (!res.ok) {
                    showMsg(res.d.error || 'Erro ao salvar.', true);
                    return;
                }
                closeModal();
                if (typeof global.__refreshContatoSrc === 'function') {
                    try {
                        global.__refreshContatoSrc();
                    } catch (err) { /* ignore */ }
                }
                try {
                    document.dispatchEvent(new CustomEvent('pessoaContatoInserido', {
                        detail: { pessoaId: id, recurso: rec },
                    }));
                } catch (err2) { /* ignore */ }
                global.alert('Contato adicionado com sucesso.');
            })
            .catch(function (err) {
                showMsg('Erro: ' + err.message, true);
            });
    }

    function wireOnce() {
        if (bound) return;
        bound = true;
        document.addEventListener('click', onDelegatedClick);
        var f = $('contatoAddForm');
        if (f) f.addEventListener('submit', onSubmit);
        var c = $('caClose');
        var can = $('caCancel');
        function cfn() {
            showMsg('');
            closeModal();
        }
        if (c) c.addEventListener('click', cfn);
        if (can) can.addEventListener('click', cfn);
        var ov = $('contatoAddModal');
        if (ov) {
            ov.addEventListener('click', function (e) {
                if (e.target === ov) cfn();
            });
        }
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var m = $('contatoAddModal');
            if (m && m.classList.contains('active')) {
                e.preventDefault();
                cfn();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', wireOnce);
    global.ContatoAddGlobal = { open: openContatoAdd, close: closeModal };
})(window);
