document.addEventListener('DOMContentLoaded', function () {

    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.scale.grid.color = 'rgba(226, 232, 240, 0.5)';

    var safraChartInstance = null;
    var vencimentoChartInstance = null;
    var activeSafraIndex = null;
    var safraData = { all: null };
    var lastMes = '';

    var barSubtitle = document.getElementById('chartBarSubtitle');
    var barTitle = document.querySelector('.line-chart-container .card-header-slim h3');
    var mesAnoInput = document.getElementById('mesAnoFiltro');
    var tbody = document.getElementById('safraTableBody');

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function currentMesAno() {
        var d = new Date();
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    }

    function formatMesLabel(ym) {
        if (!ym || ym.length < 7) return ym;
        var names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        var m = parseInt(ym.slice(5, 7), 10) - 1;
        return names[m] + '/' + ym.slice(0, 4);
    }

    function buildSafraDataFromApi(data) {
        var all = data.chart_all;
        var out = {
            all: {
                barLabels: all.barLabels,
                entrada: all.entrada,
                recuperacao: all.recuperacao,
                doughnut: all.doughnut,
            },
        };
        data.safras.forEach(function (s) {
            out[s.index] = {
                barLabels: s.detail.barLabels,
                entrada: s.detail.entrada,
                recuperacao: s.detail.recuperacao,
                doughnut: s.detail.doughnut,
            };
        });
        return out;
    }

    function renderTableRows(data) {
        tbody.innerHTML = '';
        data.safras.forEach(function (s) {
            var tr = document.createElement('tr');
            tr.setAttribute('data-safra', s.label);
            tr.setAttribute('data-volume', String(s.volume));
            tr.setAttribute('data-d30', String(s.d30));
            tr.setAttribute('data-d60', String(s.d60));
            tr.setAttribute('data-d90', String(s.d90));
            tr.innerHTML =
                '<td class="fw-bold">' + escapeHtml(s.label) + '</td>' +
                '<td>' + formatInt(s.volume) + '</td>' +
                '<td>' + formatInt(s.d30) + '</td>' +
                '<td>' + formatInt(s.d60) + '</td>' +
                '<td class="text-danger fw-bold">' + formatInt(s.d90) + '</td>' +
                '<td class="text-right"><button type="button" class="action-btn btn-analisar" data-safra-index="' + s.index + '"><i class="fa-solid fa-chart-line"></i> Analisar Safra</button></td>';
            tbody.appendChild(tr);
        });
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

    function renderBarChart(data, safraName) {
        var safraCtx = document.getElementById('safraChart');
        if (!safraCtx || !data) return;

        if (safraChartInstance) {
            safraChartInstance.destroy();
        }

        if (safraName) {
            barTitle.textContent = 'Detalhamento: ' + safraName;
            barSubtitle.textContent = 'Entrada vs Recuperação (subperíodos da safra no mês ' + formatMesLabel(lastMes) + ')';
        } else {
            barTitle.textContent = 'Produtividade por Safra';
            barSubtitle.textContent = 'Novos vs Fechado/Indenizado por safra (' + formatMesLabel(lastMes) + ')';
        }

        safraChartInstance = new Chart(safraCtx, {
            type: 'bar',
            data: {
                labels: data.barLabels,
                datasets: [
                    {
                        label: 'Novos (contrato novo)',
                        data: data.entrada,
                        backgroundColor: '#3b82f6',
                        borderRadius: 4,
                    },
                    {
                        label: 'Fechado / Indenizado',
                        data: data.recuperacao,
                        backgroundColor: '#10b981',
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: { usePointStyle: true, boxWidth: 8 },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        padding: 12,
                        cornerRadius: 8,
                    },
                },
                scales: {
                    y: { beginAtZero: true, border: { display: false } },
                    x: { grid: { display: false }, border: { display: false } },
                },
            },
        });
    }

    function renderDoughnutChart(doughnutData) {
        var vCTx = document.getElementById('vencimentoChart');
        if (!vCTx) return;

        if (vencimentoChartInstance) {
            vencimentoChartInstance.destroy();
        }

        var d = doughnutData || [0, 0, 0];

        vencimentoChartInstance = new Chart(vCTx, {
            type: 'doughnut',
            data: {
                labels: ['Até 30 dias', '31 a 60 dias', 'Acima de 60 dias'],
                datasets: [
                    {
                        data: d,
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true, padding: 20 },
                    },
                },
            },
        });
    }

    function bindAnalisarButtons() {
        var analisarBtns = document.querySelectorAll('.btn-analisar');
        analisarBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-safra-index'), 10);
                var row = this.closest('tr');
                var safraName = row ? row.getAttribute('data-safra') : '';

                analisarBtns.forEach(function (b) {
                    b.classList.remove('active-safra');
                });
                this.classList.add('active-safra');

                activeSafraIndex = idx;

                var data = safraData[idx];
                if (data) {
                    renderBarChart(data, safraName);
                    renderDoughnutChart(data.doughnut);
                }

                var chartsRow = document.querySelector('.charts-row');
                if (chartsRow) {
                    chartsRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        });
    }

    async function loadPerformance(mes) {
        lastMes = mes;
        tbody.innerHTML =
            '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';

        try {
            var resp = await fetch('/api/performance?mes=' + encodeURIComponent(mes));
            var data = await resp.json();
            if (data.error) {
                tbody.innerHTML =
                    '<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444">' + escapeHtml(data.error) + '</td></tr>';
                return;
            }

            document.getElementById('kpiNovos').textContent = formatInt(data.kpis.novos_mes);
            document.getElementById('kpiSafra').innerHTML =
                escapeHtml(data.kpis.safra_destaque) +
                ' <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);">(mês corrente)</span>';
            document.getElementById('kpiRecuperacao').textContent = String(data.kpis.recuperacao_pct) + '%';
            document.getElementById('kpiParcelas').textContent = formatInt(data.kpis.parcelas_criticas_90d);

            safraData = buildSafraDataFromApi(data);
            renderTableRows(data);
            bindAnalisarButtons();

            activeSafraIndex = null;
            document.querySelectorAll('.btn-analisar').forEach(function (b) {
                b.classList.remove('active-safra');
            });

            renderBarChart(safraData.all, null);
            renderDoughnutChart(safraData.all.doughnut);
        } catch (err) {
            tbody.innerHTML =
                '<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444">Erro ao carregar: ' +
                escapeHtml(err.message) +
                '</td></tr>';
        }
    }

    if (mesAnoInput) {
        mesAnoInput.value = currentMesAno();
        loadPerformance(mesAnoInput.value);

        mesAnoInput.addEventListener('change', function () {
            if (this.value) {
                loadPerformance(this.value);
                this.style.borderColor = '#10b981';
                this.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.15)';
                setTimeout(
                    function () {
                        mesAnoInput.style.borderColor = '';
                        mesAnoInput.style.boxShadow = '';
                    },
                    1500
                );
            }
        });
    }
});
