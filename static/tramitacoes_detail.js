/**
 * Secao "Tramitações" reutilizavel no modal de detalhes do contrato.
 * Depende de: esc(), formatDateTime() passados em options; layout com classes existentes.
 */
(function (global) {
    'use strict';

    var TIPOS = ['ligacao', 'whatsapp', 'email'];
    var CPCS = ['sim', 'nao', 'parente', 'amigo', 'avalista'];

    function escAttr(s) {
        if (s == null) s = '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function cpcBadgeClass(cpc) {
        var x = String(cpc || '').toLowerCase();
        if (x === 'sim') return 'status-success';
        if (x === 'nao') return 'status-danger';
        return 'status-warning';
    }

    function toDateTimeLocal(val) {
        if (!val) return '';
        var s = String(val);
        if (s.indexOf('T') > 0) return s.substring(0, 16);
        if (s.indexOf(' ') > 0) return s.replace(' ', 'T').substring(0, 16);
        return s.length >= 16 ? s.substring(0, 16) : s;
    }

    function defaultNowLocal() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        return y + '-' + m + '-' + day + 'T' + h + ':' + min;
    }

    function defaultOptions(o) {
        o = o || {};
        if (!o.esc) {
            o.esc = function (v) {
                if (v == null || v === '') return '-';
                var el = document.createElement('div');
                el.textContent = v;
                return el.innerHTML;
            };
        }
        if (!o.formatDateTime) {
            o.formatDateTime = function (v) { return v == null ? '-' : String(v); };
        }
        return o;
    }

    function buildSection(tramitacoes, contratoId, options) {
        var o = defaultOptions(options);
        var esc = o.esc;
        var formatDateTime = o.formatDateTime;
        var list = tramitacoes || [];
        var n = list.length;
        var cid = String(contratoId);

        var html = '';
        html += '<div class="detail-section tramitacao-section" data-contrato-id="' + escAttr(cid) + '">';
        html += '<h3><i class="fa-solid fa-comments"></i> Tramitações <span class="tramitacoes-count">(' + n + ')</span></h3>';
        html += '<div class="tramitacao-container">';

        if (n === 0) {
            html += '<p class="tramitacao-empty-hint" style="margin:0 0 12px;font-size:0.9rem;color:var(--text-muted, #6b7280)">Nenhuma tramitação registrada ainda.</p>';
        } else {
            html += '<div class="table-responsive"><table class="styled-table modal-table tramitacao-table"><thead><tr>';
            html += '<th>Data</th><th>Tipo</th><th>CPC</th><th>Funcionário</th><th class="text-right" style="white-space:nowrap">Ações</th>';
            html += '</tr></thead><tbody>';
            list.forEach(function (t) {
                var pl = { id: t.id, tipo: t.tipo, cpc: t.cpc, data: t.data, descricao: t.descricao != null ? t.descricao : '' };
                var payload = escAttr(JSON.stringify(pl));
                html += '<tr class="tramitacao-row-main" data-tramit-payload="' + payload + '">';
                html += '<td>' + formatDateTime(t.data) + '</td>';
                html += '<td><span class="status-badge status-active">' + esc(t.tipo) + '</span></td>';
                html += '<td><span class="status-badge ' + cpcBadgeClass(t.cpc) + '">' + esc(t.cpc) + '</span></td>';
                html += '<td>' + esc(t.funcionario_nome) + '</td>';
                html += '<td class="text-right" style="white-space:nowrap">';
                html += '<button type="button" class="action-btn btn-sm btn-tramit-edit" title="Editar"><i class="fa-solid fa-pen"></i></button> ';
                html += '<button type="button" class="action-btn btn-sm btn-tramit-del" title="Excluir" style="color:#b91c1c"><i class="fa-solid fa-trash"></i></button>';
                html += '</td></tr>';
                html += '<tr class="tramitacao-row-desc"><td colspan="5">';
                html += '<span class="tramitacao-desc-label">Descrição:</span> ';
                html += '<span class="tramitacao-desc-text">' + esc(t.descricao) + '</span>';
                html += '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        html += '<div class="tramitacao-toolbar" style="margin-top:12px">';
        html += '<button type="button" class="action-btn btn-tramit-nova" style="background:var(--color-accent, #1e3a5f);color:#fff;border:0;padding:8px 14px;border-radius:6px">';
        html += '<i class="fa-solid fa-plus"></i> Nova tramitação</button></div>';

        var inpSt = 'width:100%;max-width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;font:inherit';
        html += '<div class="tramitacao-form-panel" data-tramit-form-wrap style="display:none;margin-top:16px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc">';
        html += '<h4 class="tramit-form-title" style="margin:0 0 12px;font-size:0.95rem">Nova tramitação</h4>';
        html += '<input type="hidden" class="tramit-form-id" value="">';
        html += '<div style="display:grid;gap:12px;max-width:100%">';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">Data e hora</label>';
        html += '<input class="tramit-in-data" type="datetime-local" required style="max-width:320px;' + inpSt + '"/></div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end">';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">Tipo</label>';
        html += '<select class="tramit-sel-tipo" style="min-width:160px;' + inpSt + '">';
        TIPOS.forEach(function (t) { html += '<option value="' + t + '">' + t + '</option>'; });
        html += '</select></div>';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">CPC</label>';
        html += '<select class="tramit-sel-cpc" style="min-width:160px;' + inpSt + '">';
        CPCS.forEach(function (c) { html += '<option value="' + c + '">' + c + '</option>'; });
        html += '</select></div></div>';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">Descrição</label>';
        html += '<textarea class="tramit-ta-desc" rows="3" style="' + inpSt + '"></textarea></div>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
        html += '<button type="button" class="action-btn tramit-btn-salvar" style="background:var(--color-accent, #1e3a5f);color:#fff;border:0">Salvar</button>';
        html += '<button type="button" class="action-btn tramit-btn-cancelar" style="border:1px solid #cbd5e1;background:#fff">Cancelar</button>';
        html += '</div>';
        html += '<p class="tramit-form-msg" style="margin:8px 0 0;font-size:0.85rem;color:#b91c1c;display:none"></p>';
        html += '</div></div>';

        html += '</div></div>';
        return html;
    }

    function attachModal(root, contratoId, options) {
        var o = defaultOptions(options);
        var onReload = o.onReload;
        if (!onReload) return;

        var section = root.querySelector('.tramitacao-section');
        if (!section) return;

        var formWrap = section.querySelector('[data-tramit-form-wrap]');
        if (!formWrap) return;

        var titleEl = formWrap.querySelector('.tramit-form-title');
        var idInput = formWrap.querySelector('.tramit-form-id');
        var inData = formWrap.querySelector('.tramit-in-data');
        var selTipo = formWrap.querySelector('.tramit-sel-tipo');
        var selCpc = formWrap.querySelector('.tramit-sel-cpc');
        var taDesc = formWrap.querySelector('.tramit-ta-desc');
        var msgEl = formWrap.querySelector('.tramit-form-msg');
        var btnNova = section.querySelector('.btn-tramit-nova');
        var btnSalvar = formWrap.querySelector('.tramit-btn-salvar');
        var btnCancelar = formWrap.querySelector('.tramit-btn-cancelar');

        function showForm() { formWrap.style.display = 'block'; }
        function hideForm() {
            formWrap.style.display = 'none';
            if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
        }
        function showMsg(text) {
            if (!msgEl) {
                if (text) { alert(text); }
                return;
            }
            msgEl.textContent = text || '';
            msgEl.style.display = text ? 'block' : 'none';
        }

        function openNovo() {
            if (idInput) idInput.value = '';
            if (titleEl) titleEl.textContent = 'Nova tramitação';
            if (inData) inData.value = defaultNowLocal();
            if (selTipo) selTipo.selectedIndex = 0;
            if (selCpc) selCpc.selectedIndex = 0;
            if (taDesc) taDesc.value = '';
            showMsg('');
            showForm();
        }

        function openEditar(payload) {
            if (idInput) idInput.value = String(payload.id);
            if (titleEl) titleEl.textContent = 'Editar tramitação';
            if (inData) inData.value = toDateTimeLocal(payload.data);
            if (selTipo && payload.tipo) selTipo.value = String(payload.tipo);
            if (selCpc && payload.cpc) selCpc.value = String(payload.cpc);
            if (taDesc) taDesc.value = payload.descricao != null ? String(payload.descricao) : '';
            showMsg('');
            showForm();
        }

        if (btnNova) {
            btnNova.addEventListener('click', function (e) {
                e.preventDefault();
                openNovo();
            });
        }
        if (btnCancelar) {
            btnCancelar.addEventListener('click', function (e) {
                e.preventDefault();
                hideForm();
            });
        }

        section.addEventListener('click', function (ev) {
            var t = ev.target;
            var ed = t && t.closest && t.closest('.btn-tramit-edit');
            if (ed) {
                ev.preventDefault();
                var tr = ed.closest('tr');
                if (!tr) return;
                var raw = tr.getAttribute('data-tramit-payload');
                if (!raw) return;
                var payload;
                try { payload = JSON.parse(raw); } catch (err) { return; }
                openEditar(payload);
                return;
            }
            var de = t && t.closest && t.closest('.btn-tramit-del');
            if (de) {
                ev.preventDefault();
                var tr2 = de.closest('tr');
                if (!tr2) return;
                var raw2 = tr2.getAttribute('data-tramit-payload');
                if (!raw2) return;
                var p2;
                try { p2 = JSON.parse(raw2); } catch (e2) { return; }
                if (!p2 || !p2.id) return;
                if (!global.confirm('Excluir esta tramitação?')) return;
                de.disabled = true;
                fetch('/api/tramitacao/' + encodeURIComponent(p2.id), { method: 'DELETE', credentials: 'same-origin' })
                    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j, status: r.status }; }); })
                    .then(function (res) {
                        if (!res.ok) {
                            var err = (res.j && (res.j.error || res.j.message)) || 'Erro ao excluir';
                            alert(err);
                            return;
                        }
                        onReload();
                    })
                    .catch(function () { alert('Falha de conexao ao excluir.'); })
                    .then(function () { de.disabled = false; });
            }
        });

        if (btnSalvar) {
            btnSalvar.addEventListener('click', function (e) {
                e.preventDefault();
                showMsg('');
                var idVal = idInput && idInput.value;
                if (!inData || !inData.value) {
                    showMsg('Informe data e hora.');
                    return;
                }
                var body = {
                    tipo: selTipo ? selTipo.value : 'ligacao',
                    cpc: selCpc ? selCpc.value : 'nao',
                    data: inData.value,
                    descricao: taDesc ? taDesc.value : ''
                };
                var method = idVal ? 'PUT' : 'POST';
                var url = idVal
                    ? '/api/tramitacao/' + encodeURIComponent(idVal)
                    : '/api/contrato/' + encodeURIComponent(contratoId) + '/tramitacao';
                btnSalvar.disabled = true;
                fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    credentials: 'same-origin',
                })
                    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
                    .then(function (res) {
                        if (!res.ok) {
                            var err = (res.j && (res.j.error || res.j.message)) || 'Nao foi possivel salvar.';
                            showMsg(err);
                            return;
                        }
                        hideForm();
                        onReload();
                    })
                    .catch(function () { showMsg('Falha de conexao ao salvar.'); })
                    .then(function () { btnSalvar.disabled = false; });
            });
        }
    }

    global.TramitacoesDetalhe = { buildSection: buildSection, attachModal: attachModal };
})(typeof window !== 'undefined' ? window : this);
