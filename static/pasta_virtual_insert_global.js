/**
 * Modal global "Novo registro - Pasta Virtual" (qualquer pagina com busca.css).
 * Abre por delegacao em .btn-pv-insert-from-contrato (data-grupo / data-cota em URI encode)
 * ou via window.PastaVirtualInsertGlobal.open({ grupo, cota, returnToContrato }).
 */
(function (global) {
    'use strict';

    var pvMeta = null;
    var bound = false;
    var state = { returnToContrato: false };

    function $(id) {
        return document.getElementById(id);
    }

    function ensureMeta() {
        if (pvMeta) return Promise.resolve(pvMeta);
        return fetch('/api/pasta-virtual/meta')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data.error) pvMeta = data;
                return pvMeta;
            })
            .catch(function () {
                return null;
            });
    }

    function showMsg(el, msg, ok) {
        if (!el) return;
        el.style.display = msg ? 'block' : 'none';
        el.style.color = ok ? '#15803d' : '#ef4444';
        el.textContent = msg || '';
    }

    function applyFieldVisibility() {
        var meta = pvMeta;
        var gGrupo = $('gPvGrupo');
        var gCota = $('gPvCota');
        var gArq = $('gPvArquivo');
        if (meta && meta.contrato_col === null && gGrupo && gCota) {
            gGrupo.closest('.form-group').style.display = 'none';
            gCota.closest('.form-group').style.display = 'none';
        } else if (gGrupo && gCota) {
            gGrupo.closest('.form-group').style.display = '';
            gCota.closest('.form-group').style.display = '';
        }
        if (meta && meta.blob_col === null && gArq) {
            gArq.closest('.form-group').style.display = 'none';
        } else if (gArq) {
            gArq.closest('.form-group').style.display = '';
        }
    }

    function closeInsertModal() {
        var ov = $('globalPvInsertModal');
        if (!ov) return;
        var back = state.returnToContrato;
        state.returnToContrato = false;
        ov.classList.remove('active');
        if (back) {
            var dm = $('detalhesModal');
            if (dm) {
                dm.classList.add('active');
                document.body.style.overflow = 'hidden';
                return;
            }
        }
        document.body.style.overflow = '';
    }

    function openInsertModal(opts) {
        opts = opts || {};
        var ov = $('globalPvInsertModal');
        if (!ov) return;

        var dm = $('detalhesModal');
        var fromContrato = opts.returnToContrato === true && dm && dm.classList.contains('active');
        state.returnToContrato = fromContrato;
        if (fromContrato) {
            dm.classList.remove('active');
        }

        var backWrap = $('gPvBackWrap');
        if (backWrap) backWrap.style.display = fromContrato ? 'block' : 'none';

        showMsg($('gPvInsertMsg'), '', true);
        var form = $('globalPvInsertForm');
        if (form) form.reset();

        ensureMeta().then(function () {
            applyFieldVisibility();
            var gGrupo = $('gPvGrupo');
            var gCota = $('gPvCota');
            if (gGrupo && opts.grupo != null && String(opts.grupo) !== '') {
                gGrupo.value = String(opts.grupo);
            }
            if (gCota && opts.cota != null && String(opts.cota) !== '') {
                gCota.value = String(opts.cota);
            }
            ov.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    function onDelegatedInsertClick(e) {
        var btn = e.target.closest('.btn-pv-insert-from-contrato');
        if (!btn) return;
        e.preventDefault();
        var g = '';
        var co = '';
        try {
            g = btn.getAttribute('data-grupo');
            co = btn.getAttribute('data-cota');
            if (g) g = decodeURIComponent(g);
            if (co) co = decodeURIComponent(co);
        } catch (err) {
            g = btn.getAttribute('data-grupo') || '';
            co = btn.getAttribute('data-cota') || '';
        }
        openInsertModal({ grupo: g || '', cota: co || '', returnToContrato: true });
    }

    function bindOnce() {
        if (bound) return;
        bound = true;

        document.addEventListener('click', onDelegatedInsertClick);

        var form = $('globalPvInsertForm');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var msgEl = $('gPvInsertMsg');
                showMsg(msgEl, '', true);
                var fd = new FormData();
                var gGrupo = $('gPvGrupo');
                var gCota = $('gPvCota');
                var gDesc = $('gPvDescricao');
                var gArq = $('gPvArquivo');
                if (gGrupo && !gGrupo.value.trim()) {
                    showMsg(msgEl, 'Grupo é obrigatório.', false);
                    return;
                }
                if (gCota && !gCota.value.trim()) {
                    showMsg(msgEl, 'Cota é obrigatória.', false);
                    return;
                }
                if (gGrupo) fd.append('grupo', gGrupo.value.trim());
                if (gCota) fd.append('cota', gCota.value.trim());
                if (!gDesc || !gDesc.value.trim()) {
                    showMsg(msgEl, 'Descrição é obrigatória.', false);
                    return;
                }
                fd.append('descricao', gDesc.value.trim());
                if (gArq && gArq.files && gArq.files[0]) fd.append('arquivo', gArq.files[0]);

                fetch('/api/pasta-virtual/inserir', { method: 'POST', body: fd })
                    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
                    .then(function (res) {
                        if (!res.ok || res.d.error) {
                            var msg = res.d.error || 'Erro ao inserir.';
                            if (res.d.missing && res.d.missing.length) {
                                msg += ' Campos obrigatórios: ' + res.d.missing.join(', ');
                            }
                            showMsg(msgEl, msg, false);
                            return;
                        }
                        if (form) form.reset();
                        showMsg(msgEl, '', true);
                        closeInsertModal();
                        window.alert('Registro inserido com sucesso.');
                        try {
                            document.dispatchEvent(new CustomEvent('pastaVirtualInserted'));
                        } catch (err2) { /* ignore */ }
                    })
                    .catch(function (err) {
                        showMsg(msgEl, 'Erro ao inserir: ' + err.message, false);
                    });
            });
        }

        function wireClose() {
            closeInsertModal();
        }
        var x = $('gPvCloseInsert');
        var c = $('gPvCancelInsert');
        var b = $('gPvBackToContrato');
        if (x) x.addEventListener('click', wireClose);
        if (c) c.addEventListener('click', wireClose);
        if (b) b.addEventListener('click', wireClose);

        var ov = $('globalPvInsertModal');
        if (ov) {
            ov.addEventListener('click', function (e) {
                if (e.target === ov) wireClose();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var ins = $('globalPvInsertModal');
            if (ins && ins.classList.contains('active')) {
                e.preventDefault();
                wireClose();
            }
        });
    }

    global.PastaVirtualInsertGlobal = {
        open: openInsertModal,
        close: closeInsertModal,
    };

    document.addEventListener('DOMContentLoaded', bindOnce);
})(window);
