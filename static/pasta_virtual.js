document.addEventListener('DOMContentLoaded', function () {
    var pvBody = document.getElementById('pvBody');
    var pvTitle = document.getElementById('pvTitle');
    var detalhesModal = document.getElementById('detalhesModal');
    var closeModalBtn = document.getElementById('closeModalBtn');
    var modalTitle = document.getElementById('modalTitle');
    var modalContent = document.getElementById('modalContent');
    var btnNovoPV = document.getElementById('btnNovoPV');
    var pvFilterForm = document.getElementById('pvFilterForm');
    var filtroContrato = document.getElementById('filtroContrato');
    var filtroFuncionario = document.getElementById('filtroFuncionario');
    var btnLimparPV = document.getElementById('btnLimparPV');

    var rowsCache = [];

    function esc(val) {
        if (val === null || val === undefined) return '-';
        var div = document.createElement('div');
        div.textContent = String(val);
        return div.innerHTML;
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
        var d = parts[0];
        var t = parts[1] || '';
        if (parts.length === 1 && String(val).indexOf(' ') > -1) {
            var p2 = String(val).split(' ');
            d = p2[0];
            t = p2[1] || '';
        }
        var dSplit = d.split('-');
        var dFmt = dSplit.length === 3 ? dSplit[2] + '/' + dSplit[1] + '/' + dSplit[0] : d;
        return dFmt + (t ? ' ' + t.substring(0, 5) : '');
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
        if (s === 'pago' || s === 'fechado' || s === 'parcela paga') return 'status-success';
        if (s === 'indenizado') return 'status-warning';
        if (s === 'parcela vencida') return 'status-danger';
        return 'status-active';
    }

    function dataItem(label, value, isBadge, badgeStatus) {
        var display = (value !== null && value !== undefined && value !== '') ? esc(value) : '-';
        if (isBadge && badgeStatus) {
            display = '<span class="status-badge ' + getStatusClass(badgeStatus) + '">' + esc(value) + '</span>';
        }
        return '<div class="data-item"><span class="data-label">' + esc(label) + '</span><span class="data-value">' + display + '</span></div>';
    }

    function renderPessoaSection(titulo, pessoa, enderecos, telefones, emails, idContrato) {
        var icon = titulo === 'Avalista' ? 'fa-user-shield' : 'fa-user-tie';
        var html = '<div class="detail-section"><h3><i class="fa-solid ' + icon + '"></i> ' + esc(titulo) + '</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Nome', pessoa.nome_completo);
        html += dataItem('CPF / CNPJ', pessoa.cpf_cnpj);
        html += dataItem('Data de Nascimento', formatDate(pessoa.data_nascimento));
        html += dataItem('Profissão', pessoa.profissao);
        html += dataItem('Cônjuge', pessoa.conjuge_nome);
        html += '</div>';

        if (enderecos && enderecos.length > 0) {
            enderecos.forEach(function (e) {
                html += '<div class="detail-grid" style="margin-top:12px">';
                html += dataItem('Endereço (' + (e.tipo || '') + ')', [e.logradouro, e.complemento, e.bairro, e.cidade, e.estado, e.cep].filter(Boolean).join(', '));
                html += '</div>';
            });
        }

        if (pessoa && pessoa.id) {
            var _pEnc = encodeURIComponent(pessoa.nome_completo || '');
            var _pId = String(pessoa.id);
            var _pnSms = String((pessoa && pessoa.nome_completo) || '').trim();
            if (_pnSms) {
                _pnSms = _pnSms.split(/\s+/)[0];
            } else {
                _pnSms = 'Cliente';
            }
            html += '<div class="contact-grid" style="margin-top:12px">';
            html += '<div><div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px"><h4 style="font-size:0.85rem;color:var(--text-muted);margin:0">Telefones</h4>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="action-btn btn-add-telefone-pessoa" data-pessoa-id="' + _pId + '" data-pessoa-nome="' + _pEnc + '" data-recurso="telefone"><i class="fa-solid fa-plus"></i> Telefone</button></div></div>';
            if (telefones && telefones.length) {
                html += '<ul class="contact-list">';
                telefones.forEach(function (t) {
                    html += '<li><i class="fa-solid fa-phone"></i> ' + esc(t.numero || '-');
                    if (t.ramal) html += ' (ramal ' + esc(t.ramal) + ')';
                    var _waExtra = '';
                    if (idContrato != null && String(idContrato) !== '') {
                        _waExtra = ' data-wa-auto-contrato="1" data-primeiro-nome="' + esc(_pnSms) + '"';
                    }
                    html += '<button type="button" class="btn-ligar" title="Ligar" data-numero="' + esc(t.numero || '') + '"><i class="fa-solid fa-phone-volume"></i></button>' +
                        '<button type="button" class="btn-whatsapp" title="Enviar WhatsApp" data-numero="' + esc(t.numero || '') + '"' + _waExtra + '><i class="fa-brands fa-whatsapp"></i></button>';
                    var _smsG = ' data-pessoa-id="' + esc(_pId) + '"';
                    if (t.id != null && t.id !== '') { _smsG += ' data-telefone-id="' + esc(String(t.id)) + '"'; }
                    if (idContrato != null && String(idContrato) !== '') {
                        _smsG += ' data-contrato-id="' + esc(String(idContrato)) + '"';
                        _smsG += ' data-sms-auto-contrato="1"';
                        _smsG += ' data-primeiro-nome="' + esc(_pnSms) + '"';
                    }
                    html += '<button type="button" class="btn-mensagem" title="Enviar SMS" data-numero="' + esc(t.numero || '') + '"' + _smsG + '"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-meta">';
                    var _fonteTel = (typeof window.formatContatoFonteLabel === 'function') ? window.formatContatoFonteLabel(t.fonte) : '';
                    if (_fonteTel) html += '<span class="contact-fonte" title="Origem do cadastro">' + esc(_fonteTel) + '</span>';
                    html += '<span class="contact-tipo">' + esc(t.tipo) + '</span></span></li>';
                });
                html += '</ul>';
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;margin:0">Nenhum telefone cadastrado.</p>';
            }
            html += '</div><div><div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px"><h4 style="font-size:0.85rem;color:var(--text-muted);margin:0">E-mails</h4>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="action-btn btn-add-email-pessoa" data-pessoa-id="' + _pId + '" data-pessoa-nome="' + _pEnc + '" data-recurso="email"><i class="fa-solid fa-plus"></i> Email</button></div></div>';
            if (emails && emails.length) {
                html += '<ul class="contact-list">';
                emails.forEach(function (em) {
                    html += '<li><i class="fa-solid fa-envelope"></i> ' + esc(em.email || '-');
                    var _emC = ' data-email="' + esc(em.email || '') + '" data-pessoa-id="' + esc(_pId) + '"';
                    if (em.id != null && em.id !== '') { _emC += ' data-email-id="' + esc(String(em.id)) + '"'; }
                    if (idContrato != null && String(idContrato) !== '') {
                        _emC += ' data-contrato-id="' + esc(String(idContrato)) + '"';
                        _emC += ' data-email-auto-contrato="1"';
                        _emC += ' data-primeiro-nome="' + esc(_pnSms) + '"';
                    }
                    html += '<button type="button" class="btn-enviar-email-html" title="Enviar e-mail"' + _emC +
                        '><i class="fa-solid fa-envelope"></i></button>';
                    html += '<span class="contact-meta">';
                    var _fonteEm = (typeof window.formatContatoFonteLabel === 'function') ? window.formatContatoFonteLabel(em.fonte) : '';
                    if (_fonteEm) html += '<span class="contact-fonte" title="Origem do cadastro">' + esc(_fonteEm) + '</span>';
                    html += '<span class="contact-tipo">' + esc(em.tipo) + '</span></span></li>';
                });
                html += '</ul>';
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;margin:0">Nenhum e-mail cadastrado.</p>';
            }
            html += '</div></div>';
        }
        html += '</div>';
        return html;
    }

    function renderContratoModal(data) {
        var c = data.contrato;
        modalTitle.innerHTML = 'Detalhes do Contrato: <span class="text-accent">' + esc(c.grupo) + '/' + esc(c.cota) + '</span>';

        var html = '';
        html += '<div class="detail-section"><h3><i class="fa-solid fa-file-contract"></i> Dados do Contrato</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Grupo / Cota', c.grupo + '/' + c.cota);
        html += dataItem('Nº Contrato', c.numero_contrato);
        html += dataItem('Versão', c.versao);
        html += dataItem('Status', c.status || c.status_txt, true, c.status);
        html += dataItem('Valor do Crédito', formatCurrency(c.valor_credito));
        html += dataItem('Prazo (meses)', c.prazo_meses);
        html += dataItem('Data de Adesão', formatDate(c.data_adesao));
        html += dataItem('Encerramento Grupo', formatDate(c.encerramento_grupo));
        html += '</div>';
        html += '<div style="margin-top:14px"><button type="button" class="btn-search btn-pv-insert-from-contrato" style="max-width:380px" data-grupo="' + encodeURIComponent(String(c.grupo != null ? c.grupo : '')) + '" data-cota="' + encodeURIComponent(String(c.cota != null ? c.cota : '')) + '"><i class="fa-solid fa-folder-plus"></i> Registrar na Pasta Virtual</button></div>';
        html += '</div>';

        if (data.devedor) {
            html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails, c.id);
        }
        if (data.avalista) {
            html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails, c.id);
        }

        if (data.parcelas && data.parcelas.length > 0) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-list-ol"></i> Parcelas (' + data.parcelas.length + ')</h3>';
            html += '<div class="table-responsive"><table class="styled-table modal-table"><thead><tr>';
            html += '<th>Nº</th><th>Vencimento</th><th>Valor Nominal</th><th>Multa/Juros</th><th>Valor Total</th><th>Status</th>';
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

        if (data.ocorrencias && data.ocorrencias.length > 0 && window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.buildOcorrenciasTimelineHtml === 'function') {
            html += window.ContratoDetalhesModal.buildOcorrenciasTimelineHtml(data.ocorrencias);
        }

        if (window.ContratoDetalhesModal && typeof window.ContratoDetalhesModal.buildNegativacaoSectionHtml === 'function') {
            html += window.ContratoDetalhesModal.buildNegativacaoSectionHtml(data);
        }

        html += (typeof TramitacoesDetalhe !== 'undefined')
            ? TramitacoesDetalhe.buildSection(data.tramitacoes || [], c.id, {
                    esc: esc,
                    formatDateTime: formatDateTime,
                    registrosSmsEmail: data.registros_sms_email || [],
                })
            : '';

        modalContent.innerHTML = html;
        if (typeof TramitacoesDetalhe !== 'undefined') {
            TramitacoesDetalhe.attachModal(modalContent, c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                onReload: function () { return openContrato(c.id); }
            });
        }
    }

    function closeModal() {
        detalhesModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    async function openContrato(idContrato) {
        if (!idContrato) return;
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        modalTitle.textContent = 'Carregando...';
        modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';
        window.__refreshContatoSrc = function () { return openContrato(idContrato); };

        try {
            var resp = await fetch('/api/contrato/' + encodeURIComponent(idContrato));
            var data = await resp.json();
            if (data.error) {
                modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">' + esc(data.error) + '</p>';
                return;
            }
            renderContratoModal(data);
        } catch (err) {
            modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">Erro ao carregar: ' + esc(err.message) + '</p>';
        }
    }

    function buildCampoSecundario(item) {
        var campos = item.campos || {};
        for (var k in campos) {
            if (!Object.prototype.hasOwnProperty.call(campos, k)) continue;
            var low = String(k).toLowerCase();
            if (['id', 'id_contrato', 'id_funcionario', 'arquivo_nome', 'nome_arquivo', 'mime_type', 'mimetype', 'descricao', 'observacao', 'comentario', 'texto', 'notas'].indexOf(low) > -1) {
                continue;
            }
            var val = campos[k];
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                return esc(val);
            }
        }
        return '-';
    }

    function getDescricaoText(item) {
        if (item.descricao != null && String(item.descricao).trim() !== '') {
            return String(item.descricao);
        }
        var campos = item.campos || {};
        for (var k in campos) {
            if (!Object.prototype.hasOwnProperty.call(campos, k)) continue;
            if (String(k).toLowerCase() !== 'descricao') continue;
            var v = campos[k];
            if (v != null && String(v).trim() !== '') {
                return String(v);
            }
        }
        return '';
    }

    function renderRows(items) {
        rowsCache = items || [];
        if (!rowsCache.length) {
            pvBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Nenhum registro encontrado na pasta virtual.</td></tr>';
            pvTitle.innerHTML = '<i class="fa-solid fa-folder-open"></i> Pasta Virtual (0)';
            return;
        }

        pvTitle.innerHTML = '<i class="fa-solid fa-folder-open"></i> Pasta Virtual (' + rowsCache.length + ')';
        pvBody.innerHTML = '';
        rowsCache.forEach(function (item) {
            var tr = document.createElement('tr');
            tr.className = 'pv-row-main';
            var contratoBtn = item.id_contrato
                ? '<button type="button" class="action-btn pv-contrato" data-contrato-id="' + esc(item.id_contrato) + '"><i class="fa-solid fa-file-lines"></i> ' + esc(item.contrato_label || ('Contrato #' + item.id_contrato)) + '</button>'
                : '<span class="text-muted">-</span>';
            var arquivoTxt = (item.arquivo_nome != null && String(item.arquivo_nome) !== '') ? esc(item.arquivo_nome) : buildCampoSecundario(item);
            var statusTxt = item.contrato_status || '-';
            var funcNome = item.funcionario_nome != null && String(item.funcionario_nome).trim() !== '' ? String(item.funcionario_nome) : '-';
            var btnDownload = item.has_arquivo
                ? '<a class="action-btn" href="/api/pasta-virtual/' + encodeURIComponent(item.id) + '/download"><i class="fa-solid fa-download"></i> Baixar</a>'
                : '<button type="button" class="action-btn" disabled style="opacity:.55;cursor:not-allowed"><i class="fa-solid fa-ban"></i> Sem arquivo</button>';
            var descText = getDescricaoText(item);
            var descBlock = descText
                ? '<div class="pv-desc-text">' + esc(descText) + '</div>'
                : '<div class="pv-desc-text text-muted">-</div>';

            tr.innerHTML =
                '<td class="fw-bold">' + esc(item.id) + '</td>' +
                '<td>' + contratoBtn + '</td>' +
                '<td>' + esc(item.contrato_nome_devedor || '-') + '</td>' +
                '<td>' + esc(funcNome) + '</td>' +
                '<td>' + arquivoTxt + '</td>' +
                '<td><span class="status-badge ' + getStatusClass(statusTxt) + '">' + esc(statusTxt) + '</span></td>' +
                '<td class="text-right">' + btnDownload + '</td>';
            pvBody.appendChild(tr);

            var trDesc = document.createElement('tr');
            trDesc.className = 'pv-row-desc';
            trDesc.innerHTML =
                '<td class="pv-desc-cell" colspan="7">' +
                '<div class="pv-desc-label">Descrição</div>' + descBlock +
                '</td>';
            pvBody.appendChild(trDesc);
        });

        pvBody.querySelectorAll('.pv-contrato').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var cid = this.getAttribute('data-contrato-id');
                openContrato(cid);
            });
        });
    }

    function buildPastaVirtualQuery() {
        var p = new URLSearchParams();
        if (filtroContrato && filtroContrato.value.trim()) {
            p.set('contrato', filtroContrato.value.trim());
        }
        if (filtroFuncionario && filtroFuncionario.value) {
            p.set('id_funcionario', filtroFuncionario.value);
        }
        var s = p.toString();
        return s ? '?' + s : '';
    }

    async function loadFuncionariosFiltro() {
        if (!filtroFuncionario) return;
        try {
            var resp = await fetch('/api/funcionarios');
            var data = await resp.json();
            if (!Array.isArray(data)) {
                if (data && data.error) return;
                return;
            }
            while (filtroFuncionario.options.length > 1) {
                filtroFuncionario.remove(1);
            }
            data.forEach(function (f) {
                var opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.nome != null && String(f.nome).trim() !== '' ? String(f.nome) : ('#' + f.id);
                filtroFuncionario.appendChild(opt);
            });
        } catch (err) {
            /* keep Todos */
        }
    }

    async function loadPastaVirtual() {
        try {
            var resp = await fetch('/api/pasta-virtual' + buildPastaVirtualQuery());
            var data = await resp.json();
            if (data.error) {
                pvBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#ef4444">' + esc(data.error) + '</td></tr>';
                return;
            }
            renderRows(data.items || []);
        } catch (err) {
            pvBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:#ef4444">Erro ao carregar: ' + esc(err.message) + '</td></tr>';
        }
    }

    closeModalBtn.addEventListener('click', closeModal);
    detalhesModal.addEventListener('click', function (e) {
        if (e.target === detalhesModal) closeModal();
    });

    if (btnNovoPV && window.PastaVirtualInsertGlobal) {
        btnNovoPV.addEventListener('click', function () {
            window.PastaVirtualInsertGlobal.open({ returnToContrato: false });
        });
    }

    if (pvFilterForm) {
        pvFilterForm.addEventListener('submit', function (e) {
            e.preventDefault();
            loadPastaVirtual();
        });
    }
    if (btnLimparPV) {
        btnLimparPV.addEventListener('click', function () {
            if (filtroContrato) filtroContrato.value = '';
            if (filtroFuncionario) filtroFuncionario.value = '';
            loadPastaVirtual();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (detalhesModal.classList.contains('active')) closeModal();
    });

    document.addEventListener('pastaVirtualInserted', function () {
        loadPastaVirtual();
    });

    loadFuncionariosFiltro();
    loadPastaVirtual();
});
