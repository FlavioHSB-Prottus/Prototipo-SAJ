document.addEventListener('DOMContentLoaded', function() {
    
    // Configurações comuns do Chart.js para ficar elegante
    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = "#64748b"; // slate-500
    Chart.defaults.scale.grid.color = "rgba(226, 232, 240, 0.5)"; // slate-200 translúcido

    // 1. Gráfico de Linhas: Evolução Pagos vs Indenizados
    const lineCtx = document.getElementById('lineChart');
    if (lineCtx) {
        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: ['Novembro', 'Dezembro', 'Janeiro', 'Fevereiro', 'Março', 'Abril'],
                datasets: [
                    {
                        label: 'Contratos Pagos',
                        data: [150, 180, 210, 205, 250, 284],
                        borderColor: '#10b981', // Verde
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.4, // Linha suave
                        fill: true,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#10b981',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    },
                    {
                        label: 'Ind Repassadas',
                        data: [80, 95, 85, 70, 65, 56],
                        borderColor: '#f59e0b', // Laranja/Amarelo
                        backgroundColor: 'rgba(245, 158, 11, 0.0)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#f59e0b',
                        pointBorderWidth: 2,
                        pointRadius: 4
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
                        titleFont: { size: 13 },
                        bodyFont: { size: 13 },
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

    // 2. Gráfico de Pizza (Doughnut na verdade fica mais moderno): Distribuição
    const pieCtx = document.getElementById('pieChart');
    if (pieCtx) {
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Em Cobrança', 'Pagos', 'Indenizados', 'Retomados'],
                datasets: [{
                    data: [1452, 284, 56, 12],
                    backgroundColor: [
                        '#3b82f6', // azul
                        '#10b981', // verde
                        '#f59e0b', // laranja
                        '#64748b'  // cinza
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%', // Faz o buraco no meio
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

    // Toggle dropdown do filtro e lógica da tabela
    const btnFilter = document.getElementById('btn-filter');
    const filterDropdown = document.getElementById('filter-dropdown');
    
    if (btnFilter && filterDropdown) {
        btnFilter.addEventListener('click', function(e) {
            e.stopPropagation();
            if (filterDropdown.style.display === 'none') {
                filterDropdown.style.display = 'flex';
            } else {
                filterDropdown.style.display = 'none';
            }
        });

        // Fechar se clicar fora
        document.addEventListener('click', function(e) {
            if (!filterDropdown.contains(e.target) && e.target !== btnFilter) {
                filterDropdown.style.display = 'none';
            }
        });

        // Lógica de filtro na tabela
        const checkboxes = filterDropdown.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', function() {
                const checkedValues = Array.from(checkboxes)
                    .filter(i => i.checked)
                    .map(i => i.value);
                
                const tableRows = document.querySelectorAll('.styled-table tbody tr');
                tableRows.forEach(row => {
                    const statusCell = row.querySelector('td:nth-child(5)');
                    if (statusCell) {
                        const statusText = statusCell.textContent.trim();
                        if (checkedValues.includes(statusText)) {
                            row.style.display = '';
                        } else {
                            row.style.display = 'none';
                        }
                    }
                });
            });
        });
    }

});
