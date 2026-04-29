document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var page = 1;
    var perPage = 40;

    var sortAtivos = { col: 'data', dir: 'desc' };
    var sortHist = { col: 'data', dir: 'desc' };

    var negSearchForm = document.getElementById('negSearchForm');
    var negTipoBusca = document.getElementById('neg_tipo_busca');
    var negTermo = document.getElementById('neg_termo');
    var negEvento = document.getElementById('neg_evento');
    var negStatusAtivo = document.getElementById('neg_status_ativo');
    var negDataInicio = document.getElementById('neg_data_inicio');
    var negDataFim = document.getElementById('neg_data_fim');
    var negBtnLimpar = document.getElementById('negBtnLimpar');
    var negResultsSection = document.getElementById('negResultsSection');
    var negNoResults = document.getElementById('negNoResults');
    var negHistMeta = document.getElementById('negHistMeta');
    var negAtivosMeta = document.getElementById('negAtivosMeta');

    function esc(val) {
        if (val === null || val === undefined) return '';
        var div = document.createElement('div');
        div.textContent = String(val);
        return div.innerHTML;
    }

    function fmtDt(val) {
        if (!val) return '-';
        var parts = String(val).replace(' ', 'T').split('T');
        var d = parts[0];
        var ps = d.split('-');
        if (ps.length === 3) return ps[2] + '/' + ps[1] + '/' + ps[0];
        return val;
    }

    function tipoLabel(t) {
        var m = {
            negativado_manual: 'Negativado (manual)',
            negativado_tracker: 'Negativado (automatico)',
            removido_pagamento: 'Positivacao (pagamento)',
            removido_manual: 'Positivacao (manual)',
            observacao: 'Observacao'
        };
        return m[t] || (t || '-');
    }

    function statusAtivoLabel(s) {
        var m = {
            registrado_tracker: 'Negativado (tracker)',
            enviado: 'Negativado (envio)',
            falhou: 'Falha envio'
        };
        return m[s] || (s || '-');
    }

    function eventoLabel(ev) {
        var m = {
            todos: 'Todos',
            negativado: 'Negativados (qualquer)',
            positivado: 'Positivados (qualquer)',
            observacao: 'Observacao',
            negativado_manual: 'Negativado manual',
            negativado_tracker: 'Negativado (tracker)',
            removido_pagamento: 'Positivacao (pagamento)',
            removido_manual: 'Positivacao (manual)'
        };
        return m[ev] || ev;
    }

    function applyPlaceholder() {
        if (!negTipoBusca || !negTermo) return;
        if (negTipoBusca.value === 'texto') {
            negTermo.placeholder = 'Parte do texto do detalhe ou do tipo de evento...';
        } else {
            negTermo.placeholder = 'Grupo, cota ou numero do contrato (ex.: 027004/0040)';
        }
    }

    function buildFilterDesc(q) {
        var parts = [];
        if (q) parts.push('texto: "' + q + '"');
        if (negEvento && negEvento.value && negEvento.value !== 'todos') {
            parts.push('ocorrencia: ' + eventoLabel(negEvento.value));
        }
        if (negStatusAtivo && negStatusAtivo.value) {
            parts.push('status ativo: ' + negStatusAtivo.value);
        }
        if (negDataInicio && negDataInicio.value) {
            parts.push('de ' + negDataInicio.value);
        }
        if (negDataFim && negDataFim.value) {
            parts.push('ate ' + negDataFim.value);
        }
        return parts.length ? parts.join(' | ') : 'sem filtro extra';
    }

    function updateSortIndicators() {
        document.querySelectorAll('th.neg-sort').forEach(function (th) {
            var tbl = th.getAttribute('data-neg-table');
            var col = th.getAttribute('data-neg-sort');
            var ind = th.querySelector('.sort-ind');
            if (!ind) return;
            var active = (tbl === 'ativos' && sortAtivos.col === col && sortAtivos.dir) ||
                (tbl === 'hist' && sortHist.col === col && sortHist.dir);
            ind.textContent = active ? (tbl === 'ativos'
                ? (sortAtivos.dir === 'asc' ? '▲' : '▼')
                : (sortHist.dir === 'asc' ? '▲' : '▼')) : '';
        });
    }

    function renderAtivos(rows, filterDesc) {
        var tb = document.getElementById('negTbodyAtivos');
        if (!tb || !negAtivosMeta) return;
        negAtivosMeta.textContent = (rows && rows.length ? rows.length + ' registro(s)' : 'Nenhuma parcela negativada no momento.') +
            (filterDesc ? (' | ' + filterDesc) : '');
        tb.innerHTML = '';
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="7" style="color:#64748b">Sem registros.</td></tr>';
            updateSortIndicators();
            return;
        }
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            var gc = esc(r.grupo) + '/' + esc(r.cota);
            var idp = r.id_parcela;
            var idc = r.id_contrato;
            tr.innerHTML =
                '<td>' + gc + '</td>' +
                '<td>' + esc(r.numero_parcela != null ? r.numero_parcela : '-') + '</td>' +
                '<td>' + esc(r.dias_atraso != null ? r.dias_atraso : '-') + '</td>' +
                '<td><span class="status-badge status-danger">' + esc(statusAtivoLabel(r.status)) + '</span></td>' +
                '<td>' + fmtDt(r.data_negativacao) + '</td>' +
                '<td>' + esc(r.funcionario_nome || '-') + '</td>' +
                '<td class="text-right">' +
                '<button type="button" class="action-btn btn-neg-detalhe" data-contrato-id="' + esc(String(idc)) + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button> ' +
                '<button type="button" class="btn-neg-danger btn-neg-remover" data-id-parcela="' + esc(String(idp)) + '">Remover</button>' +
                '</td>';
            tb.appendChild(tr);
        });
        bindRemover(tb);
        bindDetalhes(tb);
        updateSortIndicators();
    }

    function renderHist(rows, filterDesc) {
        var tb = document.getElementById('negTbodyHist');
        if (!tb || !negHistMeta) return;
        negHistMeta.textContent = (rows && rows.length ? rows.length + ' evento(s) nesta pagina' : 'Nenhum evento.') +
            (filterDesc ? (' | ' + filterDesc) : '');
        tb.innerHTML = '';
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="7" style="color:#64748b">Sem registros.</td></tr>';
            updateSortIndicators();
            return;
        }
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            var gc = esc(r.grupo) + '/' + esc(r.cota);
            var idc = r.id_contrato;
            var tipo = r.tipo_evento || '';
            var badgeClass = (tipo.indexOf('removido') === 0) ? 'status-success' : 'status-danger';
            if (tipo === 'observacao') badgeClass = 'status-active';
            tr.innerHTML =
                '<td>' + fmtDt(r.data_evento) + '</td>' +
                '<td>' + gc + '</td>' +
                '<td>' + esc(r.numero_parcela != null ? r.numero_parcela : '-') + '</td>' +
                '<td><span class="status-badge ' + badgeClass + '">' + esc(tipoLabel(r.tipo_evento)) + '</span></td>' +
                '<td style="max-width:280px;white-space:normal">' + esc(r.detalhe || '-') + '</td>' +
                '<td>' + esc(r.funcionario_nome || '-') + '</td>' +
                '<td class="text-right">' +
                '<button type="button" class="action-btn btn-neg-detalhe" data-contrato-id="' + esc(String(idc)) + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button>' +
                '</td>';
            tb.appendChild(tr);
        });
        bindDetalhes(tb);
        updateSortIndicators();
    }

    function bindDetalhes(container) {
        container.querySelectorAll('.btn-neg-detalhe').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = parseInt(btn.getAttribute('data-contrato-id'), 10);
                if (!id || typeof window.ContratoDetalhesModal === 'undefined' || !window.ContratoDetalhesModal.open) return;
                window.ContratoDetalhesModal.open(id);
            });
        });
    }

    function bindRemover(container) {
        container.querySelectorAll('.btn-neg-remover').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idParcela = parseInt(btn.getAttribute('data-id-parcela'), 10);
                if (!idParcela || !window.confirm(
                    'Remover esta negativacao do cadastro interno? Sera registrado um evento de positivacao (manual).'
                )) return;
                fetch('/api/negativacao/remover-manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_parcela: idParcela,
                        motivo: 'Remocao manual pelo modulo Negativacao.'
                    })
                }).then(function (res) { return res.json().then(function (j) { return { res: res, j: j }; }); })
                    .then(function (o) {
                        if (!o.res.ok) throw new Error(o.j.error || o.res.statusText);
                        load();
                    })
                    .catch(function (e) { alert(e.message || String(e)); });
            });
        });
    }

    function load() {
        var tipoBusca = negTipoBusca ? negTipoBusca.value : 'contrato';
        var q = negTermo ? negTermo.value.trim() : '';
        var params = new URLSearchParams({
            page: String(page),
            per_page: String(perPage),
            q: q,
            tipo_busca: tipoBusca,
            sort_hist: sortHist.col,
            order_hist: sortHist.dir,
            sort_ativos: sortAtivos.col,
            order_ativos: sortAtivos.dir
        });
        if (negEvento && negEvento.value) params.set('evento', negEvento.value);
        if (negStatusAtivo && negStatusAtivo.value) params.set('status_ativo', negStatusAtivo.value);
        if (negDataInicio && negDataInicio.value) params.set('data_inicio', negDataInicio.value);
        if (negDataFim && negDataFim.value) params.set('data_fim', negDataFim.value);

        if (negHistMeta) negHistMeta.textContent = 'Carregando...';
        if (negAtivosMeta) negAtivosMeta.textContent = 'Carregando...';

        var fd = buildFilterDesc(q);

        fetch('/api/negativacao/listagem?' + params.toString())
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var total = data.total_historico != null ? data.total_historico : 0;
                var maxPage = Math.max(1, Math.ceil(total / perPage));
                if (page > maxPage) {
                    page = maxPage;
                    return load();
                }

                var ativos = data.ativos || [];
                var hist = data.historico || [];

                renderAtivos(ativos, fd);
                renderHist(hist, fd);

                var info = document.getElementById('negPageInfo');
                if (info) {
                    info.textContent = 'Pagina ' + page + ' de ' + maxPage + ' / ' + total + ' evento(s) no historico';
                }

                var empty = ativos.length === 0 && hist.length === 0;
                if (negNoResults) {
                    negNoResults.classList.toggle('d-none', !empty);
                }
            })
            .catch(function (e) {
                console.error(e);
                if (negHistMeta) negHistMeta.textContent = 'Erro ao carregar.';
                if (negAtivosMeta) negAtivosMeta.textContent = '';
            });
    }

    function onSortClick(th) {
        var tbl = th.getAttribute('data-neg-table');
        var col = th.getAttribute('data-neg-sort');
        if (!tbl || !col) return;
        if (tbl === 'ativos') {
            if (sortAtivos.col === col) {
                sortAtivos.dir = sortAtivos.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortAtivos.col = col;
                sortAtivos.dir = 'desc';
            }
        } else if (tbl === 'hist') {
            if (sortHist.col === col) {
                sortHist.dir = sortHist.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortHist.col = col;
                sortHist.dir = 'desc';
            }
            page = 1;
        }
        load();
    }

    document.querySelectorAll('#negTableAtivos thead, #negTableHist thead').forEach(function (thead) {
        thead.addEventListener('click', function (e) {
            var th = e.target.closest('th.neg-sort');
            if (!th || !thead.contains(th)) return;
            e.preventDefault();
            onSortClick(th);
        });
    });

    if (negTipoBusca && negTermo) {
        negTipoBusca.addEventListener('change', applyPlaceholder);
        applyPlaceholder();
    }

    if (negSearchForm) {
        negSearchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            page = 1;
            if (negResultsSection) negResultsSection.classList.remove('d-none');
            load();
        });
    }

    if (negBtnLimpar) {
        negBtnLimpar.addEventListener('click', function () {
            if (negTermo) negTermo.value = '';
            if (negEvento) negEvento.value = 'todos';
            if (negStatusAtivo) negStatusAtivo.value = '';
            if (negDataInicio) negDataInicio.value = '';
            if (negDataFim) negDataFim.value = '';
            page = 1;
            sortAtivos = { col: 'data', dir: 'desc' };
            sortHist = { col: 'data', dir: 'desc' };
            if (negResultsSection) negResultsSection.classList.add('d-none');
            var tbA = document.getElementById('negTbodyAtivos');
            var tbH = document.getElementById('negTbodyHist');
            if (tbA) tbA.innerHTML = '';
            if (tbH) tbH.innerHTML = '';
            if (negNoResults) negNoResults.classList.add('d-none');
            updateSortIndicators();
        });
    }

    var prev = document.getElementById('negPrevPage');
    var next = document.getElementById('negNextPage');
    function resultsVisible() {
        return negResultsSection && !negResultsSection.classList.contains('d-none');
    }
    if (prev) prev.addEventListener('click', function () {
        if (!resultsVisible()) return;
        if (page > 1) { page--; load(); }
    });
    if (next) next.addEventListener('click', function () {
        if (!resultsVisible()) return;
        page++;
        load();
    });

    var formObs = document.getElementById('negObsForm');
    if (formObs) {
        formObs.addEventListener('submit', function (e) {
            e.preventDefault();
            var cid = parseInt(document.getElementById('negObsContratoId').value, 10);
            var txt = (document.getElementById('negObsTexto').value || '').trim();
            var msg = document.getElementById('negObsMsg');
            if (!cid || !txt) return;
            fetch('/api/negativacao/observacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_contrato: cid, detalhe: txt })
            }).then(function (res) { return res.json().then(function (j) { return { res: res, j: j }; }); })
                .then(function (o) {
                    if (!o.res.ok) throw new Error(o.j.error || o.res.statusText);
                    if (msg) {
                        msg.style.display = 'block';
                        msg.style.color = '#047857';
                        msg.textContent = 'Observacao registrada.';
                    }
                    document.getElementById('negObsTexto').value = '';
                    if (negResultsSection && !negResultsSection.classList.contains('d-none')) load();
                })
                .catch(function (err) {
                    if (msg) {
                        msg.style.display = 'block';
                        msg.style.color = '#b91c1c';
                        msg.textContent = err.message || String(err);
                    }
                });
        });
    }

    updateSortIndicators();
});
