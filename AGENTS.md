# AGENTS Contexto Mestre - Prototipo SAJ

Este arquivo guarda o contexto principal do projeto para orientar agentes de IA.
Objetivo: evitar perda de contexto entre sessoes e manter o desenvolvimento consistente.

## 1) Objetivo do produto

Sistema web para gestao de cobranca de consorcios, com foco em:
- importacao de arquivos GM (TXT),
- acompanhamento de contratos e pessoas,
- tramitacao e agenda de cobranca,
- relatorios e dashboard com dados reais do banco,
- acompanhamento de performance por safra.

## 2) Stack e arquitetura

- Backend: Python + Flask (`app.py`) em formato monolito (intencional no prototipo).
- Frontend: HTML + CSS + JS vanilla por modulo em `templates/` e `static/`.
- Banco: MariaDB (`consorcio_gm`).
- Scripts de negocio em `Python/` (executados por subprocesso no backend).

## 3) Convencoes criticas (sempre aplicar)

- Nao commitar segredos (`.env`, tokens, credenciais).
- Usar variaveis de ambiente: `DB_*`, opcional `MYSQL_*`, `FLASK_SECRET_KEY`.
- Mudancas pequenas e legiveis; evitar refactor amplo sem pedido explicito.
- Nao silenciar erros; retornar mensagens claras sem expor dado sensivel.
- Manter compatibilidade entre `app.py` e scripts em `Python/` para nomes `DB_*`.
- Atualizar README/docs quando mudar setup, comportamento ou convencao.

## 4) Regras de negocio consolidadas

### 4.1 Importacao TXT
- Usuario pode importar arquivo TXT unico, varios arquivos, ou pasta com subpastas.
- Fluxo de processamento roda scripts via subprocesso com logs em tempo real (SSE).
- Range de datas do tracker deve vir dos arquivos importados na sessao atual, nao de pendencias antigas no banco.
- Implementacao deve funcionar em Linux e Windows.

### 4.2 Busca (Pessoa e Contrato)
- Busca por pessoa: nome/CPF, com detalhes de enderecos, telefones, emails e contratos vinculados.
- Busca por contrato: grupo/cota com filtro de status.
- Modal de contrato deve incluir dados do contrato, devedor, avalista, parcelas, ocorrencias e tramitacoes.
- Nos telefones, manter botoes de acao visual (ligar/mensagem) conforme implementado.
- Detalhe de contrato (Busca, Cobranca e modulos que usam o mesmo modal): quando ha `idContrato`, WhatsApp/SMS/e-mail usam mensagem automatica partilhada via `data-wa-auto-contrato`, `data-sms-auto-contrato`, `data-email-auto-contrato` e `data-primeiro-nome` nos botoes (ver `static/busca.js` `renderPessoaSection`); sem contrato no contexto, o fluxo manual continua.

### 4.3 Relatorios
- Filtro por tipo + range de datas.
- Exportacao para Excel e PDF.
- Query de "novos" deve considerar ocorrencia de contrato novo no periodo.
- "Abertos" segue logica dedicada baseada em contrato aberto e agregacao de data de ocorrencia.

### 4.4 Dashboard
- KPIs e graficos baseados em banco (nao dados hardcoded).
- Reaproveitar logica de status/queries de relatorios quando fizer sentido.

### 4.5 Performance por safra
- Safra em 4 partes no mes: 1-9, 10-12, 13-19, 20-fim.
- Analise usa `ocorrencia.data_arquivo` para eventos de aberto/fechado/indenizado.
- Visao de 30/60/90 dias usa mes selecionado + dois meses seguintes.
- Definicao de safra prioriza entrada em cobranca (contrato novo/voltou) e parcela de entrada.

### 4.6 Discador
- Botao de ligar deve acionar API backend (`/api/discar`), nunca expor token no frontend.
- Numero de origem vem de `funcionario.ramal` do usuario logado.
- Configuracao via `DISCADOR_URL`, `DISCADOR_USUARIO`, `DISCADOR_TOKEN`.

### 4.7 SMS e e-mail automáticos (importacao / distribuicao)
Lote na pagina de importacao (preview, POST envio, export Excel): gestor/admin, rotas `/api/importacao/distribuicao/sms-automatizados/`, codigo em `app.py` (`_SMS_AUTOM_DISTRIBUICAO_SQL`, `_sms_automatizados_template_id_por_dias`, `_sms_automatizados_analise`, `_auto_envio_contrato_canais`, POST).

**Universo:** todos os registos em **`contrato`** com **`status = aberto`**, com `LEFT JOIN pessoa` (devedor). **Nao** se filtra por `funcionario_cobranca`.

**Metrica de dias:** `DATEDIFF(data_atual, MIN(vencimento))` sobre **`parcela`** com `status = aberto` do contrato (CTE `MenorVencimento`, igual à base do Excel). `_SMS_AUTOM_DISTRIBUICAO_SQL` usa esse JOIN em vez de subconsulta correlacionada por contrato. Valores **negativos** (vencimento no futuro) nao disparam.

**Disparo (pontos fixos):** envio/preview apenas quando essa diferenca e **exactamente** **0, 16, 31, 61 ou 85** dias (sem faixas).

**Canais:** para cada contrato elegivel, o POST pode enviar **SMS**, **e-mail** ou **ambos** via JSON opcional `{"canais":["sms"]}`, `["email"]` ou `["sms","email"]` (padrao: ambos). SMS via MessageCenter `enviarsms`; e-mail via `EnviarEmailHtml`; **mesmo texto** (`_mensagem_sms_auto_importacao` → HTML simples). Na UI de importacao, o preview abre um modal com botoes separados (so SMS, so e-mail, SMS+e-mail).

**Preview (modal):** `_sms_automatizados_analise` usa `_SMS_AUTOM_PREVIEW_ROTEIRO_SQL` — mesmo critério que `_SMS_AUTOM_EXCEL_SQL` (lista exportável) — mais contagens em memória de telefone/e-mail e lotes para `envio hoje`. O POST em lote continua a iterar `_SMS_AUTOM_DISTRIBUICAO_SQL` e `_resolve_ids_registro_*` por tentativa.

**Anti-duplicidade no dia:** se ja existir registo em **`registro_sms`** ou **`registro_email`** para o **mesmo `id_contrato`** com `DATE(created_at) = CURDATE()`, o contrato **nao** recebe novo disparo neste fluxo nem nos lotes da pagina **Cobrança** (`/api/automacao/sms` ou `/api/automacao/email`), que aplicam a mesma rota de dias e esta regra.

**Cobrança (rodapé SMS/E-mail):** botão «SMS / E-mail» abre modal no mesmo estilo da Importação (`importacao.css` + `cobranca.html`); `POST /api/cobranca/sms-email/preview` com `contrato_ids` da lista visível; resumo em `<dl class="sms-preview-stats">` e ações **Enviar só SMS / só e-mail / ambos** → `POST /api/automacao/sms`, `email` ou `sms_email` (anti-duplicado do dia).

**Templates (texto `_mensagem_sms_auto_importacao`):** mapeamento dias → `template_id`: **0→1**, **16→2**, **31→3**, **61 ou 85→4**. Templates 2 e 3 usam `_format_parcelas_sms_auto` para o texto das parcelas.

**Telefones / e-mails:** no **envio** (POST), validação `_resolve_ids_registro_sms` e `_resolve_ids_registro_email` como no envio unitário; o **preview** (`_sms_automatizados_analise` e `_analise_automacao_carteira`) usa a mesma fila de contratos mas validação em memória para não estourar tempo de resposta.

**Export Excel:** query dedicada `_SMS_AUTOM_EXCEL_SQL` (CTE `MenorVencimento`: `MIN(vencimento)` por contrato em parcelas `aberto`; filtro `dias_atraso IN (0,16,31,61,85)`). Folha com colunas **Grupo**, **Cota** e **Dias de atraso** (lista o roteiro; pode incluir contratos sem telefone/e-mail valido). Na UI de importação o botão **Lista SMS/E-mail** fica no rodapé do modal «SMS / E-mail automáticos» (à esquerda de «SMS e E-mail»).

**JSON:** `ignorados_sem_entrada` mantido a **0** (compatibilidade); contratos fora dos dias contam em `ignorados_sem_template`; resposta POST inclui `envios_sms`, `envios_email`, `ignorados_sem_email`, `ignorados_ja_enviados_hoje`.

**Alteracoes de produto:** mudar lista de dias, universo (ex. voltar a filtrar por distribuicao), ou criterio de parcela exige actualizar esta secao e preview/POST/Excel em conjunto.

## 5) Tabelas e entidades chave

- `contrato`, `pessoa`, `parcela`, `ocorrencia`
- `telefone`, `email`, `endereco`
- `tramitacao`, `agenda`
- `funcionario`, `funcionario_cobranca`
- `arquivos_gm` e tabelas de importacao GM

## 6) Diretriz de implementacao futura

Ao receber uma nova tarefa:
1. Preservar comportamento ja estabilizado.
2. Priorizar compatibilidade com dados existentes no banco.
3. Reutilizar endpoints/helpers ja existentes antes de criar novos.
4. Validar impacto em modais de detalhes (contrato/pessoa), pois sao compartilhados em varios modulos.
5. Se mudar regra de negocio, registrar neste arquivo e no README.
