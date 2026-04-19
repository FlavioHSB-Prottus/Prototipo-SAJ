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
    const statusGroup = document.getElementById('statusGroup');
    const statusFiltro = document.getElementById('status_filtro');

    let activeTipo = 'pessoa';
    var _pessoaCache = null;
    var _fromPessoa = false;

    // Placeholder dinamico + mostrar/ocultar filtro de status
    tipoBusca.addEventListener('change', function () {
        activeTipo = this.value;
        if (activeTipo === 'pessoa') {
            termoInput.placeholder = 'Digite o nome ou CPF...';
            statusGroup.classList.add('d-none');
        } else if (activeTipo === 'bem') {
            termoInput.placeholder = 'Digite a descrição do bem (modelo, marca, etc)...';
            statusGroup.classList.remove('d-none');
        } else {
            termoInput.placeholder = 'Digite grupo/cota (ex: 001234/0012)';
            statusGroup.classList.remove('d-none');
        }
    });

    // Limpar resultados
    btnLimpar.addEventListener('click', function () {
        resultsSection.classList.add('d-none');
        resultsBody.innerHTML = '';
        noResults.classList.add('d-none');
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
            if ((activeTipo === 'contrato' || activeTipo === 'bem') && statusFiltro.value) {
                url += '&status=' + encodeURIComponent(statusFiltro.value);
            }
            const resp = await fetch(url);
            const data = await resp.json();
            renderResults(data.results, activeTipo);
        } catch (err) {
            resultsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#ef4444">Erro ao buscar: ' + err.message + '</td></tr>';
        }
    });

    function renderResults(results, tipo) {
        resultsHead.innerHTML = '';
        resultsBody.innerHTML = '';

        if (!results || results.length === 0) {
            resultsTitle.textContent = 'Resultados da Busca (0 encontrados)';
            noResults.classList.remove('d-none');
            return;
        }

        noResults.classList.add('d-none');
        resultsTitle.textContent = 'Resultados da Busca (' + results.length + ' encontrado' + (results.length > 1 ? 's' : '') + ')';

        if (tipo === 'pessoa') {
            resultsHead.innerHTML = '<th>Nome</th><th>CPF / CNPJ</th><th>Profissao</th><th class="text-right">Acoes</th>';
            results.forEach(function (p) {
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td class="fw-bold">' + esc(p.nome_completo) + '</td>' +
                    '<td>' + esc(p.cpf_cnpj) + '</td>' +
                    '<td>' + esc(p.profissao || '-') + '</td>' +
                    '<td class="text-right"><button class="action-btn" data-id="' + p.id + '" data-tipo="pessoa"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                resultsBody.appendChild(tr);
            });
        } else if (tipo === 'bem') {
            resultsHead.innerHTML = '<th>Grupo / Cota</th><th>Bem</th><th>Nome Devedor</th><th>Status</th><th class="text-right">Acoes</th>';
            results.forEach(function (c) {
                var statusClass = getStatusClass(c.status);
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td class="fw-bold">' + esc(c.grupo) + ' / ' + esc(c.cota) + '</td>' +
                    '<td>' + esc(c.bem_descricao || '-') + '</td>' +
                    '<td>' + esc(c.nome_devedor || '-') + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + esc(c.status || '-') + '</span></td>' +
                    '<td class="text-right"><button class="action-btn" data-id="' + c.id + '" data-tipo="contrato"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                resultsBody.appendChild(tr);
            });
        } else {
            resultsHead.innerHTML = '<th>Grupo / Cota</th><th>Nro Contrato</th><th>Nome Devedor</th><th>Status</th><th class="text-right">Acoes</th>';
            results.forEach(function (c) {
                var statusClass = getStatusClass(c.status);
                var tr = document.createElement('tr');
                tr.innerHTML =
                    '<td class="fw-bold">' + esc(c.grupo) + ' / ' + esc(c.cota) + '</td>' +
                    '<td>' + esc(c.numero_contrato || '-') + '</td>' +
                    '<td>' + esc(c.nome_devedor || '-') + '</td>' +
                    '<td><span class="status-badge ' + statusClass + '">' + esc(c.status || '-') + '</span></td>' +
                    '<td class="text-right"><button class="action-btn" data-id="' + c.id + '" data-tipo="contrato"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                resultsBody.appendChild(tr);
            });
        }

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
                html += '<td>' + esc(c.grupo) + ' / ' + esc(c.cota) + '</td>';
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
