# Documentacao JavaScript - Prototipo SAJ

Este documento lista **todos os ficheiros `.js` em `static/`** (28 no estado atual do repo), como carregam nos **templates**, que **APIs Flask** chamam e que **outros scripts** assumem como dependencia. Complementa **`docs/DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`** (lado servidor).

**Convencao:** quase tudo e **vanilla JS** (sem bundler). Ordem de `<script>` em `templates/layout.html` importa: bibliotecas globais (`tramitacoes_detail`, `contrato_detalhes_modal`, ...) antes das paginas que as invocam.

---

## 1. Onde os scripts entram (mapa rapido)

**Em todas as paginas autenticadas** (`templates/layout.html`, antes de `{% block scripts %}`): `home.js`, `avisos.js`, `notificacoes.js`, `tramitacoes_detail.js`, `contrato_campos.js`, `contrato_detalhes_modal.js`, `pasta_virtual_insert_global.js`, `contato_add_global.js`, `discador.js`, `whatsapp_sender.js`, `sms_messagecenter.js`, `email_html_busca.js`.

**So em paginas especificas** (bloco `scripts` de cada template): ver secao 3.

**Fluxo tipico de dados:** pagina X faz `fetch('/api/...')` -> JSON -> atualiza DOM; modais de contrato usam `/api/contrato/<id>` e reutilizam HTML gerado em JS (padrao semelhante entre `busca.js`, `cobranca.js`, etc.; ha **duplicacao** de `renderContratoModal` entre modulos, ver `README.md`).

---

## 2. Grafo de dependencias entre JS (resumo)

```
layout (global)
  home.js ----------+-- relogio, perfil, empresa, sidebar
  avisos.js --------+-- /api/avisos (mural home)
  notificacoes.js --+-- /api/notificacoes, lida, todas
  tramitacoes_detail.js -> expoe TramitacoesDetalhe (modal contrato)
  contrato_campos.js -> window.formatTaxaAdministracaoPercent, formatContatoFonteLabel
  contrato_detalhes_modal.js -> window.ContratoDetalhesModal (timeline negativacao, etc.)
  pasta_virtual_insert_global.js -> /api/pasta-virtual/meta, inserir
  contato_add_global.js -> POST telefone/email pessoa
  discador.js -> POST /api/discar
  whatsapp_sender.js -> POST /api/enviar-whatsapp
  sms_messagecenter.js -> POST /api/enviar-sms
  email_html_busca.js -> POST /api/enviar-email-html

Paginas
  busca.js / cobranca.js / ... -> montam modal #detalhesModal e chamam TramitacoesDetalhe + ContratoDetalhesModal
  cobranca_automacoes.js -> window.CobrancaAutomacoes (usado por cobranca.js)
  painel_lista_contratos.js -> lista + filtro (dashboard / performance)
  notificacao-deep-link.js -> window.applyNotifDeepLink (protocolo, solicitacao, mensagem)
```

---

## 3. Inventario por ficheiro (28 em `static/`)

Para cada ficheiro: **papel**, **APIs** (quando aplicavel), **HTML / globals**, **paginas**.

### `static/agenda.js`

Calendario mensal, lista de tarefas do dia, CRUD via `/api/agenda`, `/api/agenda/<id>`. Abre tarefa a partir de query `notif_id` (integracao com notificacoes). **Template:** `agenda.html`.

### `static/avisos.js`

Mural de avisos na home (`#bulletinBoardHome`): GET/POST/PUT/DELETE **`/api/avisos`**. Cache local. **Template:** global (`layout.html`).

### `static/busca.js`

Busca por pessoa, contrato ou bem: formulario, `/api/busca`, `/api/busca/campos-bem`, ordenacao, export. Modal `#detalhesModal` com `renderContratoModal` (duplicado face a outros modulos), `TramitacoesDetalhe`, `ContratoDetalhesModal.buildOcorrenciasTimelineHtml` / negativacao. `window.__refreshContatoSrc` para recarregar apos contato. **Template:** `busca.html`.

### `static/cadastro.js`

Pagina **Consorciados e Avalistas**: filtros, `/api/consorciados`, `/api/avalistas`, ordenacao, modal contrato (mesmo padrao busca). **Template:** `cadastro.html`.

### `static/cobranca.js`

Painel de cobranca: `/api/cobranca`, blocos critico/atencao/recente, vista analitica vs kanban, filtro operador (JSON `cobranca-page-config` no HTML), busca interna, modal detalhe. Integra **`window.CobrancaAutomacoes`** (`cobranca_automacoes.js`) para SMS/e-mail/ligacao em lote. **Template:** `cobranca.html` (com `cobranca_automacoes.js` **antes** deste ficheiro).

### `static/cobranca_automacoes.js`

IIFE que define **`window.CobrancaAutomacoes`**: preview `/api/cobranca/sms-email/preview`, Excel `/api/cobranca/sms-email/excel`, disparo `/api/automacao/<tipo>`, confirmacoes e modal de status. Usado apenas no contexto cobranca. **Template:** `cobranca.html`.

### `static/contato_add_global.js`

Modal **`#contatoAddModal`**: botoes `.btn-add-telefone-pessoa` / `.btn-add-email-pessoa`; POST **`/api/pessoa/<id>/telefone`** ou **`/api/pessoa/<id>/email`**. Apos sucesso chama `window.__refreshContatoSrc` se existir e dispara evento `pessoaContatoInserido`. **Template:** global.

### `static/contrato_campos.js`

Funcoes puras no **`window`**: `formatTaxaAdministracaoPercent`, `formatContatoFonteLabel` (percentuais GM, rotulo fonte contato). Usadas nos modais gerados por `busca.js`, `cobranca.js`, `relatorios.js`, etc. **Template:** global.

### `static/contrato_detalhes_modal.js`

**`window.ContratoDetalhesModal`**: helpers de timeline de ocorrencias, secao negativacao, reutilizados quando o modal constroi HTML string. Depende de dados ja carregados de `/api/contrato/<id>`. **Template:** global.

### `static/dashboard.js`

Dashboard: GET **`/api/dashboard`**, filtros de periodo, graficos **Chart.js** (CDN no template), KPIs. Pode abrir detalhes via callback para lista de contratos. **Template:** `dashboard.html` + `painel_lista_contratos.js`.

### `static/discador.js`

Delegacao de clique em **`.btn-ligar`**: le `data-numero`, confirmacao, POST **`/api/discar`**. **Template:** global.

### `static/email_html_busca.js`

Delegacao **`.btn-enviar-email-html`**: prompt texto (ou mensagem automatica se `data-email-auto-contrato`), POST **`/api/enviar-email-html`** com ids pessoa/email/contrato. **Template:** global.

### `static/home.js`

Header: relogio, data, dropdown perfil, tema, selector empresa (`/api/sessao/empresa`), menu mobile. Logica extra (ex. mensagens) conforme restante do ficheiro. **Template:** global.

### `static/importacao.js`

Upload multiplo/pasta, POST **`/api/upload`**, SSE **`/api/processar`** (EventSource ou fetch stream), painel distribuicao `/api/importacao/distribuicao`, transferencias, SMS/e-mail automaticos (preview GET, POST, Excel GET), negativacao/positivacao Excel, aprovar distribuicao. **Template:** `importacao.html`.

### `static/negativacao.js`

Listagem negativacao: `/api/negativacao/listagem`, Excel, envio SERASA, positivar lote, TXT convencao (`/api/negativacao/serasa-arquivo-txt`), modos geral vs carteira (`window.NEGATIVACAO_PAGE_CONFIG`), deep links URL. **Template:** `negativacao.html`.

### `static/notificacao-deep-link.js`

**`window.applyNotifDeepLink(tbodyId, opts)`**: le `?notif_id=`, destaca linha, opcionalmente clica "Ver". Usado em tabelas de protocolo, solicitacao, mensagem. **Templates:** `protocolo.html`, `solicitacao.html`, `mensagem.html`.

### `static/notificacoes.js`

Dropdown do sininho: GET **`/api/notificacoes`**, marcar lida **`/api/notificacoes/lida`**, modal "todas" **`/api/notificacoes/todas`**. Tipos: aviso, agenda, mensagem, solicitacao, protocolo. **Template:** global.

### `static/operadores.js`

Dashboard por operador: filtros, `/api/operadores/dashboard`, KPIs, modal contrato, formulario CRUD operador (`/api/admin/funcionario`). **Template:** `operadores.html`.

### `static/painel_lista_contratos.js`

**`PainelListaContratos.init({ endpoint, getBaseQuery, onDetalhe, mode })`**: tabela de contratos alinhada ao painel (dashboard ou performance), debounce de busca, chama endpoint configurado (ex. `/api/dashboard/panel_contratos` ou performance). **Templates:** `dashboard.html`, `performance.html`.

### `static/pasta_virtual.js`

Lista pasta virtual: `/api/pasta-virtual`, filtros, download, modal contrato ao ver detalhe. **Template:** `pasta_virtual.html`.

### `static/pasta_virtual_insert_global.js`

Modal global inserir registro PV: meta **`/api/pasta-virtual/meta`**, POST **`/api/pasta-virtual/inserir`**, botoes `.btn-pv-insert-from-contrato`. **Template:** global.

### `static/performance.js`

Performance JB: GET **`/api/performance?mes=YYYY-MM`** (JSON do painel: safras, graficos, KPIs); vista **contagem** vs **valor** (parcela metrica) sincronizada com inputs do DOM; faixa de calendario (`activeSafraIndex` ou visao geral); teto de atraso 30/60/90 dias alinhado ao grafico empilhado.

**Lista de contratos:** `PainelListaContratos.init` com `endpoint` **`/api/performance/panel_contratos`**, query `mes`, `atraso_teto`, `safra_index` (`all` ou indice).

**Exportacao** (`doExport`): exige `currentResponse` (dados ja carregados). POST **`/api/performance/export/<formato>`** com `formato` em `xlsx` | `pdf` | `powerbi`. Corpo JSON: `mes` (`lastMes`), `safra_index` (`'all'` ou indice numerico), `series` fixo `['novos','pagos','indenizados']`, `faixas` derivadas do teto (`faixasForExportFromAtrasoTeto`: so `d30` se teto 30; `d30`+`d60` se 60; as tres se 90), `atraso_teto`. **PDF:** acrescenta `bar_image` (PNG base64 do grafico de barras via Chart.js) e `pie_image` vazio. Resposta: `blob` + download pelo `Content-Disposition`. O **.xlsx** inclui resumo por safra (quantidade + R$ parcela + R$ credito, performado vs nao performado) e aba pivot para tabela dinamica; ver `DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`, secao 3.4.1.

**Template:** `performance.html` (texto da barra de exporto descreve o conteudo do Excel).

### `static/relatorios.js`

Filtros relatorio, `/api/relatorios`, export excel/pdf URLs, ordenacao, modal detalhe; opcional e-mail em lote (`RELATORIOS_EMAIL_MASSA`, `/api/relatorios/email-lote`). **Template:** `relatorios.html`.

### `static/solicitacao_moderacao.js`

Pedidos de moderacao: GET pendentes/minhas, POST decisao, UI de diff (tramitacao/agenda). **Template:** `solicitacao.html` (+ `notificacao-deep-link.js`).

### `static/sms_messagecenter.js`

Delegacao **`.btn-mensagem`**: prompt ou SMS auto contrato, POST **`/api/enviar-sms`**. **Nota seguranca:** o ficheiro contem URL/header MessageCenter espelhados para UI; o envio real passa pelo Flask. **Template:** global.

### `static/tramitacoes_detail.js`

**`window.TramitacoesDetalhe`**: `buildSection`, `attachModal` ? lista e formularios de tramitacoes dentro do modal contrato; chama APIs `/api/contrato/.../tramitacao`, PUT/DELETE tramitacao, fluxo guiado. **Template:** global; usado por qualquer pagina com modal de contrato.

### `static/tutoriais.js`

Array `TUTORIAIS` (conteudo pedagogico), UI de passos por modulo, link para rotas. **Template:** `home.html` apenas.

### `static/whatsapp_sender.js`

Delegacao **`.btn-whatsapp`**: POST **`/api/enviar-whatsapp`**. Mensagem automatica opcional (data attributes iguais ao SMS). **Template:** global.

---

## 4. Ligacao `templates` -> `static` (referencia)

| Template | Scripts especificos (alem do layout) |
|----------|--------------------------------------|
| `dashboard.html` | Chart.js CDN, `dashboard.js`, `painel_lista_contratos.js` |
| `performance.html` | Chart.js CDN, `performance.js`, `painel_lista_contratos.js` |
| `cobranca.html` | `cobranca_automacoes.js`, `cobranca.js` |
| `importacao.html` | `importacao.js` |
| `busca.html` | `busca.js` |
| `relatorios.html` | `relatorios.js` |
| `negativacao.html` | `negativacao.js` |
| `cadastro.html` | `cadastro.js` |
| `operadores.html` | `operadores.js` |
| `agenda.html` | `agenda.js` |
| `pasta_virtual.html` | `pasta_virtual.js` |
| `solicitacao.html` | `solicitacao_moderacao.js`, `notificacao-deep-link.js` |
| `protocolo.html` | `notificacao-deep-link.js` |
| `mensagem.html` | `notificacao-deep-link.js` |
| `home.html` | `tutoriais.js` |

---

## 5. APIs HTTP mais tocadas pelo frontend (referencia cruzada)

Nao e lista exaustiva do `app.py`; e o conjunto que aparece com mais frequencia nos JS acima: `/api/busca`, `/api/contrato/<id>`, `/api/pessoa/<id>`, `/api/cobranca`, `/api/dashboard`, `/api/performance`, **`/api/performance/panel_contratos`**, **`/api/performance/export/<formato>`**, `/api/relatorios`, `/api/importacao/*`, `/api/negativacao/*`, `/api/automacao/*`, `/api/enviar-*`, `/api/discar`, `/api/agenda`, `/api/pasta-virtual*`, `/api/avisos`, `/api/notificacoes*`, `/api/solicitacao*`, `/api/admin/funcionario`, `/api/consorciados`, `/api/avalistas`, `/api/operadores/dashboard`.

Detalhe de contratos e SQL ficam em `DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`.

---

## 6. Manutencao e duplicacao

O `README.md` assinala **duplicacao** da funcao `renderContratoModal` (e HTML associado) entre `busca.js`, `cobranca.js`, `agenda.js`, etc. Qualquer alteracao visual no modal de contrato pode exigir tocar em varios ficheiros ate haver unificacao.

---

## 7. Seguranca no cliente (lembrete)

Tokens de integracao **nao** devem ser introduzidos em JS para novas features; o padrao do projeto e **proxy no Flask** (`/api/enviar-sms`, `/api/discar`, ...). O conteudo legado em `sms_messagecenter.js` que espelha URL/apikey e apenas coerente com o backend ja existente ? novos fluxos devem evitar expor segredos.

---

*Ver tambem: `docs/DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`. Estado do repositorio: 28 scripts em `static/`.*
