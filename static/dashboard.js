document.addEventListener('DOMContentLoaded', async function () {

    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.scale.grid.color = 'rgba(226, 232, 240, 0.5)';

    // --- Elementos ---
    var kpiAbertos = document.getElementById('kpiAbertos');
    var kpiPagos = document.getElementById('kpiPagos');
    var kpiIndenizados = document.getElementById('kpiIndenizados');
    var kpiNovos = document.getElementById('kpiNovos');
    var kpiRetomados = document.getElementById('kpiRetomados');
    var kpiPagosParcial = document.getElementById('kpiPagosParcial');
    var kpiPagosPeriodo = document.getElementById('kpiPagosPeriodo');
    var kpiPagosParcPeriodo = document.getElementById('kpiPagosParcPeriodo');
    var kpiIndenizadosPeriodo = document.getElementById('kpiIndenizadosPeriodo');
    var kpiNovosPeriodo = document.getElementById('kpiNovosPeriodo');
    var kpiRetomadosPeriodo = document.getElementById('kpiRetomadosPeriodo');

    var lineChartTitleEl = document.getElementById('lineChartTitle');
    var lineChartSubtitleEl = document.getElementById('lineChartSubtitle');
    var pieChartSubtitleEl = document.getElementById('pieChartSubtitle');

    var seriesSelector = document.getElementById('seriesSelector');
    var pieSelector = document.getElementById('pieSelector');
    var periodoInicio = document.getElementById('periodoInicio');
    var periodoFim = document.getElementById('periodoFim');
    var presetBtns = document.querySelectorAll('.preset-btn');
    var btnResetControles = document.getElementById('btnResetControles');

    // --- Catalogo de series plotaveis ---
    var SERIES_META = {
        pagos:            { label: 'Contratos pagos',         color: '#10b981' },
        indenizados:      { label: 'Contratos indenizados',   color: '#f59e0b' },
        pagos_parcial:    { label: 'Contratos pagos parcialmente', color: '#14b8a6' },
        novos:            { label: 'Novo (ocorr. abertas)',     color: '#3b82f6' },
        retomados:        { label: 'Voltou (ocorr. abertas)',   color: '#8b5cf6' },
        entradas_safra:  { label: 'Entradas (safra, distintos)', color: '#0d9488' },
    };

    var PIE_META = {
        cobranca:   { label: 'Em Cobrança', color: '#3b82f6' },
        pago:       { label: 'Pagos',       color: '#10b981' },
        indenizado: { label: 'Indenizados', color: '#f59e0b' },
        aberto:     { label: 'Em Cobrança', color: '#3b82f6' },
        fechado:    { label: 'Pagos',       color: '#10b981' },
    };

    // --- Carrega dados ---
    var data;
    try {
        var resp = await fetch('/api/dashboard');
        data = await resp.json();
    } catch (err) {
        kpiAbertos.textContent = 'Erro';
        return;
    }

    var meses = data.meses || [];                  // ['2025-06', '2025-07', ...]
    var series = data.series || {};                // { pagos, indenizados, novos, retomados, entradas_safra }
    var ambosMesSafra = data.ambos_mes_safra || []; // contratos c/ novo e voltou no mesmo mes
    var snapshot = data.snapshot || {};
    var pieRaw = data.pie_chart || {};

    kpiAbertos.textContent = formatNumber(snapshot.em_cobranca);

    // --- Estado dos controles (padrao: pagos+indenizados, ultimos 6 meses, todas as fatias) ---
    var selectedSeries = {
        pagos: true, indenizados: true, pagos_parcial: false, novos: false, retomados: false, entradas_safra: false,
    };
    var pieSelection = {};
    Object.keys(pieRaw).forEach(function (k) { pieSelection[k] = true; });

    var defaultStartIdx = Math.max(0, meses.length - 6);
    var defaultEndIdx = Math.max(0, meses.length - 1);
    var periodStart = meses[defaultStartIdx] || null;
    var periodEnd = meses[defaultEndIdx] || null;

    // Popula selects de periodo
    meses.forEach(function (m) {
        var optA = document.createElement('option');
        optA.value = m; optA.textContent = humanMonth(m);
        periodoInicio.appendChild(optA);
        var optB = document.createElement('option');
        optB.value = m; optB.textContent = humanMonth(m);
        periodoFim.appendChild(optB);
    });
    if (periodStart) periodoInicio.value = periodStart;
    if (periodEnd) periodoFim.value = periodEnd;

    // Popula seletor da pizza (baseado no que veio do backend)
    renderPieSelector();

    // --- Instancias Chart.js ---
    var lineChart = null;
    var pieChart = null;

    // --- Inicializa graficos ---
    refreshAll();

    // ========================================================================
    //                          CONTROLES / EVENTOS
    // ========================================================================

    seriesSelector.addEventListener('change', function (e) {
        var cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        var key = cb.getAttribute('data-serie');
        if (!key) return;
        selectedSeries[key] = cb.checked;
        refreshAll();
    });

    pieSelector.addEventListener('change', function (e) {
        var cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        var key = cb.getAttribute('data-pie');
        if (!key) return;
        pieSelection[key] = cb.checked;
        refreshPie();
    });

    periodoInicio.addEventListener('change', function () {
        periodStart = periodoInicio.value;
        if (meses.indexOf(periodStart) > meses.indexOf(periodEnd)) {
            periodEnd = periodStart;
            periodoFim.value = periodStart;
        }
        clearPresetActive();
        refreshAll();
    });

    periodoFim.addEventListener('change', function () {
        periodEnd = periodoFim.value;
        if (meses.indexOf(periodEnd) < meses.indexOf(periodStart)) {
            periodStart = periodEnd;
            periodoInicio.value = periodEnd;
        }
        clearPresetActive();
        refreshAll();
    });

    presetBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var n = parseInt(btn.getAttribute('data-preset'), 10);
            if (!n || !meses.length) return;
            var endIdx = meses.length - 1;
            var startIdx = Math.max(0, endIdx - n + 1);
            periodStart = meses[startIdx];
            periodEnd = meses[endIdx];
            periodoInicio.value = periodStart;
            periodoFim.value = periodEnd;
            presetBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            refreshAll();
        });
    });

    btnResetControles.addEventListener('click', function () {
        selectedSeries = {
            pagos: true, indenizados: true, pagos_parcial: false, novos: false, retomados: false, entradas_safra: false,
        };
        seriesSelector.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
            cb.checked = !!selectedSeries[cb.getAttribute('data-serie')];
        });
        Object.keys(pieSelection).forEach(function (k) { pieSelection[k] = true; });
        pieSelector.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
        periodStart = meses[defaultStartIdx] || null;
        periodEnd = meses[defaultEndIdx] || null;
        if (periodStart) periodoInicio.value = periodStart;
        if (periodEnd) periodoFim.value = periodEnd;
        clearPresetActive();
        refreshAll();
    });

    function clearPresetActive() {
        presetBtns.forEach(function (b) { b.classList.remove('active'); });
    }

    function renderPieSelector() {
        pieSelector.innerHTML = '';
        var keys = Object.keys(pieRaw);
        if (!keys.length) {
            pieSelector.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem">Nenhum status disponível.</span>';
            return;
        }
        keys.forEach(function (key) {
            var meta = PIE_META[key] || { label: key, color: '#64748b' };
            var label = document.createElement('label');
            label.className = 'chip-option';
            label.innerHTML =
                '<input type="checkbox" data-pie="' + esc(key) + '" checked>' +
                '<span class="chip-dot" style="background:' + meta.color + '"></span>' +
                '<span>' + esc(meta.label) + ' <small style="color:var(--text-muted)">(' + formatNumber(pieRaw[key]) + ')</small></span>';
            pieSelector.appendChild(label);
        });
    }

    // ========================================================================
    //                         RECALCULO / RENDER
    // ========================================================================

    function getPeriodIndices() {
        var i = meses.indexOf(periodStart);
        var j = meses.indexOf(periodEnd);
        if (i < 0) i = 0;
        if (j < 0) j = meses.length - 1;
        if (i > j) { var t = i; i = j; j = t; }
        return { start: i, end: j };
    }

    function refreshAll() {
        refreshKpis();
        refreshLineChart();
        refreshPie();
        if (typeof window.painelListaRefresh === 'function') window.painelListaRefresh();
    }

    function refreshKpis() {
        var idx = getPeriodIndices();
        function sumSerie(key) {
            var arr = series[key] || [];
            var s = 0;
            for (var i = idx.start; i <= idx.end; i++) s += (arr[i] || 0);
            return s;
        }
        kpiPagos.textContent = formatNumber(sumSerie('pagos'));
        if (kpiPagosParcial) kpiPagosParcial.textContent = formatNumber(sumSerie('pagos_parcial'));
        kpiIndenizados.textContent = formatNumber(sumSerie('indenizados'));
        kpiNovos.textContent = formatNumber(sumSerie('novos'));
        kpiRetomados.textContent = formatNumber(sumSerie('retomados'));

        var label = periodLabel();
        kpiPagosPeriodo.textContent = '(' + label + ')';
        if (kpiPagosParcPeriodo) kpiPagosParcPeriodo.textContent = '(' + label + ')';
        kpiIndenizadosPeriodo.textContent = '(' + label + ')';
        kpiNovosPeriodo.textContent = '(' + label + ')';
        kpiRetomadosPeriodo.textContent = '(' + label + ')';

        // Dim/highlight KPI cards conforme a serie esta selecionada ou nao
        document.querySelectorAll('.kpi-row .kpi-card').forEach(function (card) {
            var k = card.getAttribute('data-kpi');
            if (k === 'em_cobranca') { card.classList.remove('dimmed'); return; }
            if (selectedSeries[k]) card.classList.remove('dimmed');
            else card.classList.add('dimmed');
        });
    }

    function refreshLineChart() {
        var idx = getPeriodIndices();
        var slicedLabels = meses.slice(idx.start, idx.end + 1).map(humanMonth);
        var activeKeys = Object.keys(selectedSeries).filter(function (k) { return selectedSeries[k]; });

        var datasets = activeKeys.map(function (key) {
            var meta = SERIES_META[key];
            var arr = (series[key] || []).slice(idx.start, idx.end + 1);
            return {
                label: meta.label,
                data: arr,
                borderColor: meta.color,
                backgroundColor: hexToRgba(meta.color, 0.12),
                borderWidth: 2,
                tension: 0.4,
                fill: activeKeys.length === 1,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: meta.color,
                pointBorderWidth: 2,
                pointRadius: 4
            };
        });

        lineChartTitleEl.textContent = 'Evolução: ' + (activeKeys.length
            ? activeKeys.map(function (k) { return SERIES_META[k].label; }).join(' × ')
            : 'selecione uma série');
        lineChartSubtitleEl.textContent = periodLabel();

        var ctx = document.getElementById('lineChart');
        if (!ctx) return;

        if (lineChart) lineChart.destroy();
        lineChart = new Chart(ctx, {
            type: 'line',
            data: { labels: slicedLabels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        padding: 12, titleFont: { size: 13 }, bodyFont: { size: 13 }, cornerRadius: 8,
                        callbacks: {
                            afterBody: function (ctx) {
                                if (!ctx.length) return [];
                                var idxI = (ctx[0] && ctx[0].dataIndex) != null ? ctx[0].dataIndex : 0;
                                var keys = getPeriodIndices();
                                var mi = (keys.start + idxI);
                                if (mi < 0 || mi >= meses.length) return [];
                                var m = meses[mi];
                                if (!m) return [];
                                var nov = (series.novos || [])[mi] || 0;
                                var ret = (series.retomados || [])[mi] || 0;
                                var dist = (series.entradas_safra || [])[mi];
                                var ab = (ambosMesSafra[mi] != null) ? ambosMesSafra[mi] : 0;
                                var out = [''];
                                if (ab > 0) {
                                    out.push(
                                        'Dupla entrada no mês: ' + formatNumber(ab) +
                                        ' contrato(s) com ocorr. de novo e de voltou (abertas) — alinhado ao Relatórios.'
                                    );
                                }
                                if (dist != null) {
                                    out.push(
                                        'Soma ocorr. novo + ocorr. voltou = ' + formatNumber(nov + ret) +
                                        '; 1 ctt. dist. (entradas safra) = ' + formatNumber(dist) +
                                        ' (Performance JB).'
                                    );
                                } else if (ab === 0) {
                                    return [];
                                }
                                return out;
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, border: { display: false }, ticks: { precision: 0 } },
                    x: { grid: { display: false }, border: { display: false } }
                }
            }
        });
    }

    function refreshPie() {
        var labels = [];
        var values = [];
        var colors = [];
        Object.keys(pieRaw).forEach(function (key) {
            if (!pieSelection[key]) return;
            var meta = PIE_META[key] || { label: key, color: '#64748b' };
            labels.push(meta.label);
            values.push(pieRaw[key]);
            colors.push(meta.color);
        });

        var totalVisivel = values.reduce(function (a, b) { return a + b; }, 0);
        pieChartSubtitleEl.textContent = totalVisivel
            ? formatNumber(totalVisivel) + ' contratos exibidos'
            : 'Nenhuma fatia selecionada';

        var ctx = document.getElementById('pieChart');
        if (!ctx) return;
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed || 0;
                                var pct = totalVisivel ? (v * 100 / totalVisivel).toFixed(1) + '%' : '0%';
                                return ctx.label + ': ' + formatNumber(v) + ' (' + pct + ')';
                            }
                        }
                    }
                }
            }
        });
    }

    // ========================================================================
    //                               MODAL (contrato_detalhes_modal.js)
    // ========================================================================
    async function openDetails(id) {
        if (window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.open === 'function') {
            await window.ContratoDetalhesModal.open(id);
        }
    }

    // ========================================================================
    //                               HELPERS
    // ========================================================================

    function humanMonth(ym) {
        if (!ym) return '';
        var parts = String(ym).split('-');
        if (parts.length !== 2) return ym;
        var names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        var idx = parseInt(parts[1], 10) - 1;
        if (idx < 0 || idx > 11) return ym;
        return names[idx] + '/' + parts[0].slice(2);
    }

    function periodLabel() {
        if (!periodStart || !periodEnd) return '';
        if (periodStart === periodEnd) return humanMonth(periodStart);
        return humanMonth(periodStart) + ' — ' + humanMonth(periodEnd);
    }

    function hexToRgba(hex, alpha) {
        var h = String(hex).replace('#', '');
        if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
        var r = parseInt(h.substring(0, 2), 16);
        var g = parseInt(h.substring(2, 4), 16);
        var b = parseInt(h.substring(4, 6), 16);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    function esc(val) {
        if (val === null || val === undefined) return '-';
        var div = document.createElement('div');
        div.textContent = String(val);
        return div.innerHTML;
    }

    function formatNumber(val) {
        if (val === null || val === undefined) return '--';
        return Number(val).toLocaleString('pt-BR');
    }

    // ========================================================================
    //                  EXPORTACAO (XLSX / PDF / Power BI)
    // ========================================================================
    var exportBtnsDash = document.querySelectorAll('.control-card-export .export-btn');
    var exportFeedbackDash = document.getElementById('exportFeedbackDash');

    function showExportFeedbackDash(msg, kind) {
        if (!exportFeedbackDash) return;
        exportFeedbackDash.textContent = msg;
        exportFeedbackDash.className = 'export-feedback' + (kind ? ' ' + kind : '');
        exportFeedbackDash.style.display = 'block';
    }
    function hideExportFeedbackDash(delay) {
        if (!exportFeedbackDash) return;
        setTimeout(function () { exportFeedbackDash.style.display = 'none'; }, delay || 3500);
    }
    function chartToDataURLDash(instance) {
        try {
            if (!instance) return '';
            return instance.toBase64Image('image/png', 1.0);
        } catch (e) {
            return '';
        }
    }

    async function doExportDash(formato) {
        var activeSeries = Object.keys(selectedSeries).filter(function (k) { return selectedSeries[k]; });
        var activePie = Object.keys(pieSelection).filter(function (k) { return pieSelection[k]; });
        if (!activeSeries.length) {
            showExportFeedbackDash('Selecione ao menos uma série para exportar.', 'err');
            hideExportFeedbackDash();
            return;
        }
        var payload = {
            period_start: periodStart,
            period_end: periodEnd,
            series: activeSeries,
            pie: activePie,
        };
        if (formato === 'pdf') {
            payload.line_image = chartToDataURLDash(lineChart);
            payload.pie_image = chartToDataURLDash(pieChart);
        }

        var btn = document.querySelector('.control-card-export .export-btn[data-formato="' + formato + '"]');
        var originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Gerando...</span><small>aguarde</small>';
        }
        showExportFeedbackDash('Gerando arquivo, aguarde...', 'info');

        try {
            var resp = await fetch('/api/dashboard/export/' + formato, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                var errObj;
                try { errObj = await resp.json(); } catch (e) { errObj = { error: 'Falha na exportacao (' + resp.status + ')' }; }
                throw new Error(errObj.error || 'Erro ao exportar');
            }
            var blob = await resp.blob();
            var cd = resp.headers.get('Content-Disposition') || '';
            var match = cd.match(/filename="?([^";]+)"?/i);
            var filename = match ? match[1] : ('dashboard_export.' + (formato === 'powerbi' ? 'csv' : formato));

            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 200);

            showExportFeedbackDash('Arquivo "' + filename + '" gerado com sucesso.', 'ok');
            hideExportFeedbackDash();
        } catch (err) {
            showExportFeedbackDash('Erro: ' + (err.message || 'falha desconhecida'), 'err');
            hideExportFeedbackDash(5000);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    exportBtnsDash.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var formato = btn.getAttribute('data-formato');
            if (formato) doExportDash(formato);
        });
    });

    if (window.PainelListaContratos) {
        window.PainelListaContratos.init({
            mode: 'dashboard',
            hookName: 'painelListaRefresh',
            endpoint: '/api/dashboard/panel_contratos',
            onDetalhe: openDetails,
            getBaseQuery: function () {
                var s = new URLSearchParams();
                s.set('period_start', periodStart);
                s.set('period_end', periodEnd);
                var keys = Object.keys(selectedSeries);
                for (var i = 0; i < keys.length; i++) {
                    if (selectedSeries[keys[i]]) s.append('series', keys[i]);
                }
                if (!s.getAll('series').length) {
                    s.append('series', 'pagos');
                    s.append('series', 'indenizados');
                }
                return s;
            }
        });
    }

    // Expose for potential debug
    window.__dashboard = { data: data, refreshAll: refreshAll, painelListaRefresh: window.painelListaRefresh };
});
