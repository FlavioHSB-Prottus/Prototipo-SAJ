/* ==========================================================================
 * Tutoriais do sistema SAJ - passo a passo por modulo.
 *
 * Para adicionar/editar um tutorial, mexa no array TUTORIAIS abaixo.
 * Ordem alinhada ao menu lateral (layout) na visao completa do sistema.
 * Alguns modulos aparecem no menu apenas para certos perfis (gestor/admin).
 * ========================================================================== */

const TUTORIAIS = [
    {
        id: "importacao",
        nome: "Importação e Distribuição",
        icone: "fa-solid fa-file-import",
        cor: "#3b82f6",
        bg: "#eff6ff",
        rota: "/importacao",
        descricaoCurta:
            "Suba TXT da GM (varios arquivos ou pasta), processe e distribua a carteira entre cobradores.",
        paraQueServe:
            "É a porta de entrada dos dados: você envia os retornos TXT da GM, o sistema classifica e grava contratos, parcelas e pessoas. Depois revisa a distribuição automática entre funcionários de cobrança, pode usar SMS e e-mail automáticos (mesmo critério e texto) na faixa de dias definida pelo produto, exportar lista para Excel e só então aprovar para liberar a carteira.",
        passos: [
            {
                titulo: "Enviar arquivos ou uma pasta inteira",
                texto:
                    "Arraste um ou vários .txt para a área de upload ou use \"Arquivos TXT\". Para varrer subpastas, use \"Pasta com TXT\" — o sistema inclui todos os .txt encontrados. Depois clique em \"Iniciar Processamento e Classificação\".",
                icone: "fa-solid fa-cloud-arrow-up",
            },
            {
                titulo: "Acompanhar processamento em tempo real",
                texto:
                    "Logs aparecem na sequência (leitura, gravação de cadastros, contratos e parcelas). Aguarde concluir antes de revisar a distribuição.",
                icone: "fa-solid fa-gauge-high",
            },
            {
                titulo: "Abrir o painel de distribuição",
                texto:
                    "O bloco \"Distribuição por Funcionário de Cobrança\" fica disponível após o fluxo; expanda-o para ver totais por funcionário e criticidade (Crítico, Atenção, Recente). Use \"Recarregar\" só para reler do banco ou \"Restaurar Inicial\" para desfazer transferências da sessão.",
                icone: "fa-solid fa-users-gear",
            },
            {
                titulo: "SMS/E-mail e Negativação/Positivação",
                texto:
                    "\"Lista SMS/E-mail\" gera Excel com abas separadas: só contratos com telefone válido na folha SMS e só com e-mail válido na folha E-mail (quantidades podem diferir), mais coluna SMS e e-mail? (Sim/Não). \"SMS/E-mail Automáticos\" dispara pelo MessageCenter; duplicados no dia são ignorados. \"Negativação/Positivação\" abre o módulo na carteira com todos os operadores.",
                icone: "fa-solid fa-comment-sms",
            },
            {
                titulo: "Transferir e aprovar",
                texto:
                    "Use \"Transferir\" no cartão do funcionário para mover contratos para outro cobrador ou redistribuir. Quando estiver correto, clique em \"Aprovar Distribuição\" para que os contratos apareçam na Cobrança.",
                icone: "fa-solid fa-circle-check",
            },
        ],
    },
    {
        id: "cobranca",
        nome: "Cobrança",
        icone: "fa-solid fa-hand-holding-dollar",
        cor: "#10b981",
        bg: "#ecfdf5",
        rota: "/cobranca",
        descricaoCurta:
            "Carteira por operador, busca integrada, Kanban e SMS/E-mail em massa no rodapé.",
        paraQueServe:
            "É o dia a dia do cobrador: visualizar contratos em cobrança por operador, priorizar por faixa de atraso, registrar tramitações no detalhe do contrato e usar o rodapé para SMS/E-mail (resumo antes de confirmar). Os disparos em lote seguem o mesmo roteiro de dias da distribuição e ignoram contratos que já tiveram SMS ou e-mail no dia.",
        passos: [
            {
                titulo: "Filtrar por operador",
                texto:
                    "No topo, escolha o operador em \"Operador:\" (ou \"Todos os Operadores\" para visão gerencial).",
                icone: "fa-solid fa-user-tie",
            },
            {
                titulo: "Buscar na carteira",
                texto:
                    "Use a barra de pesquisa: tipo \"Todos os campos\", CPF/CNPJ, Nome, Grupo & Cota ou Bem. Limpe com o X quando precisar voltar à lista inteira.",
                icone: "fa-solid fa-magnifying-glass",
            },
            {
                titulo: "Alternar Analítico e Kanban",
                texto:
                    "\"Analítico\" agrupa contratos em blocos por criticidade; \"Kanban\" organiza em colunas de estágio. O botão \"Parcelas Desordenadas\" destaca contratos com inconsistência de ordem de parcelas.",
                icone: "fa-solid fa-table-columns",
            },
            {
                titulo: "Abrir detalhe e tramitar",
                texto:
                    "Clique no cartão para o modal com devedor, avalista, parcelas, contatos e histórico. Registre ligações, WhatsApp ou e-mail como tramitação.",
                icone: "fa-solid fa-folder-open",
            },
            {
                titulo: "Ações em massa no rodapé",
                texto:
                    "\"SMS / E-mail\" abre um pop-up (mesmo estilo da Importação) com resumo do preview (`/api/cobranca/sms-email/preview`) e opções de enviar só SMS, só e-mail ou ambos. Os blocos Crítico/Atenção/Recente mantêm só o botão Ligar em lote.",
                icone: "fa-solid fa-bolt",
            },
        ],
    },
    {
        id: "busca",
        nome: "Busca por Contratos",
        icone: "fa-solid fa-magnifying-glass",
        cor: "#8b5cf6",
        bg: "#f5f3ff",
        rota: "/busca",
        descricaoCurta:
            "Pesquise por pessoa (nome/CPF), grupo/cota ou bem; filtre por status e exporte a lista.",
        paraQueServe:
            "Localização rápida no cadastro importado: consorciado ou documento, contrato por grupo/cota ou busca estruturada por campos do bem. Os resultados aparecem em tabela; você abre o mesmo modal de detalhes usado na Cobrança.",
        passos: [
            {
                titulo: "Escolher o tipo de busca",
                texto:
                    "Em \"Tipo de Busca\": \"Nome ou CPF/CNPJ\", \"Grupo / Cota\" ou \"Bem / Descrição\". No modo bem, preencha os campos exibidos — só entram contratos que atendem a todos os campos preenchidos.",
                icone: "fa-solid fa-sliders",
            },
            {
                titulo: "Status do contrato",
                texto:
                    "Use \"Status\" para limitar a Aberto, Fechado ou Indenizado, ou deixe \"Todos\".",
                icone: "fa-solid fa-filter",
            },
            {
                titulo: "Pesquisar e revisar a tabela",
                texto:
                    "Clique em \"Pesquisar\". A grade mostra os dados principais; ordene ou exporte quando disponível.",
                icone: "fa-solid fa-table",
            },
            {
                titulo: "Exportar e abrir detalhes",
                texto:
                    "\"Exportar lista (Excel)\" gera a visão atual. Clique na linha/ação de detalhes para ver parcelas, contatos e tramitações.",
                icone: "fa-solid fa-file-excel",
            },
        ],
    },
    {
        id: "negativacao",
        nome: "Negativações",
        icone: "fa-solid fa-ban",
        cor: "#dc2626",
        bg: "#fef2f2",
        rota: "/negativacao",
        descricaoCurta:
            "Acompanhe negativação e positivação: visão geral ou só a carteira de cobrança.",
        paraQueServe:
            "Central para consultar histórico de negativação/positivação, filtrar por tipo de evento e status na parcela ativa, e executar ações unitárias ou em lote. A visão \"Carteira Cobrança\" replica o recorte do painel de Cobrança (último snapshot GM), com operador e datas de referência.",
        passos: [
            {
                titulo: "Escolher Geral ou Carteira Cobrança",
                texto:
                    "Em \"Visão\", \"Geral\" usa filtros amplos (inclui intervalo de datas início). \"Carteira Cobrança\" foca nos contratos do painel de cobrança e permite escolher operador e data fim.",
                icone: "fa-solid fa-eye",
            },
            {
                titulo: "Montar filtros de busca",
                texto:
                    "Tipo: grupo/cota/número ou texto no histórico. \"Tipo de ocorrência\" restringe negativados, positivados, observações etc. \"Status na parcela ativa\" filtra a lista de parcelas com negativação ativa.",
                icone: "fa-solid fa-filter",
            },
            {
                titulo: "Parcelas ativas e painéis",
                texto:
                    "Os resultados separam parcelas com negativação ativa (com totais na visão carteira) e painéis recolhíveis para filas de negativação e histórico positivados.",
                icone: "fa-solid fa-layer-group",
            },
            {
                titulo: "Ações por linha ou em lote",
                texto:
                    "Use os botões de positivar/negativar conforme a regra do escritório. Na visão geral há ações em massa nos cabeçalhos dos painéis quando aplicável.",
                icone: "fa-solid fa-scale-balanced",
            },
        ],
    },
    {
        id: "pasta_virtual",
        nome: "Pasta Virtual",
        icone: "fa-solid fa-folder-open",
        cor: "#0d9488",
        bg: "#f0fdfa",
        rota: "/pasta-virtual",
        descricaoCurta:
            "Anexe e organize arquivos por contrato e funcionário, com consulta e download.",
        paraQueServe:
            "Repositório de documentos ligados à cobrança: cada registro associa contrato, devedor e responsável. Serve para protocolar comprovantes, cartas ou PDFs sem sair do sistema.",
        passos: [
            {
                titulo: "Filtrar a lista",
                texto:
                    "Informe grupo/cota (ou parte) e, se quiser, restrinja ao funcionário. \"Filtrar\" atualiza a tabela.",
                icone: "fa-solid fa-filter",
            },
            {
                titulo: "Novo registro",
                texto:
                    "Em \"Novo registro\", informe os dados solicitados e o arquivo. Campos extras podem aparecer conforme configuração da tabela no banco.",
                icone: "fa-solid fa-plus",
            },
            {
                titulo: "Baixar ou revisar",
                texto:
                    "Na grade, use as ações para baixar o arquivo ou revisar descrição e metadados.",
                icone: "fa-solid fa-download",
            },
        ],
    },
    {
        id: "relatorios",
        nome: "Relatórios",
        icone: "fa-solid fa-file-invoice",
        cor: "#f59e0b",
        bg: "#fffbeb",
        rota: "/relatorios",
        descricaoCurta:
            "Contratos abertos, pagos, parciais, indenizados, novos e que voltaram — visualize ou exporte Excel/PDF.",
        paraQueServe:
            "Extrai listagens gerenciais com filtros de período e prioridade (faixas de atraso), alinhadas às regras de cada tipo de relatório. Ideal para auditoria e envio ao cliente.",
        passos: [
            {
                titulo: "Tipo de contrato",
                texto:
                    "Selecione entre Contratos Abertos, Pagos/Fechados, Pagos parcialmente, Indenizados, Novos ou Que Voltaram. Os campos de data habilitam conforme o tipo.",
                icone: "fa-solid fa-list-check",
            },
            {
                titulo: "Prioridade e datas",
                texto:
                    "Refine por Crítico, Atenção ou Recente quando fizer sentido. Ajuste Data Inicial/Final — em alguns relatórios a data final pode ficar fixa na lógica do sistema.",
                icone: "fa-regular fa-calendar",
            },
            {
                titulo: "Visualizar na tela",
                texto:
                    "Use \"Visualizar na Tela\" para conferir antes de exportar. Ordene colunas clicando nos cabeçalhos.",
                icone: "fa-solid fa-desktop",
            },
            {
                titulo: "Exportar",
                texto:
                    "\"Exportar Excel\" ou \"Exportar PDF\" geram o arquivo com o mesmo filtro aplicado.",
                icone: "fa-solid fa-file-export",
            },
        ],
    },
    {
        id: "agenda",
        nome: "Agenda",
        icone: "fa-regular fa-calendar-days",
        cor: "#ef4444",
        bg: "#fef2f2",
        rota: "/agenda",
        descricaoCurta:
            "Calendário de tarefas com prioridade e vínculo opcional a contrato e responsável.",
        paraQueServe:
            "Organiza retornos de negociação e compromissos do time. As tarefas aparecem no mês selecionado e na lista do dia.",
        passos: [
            {
                titulo: "Navegar no calendário",
                texto:
                    "Use as setas para mudar o mês e clique em um dia para focar as tarefas daquela data.",
                icone: "fa-regular fa-calendar",
            },
            {
                titulo: "Nova tarefa",
                texto:
                    "Em \"Nova Tarefa\", preencha título, descrição opcional, data/hora e prioridade.",
                icone: "fa-solid fa-calendar-plus",
            },
            {
                titulo: "Vincular contrato e responsável",
                texto:
                    "Associe um contrato quando a atividade for de cobrança e escolha o funcionário responsável.",
                icone: "fa-solid fa-link",
            },
            {
                titulo: "Concluir",
                texto:
                    "Marque tarefas realizadas e acompanhe as pendentes ou atrasadas na lista do dia.",
                icone: "fa-solid fa-check-double",
            },
        ],
    },
    {
        id: "dashboard",
        nome: "Dashboard",
        icone: "fa-solid fa-chart-pie",
        cor: "#0ea5e9",
        bg: "#f0f9ff",
        rota: "/dashboard",
        descricaoCurta:
            "KPIs da carteira, gráficos de evolução e exportação XLS/PDF (gestor/admin).",
        paraQueServe:
            "Visão estratégica: contratos em cobrança hoje, pagos, parciais, indenizados, novos e retomados no período; gráfico de linhas configurável e pizza da distribuição da carteira. O painel de controle permite séries, intervalo de meses e exportação com dados e imagens.",
        passos: [
            {
                titulo: "Ler os cartões de KPI",
                texto:
                    "Os indicadores superiores refletem o período selecionado no painel (exceto \"Em Cobrança\", focado na situação atual).",
                icone: "fa-solid fa-square-poll-vertical",
            },
            {
                titulo: "Gráfico de evolução",
                texto:
                    "Marque quais séries comparar (pagos, indenizados, novos, voltou, parciais, entradas safra). O texto de ajuda no painel explica sobreposições entre séries.",
                icone: "fa-solid fa-chart-line",
            },
            {
                titulo: "Período e pizza",
                texto:
                    "Defina mês inicial/final ou use atalhos 3/6/12 meses. Ajuste quais fatias entram no gráfico de distribuição da carteira.",
                icone: "fa-solid fa-chart-pie",
            },
            {
                titulo: "Exportar",
                texto:
                    "Na área de exportação, baixe XLS ou PDF com dados e gráficos conforme a seleção atual.",
                icone: "fa-solid fa-download",
            },
        ],
    },
    {
        id: "performance",
        nome: "Performance JB",
        icone: "fa-solid fa-chart-line",
        cor: "#6366f1",
        bg: "#eef2ff",
        rota: "/performance",
        descricaoCurta:
            "Performance por safra: performado x não performado, faixas 30/60/90 dias e exportação (gestor).",
        paraQueServe:
            "Mede resultado por safra (entrada na cobrança no mês da data_arquivo GM), com contratos distribuídos, barras de desempenho e recorte por faixa do mês. Permite alternar visão por quantidade ou valor (R$) e exportar XLS, PDF ou CSV para Power BI.",
        passos: [
            {
                titulo: "Safra e faixa do calendário",
                texto:
                    "Escolha o mês/ano analisado e a faixa do mês (ou visão geral das quatro faixas). Leia o texto do painel sobre o critério de entrada na safra.",
                icone: "fa-solid fa-layer-group",
            },
            {
                titulo: "Teto de atraso",
                texto:
                    "Selecione até 30, 60 ou 90 dias para o gráfico de performado versus não performado (regra cumulativa descrita na tela).",
                icone: "fa-solid fa-sliders",
            },
            {
                titulo: "Quantidade ou valor",
                texto:
                    "Alterne entre modo quantidade e valor em R$; a classificação performado/não performado permanece, mudando apenas o que soma no gráfico.",
                icone: "fa-solid fa-coins",
            },
            {
                titulo: "Exportar e lista de contratos",
                texto:
                    "Use XLS, PDF ou Power BI conforme necessidade. Abaixo do painel há detalhamento dos contratos quando disponível.",
                icone: "fa-solid fa-file-export",
            },
        ],
    },
    {
        id: "cadastro",
        nome: "Consorciados e Avalistas",
        icone: "fa-solid fa-users-gear",
        cor: "#14b8a6",
        bg: "#f0fdfa",
        rota: "/cadastro",
        descricaoCurta:
            "Duas grades: consorciados e avalistas, com busca por nome, documento, grupo/cota ou bem.",
        paraQueServe:
            "Consulta cadastral das pessoas já importadas: localiza quem é devedor ou avalista, quantos contratos possui e abre o painel completo de contatos igual ao usado na Busca e na Cobrança.",
        passos: [
            {
                titulo: "Escolher o bloco",
                texto:
                    "A página tem seções separadas \"Gestão de Consorciados\" e \"Gestão de Avalistas\", cada uma com contagem e busca própria.",
                icone: "fa-solid fa-users",
            },
            {
                titulo: "Tipo de filtro",
                texto:
                    "Em cada bloco, selecione Nome, CPF/CNPJ, Grupo & Cota ou Bem (Descrição) e informe o termo antes de pesquisar.",
                icone: "fa-solid fa-sliders",
            },
            {
                titulo: "Ordenar e paginar",
                texto:
                    "Clique nos cabeçalhos para ordenar nome, documento ou quantidade de contratos.",
                icone: "fa-solid fa-arrow-down-wide-short",
            },
            {
                titulo: "Abrir detalhes",
                texto:
                    "Use a ação na linha para ver telefones, e-mails, endereços e contratos vinculados.",
                icone: "fa-solid fa-address-card",
            },
        ],
    },
    {
        id: "operadores",
        nome: "Operadores",
        icone: "fa-solid fa-user-shield",
        cor: "#64748b",
        bg: "#f1f5f9",
        rota: "/operadores",
        descricaoCurta:
            "Gerencie cobradores, situação da carteira, KPIs e cadastro (perfil administrativo).",
        paraQueServe:
            "Painel gerencial dos funcionários de cobrança: filtros por operador, criticidade da carteira (faixa de atraso), status laboral (ativo, inativo, afastado, férias) e busca textual. Permite criar operador e inspecionar desempenho agregado.",
        passos: [
            {
                titulo: "Combinar filtros",
                texto:
                    "Use Operador, Situação (crítico/atenção/recente da carteira), Status do funcionário e a caixa de busca por nome, CPF ou grupo/cota.",
                icone: "fa-solid fa-filter",
            },
            {
                titulo: "Ler os KPIs",
                texto:
                    "Os cartões resumem totais e distribuição conforme o recorte aplicado — útil para equilibrar carga.",
                icone: "fa-solid fa-chart-simple",
            },
            {
                titulo: "Novo operador",
                texto:
                    "Em \"Novo operador\", cadastre dados de acesso e vínculo; edite pelo fluxo de detalhe/expansão do cartão quando o sistema permitir.",
                icone: "fa-solid fa-user-plus",
            },
            {
                titulo: "Ramal e discador",
                texto:
                    "Mantenha o ramal correto no cadastro do funcionário quando o escritório usar integração de discagem (ligação a partir dos telefones nas telas de contato).",
                icone: "fa-solid fa-phone",
            },
        ],
    },
    {
        id: "protocolo",
        nome: "Protocolo",
        icone: "fa-solid fa-file-signature",
        cor: "#2563eb",
        bg: "#eff6ff",
        rota: "/protocolo",
        descricaoCurta:
            "Lista de protocolos enviados com status (pendente, aceito, recusado) e vínculo a contrato.",
        paraQueServe:
            "Acompanhe comunicações formais entre remetente e destinatário dentro do sistema: título, datas, aceite e contrato associado quando houver.",
        passos: [
            {
                titulo: "Consultar a tabela",
                texto:
                    "A grade mostra ID, título, partes, data de envio, status e contrato. O total de registros aparece no cabeçalho.",
                icone: "fa-solid fa-table-list",
            },
            {
                titulo: "Abrir detalhes",
                texto:
                    "Use a coluna de ações para ver o conteúdo completo e o histórico do protocolo escolhido.",
                icone: "fa-solid fa-eye",
            },
        ],
    },
    {
        id: "solicitacao",
        nome: "Solicitação",
        icone: "fa-solid fa-file-circle-question",
        cor: "#7c3aed",
        bg: "#f5f3ff",
        rota: "/solicitacao",
        descricaoCurta:
            "Abra solicitações internas com destinatário, assunto, data a aguardar e contrato opcional.",
        paraQueServe:
            "Canal para pedidos entre equipes (documentos, análises, retornos): registra quem enviou, para quem, prazo de espera e descrição curta.",
        passos: [
            {
                titulo: "Nova solicitação",
                texto:
                    "Clique em \"Nova solicitação\", escolha o destinatário, assunto, data a aguardar e opcionalmente o ID do contrato.",
                icone: "fa-solid fa-plus",
            },
            {
                titulo: "Acompanhar",
                texto:
                    "A lista centraliza envios com remetente, destinatário e data; abra o detalhe pela ação correspondente.",
                icone: "fa-solid fa-inbox",
            },
        ],
    },
    {
        id: "mensagem",
        nome: "Mensagem",
        icone: "fa-solid fa-envelope",
        cor: "#ea580c",
        bg: "#fff7ed",
        rota: "/mensagem",
        descricaoCurta:
            "Mensagens internas entre usuários, com resposta em conversa.",
        paraQueServe:
            "Comunicação rápida no estilo caixa de mensagens: assunto, corpo opcional, destinatário e thread de respostas no detalhe.",
        passos: [
            {
                titulo: "Enviar mensagem",
                texto:
                    "Em \"Nova mensagem\", selecione o destinatário e preencha assunto e texto.",
                icone: "fa-solid fa-paper-plane",
            },
            {
                titulo: "Ler e responder",
                texto:
                    "Abra o registro na lista para ver o conteúdo e usar responder quando disponível.",
                icone: "fa-solid fa-comments",
            },
        ],
    },
];

/* ==========================================================================
 * Logica de UI do modal
 * ========================================================================== */

(function initTutoriais() {
    document.addEventListener("DOMContentLoaded", () => {
        const btn = document.getElementById("btnVerTutoriais");
        if (!btn) return;

        const overlay = document.getElementById("tutorialOverlay");
        const modal = overlay.querySelector(".tutorial-modal");
        const modalBody = overlay.querySelector(".tutorial-modal-body");
        const closeBtns = overlay.querySelectorAll("[data-close-tutorial]");
        const listView = overlay.querySelector(".tutorial-list-view");
        const detailView = overlay.querySelector(".tutorial-detail-view");
        const listGrid = overlay.querySelector(".tutorial-modules-grid");
        const detailHeader = overlay.querySelector(".tutorial-detail-header");
        const detailSteps = overlay.querySelector(".tutorial-steps");
        const detailIntro = overlay.querySelector(".tutorial-detail-intro");
        const detailGoBtn = overlay.querySelector(".tutorial-go-btn");
        const backBtn = overlay.querySelector(".tutorial-back-btn");
        const title = overlay.querySelector(".tutorial-modal-title");

        function renderList() {
            listGrid.innerHTML = TUTORIAIS.map(
                (t) => `
                <button class="tutorial-module-card" data-id="${t.id}" type="button">
                    <div class="tm-icon" style="background:${t.bg};color:${t.cor};">
                        <i class="${t.icone}"></i>
                    </div>
                    <div class="tm-body">
                        <h4>${t.nome}</h4>
                        <p>${t.descricaoCurta}</p>
                    </div>
                    <i class="fa-solid fa-arrow-right tm-chevron"></i>
                </button>
            `,
            ).join("");

            listGrid.querySelectorAll(".tutorial-module-card").forEach((card) => {
                card.addEventListener("click", () => {
                    const id = card.getAttribute("data-id");
                    const tutorial = TUTORIAIS.find((t) => t.id === id);
                    if (tutorial) renderDetail(tutorial);
                });
            });
        }

        function renderDetail(t) {
            detailHeader.innerHTML = `
                <div class="td-icon" style="background:${t.bg};color:${t.cor};">
                    <i class="${t.icone}"></i>
                </div>
                <div class="td-title">
                    <h3>${t.nome}</h3>
                    <span>Tutorial passo a passo</span>
                </div>
            `;
            detailIntro.innerHTML = `
                <h5><i class="fa-regular fa-circle-question"></i> Para que serve?</h5>
                <p>${t.paraQueServe}</p>
            `;
            detailSteps.innerHTML = t.passos
                .map(
                    (p, i) => `
                <li class="tutorial-step">
                    <div class="step-number" style="background:${t.cor};">${i + 1}</div>
                    <div class="step-content">
                        <h5>
                            <i class="${p.icone}" style="color:${t.cor};"></i>
                            ${p.titulo}
                        </h5>
                        <p>${p.texto}</p>
                    </div>
                </li>
            `,
                )
                .join("");
            detailGoBtn.onclick = () => {
                if (window.__sajMarkInternalNavigationForImport) {
                    window.__sajMarkInternalNavigationForImport();
                }
                window.location.href = t.rota;
            };
            detailGoBtn.innerHTML = `Ir para ${t.nome} <i class="fa-solid fa-arrow-right"></i>`;
            detailGoBtn.style.backgroundColor = t.cor;

            listView.classList.remove("show");
            detailView.classList.add("show");
            modal.classList.add("showing-detail");
            title.textContent = "Tutorial do Módulo";
            modalBody.scrollTop = 0;
        }

        function backToList() {
            detailView.classList.remove("show");
            listView.classList.add("show");
            modal.classList.remove("showing-detail");
            title.textContent = "Central de Tutoriais";
            modalBody.scrollTop = 0;
        }

        function openModal() {
            renderList();
            backToList();
            overlay.classList.add("show");
            document.body.style.overflow = "hidden";
        }

        function closeModal() {
            overlay.classList.remove("show");
            document.body.style.overflow = "";
        }

        btn.addEventListener("click", openModal);
        closeBtns.forEach((b) => b.addEventListener("click", closeModal));
        backBtn.addEventListener("click", backToList);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeModal();
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && overlay.classList.contains("show")) {
                if (detailView.classList.contains("show")) backToList();
                else closeModal();
            }
        });
    });
})();
