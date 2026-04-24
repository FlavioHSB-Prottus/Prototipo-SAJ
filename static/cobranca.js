document.addEventListener('DOMContentLoaded', function () {

    // ---- Referências DOM ----
    const blocksContainer = document.getElementById('blocksContainer');
    const kanbanContainer = document.getElementById('kanbanContainer');
    const operadorSelect = document.getElementById('operadorSelect');
    const totalDisplay = document.getElementById('totalDisplay');
    const footerCritico = document.getElementById('footerCritico');
    const footerAtencao = document.getElementById('footerAtencao');
    const footerRecente = document.getElementById('footerRecente');
    const toolbarTotal = document.getElementById('toolbarTotal');
    const loadingState = document.getElementById('loadingState');

    // Toggle de layout
    const viewToggleButtons = document.querySelectorAll('.view-toggle-btn');
    const VIEW_STORAGE_KEY = 'cobrancaViewMode';
    let currentView = localStorage.getItem(VIEW_STORAGE_KEY) || 'analitico'; // 'analitico' | 'kanban'

    // Pesquisa
    const searchInput = document.getElementById('searchInput');
    const searchType = document.getElementById('searchType');
    const btnSearchClear = document.getElementById('btnSearchClear');
    const negativacaoSelect = document.getElementById('negativacaoSelect');
    const btnParcelasDesordenadas = document.getElementById('btnParcelasDesordenadas');

    /** Filtro da API: somente contratos com parcela em aberto anterior a parcela paga. */
    let filtroParcelasDesordenadas = false;

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
    applyViewMode(currentView);
    loadCobranca();
    bindFooterBulkActions();

    // Expõe recarga para módulos auxiliares (ex.: cobranca_automacoes.js após
    // negativar, precisa recarregar para pintar contratos em cinza).
    window.CobrancaReload = function () { return loadCobranca(); };

    operadorSelect.addEventListener('change', function () {
        loadCobranca();
    });

    if (negativacaoSelect) {
        negativacaoSelect.addEventListener('change', function () {
            var wrapper = negativacaoSelect.closest('.negativacao-filter');
            if (wrapper) {
                wrapper.classList.toggle('filter-active', !!this.value);
                wrapper.classList.toggle('neg-filtro-ativo', this.value === 'ativo');
            }
            applyFilter();
        });
    }

    if (btnParcelasDesordenadas) {
        btnParcelasDesordenadas.addEventListener('click', function () {
            filtroParcelasDesordenadas = !filtroParcelasDesordenadas;
            btnParcelasDesordenadas.classList.toggle('is-active', filtroParcelasDesordenadas);
            if (btnParcelasDesordenadas.parentElement) {
                btnParcelasDesordenadas.parentElement.classList.toggle('filter-active', filtroParcelasDesordenadas);
            }
            loadCobranca();
        });
    }

    // ---- Toggle Analitico / Kanban ----
    viewToggleButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var v = this.getAttribute('data-view');
            if (v === currentView) return;
            currentView = v;
            localStorage.setItem(VIEW_STORAGE_KEY, v);
            applyViewMode(v);
            applyFilter(); // re-renderiza no layout correspondente
        });
    });

    function applyViewMode(mode) {
        viewToggleButtons.forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-view') === mode);
        });
        if (mode === 'kanban') {
            blocksContainer.style.display = 'none';
            kanbanContainer.style.display = 'flex';
        } else {
            blocksContainer.style.display = '';
            kanbanContainer.style.display = 'none';
        }
    }

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

    function syncNegativacaoFilterStyle() {
        if (!negativacaoSelect) return;
        const wrapper = negativacaoSelect.closest('.negativacao-filter');
        if (!wrapper) return;
        const v = negativacaoSelect.value;
        wrapper.classList.toggle('filter-active', !!v);
        wrapper.classList.toggle('neg-filtro-ativo', v === 'ativo');
    }

    function applyFilter() {
        if (!currentData) return;

        const termo = searchInput.value.trim().toLowerCase();
        const tipo = searchType.value;
        const negFilter = negativacaoSelect ? negativacaoSelect.value : '';

        if (!termo && !negFilter) {
            renderView(currentData);
            syncNegativacaoFilterStyle();
            return;
        }

        const filtered = {
            critico: filterContracts(currentData.critico, termo, tipo, negFilter),
            atencao: filterContracts(currentData.atencao, termo, tipo, negFilter),
            recente: filterContracts(currentData.recente, termo, tipo, negFilter),
            funcionarios: currentData.funcionarios,
        };

        renderView(filtered);
        syncNegativacaoFilterStyle();
    }

    // Aplica o filtro de negativação (pendente / negativado / ativo / todos).
    //
    // O backend entrega status_negativacao:
    //   'negativado'   -> parcela-alvo já na tabela negativacao
    //   'pendente'     -> 31–89 dias na parcela-alvo, ainda não negativada
    //   'nao_elegivel' -> fora da janela Serasa (<=30 ou >=90) ou regra ainda
    //                     fora do fluxo de envio.
    //
    //   'ativo' (só no filtro): cobrança "recente" = **uma** parcela aberta
    //   e atraso < 31 dias. Não inclui crítico/atenção com 1 parcela; esses
    //   vão a pendente (janela) ou nao_elegivel (ex.: 90+).
    function matchNegativacao(c, negFilter) {
        if (!negFilter) return true;
        var st = c.status_negativacao;
        if (!st) {
            if (c.negativado) st = 'negativado';
            else if (c.elegivel_negativacao) st = 'pendente';
            else st = 'nao_elegivel';
        }
        if (negFilter === 'negativado') return st === 'negativado';
        if (negFilter === 'pendente')   return st === 'pendente';
        if (negFilter === 'ativo') {
            var nparc = parseInt(c.parcelas_abertas, 10);
            if (!isFinite(nparc)) nparc = 0;
            var d = parseInt(c.dias_atraso, 10);
            if (!isFinite(d)) d = 0;
            return st === 'nao_elegivel' && nparc === 1 && d < 31;
        }
        return true;
    }

    function filterContracts(contracts, termo, tipo, negFilter) {
        if (!contracts) return [];
        return contracts.filter(function (c) {
            // Filtro de negativação sempre se aplica (quando definido).
            if (!matchNegativacao(c, negFilter)) return false;

            // Sem termo de pesquisa: só o filtro de negativação vale.
            if (!termo) return true;

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
                    // Vem populado pelo backend via JOIN na tabela bem/bens
                    // (ou string vazia se ainda nao houver bens cadastrados).
                    return matchField(c.bem_descricao, termo);
                default: // 'all'
                    return matchField(c.cpf_cnpj, termo) ||
                        matchField(c.nome_devedor, termo) ||
                        grupoCota.indexOf(termo) !== -1 ||
                        grupoCotaCompact.indexOf(termo) !== -1 ||
                        matchField(c.bem_descricao, termo) ||
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
            const q = new URLSearchParams();
            const funcId = operadorSelect.value;
            if (funcId) q.set('funcionario_id', funcId);
            if (filtroParcelasDesordenadas) q.set('parcelas_desordenadas', '1');
            const qs = q.toString();
            const url = '/api/cobranca' + (qs ? '?' + qs : '');

            const resp = await fetch(url);
            const data = await resp.json();
            currentData = data;

            // Resetar ordenação ao trocar de operador ou carregar novo
            sortConfigs = {
                critico: { column: null, order: 'asc' },
                atencao: { column: null, order: 'asc' },
                recente: { column: null, order: 'asc' }
            };

            // Preencher dropdown de funcionarios (apenas 1 vez ou se lista mudou)
            if (data.funcionarios && data.funcionarios.length > 0) {
                const currentVal = operadorSelect.value;
                const hasOptions = operadorSelect.options.length > 1;
                if (!hasOptions) {
                    data.funcionarios.forEach(function (f) {
                        const opt = document.createElement('option');
                        opt.value = String(f.id);
                        opt.textContent = f.nome;
                        operadorSelect.appendChild(opt);
                    });
                    if (currentVal) operadorSelect.value = currentVal;
                }
            }

            renderView(data);
        } catch (err) {
            blocksContainer.innerHTML =
                '<div class="empty-block"><i class="fa-solid fa-triangle-exclamation"></i>' +
                'Erro ao carregar contratos: ' + esc(err.message) + '</div>';
        }
    }

    // Roteador de renderizacao (respeita o layout selecionado).
    function renderView(data) {
        if (currentView === 'kanban') {
            renderKanban(data);
        } else {
            renderBlocks(data);
        }
        updateCounters(data);
    }

    function updateCounters(data) {
        var total = (data.critico ? data.critico.length : 0) +
            (data.atencao ? data.atencao.length : 0) +
            (data.recente ? data.recente.length : 0);
        if (totalDisplay) totalDisplay.textContent = total.toLocaleString('pt-BR');
        if (toolbarTotal) toolbarTotal.textContent = total.toLocaleString('pt-BR');
        if (footerCritico) footerCritico.textContent = (data.critico ? data.critico.length : 0).toLocaleString('pt-BR');
        if (footerAtencao) footerAtencao.textContent = (data.atencao ? data.atencao.length : 0).toLocaleString('pt-BR');
        if (footerRecente) footerRecente.textContent = (data.recente ? data.recente.length : 0).toLocaleString('pt-BR');
    }

    function showLoading() {
        if (loadingState) loadingState.style.display = 'flex';
        blocksContainer.innerHTML = '';
        if (kanbanContainer) kanbanContainer.innerHTML = '';
    }

    // ---- Renderização: visão Analítica ----
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
    }

    // ---- Renderização: visão Kanban (3 colunas verticais) ----
    function renderKanban(data) {
        if (loadingState) loadingState.style.display = 'none';
        kanbanContainer.innerHTML = '';

        kanbanContainer.appendChild(
            buildKanbanColumn('critico', 'Crítico', '60 – 90+ dias',
                'fa-solid fa-fire', sortLevelData(data.critico, 'critico'))
        );
        kanbanContainer.appendChild(
            buildKanbanColumn('atencao', 'Atenção', '30 – 60 dias',
                'fa-solid fa-exclamation-triangle', sortLevelData(data.atencao, 'atencao'))
        );
        kanbanContainer.appendChild(
            buildKanbanColumn('recente', 'Recente', '1 – 30 dias',
                'fa-solid fa-clock', sortLevelData(data.recente, 'recente'))
        );
    }

    function buildKanbanColumn(level, title, desc, iconClass, contracts) {
        var col = document.createElement('div');
        col.className = 'kanban-col kanban-' + level + ' collapsed';

        var count = contracts ? contracts.length : 0;

        // Header da coluna (estilo Tramitacao — titulo colorido + badge count)
        var header = document.createElement('div');
        header.className = 'kanban-col-header';
        header.innerHTML =
            '<div class="kanban-col-title">' +
            '  <h4>' + esc(title) + '</h4>' +
            '  <span class="kanban-col-desc">' + esc(desc) + '</span>' +
            '</div>' +
            '<div class="kanban-col-header-right">' +
                buildBulkActionsHTML(level, true) +
            '  <span class="kanban-col-count">' + count + '</span>' +
            '  <i class="fa-solid fa-chevron-down kanban-col-chevron"></i>' +
            '</div>';
        header.addEventListener('click', function () {
            col.classList.toggle('collapsed');
        });
        bindBulkActions(header, level);
        col.appendChild(header);

        // Corpo: cards rolaveis
        var body = document.createElement('div');
        body.className = 'kanban-col-body';

        if (!contracts || contracts.length === 0) {
            body.innerHTML =
                '<div class="kanban-empty">' +
                '<i class="fa-regular fa-circle-check"></i>' +
                '<span>Nenhum contrato nesta faixa.</span>' +
                '</div>';
        } else {
            contracts.forEach(function (c) {
                body.appendChild(buildKanbanCard(level, c));
            });
        }

        col.appendChild(body);
        return col;
    }

    function buildKanbanCard(level, c) {
        var card = document.createElement('div');
        card.className = 'kanban-card kanban-card-' + level +
            (c.negativado ? ' kanban-card-negativado' : '');
        card.setAttribute('data-id', c.id);
        if (c.negativado) {
            card.setAttribute('title', 'Contrato já negativado no Serasa');
        }

        var dias = c.dias_atraso || 0;
        if (typeof dias === 'string') dias = parseInt(dias) || 0;

        var funcHTML = '';
        if (c.nome_funcionario) {
            funcHTML =
                '<div class="kanban-card-func" title="Funcionário responsável">' +
                '  <i class="fa-solid fa-user-tie"></i> ' + esc(c.nome_funcionario) +
                '</div>';
        } else {
            funcHTML =
                '<div class="kanban-card-func func-unassigned" title="Sem funcionário atribuído">' +
                '  <i class="fa-solid fa-user-slash"></i> Não atribuído' +
                '</div>';
        }

        var bemLine = '';
        if (c.bem_descricao) {
            bemLine = '<div class="kanban-card-bem" title="' + esc(c.bem_descricao) + '">' +
                '  <i class="fa-solid fa-car-side"></i> ' + esc(c.bem_descricao) +
                '</div>';
        }

        // Pill ao lado do grupo/cota (estilo "Safra X" da Tramitacao).
        // Usa o numero_contrato quando disponivel; senao, quantidade de parcelas abertas.
        var pillHTML = '';
        if (c.numero_contrato) {
            pillHTML = '<span class="kanban-card-pill">Nº ' + esc(c.numero_contrato) + '</span>';
        } else if (c.parcelas_abertas) {
            pillHTML = '<span class="kanban-card-pill">' + c.parcelas_abertas + ' parc.</span>';
        }
        if (c.negativado) {
            pillHTML += '<span class="kanban-card-pill pill-negativado" title="Negativado no Serasa">' +
                '<i class="fa-solid fa-ban"></i> Negativado</span>';
        }

        card.innerHTML =
            '<div class="kanban-card-top">' +
            '  <span class="kanban-grupo">' + esc(c.grupo) + '/' + esc(c.cota) + '</span>' +
            pillHTML +
            '</div>' +
            '<p class="kanban-card-nome">' + esc(c.nome_devedor || '—') + '</p>' +
            '<div class="kanban-card-cpf">' + esc(c.cpf_cnpj || '—') + '</div>' +
            bemLine +
            funcHTML +
            '<div class="kanban-card-bottom">' +
            '  <span class="kanban-delay"><i class="fa-regular fa-clock"></i> ' + dias + ' dias de atraso</span>' +
            '  <span class="kanban-card-valor">' + formatCurrency(c.valor_credito) + '</span>' +
            '</div>' +
            '<div class="kanban-card-actions">' +
            '  <button class="btn-cobrar btn-kanban-cobrar" data-id="' + c.id + '"' +
            '    data-nome="' + esc(c.nome_devedor || '') + '"' +
            '    data-cpf="' + esc(c.cpf_cnpj || '') + '"' +
            '    data-grupo="' + esc(c.grupo || '') + '"' +
            '    data-cota="' + esc(c.cota || '') + '">' +
            '    <i class="fa-solid fa-phone"></i> Cobrar' +
            '  </button>' +
            '  <button class="btn-detalhes btn-kanban-detalhes" data-id="' + c.id + '">' +
            '    <i class="fa-solid fa-file-lines"></i> Detalhes' +
            '  </button>' +
            '</div>';

        // Handlers
        card.querySelector('.btn-kanban-detalhes').addEventListener('click', function (e) {
            e.stopPropagation();
            openContractDetails(this.getAttribute('data-id'));
        });
        card.querySelector('.btn-kanban-cobrar').addEventListener('click', function (e) {
            e.stopPropagation();
            iniciarCobranca(this);
        });
        // Clicar no card tambem abre detalhes (igual tabela do analitico).
        card.addEventListener('click', function () {
            openContractDetails(c.id);
        });

        return card;
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
                buildBulkActionsHTML(level, false) +
            '  <span class="priority-count">' + count + ' contrato' + (count !== 1 ? 's' : '') + '</span>' +
            '  <i class="fa-solid fa-chevron-down priority-chevron"></i>' +
            '</div>';

        header.addEventListener('click', function () {
            block.classList.toggle('collapsed');
        });

        bindBulkActions(header, level);
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
                tr.className = 'contract-row' + (c.negativado ? ' contract-negativado' : '');
                tr.setAttribute('data-id', c.id);
                if (c.negativado) {
                    tr.setAttribute('title', 'Contrato já negativado no Serasa');
                }

                var dias = c.dias_atraso || 0;
                if (typeof dias === 'string') dias = parseInt(dias);

                var negBadge = c.negativado
                    ? ' <span class="neg-badge" title="Negativado no Serasa"><i class="fa-solid fa-ban"></i></span>'
                    : '';

                tr.innerHTML =
                    '<td class="fw-bold">' + esc(c.grupo) + '/' + esc(c.cota) + negBadge + '</td>' +
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
            '      <span class="expand-value">' + esc(contract.grupo) + '/' + esc(contract.cota) + '</span>' +
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
            '      <span class="expand-value">' + esc(contract.bem_descricao || '—') + '</span>' +
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
            const raw = await resp.text();
            let data = null;
            try { data = JSON.parse(raw); } catch (_) { data = null; }
            if (!data) {
                modalContent.innerHTML =
                    '<p style="padding:24px;color:#ef4444">' +
                    'Erro HTTP ' + resp.status + ' ao carregar o contrato.<br>' +
                    '<small style="color:var(--text-muted)">Resposta nao era JSON valido.</small>' +
                    '</p>';
                console.error('[cobranca] /api/contrato resposta invalida:', raw);
                return;
            }
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

        if (typeof TramitacoesDetalhe !== 'undefined') {
            TramitacoesDetalhe.attachModal(modalContent, c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                onReload: function () { return openContractDetails(c.id); }
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

    // ---- Botões de automação em lote (Ligar / SMS / E-mail) ----
    // Inseridos no header de cada bloco Crítico/Atenção/Recente, tanto na visão
    // analítica quanto no Kanban. Disparam fluxos definidos em
    // static/cobranca_automacoes.js (window.CobrancaAutomacoes).
    function buildBulkActionsHTML(level, kanban) {
        var cls = 'bulk-actions' + (kanban ? ' bulk-actions-kanban' : '');
        return '<div class="' + cls + '" data-level="' + esc(level) + '" title="Ações para todos os contratos deste bloco">' +
            '  <button type="button" class="bulk-btn bulk-btn-call" data-action="ligacao" title="Ligar para todos (sequencial)">' +
            '    <i class="fa-solid fa-phone"></i><span>Ligar</span>' +
            '  </button>' +
            '  <button type="button" class="bulk-btn bulk-btn-sms" data-action="sms" title="Enviar SMS para todos">' +
            '    <i class="fa-solid fa-comment-sms"></i><span>SMS</span>' +
            '  </button>' +
            '  <button type="button" class="bulk-btn bulk-btn-mail" data-action="email" title="Enviar e-mail para todos">' +
            '    <i class="fa-solid fa-envelope"></i><span>E-mail</span>' +
            '  </button>' +
            '</div>';
    }

    function bindBulkActions(headerEl, level) {
        var wrap = headerEl.querySelector('.bulk-actions');
        if (!wrap) return;
        // o wrapper inteiro nao deve disparar o toggle do bloco
        wrap.addEventListener('click', function (e) { e.stopPropagation(); });
        wrap.querySelectorAll('.bulk-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var action = this.getAttribute('data-action');
                var contratos = getContratosNivelAtual(level);
                if (!window.CobrancaAutomacoes) {
                    alert('Módulo de automações não carregado.');
                    return;
                }
                window.CobrancaAutomacoes.iniciar(action, level, contratos);
            });
        });
    }

    // Devolve os contratos visíveis no bloco selecionado, respeitando filtro de
    // pesquisa atual, filtro de negativação e ordenação aplicada na coluna.
    function getContratosNivelAtual(level) {
        if (!currentData) return [];
        var termo = (searchInput.value || '').trim().toLowerCase();
        var tipo = searchType.value;
        var negFilter = negativacaoSelect ? negativacaoSelect.value : '';
        var lista = currentData[level] || [];
        if (termo || negFilter) lista = filterContracts(lista, termo, tipo, negFilter);
        return sortLevelData(lista, level);
    }

    // Devolve TODOS os contratos visíveis (Crítico + Atenção + Recente),
    // respeitando filtro de operador (já aplicado no backend), pesquisa e
    // ordenação. Usado pelos botões de automação geral do rodapé.
    function getContratosTodos() {
        return []
            .concat(getContratosNivelAtual('critico'))
            .concat(getContratosNivelAtual('atencao'))
            .concat(getContratosNivelAtual('recente'));
    }

    // ---- Ações de automação geral no rodapé (SMS / E-mail) ----
    function bindFooterBulkActions() {
        var btnSms = document.getElementById('footerBulkSms');
        var btnMail = document.getElementById('footerBulkEmail');
        var btnNeg = document.getElementById('footerBulkNegativacao');
        if (btnSms) btnSms.addEventListener('click', function () { dispararFooterLote('sms'); });
        if (btnMail) btnMail.addEventListener('click', function () { dispararFooterLote('email'); });
        // "Negativação" - envia ao Serasa (via API futura do Flávio). O módulo
        // CobrancaAutomacoes trata confirmação + loading; o backend filtra os
        // elegíveis (31-89 dias) e ignora contratos já negativados.
        if (btnNeg) btnNeg.addEventListener('click', function () { dispararFooterLote('negativacao'); });
    }

    function dispararFooterLote(tipo) {
        if (!window.CobrancaAutomacoes) {
            alert('Módulo de automações não carregado.');
            return;
        }
        var contratos = getContratosTodos();
        if (!contratos.length) {
            alert('Nenhum contrato disponível na lista atual.');
            return;
        }
        window.CobrancaAutomacoes.iniciar(tipo, 'todos', contratos);
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
