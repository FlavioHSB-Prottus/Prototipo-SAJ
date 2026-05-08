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

    /** Rotulos amigaveis para chaves do snapshot / fluxo (UTF-8). */
    var LABEL_CAMPO = {
        id: 'ID',
        carteira: 'Carteira (valor)',
        discado: 'Discado',
        atendido: 'Atendido',
        tipo: 'Tipo',
        cpc: 'CPC',
        contato: 'Contato',
        exito: '\u00caxito',
        status: 'Status',
        descricao: 'Descri\u00e7\u00e3o',
        classificacao: 'Classifica\u00e7\u00e3o',
        id_contrato: 'ID contrato',
        id_funcionario: 'ID funcion\u00e1rio',
        created_at: 'Criado em',
        updated_at: 'Atualizado em',
        fluxo_json: 'Fluxo (formul\u00e1rio)',
        status_tramitacao: 'Status tramita\u00e7\u00e3o',
        funcionario_nome: 'Funcion\u00e1rio'
    };

    var LABEL_FLUXO = {
        carteira_devendo: 'Carteira devendo',
        numero_discado: 'N\u00famero discado',
        atendido: 'Atendido',
        modo_indefinido: 'Modo indefinido',
        cpc_correto: 'CPC correto',
        cpc_qual: 'CPC qual',
        cpc_quem: 'CPC quem',
        cpc_etapa_descricao: 'CPC etapa',
        status_final: 'Status final',
        agenda_retorno_data: 'Agenda  retorno',
        agenda_retorno_atividade: 'Atividade',
        acordo_data_pagamento: 'Acordo  data pagamento',
        acordo_qtd_parcelas: 'Acordo  qtd parcelas',
        descricao_final: 'Descri\u00e7\u00e3o final'
    };

    var TIPO_LABEL = {
        tramitacao_edit: 'Alterar Tramita\u00e7\u00e3o',
        tramitacao_delete: 'Excluir Tramita\u00e7\u00e3o',
        agenda_edit: 'Alterar Agendamento',
        agenda_delete: 'Excluir Agendamento'
    };

    function fmtTipo(t) {
        return esc(TIPO_LABEL[t] || t || '\u2014');
    }

    function fmtCtr(r) {
        var g = r.grupo != null ? String(r.grupo) : '';
        var ct = r.cota != null ? String(r.cota) : '';
        if (!g && !ct) return '\u2014';
        return esc(g + '/' + ct);
    }

    function fmtDt(r) {
        if (!r.created_at) return '\u2014';
        var s = String(r.created_at).replace('T', ' ');
        return esc(s.length > 19 ? s.slice(0, 19) : s);
    }

    function fmtStatus(st) {
        var m = {
            pendente: 'Pendente',
            aprovado: 'Aprovado',
            reprovado: 'Reprovado'
        };
        return esc(m[st] || st);
    }

    /** Valores vindos do MySQL/bit (\u0001) viram texto legivel. */
    function fmtValorModeracao(v) {
        if (v === null || v === undefined) return '\u2014';
        if (typeof v === 'boolean') return v ? 'Sim' : 'N\u00e3o';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'string') {
            var t = v.replace(/\u0001/g, 'Sim').replace(/\u0000/g, '').trim();
            return t === '' ? '\u2014' : t;
        }
        return esc(JSON.stringify(v));
    }

    function appendDl(parts, obj, labelMap) {
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach(function (k) {
            if (k === 'fluxo_json') return;
            var raw = obj[k];
            var lb = (labelMap && labelMap[k]) || LABEL_CAMPO[k] || k;
            var dd;
            if (raw !== null && typeof raw === 'object') {
                dd = '<pre style="margin:0;font-size:0.78rem;white-space:pre-wrap">' +
                    esc(JSON.stringify(raw, null, 2)) + '</pre>';
            } else {
                dd = esc(fmtValorModeracao(raw)).replace(/\r\n/g, '\n').split('\n').join('<br>');
            }
            parts.push('<dt>' + esc(lb) + '</dt><dd>' + dd + '</dd>');
        });
    }

    function htmlFluxoInterno(fj) {
        if (!fj || typeof fj !== 'object') return '';
        var parts = ['<div class="mod-payload-sub"><strong>Detalhes do fluxo</strong><dl class="mod-payload-dl">'];
        Object.keys(fj).forEach(function (k) {
            var lb = LABEL_FLUXO[k] || LABEL_CAMPO[k] || k;
            var v = fj[k];
            var dd = v !== null && typeof v === 'object'
                ? '<pre style="margin:0;font-size:0.76rem;white-space:pre-wrap">' +
                  esc(JSON.stringify(v, null, 2)) + '</pre>'
                : esc(fmtValorModeracao(v));
            parts.push('<dt>' + esc(lb) + '</dt><dd>' + dd + '</dd>');
        });
        parts.push('</dl></div>');
        return parts.join('');
    }

    /** HTML legivel para o payload (antes/depois); sem expor JSON cru na celula da tabela. */
    function buildPayloadDetailHtml(payloadJsonStr) {
        var o = null;
        try {
            if (payloadJsonStr == null || payloadJsonStr === '') {
                return '<p class="mod-payload-detail" style="color:#64748b;margin:0">\u2014 Sem dados adicionais.</p>';
            }
            o = typeof payloadJsonStr === 'string' ? JSON.parse(payloadJsonStr) : payloadJsonStr;
        } catch (e) {
            return '<p style="color:#b91c1c;margin:0">N\u00e3o foi poss\u00edvel ler os dados do pedido.</p>';
        }

        var sections = [];

        function oneBlock(title, obj) {
            if (!obj || typeof obj !== 'object') return;
            var parts = ['<section><h4>' + esc(title) + '</h4><dl class="mod-payload-dl">'];
            appendDl(parts, obj, null);
            var fjRaw = obj.fluxo_json;
            parts.push('</dl>');
            if (fjRaw != null && fjRaw !== '') {
                try {
                    var fj = typeof fjRaw === 'string' ? JSON.parse(fjRaw) : fjRaw;
                    parts.push(htmlFluxoInterno(fj));
                } catch (e2) {
                    parts.push('<div class="mod-payload-sub"><strong>Fluxo (texto)</strong><p style="margin:0;word-break:break-word">' +
                        esc(String(fjRaw)) + '</p></div>');
                }
            }
            parts.push('</section>');
            sections.push(parts.join(''));
        }

        oneBlock('Estado de refer\u00eancia (antes)', o.antes);
        oneBlock('Altera\u00e7\u00e3o proposta (depois)', o.depois);

        if (sections.length === 0) {
            return '<p style="color:#64748b;margin:0">\u2014 Sem dados estruturados.</p>';
        }
        return '<div class="mod-payload-detail">' + sections.join('') + '</div>';
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
            body.innerHTML = '<tr><td colspan="7" class="text-center">Carregando\u2026</td></tr>';
            fetch('/api/solicitacao/moderacao/pendentes', { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.error) {
                        body.innerHTML = '<tr><td colspan="7" class="text-center" style="color:#dc2626">' +
                            esc(data.error) + '</td></tr>';
                        return;
                    }
                    var rows = data.results || [];
                    if (cnt) cnt.textContent = String(rows.length);
                    if (rows.length === 0) {
                        body.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum pedido pendente.</td></tr>';
                        return;
                    }
                    body.innerHTML = '';
                    rows.forEach(function (row) {
                        var tr = document.createElement('tr');
                        tr.innerHTML =
                            '<td>' +
                            '<button type="button" class="mod-detail-toggle" aria-expanded="false" ' +
                            'title="Mostrar ou ocultar dados do contrato">' +
                            '<i class="fa-solid fa-chevron-down" aria-hidden="true"></i>' +
                            '</button></td>' +
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

                        var trDetail = document.createElement('tr');
                        trDetail.className = 'mod-pend-detail-row d-none';
                        trDetail.innerHTML =
                            '<td colspan="7" class="mod-pend-detail-cell">' +
                            buildPayloadDetailHtml(row.payload_json) +
                            '</td>';

                        body.appendChild(tr);
                        body.appendChild(trDetail);
                    });
                })
                .catch(function () {
                    body.innerHTML = '<tr><td colspan="7" class="text-center" style="color:#dc2626">Erro ao carregar pedidos.</td></tr>';
                });
        }

        function loadMinhas() {
            var wrap = document.getElementById('moderacaoMinhasWrap');
            var body = document.getElementById('moderacaoMinhasBody');
            if (!cfg.eh_cobranca || !wrap || !body) return;
            wrap.style.display = '';
            body.innerHTML = '<tr><td colspan="5" class="text-center">Carregando\u2026</td></tr>';
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
                motivo = window.prompt('Motivo da reprova\u00e7\u00e3o (obrigat\u00f3rio):');
                if (motivo === null) return;
                motivo = motivo.trim();
                if (!motivo) {
                    alert('Informe o motivo.');
                    return;
                }
            }
            if (acao === 'aprovar' && !window.confirm('Confirmar aprova\u00e7\u00e3o e aplicar a altera\u00e7\u00e3o no sistema?')) return;

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
                var tbtn = ev.target.closest('.mod-detail-toggle');
                if (tbtn && pendBody.contains(tbtn)) {
                    ev.preventDefault();
                    var tr = tbtn.closest('tr');
                    if (!tr) return;
                    var detail = tr.nextElementSibling;
                    if (!detail || !detail.classList.contains('mod-pend-detail-row')) return;
                    var open = detail.classList.toggle('d-none') === false;
                    tbtn.setAttribute('aria-expanded', open ? 'true' : 'false');
                    var ic = tbtn.querySelector('i');
                    if (ic) {
                        ic.className = open ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
                    }
                    return;
                }

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
