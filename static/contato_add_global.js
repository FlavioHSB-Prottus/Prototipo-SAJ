/**
 * Modal global: adicionar telefone, e-mail ou endereco a uma pessoa.
 * Botoes: .btn-add-telefone-pessoa, .btn-add-email-pessoa, .btn-add-endereco-pessoa.
 * Apos sucesso: chama window.__refreshContatoSrc se existir, dispara evento pessoaContatoInserido.
 */
(function (global) {
    'use strict';

    var TIPOS_TEL = [
        'fixo', 'celular', 'comercial', 'comercial_devedor', 'recados', 'outro',
    ];
    var TIPOS_EMAIL = ['principal', 'secundario', 'comercial', 'outro'];
    var TIPOS_END_DEVEDOR = ['principal', 'secundario'];
    var TIPOS_END_AVALISTA = ['avalista_principal', 'avalista_secundario'];
    var TIPOS_END_PESSOA = TIPOS_END_DEVEDOR.concat(TIPOS_END_AVALISTA);

    var state = { pessoaId: null, pessoaNome: '', recurso: null, papel: 'pessoa' };
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

    function tiposEnderecoPorPapel(papel) {
        var p = String(papel || 'pessoa').toLowerCase();
        if (p === 'devedor') return TIPOS_END_DEVEDOR;
        if (p === 'avalista') return TIPOS_END_AVALISTA;
        return TIPOS_END_PESSOA;
    }

    function fillEnderecoTipoSelect(papel) {
        var s = $('caTipoEnd');
        if (!s) return;
        var tipos = tiposEnderecoPorPapel(papel);
        s.innerHTML = '';
        tipos.forEach(function (t) {
            var o = document.createElement('option');
            o.value = t;
            o.textContent = t;
            s.appendChild(o);
        });
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
        state.papel = opts.papel || 'pessoa';
        ensureSelectOptions();
        var tit = $('contatoAddTitle');
        var bTel = $('contatoAddTelBlock');
        var bE = $('contatoAddEmailBlock');
        var bEnd = $('contatoAddEnderecoBlock');
        var rec = state.recurso;
        var titBase = 'Novo telefone';
        if (rec === 'email') titBase = 'Novo e-mail';
        if (rec === 'endereco') titBase = 'Novo endereco';
        if (tit) {
            tit.textContent = titBase + (state.pessoaNome ? ' - ' + state.pessoaNome : '');
        }
        if (bTel) bTel.style.display = rec === 'telefone' ? '' : 'none';
        if (bE) bE.style.display = rec === 'email' ? '' : 'none';
        if (bEnd) bEnd.style.display = rec === 'endereco' ? '' : 'none';
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
        if (rec === 'endereco') {
            fillEnderecoTipoSelect(state.papel);
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
        var btnEnd = e.target.closest('.btn-add-endereco-pessoa');
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
            return;
        }
        if (btnEnd) {
            e.preventDefault();
            openContatoAdd({
                pessoaId: btnEnd.getAttribute('data-pessoa-id'),
                pessoaNome: readNomeAttr(btnEnd),
                recurso: 'endereco',
                papel: btnEnd.getAttribute('data-pessoa-papel') || 'pessoa',
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
        var url;
        var payload;
        if (rec === 'endereco') {
            url = '/api/pessoa/' + encodeURIComponent(id) + '/endereco';
            payload = {
                papel: state.papel,
                tipo: $('caTipoEnd') ? String($('caTipoEnd').value) : 'principal',
                logradouro: ($('caLogradouro') && $('caLogradouro').value) ? String($('caLogradouro').value).trim() : '',
                bairro: ($('caBairro') && $('caBairro').value) ? String($('caBairro').value).trim() : '',
                complemento: ($('caComplemento') && $('caComplemento').value) ? String($('caComplemento').value).trim() : '',
                cep: ($('caCep') && $('caCep').value) ? String($('caCep').value).trim() : '',
                cidade: ($('caCidade') && $('caCidade').value) ? String($('caCidade').value).trim() : '',
                estado: ($('caEstado') && $('caEstado').value) ? String($('caEstado').value).trim() : '',
            };
        } else {
            url = '/api/pessoa/' + encodeURIComponent(id) + '/' + (rec === 'email' ? 'email' : 'telefone');
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
                    showMsg(res.d.error, true);
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
                var okMsg = rec === 'endereco' ? 'Endereco salvo com sucesso.' : 'Contato adicionado com sucesso.';
                global.alert(okMsg);
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
