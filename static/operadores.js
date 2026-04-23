document.addEventListener('DOMContentLoaded', function () {

    // ---- Referências DOM ----
    const operadorBlocksContainer = document.getElementById('operadorBlocksContainer');
    const loadingState = document.getElementById('loadingState');
    
    const filterOperador = document.getElementById('filterOperador');
    const filterSituacao = document.getElementById('filterSituacao');
    const filterStatusOperador = document.getElementById('filterStatusOperador');
    const filterSearch = document.getElementById('filterSearch');
    const btnSearchClear = document.getElementById('btnSearchClear');

    const STATUS_OPERADOR_LABELS = {
        ativo:    { label: 'Ativo',    icon: 'fa-circle-check' },
        inativo:  { label: 'Inativo',  icon: 'fa-circle-xmark' },
        afastado: { label: 'Afastado', icon: 'fa-user-clock' },
        ferias:   { label: 'Férias',   icon: 'fa-umbrella-beach' }
    };

    const kpiTotal = document.getElementById('kpiTotal');
    const kpiCritico = document.getElementById('kpiCritico');
    const kpiAtencao = document.getElementById('kpiAtencao');
    const kpiRecente = document.getElementById('kpiRecente');

    const footerTotal = document.getElementById('footerTotal');
    const footerCritico = document.getElementById('footerCritico');
    const footerAtencao = document.getElementById('footerAtencao');
    const footerRecente = document.getElementById('footerRecente');

    const detalhesModal = document.getElementById('detalhesModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    let currentData = null;
    let searchDebounce = null;
    /** Ordenação da tabela de contratos por nome do operador: { key, dir } */
    const opTableSort = {};

    const colors = ['purple', 'teal', 'rose', 'amber', 'blue'];

    function sitRank(s) {
        const x = (s == null ? '' : String(s)).toLowerCase().trim();
        if (x === 'crítico' || x === 'critico') return 2;
        if (x === 'atenção' || x === 'atencao') return 1;
        if (x === 'recente') return 0;
        return 3;
    }

    function sortCompare(a, b, key, dir) {
        const m = dir === 'desc' ? -1 : 1;
        if (key === 'grupo') {
            const sa = `${a.grupo || ''}/${a.cota || ''}`;
            const sb = `${b.grupo || ''}/${b.cota || ''}`;
            return m * sa.localeCompare(sb, 'pt-BR', { numeric: true, sensitivity: 'base' });
        }
        if (key === 'devedor') {
            return m * (a.nome_devedor || '').toString().localeCompare((b.nome_devedor || '').toString(), 'pt-BR', { sensitivity: 'base' });
        }
        if (key === 'situacao') {
            return m * (sitRank(a.situacao) - sitRank(b.situacao));
        }
        if (key === 'atraso') {
            return m * ((Number(a.dias_atraso) || 0) - (Number(b.dias_atraso) || 0));
        }
        if (key === 'valor') {
            return m * ((parseFloat(a.valor_credito) || 0) - (parseFloat(b.valor_credito) || 0));
        }
        return 0;
    }

    function updateTableSortHeaders(block, st) {
        if (!block || !st) return;
        block.querySelectorAll('thead th.th-sortable').forEach((th) => {
            const field = th.getAttribute('data-field');
            th.classList.remove('sorted-asc', 'sorted-desc');
            const icon = th.querySelector('.sort-icon i');
            if (!icon) return;
            if (st.key === field) {
                th.classList.add(st.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
                icon.className = 'fa-solid ' + (st.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            } else {
                icon.className = 'fa-solid fa-sort';
            }
        });
    }

    // ---- Carregamento Inicial ----
    loadDashboard();

    filterOperador.addEventListener('change', applyFilters);
    filterSituacao.addEventListener('change', applyFilters);
    filterStatusOperador.addEventListener('change', applyFilters);
    
    filterSearch.addEventListener('input', function() {
        btnSearchClear.classList.toggle('visible', this.value.length > 0);
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(applyFilters, 300);
    });

    btnSearchClear.addEventListener('click', function() {
        filterSearch.value = '';
        this.classList.remove('visible');
        applyFilters();
        filterSearch.focus();
    });

    operadorBlocksContainer.addEventListener('click', (e) => {
        const th = e.target.closest('th.th-sortable');
        if (!th) return;
        e.stopPropagation();
        const field = th.getAttribute('data-field');
        if (!field) return;
        const block = th.closest('.operador-block');
        if (!block) return;
        applyOperadorTableSort(block, field);
    });

    operadorBlocksContainer.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const th = e.target.closest('th.th-sortable');
        if (!th) return;
        e.preventDefault();
        const field = th.getAttribute('data-field');
        if (!field) return;
        const block = th.closest('.operador-block');
        if (!block) return;
        applyOperadorTableSort(block, field);
    });

    // ---- Lógica de API ----
    async function loadDashboard() {
        showLoading(true);
        try {
            const resp = await fetch('/api/operadores/dashboard');
            const data = await resp.json();
            currentData = data;

            // Preencher Select de Operadores
            if (filterOperador.options.length <= 1) {
                data.operadores.forEach(op => {
                    const option = document.createElement('option');
                    option.value = op.nome;
                    option.textContent = op.nome;
                    filterOperador.appendChild(option);
                });
            }

            updateKPIs(data.kpis);
            renderOperators(data.operadores);
        } catch (err) {
            console.error('Erro ao carregar dashboard de operadores:', err);
            operadorBlocksContainer.innerHTML = `<div class="empty-block"><i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar dados: ${err.message}</div>`;
        }
        showLoading(false);
    }

    function showLoading(show) {
        loadingState.style.display = show ? 'flex' : 'none';
        if (show) operadorBlocksContainer.innerHTML = '';
    }

    function updateKPIs(kpis) {
        if (!kpis) return;
        kpiTotal.textContent = kpis.total.toLocaleString('pt-BR');
        kpiCritico.textContent = kpis.critico.toLocaleString('pt-BR');
        kpiAtencao.textContent = kpis.atencao.toLocaleString('pt-BR');
        kpiRecente.textContent = kpis.recente.toLocaleString('pt-BR');
    }

    function applyFilters() {
        if (!currentData) return;

        const selOp = filterOperador.value;
        const selSit = filterSituacao.value;
        const selStatusOp = filterStatusOperador.value;
        const search = filterSearch.value.trim().toLowerCase();

        let filteredOperators = currentData.operadores.map(op => {
            // Se filtramos por um operador específico
            if (selOp && op.nome !== selOp) return null;

            // Filtro de status do operador (ativo / inativo / afastado / ferias)
            const opStatus = (op.status_operador || 'ativo').toLowerCase();
            if (selStatusOp && opStatus !== selStatusOp) return null;

            // Filtrar os contratos deste operador
            const filteredContracts = op.contratos.filter(c => {
                const matchSit = !selSit || c.situacao === selSit;
                let matchSearch = true;
                if (search) {
                    const gc = `${c.grupo}/${c.cota}`.toLowerCase();
                    matchSearch = (c.nome_devedor || '').toLowerCase().includes(search) ||
                                  (c.cpf_cnpj || '').toLowerCase().includes(search) ||
                                  (c.numero_contrato || '').toLowerCase().includes(search) ||
                                  gc.includes(search);
                }
                return matchSit && matchSearch;
            });

            if (filteredContracts.length === 0 && (selOp || selSit || search)) return null;

            // Recalcular stats para o visual filtrado
            const stats = {
                total: filteredContracts.length,
                critico: filteredContracts.filter(c => c.situacao === 'critico').length,
                atencao: filteredContracts.filter(c => c.situacao === 'atenção').length,
                recente: filteredContracts.filter(c => c.situacao === 'recente').length
            };

            return { ...op, contratos: filteredContracts, stats };
        }).filter(op => op !== null);

        renderOperators(filteredOperators); // renderOperators ja chama updateFooterFromVisible()
    }

    // Guarda a lista atualmente renderizada para que o footer possa somar
    // apenas os cards expandidos (visiveis).
    let renderedOperators = [];

    function renderOperators(operators) {
        renderedOperators = operators || [];
        operadorBlocksContainer.innerHTML = '';
        if (operators.length === 0) {
            operadorBlocksContainer.innerHTML = '<div class="empty-block"><i class="fa-solid fa-user-slash"></i> Nenhum operador ou contrato encontrado com os filtros aplicados.</div>';
            return;
        }

        operators.forEach((op, index) => {
            const color = colors[index % colors.length];
            const block = createOperatorBlock(op, color);
            operadorBlocksContainer.appendChild(block);
        });

        // Apos renderizar, sincroniza o footer com o estado visivel atual
        // (todos os cards iniciam colapsados => totais = 0).
        updateFooterFromVisible();
    }

    function fillContractTbody(tbody, op) {
        tbody.innerHTML = '';
        op.contratos.forEach((c) => {
            const tr = document.createElement('tr');
            tr.className = 'contract-row';
            const sitLabel = c.situacao
                ? c.situacao.charAt(0).toUpperCase() + c.situacao.slice(1)
                : '-';
            tr.innerHTML = `
                <td class="fw-bold">${esc(c.grupo)}/${esc(c.cota)}</td>
                <td>
                    <div style="font-weight: 500">${esc(c.nome_devedor || '-')}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted)">${esc(c.cpf_cnpj || '-')}</div>
                </td>
                <td><span class="situacao-badge situacao-${c.situacao}">${sitLabel}</span></td>
                <td><span class="dias-badge dias-${c.situacao}">${c.dias_atraso}d</span></td>
                <td>${formatCurrency(c.valor_credito)}</td>
                <td class="text-right"><button class="action-btn" type="button" tabindex="-1">Ver</button></td>
            `;
            tr.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleExpandRow(tr, c, tbody);
            });
            tbody.appendChild(tr);
        });
    }

    function applyOperadorTableSort(block, field) {
        const nome = block.dataset.operadorNome;
        if (!field || !nome) return;
        const op = renderedOperators.find((o) => o.nome === nome);
        if (!op) return;
        if (opTableSort[op.nome] === undefined) {
            opTableSort[op.nome] = { key: 'grupo', dir: 'asc' };
        }
        const st = opTableSort[op.nome];
        if (st.key === field) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
        else {
            st.key = field;
            st.dir = 'asc';
        }
        op.contratos.sort((a, b) => sortCompare(a, b, st.key, st.dir));
        const tbody = block.querySelector('.op-tbody');
        if (tbody) {
            fillContractTbody(tbody, op);
            updateTableSortHeaders(block, st);
        }
    }

    function createOperatorBlock(op, color) {
        if (opTableSort[op.nome] === undefined) {
            opTableSort[op.nome] = { key: 'grupo', dir: 'asc' };
        }
        const st = opTableSort[op.nome];
        op.contratos.sort((a, b) => sortCompare(a, b, st.key, st.dir));

        const div = document.createElement('div');
        div.className = 'operador-block collapsed';
        div.setAttribute('data-color', color);
        div.dataset.operadorNome = op.nome;

        const initials = op.nome.split(' ').map(n => n[0]).join('').substring(0, 2);

        const statusKey = (op.status_operador || 'ativo').toLowerCase();
        const statusInfo = STATUS_OPERADOR_LABELS[statusKey] || STATUS_OPERADOR_LABELS.ativo;

        div.innerHTML = `
            <div class="operador-header">
                <div class="operador-header-left">
                    <div class="operador-avatar">${initials}</div>
                    <div class="operador-name-area">
                        <h4>
                            ${esc(op.nome)}
                            <span class="status-operador-pill status-${esc(statusKey)}" title="Status do operador">
                                <i class="fa-solid ${statusInfo.icon}"></i> ${statusInfo.label}
                            </span>
                        </h4>
                        <span class="operador-subtitle">Operador de Cobrança</span>
                    </div>
                </div>
                <div class="operador-header-right">
                    <div class="op-mini-badges">
                        <div class="op-mini-badge critico"><i class="fa-solid fa-fire"></i> ${op.stats.critico}</div>
                        <div class="op-mini-badge atencao"><i class="fa-solid fa-exclamation-triangle"></i> ${op.stats.atencao}</div>
                        <div class="op-mini-badge recente"><i class="fa-solid fa-clock"></i> ${op.stats.recente}</div>
                    </div>
                    <div class="op-total-badge">${op.stats.total} contratos</div>
                    <i class="fa-solid fa-chevron-down operador-chevron"></i>
                </div>
            </div>
            <div class="operador-body">
                <div class="operador-metrics">
                    <div class="metric-item">
                        <span class="metric-label"><i class="fa-solid fa-chart-simple"></i> Eficiência</span>
                        <span class="metric-value accent-green">94%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label"><i class="fa-solid fa-fire"></i> Peso Crítico</span>
                        <span class="metric-value accent-red">${((op.stats.critico / (op.stats.total || 1)) * 100).toFixed(0)}%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label"><i class="fa-solid fa-hand-holding-dollar"></i> Valor em Carteira</span>
                        <span class="metric-value accent-blue">${formatCurrency(op.contratos.reduce((acc, c) => acc + (parseFloat(c.valor_credito) || 0), 0))}</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label"><i class="fa-solid fa-calendar-check"></i> Meta Mensal</span>
                        <span class="metric-value accent-amber">82%</span>
                    </div>
                </div>
                <div class="operador-contracts-table">
                    <div class="table-responsive">
                        <table class="styled-table">
                            <thead>
                                <tr>
                                    <th class="th-sortable" data-field="grupo" title="Ordenar por Grupo / Cota" role="button" tabindex="0">
                                        <span class="th-sort-label">Grupo / Cota</span> <span class="sort-icon" aria-hidden="true"><i class="fa-solid fa-sort"></i></span>
                                    </th>
                                    <th class="th-sortable" data-field="devedor" title="Ordenar por devedor" role="button" tabindex="0">
                                        <span class="th-sort-label">Devedor</span> <span class="sort-icon" aria-hidden="true"><i class="fa-solid fa-sort"></i></span>
                                    </th>
                                    <th class="th-sortable" data-field="situacao" title="Ordenar por situação" role="button" tabindex="0">
                                        <span class="th-sort-label">Situação</span> <span class="sort-icon" aria-hidden="true"><i class="fa-solid fa-sort"></i></span>
                                    </th>
                                    <th class="th-sortable" data-field="atraso" title="Ordenar por atraso (dias)" role="button" tabindex="0">
                                        <span class="th-sort-label">Atraso</span> <span class="sort-icon" aria-hidden="true"><i class="fa-solid fa-sort"></i></span>
                                    </th>
                                    <th class="th-sortable" data-field="valor" title="Ordenar por valor" role="button" tabindex="0">
                                        <span class="th-sort-label">Valor</span> <span class="sort-icon" aria-hidden="true"><i class="fa-solid fa-sort"></i></span>
                                    </th>
                                    <th class="text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody class="op-tbody">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        const header = div.querySelector('.operador-header');
        header.addEventListener('click', () => {
            div.classList.toggle('collapsed');
            updateFooterFromVisible();
        });

        const tbody = div.querySelector('.op-tbody');
        fillContractTbody(tbody, op);
        updateTableSortHeaders(div, st);

        return div;
    }

    function toggleExpandRow(tr, contract, tbody) {
        const existing = tr.nextElementSibling;
        if (existing && existing.classList.contains('contract-expand-row')) {
            existing.remove();
            tr.classList.remove('selected');
            return;
        }

        tbody.querySelectorAll('.contract-expand-row').forEach(el => el.remove());
        tbody.querySelectorAll('.contract-row.selected').forEach(el => el.classList.remove('selected'));

        tr.classList.add('selected');

        const expandTr = document.createElement('tr');
        expandTr.className = 'contract-expand-row';
        expandTr.innerHTML = `
            <td colspan="6">
                <div class="contract-expand-panel">
                    <div class="expand-grid">
                        <div class="expand-item"><span class="expand-label">Grupo / Cota</span><span class="expand-value">${esc(contract.grupo)}/${esc(contract.cota)}</span></div>
                        <div class="expand-item"><span class="expand-label">Nro Contrato</span><span class="expand-value">${esc(contract.numero_contrato || '-')}</span></div>
                        <div class="expand-item"><span class="expand-label">Valor Crédito</span><span class="expand-value">${formatCurrency(contract.valor_credito)}</span></div>
                        <div class="expand-item"><span class="expand-label">Parcelas Abertas</span><span class="expand-value">${contract.parcelas_abertas}</span></div>
                        <div class="expand-item"><span class="expand-label">Dias Atraso</span><span class="expand-value">${contract.dias_atraso} dias</span></div>
                        <div class="expand-item"><span class="expand-label">Vencimento Antigo</span><span class="expand-value">${formatDate(contract.vencimento_mais_antigo)}</span></div>
                    </div>
                    <div class="expand-actions">
                        <button class="btn-detalhes" data-id="${contract.id}"><i class="fa-solid fa-file-lines"></i> Detalhes Completos</button>
                    </div>
                </div>
            </td>
        `;

        tr.parentNode.insertBefore(expandTr, tr.nextSibling);

        expandTr.querySelector('.btn-detalhes').addEventListener('click', function() {
            openContractDetails(this.getAttribute('data-id'));
        });
    }

    // Soma somente o conteudo dos cards EXPANDIDOS (i.e. visiveis na tela).
    // Se o usuario nao expandiu nenhum operador, todos os contadores sao zero.
    function updateFooterFromVisible() {
        const blocks = operadorBlocksContainer.querySelectorAll('.operador-block');
        let total = 0, critico = 0, atencao = 0, recente = 0;
        blocks.forEach((block, idx) => {
            if (block.classList.contains('collapsed')) return;
            const op = renderedOperators[idx];
            if (!op || !op.stats) return;
            total   += op.stats.total   || 0;
            critico += op.stats.critico || 0;
            atencao += op.stats.atencao || 0;
            recente += op.stats.recente || 0;
        });
        footerTotal.textContent   = total.toLocaleString('pt-BR');
        footerCritico.textContent = critico.toLocaleString('pt-BR');
        footerAtencao.textContent = atencao.toLocaleString('pt-BR');
        footerRecente.textContent = recente.toLocaleString('pt-BR');
    }

    // Mantido por compatibilidade caso seja chamado de outro lugar; agora apenas
    // delega para a versao baseada no estado visivel.
    function updateFooter() { updateFooterFromVisible(); }

    // ---- Detalhes Modal (Reutilizando lógica global) ----
    async function openContractDetails(id) {
        modalContent.innerHTML = '<div style="text-align:center;padding:40px"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p>Carregando...</p></div>';
        detalhesModal.classList.add('active');
        
        try {
            const resp = await fetch('/api/contrato/' + id);
            const data = await resp.json();
            renderModalContent(data);
        } catch (err) {
            modalContent.innerHTML = `<p class="text-danger">Erro: ${err.message}</p>`;
        }
    }

    function renderModalContent(data) {
        const c = data.contrato;
        modalTitle.innerHTML = `Contrato: <span class="text-accent">${esc(c.grupo)}/${esc(c.cota)}</span>`;
        
        let html = `
            <div class="detail-section">
                <h3><i class="fa-solid fa-circle-info"></i> Resumo</h3>
                <div class="detail-grid">
                    <div class="data-item"><span class="data-label">Devedor</span><span class="data-value">${esc(data.devedor?.nome_completo || '-')}</span></div>
                    <div class="data-item"><span class="data-label">CPF/CNPJ</span><span class="data-value">${esc(data.devedor?.cpf_cnpj || '-')}</span></div>
                    <div class="data-item"><span class="data-label">Status Atual</span><span class="data-value"><span class="status-badge status-active">${esc(c.status)}</span></span></div>
                    <div class="data-item"><span class="data-label">Valor Crédito</span><span class="data-value">${formatCurrency(c.valor_credito)}</span></div>
                </div>
            </div>
            <div class="detail-section">
                <h3><i class="fa-solid fa-list-check"></i> Parcelas em Aberto (${data.parcelas.filter(p => p.status === 'aberto').length})</h3>
                <div class="table-responsive">
                    <table class="styled-table modal-table">
                        <thead><tr><th>Nro</th><th>Vencimento</th><th>Valor Total</th><th>Status</th></tr></thead>
                        <tbody>
                            ${data.parcelas.map(p => `
                                <tr>
                                    <td>${p.numero_parcela}</td>
                                    <td>${formatDate(p.vencimento)}</td>
                                    <td>${formatCurrency(p.valor_total)}</td>
                                    <td><span class="status-badge ${p.status === 'aberto' ? 'status-danger' : 'status-success'}">${p.status}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        html += (typeof TramitacoesDetalhe !== 'undefined')
            ? TramitacoesDetalhe.buildSection(data.tramitacoes || [], c.id, { esc: esc, formatDateTime: formatDateTime })
            : '';
        modalContent.innerHTML = html;
        if (typeof TramitacoesDetalhe !== 'undefined') {
            TramitacoesDetalhe.attachModal(modalContent, c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                onReload: function () { return openContractDetails(c.id); }
            });
        }
    }

    closeModalBtn.addEventListener('click', () => detalhesModal.classList.remove('active'));

    // ---- Helpers ----
    function esc(val) {
        if (!val) return '-';
        const d = document.createElement('div');
        d.textContent = val;
        return d.innerHTML;
    }

    function formatCurrency(val) {
        const n = parseFloat(val);
        if (isNaN(n)) return 'R$ 0,00';
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatDate(val) {
        if (!val) return '-';
        const d = new Date(val);
        if (isNaN(d.getTime())) return val;
        return d.toLocaleDateString('pt-BR');
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
});
