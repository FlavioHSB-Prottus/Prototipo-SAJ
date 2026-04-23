document.addEventListener('DOMContentLoaded', function () {

    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.scale.grid.color = 'rgba(226, 232, 240, 0.5)';

    // --- Elementos ---
    var safraSelector = document.getElementById('safraSelector');
    var mesAnoInput = document.getElementById('mesAnoFiltro');
    var presetBtns = document.querySelectorAll('.preset-btn');
    var btnReset = document.getElementById('btnResetControles');
    var seriesBarSelector = document.getElementById('seriesBarSelector');
    var piePerfSelector = document.getElementById('piePerfSelector');

    var barTitleEl = document.getElementById('barChartTitle');
    var barSubtitleEl = document.getElementById('chartBarSubtitle');
    var pieSubtitleEl = document.getElementById('pieChartSubtitle');

    // --- Estado ---
    var safraChartInstance = null;
    var vencimentoChartInstance = null;
    var activeSafraIndex = null;        // null = visao geral (4 faixas)
    var safraData = { all: null };
    var currentResponse = null;
    var lastMes = '';
    var viewMode = 'count';

    var OCORRENCIAS_META = {
        novos:       { label: 'Ocorr. novos',        color: '#3b82f6' },
        pagos:       { label: 'Ocorr. fechado',     color: '#10b981' },
        indenizados: { label: 'Ocorr. indenizados', color: '#f59e0b' },
    };
    var PIE_META = [
        { key: 'd30', label: 'Até 30 dias (atraso)',       color: '#10b981' },
        { key: 'd60', label: '31 a 60 dias',               color: '#f59e0b' },
        { key: 'd90', label: 'Acima de 60 dias',            color: '#ef4444' },
    ];
    var PERF_SUB_KEYS = ['recente', 'atencao', 'critico'];
    var PERF_DEF = [
        { g: 'performado',     label: 'Performado',      color: '#10b981' },
        { g: 'nao_performado', label: 'Não performado',  color: '#f97316' },
    ];
    var perfSelection = { performado: true, nao_performado: true };
    var pieSelection = { d30: true, d60: true, d90: true };

    // --- Utils ---
    function pad2(n) { return n < 10 ? '0' + n : String(n); }

    function currentMesAno() {
        var d = new Date();
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    }

    function shiftMesAno(ym, deltaMeses) {
        var y = parseInt(ym.slice(0, 4), 10);
        var m = parseInt(ym.slice(5, 7), 10);
        m += deltaMeses;
        while (m <= 0) { m += 12; y -= 1; }
        while (m > 12) { m -= 12; y += 1; }
        return y + '-' + pad2(m);
    }

    function formatMesLabel(ym) {
        if (!ym || ym.length < 7) return ym;
        var names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        var m = parseInt(ym.slice(5, 7), 10) - 1;
        return names[m] + '/' + ym.slice(0, 4);
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function formatInt(n) {
        if (n == null || isNaN(n)) return '0';
        return Number(n).toLocaleString('pt-BR');
    }

    function hexToRgba(hex, alpha) {
        var h = String(hex).replace('#', '');
        if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
        var r = parseInt(h.substring(0, 2), 16);
        var g = parseInt(h.substring(2, 4), 16);
        var b = parseInt(h.substring(4, 6), 16);
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    // ========================================================================
    //                       CONSTRUCAO DOS DADOS / FETCH
    // ========================================================================

    function buildSafraDataFromApi(data) {
        var all = data.chart_all;
        var out = {
            all: {
                barLabels: all.barLabels,
                count: all.count,
                valor_brl: all.valor_brl,
                novos: all.novos,
                pagos: all.pagos,
                indenizados: all.indenizados,
                doughnut: all.doughnut,
            },
        };
        data.safras.forEach(function (s) {
            out[s.index] = {
                barLabels: s.detail.barLabels,
                novos: s.detail.novos,
                pagos: s.detail.pagos,
                indenizados: s.detail.indenizados,
                doughnut: s.detail.doughnut,
            };
        });
        return out;
    }

    async function loadPerformance(mes) {
        lastMes = mes;
        safraSelector.innerHTML =
            '<div class="safra-loading" style="color:var(--text-muted);font-size:0.85rem">' +
            '<i class="fa-solid fa-spinner fa-spin"></i> Carregando faixas...</div>';

        try {
            var resp = await fetch('/api/performance?mes=' + encodeURIComponent(mes));
            var data = await resp.json();
            if (data.error) {
                safraSelector.innerHTML =
                    '<div style="color:#ef4444;padding:12px;font-size:0.85rem">' + escapeHtml(data.error) + '</div>';
                return;
            }

            currentResponse = data;
            safraData = buildSafraDataFromApi(data);

            document.getElementById('kpiNovos').textContent = formatInt(data.kpis.novos_mes);
            document.getElementById('kpiSafra').innerHTML =
                escapeHtml((data.kpis && (data.kpis.faixa_destaque || data.kpis.safra_destaque)) || '—') +
                ' <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(mês corrente)</span>';
            document.getElementById('kpiRecuperacao').textContent = String(data.kpis.recuperacao_pct) + '%';
            document.getElementById('kpiParcelas').textContent = formatInt(data.kpis.parcelas_criticas_90d);

            renderSafraSelector(data.safras);
            applyState();
        } catch (err) {
            safraSelector.innerHTML =
                '<div style="color:#ef4444;padding:12px;font-size:0.85rem">Erro ao carregar: ' +
                escapeHtml(err.message) + '</div>';
        }
    }

    // ========================================================================
    //                           RENDER: SAFRA SELECTOR
    // ========================================================================

    function renderSafraSelector(safras) {
        safraSelector.innerHTML = '';

        // Opcao "Visao geral (todas as faixas)"
        var allOption = document.createElement('label');
        allOption.className = 'safra-option';
        allOption.innerHTML =
            '<input type="radio" name="safraSel" value="all"' + (activeSafraIndex === null ? ' checked' : '') + '>' +
            '<div class="safra-option-body">' +
                '<div class="safra-option-title">' +
                    '<i class="fa-solid fa-globe"></i>' +
                    '<strong>Visão geral</strong>' +
                    '<span class="safra-option-tag">todas as faixas</span>' +
                '</div>' +
                '<div class="safra-option-metrics">' +
                    metricPill('volume', totalField(safras, 'volume')) +
                    metricPill('d30', totalField(safras, 'd30'), 'Até 30d') +
                    metricPill('d60', totalField(safras, 'd60'), 'Até 60d') +
                    metricPill('d90', totalField(safras, 'd90'), 'Até 90d') +
                '</div>' +
            '</div>';
        safraSelector.appendChild(allOption);

        safras.forEach(function (s) {
            var opt = document.createElement('label');
            opt.className = 'safra-option';
            opt.innerHTML =
                '<input type="radio" name="safraSel" value="' + s.index + '"' + (activeSafraIndex === s.index ? ' checked' : '') + '>' +
                '<div class="safra-option-body">' +
                    '<div class="safra-option-title">' +
                        '<i class="fa-solid fa-layer-group"></i>' +
                        '<strong>' + escapeHtml(s.label) + '</strong>' +
                    '</div>' +
                    '<div class="safra-option-metrics">' +
                        metricPill('volume', s.volume) +
                        metricPill('d30', s.d30, 'Até 30d') +
                        metricPill('d60', s.d60, 'Até 60d') +
                        metricPill('d90', s.d90, 'Até 90d') +
                    '</div>' +
                '</div>';
            safraSelector.appendChild(opt);
        });

        safraSelector.querySelectorAll('input[name="safraSel"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                var val = this.value;
                activeSafraIndex = (val === 'all') ? null : parseInt(val, 10);
                applyState();
            });
        });
    }

    function totalField(safras, key) {
        return safras.reduce(function (acc, s) { return acc + (Number(s[key]) || 0); }, 0);
    }

    function metricPill(kind, value, label) {
        var cls = 'metric-pill';
        if (kind === 'volume') cls += ' metric-volume';
        else if (kind === 'd30') cls += ' metric-success';
        else if (kind === 'd60') cls += ' metric-warning';
        else if (kind === 'd90') cls += ' metric-danger';
        var lbl = label || 'Volume';
        return '<span class="' + cls + '"><span class="metric-label">' + escapeHtml(lbl) + '</span>' +
               '<span class="metric-value">' + formatInt(value) + '</span></span>';
    }

    // ========================================================================
    //                       APLICACAO DE ESTADO (render charts)
    // ========================================================================

    function applyState() {
        if (!safraData || !safraData.all) return;
        var d = activeSafraIndex === null ? safraData.all : safraData[activeSafraIndex];
        var safraName = null;
        if (activeSafraIndex !== null && currentResponse && currentResponse.safras) {
            var found = currentResponse.safras.find(function (s) { return s.index === activeSafraIndex; });
            if (found) safraName = found.label;
        }
        var viewBar = document.getElementById('viewModeBar');
        if (viewBar) viewBar.style.display = activeSafraIndex === null ? 'flex' : 'none';
        renderBarChart(d, safraName);
        renderDoughnutChart(d.doughnut);
    }

    function buildPerfDatasets() {
        var out = [];
        for (var i = 0; i < PERF_DEF.length; i++) {
            var def = PERF_DEF[i];
            if (!perfSelection[def.g]) continue;
            out.push(def);
        }
        return out;
    }

    /** Soma recente+atencao+critico por faixa (a API ainda desagrega; o gráfico de barras mostra o total). */
    function sumPerfSubsegments(block, g) {
        if (!block || !block[g]) return [];
        var gBlock = block[g];
        var n = 0;
        for (var i = 0; i < PERF_SUB_KEYS.length; i++) {
            var a = gBlock[PERF_SUB_KEYS[i]];
            if (a && a.length) n = Math.max(n, a.length);
        }
        if (!n) return [];
        var out = new Array(n);
        for (var j = 0; j < n; j++) {
            var s = 0;
            for (var k = 0; k < PERF_SUB_KEYS.length; k++) {
                var arr = gBlock[PERF_SUB_KEYS[k]];
                s += (arr && j < arr.length) ? (Number(arr[j]) || 0) : 0;
            }
            out[j] = s;
        }
        return out;
    }

    function renderBarChart(data, safraName) {
        var ctx = document.getElementById('safraChart');
        if (!ctx || !data) return;
        if (safraChartInstance) safraChartInstance.destroy();

        if (safraName) {
            barTitleEl.textContent = 'Detalhamento (ocorrências): ' + safraName;
            barSubtitleEl.textContent = 'Dias do período — safra ' + formatMesLabel(lastMes);
        } else {
            barTitleEl.textContent = 'Desempenho na cobrança por faixa (calendário)';
            barSubtitleEl.textContent = (viewMode === 'valor' ? 'Soma do valor de crédito (R$) — ' : 'Contagem de contratos — ') +
                formatMesLabel(lastMes);
        }

        if (safraName) {
            var keysO = Object.keys(OCORRENCIAS_META);
            var datasets = keysO.map(function (key) {
                var meta = OCORRENCIAS_META[key];
                return {
                    label: meta.label,
                    data: data[key] || [],
                    backgroundColor: meta.color,
                    borderColor: meta.color,
                    borderWidth: 1,
                    tension: 0.25,
                    pointRadius: 0,
                    fill: false,
                };
            });
            safraChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: data.barLabels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
                    },
                    scales: {
                        y: { beginAtZero: true, border: { display: false } },
                        x: { grid: { display: false }, border: { display: false } },
                    },
                },
            });
            return;
        }

        var block = (viewMode === 'valor' && data.valor_brl) ? data.valor_brl : (data.count || {});
        var defs = buildPerfDatasets();
        var isValor = viewMode === 'valor';
        var datasets = defs.map(function (def) {
            return {
                label: def.label,
                data: sumPerfSubsegments(block, def.g),
                backgroundColor: def.color,
                borderRadius: 2,
            };
        });
        if (!datasets.length) {
            var nLabels = (data.barLabels && data.barLabels.length) ? data.barLabels.length : 4;
            datasets = [{ label: 'Nenhum', data: new Array(nLabels).fill(0), backgroundColor: '#e2e8f0' }];
        }

        safraChartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels: data.barLabels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)', padding: 12, cornerRadius: 8,
                        callbacks: {
                            label: function (x) {
                                var v = x.parsed && x.parsed.y != null ? x.parsed.y : 0;
                                if (isValor) {
                                    return x.dataset.label + ': R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                }
                                return x.dataset.label + ': ' + formatInt(v);
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: true, grid: { display: false }, border: { display: false } },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        border: { display: false },
                        ticks: isValor ? { callback: function (v) { return 'R$ ' + v.toLocaleString('pt-BR'); } } : { precision: 0 }
                    }
                }
            },
        });
    }

    function renderDoughnutChart(doughnutData) {
        var ctx = document.getElementById('vencimentoChart');
        if (!ctx) return;
        if (vencimentoChartInstance) vencimentoChartInstance.destroy();

        var full = doughnutData || [0, 0, 0];
        var labels = [];
        var values = [];
        var colors = [];
        PIE_META.forEach(function (meta, idx) {
            if (!pieSelection[meta.key]) return;
            labels.push(meta.label);
            values.push(Number(full[idx]) || 0);
            colors.push(meta.color);
        });

        var total = values.reduce(function (a, b) { return a + b; }, 0);
        pieSubtitleEl.textContent = total
            ? formatInt(total) + ' contratos exibidos'
            : 'Nenhuma fatia selecionada';

        vencimentoChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
                    tooltip: {
                        callbacks: {
                            label: function (c) {
                                var v = c.parsed || 0;
                                var pct = total ? (v * 100 / total).toFixed(1) + '%' : '0%';
                                return c.label + ': ' + formatInt(v) + ' (' + pct + ')';
                            }
                        }
                    }
                },
            },
        });
    }

    // ========================================================================
    //                              EVENTOS
    // ========================================================================

    function syncPerfFromDom() {
        if (!seriesBarSelector) return;
        seriesBarSelector.querySelectorAll('input[type="checkbox"][data-perf]').forEach(function (cb) {
            var k = cb.getAttribute('data-perf');
            if (k === 'performado' || k === 'nao_performado') perfSelection[k] = cb.checked;
        });
    }

    seriesBarSelector.addEventListener('change', function (e) {
        var cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        var k = cb.getAttribute('data-perf');
        if (k !== 'performado' && k !== 'nao_performado') return;
        perfSelection[k] = cb.checked;
        applyState();
    });

    piePerfSelector.addEventListener('change', function (e) {
        var cb = e.target;
        if (!cb || cb.type !== 'checkbox') return;
        var k = cb.getAttribute('data-faixa');
        if (!k) return;
        pieSelection[k] = cb.checked;
        applyState();
    });

    if (mesAnoInput) {
        mesAnoInput.value = currentMesAno();
        mesAnoInput.addEventListener('change', function () {
            if (this.value) {
                clearPresetActive();
                loadPerformance(this.value);
            }
        });
    }

    presetBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var preset = btn.getAttribute('data-preset');
            var target;
            if (preset === 'atual') target = currentMesAno();
            else if (preset === 'anterior') target = shiftMesAno(currentMesAno(), -1);
            else if (preset === '3m') target = shiftMesAno(currentMesAno(), -3);
            if (!target) return;
            mesAnoInput.value = target;
            presetBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            loadPerformance(target);
        });
    });

    function resetPerfSelection() {
        perfSelection = { performado: true, nao_performado: true };
    }

    document.querySelectorAll('input[name="viewMode"]').forEach(function (r) {
        r.addEventListener('change', function () {
            if (!this.checked) return;
            viewMode = this.value === 'valor' ? 'valor' : 'count';
            applyState();
        });
    });

    btnReset.addEventListener('click', function () {
        activeSafraIndex = null;
        resetPerfSelection();
        viewMode = 'count';
        var rc = document.querySelector('input[name="viewMode"][value="count"]');
        if (rc) rc.checked = true;
        pieSelection = { d30: true, d60: true, d90: true };
        if (seriesBarSelector) {
            seriesBarSelector.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
        }
        if (piePerfSelector) {
            piePerfSelector.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = true; });
        }
        mesAnoInput.value = currentMesAno();
        clearPresetActive();
        loadPerformance(mesAnoInput.value);
    });

    function clearPresetActive() {
        presetBtns.forEach(function (b) { b.classList.remove('active'); });
    }

    // --- Exportacao (XLSX / PDF / Power BI) ---
    var exportButtons = document.querySelectorAll('.export-btn');
    var exportFeedback = document.getElementById('exportFeedback');

    function showExportFeedback(msg, kind) {
        if (!exportFeedback) return;
        exportFeedback.textContent = msg;
        exportFeedback.className = 'export-feedback' + (kind ? ' ' + kind : '');
        exportFeedback.style.display = 'block';
    }
    function hideExportFeedback(delay) {
        if (!exportFeedback) return;
        setTimeout(function () { exportFeedback.style.display = 'none'; }, delay || 3500);
    }

    function chartToDataURL(instance) {
        try {
            if (!instance) return '';
            // toBase64Image retorna PNG por padrao; passamos background branco para o PDF
            return instance.toBase64Image('image/png', 1.0);
        } catch (e) {
            return '';
        }
    }

    async function doExport(formato) {
        if (!currentResponse) {
            showExportFeedback('Carregue os dados antes de exportar.', 'err');
            hideExportFeedback();
            return;
        }
        syncPerfFromDom();
        var payload = {
            mes: lastMes,
            safra_index: activeSafraIndex === null ? 'all' : activeSafraIndex,
            series: ['novos', 'pagos', 'indenizados'],
            faixas: Object.keys(pieSelection).filter(function (k) { return pieSelection[k]; }),
        };
        if (formato === 'pdf') {
            payload.bar_image = chartToDataURL(safraChartInstance);
            payload.pie_image = chartToDataURL(vencimentoChartInstance);
        }

        var btn = document.querySelector('.export-btn[data-formato="' + formato + '"]');
        var originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Gerando...</span><small>aguarde</small>';
        }
        showExportFeedback('Gerando arquivo, aguarde...', 'info');

        try {
            var resp = await fetch('/api/performance/export/' + formato, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                var err;
                try { err = await resp.json(); } catch (e) { err = { error: 'Falha na exportacao (' + resp.status + ')' }; }
                throw new Error(err.error || 'Erro ao exportar');
            }
            var blob = await resp.blob();
            var cd = resp.headers.get('Content-Disposition') || '';
            var match = cd.match(/filename="?([^";]+)"?/i);
            var filename = match ? match[1] : ('performance_export.' + (formato === 'powerbi' ? 'csv' : formato));

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

            showExportFeedback('Arquivo "' + filename + '" gerado com sucesso.', 'ok');
            hideExportFeedback();
        } catch (err) {
            showExportFeedback('Erro: ' + (err.message || 'falha desconhecida'), 'err');
            hideExportFeedback(5000);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    exportButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var formato = btn.getAttribute('data-formato');
            if (formato) doExport(formato);
        });
    });

    // --- Init ---
    loadPerformance(mesAnoInput.value);
});
