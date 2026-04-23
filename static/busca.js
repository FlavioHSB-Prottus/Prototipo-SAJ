document.addEventListener('DOMContentLoaded', function () {

    const searchForm = document.getElementById('searchForm');
    const tipoBusca = document.getElementById('tipo_busca');
    const termoInput = document.getElementById('termo');
    const resultsSection = document.getElementById('resultsSection');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsHead = document.querySelector('#resultsHead tr');
    const resultsBody = document.getElementById('resultsBody');
    const noResults = document.getElementById('noResults');
    const detalhesModal = document.getElementById('detalhesModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const btnLimpar = document.getElementById('btnLimpar');
    const statusFiltro = document.getElementById('status_filtro');
    const buscaResultsFooter = document.getElementById('buscaResultsFooter');
    const btnExportarBusca = document.getElementById('btnExportarBusca');

    var searchResults = [];
    var lastSearchTipo = 'pessoa';
    var sortConfig = { column: null, order: 'asc' };

    let activeTipo = 'pessoa';
    var _pessoaCache = null;
    var _fromPessoa = false;

    // Placeholder dinamico (filtro de status visivel em todos os tipos)
    tipoBusca.addEventListener('change', function () {
        activeTipo = this.value;
        if (activeTipo === 'pessoa') {
            termoInput.placeholder = 'Digite o nome ou CPF/CNPJ...';
        } else if (activeTipo === 'bem') {
            termoInput.placeholder = 'Digite a descrição do bem (modelo, marca, etc)...';
        } else {
            termoInput.placeholder = 'Digite grupo/cota (ex: 001234/0012)';
        }
    });

    // Limpar resultados
    btnLimpar.addEventListener('click', function () {
        resultsSection.classList.add('d-none');
        resultsBody.innerHTML = '';
        resultsHead.innerHTML = '';
        noResults.classList.add('d-none');
        searchResults = [];
        sortConfig = { column: null, order: 'asc' };
        if (buscaResultsFooter) buscaResultsFooter.classList.add('d-none');
    });

    // Busca
    searchForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        activeTipo = tipoBusca.value;
        const termo = termoInput.value.trim();
        if (!termo) return;

        resultsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</td></tr>';
        noResults.classList.add('d-none');
        resultsSection.classList.remove('d-none');

        try {
            var url = '/api/busca?tipo=' + encodeURIComponent(activeTipo) + '&termo=' + encodeURIComponent(termo);
            if (statusFiltro.value) {
                url += '&status=' + encodeURIComponent(statusFiltro.value);
            }
            const resp = await fetch(url);
            const data = await resp.json();
            if (buscaResultsFooter) buscaResultsFooter.classList.add('d-none');
            renderResults(data.results, activeTipo);
        } catch (err) {
            if (buscaResultsFooter) buscaResultsFooter.classList.add('d-none');
            resultsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#ef4444">Erro ao buscar: ' + err.message + '</td></tr>';
        }
    });

    function thSortable(label, dataColumn) {
        return '<th class="sortable-header" data-column="' + esc(dataColumn) + '">' + label +
            ' <i class="fa-solid fa-sort sort-icon"></i></th>';
    }

    function buildTheadHtml(tipo) {
        if (tipo === 'pessoa') {
            return thSortable('Nome', 'nome_completo') + thSortable('CPF / CNPJ', 'cpf_cnpj') +
                thSortable('Profissao', 'profissao') + '<th class="text-right">Acoes</th>';
        }
        if (tipo === 'bem') {
            return thSortable('Grupo / Cota', 'grupo') + thSortable('Bem', 'bem_descricao') +
                thSortable('Nome Devedor', 'nome_devedor') + thSortable('Status', 'status') + '<th class="text-right">Acoes</th>';
        }
        return thSortable('Grupo / Cota', 'grupo') + thSortable('Nro Contrato', 'numero_contrato') +
            thSortable('Nome Devedor', 'nome_devedor') + thSortable('Status', 'status') + '<th class="text-right">Acoes</th>';
    }

    function sortData() {
        if (!sortConfig.column || !searchResults.length) return;
        var col = sortConfig.column;
        var order = sortConfig.order === 'asc' ? 1 : -1;
        searchResults.sort(function (a, b) {
            if (col === 'grupo') {
                var aFull = (a.grupo || '') + (a.cota || '');
                var bFull = (b.grupo || '') + (b.cota || '');
                return aFull.localeCompare(bFull, 'pt-BR', { numeric: true }) * order;
            }
            if (col === 'numero_contrato') {
                var nA = parseInt(String(a.numero_contrato == null ? '' : a.numero_contrato).replace(/\D/g, ''), 10);
                var nB = parseInt(String(b.numero_contrato == null ? '' : b.numero_contrato).replace(/\D/g, ''), 10);
                if (!isNaN(nA) && !isNaN(nB) && nA !== nB) {
                    return (nA - nB) * order;
                }
            }
            var valA = a[col];
            var valB = b[col];
            if (valA == null) valA = '';
            if (valB == null) valB = '';
            return String(valA).localeCompare(String(valB), 'pt-BR', { numeric: true, sensitivity: 'base' }) * order;
        });
    }

    function updateSortHeaderClasses() {
        if (!resultsHead) return;
        resultsHead.querySelectorAll('th.sortable-header').forEach(function (th) {
            th.classList.remove('asc', 'desc');
            if (sortConfig.column && th.getAttribute('data-column') === sortConfig.column) {
                th.classList.add(sortConfig.order);
            }
        });
    }

    function handleSort(column) {
        if (sortConfig.column === column) {
            sortConfig.order = sortConfig.order === 'asc' ? 'desc' : 'asc';
        } else {
            sortConfig.column = column;
            sortConfig.order = 'asc';
        }
        sortData();
        renderTableBody();
        updateSortHeaderClasses();
        bindDetailButtons();
    }

    function renderTableBody() {
        resultsBody.innerHTML = '';
        var tipo = lastSearchTipo;
        if (tipo === 'pessoa') {
            searchResults.forEach(function (p) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td class="fw-bold">' + esc(p.nome_completo) + '</td>' +
                    '<td>' + esc(p.cpf_cnpj) + '</td>' +
                    '<td>' + esc(p.profissao || '-') + '</td>' +
                    '<td class="text-right"><button class="action-btn" data-id="' + p.id + '" data-tipo="pessoa"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                resultsBody.appendChild(tr);
            });
        } else if (tipo === 'bem') {
            searchResults.forEach(function (c) {
                var statusClass = getStatusClass(c.status);
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td class="fw-bold">' + esc(c.grupo) + '/' + esc(c.cota) + '</td>' +
                    '<td>' + esc(c.bem_descricao || '-') + '</td>' +
                    '<td>' + esc(c.nome_devedor || '-') + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + esc(c.status || '-') + '</span></td>' +
                    '<td class="text-right"><button class="action-btn" data-id="' + c.id + '" data-tipo="contrato"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                resultsBody.appendChild(tr);
            });
        } else {
            searchResults.forEach(function (c) {
                var statusClass = getStatusClass(c.status);
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td class="fw-bold">' + esc(c.grupo) + '/' + esc(c.cota) + '</td>' +
                    '<td>' + esc(c.numero_contrato || '-') + '</td>' +
                    '<td>' + esc(c.nome_devedor || '-') + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + esc(c.status || '-') + '</span></td>' +
                    '<td class="text-right"><button class="action-btn" data-id="' + c.id + '" data-tipo="contrato"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                resultsBody.appendChild(tr);
            });
        }
    }

    if (resultsSection) {
        resultsSection.addEventListener('click', function (e) {
            var th = e.target && e.target.closest && e.target.closest('th.sortable-header');
            if (!th) return;
            e.preventDefault();
            var col = th.getAttribute('data-column');
            if (!col) return;
            handleSort(col);
        });
    }

    if (btnExportarBusca) {
        btnExportarBusca.addEventListener('click', function () {
            exportarListaBusca();
        });
    }

    function exportarListaBusca() {
        if (!searchResults || searchResults.length === 0) return;
        var tipo = lastSearchTipo;
        var headers;
        var rows;
        if (tipo === 'pessoa') {
            headers = ['Nome', 'CPF/CNPJ', 'Profissao'];
            rows = searchResults.map(function (p) {
                return [p.nome_completo, p.cpf_cnpj, p.profissao != null ? p.profissao : ''];
            });
        } else if (tipo === 'bem') {
            headers = ['Grupo', 'Cota', 'Bem', 'Nome Devedor', 'Status'];
            rows = searchResults.map(function (c) {
                return [c.grupo, c.cota, c.bem_descricao, c.nome_devedor, c.status];
            });
        } else {
            headers = ['Grupo', 'Cota', 'Nro Contrato', 'Nome Devedor', 'Status'];
            rows = searchResults.map(function (c) {
                return [c.grupo, c.cota, c.numero_contrato, c.nome_devedor, c.status];
            });
        }
        var lines = [headers].concat(rows);
        var csv = '\uFEFF' + lines.map(function (row) {
            return row.map(function (cell) {
                var s = cell == null ? '' : String(cell);
                if (/[;"\r\n]/.test(s)) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(';');
        }).join('\r\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        var name = 'busca_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.csv';
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    function renderResults(results, tipo) {
        searchResults = (results || []).slice();
        lastSearchTipo = tipo;
        sortConfig = { column: null, order: 'asc' };
        resultsBody.innerHTML = '';

        if (!searchResults || searchResults.length === 0) {
            resultsHead.innerHTML = '';
            resultsTitle.textContent = 'Resultados da Busca (0 encontrados)';
            noResults.classList.remove('d-none');
            if (buscaResultsFooter) buscaResultsFooter.classList.add('d-none');
            return;
        }

        noResults.classList.add('d-none');
        resultsTitle.textContent = 'Resultados da Busca (' + searchResults.length + ' encontrado' + (searchResults.length > 1 ? 's' : '') + ')';
        resultsHead.innerHTML = buildTheadHtml(tipo);
        renderTableBody();
        updateSortHeaderClasses();
        if (buscaResultsFooter) buscaResultsFooter.classList.remove('d-none');
        bindDetailButtons();
    }

    function bindDetailButtons() {
        document.querySelectorAll('#resultsBody .action-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                var tipo = this.getAttribute('data-tipo');
                openDetails(id, tipo);
            });
        });
    }

    // --- Modal ---

    async function openDetails(id, tipo) {
        _fromPessoa = false;
        modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';
        modalTitle.textContent = 'Carregando...';
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            var url = tipo === 'pessoa' ? '/api/pessoa/' + id : '/api/contrato/' + id;
            var resp = await fetch(url);
            var data = await resp.json();
            if (data.error) {
                modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">' + esc(data.error) + '</p>';
                return;
            }
            if (tipo === 'pessoa') {
                renderPessoaModal(data);
            } else {
                renderContratoModal(data);
            }
        } catch (err) {
            modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">Erro: ' + esc(err.message) + '</p>';
        }
    }

    function renderPessoaModal(data) {
        _pessoaCache = data;
        var p = data.pessoa;
        modalTitle.innerHTML = 'Detalhes da Pessoa: <span class="text-accent">' + esc(p.nome_completo) + '</span>';

        var html = '';

        // Dados pessoais
        html += '<div class="detail-section"><h3><i class="fa-solid fa-user"></i> Dados Pessoais</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Nome', p.nome_completo);
        html += dataItem('CPF / CNPJ', p.cpf_cnpj);
        html += dataItem('Data de Nascimento', formatDate(p.data_nascimento));
        html += dataItem('Profissao', p.profissao);
        html += dataItem('Conjuge', p.conjuge_nome);
        html += '</div></div>';

        // Enderecos
        if (data.enderecos && data.enderecos.length > 0) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-location-dot"></i> Enderecos</h3>';
            data.enderecos.forEach(function (e) {
                html += '<div class="detail-grid" style="margin-bottom:12px">';
                html += dataItem('Tipo', e.tipo);
                html += dataItem('Logradouro', e.logradouro);
                html += dataItem('Bairro', e.bairro);
                html += dataItem('Complemento', e.complemento);
                html += dataItem('CEP', e.cep);
                html += dataItem('Cidade', e.cidade);
                html += dataItem('Estado', e.estado);
                html += '</div>';
            });
            html += '</div>';
        }

        // Telefones e Emails
        if ((data.telefones && data.telefones.length) || (data.emails && data.emails.length)) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-address-book"></i> Contatos</h3>';
            html += '<div class="contact-grid">';

            if (data.telefones && data.telefones.length) {
                html += '<div><h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">Telefones</h4><ul class="contact-list">';
                data.telefones.forEach(function (t) {
                    html += '<li><i class="fa-solid fa-phone"></i> ' + esc(t.numero || '-');
                    if (t.ramal) html += ' (ramal ' + esc(t.ramal) + ')';
                    html += '<button class="btn-ligar" title="Ligar"><i class="fa-solid fa-phone-volume"></i></button>';
                    html += '<button class="btn-mensagem" title="Enviar Mensagem"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-tipo">' + esc(t.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }

            if (data.emails && data.emails.length) {
                html += '<div><h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">E-mails</h4><ul class="contact-list">';
                data.emails.forEach(function (em) {
                    html += '<li><i class="fa-solid fa-envelope"></i> ' + esc(em.email || '-');
                    html += '<button class="btn-mensagem" title="Enviar Mensagem"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-tipo">' + esc(em.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }

            html += '</div></div>';
        }

        // Contratos
        if (data.contratos && data.contratos.length > 0) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-file-contract"></i> Contratos Vinculados</h3>';
            html += '<div class="table-responsive"><table class="styled-table modal-table"><thead><tr>';
            html += '<th>Grupo / Cota</th><th>Nro Contrato</th><th>Status</th><th>Valor Credito</th><th>Papel</th><th class="text-right">Acoes</th>';
            html += '</tr></thead><tbody>';
            data.contratos.forEach(function (c) {
                var papel = (String(c.id_pessoa) === String(data.pessoa.id)) ? 'Devedor' : 'Avalista';
                html += '<tr>';
                html += '<td>' + esc(c.grupo) + '/' + esc(c.cota) + '</td>';
                html += '<td>' + esc(c.numero_contrato || '-') + '</td>';
                html += '<td><span class="status-badge ' + getStatusClass(c.status) + '">' + esc(c.status || '-') + '</span></td>';
                html += '<td>' + formatCurrency(c.valor_credito) + '</td>';
                html += '<td>' + papel + '</td>';
                html += '<td class="text-right"><button type="button" class="action-btn btn-ver-contrato" data-contrato-id="' + String(c.id) + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        modalContent.innerHTML = html;
        bindPessoaModalContratoButtons();
    }

    function bindPessoaModalContratoButtons() {
        modalContent.querySelectorAll('.btn-ver-contrato').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var cid = this.getAttribute('data-contrato-id');
                if (!cid) return;
                _fromPessoa = true;
                modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';
                modalTitle.textContent = 'Carregando...';
                try {
                    var resp = await fetch('/api/contrato/' + cid);
                    var d = await resp.json();
                    if (d.error) {
                        modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">' + esc(d.error) + '</p>';
                        return;
                    }
                    renderContratoModal(d);
                } catch (err) {
                    modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">Erro: ' + esc(err.message) + '</p>';
                }
            });
        });
    }

    function renderContratoModal(data) {
        var c = data.contrato;
        modalTitle.innerHTML = 'Detalhes do Contrato: <span class="text-accent">' + esc(c.grupo) + '/' + esc(c.cota) + '</span>';

        var html = '';

        if (_fromPessoa) {
            html += '<div class="modal-nav-back"><button type="button" class="btn-voltar-pessoa"><i class="fa-solid fa-arrow-left"></i> Voltar para pessoa</button></div>';
        }

        // Dados do contrato
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

        // Devedor
        if (data.devedor) {
            html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails);
        }

        // Avalista
        if (data.avalista) {
            html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails);
        }

        // Bem
        html += renderBemSection(data.bens);

        // Parcelas
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

        // Ocorrencias
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

        html += (typeof TramitacoesDetalhe !== 'undefined')
            ? TramitacoesDetalhe.buildSection(data.tramitacoes || [], c.id, { esc: esc, formatDateTime: formatDateTime })
            : '';

        modalContent.innerHTML = html;

        if (_fromPessoa) {
            var backBtn = modalContent.querySelector('.btn-voltar-pessoa');
            if (backBtn) {
                backBtn.addEventListener('click', function () {
                    if (_pessoaCache) {
                        renderPessoaModal(_pessoaCache);
                    }
                });
            }
        }

        if (typeof TramitacoesDetalhe !== 'undefined') {
            TramitacoesDetalhe.attachModal(modalContent, c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                onReload: function () { return openDetails(c.id, 'contrato'); }
            });
        }
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
