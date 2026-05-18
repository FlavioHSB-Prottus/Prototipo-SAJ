document.addEventListener('DOMContentLoaded', function () {

    var tipoSelect = document.getElementById('tipo_relatorio');
    var prioridadeSelect = document.getElementById('prioridade_filtro');
    var dataInicial = document.getElementById('data_inicial');
    var dataFinal = document.getElementById('data_final');
    var dataInicialGroup = document.getElementById('dataInicialGroup');
    var dataFinalGroup = document.getElementById('dataFinalGroup');
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

    var podeEmailMassa = !!window.RELATORIOS_EMAIL_MASSA;
    var tableColspan = podeEmailMassa ? 8 : 7;
    /** @type {Set<number>} */
    var selectedContratoIds = new Set();

    var btnRelEmailSelecionarTodos = document.getElementById('btnRelEmailSelecionarTodos');
    var btnRelEmailLimparSel = document.getElementById('btnRelEmailLimparSel');
    var btnRelEmailAbrirEnvio = document.getElementById('btnRelEmailAbrirEnvio');
    var relEmailSelSummary = document.getElementById('relEmailSelSummary');
    var relEmailSelectAll = document.getElementById('relEmailSelectAll');
    var relEmailLoteModal = document.getElementById('relEmailLoteModal');
    var relEmailLoteFechar = document.getElementById('relEmailLoteFechar');
    var relEmailLoteCancelar = document.getElementById('relEmailLoteCancelar');
    var relEmailLoteConfirmar = document.getElementById('relEmailLoteConfirmar');
    var relEmailLoteMensagem = document.getElementById('relEmailLoteMensagem');
    var relEmailLoteCountContratos = document.getElementById('relEmailLoteCountContratos');
    var relEmailLoteCharCount = document.getElementById('relEmailLoteCharCount');

    var currentResults = [];
    var sortConfig = { column: null, order: 'asc' };

    // --- Data padrão: hoje ---
    var hoje = new Date().toISOString().split('T')[0];
    dataFinal.value = hoje;

    // --- Toggle Datas: "Contratos Abertos" usa snapshot `cobranca` — so Data Final (GM) ---
    function toggleDatasPorTipo() {
        var isAbertos = tipoSelect.value === 'abertos';

        if (isAbertos) {
            dataInicial.disabled = true;
            dataInicial.value = '';
            dataInicialGroup.classList.add('field-disabled');
            dataFinal.disabled = false;
            dataFinalGroup.classList.remove('field-disabled');
            if (!dataFinal.value) {
                dataFinal.value = hoje;
            }
        } else {
            dataInicial.disabled = false;
            dataInicialGroup.classList.remove('field-disabled');
            dataFinalGroup.classList.remove('field-disabled');
            if (!dataFinal.value) {
                dataFinal.value = hoje;
            }
        }
    }

    tipoSelect.addEventListener('change', toggleDatasPorTipo);
    toggleDatasPorTipo(); // executar na carga

    function getParams() {
        var params = {
            tipo: tipoSelect.value
        };
        if (!dataFinal.disabled && dataFinal.value) {
            params.data_final = dataFinal.value;
        }
        if (!dataInicial.disabled && dataInicial.value) {
            params.data_inicial = dataInicial.value;
        }
        if (prioridadeSelect.value) {
            params.prioridade = prioridadeSelect.value;
        }
        return params;
    }

    function validar() {
        var isAbertos = tipoSelect.value === 'abertos';

        if (isAbertos && !dataFinal.value) {
            alert('Informe a Data Final. Ela corresponde a data_arquivo na tabela cobranca (snapshot do dia).');
            return false;
        }
        if (!isAbertos && !dataInicial.value) {
            alert('Informe a Data Inicial.');
            return false;
        }
        if (!isAbertos && !dataFinal.value) {
            alert('Informe a Data Final.');
            return false;
        }
        if (!isAbertos && dataInicial.value > dataFinal.value) {
            alert('A Data Inicial deve ser anterior ou igual à Data Final.');
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

        resultsBody.innerHTML =
            '<tr><td colspan="' +
            tableColspan +
            '" style="text-align:center;padding:24px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Buscando...</td></tr>';
        noResults.classList.add('d-none');
        resultsSection.classList.remove('d-none');

        try {
            var resp = await fetch(buildUrl('/api/relatorios', params));
            var data = await resp.json();
            if (data.error) {
                resultsBody.innerHTML =
                    '<tr><td colspan="' +
                    tableColspan +
                    '" style="text-align:center;padding:24px;color:#ef4444">' +
                    esc(data.error) +
                    '</td></tr>';
                return;
            }
            currentResults = data.results || [];
            if (podeEmailMassa) {
                selectedContratoIds.clear();
            }
            // Reset order on new search
            sortConfig = { column: null, order: 'asc' };
            resetSortHeaders();
            renderResults(currentResults);
        } catch (err) {
            resultsBody.innerHTML =
                '<tr><td colspan="' +
                tableColspan +
                '" style="text-align:center;padding:24px;color:#ef4444">Erro: ' +
                esc(err.message) +
                '</td></tr>';
        }
    });

    // --- Exportar Excel ---
    btnExcel.addEventListener('click', function () {
        if (!validar()) return;
        if (window.__sajMarkInternalNavigationForImport) {
            window.__sajMarkInternalNavigationForImport();
        }
        window.location.href = buildUrl('/api/relatorios/excel', getParams());
    });

    // --- Exportar PDF ---
    btnPdf.addEventListener('click', function () {
        if (!validar()) return;
        if (window.__sajMarkInternalNavigationForImport) {
            window.__sajMarkInternalNavigationForImport();
        }
        window.location.href = buildUrl('/api/relatorios/pdf', getParams());
    });

    if (podeEmailMassa) {
        resultsBody.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || !t.classList || !t.classList.contains('rel-email-row-cb')) return;
            var id = parseContratoId(t.getAttribute('data-id'));
            if (id == null) return;
            if (t.checked) selectedContratoIds.add(id);
            else selectedContratoIds.delete(id);
            updateRelEmailToolbarSummary();
            syncRelEmailSelectAllCheckbox();
        });

        if (relEmailSelectAll) {
            relEmailSelectAll.addEventListener('change', function () {
                var checked = relEmailSelectAll.checked;
                currentResults.forEach(function (c) {
                    var id = parseContratoId(c.id);
                    if (id == null) return;
                    if (checked) selectedContratoIds.add(id);
                    else selectedContratoIds.delete(id);
                });
                renderResults(currentResults);
            });
        }

        if (btnRelEmailSelecionarTodos) {
            btnRelEmailSelecionarTodos.addEventListener('click', function () {
                currentResults.forEach(function (c) {
                    var id = parseContratoId(c.id);
                    if (id != null) selectedContratoIds.add(id);
                });
                renderResults(currentResults);
            });
        }

        if (btnRelEmailLimparSel) {
            btnRelEmailLimparSel.addEventListener('click', function () {
                selectedContratoIds.clear();
                renderResults(currentResults);
            });
        }

        if (btnRelEmailAbrirEnvio) {
            btnRelEmailAbrirEnvio.addEventListener('click', function () {
                abrirRelEmailLoteModal();
            });
        }

        if (relEmailLoteFechar) relEmailLoteFechar.addEventListener('click', fecharRelEmailLoteModal);
        if (relEmailLoteCancelar) relEmailLoteCancelar.addEventListener('click', fecharRelEmailLoteModal);

        if (relEmailLoteModal) {
            relEmailLoteModal.addEventListener('click', function (e) {
                if (e.target === relEmailLoteModal) fecharRelEmailLoteModal();
            });
        }

        if (relEmailLoteMensagem && relEmailLoteCharCount) {
            relEmailLoteMensagem.addEventListener('input', function () {
                relEmailLoteCharCount.textContent = String(relEmailLoteMensagem.value.length);
            });
        }

        if (relEmailLoteConfirmar) {
            relEmailLoteConfirmar.addEventListener('click', async function () {
                var msg = relEmailLoteMensagem ? relEmailLoteMensagem.value.trim() : '';
                if (!msg) {
                    alert('Digite a mensagem do e-mail.');
                    return;
                }
                var ids = Array.from(selectedContratoIds);
                relEmailLoteConfirmar.disabled = true;
                try {
                    var resp = await fetch('/api/relatorios/email-lote', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contrato_ids: ids, mensagem: msg }),
                    });
                    var data = await resp.json().catch(function () {
                        return {};
                    });
                    if (!resp.ok || data.error) {
                        throw new Error(data.error || 'HTTP ' + resp.status);
                    }
                    var lines = [
                        'Envio concluído.',
                        'E-mails disparados (API): ' + (data.envios_email != null ? data.envios_email : 0),
                        'Contratos com ao menos um e-mail enviado: ' +
                            (data.contratos_com_envio != null ? data.contratos_com_envio : 0),
                        'Falhas: ' + (data.falhas != null ? data.falhas : 0),
                        'Ignorados — sem contrato: ' +
                            (data.ignorados_sem_contrato != null ? data.ignorados_sem_contrato : 0),
                        'Ignorados — sem pessoa: ' +
                            (data.ignorados_sem_pessoa != null ? data.ignorados_sem_pessoa : 0),
                        'Ignorados — sem e-mail: ' +
                            (data.ignorados_sem_email != null ? data.ignorados_sem_email : 0),
                        'E-mails inválidos no cadastro: ' +
                            (data.ignorados_email_invalido != null ? data.ignorados_email_invalido : 0),
                    ];
                    if (data.erros_amostra && data.erros_amostra.length) {
                        lines.push('', 'Amostra de erros:');
                        data.erros_amostra.slice(0, 15).forEach(function (row) {
                            lines.push(
                                '- contrato ' +
                                    (row.id_contrato != null ? row.id_contrato : '?') +
                                    ': ' +
                                    (row.erro || '')
                            );
                        });
                    }
                    alert(lines.join('\n'));
                    fecharRelEmailLoteModal();
                } catch (errLote) {
                    alert('Falha no envio: ' + (errLote.message || String(errLote)));
                } finally {
                    relEmailLoteConfirmar.disabled = false;
                }
            });
        }
    }

    function parseContratoId(val) {
        var n = parseInt(val, 10);
        return !isNaN(n) && n > 0 ? n : null;
    }

    function updateRelEmailToolbarSummary() {
        if (!podeEmailMassa || !relEmailSelSummary || !btnRelEmailAbrirEnvio) return;
        var n = selectedContratoIds.size;
        if (n === 0) {
            relEmailSelSummary.textContent = 'Nenhum contrato selecionado';
            btnRelEmailAbrirEnvio.disabled = true;
        } else {
            relEmailSelSummary.textContent =
                n === 1 ? '1 contrato selecionado' : n.toLocaleString('pt-BR') + ' contratos selecionados';
            btnRelEmailAbrirEnvio.disabled = false;
        }
    }

    function syncRelEmailSelectAllCheckbox() {
        if (!podeEmailMassa || !relEmailSelectAll || !currentResults.length) {
            if (relEmailSelectAll) {
                relEmailSelectAll.checked = false;
                relEmailSelectAll.indeterminate = false;
            }
            return;
        }
        var total = currentResults.length;
        var marcados = 0;
        currentResults.forEach(function (c) {
            var id = parseContratoId(c.id);
            if (id != null && selectedContratoIds.has(id)) marcados += 1;
        });
        relEmailSelectAll.checked = marcados === total && total > 0;
        relEmailSelectAll.indeterminate = marcados > 0 && marcados < total;
    }

    function fecharRelEmailLoteModal() {
        if (!relEmailLoteModal) return;
        relEmailLoteModal.classList.remove('active');
        relEmailLoteModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function abrirRelEmailLoteModal() {
        if (!relEmailLoteModal || !relEmailLoteCountContratos) return;
        var n = selectedContratoIds.size;
        if (n < 1) {
            alert('Selecione ao menos um contrato na tabela (caixas à esquerda).');
            return;
        }
        relEmailLoteCountContratos.textContent = String(n);
        if (relEmailLoteMensagem) {
            relEmailLoteMensagem.value = '';
            if (relEmailLoteCharCount) relEmailLoteCharCount.textContent = '0';
        }
        relEmailLoteModal.classList.add('active');
        relEmailLoteModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        if (relEmailLoteMensagem) relEmailLoteMensagem.focus();
    }

    // --- Renderizar tabela ---
    function renderResults(results) {
        resultsBody.innerHTML = '';

        if (!results || results.length === 0) {
            resultsTitle.textContent = 'Contratos do Relatório (0 encontrados)';
            noResults.classList.remove('d-none');
            if (podeEmailMassa) {
                updateRelEmailToolbarSummary();
                syncRelEmailSelectAllCheckbox();
            }
            return;
        }

        noResults.classList.add('d-none');
        resultsTitle.textContent = 'Contratos do Relatório (' + results.length + ' encontrado' + (results.length > 1 ? 's' : '') + ')';

        results.forEach(function (c) {
            var tr = document.createElement('tr');
            var cid = parseContratoId(c.id);
            var chk = '';
            if (podeEmailMassa && cid != null) {
                chk =
                    '<td class="rel-check-cell"><input type="checkbox" class="rel-email-row-cb" data-id="' +
                    esc(String(cid)) +
                    '"' +
                    (selectedContratoIds.has(cid) ? ' checked' : '') +
                    '></td>';
            } else if (podeEmailMassa) {
                chk = '<td class="rel-check-cell"></td>';
            }
            tr.innerHTML =
                chk +
                '<td class="fw-bold">' + esc(c.grupo) + '</td>' +
                '<td class="fw-bold">' + esc(c.cota) + '</td>' +
                '<td>' + esc(c.cpf_cnpj || '-') + '</td>' +
                '<td>' + esc(c.nome_devedor || '-') + '</td>' +
                '<td><span class="status-badge ' + getStatusClass(c.status) + '">' + esc(c.status || '-') + '</span></td>' +
                '<td>' + formatDate(c.data_arquivo) + '</td>' +
                '<td class="text-right"><button type="button" class="action-btn" data-id="' + esc(String(c.id)) + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
            resultsBody.appendChild(tr);
        });

        bindDetailButtons();
        if (podeEmailMassa) {
            updateRelEmailToolbarSummary();
            syncRelEmailSelectAllCheckbox();
        }
    }

    function bindDetailButtons() {
        document.querySelectorAll('#resultsBody .action-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openDetails(this.getAttribute('data-id'));
            });
        });
    }

    // --- Ordenação ---
    document.querySelectorAll('.sortable-header').forEach(function (header) {
        header.addEventListener('click', function () {
            var column = this.getAttribute('data-column');
            handleSort(column, this);
        });
    });

    function handleSort(column, element) {
        if (sortConfig.column === column) {
            sortConfig.order = sortConfig.order === 'asc' ? 'desc' : 'asc';
        } else {
            sortConfig.column = column;
            sortConfig.order = 'asc';
        }

        updateSortUI(element);
        sortData();
        renderResults(currentResults);
    }

    function updateSortUI(activeElement) {
        resetSortHeaders();
        activeElement.classList.add(sortConfig.order);
    }

    function resetSortHeaders() {
        document.querySelectorAll('.sortable-header').forEach(function (h) {
            h.classList.remove('asc', 'desc');
        });
    }

    function sortData() {
        var col = sortConfig.column;
        var order = sortConfig.order === 'asc' ? 1 : -1;

        currentResults.sort(function (a, b) {
            var valA = a[col];
            var valB = b[col];

            // Tratamento especial por coluna
            if (col === 'data_arquivo') {
                valA = valA ? new Date(valA) : new Date(0);
                valB = valB ? new Date(valB) : new Date(0);
            } else if (col === 'numero_contrato') {
                // Tentativa de ordenar numericamente se possível
                var nA = parseInt(valA);
                var nB = parseInt(valB);
                if (!isNaN(nA) && !isNaN(nB)) {
                    valA = nA;
                    valB = nB;
                }
            } else if (col === 'grupo' || col === 'cota') {
                // Grupo e Cota: chave composta
                var aFull = (a.grupo || '') + '\0' + (a.cota || '');
                var bFull = (b.grupo || '') + '\0' + (b.cota || '');
                return aFull.localeCompare(bFull) * order;
            }

            // Fallback: comparação de string genérica
            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * order;
            }
            return (valA < valB ? -1 : 1) * order;
        });
    }

    // --- Modal ---
    async function openDetails(id) {
        modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';
        modalTitle.textContent = 'Carregando...';
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        window.__refreshContatoSrc = function () { return openDetails(id); };

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
        html += dataItem('Grupo / Cota', c.grupo + '/' + c.cota);
        html += dataItem('Nro Contrato', c.numero_contrato);
        html += dataItem('Versao', c.versao);
        html += dataItem('Status', c.status || c.status_txt, true, c.status);
        html += dataItem('Valor do Credito', formatCurrency(c.valor_credito));
        html += dataItem('Prazo (meses)', c.prazo_meses);
        html += dataItem('Data de Adesao', formatDate(c.data_adesao));
        html += dataItem('Encerramento Grupo', formatDate(c.encerramento_grupo));
        html += dataItem('Taxa Administracao', typeof formatTaxaAdministracaoPercent === 'function'
            ? formatTaxaAdministracaoPercent(c.taxa_administracao)
            : c.taxa_administracao);
        html += dataItem('Fundo Reserva', c.fundo_reserva);
        html += dataItem('Percentual Lance', typeof formatTaxaAdministracaoPercent === 'function'
            ? formatTaxaAdministracaoPercent(c.percentual_lance)
            : c.percentual_lance);
        html += '</div>';
        html += '<div style="margin-top:14px"><button type="button" class="btn-search btn-pv-insert-from-contrato" style="max-width:380px" data-grupo="' + encodeURIComponent(String(c.grupo != null ? c.grupo : '')) + '" data-cota="' + encodeURIComponent(String(c.cota != null ? c.cota : '')) + '"><i class="fa-solid fa-folder-plus"></i> Registrar na Pasta Virtual</button></div>';
        html += '</div>';

        if (data.devedor) {
            html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails, c.id);
        }
        if (data.avalista) {
            html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails, c.id);
        }

        if (window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.buildTramitacoesSectionHtml === 'function') {
            html += window.ContratoDetalhesModal.buildTramitacoesSectionHtml(data, c.id, { esc: esc, formatDateTime: formatDateTime });
        } else if (typeof TramitacoesDetalhe !== 'undefined') {
            html += TramitacoesDetalhe.buildSection(data.tramitacoes || [], c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                registrosSmsEmail: data.registros_sms_email || [],
            });
        }

        html += renderBemSection(data.bens);

        if (data.parcelas && data.parcelas.length > 0 && window.ContratoDetalhesModal &&
                typeof window.ContratoDetalhesModal.buildParcelasSectionHtml === 'function') {
            html += window.ContratoDetalhesModal.buildParcelasSectionHtml(data.parcelas);
        }

        if (data.ocorrencias && data.ocorrencias.length > 0 && window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.buildOcorrenciasTimelineHtml === 'function') {
            html += window.ContratoDetalhesModal.buildOcorrenciasTimelineHtml(data.ocorrencias);
        }

        if (window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.buildNegativacaoSectionHtml === 'function') {
            html += window.ContratoDetalhesModal.buildNegativacaoSectionHtml(data);
        }

        modalContent.innerHTML = html;

        if (window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.initParcelasFilter === 'function') {
            window.ContratoDetalhesModal.initParcelasFilter(modalContent);
        }
        if (window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.initTimelineMonthGroups === 'function') {
            window.ContratoDetalhesModal.initTimelineMonthGroups(modalContent);
        }

        if (typeof TramitacoesDetalhe !== 'undefined') {
            TramitacoesDetalhe.attachModal(modalContent, c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                onReload: function () { return openDetails(c.id); }
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

    function renderPessoaSection(titulo, pessoa, enderecos, telefones, emails, idContrato) {
        if (window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.renderPessoaSection === 'function') {
            return window.ContratoDetalhesModal.renderPessoaSection(titulo, pessoa, enderecos, telefones, emails, idContrato);
        }
        return '';
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
        if (s === 'cobranca' || s === 'aberto' || s === 'em cobranca' || s === 'em cobrança') return 'status-active';
        if (s === 'pago' || s === 'pago total' || s === 'pago parcial' || s === 'fechado') return 'status-success';
        if (s === 'indenizado') return 'status-warning';
        if (s === 'parcela paga') return 'status-success';
        if (s === 'parcela vencida') return 'status-danger';
        return 'status-active';
    }

});
