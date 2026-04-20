/* ==========================================================================
 * Tutoriais do sistema SAJ - passo a passo por modulo.
 *
 * Para adicionar/editar um tutorial, mexa no array TUTORIAIS abaixo.
 * Cada item representa um modulo e contem um resumo + lista de passos.
 * ========================================================================== */

const TUTORIAIS = [
    {
        id: "importacao",
        nome: "Importação e Distribuição",
        icone: "fa-solid fa-file-import",
        cor: "#3b82f6",
        bg: "#eff6ff",
        rota: "/importacao",
        descricaoCurta: "Envie arquivos da GM e distribua contratos entre os cobradores.",
        paraQueServe:
            "Este módulo é a porta de entrada dos dados no sistema. É aqui que você carrega os arquivos TXT enviados pela GM, processa o conteúdo e organiza a carteira, distribuindo os contratos entre os funcionários de cobrança de forma equilibrada.",
        passos: [
            {
                titulo: "Fazer upload do arquivo",
                texto:
                    "No topo da página, arraste o arquivo TXT enviado pela GM para a área de upload ou clique em \"Selecionar arquivo\". O sistema identifica o arquivo, valida o formato e inicia o processamento.",
                icone: "fa-solid fa-cloud-arrow-up",
            },
            {
                titulo: "Acompanhar o processamento",
                texto:
                    "A barra de progresso mostra o status em tempo real. Os logs detalhados aparecem abaixo, indicando cada etapa: leitura do arquivo, gravação de pessoas, contratos, parcelas e bens.",
                icone: "fa-solid fa-gauge-high",
            },
            {
                titulo: "Revisar a distribuição automática",
                texto:
                    "Quando o processamento termina, o painel \"Distribuição entre funcionários\" é aberto automaticamente. Cada cartão mostra a quantidade de contratos e o valor total recebido por cada cobrador, separado por criticidade (Crítico, Atenção, Recente).",
                icone: "fa-solid fa-users-line",
            },
            {
                titulo: "Ajustar ou transferir contratos",
                texto:
                    "Se precisar rebalancear, use o botão \"Transferir\" no cartão do funcionário. Você pode passar todos os contratos dele para um colega específico ou redistribuí-los igualmente entre os demais ativos.",
                icone: "fa-solid fa-arrow-right-arrow-left",
            },
            {
                titulo: "Aprovar a distribuição",
                texto:
                    "Depois de confirmar que a divisão está boa, clique em \"Aprovar distribuição\". A partir desse momento, os contratos passam a aparecer para cada cobrador no módulo de Cobrança.",
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
        descricaoCurta: "Trabalhe a carteira de cada operador e registre tramitações.",
        paraQueServe:
            "É o módulo de operação do dia-a-dia. Aqui cada cobrador acessa a própria carteira, prioriza contratos por criticidade, registra ligações/WhatsApp/e-mails (tramitações) e acompanha o andamento das negociações.",
        passos: [
            {
                titulo: "Selecionar o operador",
                texto:
                    "No filtro superior, escolha o \"Operador\" para ver apenas os contratos atribuídos a ele. Administradores podem ver todos selecionando \"Todos\".",
                icone: "fa-solid fa-user-tie",
            },
            {
                titulo: "Escolher a visualização",
                texto:
                    "Use o botão de alternância \"Analítico / Quadro Kanban\". A visão analítica é uma lista detalhada; o Kanban separa em colunas (Contato Inicial, Em Negociação, Risco Crítico).",
                icone: "fa-solid fa-table-columns",
            },
            {
                titulo: "Filtrar por criticidade",
                texto:
                    "Os chips \"Crítico\", \"Atenção\" e \"Recente\" filtram contratos por tempo em atraso. Clique em um para focar só naquele grupo.",
                icone: "fa-solid fa-triangle-exclamation",
            },
            {
                titulo: "Abrir o detalhe do contrato",
                texto:
                    "Clique em qualquer cartão para abrir o modal de detalhes, com dados do consorciado, telefones, e-mails, parcelas, bens, avalista e histórico de tramitações.",
                icone: "fa-solid fa-folder-open",
            },
            {
                titulo: "Registrar uma tramitação",
                texto:
                    "Dentro do modal, use o formulário de nova tramitação: escolha o tipo (ligação, WhatsApp, e-mail), informe CPC, adicione uma descrição e salve. A interação fica registrada no histórico.",
                icone: "fa-solid fa-phone-volume",
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
        descricaoCurta: "Localize rapidamente qualquer contrato, pessoa ou bem.",
        paraQueServe:
            "Central de busca avançada. Serve para encontrar contratos por qualquer informação conhecida: CPF, nome, número de contrato, grupo/cota, avalista ou até pelo bem (chassi, placa, modelo).",
        passos: [
            {
                titulo: "Escolher o tipo de busca",
                texto:
                    "No seletor \"Buscar por\", selecione se a pesquisa é por Contrato, Consorciado, Avalista ou Bem. O placeholder do campo ajusta automaticamente.",
                icone: "fa-solid fa-sliders",
            },
            {
                titulo: "Digitar o termo",
                texto:
                    "Informe o texto (ex.: CPF com ou sem pontuação, nome parcial, \"028000/0271\", placa, chassi). A busca aceita correspondência parcial.",
                icone: "fa-solid fa-keyboard",
            },
            {
                titulo: "Ler os resultados",
                texto:
                    "Os contratos aparecem em cartões com Grupo/Cota, status, valor, consorciado e descrição do bem, se houver.",
                icone: "fa-solid fa-list-ul",
            },
            {
                titulo: "Abrir detalhes",
                texto:
                    "Clique em um cartão para ver o modal completo com parcelas, tramitações e contatos — o mesmo do módulo de Cobrança.",
                icone: "fa-solid fa-arrow-up-right-from-square",
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
        descricaoCurta: "Extraia relatórios gerenciais em XLS, PDF ou CSV.",
        paraQueServe:
            "Permite gerar relatórios consolidados para análise ou envio ao cliente: contratos abertos, pagos, indenizados, visão por safra e outros recortes, com exportação para planilha ou PDF.",
        passos: [
            {
                titulo: "Escolher o tipo de relatório",
                texto:
                    "Selecione entre \"Contratos Abertos\", \"Pagos\", \"Indenizados\", \"Por Safra\" etc. Cada opção exibe os filtros compatíveis.",
                icone: "fa-solid fa-list-check",
            },
            {
                titulo: "Definir o intervalo",
                texto:
                    "Informe Data Inicial e Final. Para \"Contratos Abertos\" a Data Final é automaticamente bloqueada na data de hoje (o status é sempre atual).",
                icone: "fa-regular fa-calendar",
            },
            {
                titulo: "Aplicar filtros adicionais",
                texto:
                    "Se disponível, refine por operador, criticidade ou safra para reduzir o escopo do relatório.",
                icone: "fa-solid fa-filter",
            },
            {
                titulo: "Gerar e exportar",
                texto:
                    "Clique em \"Gerar Relatório\". Quando pronto, escolha o formato de exportação (XLS, PDF, CSV PowerBI) no topo da tabela.",
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
        descricaoCurta: "Organize compromissos e retornos de negociação.",
        paraQueServe:
            "Gestão de atividades do operador. Cadastre retornos, reuniões, cobranças agendadas e vincule-as a contratos e funcionários responsáveis, com nível de prioridade.",
        passos: [
            {
                titulo: "Criar uma atividade",
                texto:
                    "Clique em \"+ Nova Atividade\". Informe título, descrição, data/hora e prioridade (baixa, média, alta).",
                icone: "fa-solid fa-calendar-plus",
            },
            {
                titulo: "Vincular a um contrato",
                texto:
                    "Se a atividade for ligada a uma cobrança, pesquise e selecione o contrato no campo \"Contrato relacionado\".",
                icone: "fa-solid fa-link",
            },
            {
                titulo: "Atribuir ao responsável",
                texto:
                    "Escolha o funcionário responsável pela execução. A atividade aparecerá na agenda dele.",
                icone: "fa-solid fa-user-check",
            },
            {
                titulo: "Concluir ou reagendar",
                texto:
                    "Quando realizar a atividade, marque como concluída. Atividades atrasadas são destacadas para follow-up.",
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
        descricaoCurta: "Visão estratégica da carteira em cobrança.",
        paraQueServe:
            "Painel gerencial com KPIs de contratos abertos, distribuição por criticidade e tabela de prioridades. Ideal para acompanhar a saúde geral da carteira e agir rápido nos contratos mais críticos.",
        passos: [
            {
                titulo: "Interpretar os cards principais",
                texto:
                    "No topo, estão os indicadores consolidados: total de contratos, valor sob cobrança, quantidade crítica, atenção e recente.",
                icone: "fa-solid fa-square-poll-vertical",
            },
            {
                titulo: "Usar o painel de controle",
                texto:
                    "O bloco \"Painel de Controle\" permite ajustar mês e aplicar filtros dinâmicos que recalculam todos os indicadores da página.",
                icone: "fa-solid fa-sliders",
            },
            {
                titulo: "Ordenar a tabela de prioridades",
                texto:
                    "Clique nos cabeçalhos da tabela para ordenar por qualquer coluna (dias em atraso, valor, operador). Ajuda a priorizar contatos.",
                icone: "fa-solid fa-arrow-down-wide-short",
            },
            {
                titulo: "Exportar os dados",
                texto:
                    "No canto do painel, use o botão de exportação para baixar a visão em XLS, PDF ou CSV pronto para PowerBI.",
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
        descricaoCurta: "Acompanhe a evolução dos resultados por safra.",
        paraQueServe:
            "Análise de performance do escritório. Mostra a evolução de contratos pagos, indenizados e novos ao longo das safras, com comparativos e gráficos interativos.",
        passos: [
            {
                titulo: "Selecionar a safra",
                texto:
                    "Escolha uma safra específica no seletor para ver o detalhamento diário, ou deixe em \"Visão geral\" para comparar as 4 safras mais recentes.",
                icone: "fa-solid fa-layer-group",
            },
            {
                titulo: "Ler os blocos de KPI",
                texto:
                    "Os cartões separam Contratos Pagos, Contratos Indenizados e Contratos Novos, com totais e percentuais no período.",
                icone: "fa-solid fa-chart-simple",
            },
            {
                titulo: "Explorar o gráfico",
                texto:
                    "Passe o mouse sobre as barras para ver os valores exatos de cada dia/safra. A cor indica a categoria (pago, indenizado, novo).",
                icone: "fa-solid fa-chart-column",
            },
            {
                titulo: "Exportar para apresentação",
                texto:
                    "Use os botões do painel para gerar XLS, PDF ou CSV — úteis para reuniões gerenciais ou envio ao cliente.",
                icone: "fa-solid fa-file-arrow-down",
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
        descricaoCurta: "Consulte e gerencie o cadastro de pessoas.",
        paraQueServe:
            "Base cadastral de todas as pessoas (consorciados e avalistas) já importadas. Permite buscar uma pessoa, ver os contratos em que ela aparece e conferir dados de contato.",
        passos: [
            {
                titulo: "Buscar uma pessoa",
                texto:
                    "Use o filtro para pesquisar por CPF/CNPJ, nome completo ou parcial. A lista é paginada.",
                icone: "fa-solid fa-user-magnifying-glass",
            },
            {
                titulo: "Separar por papel",
                texto:
                    "Escolha se quer ver apenas \"Consorciados\", \"Avalistas\" ou ambos. O sistema mostra em qual papel a pessoa aparece em cada contrato.",
                icone: "fa-solid fa-user-tag",
            },
            {
                titulo: "Abrir detalhes da pessoa",
                texto:
                    "Clique em um registro para ver todos os telefones, e-mails, endereços e contratos vinculados — o mesmo detalhe exibido na Busca e na Cobrança.",
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
        descricaoCurta: "Cadastre e gerencie os funcionários de cobrança.",
        paraQueServe:
            "Gestão dos cobradores do escritório. Define quem está ativo, afastado ou em férias, controla acessos e permite inspecionar a carteira e performance de cada operador.",
        passos: [
            {
                titulo: "Filtrar por status",
                texto:
                    "Use os chips para alternar entre Ativos, Inativos, Afastados e Férias. A lista é filtrada em tempo real.",
                icone: "fa-solid fa-circle-half-stroke",
            },
            {
                titulo: "Expandir um operador",
                texto:
                    "Clique no cartão de um funcionário para ver os contratos sob sua responsabilidade, contatos e indicadores de performance.",
                icone: "fa-solid fa-chevron-down",
            },
            {
                titulo: "Cadastrar ou editar",
                texto:
                    "Use \"+ Novo Operador\" para cadastrar um funcionário (nome, CPF, login, senha). Para editar, abra o cartão e clique em \"Editar\".",
                icone: "fa-solid fa-user-plus",
            },
            {
                titulo: "Controlar acesso externo",
                texto:
                    "A flag \"Acesso externo\" permite que o operador entre pelo login próprio e veja somente a carteira dele.",
                icone: "fa-solid fa-key",
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
