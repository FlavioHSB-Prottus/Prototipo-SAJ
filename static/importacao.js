document.addEventListener('DOMContentLoaded', () => {

    const dropZone = document.getElementById('dropZone');
    const dropContent = document.getElementById('dropContent');
    const fileLoadedState = document.getElementById('fileLoadedState');
    const fileInput = document.getElementById('fileInput');
    const btnProcessar = document.getElementById('btnProcessar');
    const processingPanel = document.getElementById('processingPanel');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressStatusText = document.getElementById('progressStatusText');
    const terminalBody = document.getElementById('terminalBody');

    // 1. Simulação do Upload clicando no container
    dropZone.addEventListener('click', () => {
        // Como é um wireframe/protótipo, assumimos sempre um clique como sucesso selecionado
        dropContent.classList.add('d-none');
        fileLoadedState.classList.remove('d-none');
        dropZone.style.backgroundColor = '#f0fdf4'; // Fundo levemente verde
        dropZone.style.borderColor = '#4ade80';

        // Habilita Botão de Processo
        btnProcessar.classList.remove('disabled');
        btnProcessar.removeAttribute('disabled');
    });

    // 2. Simulação de Análise ao Clicar em Processar
    btnProcessar.addEventListener('click', () => {
        // Desabilia o botão durante execução
        btnProcessar.classList.add('disabled');
        btnProcessar.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processando Lote...`;

        // Revela o painel do Terminal e Barra CSS
        processingPanel.classList.remove('d-none');

        simulateProcessing();
    });

    // Arrays contendo os logs falsos com tempo de delaya para dar impressão de processamento
    const mockLogs = [
        { text: "> [SYSTEM] Iniciando Job Scheduler e extração...", classes: "log-line log-info", progress: 5, delay: 500 },
        { text: "> [INFO] Lendo o arquivo 'safra_dia_16.txt'...", classes: "log-line log-info", progress: 15, delay: 1500 },
        { text: "> [INFO] Normalizando 420 chaves de contratos...", classes: "log-line log-info", progress: 30, delay: 2000 },
        { text: "> [INFO] Conectando ao Banco MariaDB e Comparando base histórica...", classes: "log-line log-info", progress: 45, delay: 3500 },
        { text: "> [UPDATE] Contrato 4599-2 passou de Aberto para Pago.", classes: "log-line log-update", progress: 60, delay: 4500 },
        { text: "> [UPDATE] Limpando flag de restrição do Avalista Joaozinho Silva.", classes: "log-line log-update", progress: 65, delay: 5000 },
        { text: "> [ALERT] Contrato 1022-8 atingiu limite de 90 dias. Status atualizado para Indenizado.", classes: "log-line log-alert", progress: 85, delay: 6500 },
        { text: "> [SYSTEM] Consolidação realizada. Salvando metadados...", classes: "log-line log-info", progress: 95, delay: 7500 },
        { text: "> [SUCCESS] Processamento concluído. 142 contratos lidos, 3 atualizados.", classes: "log-line log-success", progress: 100, delay: 8500 }
    ];

    function simulateProcessing() {
        // Iniciar loop e injetar texto baseado no tempo (delay)
        terminalBody.innerHTML = ''; // Limpa logs anteriores

        mockLogs.forEach((log, index) => {
            setTimeout(() => {
                
                // 1. Cria a tag e escreve o log na tela
                const p = document.createElement('p');
                p.className = log.classes;
                p.textContent = log.text;
                terminalBody.appendChild(p);

                // Força o scroll pro final acompanhando novos logs
                terminalBody.scrollTop = terminalBody.scrollHeight;

                // 2. Atualiza barra e numero percentual visual
                progressBarFill.style.width = log.progress + '%';
                progressPercentage.textContent = log.progress + '%';

                // Finalizações visuais (se completou)
                if (log.progress === 100) {
                    progressStatusText.textContent = "Processamento Concluído com Sucesso!";
                    progressStatusText.style.color = "#10b981"; // Title turns green
                    btnProcessar.innerHTML = `<i class="fa-solid fa-check-double"></i> Tarefa Finalizada`;
                }

            }, log.delay);
        });
    }

});
