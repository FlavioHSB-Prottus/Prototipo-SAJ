document.addEventListener('DOMContentLoaded', () => {

    const distribuicaoPanel = document.getElementById('distribuicaoPanel');
    const distribuicaoTotais = document.getElementById('distribuicaoTotais');
    const distribuicaoFuncionarios = document.getElementById('distribuicaoFuncionarios');
    const distribuicaoSubtitle = document.getElementById('distribuicaoSubtitle');
    const btnAprovarDistribuicao = document.getElementById('btnAprovarDistribuicao');
    const btnSmsAutomatizadosDistribuicao = document.getElementById('btnSmsAutomatizadosDistribuicao');
    const btnSmsAutomatizadosExcel = document.getElementById('btnSmsAutomatizadosExcel');
    const btnRecarregarDistribuicao = document.getElementById('btnRecarregarDistribuicao');
    const btnRestaurarDistribuicao = document.getElementById('btnRestaurarDistribuicao');
    const btnNegPosDistribuicao = document.getElementById('btnNegPosDistribuicao');
    const btnNegPosListaExcel = document.getElementById('negPosEscolhaListaExcel');
    const negPosEscolhaModal = document.getElementById('negPosEscolhaModal');
    const smsAutomPreviewOverlay = document.getElementById('smsAutomPreviewOverlay');
    const smsAutomPreviewBody = document.getElementById('smsAutomPreviewBody');
    const smsAutomPreviewFechar = document.getElementById('smsAutomPreviewFechar');
    const smsAutomPreviewFecharX = document.getElementById('smsAutomPreviewFecharX');
    const smsAutomEnvioSms = document.getElementById('smsAutomEnvioSms');
    const smsAutomEnvioEmail = document.getElementById('smsAutomEnvioEmail');
    const smsAutomEnvioAmbos = document.getElementById('smsAutomEnvioAmbos');
    const distribuicaoToggle = document.getElementById('distribuicaoToggle');

    /** Último preview SMS/e-mail (para reabilitar botões do modal após envio ou erro). */
    let lastSmsAutomPreview = null;

    function setDistribuicaoExpandido(expandido) {
        if (!distribuicaoPanel || !distribuicaoToggle) return;
        distribuicaoPanel.classList.toggle('collapsed', !expandido);
        distribuicaoToggle.setAttribute('aria-expanded', expandido ? 'true' : 'false');
    }

    if (distribuicaoToggle) {
        distribuicaoToggle.addEventListener('click', function () {
            const jaExpandido = !distribuicaoPanel.classList.contains('collapsed');
            setDistribuicaoExpandido(!jaExpandido);
        });
        distribuicaoToggle.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const jaExpandido = !distribuicaoPanel.classList.contains('collapsed');
                setDistribuicaoExpandido(!jaExpandido);
            }
        });
    }

    const dropZone = document.getElementById('dropZone');
    const dropContent = document.getElementById('dropContent');
    const fileLoadedState = document.getElementById('fileLoadedState');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const btnPickFiles = document.getElementById('btnPickFiles');
    const btnPickFolder = document.getElementById('btnPickFolder');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const fileSizeDisplay = document.getElementById('fileSizeDisplay');
    const btnProcessar = document.getElementById('btnProcessar');
    const processingPanel = document.getElementById('processingPanel');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressStatusText = document.getElementById('progressStatusText');
    const terminalBody = document.getElementById('terminalBody');

    let selectedFiles = [];

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /** Le todas as entradas de um diretorio (readEntries e paginado no Chrome). */
    async function readAllEntries(dirReader) {
        const entries = [];
        let batch;
        do {
            batch = await new Promise((resolve) => dirReader.readEntries(resolve));
            entries.push(...batch);
        } while (batch.length > 0);
        return entries;
    }

    /** Coleta recursivamente arquivos .txt a partir de uma entrada do File System API. */
    async function collectTxtFromEntry(entry) {
        const out = [];
        if (entry.isFile) {
            const f = await new Promise((resolve) => entry.file(resolve));
            if (f.name.toLowerCase().endsWith('.txt')) out.push(f);
            return out;
        }
        if (!entry.isDirectory) return out;
        const reader = entry.createReader();
        const entries = await readAllEntries(reader);
        for (const child of entries) {
            const sub = await collectTxtFromEntry(child);
            out.push(...sub);
        }
        return out;
    }

    /** Monta lista de TXT a partir de drag-and-drop (arquivos, varios arquivos ou pastas). */
    async function collectFromDataTransfer(dt) {
        const out = [];
        const items = dt.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const entry = item.webkitGetAsEntry?.();
            if (entry) {
                const list = await collectTxtFromEntry(entry);
                out.push(...list);
            } else if (item.kind === 'file') {
                const f = item.getAsFile();
                if (f && f.name.toLowerCase().endsWith('.txt')) out.push(f);
            }
        }
        return out;
    }

    function showSelectedFiles(files) {
        selectedFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.txt'));
        if (selectedFiles.length === 0) return;

        const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
        const fromFolder = selectedFiles.some((f) => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

        if (selectedFiles.length === 1) {
            fileNameDisplay.textContent = selectedFiles[0].webkitRelativePath || selectedFiles[0].name;
        } else if (fromFolder) {
            fileNameDisplay.textContent = selectedFiles.length + ' arquivos TXT (pasta / subpastas)';
        } else {
            fileNameDisplay.textContent = selectedFiles.length + ' arquivos TXT selecionados';
        }
        fileSizeDisplay.textContent = formatFileSize(totalSize) + ' • pronto para processar';

        dropContent.classList.add('d-none');
        fileLoadedState.classList.remove('d-none');
        dropZone.style.backgroundColor = '#f0fdf4';
        dropZone.style.borderColor = '#4ade80';

        btnProcessar.classList.remove('disabled');
        btnProcessar.removeAttribute('disabled');
    }

    btnPickFiles.addEventListener('click', (e) => {
        e.stopPropagation();
        folderInput.value = '';
        fileInput.click();
    });

    btnPickFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        folderInput.click();
    });

    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('.picker-btn')) return;
        if (e.target.closest('input[type="file"]')) return;
        folderInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            showSelectedFiles(e.target.files);
        }
    });

    folderInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            showSelectedFiles(e.target.files);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        try {
            const files = await collectFromDataTransfer(e.dataTransfer);
            if (files.length > 0) {
                fileInput.value = '';
                folderInput.value = '';
                showSelectedFiles(files);
            }
        } catch {
            if (e.dataTransfer.files.length > 0) {
                showSelectedFiles(e.dataTransfer.files);
            }
        }
    });

    // Limites por lote: envia no maximo N arquivos OU ~80 MB por POST.
    // Valores conservadores para nao estourar o dev server do Flask e dar
    // feedback granular de progresso ao usuario.
    const UPLOAD_BATCH_MAX_FILES = 25;
    const UPLOAD_BATCH_MAX_BYTES = 80 * 1024 * 1024; // 80 MB

    // Fase de upload ocupa 0 - UPLOAD_PHASE_CAP% na barra; o SSE leva o resto.
    const UPLOAD_PHASE_CAP = 45;

    let highestProgress = 0;

    function buildUploadBatches(files) {
        const batches = [];
        let current = [];
        let currentSize = 0;
        for (const f of files) {
            const wouldExceed = current.length >= UPLOAD_BATCH_MAX_FILES
                || (current.length > 0 && currentSize + f.size > UPLOAD_BATCH_MAX_BYTES);
            if (wouldExceed) {
                batches.push(current);
                current = [];
                currentSize = 0;
            }
            current.push(f);
            currentSize += f.size;
        }
        if (current.length > 0) batches.push(current);
        return batches;
    }

    function uploadBatch(files, tempDir, onProgress) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            files.forEach((f) => {
                const rel = f.webkitRelativePath || f.name;
                formData.append('files', f, rel);
            });
            if (tempDir) formData.append('temp_dir', tempDir);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload');
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && typeof onProgress === 'function') {
                    onProgress(e.loaded);
                }
            });
            xhr.onload = () => {
                let data;
                try {
                    data = JSON.parse(xhr.responseText);
                } catch {
                    reject(new Error('Resposta invalida do servidor'));
                    return;
                }
                if (xhr.status >= 200 && xhr.status < 300 && !data.error) {
                    resolve(data);
                } else {
                    reject(new Error(data.error || ('HTTP ' + xhr.status)));
                }
            };
            xhr.onerror = () => reject(new Error('Erro de rede ao enviar lote'));
            xhr.send(formData);
        });
    }

    btnProcessar.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        btnProcessar.classList.add('disabled');
        btnProcessar.setAttribute('disabled', 'true');
        btnProcessar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando arquivos...';

        processingPanel.classList.remove('d-none');
        terminalBody.innerHTML = '';
        highestProgress = 0;
        progressBarFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        progressStatusText.textContent = 'Enviando arquivos ao servidor...';
        progressStatusText.style.color = '';

        const batches = buildUploadBatches(selectedFiles);
        const totalBytes = selectedFiles.reduce((s, f) => s + f.size, 0) || 1;
        let bytesUploadedSoFar = 0;
        let totalSentCount = 0;
        let tempDir = null;

        addLog('> [SYSTEM] Iniciando envio de ' + selectedFiles.length + ' arquivo(s) em ' + batches.length + ' lote(s)...', 'info');

        try {
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchBytes = batch.reduce((s, f) => s + f.size, 0);

                progressStatusText.textContent = 'Enviando lote ' + (i + 1) + '/' + batches.length
                    + ' (' + formatFileSize(bytesUploadedSoFar) + ' / ' + formatFileSize(totalBytes) + ')';

                const data = await uploadBatch(batch, tempDir, (batchLoaded) => {
                    const uploaded = bytesUploadedSoFar + Math.min(batchLoaded, batchBytes);
                    const pct = Math.floor((uploaded / totalBytes) * UPLOAD_PHASE_CAP);
                    setProgress(pct);
                });

                tempDir = data.temp_dir;
                totalSentCount += data.files.length;
                bytesUploadedSoFar += batchBytes;
                addLog('> [SYSTEM] Lote ' + (i + 1) + '/' + batches.length + ' recebido (' + data.files.length + ' arquivo(s)).', 'info');
            }

            setProgress(UPLOAD_PHASE_CAP);
            addLog('> [SYSTEM] ' + totalSentCount + ' arquivo(s) enviados ao servidor com sucesso.', 'success');

            btnProcessar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processando Lote...';
            progressStatusText.textContent = 'Upload concluido. Aguardando processamento...';
            startSSE(tempDir);

        } catch (err) {
            addLog('> [ERRO] Falha no envio: ' + err.message, 'alert');
            resetButton();
        }
    });

    function startSSE(tempDir) {
        const evtSource = new EventSource('/api/processar?dir=' + encodeURIComponent(tempDir));

        evtSource.onmessage = (event) => {
            let data;
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }

            switch (data.type) {
                case 'log':
                    addLog('> ' + data.text, data.level || 'info');
                    break;
                case 'progress':
                    setProgress(data.value);
                    break;
                case 'status':
                    progressStatusText.textContent = data.text;
                    break;
                case 'done':
                    setProgress(100);
                    progressStatusText.textContent = 'Processamento Concluído com Sucesso!';
                    progressStatusText.style.color = '#10b981';
                    addLog('> [SUCCESS] ' + (data.summary || 'Concluido.'), 'success');
                    btnProcessar.innerHTML = '<i class="fa-solid fa-check-double"></i> Tarefa Finalizada';
                    evtSource.close();
                    if (data.distribuicao_ready !== false) {
                        loadDistribuicao(true);
                    }
                    break;
                case 'error':
                    addLog('> [ERRO] ' + data.text, 'alert');
                    evtSource.close();
                    resetButton();
                    break;
            }
        };

        evtSource.onerror = () => {
            evtSource.close();
        };
    }

    const LEVEL_CLASS = {
        info: 'log-info',
        update: 'log-update',
        alert: 'log-alert',
        success: 'log-success',
    };

    function addLog(text, level) {
        const p = document.createElement('p');
        p.className = 'log-line ' + (LEVEL_CLASS[level] || 'log-info');
        p.textContent = text;
        terminalBody.appendChild(p);
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    function setProgress(value) {
        const v = Math.max(0, Math.min(100, Math.floor(value)));
        if (v < highestProgress) return;
        highestProgress = v;
        progressBarFill.style.width = v + '%';
        progressPercentage.textContent = v + '%';
    }

    function resetButton() {
        btnProcessar.classList.remove('disabled');
        btnProcessar.removeAttribute('disabled');
        btnProcessar.innerHTML = '<i class="fa-solid fa-gears"></i> Iniciar Processamento e Classificação';
    }

    // =====================================================================
    // Painel de Distribuicao de Funcionarios (pos-importacao)
    // =====================================================================

    const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const fmtInt = (n) => {
        const x = Number(n);
        if (!isFinite(x)) return '0';
        return x.toLocaleString('pt-BR');
    };
    const fmtMoney = (n) => BRL.format(Number(n) || 0);
    const fmtPct = (part, total) => {
        if (!total) return '0%';
        return ((Number(part) / Number(total)) * 100).toFixed(1).replace('.', ',') + '%';
    };
    const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[m]));

    let distribuicaoData = null;
    let distribuicaoAprovadaNaSessao = false;

    function syncSmsDistribuicaoFooterButtons() {
        const d = distribuicaoData;
        const totals = d && d.totais ? d.totais : {};
        const c = totals.count || 0;
        const en = !!c;
        if (btnSmsAutomatizadosDistribuicao) btnSmsAutomatizadosDistribuicao.disabled = !en;
        if (btnSmsAutomatizadosExcel) btnSmsAutomatizadosExcel.disabled = !en;
        if (btnNegPosDistribuicao) btnNegPosDistribuicao.disabled = !en;
        if (btnNegPosListaExcel) btnNegPosListaExcel.disabled = !en;
    }

    async function loadDistribuicao(scrollIntoView = false) {
        try {
            distribuicaoPanel.classList.remove('d-none');
            distribuicaoTotais.innerHTML = '<div class="dist-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando distribuição...</div>';
            distribuicaoFuncionarios.innerHTML = '';

            const resp = await fetch('/api/importacao/distribuicao');
            const data = await resp.json();
            if (!resp.ok || data.error) {
                distribuicaoTotais.innerHTML = '<div class="dist-error">Falha ao carregar distribuição: ' + escHtml(data.error || ('HTTP ' + resp.status)) + '</div>';
                return;
            }
            distribuicaoData = data;
            renderDistribuicao();
            // Recolhido por padrao ao entrar/recarregar; abre só após importação (scrollIntoView) ou clique no cabeçalho.
            if (scrollIntoView) {
                setDistribuicaoExpandido(true);
                distribuicaoPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (err) {
            distribuicaoTotais.innerHTML = '<div class="dist-error">Erro: ' + escHtml(err.message) + '</div>';
        }
    }

    function renderDistribuicao() {
        const data = distribuicaoData;
        if (!data) return;

        const totals = data.totais || { count: 0, value: 0 };
        // O backend nao possui flag de aprovacao persistente (a propria
        // presenca em funcionario_cobranca ja significa "distribuido").
        // O botao "Aprovar" e um OK visual de revisao do usuario.
        if (distribuicaoAprovadaNaSessao) {
            distribuicaoSubtitle.textContent = 'Distribuição revisada. Ajustes manuais permanecem editáveis.';
            btnAprovarDistribuicao.disabled = false;
            btnAprovarDistribuicao.classList.add('approved');
            btnAprovarDistribuicao.innerHTML = '<i class="fa-solid fa-circle-check"></i> Revisada';
        } else {
            distribuicaoSubtitle.textContent = 'Revise a proposta e ajuste manualmente antes de aprovar.';
            btnAprovarDistribuicao.disabled = !totals.count;
            btnAprovarDistribuicao.classList.remove('approved');
            btnAprovarDistribuicao.innerHTML = '<i class="fa-solid fa-check"></i> Aprovar Distribuição';
        }
        syncSmsDistribuicaoFooterButtons();

        distribuicaoTotais.innerHTML = `
            <div class="dist-kpi total">
                <span class="dist-kpi-label"><i class="fa-solid fa-folder-open"></i> Total em Cobrança</span>
                <span class="dist-kpi-value">${fmtInt(totals.count)} contratos</span>
                <span class="dist-kpi-sub">${fmtMoney(totals.value)}</span>
            </div>
            <div class="dist-kpi critico">
                <span class="dist-kpi-label"><i class="fa-solid fa-fire"></i> Crítico</span>
                <span class="dist-kpi-value">${fmtInt(totals.critico_count)} contratos</span>
                <span class="dist-kpi-sub">${fmtMoney(totals.critico_value)}</span>
            </div>
            <div class="dist-kpi atencao">
                <span class="dist-kpi-label"><i class="fa-solid fa-triangle-exclamation"></i> Atenção</span>
                <span class="dist-kpi-value">${fmtInt(totals.atencao_count)} contratos</span>
                <span class="dist-kpi-sub">${fmtMoney(totals.atencao_value)}</span>
            </div>
            <div class="dist-kpi recente">
                <span class="dist-kpi-label"><i class="fa-solid fa-clock"></i> Recente</span>
                <span class="dist-kpi-value">${fmtInt(totals.recente_count)} contratos</span>
                <span class="dist-kpi-sub">${fmtMoney(totals.recente_value)}</span>
            </div>
        `;

        distribuicaoFuncionarios.innerHTML = '';
        const funcionarios = data.funcionarios || [];
        if (funcionarios.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'dist-empty';
            empty.innerHTML = `
                <i class="fa-solid fa-inbox"></i>
                <h4>Nenhuma distribuição registrada ainda</h4>
                <p>Assim que a próxima importação for concluída, a distribuição por funcionário de cobrança será gerada automaticamente e exibida aqui.</p>
            `;
            distribuicaoFuncionarios.appendChild(empty);
            return;
        }
        funcionarios.forEach((f, idx) => {
            distribuicaoFuncionarios.appendChild(buildFuncionarioCard(f, totals, idx));
        });
    }

    function buildFuncionarioCard(f, totals, idx) {
        const wrapper = document.createElement('div');
        wrapper.className = 'func-card collapsed';
        wrapper.setAttribute('data-color-index', String(idx % 4));

        const s = f.stats || {};
        const iniciais = (f.nome || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

        wrapper.innerHTML = `
            <div class="func-header">
                <div class="func-header-left">
                    <div class="func-avatar">${escHtml(iniciais)}</div>
                    <div>
                        <h4>${escHtml(f.nome)}</h4>
                        <span class="func-subtitle">Funcionário de Cobrança</span>
                    </div>
                </div>
                <div class="func-header-right">
                    <div class="func-badge total">${fmtInt(s.count)} <small>ctr</small></div>
                    <div class="func-badge value">${fmtMoney(s.value)}</div>
                    <div class="func-badge pct">${fmtPct(s.value, totals.value)} valor</div>
                    <button type="button" class="func-transfer-btn" title="Transferir contratos deste funcionário">
                        <i class="fa-solid fa-right-left"></i> Transferir
                    </button>
                    <i class="fa-solid fa-chevron-down func-chevron"></i>
                </div>
            </div>
            <div class="func-body">
                <div class="func-stats-grid">
                    <div class="func-stat critico">
                        <span class="label"><i class="fa-solid fa-fire"></i> Crítico</span>
                        <span class="value">${fmtInt(s.critico_count)} ctr • ${fmtMoney(s.critico_value)}</span>
                        <span class="pcts">${fmtPct(s.critico_count, totals.critico_count)} qtd • ${fmtPct(s.critico_value, totals.critico_value)} valor</span>
                    </div>
                    <div class="func-stat atencao">
                        <span class="label"><i class="fa-solid fa-triangle-exclamation"></i> Atenção</span>
                        <span class="value">${fmtInt(s.atencao_count)} ctr • ${fmtMoney(s.atencao_value)}</span>
                        <span class="pcts">${fmtPct(s.atencao_count, totals.atencao_count)} qtd • ${fmtPct(s.atencao_value, totals.atencao_value)} valor</span>
                    </div>
                    <div class="func-stat recente">
                        <span class="label"><i class="fa-solid fa-clock"></i> Recente</span>
                        <span class="value">${fmtInt(s.recente_count)} ctr • ${fmtMoney(s.recente_value)}</span>
                        <span class="pcts">${fmtPct(s.recente_count, totals.recente_count)} qtd • ${fmtPct(s.recente_value, totals.recente_value)} valor</span>
                    </div>
                </div>
                <div class="func-contracts">
                    <table class="func-table">
                        <thead>
                            <tr>
                                <th>Grupo / Cota</th>
                                <th>Devedor</th>
                                <th>Situação</th>
                                <th>Atraso</th>
                                <th>Valor</th>
                                <th>Responsável</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        const tbody = wrapper.querySelector('tbody');
        (f.contratos || []).forEach((c) => tbody.appendChild(buildContractRow(c)));

        wrapper.querySelector('.func-header').addEventListener('click', () => {
            wrapper.classList.toggle('collapsed');
        });

        const btnTransfer = wrapper.querySelector('.func-transfer-btn');
        if (btnTransfer) {
            btnTransfer.addEventListener('click', (e) => {
                e.stopPropagation();
                openTransferModal(f);
            });
        }

        return wrapper;
    }

    function buildContractRow(c) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-fc-id', c.fc_id);
        const sitKey = (c.situacao === 'atenção') ? 'atencao' : (c.situacao || '');
        tr.innerHTML = `
            <td class="bold">${escHtml(c.grupo)}/${escHtml(c.cota)}</td>
            <td>
                <div>${escHtml(c.nome_devedor || '-')}</div>
                <div class="muted">${escHtml(c.cpf_cnpj || '')}</div>
            </td>
            <td><span class="sit-badge sit-${escHtml(sitKey)}">${escHtml(c.situacao || '-')}</span></td>
            <td>${fmtInt(c.dias_atraso)}d</td>
            <td>${fmtMoney(c.valor_credito)}</td>
            <td></td>
        `;

        const tdSelect = tr.lastElementChild;
        const select = document.createElement('select');
        select.className = 'reassign-select';
        select.dataset.previous = String(c.id_funcionario ?? '');
        (distribuicaoData.funcionarios_disponiveis || []).forEach((f) => {
            const opt = document.createElement('option');
            opt.value = String(f.id);
            opt.textContent = f.nome;
            if (Number(f.id) === Number(c.id_funcionario)) opt.selected = true;
            select.appendChild(opt);
        });
        select.addEventListener('change', (e) => reassignContract(c.fc_id, e.target.value, tr));
        tdSelect.appendChild(select);

        return tr;
    }

    async function reassignContract(fcId, novoFuncionarioId, tr) {
        const select = tr.querySelector('select');
        const previous = select.dataset.previous || '';
        select.disabled = true;
        try {
            const resp = await fetch('/api/importacao/distribuicao/reassign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: Number(fcId),
                    id_funcionario: Number(novoFuncionarioId),
                }),
            });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || ('HTTP ' + resp.status));
            // Recarrega tudo para recalcular KPIs.
            distribuicaoAprovadaNaSessao = false;
            await loadDistribuicao();
        } catch (err) {
            alert('Falha ao reatribuir: ' + err.message);
            if (previous) select.value = previous;
        } finally {
            select.disabled = false;
        }
    }

    function fecharSmsAutomPreviewModal() {
        if (!smsAutomPreviewOverlay) return;
        smsAutomPreviewOverlay.classList.add('d-none');
        smsAutomPreviewOverlay.setAttribute('aria-hidden', 'true');
    }

    /** Abre o modal já na etapa de carregamento (feedback antes da resposta do preview). */
    function abrirSmsAutomPreviewCarregando() {
        if (!smsAutomPreviewOverlay || !smsAutomPreviewBody) return;
        smsAutomPreviewBody.innerHTML =
            '<div class="sms-preview-loading">' +
            '<p><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Calculando resumo…</p>' +
            '<p class="sms-preview-loading-hint">Mesmo universo da lista Excel (contratos abertos no roteiro 0, 16, 31, 61 ou 85 dias).</p>' +
            '</div>';
        [smsAutomEnvioSms, smsAutomEnvioEmail, smsAutomEnvioAmbos].forEach(function (b) {
            if (b) {
                b.disabled = true;
                b.removeAttribute('title');
            }
        });
        smsAutomPreviewOverlay.classList.remove('d-none');
        smsAutomPreviewOverlay.setAttribute('aria-hidden', 'false');
    }

    function desabilitarBotoesEnvioSmsAutom() {
        [smsAutomEnvioSms, smsAutomEnvioEmail, smsAutomEnvioAmbos].forEach(function (b) {
            if (b) {
                b.disabled = true;
                b.removeAttribute('title');
            }
        });
    }

    /** Erro no preview: mantém o modal aberto para o usuário ler e usar Fechar. */
    function mostrarSmsAutomPreviewErro(msg) {
        if (!smsAutomPreviewBody) return;
        smsAutomPreviewBody.innerHTML =
            '<div class="sms-preview-erro">' +
            '<p><strong>Não foi possível calcular o resumo.</strong></p>' +
            '<p class="sms-preview-erro-msg">' + escHtml(msg) + '</p>' +
            '<p class="sms-preview-loading-hint">Confira os logs do servidor ou use <strong>Lista SMS/E-mail</strong> para exportar o roteiro. ' +
            'Use <strong>Fechar</strong> abaixo quando terminar.</p>' +
            '</div>';
        desabilitarBotoesEnvioSmsAutom();
        syncSmsDistribuicaoFooterButtons();
    }

    /** Nenhum disparo previsto: mensagem no modal em vez de alert bloqueando a tela. */
    function mostrarSmsAutomPreviewSemEnvioPrevisto(ignoradosHoje) {
        if (!smsAutomPreviewBody) return;
        smsAutomPreviewBody.innerHTML =
            '<div class="sms-preview-erro sms-preview-erro-info">' +
            '<p><strong>Nenhum envio previsto neste momento.</strong></p>' +
            '<p class="sms-preview-loading-hint">Nenhum contrato no roteiro (0, 16, 31, 61 ou 85 dias) com telefone e/ou e-mail válidos, ' +
            'ou todos já receberam SMS ou e-mail hoje (<strong>' +
            fmtInt(ignoradosHoje) +
            '</strong> ignorados por duplicidade do dia).</p>' +
            '</div>';
        desabilitarBotoesEnvioSmsAutom();
        syncSmsDistribuicaoFooterButtons();
    }

    function abrirSmsAutomPreviewModal(pv) {
        if (!smsAutomPreviewOverlay || !smsAutomPreviewBody) return;
        lastSmsAutomPreview = pv;
        const prevSms = pv.sms_previstos != null ? pv.sms_previstos : 0;
        const prevMail = pv.emails_previstos != null ? pv.emails_previstos : 0;
        const cSms = pv.contratos_com_sms != null ? pv.contratos_com_sms : 0;
        const cMail = pv.contratos_com_email != null ? pv.contratos_com_email : 0;
        const ignHoje = pv.ignorados_ja_enviados_hoje != null ? pv.ignorados_ja_enviados_hoje : 0;
        const ignRota = pv.ignorados_sem_template != null ? pv.ignorados_sem_template : 0;
        const ignTel = pv.ignorados_sem_telefone != null ? pv.ignorados_sem_telefone : 0;
        const ignEm = pv.ignorados_sem_email != null ? pv.ignorados_sem_email : 0;
        const proc = pv.contratos_processados != null ? pv.contratos_processados : 0;
        const bloq = pv.tentativas_bloqueadas_cadastro != null ? pv.tentativas_bloqueadas_cadastro : 0;

        smsAutomPreviewBody.innerHTML =
            '<dl class="sms-preview-stats">' +
            '<dt>Contratos analisados (abertos)</dt><dd>' + fmtInt(proc) + '</dd>' +
            '<dt>Disparos SMS previstos</dt><dd>' + fmtInt(prevSms) + '</dd>' +
            '<dt>Contratos com pelo menos 1 SMS válido</dt><dd>' + fmtInt(cSms) + '</dd>' +
            '<dt>Disparos de e-mail previstos</dt><dd>' + fmtInt(prevMail) + '</dd>' +
            '<dt>Contratos com pelo menos 1 e-mail válido</dt><dd>' + fmtInt(cMail) + '</dd>' +
            '<dt>Ignorados (fora do roteiro 0/16/31/61/85)</dt><dd>' + fmtInt(ignRota) + '</dd>' +
            '<dt>Ignorados (já SMS ou e-mail hoje)</dt><dd>' + fmtInt(ignHoje) + '</dd>' +
            '<dt>Sem telefone no cadastro</dt><dd>' + fmtInt(ignTel) + '</dd>' +
            '<dt>Sem e-mail no cadastro</dt><dd>' + fmtInt(ignEm) + '</dd>' +
            '<dt>Tentativas bloqueadas (validação cadastro)</dt><dd>' + fmtInt(bloq) + '</dd>' +
            '</dl>' +
            '<p class="sms-preview-note">Mesmo texto no SMS e no e-mail (templates 1–4). O envio pode levar vários minutos. ' +
            'Use <strong>Lista SMS/E-mail</strong> para exportar o roteiro em Excel. Escolha abaixo apenas SMS, apenas e-mail ou ambos.</p>';

        if (smsAutomEnvioSms) {
            smsAutomEnvioSms.disabled = prevSms < 1;
            smsAutomEnvioSms.title = prevSms < 1 ? 'Nenhum SMS previsto neste momento.' : '';
        }
        if (smsAutomEnvioEmail) {
            smsAutomEnvioEmail.disabled = prevMail < 1;
            smsAutomEnvioEmail.title = prevMail < 1 ? 'Nenhum e-mail previsto neste momento.' : '';
        }
        if (smsAutomEnvioAmbos) {
            smsAutomEnvioAmbos.disabled = prevSms < 1 && prevMail < 1;
            smsAutomEnvioAmbos.title =
                prevSms < 1 && prevMail < 1 ? 'Nenhum canal previsto.' : 'Dispara SMS e e-mail no mesmo processamento.';
        }

        smsAutomPreviewOverlay.classList.remove('d-none');
        smsAutomPreviewOverlay.setAttribute('aria-hidden', 'false');
    }

    async function executarSmsAutomatizadosDistribuicao(canais) {
        const footerEnvioBtns = smsAutomPreviewOverlay
            ? smsAutomPreviewOverlay.querySelectorAll('.sms-autom-envio-btn')
            : [];
        footerEnvioBtns.forEach(function (b) {
            b.disabled = true;
        });
        try {
            const resp = await fetch('/api/importacao/distribuicao/sms-automatizados', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ canais: canais }),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data.error) {
                throw new Error(data.error || ('HTTP ' + resp.status));
            }
            const lines = [
                'Envio automático concluído.',
                'Canais: ' + (Array.isArray(data.canais) ? data.canais.join(', ') : 'sms, email'),
                'Total de envios (SMS + e-mail): ' + (data.enviados != null ? data.enviados : 0),
                '  SMS: ' + (data.envios_sms != null ? data.envios_sms : 0),
                '  E-mail: ' + (data.envios_email != null ? data.envios_email : 0),
                'Falhas: ' + (data.falhas != null ? data.falhas : 0),
                'Ignorados (fora do roteiro de dias): ' + (data.ignorados_sem_template != null ? data.ignorados_sem_template : 0),
                'Ignorados (sem telefone no contrato): ' + (data.ignorados_sem_telefone != null ? data.ignorados_sem_telefone : 0),
                'Ignorados (sem e-mail no cadastro): ' + (data.ignorados_sem_email != null ? data.ignorados_sem_email : 0),
                'Ignorados (já havia SMS ou e-mail hoje): ' + (data.ignorados_ja_enviados_hoje != null ? data.ignorados_ja_enviados_hoje : 0),
                'Contratos analisados: ' + (data.contratos_processados != null ? data.contratos_processados : 0),
            ];
            if (data.erros_amostra && data.erros_amostra.length) {
                lines.push('', 'Amostra de erros (máx. 20):');
                data.erros_amostra.forEach(function (e) {
                    var extra = '';
                    if (e.detalhe != null && e.detalhe !== '') {
                        extra =
                            typeof e.detalhe === 'object'
                                ? ' | ' + JSON.stringify(e.detalhe).slice(0, 400)
                                : ' | ' + String(e.detalhe).slice(0, 400);
                    }
                    lines.push('- contrato ' + (e.id_contrato || '?') + ': ' + (e.erro || '') + extra);
                });
            }
            alert(lines.join('\n'));
            fecharSmsAutomPreviewModal();
        } catch (err) {
            alert('Falha no envio em lote: ' + (err.message || err));
        } finally {
            footerEnvioBtns.forEach(function (b) {
                b.disabled = false;
            });
            if (lastSmsAutomPreview) {
                const ps = lastSmsAutomPreview.sms_previstos != null ? lastSmsAutomPreview.sms_previstos : 0;
                const pe = lastSmsAutomPreview.emails_previstos != null ? lastSmsAutomPreview.emails_previstos : 0;
                if (smsAutomEnvioSms) smsAutomEnvioSms.disabled = ps < 1;
                if (smsAutomEnvioEmail) smsAutomEnvioEmail.disabled = pe < 1;
                if (smsAutomEnvioAmbos) smsAutomEnvioAmbos.disabled = ps < 1 && pe < 1;
            }
        }
    }

    async function smsAutomatizadosDistribuicao() {
        const prevHtml = btnSmsAutomatizadosDistribuicao.innerHTML;
        btnSmsAutomatizadosDistribuicao.disabled = true;
        if (btnSmsAutomatizadosExcel) btnSmsAutomatizadosExcel.disabled = true;
        btnSmsAutomatizadosDistribuicao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculando...';
        let ignoradosHoje = 0;
        const modalOk = !!(smsAutomPreviewOverlay && smsAutomPreviewBody);
        if (modalOk) {
            abrirSmsAutomPreviewCarregando();
        }
        try {
            const respPv = await fetch('/api/importacao/distribuicao/sms-automatizados/preview', {
                credentials: 'same-origin',
            });
            const rawText = await respPv.text();
            let pv = {};
            try {
                pv = rawText ? JSON.parse(rawText) : {};
            } catch (parseErr) {
                const m =
                    'Resposta inválida do servidor (HTTP ' +
                    respPv.status +
                    '). Verifique os logs do servidor.';
                if (modalOk) {
                    mostrarSmsAutomPreviewErro(m);
                } else {
                    alert(m);
                }
                return;
            }
            if (!respPv.ok || pv.error) {
                const m = pv.error || 'Erro HTTP ' + respPv.status;
                if (modalOk) {
                    mostrarSmsAutomPreviewErro(m);
                } else {
                    alert(m);
                }
                return;
            }
            const previstoSms = pv.sms_previstos != null ? pv.sms_previstos : 0;
            const previstoEmail = pv.emails_previstos != null ? pv.emails_previstos : 0;
            ignoradosHoje = pv.ignorados_ja_enviados_hoje != null ? pv.ignorados_ja_enviados_hoje : 0;

            if (previstoSms === 0 && previstoEmail === 0) {
                if (modalOk) {
                    mostrarSmsAutomPreviewSemEnvioPrevisto(ignoradosHoje);
                } else {
                    alert(
                        'Nenhum envio previsto no momento: nenhum contrato aberto no roteiro (diferença 0, 16, 31, 61 ou 85 dias ' +
                            'entre hoje e o vencimento mais antigo das parcelas em aberto) com telefone e/ou e-mail válidos após validação, ' +
                            'ou todos já tiveram SMS ou e-mail registrados hoje (' +
                            ignoradosHoje +
                            ' ignorados por duplicidade do dia).'
                    );
                }
                return;
            }

            abrirSmsAutomPreviewModal(pv);
        } catch (e) {
            if (modalOk) {
                mostrarSmsAutomPreviewErro(e.message || String(e));
            } else {
                alert('Não foi possível calcular o preview de SMS/e-mail: ' + (e.message || e));
            }
        } finally {
            btnSmsAutomatizadosDistribuicao.innerHTML = prevHtml;
            syncSmsDistribuicaoFooterButtons();
        }
    }

    if (smsAutomPreviewFechar) {
        smsAutomPreviewFechar.addEventListener('click', fecharSmsAutomPreviewModal);
    }
    if (smsAutomPreviewFecharX) {
        smsAutomPreviewFecharX.addEventListener('click', fecharSmsAutomPreviewModal);
    }
    if (smsAutomPreviewOverlay) {
        smsAutomPreviewOverlay.addEventListener('click', function (e) {
            if (e.target === smsAutomPreviewOverlay) fecharSmsAutomPreviewModal();
        });
    }
    if (smsAutomEnvioSms) {
        smsAutomEnvioSms.addEventListener('click', function () {
            executarSmsAutomatizadosDistribuicao(['sms']);
        });
    }
    if (smsAutomEnvioEmail) {
        smsAutomEnvioEmail.addEventListener('click', function () {
            executarSmsAutomatizadosDistribuicao(['email']);
        });
    }
    if (smsAutomEnvioAmbos) {
        smsAutomEnvioAmbos.addEventListener('click', function () {
            executarSmsAutomatizadosDistribuicao(['sms', 'email']);
        });
    }

    async function downloadSmsAutomatizadosExcel() {
        if (!btnSmsAutomatizadosExcel || btnSmsAutomatizadosExcel.disabled) return;
        const prevHtml = btnSmsAutomatizadosExcel.innerHTML;
        btnSmsAutomatizadosExcel.disabled = true;
        if (btnSmsAutomatizadosDistribuicao) btnSmsAutomatizadosDistribuicao.disabled = true;
        btnSmsAutomatizadosExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
        try {
            const resp = await fetch('/api/importacao/distribuicao/sms-automatizados/excel', {
                credentials: 'same-origin',
            });
            if (!resp.ok) {
                let msg = 'HTTP ' + resp.status;
                try {
                    const errJson = await resp.json();
                    if (errJson.error) msg = errJson.error;
                } catch (e2) { /* ignore */ }
                throw new Error(msg);
            }
            const blob = await resp.blob();
            const cd = resp.headers.get('Content-Disposition');
            let fname = 'sms_email_automatizados_distribuicao.xlsx';
            if (cd) {
                const m = /filename\*?=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
                if (m) fname = decodeURIComponent(m[1].replace(/['"]/g, '').trim());
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Não foi possível baixar a lista Excel: ' + (err.message || err));
        } finally {
            btnSmsAutomatizadosExcel.innerHTML = prevHtml;
            syncSmsDistribuicaoFooterButtons();
        }
    }

    async function aprovarDistribuicao() {
        if (!confirm('Confirmar a distribuição atual?')) return;
        btnAprovarDistribuicao.disabled = true;
        btnAprovarDistribuicao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...';
        try {
            const resp = await fetch('/api/importacao/distribuicao/aprovar', { method: 'POST' });
            const data = await resp.json();
            if (!resp.ok || data.error) throw new Error(data.error || ('HTTP ' + resp.status));
            distribuicaoAprovadaNaSessao = true;
            renderDistribuicao();
        } catch (err) {
            alert('Falha ao aprovar: ' + err.message);
            btnAprovarDistribuicao.disabled = false;
            btnAprovarDistribuicao.innerHTML = '<i class="fa-solid fa-check"></i> Aprovar Distribuição';
        }
    }

    if (btnAprovarDistribuicao) btnAprovarDistribuicao.addEventListener('click', aprovarDistribuicao);
    if (btnSmsAutomatizadosDistribuicao) {
        btnSmsAutomatizadosDistribuicao.addEventListener('click', smsAutomatizadosDistribuicao);
    }
    if (btnSmsAutomatizadosExcel) {
        btnSmsAutomatizadosExcel.addEventListener('click', downloadSmsAutomatizadosExcel);
    }
    if (btnRecarregarDistribuicao) btnRecarregarDistribuicao.addEventListener('click', () => loadDistribuicao(false));
    if (btnRestaurarDistribuicao) btnRestaurarDistribuicao.addEventListener('click', restaurarDistribuicao);

    (function setupNegPosEscolhaModal() {
        if (!negPosEscolhaModal) return;
        function fecharNegPosModal() {
            negPosEscolhaModal.classList.add('d-none');
        }
        function abrirNegPosModal() {
            negPosEscolhaModal.classList.remove('d-none');
        }
        if (btnNegPosDistribuicao) {
            btnNegPosDistribuicao.addEventListener('click', abrirNegPosModal);
        }
        var fecharBtn = document.getElementById('negPosEscolhaFechar');
        var cancelarBtn = document.getElementById('negPosEscolhaCancelar');
        var btnTodos = document.getElementById('negPosEscolhaTodos');
        if (fecharBtn) fecharBtn.addEventListener('click', fecharNegPosModal);
        if (cancelarBtn) cancelarBtn.addEventListener('click', fecharNegPosModal);
        negPosEscolhaModal.addEventListener('click', function (e) {
            if (e.target === negPosEscolhaModal) fecharNegPosModal();
        });
        if (btnTodos) {
            btnTodos.addEventListener('click', function () {
                fecharNegPosModal();
                window.location.href = '/negativacao?carteira=1&pesquisar=1';
            });
        }
        async function downloadNegPosDistribuicaoExcel() {
            if (!btnNegPosListaExcel || btnNegPosListaExcel.disabled) return;
            const prevHtml = btnNegPosListaExcel.innerHTML;
            btnNegPosListaExcel.disabled = true;
            if (btnTodos) btnTodos.disabled = true;
            btnNegPosListaExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
            try {
                const resp = await fetch(
                    '/api/importacao/distribuicao/negativacao-positivacao/excel',
                    { credentials: 'same-origin' },
                );
                if (!resp.ok) {
                    let msg = 'HTTP ' + resp.status;
                    try {
                        const errJson = await resp.json();
                        if (errJson.error) msg = errJson.error;
                    } catch (e2) { /* ignore */ }
                    throw new Error(msg);
                }
                const blob = await resp.blob();
                const cd = resp.headers.get('Content-Disposition');
                let fname = 'negativacao_positivacao_distribuicao.xlsx';
                if (cd) {
                    const m = /filename\*?=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
                    if (m) fname = decodeURIComponent(m[1].replace(/['"]/g, '').trim());
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fname;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                fecharNegPosModal();
            } catch (err) {
                alert('Não foi possível baixar o Excel: ' + (err.message || err));
            } finally {
                btnNegPosListaExcel.innerHTML = prevHtml;
                if (btnTodos) btnTodos.disabled = false;
                syncSmsDistribuicaoFooterButtons();
            }
        }
        if (btnNegPosListaExcel) {
            btnNegPosListaExcel.addEventListener('click', downloadNegPosDistribuicaoExcel);
        }
    }());

    async function restaurarDistribuicao() {
        const msg = 'Restaurar a distribuição inicial da importação?\n\n' +
                    'Todas as transferências feitas (individuais ou em lote) serão desfeitas e ' +
                    'os contratos voltarão para o funcionário designado pelo algoritmo de balanceamento original.\n\n' +
                    'Deseja continuar?';
        if (!confirm(msg)) return;

        const originalHTML = btnRestaurarDistribuicao.innerHTML;
        btnRestaurarDistribuicao.disabled = true;
        btnRestaurarDistribuicao.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Restaurando...';
        if (btnRecarregarDistribuicao) btnRecarregarDistribuicao.disabled = true;
        if (btnAprovarDistribuicao) btnAprovarDistribuicao.disabled = true;
        if (btnSmsAutomatizadosDistribuicao) btnSmsAutomatizadosDistribuicao.disabled = true;
        if (btnSmsAutomatizadosExcel) btnSmsAutomatizadosExcel.disabled = true;
        if (btnNegPosDistribuicao) btnNegPosDistribuicao.disabled = true;
        if (btnNegPosListaExcel) btnNegPosListaExcel.disabled = true;

        try {
            const resp = await fetch('/api/importacao/distribuicao/restaurar', { method: 'POST' });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data.error) {
                throw new Error(data.error || ('HTTP ' + resp.status));
            }
            distribuicaoAprovadaNaSessao = false;
            await loadDistribuicao(false);
            if (data.restauracao_ok === false) {
                alert('A restauração concluiu, mas o script de distribuição retornou código ' +
                      data.returncode + '. Verifique os logs do servidor.');
            }
        } catch (err) {
            alert('Falha ao restaurar a distribuição: ' + (err.message || err));
        } finally {
            btnRestaurarDistribuicao.disabled = false;
            btnRestaurarDistribuicao.innerHTML = originalHTML;
            if (btnRecarregarDistribuicao) btnRecarregarDistribuicao.disabled = false;
        }
    }

    // =====================================================================
    // Modal de Transferencia de contratos
    // =====================================================================
    const transferModal = document.getElementById('transferModal');
    const transferModalTitle = document.getElementById('transferModalTitle');
    const transferModalSub = document.getElementById('transferModalSub');
    const transferDestinoWrap = document.getElementById('transferDestinoWrap');
    const transferDestinoSelect = document.getElementById('transferDestinoSelect');
    const transferClose = document.getElementById('transferClose');
    const transferCancelar = document.getElementById('transferCancelar');
    const transferConfirmar = document.getElementById('transferConfirmar');

    let transferOrigem = null; // { id, nome, stats: {...} }

    function openTransferModal(func) {
        if (!transferModal) return;
        transferOrigem = func;
        const s = func.stats || {};
        const countCtr = fmtInt(s.count);
        const valor = fmtMoney(s.value);

        transferModalTitle.innerHTML =
            '<i class="fa-solid fa-right-left"></i> Transferir contratos de ' + escHtml(func.nome);
        transferModalSub.innerHTML =
            `<strong>${countCtr}</strong> contratos (${valor}) serão movidos para outro(s) funcionário(s).`;

        // Popula select com TODOS os outros funcionarios (ativos ou nao),
        // exceto a propria origem.
        transferDestinoSelect.innerHTML = '';
        const disponiveis = (distribuicaoData && distribuicaoData.funcionarios_disponiveis) || [];
        const outros = disponiveis.filter(d => Number(d.id) !== Number(func.id));
        if (outros.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Nenhum outro funcionário disponível';
            opt.disabled = true;
            opt.selected = true;
            transferDestinoSelect.appendChild(opt);
        } else {
            outros.forEach((f) => {
                const opt = document.createElement('option');
                opt.value = String(f.id);
                opt.textContent = f.nome;
                transferDestinoSelect.appendChild(opt);
            });
        }

        // Restaura estado dos radios.
        const radios = transferModal.querySelectorAll('input[name="transferModo"]');
        radios.forEach(r => { r.checked = r.value === 'especifico'; });
        applyTransferModo('especifico');

        transferConfirmar.disabled = !s.count || outros.length === 0;
        transferConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar transferência';

        transferModal.classList.remove('d-none');
        document.body.style.overflow = 'hidden';
    }

    function closeTransferModal() {
        if (!transferModal) return;
        transferModal.classList.add('d-none');
        document.body.style.overflow = '';
        transferOrigem = null;
    }

    function applyTransferModo(modo) {
        if (!transferDestinoWrap) return;
        transferDestinoWrap.classList.toggle('d-none', modo !== 'especifico');
    }

    if (transferModal) {
        transferModal.querySelectorAll('input[name="transferModo"]').forEach((radio) => {
            radio.addEventListener('change', (e) => applyTransferModo(e.target.value));
        });
        if (transferClose) transferClose.addEventListener('click', closeTransferModal);
        if (transferCancelar) transferCancelar.addEventListener('click', closeTransferModal);
        transferModal.addEventListener('click', (e) => {
            if (e.target === transferModal) closeTransferModal();
        });
        if (transferConfirmar) {
            transferConfirmar.addEventListener('click', confirmarTransferencia);
        }
    }

    async function confirmarTransferencia() {
        if (!transferOrigem) return;
        const modoEl = transferModal.querySelector('input[name="transferModo"]:checked');
        const modo = modoEl ? modoEl.value : 'especifico';

        const payload = {
            id_origem: Number(transferOrigem.id),
            modo: modo,
        };

        let mensagem = '';
        if (modo === 'especifico') {
            const destinoVal = transferDestinoSelect.value;
            if (!destinoVal) {
                alert('Selecione um funcionário de destino.');
                return;
            }
            payload.id_destino = Number(destinoVal);
            const destinoTxt = transferDestinoSelect.options[transferDestinoSelect.selectedIndex].textContent;
            mensagem = 'Confirmar transferência de TODOS os contratos de "'
                + transferOrigem.nome + '" para "' + destinoTxt + '"?';
        } else {
            mensagem = 'Redistribuir igualitariamente os contratos de "'
                + transferOrigem.nome + '" entre os demais funcionários?';
        }
        if (!confirm(mensagem)) return;

        transferConfirmar.disabled = true;
        transferConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Transferindo...';

        try {
            const resp = await fetch('/api/importacao/distribuicao/transferir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await resp.json();
            if (!resp.ok || data.error) {
                throw new Error(data.error || ('HTTP ' + resp.status));
            }

            let detalhe = (data.transferidos || 0) + ' contrato(s) transferidos.';
            if (modo === 'igualitaria' && Array.isArray(data.por_destino) && data.por_destino.length) {
                const linhas = data.por_destino
                    .filter(d => d.count > 0)
                    .map(d => '• ' + d.nome + ': ' + fmtInt(d.count) + ' ctr (' + fmtMoney(d.value) + ')')
                    .join('\n');
                if (linhas) detalhe += '\n\nDistribuição:\n' + linhas;
            }
            alert('Transferência concluída!\n\n' + detalhe);

            closeTransferModal();
            distribuicaoAprovadaNaSessao = false;
            await loadDistribuicao(false);
        } catch (err) {
            alert('Falha na transferência: ' + err.message);
            transferConfirmar.disabled = false;
            transferConfirmar.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar transferência';
        }
    }

    // Carrega a distribuicao atual assim que a pagina abre, mostrando o
    // estado vigente da tabela funcionario_cobranca (ou o empty-state).
    loadDistribuicao(false);

});
