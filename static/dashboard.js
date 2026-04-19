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
    var kpiPagosPeriodo = document.getElementById('kpiPagosPeriodo');
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

    var detalhesModal = document.getElementById('detalhesModal');
    var closeModalBtn = document.getElementById('closeModalBtn');
    var modalTitle = document.getElementById('modalTitle');
    var modalContent = document.getElementById('modalContent');

    // --- Catalogo de series plotaveis ---
    var SERIES_META = {
        pagos:       { label: 'Contratos pagos',         color: '#10b981' },
        indenizados: { label: 'Contratos indenizados',   color: '#f59e0b' },
        novos:       { label: 'Contratos novos',         color: '#3b82f6' },
        retomados:   { label: 'Contratos que voltaram',  color: '#8b5cf6' },
    };

    var PIE_META = {
        aberto:     { label: 'Em Cobrança', color: '#3b82f6' },
        fechado:    { label: 'Pagos',       color: '#10b981' },
        indenizado: { label: 'Indenizados', color: '#f59e0b' },
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
    var series = data.series || {};                // { pagos: [..], indenizados: [..], novos: [..], retomados: [..] }
    var snapshot = data.snapshot || {};
    var pieRaw = data.pie_chart || {};

    kpiAbertos.textContent = formatNumber(snapshot.em_cobranca);

    // --- Estado dos controles (padrao: pagos+indenizados, ultimos 6 meses, todas as fatias) ---
    var selectedSeries = { pagos: true, indenizados: true, novos: false, retomados: false };
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
        selectedSeries = { pagos: true, indenizados: true, novos: false, retomados: false };
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
        kpiIndenizados.textContent = formatNumber(sumSerie('indenizados'));
        kpiNovos.textContent = formatNumber(sumSerie('novos'));
        kpiRetomados.textContent = formatNumber(sumSerie('retomados'));

        var label = periodLabel();
        kpiPagosPeriodo.textContent = '(' + label + ')';
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
                        padding: 12, titleFont: { size: 13 }, bodyFont: { size: 13 }, cornerRadius: 8
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
    //                               MODAL
    // ========================================================================
    async function openDetails(id) {
        modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';
        modalTitle.textContent = 'Carregando...';
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            var resp = await fetch('/api/contrato/' + id);
            var d = await resp.json();
            if (d.error) {
                modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">' + esc(d.error) + '</p>';
                return;
            }
            renderContratoModal(d);
        } catch (err) {
            modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">Erro: ' + esc(err.message) + '</p>';
        }
    }

    function renderContratoModal(data) {
        var c = data.contrato;
        modalTitle.innerHTML = 'Detalhes do Contrato: <span class="text-accent">' + esc(c.grupo) + '/' + esc(c.cota) + '</span>';

        var html = '';
        html += '<div class="detail-section"><h3><i class="fa-solid fa-file-contract"></i> Dados do Contrato</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Grupo / Cota', c.grupo + '/' + c.cota);
        html += dataItem('Nro Contrato', c.numero_contrato);
        html += dataItem('Versao', c.versao);
        html += dataItem('Status', c.status || c.status_txt, true, c.status);
        html += dataItem('Valor do Credito', formatCurrency(c.valor_credito));
        html += dataItem('Prazo (meses)', c.prazo_meses);
        html += dataItem('Data de Adesao', formatDate(c.data_adesao));
        html += dataItem('Encerramento Grupo', formatDate(c.encerramento_grupo));
        html += dataItem('Taxa Administracao', c.taxa_administracao);
        html += dataItem('Fundo Reserva', c.fundo_reserva);
        html += dataItem('Percentual Lance', c.percentual_lance);
        html += '</div></div>';

        if (data.devedor) html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails);
        if (data.avalista) html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails);
        html += renderBemSection(data.bens);

        if (data.parcelas && data.parcelas.length > 0) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-list-ol"></i> Parcelas (' + data.parcelas.length + ')</h3>';
            html += '<div class="table-responsive"><table class="styled-table modal-table"><thead><tr>';
            html += '<th>Nro</th><th>Vencimento</th><th>Valor Nominal</th><th>Multa/Juros</th><th>Valor Total</th><th>Status</th>';
            html += '</tr></thead><tbody>';
            data.parcelas.forEach(function (p) {
                html += '<tr>';
                html += '<td>' + esc(p.numero_parcela) + '</td>';
                html += '<td>' + formatDate(p.vencimento) + '</td>';
                html += '<td>' + formatCurrency(p.valor_nominal) + '</td>';
                html += '<td>' + formatCurrency(p.multa_juros) + '</td>';
                html += '<td class="fw-bold">' + formatCurrency(p.valor_total) + '</td>';
                html += '<td><span class="status-badge ' + getStatusClass(p.status) + '">' + esc(p.status || '-') + '</span></td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        modalContent.innerHTML = html;
    }

    function renderBemSection(bens) {
        if (!bens || bens.length === 0) return '';
        var skipFields = { id: 1, id_contrato: 1, grupo: 1, cota: 1, created_at: 1, updated_at: 1 };
        var titulo = bens.length > 1 ? ('Bem (' + bens.length + ')') : 'Bem';
        var html = '<div class="detail-section"><h3><i class="fa-solid fa-box"></i> ' + titulo + '</h3>';
        bens.forEach(function (bem, idx) {
            if (bens.length > 1) html += '<h4 style="margin:16px 0 8px;color:#6b7280;font-size:0.95rem;">Item ' + (idx + 1) + '</h4>';
            html += '<div class="detail-grid">';
            var anyField = false;
            Object.keys(bem).forEach(function (key) {
                if (skipFields[key]) return;
                var value = bem[key];
                if (value === null || value === undefined || value === '') return;
                anyField = true;
                html += dataItem(humanizeBemField(key), formatBemValue(key, value));
            });
            if (!anyField) html += '<div style="color:#9ca3af;">Sem informações adicionais.</div>';
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function humanizeBemField(key) {
        var map = {
            descricao: 'Descrição', descricao_bem: 'Descrição',
            modelo: 'Modelo', marca: 'Marca', categoria: 'Categoria',
            codigo: 'Código', codigo_bem: 'Código do Bem',
            valor: 'Valor', valor_bem: 'Valor do Bem', valor_avaliacao: 'Valor de Avaliação',
            nome: 'Nome', ano: 'Ano', ano_fabricacao: 'Ano de Fabricação',
            ano_modelo: 'Ano Modelo', placa: 'Placa', chassi: 'Chassi',
            renavam: 'Renavam', cor: 'Cor', tipo: 'Tipo', status: 'Status',
            combustivel: 'Combustível', observacao: 'Observação', observacoes: 'Observações'
        };
        if (map[key]) return map[key];
        return String(key).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function formatBemValue(key, value) {
        var k = String(key).toLowerCase();
        if (k.indexOf('valor') !== -1 || k.indexOf('preco') !== -1) {
            var n = Number(value);
            if (!isNaN(n) && isFinite(n)) return formatCurrency(n);
        }
        if (k === 'data' || k.indexOf('data_') === 0 || k.indexOf('_data') !== -1) return formatDate(value);
        return value;
    }

    function renderPessoaSection(titulo, pessoa, enderecos, telefones, emails) {
        var icon = titulo === 'Avalista' ? 'fa-user-shield' : 'fa-user-tie';
        var html = '<div class="detail-section"><h3><i class="fa-solid ' + icon + '"></i> ' + esc(titulo) + '</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Nome', pessoa.nome_completo);
        html += dataItem('CPF / CNPJ', pessoa.cpf_cnpj);
        html += dataItem('Data de Nascimento', formatDate(pessoa.data_nascimento));
        html += dataItem('Profissao', pessoa.profissao);
        html += dataItem('Conjuge', pessoa.conjuge_nome);
        html += '</div>';
        if (enderecos && enderecos.length > 0) {
            enderecos.forEach(function (e) {
                html += '<div class="detail-grid" style="margin-top:12px">';
                html += dataItem('Endereco (' + (e.tipo || '') + ')', [e.logradouro, e.complemento, e.bairro, e.cidade, e.estado, e.cep].filter(Boolean).join(', '));
                html += '</div>';
            });
        }
        if ((telefones && telefones.length) || (emails && emails.length)) {
            html += '<div class="contact-grid" style="margin-top:12px">';
            if (telefones && telefones.length) {
                html += '<div><ul class="contact-list">';
                telefones.forEach(function (t) {
                    html += '<li><i class="fa-solid fa-phone"></i> ' + esc(t.numero || '-');
                    if (t.ramal) html += ' (ramal ' + esc(t.ramal) + ')';
                    html += '<span class="contact-tipo">' + esc(t.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }
            if (emails && emails.length) {
                html += '<div><ul class="contact-list">';
                emails.forEach(function (em) {
                    html += '<li><i class="fa-solid fa-envelope"></i> ' + esc(em.email || '-');
                    html += '<span class="contact-tipo">' + esc(em.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function closeModal() {
        detalhesModal.classList.remove('active');
        document.body.style.overflow = '';
    }
    closeModalBtn.addEventListener('click', closeModal);
    detalhesModal.addEventListener('click', function (e) { if (e.target === detalhesModal) closeModal(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && detalhesModal.classList.contains('active')) closeModal();
    });

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

    function dataItem(label, value, isBadge, badgeStatus) {
        var display = (value !== null && value !== undefined && value !== '') ? esc(value) : '-';
        if (isBadge && badgeStatus) display = '<span class="status-badge ' + getStatusClass(badgeStatus) + '">' + esc(value) + '</span>';
        return '<div class="data-item"><span class="data-label">' + esc(label) + '</span><span class="data-value">' + display + '</span></div>';
    }

    function formatDate(val) {
        if (!val) return '-';
        var parts = String(val).split('T')[0].split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        return val;
    }

    function formatCurrency(val) {
        if (val === null || val === undefined || val === '') return '-';
        var num = parseFloat(val);
        if (isNaN(num)) return esc(val);
        return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatNumber(val) {
        if (val === null || val === undefined) return '--';
        return Number(val).toLocaleString('pt-BR');
    }

    function getStatusClass(status) {
        if (!status) return '';
        var s = String(status).toLowerCase();
        if (s === 'aberto' || s === 'em cobranca' || s === 'em cobrança') return 'status-active';
        if (s === 'fechado' || s === 'pago') return 'status-success';
        if (s === 'indenizado') return 'status-warning';
        if (s === 'parcela paga') return 'status-success';
        if (s === 'parcela vencida') return 'status-danger';
        return 'status-active';
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

    // Expose for potential debug
    window.__dashboard = { data: data, refreshAll: refreshAll };
});
