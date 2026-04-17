document.addEventListener('DOMContentLoaded', function() {
    
    // Configurações comuns do Chart.js
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = "#64748b";
    Chart.defaults.scale.grid.color = "rgba(226, 232, 240, 0.5)";

    // Dados simulados por safra (em sistema real viria do backend)
    const safraData = {
        'all': {
            barLabels: ['Safra 1 (01-09)', 'Safra 2 (10-12)', 'Safra 3 (13-19)', 'Safra 4 (20-fim)'],
            entrada: [42, 35, 50, 18],
            recuperacao: [35, 20, 15, 5],
            doughnut: [956, 385, 111]
        },
        0: {
            barLabels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            entrada: [12, 10, 11, 9],
            recuperacao: [10, 8, 9, 8],
            doughnut: [214, 150, 56]
        },
        1: {
            barLabels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            entrada: [9, 8, 10, 8],
            recuperacao: [5, 6, 5, 4],
            doughnut: [180, 95, 35]
        },
        2: {
            barLabels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            entrada: [14, 12, 13, 11],
            recuperacao: [4, 3, 4, 4],
            doughnut: [402, 120, 18]
        },
        3: {
            barLabels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            entrada: [5, 4, 5, 4],
            recuperacao: [2, 1, 1, 1],
            doughnut: [160, 20, 2]
        }
    };

    // Dados simulados por mês/ano
    const periodoData = {
        '2026-04': { volume: [420, 310, 540, 182], d30: [214, 180, 402, 160], d60: [150, 95, 120, 20], d90: [56, 35, 18, 2] },
        '2026-03': { volume: [390, 280, 510, 170], d30: [200, 160, 380, 140], d60: [130, 80, 100, 22], d90: [60, 40, 30, 8] },
        '2026-02': { volume: [360, 260, 480, 155], d30: [180, 150, 360, 120], d60: [120, 70, 90, 25], d90: [60, 40, 30, 10] },
        '2026-01': { volume: [340, 240, 450, 140], d30: [170, 140, 340, 110], d60: [110, 60, 80, 20], d90: [60, 40, 30, 10] }
    };

    let safraChartInstance = null;
    let vencimentoChartInstance = null;
    let activeSafraIndex = null;

    // Referências aos subtítulos dos gráficos
    const barSubtitle = document.querySelector('.line-chart-container .subtitle');
    const barTitle = document.querySelector('.line-chart-container .card-header-slim h3');

    // ============================================================
    // 1. Gráfico de Barras: Entrada x Recuperação por Safra
    // ============================================================
    function renderBarChart(data, safraName) {
        const safraCtx = document.getElementById('safraChart');
        if (!safraCtx) return;

        // Destruir chart anterior se existir
        if (safraChartInstance) {
            safraChartInstance.destroy();
        }

        // Atualizar título
        if (safraName) {
            barTitle.textContent = 'Detalhamento: ' + safraName;
            barSubtitle.textContent = 'Entrada vs Recuperação (Semanal)';
        } else {
            barTitle.textContent = 'Produtividade por Safra';
            barSubtitle.textContent = 'Entrada vs Recuperação (Mês Atual)';
        }

        safraChartInstance = new Chart(safraCtx, {
            type: 'bar',
            data: {
                labels: data.barLabels,
                datasets: [
                    {
                        label: 'Entrada de Contratos',
                        data: data.entrada,
                        backgroundColor: '#3b82f6',
                        borderRadius: 4
                    },
                    {
                        label: 'Recuperação / Repasse',
                        data: data.recuperacao,
                        backgroundColor: '#10b981',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.9)',
                        padding: 12,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false }
                    }
                }
            }
        });
    }

    // ============================================================
    // 2. Gráfico de Doughnut: Faixa de Vencimento
    // ============================================================
    function renderDoughnutChart(doughnutData) {
        const vCTx = document.getElementById('vencimentoChart');
        if (!vCTx) return;

        if (vencimentoChartInstance) {
            vencimentoChartInstance.destroy();
        }

        vencimentoChartInstance = new Chart(vCTx, {
            type: 'doughnut',
            data: {
                labels: ['Até 30 dias', 'Até 60 dias', 'Até 90 dias'],
                datasets: [{
                    data: doughnutData,
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    // ============================================================
    // Renderizar tudo pela primeira vez (visão geral)
    // ============================================================
    renderBarChart(safraData['all'], null);
    renderDoughnutChart(safraData['all'].doughnut);

    // ============================================================
    // Evento nos botões "Analisar Safra"
    // ============================================================
    const analisarBtns = document.querySelectorAll('.btn-analisar');
    analisarBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.getAttribute('data-safra-index'));
            const row = this.closest('tr');
            const safraName = row.getAttribute('data-safra');

            // Highlight no botão ativo
            analisarBtns.forEach(b => b.classList.remove('active-safra'));
            this.classList.add('active-safra');

            activeSafraIndex = idx;

            // Atualizar gráficos com dados da safra clicada
            const data = safraData[idx];
            renderBarChart(data, safraName);
            renderDoughnutChart(data.doughnut);

            // Scroll suave até os gráficos
            document.querySelector('.charts-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });

    // ============================================================
    // Evento no filtro de Mês/Ano
    // ============================================================
    const mesAnoInput = document.getElementById('mesAnoFiltro');
    if (mesAnoInput) {
        mesAnoInput.addEventListener('change', function() {
            const periodo = this.value; // ex: "2026-04"
            const dados = periodoData[periodo];
            
            if (!dados) {
                // Se não houver dados simulados para o período, mostra alerta visual
                alert('Dados indisponíveis para o período selecionado. (Protótipo com dados simulados)');
                return;
            }

            // Atualizar as células da tabela com os novos dados
            const rows = document.querySelectorAll('#safraTable tbody tr');
            rows.forEach((row, i) => {
                const cells = row.querySelectorAll('td');
                cells[1].textContent = dados.volume[i];
                cells[2].textContent = dados.d30[i];
                cells[3].textContent = dados.d60[i];
                cells[4].textContent = dados.d90[i];

                // Atualizar os data-attributes
                row.setAttribute('data-volume', dados.volume[i]);
                row.setAttribute('data-d30', dados.d30[i]);
                row.setAttribute('data-d60', dados.d60[i]);
                row.setAttribute('data-d90', dados.d90[i]);
            });

            // Recalcular gráficos na visão geral
            activeSafraIndex = null;
            analisarBtns.forEach(b => b.classList.remove('active-safra'));

            // Recalcular doughnut (somar todas as safras)
            const totalD30 = dados.d30.reduce((a, b) => a + b, 0);
            const totalD60 = dados.d60.reduce((a, b) => a + b, 0);
            const totalD90 = dados.d90.reduce((a, b) => a + b, 0);

            // Recalcular barras
            const entradaScaled = dados.volume.map(v => Math.round(v / 10));
            const recScaled = dados.d30.map(v => Math.round(v / 10));

            const updatedAll = {
                barLabels: ['Safra 1 (01-09)', 'Safra 2 (10-12)', 'Safra 3 (13-19)', 'Safra 4 (20-fim)'],
                entrada: entradaScaled,
                recuperacao: recScaled,
                doughnut: [totalD30, totalD60, totalD90]
            };

            renderBarChart(updatedAll, null);
            renderDoughnutChart(updatedAll.doughnut);

            // Feedback visual no input
            this.style.borderColor = '#10b981';
            this.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.15)';
            setTimeout(() => {
                this.style.borderColor = '';
                this.style.boxShadow = '';
            }, 1500);
        });
    }
});
