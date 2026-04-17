document.addEventListener('DOMContentLoaded', () => {

    const dropZone = document.getElementById('dropZone');
    const dropContent = document.getElementById('dropContent');
    const fileLoadedState = document.getElementById('fileLoadedState');
    const fileInput = document.getElementById('fileInput');
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

    function showSelectedFiles(files) {
        selectedFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.txt'));
        if (selectedFiles.length === 0) return;

        const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

        if (selectedFiles.length === 1) {
            fileNameDisplay.textContent = selectedFiles[0].name;
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

    // Click na drop zone abre o seletor de arquivos
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            showSelectedFiles(e.target.files);
        }
    });

    // Drag and drop real
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            showSelectedFiles(e.dataTransfer.files);
        }
    });

    // Processar: upload + SSE
    btnProcessar.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        btnProcessar.classList.add('disabled');
        btnProcessar.setAttribute('disabled', 'true');
        btnProcessar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Enviando arquivos...';

        processingPanel.classList.remove('d-none');
        terminalBody.innerHTML = '';
        progressBarFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        progressStatusText.textContent = 'Enviando arquivos ao servidor...';
        progressStatusText.style.color = '';

        const formData = new FormData();
        selectedFiles.forEach(f => formData.append('files', f));

        try {
            const uploadResp = await fetch('/api/upload', { method: 'POST', body: formData });
            const uploadData = await uploadResp.json();

            if (!uploadResp.ok || uploadData.error) {
                addLog('> [ERRO] ' + (uploadData.error || 'Falha no upload'), 'alert');
                resetButton();
                return;
            }

            addLog('> [SYSTEM] ' + uploadData.files.length + ' arquivo(s) enviados ao servidor com sucesso.', 'success');

            btnProcessar.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processando Lote...';
            startSSE(uploadData.temp_dir);

        } catch (err) {
            addLog('> [ERRO] Falha na comunicacao com o servidor: ' + err.message, 'alert');
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
        progressBarFill.style.width = value + '%';
        progressPercentage.textContent = value + '%';
    }

    function resetButton() {
        btnProcessar.classList.remove('disabled');
        btnProcessar.removeAttribute('disabled');
        btnProcessar.innerHTML = '<i class="fa-solid fa-gears"></i> Iniciar Processamento e Classificação';
    }

});
