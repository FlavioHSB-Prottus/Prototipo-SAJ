document.addEventListener('DOMContentLoaded', function () {

    // ---- Referências DOM ----
    var filterTypeConsorciados = document.getElementById('filterTypeConsorciados');
    var searchConsorciados = document.getElementById('searchConsorciados');
    var btnSearchConsorciados = document.getElementById('btnSearchConsorciados');
    var consorciadosBody = document.getElementById('consorciados-body');
    var consorciadosCount = document.getElementById('consorciados-count');

    var filterTypeAvalistas = document.getElementById('filterTypeAvalistas');
    var searchAvalistas = document.getElementById('searchAvalistas');
    var btnSearchAvalistas = document.getElementById('btnSearchAvalistas');
    var avalistasBody = document.getElementById('avalistas-body');
    var avalistasCount = document.getElementById('avalistas-count');

    var detalhesModal = document.getElementById('detalhesModal');
    var closeModalBtn = document.getElementById('closeModalBtn');
    var modalTitle = document.getElementById('modalTitle');
    var modalContent = document.getElementById('modalContent');

    var listCache = { consorciados: [], avalistas: [] };
    var lastLoadError = { consorciados: false, avalistas: false };
    var sortState = {
        consorciados: { key: 'nome', dir: 'asc' },
        avalistas:    { key: 'nome', dir: 'asc' }
    };
    var cadastroWrapper = document.querySelector('.cadastro-wrapper');

    // ---- Placeholders dinâmicos ----
    var placeholders = {
        nome: 'Buscar por Nome...',
        cpf: 'Buscar por CPF ou CNPJ...',
        grupo_cota: 'Buscar por Grupo/Cota (ex: 084731/0737)...',
        bem: 'Buscar por descrição do bem (modelo, marca)...'
    };

    filterTypeConsorciados.addEventListener('change', function () {
        searchConsorciados.placeholder = placeholders[this.value] || placeholders.nome;
        searchConsorciados.value = '';
        searchConsorciados.focus();
    });

    filterTypeAvalistas.addEventListener('change', function () {
        searchAvalistas.placeholder = placeholders[this.value] || placeholders.nome;
        searchAvalistas.value = '';
        searchAvalistas.focus();
    });

    // ---- Carga Inicial (10 primeiros, sem filtro) ----
    loadList('consorciados', '', '');
    loadList('avalistas', '', '');

    // ---- Eventos de Busca ----
    btnSearchConsorciados.addEventListener('click', function () {
        loadList('consorciados', searchConsorciados.value.trim(), filterTypeConsorciados.value);
    });

    searchConsorciados.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') loadList('consorciados', searchConsorciados.value.trim(), filterTypeConsorciados.value);
    });

    btnSearchAvalistas.addEventListener('click', function () {
        loadList('avalistas', searchAvalistas.value.trim(), filterTypeAvalistas.value);
    });

    searchAvalistas.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') loadList('avalistas', searchAvalistas.value.trim(), filterTypeAvalistas.value);
    });

    function getSectionForTableSection(el) {
        if (!el) return null;
        if (el.id === 'consorciados-results') return 'consorciados';
        if (el.id === 'avalistas-results') return 'avalistas';
        return null;
    }

    function onlyDigits(s) {
        return String(s == null ? '' : s).replace(/\D/g, '');
    }

    function sortPessoas(rows, key, dir) {
        if (!rows || !rows.length) return [];
        var copy = rows.slice();
        var mul = dir === 'desc' ? -1 : 1;
        copy.sort(function (a, b) {
            if (key === 'nome') {
                var an = (a.nome_completo || '').toString();
                var bn = (b.nome_completo || '').toString();
                return mul * an.localeCompare(bn, 'pt-BR', { sensitivity: 'base' });
            }
            if (key === 'cpf') {
                var ad = onlyDigits(a.cpf_cnpj);
                var bd = onlyDigits(b.cpf_cnpj);
                if (ad && bd) {
                    if (ad.length !== bd.length) return mul * (ad.length - bd.length);
                    if (ad !== bd) return mul * (ad < bd ? -1 : 1);
                }
                return mul * String(a.cpf_cnpj || '').localeCompare(String(b.cpf_cnpj || ''), 'pt-BR', { numeric: true });
            }
            if (key === 'contratos') {
                var ac = Number(a.total_contratos) || 0;
                var bc = Number(b.total_contratos) || 0;
                return mul * (ac - bc);
            }
            return 0;
        });
        return copy;
    }

    function updateSortHeaders(section) {
        var wrap = document.getElementById(section === 'consorciados' ? 'consorciados-results' : 'avalistas-results');
        if (!wrap) return;
        var st = sortState[section];
        wrap.querySelectorAll('thead th.th-sortable').forEach(function (th) {
            var field = th.getAttribute('data-field');
            th.classList.remove('sorted-asc', 'sorted-desc');
            var icon = th.querySelector('.sort-icon i');
            if (!icon) return;
            if (st.key === field) {
                th.classList.add(st.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
                icon.className = 'fa-solid ' + (st.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            } else {
                icon.className = 'fa-solid fa-sort';
            }
        });
    }

    function applySortFromHeader(th) {
        var field = th.getAttribute('data-field');
        if (!field) return;
        var tableSection = th.closest('.table-section');
        var section = getSectionForTableSection(tableSection);
        if (!section || lastLoadError[section]) return;
        var st = sortState[section];
        if (st.key === field) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
        else {
            st.key = field;
            st.dir = 'asc';
        }
        var sorted = sortPessoas(listCache[section] || [], st.key, st.dir);
        var tbody = section === 'consorciados' ? consorciadosBody : avalistasBody;
        renderTable(section, sorted, tbody);
        updateSortHeaders(section);
    }

    if (cadastroWrapper) {
        cadastroWrapper.addEventListener('click', function (e) {
            var th = e.target.closest('th.th-sortable');
            if (!th) return;
            applySortFromHeader(th);
        });
        cadastroWrapper.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var th = e.target.closest('th.th-sortable');
            if (!th) return;
            e.preventDefault();
            applySortFromHeader(th);
        });
    }

    // ---- Carregar Lista ----
    async function loadList(section, query, tipo) {
        var tbody = section === 'consorciados' ? consorciadosBody : avalistasBody;
        var countEl = section === 'consorciados' ? consorciadosCount : avalistasCount;

        tbody.innerHTML = '<tr><td colspan="4" class="loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';
        lastLoadError[section] = false;

        try {
            var url = '/api/' + section;
            var qs = [];
            if (query) qs.push('q=' + encodeURIComponent(query));
            if (tipo) qs.push('tipo=' + encodeURIComponent(tipo));
            if (qs.length) url += '?' + qs.join('&');

            var resp = await fetch(url);
            var data = await resp.json();

            var label = data.total + ' registro' + (data.total !== 1 ? 's' : '');
            if (!query) label += ' (primeiros 10)';
            countEl.textContent = label;

            listCache[section] = (data.results || []).slice();
            var st = sortState[section];
            var rows = sortPessoas(listCache[section], st.key, st.dir);
            renderTable(section, rows, tbody);
            updateSortHeaders(section);
        } catch (err) {
            lastLoadError[section] = true;
            tbody.innerHTML = '<tr><td colspan="4" class="loading-row" style="color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Erro: ' + esc(err.message) + '</td></tr>';
        }
    }

    // ---- Renderizar Tabela ----
    function renderTable(section, rows, tbody) {
        tbody.innerHTML = '';

        if (!rows || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading-row"><i class="fa-regular fa-circle-xmark"></i> Nenhum registro encontrado.</td></tr>';
            return;
        }

        rows.forEach(function (p) {
            var tr = document.createElement('tr');
            tr.className = 'master-row';
            tr.innerHTML =
                '<td class="fw-bold">' + esc(p.nome_completo || '-') + '</td>' +
                '<td>' + esc(p.cpf_cnpj || '-') + '</td>' +
                '<td><span class="contratos-num"><i class="fa-solid fa-file-contract"></i> ' + (p.total_contratos || 0) + '</span></td>' +
                '<td class="text-right">' +
                '  <button class="action-btn toggle-btn" data-pessoa-id="' + p.id + '" data-section="' + section + '">' +
                '    Mais Detalhes <i class="fa-solid fa-chevron-down toggle-icon"></i>' +
                '  </button>' +
                '</td>';
            tbody.appendChild(tr);

            var detailTr = document.createElement('tr');
            detailTr.className = 'detail-row';
            detailTr.id = 'detail-' + section + '-' + p.id;
            detailTr.innerHTML =
                '<td colspan="4" class="detail-container">' +
                '  <div class="detail-card">' +
                '    <div class="loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Carregando contratos...</div>' +
                '  </div>' +
                '</td>';
            tbody.appendChild(detailTr);
        });

        // Bind toggle
        tbody.querySelectorAll('.toggle-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var pessoaId = this.getAttribute('data-pessoa-id');
                var sec = this.getAttribute('data-section');
                var detailRow = document.getElementById('detail-' + sec + '-' + pessoaId);
                var icon = this.querySelector('.toggle-icon');

                if (detailRow.classList.contains('expanded')) {
                    detailRow.classList.remove('expanded');
                    icon.className = 'fa-solid fa-chevron-down toggle-icon';
                } else {
                    detailRow.classList.add('expanded');
                    icon.className = 'fa-solid fa-chevron-up toggle-icon';
                    loadPersonContracts(pessoaId, detailRow);
                }
            });
        });
    }

    // ---- Carregar contratos de uma pessoa ----
    async function loadPersonContracts(pessoaId, detailRow) {
        var card = detailRow.querySelector('.detail-card');
        if (card.getAttribute('data-loaded') === 'true') return;

        try {
            var resp = await fetch('/api/pessoa/' + pessoaId);
            var data = await resp.json();

            var html = '';
            html += '<h4><i class="fa-solid fa-link"></i> Contratos Associados a ' + esc(data.pessoa.nome_completo) + '</h4>';

            if (data.contratos && data.contratos.length > 0) {
                html += '<table class="sub-table"><thead><tr>';
                html += '<th>Nº Contrato</th><th>Grupo / Cota</th><th>Status</th><th>Ações</th>';
                html += '</tr></thead><tbody>';

                data.contratos.forEach(function (c) {
                    html += '<tr>';
                    html += '<td class="fw-bold">' + esc(c.numero_contrato || '-') + '</td>';
                    html += '<td>' + esc(c.grupo || '-') + '/' + esc(c.cota || '-') + '</td>';
                    html += '<td><span class="status-badge ' + getStatusClass(c.status) + '">' + esc(c.status || '-') + '</span></td>';
                    html += '<td><button class="action-btn detail-contract-btn" data-id="' + c.id + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                    html += '</tr>';
                });

                html += '</tbody></table>';
            } else {
                html += '<p style="color:var(--text-muted);padding:12px 0">Nenhum contrato encontrado.</p>';
            }

            card.innerHTML = html;
            card.setAttribute('data-loaded', 'true');

            card.querySelectorAll('.detail-contract-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    openContractModal(this.getAttribute('data-id'));
                });
            });

        } catch (err) {
            card.innerHTML = '<p style="color:#ef4444;padding:12px 0"><i class="fa-solid fa-triangle-exclamation"></i> Erro: ' + esc(err.message) + '</p>';
        }
    }

    // ---- Modal de Detalhes do Contrato ----
    async function openContractModal(id) {
        modalContent.innerHTML =
            '<div style="text-align:center;padding:48px;color:var(--text-muted)">' +
            '<i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i>' +
            '<p style="margin-top:12px">Carregando detalhes...</p></div>';
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
        html += dataItem('Grupo / Cota', c.grupo + '/' + c.cota);
        html += dataItem('Nro Contrato', c.numero_contrato);
        html += dataItem('Versao', c.versao);
        html += dataItem('Status', c.status, true, c.status);
        html += dataItem('Valor do Credito', formatCurrency(c.valor_credito));
        html += dataItem('Prazo (meses)', c.prazo_meses);
        html += dataItem('Data de Adesao', formatDate(c.data_adesao));
        html += dataItem('Encerramento Grupo', formatDate(c.encerramento_grupo));
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

        html += (typeof TramitacoesDetalhe !== 'undefined')
            ? TramitacoesDetalhe.buildSection(data.tramitacoes || [], c.id, { esc: esc, formatDateTime: formatDateTime })
            : '';

        modalContent.innerHTML = html;

        if (typeof TramitacoesDetalhe !== 'undefined') {
            TramitacoesDetalhe.attachModal(modalContent, c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                onReload: function () { return openContractModal(c.id); }
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
        return 'status-active';
    }

});
