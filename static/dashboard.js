document.addEventListener('DOMContentLoaded', async function () {

    Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#64748b';
    Chart.defaults.scale.grid.color = 'rgba(226, 232, 240, 0.5)';

    var kpiAbertos = document.getElementById('kpiAbertos');
    var kpiPagos = document.getElementById('kpiPagos');
    var kpiIndenizados = document.getElementById('kpiIndenizados');
    var kpiRetomados = document.getElementById('kpiRetomados');
    var prioridadeBody = document.getElementById('prioridadeBody');
    var detalhesModal = document.getElementById('detalhesModal');
    var closeModalBtn = document.getElementById('closeModalBtn');
    var modalTitle = document.getElementById('modalTitle');
    var modalContent = document.getElementById('modalContent');

    var data;
    try {
        var resp = await fetch('/api/dashboard');
        data = await resp.json();
    } catch (err) {
        kpiAbertos.textContent = 'Erro';
        return;
    }

    // --- KPIs ---
    kpiAbertos.textContent = formatNumber(data.kpis.abertos);
    kpiPagos.textContent = formatNumber(data.kpis.pagos);
    kpiIndenizados.textContent = formatNumber(data.kpis.indenizados);
    kpiRetomados.textContent = formatNumber(data.kpis.retomados);

    // --- Grafico de Linhas ---
    var lineCtx = document.getElementById('lineChart');
    if (lineCtx) {
        var monthLabels = (data.line_chart.labels || []).map(function (m) {
            var parts = m.split('-');
            var names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return names[parseInt(parts[1], 10) - 1] + '/' + parts[0].slice(2);
        });

        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: 'Contratos Pagos',
                        data: data.line_chart.pagos,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#10b981',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    },
                    {
                        label: 'Indenizados',
                        data: data.line_chart.indenizados,
                        borderColor: '#f59e0b',
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
                    legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
                    tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.9)', padding: 12, titleFont: { size: 13 }, bodyFont: { size: 13 }, cornerRadius: 8 }
                },
                scales: {
                    y: { beginAtZero: true, border: { display: false } },
                    x: { grid: { display: false }, border: { display: false } }
                }
            }
        });
    }

    // --- Grafico Doughnut ---
    var pieCtx = document.getElementById('pieChart');
    if (pieCtx) {
        var pie = data.pie_chart || {};
        var pieLabels = [];
        var pieData = [];
        var pieColors = [];

        var colorMap = { 'aberto': '#3b82f6', 'fechado': '#10b981', 'indenizado': '#f59e0b' };
        var labelMap = { 'aberto': 'Em Cobrança', 'fechado': 'Pagos', 'indenizado': 'Indenizados' };
        var fallbackColors = ['#64748b', '#8b5cf6', '#ec4899', '#06b6d4'];
        var ci = 0;

        Object.keys(pie).forEach(function (key) {
            pieLabels.push(labelMap[key] || key);
            pieData.push(pie[key]);
            pieColors.push(colorMap[key] || fallbackColors[ci++ % fallbackColors.length]);
        });

        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: pieLabels,
                datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 0, hoverOffset: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } }
                }
            }
        });
    }

    // --- Tabela de Prioridade ---
    renderPrioridade(data.prioridade || []);

    // --- Filtro dropdown ---
    var btnFilter = document.getElementById('btn-filter');
    var filterDropdown = document.getElementById('filter-dropdown');

    if (btnFilter && filterDropdown) {
        btnFilter.addEventListener('click', function (e) {
            e.stopPropagation();
            filterDropdown.style.display = filterDropdown.style.display === 'none' ? 'flex' : 'none';
        });

        document.addEventListener('click', function (e) {
            if (!filterDropdown.contains(e.target) && e.target !== btnFilter) {
                filterDropdown.style.display = 'none';
            }
        });

        var checkboxes = filterDropdown.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function (cb) {
            cb.addEventListener('change', function () {
                var checked = Array.from(checkboxes).filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
                var rows = prioridadeBody.querySelectorAll('tr');
                rows.forEach(function (row) {
                    var cell = row.querySelector('td:nth-child(5)');
                    if (cell) {
                        row.style.display = checked.includes(cell.textContent.trim()) ? '' : 'none';
                    }
                });
            });
        });
    }

    // --- Renderizar tabela ---
    function renderPrioridade(rows) {
        prioridadeBody.innerHTML = '';
        if (!rows.length) {
            prioridadeBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhum contrato com parcelas abertas.</td></tr>';
            return;
        }

        var today = new Date();
        today.setHours(0, 0, 0, 0);

        rows.forEach(function (r) {
            var venc = r.vencimento_mais_antigo ? new Date(r.vencimento_mais_antigo + 'T00:00:00') : null;
            var diffDias = venc ? Math.floor((today - venc) / 86400000) : 0;

            var prioLabel, prioClass;
            if (diffDias >= 60) {
                prioLabel = 'Crítico';
                prioClass = 'status-danger';
            } else if (diffDias >= 30) {
                prioLabel = 'Atenção';
                prioClass = 'status-warning';
            } else {
                prioLabel = 'Recente';
                prioClass = 'status-active';
            }

            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="fw-bold">' + esc(r.grupo) + ' / ' + esc(r.cota) + '</td>' +
                '<td>' + esc(r.nome_devedor || '-') + '</td>' +
                '<td>' + esc(r.parcelas_abertas) + '</td>' +
                '<td>' + formatDate(r.vencimento_mais_antigo) + '</td>' +
                '<td><span class="status-badge ' + prioClass + '">' + prioLabel + '</span></td>' +
                '<td class="text-right"><button class="action-btn" data-id="' + r.id + '">Acessar <i class="fa-solid fa-arrow-right"></i></button></td>';
            prioridadeBody.appendChild(tr);
        });

        bindDetailButtons();
    }

    function bindDetailButtons() {
        prioridadeBody.querySelectorAll('.action-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openDetails(this.getAttribute('data-id'));
            });
        });
    }

    // --- Modal ---
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
        html += dataItem('Grupo / Cota', c.grupo + ' / ' + c.cota);
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

        if (data.devedor) {
            html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails);
        }
        if (data.avalista) {
            html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails);
        }

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

        if (data.ocorrencias && data.ocorrencias.length > 0) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-timeline"></i> Historico de Ocorrencias (' + data.ocorrencias.length + ')</h3>';
            html += '<div class="timeline">';
            data.ocorrencias.forEach(function (o) {
                html += '<div class="timeline-item">';
                html += '<div class="timeline-date">' + formatDate(o.data_arquivo) + '</div>';
                html += '<div class="timeline-event"><strong><span class="status-badge ' + getStatusClass(o.status) + '">' + esc(o.status || '') + '</span></strong> ' + esc(o.descricao || '') + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        // Tramitacoes (com toggle ocultar/exibir)
        if (data.tramitacoes && data.tramitacoes.length > 0) {
            html += '<div class="detail-section tramitacao-section">';
            html += '<h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="var c = this.nextElementSibling; var i = this.querySelector(\'i.fa-chevron-down\'); if (c.classList.contains(\'d-none\')) { c.classList.remove(\'d-none\'); i.style.transform = \'rotate(180deg)\'; } else { c.classList.add(\'d-none\'); i.style.transform = \'rotate(0deg)\'; }">';
            html += '<span style="pointer-events:none;"><i class="fa-solid fa-comments"></i> Tramitações (' + data.tramitacoes.length + ')</span>';
            html += '<i class="fa-solid fa-chevron-down" style="pointer-events:none; transition: transform 0.3s ease;"></i></h3>';
            html += '<div class="tramitacao-container d-none">'; // inicialmente oculto
            html += '<div class="table-responsive"><table class="styled-table modal-table"><thead><tr>';
            html += '<th>Data</th><th>Tipo</th><th>CPC</th><th>Descrição</th>';
            html += '</tr></thead><tbody>';
            data.tramitacoes.forEach(function (t) {
                html += '<tr>';
                html += '<td>' + formatDateTime(t.data) + '</td>';
                html += '<td><span class="status-badge status-active">' + esc(t.tipo) + '</span></td>';
                html += '<td><span class="status-badge ' + (String(t.cpc).toLowerCase()==='sim'?'status-success':(String(t.cpc).toLowerCase()==='nao'?'status-danger':'status-warning')) + '">' + esc(t.cpc) + '</span></td>';
                html += '<td>' + esc(t.descricao) + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div></div>';
        }

        modalContent.innerHTML = html;
    }

    function renderBemSection(bens) {
        if (!bens || bens.length === 0) return '';
        var skipFields = { id: 1, id_contrato: 1, grupo: 1, cota: 1, created_at: 1, updated_at: 1 };
        var titulo = bens.length > 1 ? ('Bem (' + bens.length + ')') : 'Bem';
        var html = '<div class="detail-section"><h3><i class="fa-solid fa-box"></i> ' + titulo + '</h3>';
        bens.forEach(function (bem, idx) {
            if (bens.length > 1) {
                html += '<h4 style="margin:16px 0 8px;color:#6b7280;font-size:0.95rem;">Item ' + (idx + 1) + '</h4>';
            }
            html += '<div class="detail-grid">';
            var anyField = false;
            Object.keys(bem).forEach(function (key) {
                if (skipFields[key]) return;
                var value = bem[key];
                if (value === null || value === undefined || value === '') return;
                anyField = true;
                html += dataItem(humanizeBemField(key), formatBemValue(key, value));
            });
            if (!anyField) {
                html += '<div style="color:#9ca3af;">Sem informações adicionais.</div>';
            }
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
        if (k === 'data' || k.indexOf('data_') === 0 || k.indexOf('_data') !== -1) {
            return formatDate(value);
        }
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
                    html += '<button class="btn-ligar" title="Ligar"><i class="fa-solid fa-phone-volume"></i></button>';
                    html += '<button class="btn-mensagem" title="Enviar Mensagem"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-tipo">' + esc(t.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }
            if (emails && emails.length) {
                html += '<div><ul class="contact-list">';
                emails.forEach(function (em) {
                    html += '<li><i class="fa-solid fa-envelope"></i> ' + esc(em.email || '-');
                    html += '<button class="btn-mensagem" title="Enviar Mensagem"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-tipo">' + esc(em.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // --- Modal open/close ---
    function closeModal() {
        detalhesModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    closeModalBtn.addEventListener('click', closeModal);
    detalhesModal.addEventListener('click', function (e) {
        if (e.target === detalhesModal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && detalhesModal.classList.contains('active')) closeModal();
    });

    // --- Helpers ---
    function esc(val) {
        if (val === null || val === undefined) return '-';
        var div = document.createElement('div');
        div.textContent = String(val);
        return div.innerHTML;
    }

    function dataItem(label, value, isBadge, badgeStatus) {
        var display = (value !== null && value !== undefined && value !== '') ? esc(value) : '-';
        if (isBadge && badgeStatus) {
            display = '<span class="status-badge ' + getStatusClass(badgeStatus) + '">' + esc(value) + '</span>';
        }
        return '<div class="data-item"><span class="data-label">' + esc(label) + '</span><span class="data-value">' + display + '</span></div>';
    }

    function formatDate(val) {
        if (!val) return '-';
        var parts = String(val).split('T')[0].split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        return val;
    }

    function formatDateTime(val) {
        if (!val) return '-';
        var parts = String(val).split('T');
        var dPart = parts[0];
        var tPart = parts[1] || '';
        if (parts.length === 1 && val.includes(' ')) {
            var spaceParts = val.split(' ');
            dPart = spaceParts[0];
            tPart = spaceParts[1] || '';
        }
        var dSplit = dPart.split('-');
        var fmtDate = dSplit.length === 3 ? dSplit[2] + '/' + dSplit[1] + '/' + dSplit[0] : dPart;
        var fmtTime = tPart ? tPart.substring(0, 5) : '';
        return fmtDate + (fmtTime ? ' ' + fmtTime : '');
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

});
