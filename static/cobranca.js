document.addEventListener('DOMContentLoaded', function () {

    // ---- Referências DOM ----
    const blocksContainer = document.getElementById('blocksContainer');
    const operadorSelect = document.getElementById('operadorSelect');
    const totalDisplay = document.getElementById('totalDisplay');
    const footerCritico = document.getElementById('footerCritico');
    const footerAtencao = document.getElementById('footerAtencao');
    const footerRecente = document.getElementById('footerRecente');
    const toolbarTotal = document.getElementById('toolbarTotal');
    const loadingState = document.getElementById('loadingState');

    // Pesquisa
    const searchInput = document.getElementById('searchInput');
    const searchType = document.getElementById('searchType');
    const btnSearchClear = document.getElementById('btnSearchClear');

    // Modal (reutiliza o mesmo padrão da busca)
    const detalhesModal = document.getElementById('detalhesModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    let currentData = null;
    let searchDebounce = null;

    // Estado de ordenação por bloco
    var sortConfigs = {
        critico: { column: null, order: 'asc' },
        atencao: { column: null, order: 'asc' },
        recente: { column: null, order: 'asc' }
    };

    // Placeholders dinâmicos por tipo de pesquisa
    const placeholders = {
        all: 'Pesquisar por Nome, CPF, Grupo/Cota ou Bem...',
        cpf: 'Digite o CPF ou CNPJ...',
        nome: 'Digite o nome do devedor...',
        grupo_cota: 'Digite grupo/cota (ex: 084731/0737)...',
        bem: 'Digite a descrição do bem...'
    };

    // ---- Carregamento Inicial ----
    loadCobranca();

    operadorSelect.addEventListener('change', function () {
        loadCobranca();
    });

    // ---- Pesquisa ----
    searchType.addEventListener('change', function () {
        searchInput.placeholder = placeholders[this.value] || placeholders.all;
        applyFilter();
        searchInput.focus();
    });

    searchInput.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        btnSearchClear.style.display = this.value.length > 0 ? 'flex' : 'none';
        searchDebounce = setTimeout(function () {
            applyFilter();
        }, 300);
    });

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            clearSearch();
        }
    });

    btnSearchClear.addEventListener('click', function () {
        clearSearch();
    });

    function clearSearch() {
        searchInput.value = '';
        btnSearchClear.style.display = 'none';
        applyFilter();
        searchInput.focus();
    }

    function applyFilter() {
        if (!currentData) return;

        const termo = searchInput.value.trim().toLowerCase();
        const tipo = searchType.value;

        if (!termo) {
            renderBlocks(currentData);
            return;
        }

        // Filtrar cada bloco
        const filtered = {
            critico: filterContracts(currentData.critico, termo, tipo),
            atencao: filterContracts(currentData.atencao, termo, tipo),
            recente: filterContracts(currentData.recente, termo, tipo),
        };

        renderBlocks(filtered);
    }

    function filterContracts(contracts, termo, tipo) {
        if (!contracts) return [];
        return contracts.filter(function (c) {
            var grupoCota = ((c.grupo || '') + ' / ' + (c.cota || '')).toLowerCase();
            var grupoCotaCompact = ((c.grupo || '') + '/' + (c.cota || '')).toLowerCase();

            switch (tipo) {
                case 'cpf':
                    return matchField(c.cpf_cnpj, termo);
                case 'nome':
                    return matchField(c.nome_devedor, termo);
                case 'grupo_cota':
                    return grupoCota.indexOf(termo) !== -1 || grupoCotaCompact.indexOf(termo) !== -1;
                case 'bem':
                    // Campo "bem" ainda não existe no banco, mas já preparamos
                    return matchField(c.bem, termo);
                default: // 'all'
                    return matchField(c.cpf_cnpj, termo) ||
                        matchField(c.nome_devedor, termo) ||
                        grupoCota.indexOf(termo) !== -1 ||
                        grupoCotaCompact.indexOf(termo) !== -1 ||
                        matchField(c.bem, termo) ||
                        matchField(c.numero_contrato, termo);
            }
        });
    }

    function matchField(value, termo) {
        if (!value) return false;
        return String(value).toLowerCase().indexOf(termo) !== -1;
    }


    async function loadCobranca() {
        showLoading();

        try {
            let url = '/api/cobranca';
            const operador = operadorSelect.value;
            if (operador) {
                url += '?operador=' + encodeURIComponent(operador);
            }

            const resp = await fetch(url);
            const data = await resp.json();
            currentData = data;

            // Resetar ordenação ao trocar de operador ou carregar novo
            sortConfigs = {
                critico: { column: null, order: 'asc' },
                atencao: { column: null, order: 'asc' },
                recente: { column: null, order: 'asc' }
            };

            // Preencher dropdown de operadores (apenas 1 vez ou se lista mudou)
            if (data.operadores && data.operadores.length > 0) {
                const currentVal = operadorSelect.value;
                const hasOptions = operadorSelect.options.length > 1;
                if (!hasOptions) {
                    data.operadores.forEach(function (op) {
                        const opt = document.createElement('option');
                        opt.value = op;
                        opt.textContent = op;
                        operadorSelect.appendChild(opt);
                    });
                    if (currentVal) operadorSelect.value = currentVal;
                }
            }

            renderBlocks(data);
        } catch (err) {
            blocksContainer.innerHTML =
                '<div class="empty-block"><i class="fa-solid fa-triangle-exclamation"></i>' +
                'Erro ao carregar contratos: ' + esc(err.message) + '</div>';
        }
    }

    function showLoading() {
        if (loadingState) loadingState.style.display = 'flex';
        blocksContainer.innerHTML = '';
    }

    // ---- Renderização ----
    function renderBlocks(data) {
        if (loadingState) loadingState.style.display = 'none';
        blocksContainer.innerHTML = '';

        // Bloco CRÍTICO
        blocksContainer.appendChild(
            buildPriorityBlock('critico', 'Crítico', '60 – 90+ dias de atraso',
                'fa-solid fa-fire', sortLevelData(data.critico, 'critico'))
        );

        // Bloco ATENÇÃO
        blocksContainer.appendChild(
            buildPriorityBlock('atencao', 'Atenção', '30 – 60 dias de atraso',
                'fa-solid fa-exclamation-triangle', sortLevelData(data.atencao, 'atencao'))
        );

        // Bloco RECENTE
        blocksContainer.appendChild(
            buildPriorityBlock('recente', 'Recente', '1 – 30 dias de atraso',
                'fa-solid fa-clock', sortLevelData(data.recente, 'recente'))
        );

        // Atualizar contagens
        const total = (data.critico ? data.critico.length : 0) +
            (data.atencao ? data.atencao.length : 0) +
            (data.recente ? data.recente.length : 0);

        if (totalDisplay) totalDisplay.textContent = total.toLocaleString('pt-BR');
        if (toolbarTotal) toolbarTotal.textContent = total.toLocaleString('pt-BR');
        if (footerCritico) footerCritico.textContent = (data.critico ? data.critico.length : 0).toLocaleString('pt-BR');
        if (footerAtencao) footerAtencao.textContent = (data.atencao ? data.atencao.length : 0).toLocaleString('pt-BR');
        if (footerRecente) footerRecente.textContent = (data.recente ? data.recente.length : 0).toLocaleString('pt-BR');
    }

    function buildPriorityBlock(level, title, desc, iconClass, contracts) {
        const block = document.createElement('div');
        block.className = 'priority-block ' + level + ' collapsed';

        const count = contracts ? contracts.length : 0;
        const diasClass = 'dias-' + level;

        // Header
        const header = document.createElement('div');
        header.className = 'priority-header';
        header.innerHTML =
            '<div class="priority-header-left">' +
            '  <div class="priority-icon"><i class="' + iconClass + '"></i></div>' +
            '  <div class="priority-info">' +
            '    <h4>' + esc(title) + '</h4>' +
            '    <span class="priority-desc">' + esc(desc) + '</span>' +
            '  </div>' +
            '</div>' +
            '<div class="priority-header-right">' +
            '  <span class="priority-count">' + count + ' contrato' + (count !== 1 ? 's' : '') + '</span>' +
            '  <i class="fa-solid fa-chevron-down priority-chevron"></i>' +
            '</div>';

        header.addEventListener('click', function () {
            block.classList.toggle('collapsed');
        });

        block.appendChild(header);

        // Body (tabela)
        const body = document.createElement('div');
        body.className = 'priority-body';

        if (!contracts || contracts.length === 0) {
            body.innerHTML =
                '<div class="empty-block">' +
                '<i class="fa-regular fa-circle-check"></i>' +
                'Nenhum contrato nesta faixa de prioridade.</div>';
        } else {
            const tableWrap = document.createElement('div');
            tableWrap.className = 'table-responsive';

            const table = document.createElement('table');
            table.className = 'styled-table';

            const thead = document.createElement('thead');
            const cfg = sortConfigs[level];

            function getHeaderHTML(label, col) {
                var cls = 'sortable-header';
                if (cfg.column === col) cls += ' ' + cfg.order;
                return '<th class="' + cls + '" data-column="' + col + '" data-level="' + level + '">' +
                    label + ' <i class="fa-solid fa-sort sort-icon"></i></th>';
            }

            thead.innerHTML =
                '<tr>' +
                getHeaderHTML('Grupo / Cota', 'grupo') +
                getHeaderHTML('Nome Devedor', 'nome_devedor') +
                getHeaderHTML('CPF / CNPJ', 'cpf_cnpj') +
                getHeaderHTML('Parcelas Abertas', 'parcelas_abertas') +
                getHeaderHTML('Dias Atraso', 'dias_atraso') +
                getHeaderHTML('Vencimento', 'vencimento_mais_antigo') +
                '</tr>';

            // Click listener para ordenação
            thead.querySelectorAll('.sortable-header').forEach(function (th) {
                th.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var col = this.getAttribute('data-column');
                    var lvl = this.getAttribute('data-level');

                    if (sortConfigs[lvl].column === col) {
                        sortConfigs[lvl].order = sortConfigs[lvl].order === 'asc' ? 'desc' : 'asc';
                    } else {
                        sortConfigs[lvl].column = col;
                        sortConfigs[lvl].order = 'asc';
                    }

                    // Re-renderizar mantendo o filtro de pesquisa atual
                    applyFilter();

                    // Abrir o bloco se ele foi renderizado fechado (opcional, mas bom pra UX)
                    const newBlock = blocksContainer.querySelector('.' + lvl);
                    if (newBlock) newBlock.classList.remove('collapsed');
                });
            });

            table.appendChild(thead);

            const tbody = document.createElement('tbody');

            contracts.forEach(function (c) {
                // Linha principal do contrato
                const tr = document.createElement('tr');
                tr.className = 'contract-row';
                tr.setAttribute('data-id', c.id);

                var dias = c.dias_atraso || 0;
                if (typeof dias === 'string') dias = parseInt(dias);

                tr.innerHTML =
                    '<td class="fw-bold">' + esc(c.grupo) + ' / ' + esc(c.cota) + '</td>' +
                    '<td>' + esc(c.nome_devedor || '-') + '</td>' +
                    '<td>' + esc(c.cpf_cnpj || '-') + '</td>' +
                    '<td>' + esc(c.parcelas_abertas || 0) + '</td>' +
                    '<td><span class="dias-badge ' + diasClass + '">' +
                    '<i class="fa-solid fa-clock"></i> ' + dias + 'd</span></td>' +
                    '<td class="text-right">' + formatDate(c.vencimento_mais_antigo) + '</td>';

                tr.addEventListener('click', function () {
                    toggleExpandRow(tr, c, tbody, level);
                });

                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            tableWrap.appendChild(table);
            body.appendChild(tableWrap);
        }

        block.appendChild(body);
        return block;
    }

    // ---- Expandir / Recolher linha do contrato ----
    function toggleExpandRow(tr, contract, tbody, level) {
        // Se já está expandido, remove
        const existing = tr.nextElementSibling;
        if (existing && existing.classList.contains('contract-expand-row')) {
            existing.remove();
            tr.classList.remove('selected');
            return;
        }

        // Remove qualquer outro expandido neste bloco
        tbody.querySelectorAll('.contract-expand-row').forEach(function (el) { el.remove(); });
        tbody.querySelectorAll('.contract-row.selected').forEach(function (el) { el.classList.remove('selected'); });

        tr.classList.add('selected');

        const expandTr = document.createElement('tr');
        expandTr.className = 'contract-expand-row';
        const expandTd = document.createElement('td');
        expandTd.setAttribute('colspan', '6');

        expandTd.innerHTML =
            '<div class="contract-expand-panel">' +
            '  <div class="expand-grid">' +
            '    <div class="expand-item">' +
            '      <span class="expand-label">Grupo / Cota</span>' +
            '      <span class="expand-value">' + esc(contract.grupo) + ' / ' + esc(contract.cota) + '</span>' +
            '    </div>' +
            '    <div class="expand-item">' +
            '      <span class="expand-label">Nome do Devedor</span>' +
            '      <span class="expand-value">' + esc(contract.nome_devedor || '-') + '</span>' +
            '    </div>' +
            '    <div class="expand-item">' +
            '      <span class="expand-label">CPF / CNPJ</span>' +
            '      <span class="expand-value">' + esc(contract.cpf_cnpj || '-') + '</span>' +
            '    </div>' +
            '    <div class="expand-item">' +
            '      <span class="expand-label">Bem</span>' +
            '      <span class="expand-value">—</span>' +
            '    </div>' +
            '    <div class="expand-item">' +
            '      <span class="expand-label">Nro Contrato</span>' +
            '      <span class="expand-value">' + esc(contract.numero_contrato || '-') + '</span>' +
            '    </div>' +
            '    <div class="expand-item">' +
            '      <span class="expand-label">Valor Crédito</span>' +
            '      <span class="expand-value">' + formatCurrency(contract.valor_credito) + '</span>' +
            '    </div>' +
            '  </div>' +
            '  <div class="expand-actions">' +
            '    <button class="btn-cobrar" data-id="' + contract.id + '"' +
            '      data-nome="' + esc(contract.nome_devedor || '') + '"' +
            '      data-cpf="' + esc(contract.cpf_cnpj || '') + '"' +
            '      data-grupo="' + esc(contract.grupo || '') + '"' +
            '      data-cota="' + esc(contract.cota || '') + '">' +
            '      <i class="fa-solid fa-phone"></i> Cobrar' +
            '    </button>' +
            '    <button class="btn-detalhes" data-id="' + contract.id + '">' +
            '      <i class="fa-solid fa-file-lines"></i> Detalhes' +
            '    </button>' +
            '  </div>' +
            '</div>';

        expandTr.appendChild(expandTd);

        // Inserir logo após a linha clicada
        if (tr.nextSibling) {
            tbody.insertBefore(expandTr, tr.nextSibling);
        } else {
            tbody.appendChild(expandTr);
        }

        // Bind do botão Detalhes
        expandTr.querySelector('.btn-detalhes').addEventListener('click', function (e) {
            e.stopPropagation();
            openContractDetails(this.getAttribute('data-id'));
        });

        // Bind do botão Cobrar
        expandTr.querySelector('.btn-cobrar').addEventListener('click', function (e) {
            e.stopPropagation();
            iniciarCobranca(this);
        });
    }

    // ---- Discador / Cobrar (placeholder para API futura) ----
    function iniciarCobranca(btn) {
        var contratoId = btn.getAttribute('data-id');
        var nome = btn.getAttribute('data-nome');
        var cpf = btn.getAttribute('data-cpf');
        var grupo = btn.getAttribute('data-grupo');
        var cota = btn.getAttribute('data-cota');

        // TODO: Integrar com a API do discador quando a documentação estiver disponível
        // Exemplo de payload que será enviado:
        // {
        //     contrato_id: contratoId,
        //     nome_devedor: nome,
        //     cpf_cnpj: cpf,
        //     grupo: grupo,
        //     cota: cota
        // }

        console.log('[Cobrar] Contrato:', contratoId, '| Devedor:', nome, '| CPF:', cpf, '| Grupo/Cota:', grupo + '/' + cota);

        // Feedback visual temporário
        var originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Discando...';
        btn.disabled = true;
        btn.classList.add('btn-cobrar-active');

        setTimeout(function () {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            btn.classList.remove('btn-cobrar-active');
        }, 2000);
    }

    // ---- Modal de Detalhes (reutiliza o padrão de busca.js) ----
    async function openContractDetails(id) {
        modalContent.innerHTML =
            '<div style="text-align:center;padding:48px;color:var(--text-muted)">' +
            '<i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i>' +
            '<p style="margin-top:12px">Carregando detalhes...</p></div>';
        modalTitle.textContent = 'Carregando...';
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            const resp = await fetch('/api/contrato/' + id);
            const data = await resp.json();
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

        // Dados do contrato
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

        // Devedor
        if (data.devedor) {
            html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails);
        }

        // Avalista
        if (data.avalista) {
            html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails);
        }

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

        // Tramitacoes (com toggle ocultar/exibir)
        if (data.tramitacoes && data.tramitacoes.length > 0) {
            html += '<div class="detail-section tramitacao-section">';
            html += '<h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="var c = this.nextElementSibling; var i = this.querySelector(\'i.fa-chevron-down\'); if (c.classList.contains(\'d-none\')) { c.classList.remove(\'d-none\'); i.style.transform = \'rotate(180deg)\'; } else { c.classList.add(\'d-none\'); i.style.transform = \'rotate(0deg)\'; }">';
            html += '<span style="pointer-events:none;"><i class="fa-solid fa-comments"></i> Tramitações (' + data.tramitacoes.length + ')</span>';
            html += '<i class="fa-solid fa-chevron-down" style="pointer-events:none; transition: transform 0.3s ease;"></i></h3>';
            html += '<div class="tramitacao-container d-none">'; // inicialmente oculto
            html += '<div class="table-responsive"><table class="styled-table modal-table"><thead><tr>';
            html += '<th>Data</th><th>Tipo</th><th>CPC</th>';
            html += '</tr></thead><tbody>';
            data.tramitacoes.forEach(function (t) {
                html += '<tr>';
                html += '<td>' + formatDateTime(t.data) + '</td>';
                html += '<td><span class="status-badge status-active">' + esc(t.tipo) + '</span></td>';
                html += '<td><span class="status-badge ' + (String(t.cpc).toLowerCase()==='sim'?'status-success':(String(t.cpc).toLowerCase()==='nao'?'status-danger':'status-warning')) + '">' + esc(t.cpc) + '</span></td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div></div>';
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
                    html += '<button class="btn-ligar" title="Ligar"><i class="fa-solid fa-phone-volume"></i></button>';
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

    // ---- Modal open/close ----
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

    // ---- Helpers ----
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

    // ---- Lógica de Ordenação ----
    function sortLevelData(contracts, level) {
        if (!contracts || contracts.length === 0) return contracts;
        const cfg = sortConfigs[level];
        if (!cfg.column) return contracts;

        const col = cfg.column;
        const order = cfg.order === 'asc' ? 1 : -1;

        return [...contracts].sort(function (a, b) {
            var valA = a[col];
            var valB = b[col];

            // Casos especiais
            if (col === 'vencimento_mais_antigo') {
                valA = valA ? new Date(valA) : new Date(0);
                valB = valB ? new Date(valB) : new Date(0);
            } else if (col === 'parcelas_abertas' || col === 'dias_atraso') {
                valA = parseInt(valA) || 0;
                valB = parseInt(valB) || 0;
            } else if (col === 'grupo') {
                var fullA = (a.grupo || '') + (a.cota || '');
                var fullB = (b.grupo || '') + (b.cota || '');
                return fullA.localeCompare(fullB) * order;
            }

            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * order;
            }
            return (valA < valB ? -1 : 1) * order;
        });
    }

});
