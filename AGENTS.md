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

- Metodologia de engenharia **obrigatoria** para agentes e desenvolvimento: `.cursor/rules/metodologia-joao-barbosa.mdc` (sempre aplicar; nao descumprir).
- Nao commitar segredos (`.env`, tokens, credenciais).
- Usar variaveis de ambiente: `DB_*`, opcional `MYSQL_*`, `FLASK_SECRET_KEY`.
- Mudancas pequenas e legiveis; evitar refactor amplo sem pedido explicito.
- Nao silenciar erros; retornar mensagens claras sem expor dado sensivel.
- Manter compatibilidade entre `app.py` e scripts em `Python/` para nomes `DB_*`.
- Atualizar README/docs quando mudar setup, comportamento ou convencao.
- **Deploy:** manual (sem CI/CD no repo); ver [`docs/DEPLOY.md`](docs/DEPLOY.md) e secao correspondente no [`README.md`](README.md). Servidor de testes tipicamente VM atras de VPN; Gunicorn com **1 worker** por estado de importacao GM em memoria.

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
- "Abertos" segue logica dedicada baseada em contrato em cobrança (`status = cobranca` na BD) e agregacao de data de ocorrencia.

### 4.4 Dashboard
- KPIs e graficos baseados em banco (nao dados hardcoded).
- Reaproveitar logica de status/queries de relatorios quando fizer sentido.

### 4.5 Performance por safra
- Safra em 4 partes no mes: 1-9, 10-12, 13-19, 20-fim.
- Analise usa `ocorrencia.data_arquivo` para eventos de cobranca/pago/indenizado.
- Visao de 30/60/90 dias usa mes selecionado + dois meses seguintes.
- Definicao de safra prioriza entrada em cobranca (contrato novo/voltou) e parcela de entrada.
- Export Excel (`/api/performance/export/xlsx`): aba **Resumo Safras** com cohort (contratos + soma R$ parcela metrica, sem R$ credito), **Performado** na planilha como ate 30d (exclusivo), ate 60d e ate 90d **cumulativos** (SQL: quitacao >90d entra em `d90`; sem coluna performado >90); **Nao performado** (b30/b60/b90/b+); linha **TOTAL** com somas. Abas **Resumo Safras pivot** e **Resumo pivot notas**. CSV Power BI: `resumo_safra_tidy` sem medida de credito.

### 4.6 Discador
- Botao de ligar deve acionar API backend (`/api/discar`), nunca expor token no frontend.
- Numero de origem vem de `funcionario.ramal` do usuario logado.
- Configuracao via `DISCADOR_URL`, `DISCADOR_USUARIO`, `DISCADOR_TOKEN`.

### 4.7 SMS e e-mail automáticos (importacao / distribuicao)
Lote na pagina de importacao (preview, POST envio, export Excel): gestor/admin, rotas `/api/importacao/distribuicao/sms-automatizados/`, codigo em `app.py` (`_SMS_AUTOM_DISTRIBUICAO_SQL`, `_sms_automatizados_template_id_por_dias`, `_sms_automatizados_analise`, `_auto_envio_contrato_canais`, POST).

**Universo:** todos os registos em **`contrato`** com **`status = cobranca`**, com `LEFT JOIN pessoa` (devedor). **Nao** se filtra por `funcionario_cobranca`.

**Metrica de dias:** `DATEDIFF(data_atual, MIN(vencimento))` sobre **`parcela`** com `status = cobranca` do contrato (CTE `MenorVencimento`, igual à base do Excel). `_SMS_AUTOM_DISTRIBUICAO_SQL` usa esse JOIN em vez de subconsulta correlacionada por contrato. Valores **negativos** (vencimento no futuro) nao disparam.

**Disparo (pontos fixos):** envio/preview apenas quando essa diferenca e **exactamente** **0, 16, 31, 61 ou 85** dias (sem faixas).

**Canais:** para cada contrato elegivel, o POST pode enviar **SMS**, **e-mail** ou **ambos** via JSON opcional `{"canais":["sms"]}`, `["email"]` ou `["sms","email"]` (padrao: ambos). SMS via MessageCenter `enviarsms`. **E-mail na pagina Importacao** (`usar_smtp_google=True`): se `GOOGLE_SMTP_USER` e `GOOGLE_SMTP_PASSWORD` estiverem definidos (`Python/google_workspace_smtp.py`), **SMTP Google Workspace**; senao **MessageCenter** `EnviarEmailHtml`. **E-mail na Cobrança** e restantes fluxos que usam `_auto_envio_contrato_canais`: sempre MessageCenter. **Mesmo texto** (`_mensagem_sms_auto_importacao` → HTML + parte texto opcional no SMTP).

**Preview (modal):** `_sms_automatizados_analise` usa `_SMS_AUTOM_PREVIEW_ROTEIRO_SQL` — mesmo critério que `_SMS_AUTOM_EXCEL_SQL` (lista exportável) — mais contagens em memória de telefone/e-mail e lotes para `envio hoje`. No JSON, `sms_previstos` / `emails_previstos` contam **contratos** com pelo menos um contacto válido no canal (alinha ao Excel); `sms_mensagens_previstas` / `email_mensagens_previstas` contam **mensagens** (um SMS por número válido, um e-mail por endereço válido), como o POST. `contratos_previstos_algum_canal` = contratos com SMS ou e-mail previsto. O POST em lote continua a iterar `_SMS_AUTOM_DISTRIBUICAO_SQL` e `_resolve_ids_registro_*` por tentativa.

**Anti-duplicidade no dia:** se ja existir registo em **`registro_sms`** ou **`registro_email`** para o **mesmo `id_contrato`** com `DATE(created_at) = CURDATE()`, o contrato **nao** recebe novo disparo neste fluxo nem nos lotes da pagina **Cobrança** (`/api/automacao/sms` ou `/api/automacao/email`), que aplicam a mesma rota de dias e esta regra.

**Cobrança (rodapé SMS/E-mail):** botão «SMS / E-mail» abre modal alinhado ao da Importação (mesmo `<dl class="sms-preview-stats">`, loading/erro e rodapé com **Lista SMS/E-mail**); `POST /api/cobranca/sms-email/preview` com `contrato_ids` da lista visível; **Lista SMS/E-mail** chama `POST /api/cobranca/sms-email/excel` com os mesmos IDs (mesmo SQL do Excel global com filtro `IN`, não o export gestor-only da distribuição); envio **Enviar só SMS / só e-mail / ambos** → `POST /api/automacao/sms`, `email` ou `sms_email` (anti-duplicado do dia).

**Templates (texto `_mensagem_sms_auto_importacao`):** mapeamento dias → `template_id`: **0→1**, **16→2**, **31→3**, **61 ou 85→4**. Templates 2 e 3 usam `_format_parcelas_sms_auto` para o texto das parcelas.

**Telefones / e-mails:** no **envio** (POST), validação `_resolve_ids_registro_sms` e `_resolve_ids_registro_email` como no envio unitário; o **preview** (`_sms_automatizados_analise` e `_analise_automacao_carteira`) usa a mesma fila de contratos mas validação em memória para não estourar tempo de resposta.

**Export Excel:** query dedicada `_SMS_AUTOM_EXCEL_SQL` (CTE `MenorVencimento`: `MIN(vencimento)` por contrato em parcelas `cobranca`; filtro `dias_atraso IN (0,16,31,61,85)`; inclui `id_pessoa`). Duas folhas **SMS** e **EMAIL** com **listas distintas**: a folha SMS inclui só contratos do roteiro com **telefone válido** para envio; a folha EMAIL só com **e-mail válido** (validação em memória como o preview). Colunas: **Grupo**, **Cota**, **Dias de atraso**, **Telefone(s) disparo** ou **E-mail(s) disparo** (vários com `; `) e **SMS e e-mail?** (`Sim` se ambos os canais válidos naquele devedor). Se um canal não tiver linhas, a folha mostra mensagem explicativa. Na importação, **Lista SMS/E-mail** no modal «SMS / E-mail automáticos»; na Cobrança, `POST` com IDs + `_sms_autom_excel_linhas_carteira`.

**JSON:** `ignorados_sem_entrada` mantido a **0** (compatibilidade); contratos fora dos dias contam em `ignorados_sem_template`; resposta POST inclui `envios_sms`, `envios_email`, `ignorados_sem_email`, `ignorados_ja_enviados_hoje`.

**Alteracoes de produto:** mudar lista de dias, universo (ex. voltar a filtrar por distribuicao), ou criterio de parcela exige actualizar esta secao e preview/POST/Excel em conjunto.

## 5) Tabelas e entidades chave

- `contrato.status` / `parcela.status`: valores ENUM **`cobranca`**, **`pago`**, **`indenizado`** (antes `aberto`/`fechado`; migrar com `Banco/migrate_status_aberto_fechado_para_cobranca_pago.sql`).
- `ocorrencia.status`: inclui **`pago total`** e **`pago parcial`** (substituem o antigo `pago` para o fecho do contrato no GM no tracker: `pago total` quando não restam parcelas em `cobranca`; `pago parcial` quando ainda existem). Migracao só em `ocorrencia`: [`Banco/migrate_ocorrencia_pago_para_total_parcial.sql`](Banco/migrate_ocorrencia_pago_para_total_parcial.sql). Demais valores: `cobranca`, `indenizado`, `parcela paga`, `parcela vencida`, `parcela indenizada`. `performance.ocorrencia_status` mantém o ENUM existente (copia `o.status` só para ocorrencias de entrada em safra, em geral `cobranca`).
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
