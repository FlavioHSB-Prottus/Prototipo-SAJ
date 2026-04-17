document.addEventListener('DOMContentLoaded', function () {

    var tipoSelect = document.getElementById('tipo_relatorio');
    var dataInicial = document.getElementById('data_inicial');
    var dataFinal = document.getElementById('data_final');
    var btnVisualizar = document.getElementById('btnVisualizar');
    var btnExcel = document.getElementById('btnExcel');
    var btnPdf = document.getElementById('btnPdf');
    var resultsSection = document.getElementById('resultsSection');
    var resultsTitle = document.getElementById('resultsTitle');
    var resultsBody = document.getElementById('resultsBody');
    var noResults = document.getElementById('noResults');
    var detalhesModal = document.getElementById('detalhesModal');
    var closeModalBtn = document.getElementById('closeModalBtn');
    var modalTitle = document.getElementById('modalTitle');
    var modalContent = document.getElementById('modalContent');

    function getParams() {
        return {
            tipo: tipoSelect.value,
            data_inicial: dataInicial.value,
            data_final: dataFinal.value
        };
    }

    function validar() {
        if (!dataInicial.value || !dataFinal.value) {
            alert('Informe a Data Inicial e a Data Final.');
            return false;
        }
        if (dataInicial.value > dataFinal.value) {
            alert('A Data Inicial deve ser anterior ou igual a Data Final.');
            return false;
        }
        return true;
    }

    function buildUrl(base, params) {
        var qs = Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return base + '?' + qs;
    }

    // --- Visualizar na Tela ---
    btnVisualizar.addEventListener('click', async function () {
        if (!validar()) return;
        var params = getParams();

        resultsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</td></tr>';
        noResults.classList.add('d-none');
        resultsSection.classList.remove('d-none');

        try {
            var resp = await fetch(buildUrl('/api/relatorios', params));
            var data = await resp.json();
            if (data.error) {
                resultsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444">' + esc(data.error) + '</td></tr>';
                return;
            }
            renderResults(data.results);
        } catch (err) {
            resultsBody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#ef4444">Erro: ' + esc(err.message) + '</td></tr>';
        }
    });

    // --- Exportar Excel ---
    btnExcel.addEventListener('click', function () {
        if (!validar()) return;
        window.location.href = buildUrl('/api/relatorios/excel', getParams());
    });

    // --- Exportar PDF ---
    btnPdf.addEventListener('click', function () {
        if (!validar()) return;
        window.location.href = buildUrl('/api/relatorios/pdf', getParams());
    });

    // --- Renderizar tabela ---
    function renderResults(results) {
        resultsBody.innerHTML = '';

        if (!results || results.length === 0) {
            resultsTitle.textContent = 'Contratos do Relatório (0 encontrados)';
            noResults.classList.remove('d-none');
            return;
        }

        noResults.classList.add('d-none');
        resultsTitle.textContent = 'Contratos do Relatório (' + results.length + ' encontrado' + (results.length > 1 ? 's' : '') + ')';

        results.forEach(function (c) {
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td class="fw-bold">' + esc(c.grupo) + ' / ' + esc(c.cota) + '</td>' +
                '<td>' + esc(c.numero_contrato || '-') + '</td>' +
                '<td>' + esc(c.nome_devedor || '-') + '</td>' +
                '<td><span class="status-badge ' + getStatusClass(c.status) + '">' + esc(c.status || '-') + '</span></td>' +
                '<td>' + formatDate(c.data_arquivo) + '</td>' +
                '<td class="text-right"><button class="action-btn" data-id="' + c.id + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
            resultsBody.appendChild(tr);
        });

        bindDetailButtons();
    }

    function bindDetailButtons() {
        document.querySelectorAll('#resultsBody .action-btn').forEach(function (btn) {
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
            var data = await resp.json();
            if (data.error) {
                modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">' + esc(data.error) + '</p>';
                return;
            }
            renderContratoModal(data);
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

        modalContent.innerHTML = html;
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

    function formatCurrency(val) {
        if (val === null || val === undefined || val === '') return '-';
        var num = parseFloat(val);
        if (isNaN(num)) return esc(val);
        return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
