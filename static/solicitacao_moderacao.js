/**
 * Pedidos de moderacao: perfil Cobranca envia alteracao/exclusao de tramitacao ou agenda;
 * Gestor/Administrador aprova ou reprova na pagina Solicitacoes.
 */
(function () {
    function esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    var TIPO_LABEL = {
        tramitacao_edit: 'Alterar tramitaùùo',
        tramitacao_delete: 'Excluir tramitaùùo',
        agenda_edit: 'Alterar agendamento',
        agenda_delete: 'Excluir agendamento'
    };

    function fmtTipo(t) {
        return TIPO_LABEL[t] || esc(t) || 'ù';
    }

    function fmtCtr(r) {
        var g = r.grupo != null ? String(r.grupo) : '';
        var ct = r.cota != null ? String(r.cota) : '';
        if (!g && !ct) return 'ù';
        return esc(g + '/' + ct);
    }

    function fmtDt(r) {
        if (!r.created_at) return 'ù';
        var s = String(r.created_at).replace('T', ' ');
        return esc(s.length > 19 ? s.slice(0, 19) : s);
    }

    function fmtStatus(st) {
        var m = {
            pendente: 'Pendente',
            aprovado: 'Aprovado',
            reprovado: 'Reprovado'
        };
        return m[st] || esc(st);
    }

    document.addEventListener('DOMContentLoaded', function () {
        var cfgEl = document.getElementById('solic-moderacao-cfg');
        var cfg = { pode_revisar: false, eh_cobranca: false };
        try {
            if (cfgEl && cfgEl.textContent) {
                cfg = Object.assign(cfg, JSON.parse(cfgEl.textContent));
            }
        } catch (e) { /* ignore */ }

        function loadPendentes() {
            var wrap = document.getElementById('moderacaoPendenteWrap');
            var body = document.getElementById('moderacaoPendenteBody');
            var cnt = document.getElementById('moderacaoPendenteCount');
            if (!cfg.pode_revisar || !wrap || !body) return;
            wrap.style.display = '';
            body.innerHTML = '<tr><td colspan="6" class="text-center">Carregandoù</td></tr>';
            fetch('/api/solicitacao/moderacao/pendentes', { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.error) {
                        body.innerHTML = '<tr><td colspan="6" class="text-center" style="color:#dc2626">' +
                            esc(data.error) + '</td></tr>';
                        return;
                    }
                    var rows = data.results || [];
                    if (cnt) cnt.textContent = String(rows.length);
                    if (rows.length === 0) {
                        body.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum pedido pendente.</td></tr>';
                        return;
                    }
                    body.innerHTML = '';
                    rows.forEach(function (row) {
                        var tr = document.createElement('tr');
                        var pj = '';
                        try {
                            if (row.payload_json) pj = JSON.stringify(JSON.parse(row.payload_json), null, 2);
                        } catch (e) {
                            pj = String(row.payload_json || '');
                        }
                        tr.innerHTML =
                            '<td>' + esc(row.id) + '</td>' +
                            '<td>' + fmtTipo(row.tipo) + '</td>' +
                            '<td>' + fmtCtr(row) + '</td>' +
                            '<td>' + esc(row.solicitante_nome || '') + '</td>' +
                            '<td>' + fmtDt(row) + '</td>' +
                            '<td style="white-space:nowrap">' +
                            '<button type="button" class="btn-search" style="margin-right:6px;background:#15803d;border-color:#15803d" ' +
                            'data-mod-aprov="' + esc(row.id) + '" data-mod-acao="aprovar">Aprovar</button>' +
                            '<button type="button" class="action-btn" style="background:#b91c1c;color:#fff;border:none" ' +
                            'data-mod-aprov="' + esc(row.id) + '" data-mod-acao="reprovar">Desaprovar</button>' +
                            '</td>';
                        body.appendChild(tr);
                        if (pj) {
                            var trd = document.createElement('tr');
                            trd.innerHTML = '<td colspan="6" style="background:#f8fafc;font-size:0.8rem"><pre style="margin:0;white-space:pre-wrap;max-height:160px;overflow:auto">' +
                                esc(pj) + '</pre></td>';
                            body.appendChild(trd);
                        }
                    });
                })
                .catch(function () {
                    body.innerHTML = '<tr><td colspan="6" class="text-center" style="color:#dc2626">Erro ao carregar pedidos.</td></tr>';
                });
        }

        function loadMinhas() {
            var wrap = document.getElementById('moderacaoMinhasWrap');
            var body = document.getElementById('moderacaoMinhasBody');
            if (!cfg.eh_cobranca || !wrap || !body) return;
            wrap.style.display = '';
            body.innerHTML = '<tr><td colspan="5" class="text-center">Carregandoù</td></tr>';
            fetch('/api/solicitacao/moderacao/minhas', { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.error) {
                        body.innerHTML = '<tr><td colspan="5" class="text-center" style="color:#dc2626">' +
                            esc(data.error) + '</td></tr>';
                        return;
                    }
                    var rows = data.results || [];
                    if (rows.length === 0) {
                        body.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum pedido registrado.</td></tr>';
                        return;
                    }
                    body.innerHTML = '';
                    rows.forEach(function (row) {
                        var tr = document.createElement('tr');
                        var extra = '';
                        if (row.status === 'reprovado' && row.motivo_reprovacao) {
                            extra = '<br><small style="color:#64748b">' + esc(row.motivo_reprovacao) + '</small>';
                        }
                        tr.innerHTML =
                            '<td>' + esc(row.id) + '</td>' +
                            '<td>' + fmtTipo(row.tipo) + '</td>' +
                            '<td>' + fmtCtr(row) + '</td>' +
                            '<td>' + fmtStatus(row.status) + extra + '</td>' +
                            '<td>' + fmtDt(row) + '</td>';
                        body.appendChild(tr);
                    });
                })
                .catch(function () {
                    body.innerHTML = '<tr><td colspan="5" class="text-center" style="color:#dc2626">Erro ao carregar.</td></tr>';
                });
        }

        function decisao(mid, acao) {
            var motivo = null;
            if (acao === 'reprovar') {
                motivo = window.prompt('Motivo da reprovaùùo (obrigatùrio):');
                if (motivo === null) return;
                motivo = motivo.trim();
                if (!motivo) {
                    alert('Informe o motivo.');
                    return;
                }
            }
            if (acao === 'aprovar' && !window.confirm('Confirmar aprovaùùo e aplicar a alteraùùo no sistema?')) return;

            fetch('/api/solicitacao/moderacao/' + encodeURIComponent(mid) + '/decisao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ acao: acao, motivo: motivo })
            })
                .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
                .then(function (o) {
                    if (!o.ok) {
                        alert(o.j.error || 'Erro ao processar.');
                        return;
                    }
                    alert(acao === 'aprovar' ? 'Pedido aprovado e aplicado.' : 'Pedido reprovado.');
                    loadPendentes();
                    loadMinhas();
                })
                .catch(function () {
                    alert('Erro de rede.');
                });
        }

        var pendBody = document.getElementById('moderacaoPendenteBody');
        if (pendBody) {
            pendBody.addEventListener('click', function (ev) {
                var b = ev.target.closest('[data-mod-aprov]');
                if (!b) return;
                ev.preventDefault();
                decisao(b.getAttribute('data-mod-aprov'), b.getAttribute('data-mod-acao'));
            });
        }

        loadPendentes();
        loadMinhas();
    });
})();
