document.addEventListener('DOMContentLoaded', function () {
    var pvBody = document.getElementById('pvBody');
    var pvTitle = document.getElementById('pvTitle');
    var detalhesModal = document.getElementById('detalhesModal');
    var closeModalBtn = document.getElementById('closeModalBtn');
    var modalTitle = document.getElementById('modalTitle');
    var modalContent = document.getElementById('modalContent');
    var btnNovoPV = document.getElementById('btnNovoPV');
    var insertModal = document.getElementById('insertModal');
    var closeInsertModalBtn = document.getElementById('closeInsertModalBtn');
    var cancelInsertBtn = document.getElementById('cancelInsertBtn');
    var insertForm = document.getElementById('insertForm');
    var insertMsg = document.getElementById('insertMsg');
    var pvGrupo = document.getElementById('pvGrupo');
    var pvCota = document.getElementById('pvCota');
    var pvDescricao = document.getElementById('pvDescricao');
    var pvArquivo = document.getElementById('pvArquivo');

    var rowsCache = [];
    var pvMeta = null;

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
        if (s === 'aberto' || s === 'em cobranca' || s === 'em cobranùa') return 'status-active';
        if (s === 'fechado' || s === 'pago' || s === 'parcela paga') return 'status-success';
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

    function renderPessoaSection(titulo, pessoa, enderecos, telefones, emails) {
        var icon = titulo === 'Avalista' ? 'fa-user-shield' : 'fa-user-tie';
        var html = '<div class="detail-section"><h3><i class="fa-solid ' + icon + '"></i> ' + esc(titulo) + '</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Nome', pessoa.nome_completo);
        html += dataItem('CPF / CNPJ', pessoa.cpf_cnpj);
        html += dataItem('Data de Nascimento', formatDate(pessoa.data_nascimento));
        html += dataItem('Profissùo', pessoa.profissao);
        html += dataItem('Cùnjuge', pessoa.conjuge_nome);
        html += '</div>';

        if (enderecos && enderecos.length > 0) {
            enderecos.forEach(function (e) {
                html += '<div class="detail-grid" style="margin-top:12px">';
                html += dataItem('Endereùo (' + (e.tipo || '') + ')', [e.logradouro, e.complemento, e.bairro, e.cidade, e.estado, e.cep].filter(Boolean).join(', '));
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

    function renderContratoModal(data) {
        var c = data.contrato;
        modalTitle.innerHTML = 'Detalhes do Contrato: <span class="text-accent">' + esc(c.grupo) + '/' + esc(c.cota) + '</span>';

        var html = '';
        html += '<div class="detail-section"><h3><i class="fa-solid fa-file-contract"></i> Dados do Contrato</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Grupo / Cota', c.grupo + '/' + c.cota);
        html += dataItem('Nù Contrato', c.numero_contrato);
        html += dataItem('Versùo', c.versao);
        html += dataItem('Status', c.status || c.status_txt, true, c.status);
        html += dataItem('Valor do Crùdito', formatCurrency(c.valor_credito));
        html += dataItem('Prazo (meses)', c.prazo_meses);
        html += dataItem('Data de Adesùo', formatDate(c.data_adesao));
        html += dataItem('Encerramento Grupo', formatDate(c.encerramento_grupo));
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
            html += '<th>Nù</th><th>Vencimento</th><th>Valor Nominal</th><th>Multa/Juros</th><th>Valor Total</th><th>Status</th>';
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
            html += '<div class="detail-section"><h3><i class="fa-solid fa-timeline"></i> Histùrico de Ocorrùncias (' + data.ocorrencias.length + ')</h3>';
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
                onReload: function () { return openContrato(c.id); }
            });
        }
    }

    function closeModal() {
        detalhesModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function showInsertMsg(msg, ok) {
        if (!insertMsg) return;
        insertMsg.style.display = msg ? 'block' : 'none';
        insertMsg.style.color = ok ? '#15803d' : '#ef4444';
        insertMsg.textContent = msg || '';
    }

    function openInsertModal() {
        if (!insertModal) return;
        showInsertMsg('');
        if (insertForm) insertForm.reset();
        if (pvMeta && pvMeta.contrato_col === null && pvGrupo && pvCota) {
            pvGrupo.closest('.form-group').style.display = 'none';
            pvCota.closest('.form-group').style.display = 'none';
        } else if (pvGrupo && pvCota) {
            pvGrupo.closest('.form-group').style.display = '';
            pvCota.closest('.form-group').style.display = '';
        }
        if (pvMeta && pvMeta.blob_col === null && pvArquivo) {
            pvArquivo.closest('.form-group').style.display = 'none';
        } else if (pvArquivo) {
            pvArquivo.closest('.form-group').style.display = '';
        }
        insertModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeInsertModal() {
        if (!insertModal) return;
        insertModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    async function loadPastaVirtualMeta() {
        try {
            var resp = await fetch('/api/pasta-virtual/meta');
            var data = await resp.json();
            if (!data.error) pvMeta = data;
        } catch (err) {
            pvMeta = null;
        }
    }

    async function openContrato(idContrato) {
        if (!idContrato) return;
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        modalTitle.textContent = 'Carregando...';
        modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';

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
                '<div class="pv-desc-label">Descricao</div>' + descBlock +
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

    async function loadPastaVirtual() {
        try {
            var resp = await fetch('/api/pasta-virtual');
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

    if (btnNovoPV) {
        btnNovoPV.addEventListener('click', function () {
            openInsertModal();
        });
    }
    if (closeInsertModalBtn) {
        closeInsertModalBtn.addEventListener('click', closeInsertModal);
    }
    if (cancelInsertBtn) {
        cancelInsertBtn.addEventListener('click', closeInsertModal);
    }
    if (insertModal) {
        insertModal.addEventListener('click', function (e) {
            if (e.target === insertModal) closeInsertModal();
        });
    }

    if (insertForm) {
        insertForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            showInsertMsg('');
            var fd = new FormData();
            if (pvGrupo && !pvGrupo.value.trim()) {
                showInsertMsg('Grupo e obrigatorio.', false);
                return;
            }
            if (pvCota && !pvCota.value.trim()) {
                showInsertMsg('Cota e obrigatoria.', false);
                return;
            }
            if (pvGrupo) {
                fd.append('grupo', pvGrupo.value.trim());
            }
            if (pvCota) {
                fd.append('cota', pvCota.value.trim());
            }
            if (!pvDescricao || !pvDescricao.value.trim()) {
                showInsertMsg('Descricao e obrigatoria.', false);
                return;
            }
            fd.append('descricao', pvDescricao.value.trim());
            if (pvArquivo && pvArquivo.files && pvArquivo.files[0]) fd.append('arquivo', pvArquivo.files[0]);

            try {
                var resp = await fetch('/api/pasta-virtual/inserir', {
                    method: 'POST',
                    body: fd,
                });
                var data = await resp.json();
                if (!resp.ok || data.error) {
                    var msg = data.error || 'Erro ao inserir.';
                    if (data.missing && data.missing.length) {
                        msg += ' Campos obrigatorios: ' + data.missing.join(', ');
                    }
                    showInsertMsg(msg, false);
                    return;
                }
                if (insertForm) insertForm.reset();
                showInsertMsg('');
                await loadPastaVirtual();
                closeInsertModal();
                window.alert('Registro inserido com sucesso.');
            } catch (err) {
                showInsertMsg('Erro ao inserir: ' + err.message, false);
            }
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (detalhesModal.classList.contains('active')) closeModal();
        if (insertModal && insertModal.classList.contains('active')) closeInsertModal();
    });

    loadPastaVirtualMeta().finally(function () {
        loadPastaVirtual();
    });
});
