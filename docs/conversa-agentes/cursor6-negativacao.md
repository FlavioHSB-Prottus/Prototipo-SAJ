# Context and project overview
_Exported on 5/13/2026 at 09:50:13 GMT-3 from Cursor (3.3.30)_

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano: adicionando `email_html_busca.js` ao layout e alinhando `renderPessoaSection` nos ficheiros indicados.



Aplicando substituições: `cadastro.js` e `relatorios.js` usam o mesmo padrão que `cobranca.js`. `agenda.js` usa `escapeHtml` e variáveis `_pIdA`. `pasta_virtual.js` não tem botão de e-mail.



Trabalho concluído. Resumo do que ficou feito nesta continuação:

### Modais alinhados à Busca
Em **`renderPessoaSection`** foram aplicados o mesmo `_pnSms`, atributos `data-wa-auto-contrato` / `data-sms-auto-contrato` / `data-email-auto-contrato` + `data-primeiro-nome` quando há `idContrato`, e o botão **`btn-enviar-email-html`** com os `data-*` corretos em:

- `static/cadastro.js`
- `static/agenda.js` (com `escapeHtml` e `_pIdA` / `_pEncA`)
- `static/relatorios.js`
- `static/pasta_virtual.js` (inclui o botão de e-mail que antes não existia)
- `static/contrato_detalhes_modal.js` (idem para e-mail)

### Documentação
Em **`AGENTS.md`**, na secção **4.2 Busca**, foi acrescentada uma linha a explicar o comportamento de mensagem automática no detalhe de contrato e os `data-*` nos botões.

### Estado anterior (já estava feito)
- `email_html_busca.js` no **`layout.html`**; removido duplicado em **`busca.html`**
- **`cobranca.js`** já com o bloco alinhado

Todos os to-dos do plano estão **marcados como concluídos**. Se quiseres, no próximo passo podemos só validar à mão um fluxo (Cobrança → contrato → WhatsApp/SMS/e-mail) e um ecrã que use só `ContratoDetalhesModal`.

---

**User**

na pagina @templates/importacao.html , copiar o card que aparece apos clicar no botao SMS/E-mail automatico para a pagina de @templates/cobranca.html quando clicar no botao SMS/E-mail.

---

**Cursor**

Analisando como o card é implementado na importação e o que existe na página de cobrança.



Confirmando: a Cobrança já abre um modal com estrutura semelhante (`sms-preview-stats`), mas o markup/textos e o rodapé diferem da Importação — falta sobretudo o botão «Lista SMS/E-mail».



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano: começando pelo template e, em seguida, backend e JS.



Implementando: adicionando o botão ao template e o endpoint no backend.



Atualizando `cobranca_automacoes.js`: aplicando alterações em blocos.



### O que foi feito

1. **[templates/cobranca.html](templates/cobranca.html)**  
   - No rodapé do modal SMS/E-mail, acrescentado o botão **Lista SMS/E-mail** (`cobrancaSmsCarteiraExcel`), com as mesmas classes que na Importação, entre «Enviar só E-mail» e «SMS e E-mail».

2. **[static/cobranca_automacoes.js](static/cobranca_automacoes.js)**  
   - Loading, erro e nota final alinhados à Importação; `<dl class="sms-preview-stats">` com os mesmos rótulos e ordem que em `importacao.js` (`Contratos analisados (abertos)` ← `carteira_ids`, `Ignorados (fora do roteiro…)` ← `ignorados_fora_rota`, etc.).  
   - Duas linhas extra no fim: sem contrato aberto na lista / sem pessoa.  
   - `lastCobrancaCarteiraPreview` passa a incluir `contrato_ids` para o Excel.  
   - `downloadCarteiraSmsEmailExcel()` faz `POST` para o novo endpoint; o Excel só fica ativo quando há preview com SMS ou e-mail previsto.

3. **[app.py](app.py)**  
   - `_sms_autom_excel_linhas_carteira`: mesmo SQL base que `_SMS_AUTOM_EXCEL_SQL`, com `AND c.id IN (...)`.  
   - `POST /api/cobranca/sms-email/excel`: gera `.xlsx` (Grupo, Cota, Dias de atraso) para os IDs enviados (autenticação igual ao preview).

4. **[AGENTS.md](AGENTS.md)**  
   - Secção 4.7 atualizada: modal da Cobrança espelha o da Importação; Excel da carteira via `POST` com IDs.

### Verificação rápida

- Cobrança → rodapé **SMS / E-mail** → card igual ao da Importação e botão **Lista SMS/E-mail** activo quando há disparos previstos.  
- Excel deve listar só contratos da lista visível que estejam no roteiro de dias (0, 16, 31, 61, 85).

---

**User**

agora adicione as funções dos botões no card alterado de SMS/E-mail de acordo com as condicoes de cada mensagem.

---

**Cursor**

Analisando o modal SMS/E-mail na Cobrança e comparando com a Importação para identificar o que falta nos botões.



Implementando sincronização dos botões do rodapé conforme o estado (loading, erro, sem envio, sucesso), habilitando «Lista SMS/E-mail» quando houver IDs (para alinhar ao texto de erro e permitir exportar o roteiro mesmo sem disparos previstos) e adicionando validações defensivas antes do envio.



Não consigo alterar ficheiros `.js` neste momento (o ambiente está em **Plan mode** e o modo Agente foi recusado). Segue o que falta implementar para os botões obedecerem às condições de cada mensagem; podes colar isto no Cursor em modo Agent ou aplicar manualmente em [`static/cobranca_automacoes.js`](static/cobranca_automacoes.js).

### 1. Função `syncCarteiraSmsModalFooter`

Colocar **depois** de `fmtIntPreview` e **antes** de `fecharModalCarteiraSmsEmail`:

- **`phase: 'loading'`** — desativa envio + Excel (como ao calcular o resumo).
- **`phase: 'error'`** — desativa os três envios; **ativa Lista SMS/E-mail** só se existir `lastCobrancaCarteiraPreview.contrato_ids` (alinha ao texto “use Lista…” quando há lista).
- **`phase: 'sem_previsto'`** — desativa envios (com títulos explícitos); **ativa Excel** se houver IDs (exportar roteiro mesmo sem disparo SMS/e-mail válido).
- **`phase: 'success'` + `pv`** — replica a lógica actual:
  - SMS só se `sms_previstos >= 1`
  - E-mail só se `emails_previstos >= 1`
  - **SMS e E-mail** só se pelo menos um canal tiver previsto; `title` separado para: ambos os canais; só SMS previsto; só e-mail previsto (mensagens que descrevem o lote).

### 2. Substituir manipulação manual dos botões

- Em **`abrirModalCarteiraSmsEmailCarregando`**: em vez do `forEach` nos botões, chamar `syncCarteiraSmsModalFooter({ phase: 'loading' })`.
- Em **`mostrarModalCarteiraSmsEmailErro`**: montar o HTML do erro; só mencionar “Lista SMS/E-mail” se `contrato_ids.length > 0`; depois `syncCarteiraSmsModalFooter({ phase: 'error' })`.
- Em **`mostrarModalCarteiraSmsEmailSemPrevisto`**: acrescentar uma linha de texto a sugerir **Lista SMS/E-mail** para grupo/cota/dias; depois `syncCarteiraSmsModalFooter({ phase: 'sem_previsto' })`.
- Em **`preencherModalCarteiraSmsEmail`**: remover o bloco `if (m.envSms) … if (m.excel)` e substituir por **uma** chamada `syncCarteiraSmsModalFooter({ phase: 'success', pv: pv })`.

### 3. `executarEnvioCarteiraSmsEmail` — condições antes do envio

No início, com `pv = st.pv`:

- Se pediste **sms** e `sms_previstos < 1` → `return`.
- Se pediste **email** e `emails_previstos < 1` → `return`.
- Se pediste **ambos** e os dois contagens são 0 → `return`.

(Os botões já ficam `disabled`, isto evita double‑click ou chamadas inconsistentes.)

Opcional (espelho da Importação): antes de construir `contratos`, desativar **temporariamente** todos os `.sms-autom-envio-btn` e o Excel no overlay; se `contratosIdsParaEnvioCarteira` vier vazio, voltar a chamar `syncCarteiraSmsModalFooter({ phase: 'success', pv })` e mostrar o `alert`; caso contrário fechar o modal e chamar `dispararLote` como hoje.

---

Quando activares **Agent mode** no Cursor, pede para “aplicar o patch em `cobranca_automacoes.js` conforme o resumo acima” ou cola este pedido outra vez com modo Agent — aí consigo aplicar o diff directamente no repositório.

---

**User**

aplique o patch

---

**Cursor**

Aplicando o patch completo: inserindo `syncCarteiraSmsModalFooter` e atualizando as funções relacionadas.



Patch aplicado em [`static/cobranca_automacoes.js`](static/cobranca_automacoes.js). Resumo:

### `syncCarteiraSmsModalFooter(opts)`
- **`loading`**: envio SMS/e-mail/ambos e Excel desativados.
- **`error`**: envio desativado; Excel **ativo** só se existir `contrato_ids` na pré-visualização.
- **`sem_previsto`**: envio desativado com tooltips; Excel **ativo** com IDs (export do roteiro mesmo sem disparos).
- **`success` + `pv`**: replica as regras de antes e define tooltips do botão **SMS e E-mail** conforme há só SMS, só e-mail ou os dois.

### Outras alterações
- **Carregamento / erro / sem previsto** passam a usar `syncCarteiraSmsModalFooter` em vez de desativar botões à mão.
- **Erro**: texto da Lista SMS/E-mail só aparece quando há IDs para exportar.
- **Sem previsto**: texto extra a orientar o uso da Lista SMS/E-mail.
- **`preencherModalCarteiraSmsEmail`**: só chama `syncCarteiraSmsModalFooter({ phase: 'success', pv })`.
- **`executarEnvioCarteiraSmsEmail`**: validação por canal (`sms_previstos` / `emails_previstos`); desativa temporariamente rodapé durante o envio; se não houver contratos elegíveis, repõe o rodapé com `sync` e mostra o alerta (sem fechar o modal).

---

**User**

antes de enviar, aparecer um pop-up para o usuario confirmar se quer enviar ou cancelar.

---

**Cursor**

Inserindo confirmação com `window.confirm` após validar os contratos e antes de desativar os botões e disparar o envio.



Alteração feita em [`static/cobranca_automacoes.js`](static/cobranca_automacoes.js), na função `executarEnvioCarteiraSmsEmail`:

- Depois de montar a lista de contratos e antes de desativar botões ou fechar o modal, é chamado **`window.confirm`** com texto conforme o caso:
  - **Só SMS** — confirma envio de SMS para N contrato(s).
  - **Só e-mail** — confirma envio de e-mail para N contrato(s).
  - **SMS e e-mail** — confirma ambos os canais.

- Em todos os casos há uma linha a avisar que o processamento pode demorar e que **Cancelar** impede o envio.

- Se o utilizador cancelar, **nada é desativado** e o modal do resumo mantém-se como estava.

- Se confirmar, segue o fluxo anterior (desativa rodapé, fecha o modal, `dispararLote`).

---

**User**

na parte de cobranca de dias de atraso, a diferença esta errada pois não esta diminuindo pela data atual, e sim, pela data_arquivo.

---

**Cursor**

Rastreando onde `dias_atraso` é calculado para a página de cobrança e se usa `data_arquivo` em vez da data atual.



Confirmando: `/api/cobranca` usa `DATEDIFF(data_ref, …)` com `data_ref` do último GM; a distribuição na importação já usa `CURDATE()`.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Resumo do que foi alterado em [`app.py`](app.py):

### `GET /api/cobranca`
- `dias_atraso` passa a ser `DATEDIFF(CURRENT_DATE, MIN(par.vencimento))` em vez do primeiro placeholder `data_ref`.
- `params` começa com **`[data_ref]`** (só para `INNER JOIN cobranca ... cob.data_arquivo = %s`). Com **parcelas desordenadas**, continua a acrescentar mais um `data_ref` para `cob_d`.
- Comentário antes de `data_ref` e docstring da função: universo = snapshot GM; atraso = dias até **hoje**.

### `GET /api/operadores/dashboard`
- Subconsulta de `dias_atraso`: `DATEDIFF(CURRENT_DATE, MIN(vencimento))`.
- `cursor.execute(..., (s_ref,))` — um único bind para o JOIN em `cobranca`.
- Docstring e comentário acima do `execute` atualizados.

`python3 -m py_compile app.py` executou sem erros. Todos os to-dos do plano ficaram concluídos.

---

**User**

nos cards detalhes de contrato que aparece na pagina @templates/busca.html e em outras, embaixo da aba de tramitacao, adicione uma outra aba chamada registros sms e email onde vao puxar os dados das tabelas registro_sms e registro_email tudo junto ordenado por data (created_at).

---

**Cursor**

Analisando como o modal de contrato e a aba Tramitação estão implementados e como estão definidas as tabelas `registro_sms` e `registro_email`.



Implementando: adicionando a query na API, abas em `tramitacoes_detail.js`, CSS mínimo e passando `registros_sms_email` em todos os callers.



Implementing API + tabbed UI and updating all callers.



Refactoring `buildSection` to add tabs and initializing tab listeners in `attachModal`.



Here is what was implemented:

### Backend — [`app.py`](app.py)
- Em `api_contrato_detalhe`, após as tramitações, uma query com **`UNION ALL`** entre `registro_sms` e `registro_email` (filtro `id_contrato`), **`LEFT JOIN funcionario`** para nome, ordenação **`ORDER BY created_at ASC, id ASC`**.
- Novo campo JSON: **`registros_sms_email`**, com colunas **`canal`** (`sms` / `email`), **`id`**, **`created_at`**, **`mensagem`**, **`id_funcionario`**, **`funcionario_nome`**.

### Frontend — [`static/tramitacoes_detail.js`](static/tramitacoes_detail.js)
- A área de tramitações virou um bloco com **duas abas**: **Tramitações** e **Registros SMS e E-mail** (contadores nos botões).
- Segunda aba: tabela **Data | Canal | Funcionário | Mensagem** (mensagem com scroll até ~120px).
- **`attachModal`** passa a registrar os **cliques nas abas antes** do `if (!onReload) return`, para as abas funcionarem mesmo onde não há reload.

### Estilo — [`static/busca.css`](static/busca.css)
- Estilos para `.contrato-tramit-tab-bar`, `.contrato-tramit-tab-btn` e `.regsms-email-msg`.

### Chamadas ao `buildSection`
Em **`busca.js`**, **`cadastro.js`**, **`contrato_detalhes_modal.js`**, **`cobranca.js`**, **`pasta_virtual.js`**, **`operadores.js`**, **`relatorios.js`** e **`agenda.js`**, foi passado  
`registrosSmsEmail: data.registros_sms_email || []`.

**Nota:** SMS usa badge `status-active`, e-mail usa `status-success` (ambos já referenciados em `busca.css` / padrão do projeto). Se quiser **ordem mais recente primeiro**, basta trocar no SQL para `ORDER BY x.created_at DESC`.

---

**User**

na pagina @templates/operadores.html , adicione um botao para editar operador/funcionario.

---

**Cursor**

Analisando a página de operadores e o fluxo de dados de funcionários para definir um plano.



Confirmando: o fluxo de edição já existe — botão com ícone de lápis no cabeçalho de cada cartão e handler que abre o modal `operadorFuncionarioModal`.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementação feita conforme o plano:

### [`static/operadores.js`](static/operadores.js)
- O botão `.btn-edit-operador` no cabeçalho do cartão passou a ter ícone + texto **Editar**, com `aria-hidden` no ícone para manter o `aria-label` do botão como nome acessível.

### [`static/operadores.css`](static/operadores.css)
- `.btn-edit-operador` deixou de ser quadrado fixo 38×38: usa `min-height: 38px`, `padding: 8px 14px`, `gap: 8px`, `font-size`/`font-weight` e `font-family: inherit` para o rótulo ficar legível ao lado do ícone.

O handler existente (`closest('.btn-edit-operador')` → `openOperadorFuncionarioForm(id)`) permanece válido.

---

**User**

adicionar o campo de ramal, fila e apikey ao criar um novo ou editar funcionario.

---

**Cursor**

Procurando como `funcionario` usa ramal, fila e apikey no projeto.



Adicionando `ramal`, `fila` e `apikey` ao fluxo admin: colunas já existem em `funcionario`. Implementando backend (GET/POST/PUT com validação de unicidade) e formulário + JS.



Corrigindo a ordem no PUT: processar `ramal`, `fila` e `apikey` antes de `if not updates`, para permitir atualizar apenas esses campos.



Envolvendo as verificações de duplicidade em try/except para evitar 500 se `_parse_optional_int_funcionario_field` falhar.



Resumo do que foi feito:

### [`app.py`](app.py)
- Função auxiliar `_parse_optional_int_funcionario_field` (inteiro opcional ou vazio → `None`).
- **POST** `/api/admin/funcionario`: lê `ramal`, `fila`, `apikey`; valida tamanho da API key (≤255); checa unicidade de ramal, fila e apikey antes do `INSERT`; inclui as 3 colunas no `INSERT`.
- **GET** `/api/admin/funcionario/<id>`: passa a retornar `ramal`, `fila`, `apikey`.
- **PUT**: atualiza `ramal`, `fila` e `apikey` quando vierem no JSON; validação e checagem de conflito com outros funcionários; ordem ajustada para esses campos entrarem no `SET` antes do teste `if not updates`.

### [`templates/operadores.html`](templates/operadores.html)
- Após “Acesso externo”, três campos: **Ramal** e **Fila** (`type="number"`) e **API key** (texto, `maxlength="255"`, `autocomplete="off"`).

### [`static/operadores.js`](static/operadores.js)
- `optionalIntInputValue` para enviar `null` quando vazio ou inválido.
- `fillOperadorFormFields` preenche `ofRamal`, `ofFila`, `ofApikey`.
- `collectOperadorPayload` envia `ramal`, `fila`, `apikey` (apikey vira `null` se o campo estiver vazio).

As colunas já existem em `funcionario` (`Banco/criar_banco.py`: `ramal`, `fila`, `apikey` com UNIQUE). Valores vazios no formulário viram `NULL` no banco, no mesmo padrão dos outros campos opcionais.

---

**User**

em todos os relatorio gerados de excel, gerar uma coluna que é a junção do grupo e a cota de um contrato ("numero grupo"/"numero cota") e outra coluna chamada atraso que mostra a diferenca de dias a partir da data atual e da data de vencimento mais antiga da parcela com status 'aberto'.

---

**Cursor**

Procurando onde os relatórios Excel são gerados e como os dados de contrato/parcelas são obtidos.



Confirmando: vários Excels já têm “Grupo/Cota” ou “Dias de atraso”; o pedido unifica o formato e acrescenta “Atraso” com `DATEDIFF(CURRENT_DATE, MIN(vencimento))` nas parcelas em aberto, alinhado ao módulo Cobrança.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano completo: começando pelos relatórios e seguindo pelos demais exports.



Implementando alterações nos relatórios e, em seguida, nos demais exports.



Aplicando alterações em SMS, negativação e performance/dashboard.



Atualizando Performance e Dashboard.



Resumo do que foi implementado em [`app.py`](app.py):

### Relatórios (`/api/relatorios/excel` e PDF)
- **`_RELATORIO_COLUMNS`**: inclui **Grupo/Cota** (`grupo_cota`) e **Atraso** (`atraso`).
- **`_build_relatorio_query`**: `LEFT JOIN` com parcelas em aberto (`MIN(vencimento)`), `CONCAT_WS('/', c.grupo, c.cota) AS grupo_cota` e `DATEDIFF(CURRENT_DATE, …) AS atraso`.
- **`pagos_parcialmente`**: mesmo padrão de join e campos.
- **`_build_relatorio_query_abertos`**: `grupo_cota` + **`atraso`** = `DATEDIFF(CURRENT_DATE, parc.min_v)` (mantém `dias_atraso` ao snapshot).
- **PDF**: `col_widths` com 8 colunas alinhadas à nova lista.

### SMS / e-mail (importação e carteira cobrança)
- **`_sms_autom_fill_rota_excel_duas_folhas`**: colunas **Grupo**, **Cota**, **Grupo/Cota**, **Atraso**, …; linhas vazias com 7 células.

### Negativação
- **`_negativacao_distribuicao_excel_row`** e Excel da importação: **Grupo**, **Cota**, **Grupo/Cota**, …, **Atraso** (antes “Dias de atraso”).
- **Listagem** (`/api/negativacao/listagem/excel`): cabeçalhos com **Grupo**, **Cota**, **Grupo/Cota**, …, **Atraso**; **`_negativacao_listagem_excel_row`** devolve 15 colunas; placeholders com 14 `''`.

### Performance (export xlsx / CSV Power BI / PDF)
- Query dos contratos em **`_fetch_export_dataset`**: `grupo_cota` e join **`pv`** para **`atraso`**.
- **`_export_to_xlsx`** (aba Contratos): headers/keys atualizados.
- **`_export_to_csv_powerbi`**: cabeçalho e linhas com grupo, cota, grupo_cota, atraso.
- **`_export_to_pdf`**: tabela de contratos com **G/C**, **Atraso**, etc.

### Dashboard (export xlsx / CSV / PDF)
- **`_fetch_dash_export_dataset`**: `CONCAT_WS`, join **`dash_pvat`** e campo **`atraso`**.
- **`_dash_export_to_xlsx`** / **`_dash_export_to_csv_powerbi`** / **`_dash_export_to_pdf`**: mesmas ideias (CSV com linha de cabeçalho antes dos dados).

**Semântica de Atraso:** `DATEDIFF(CURRENT_DATE, MIN(vencimento))` em parcelas **`status = 'aberto'`** por contrato; vazio/`NULL` se não houver parcela aberta.

---

**User**

na pagina @templates/importacao.html , ao clicar para enviar email, usar o smtp do google workspace @smtp.py . adicionar no script app.py

---

**Cursor**

Analisando o fluxo de envio de e-mail na importação e o conteúdo de `smtp.py`.



Implementando: refatorando `smtp.py` para usar variáveis de ambiente (sem credenciais no código) e integrando o envio na rota de e-mails automáticos da importação em `app.py`.



Adicionando o import e alterando o envio de e-mail na importação para usar SMTP quando configurado, com fallback para o MessageCenter.



### O que foi feito

1. **[`smtp.py`](smtp.py)**  
   - Módulo reutilizável: `google_smtp_config_from_env()` e `send_google_workspace_email(...)`.  
   - Credenciais só por ambiente: `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_PASSWORD` (obrigatórios para usar SMTP); opcionais `GOOGLE_SMTP_HOST` (default `smtp.gmail.com`), `GOOGLE_SMTP_PORT` (587), `GOOGLE_SMTP_FROM` (default = user).  
   - Removidos e-mail/senha em texto do repositório (alinha às regras do projeto).

2. **[`app.py`](app.py)**  
   - `import smtp as _smtp_google_workspace`.  
   - Nova função **`_importacao_envio_email_auto`**: se o SMTP Google estiver configurado, envia com `send_google_workspace_email` (assunto `Cobranca`, HTML + parte texto plana com a mesma mensagem do SMS); senão mantém **`_messagecenter_post_email_html`**.  
   - Em **`_auto_envio_contrato_canais`**, o ramo de e-mail passou a usar `_importacao_envio_email_auto` (fluxo do botão “Enviar só E-mail” / “SMS+e-mail” na importação e o lote equivalente em Cobrança, que usa a mesma função).

3. **[`.env.example`](.env.example)**  
   - Comentários com as variáveis `GOOGLE_SMTP_*`.

4. **[`AGENTS.md`](AGENTS.md)**  
   - Secção 4.7 atualizada com a regra SMTP vs MessageCenter.

**Configuração:** copie as variáveis para o `.env` e use uma **senha de app** do Google Workspace (não commitar). Sem `GOOGLE_SMTP_USER` / `GOOGLE_SMTP_PASSWORD`, o comportamento continua sendo MessageCenter.

---

**User**

o uso do smtp so funciona na pagina de importacao?

---

**Cursor**

**Não.** O SMTP Google (quando `GOOGLE_SMTP_USER` e `GOOGLE_SMTP_PASSWORD` estão definidos) é usado em **todo envio de e-mail que passa por** `_auto_envio_contrato_canais`, não só na importação.

Esse helper é chamado em dois sítios:

1. **Importação** — `POST /api/importacao/distribuicao/sms-automatizados` (modal “Enviar só E-mail” / “SMS + e-mail”).
2. **Cobrança** — `POST /api/automacao/...` com tipo `email` ou `sms_email`, que também chama `_auto_envio_contrato_canais` para cada contrato da lista (por volta da linha 11153 em `app.py`).

Ou seja: **mesma lógica** de e-mail automático (roteiro 0/16/31/61/85, registo em `registro_email`, etc.) na importação e na carteira de cobrança.

O que **continua só no MessageCenter** são outros fluxos, por exemplo:

- `POST /api/enviar-email-html` (envio unitário a partir das telas de contato),
- e outros pontos que chamam `_messagecenter_post_email_html` diretamente (há pelo menos um por volta da linha 6147, p.ex. e-mail em massa de relatórios).

O nome `_importacao_envio_email_auto` no código refere-se ao **tipo de mensagem** (automático / importação), mas a função é partilhada com o lote da cobrança.

---

**User**

o uso do smtp, deve ser só usado na pagina de importacao ao clicar para enviar email. nas outras pagina, manter a api de enviar email.

---

**Cursor**

Restringindo o SMTP ao fluxo da importação e mantendo o MessageCenter nos demais (incl. Cobrança).



Adicionando o parâmetro `usar_smtp_google` a `_auto_envio_contrato_canais`, passando `True` apenas na rota da importação.



Alterações feitas:

### [`app.py`](app.py)
- **`_auto_envio_contrato_canais`** ganhou o parâmetro opcional **`usar_smtp_google=False`**.
- Com **`usar_smtp_google=True`**: usa `_importacao_envio_email_auto` (SMTP se `GOOGLE_SMTP_*` existirem; senão MessageCenter).
- Com **`False`** (padrão): e-mail **sempre** por **`_messagecenter_post_email_html`**.
- Só o **`POST /api/importacao/distribuicao/sms-automatizados`** passa **`usar_smtp_google=True`**.
- O lote da **Cobrança** (`/api/automacao/...`) continua sem esse argumento → só MessageCenter.

### [`AGENTS.md`](AGENTS.md) e [`.env.example`](.env.example)
- Texto alinhado: SMTP Google **apenas** no lote de e-mail da **Importação**; Cobrança e restantes fluxos seguem na API MessageCenter.

---

**User**

bloquear ao usuario com nivel_acesso igual a 'cobranca' de enviar email e mostrar pop-up com a mensagem "voce nao tem permissao"

---

**Cursor**

Procurando rotas de envio de e-mail e como o nível de acesso é validado na sessão.



Implementando: helper no backend, bloqueio nas rotas de envio e ajuste dos alerts no JS.



Segue o que foi implementado:

### Backend (`app.py`)
- Constante **`_EMAIL_ENVIO_PERFIL_COBRANCA_MSG`** e helper **`_cobranca_json_sem_permissao_envio_email()`**, que devolve **403** com `{"error": "voce nao tem permissao"}` quando o nível normalizado da sessão é **`cobranca`**.
- **`api_enviar_email_html`**: bloqueio logo após verificar login (antes de aceder ao MessageCenter).
- **`api_automacao`**: bloqueio só para **`email`** e **`sms_email`**; **`sms`** e **`ligacao`** continuam permitidos para cobrança.

### Frontend
- **`email_html_busca.js`**: inclui `status` na resposta do `fetch`; em **403** ou quando o `error` é a mensagem de permissão, mostra **`alert('voce nao tem permissao')`** (sem prefixo “Falha:”).
- **`cobranca_automacoes.js`**: no fluxo de **`dispararLote`**, para **`email`** / **`sms_email`**, em **403** ou com esse `error`, fecha o overlay de status e mostra o mesmo **`alert`**.

Rotas já restritas a gestor/admin (ex.: **`/api/relatorios/email-lote`**, importação **`sms-automatizados`**) não foram alteradas. Utilizadores de cobrança continuam a poder usar SMS e outras automações que não enviem e-mail.

---

**User**

no tracker, se um contrato for indenizado, antes de indenizar as parcelas, registrar a positivacao das parcelas que serão indenizadas. desta forma, quando um contrato for indenizado, todas as suas parcelas com status 'aberto' e que vao ficar com status 'indenizado', vao ser positivados

---

**Cursor**

Analisando o fluxo do tracker e como indenização e positivação são tratados no código.



Confirmando: no ramo `missing_contracts`, `_liberar_negativacao_parcela_paga` só corre quando `status_parc == "fechado"`; para `indenizado` as parcelas são atualizadas sem positivação.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementação feita em [Python/tracker_gm_range_date_contratos.py](Python/tracker_gm_range_date_contratos.py).

No ramo `missing_contracts`, depois do `SELECT` da parcela em `aberto` e **antes** do `UPDATE` que passa o status para `indenizado`, passa a chamar `_liberar_negativacao_parcela_paga` quando `status_parc == "indenizado"` e existe `row_parc["id"]` — o mesmo fluxo de histórico + remoção em `negativacao` que já existia para `fechado`, mas com a ordem pedida para indenização.

Comentário no código atualizado para documentar o comportamento. To-do marcado como concluído.

---

**User**

@sistema.geracao.arquivo.negativacao.serasa.php de acordo com este script que gera um txt de negativacao na estrutura correta, ajeite o script que gera o txt de negativacao @templates/negativacao.html usando o script como base de estrutura do txt.

---

**Cursor**

Analisando o PHP de referência e o fluxo em `negativacao.html` para definir um plano alinhado.



Confirmando: o TXT é gerado no backend (`Python/serasa_conv_txt.py` + `app.py`); `negativacao.html` só carrega `negativacao.js`, que chama `/api/negativacao/serasa-arquivo-txt`. O plano cobre alinhar o gerador ao PHP e, se necessário, pequenos ajustes de UI/copy em `negativacao.js`.



O ficheiro `templates/negativacao.html` não contém lógica de geração do TXT — apenas inclui `negativacao.js`, que chama a API Flask. O layout real está em `Python/serasa_conv_txt.py` e os dados em `app.py` (`_negativacao_fetch_serasa_inclusao_payloads`). O plano foca o alinhamento ao PHP; o HTML pode ficar sem alteração ou com nota mínima se quiserem documentação visível.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o alinhamento ao PHP: analisando a linha de detalhe atual (600 chars) e refatorando.



Verificando o comprimento da linha do sample e implementando o layout PHP completo.



Reescrevendo `montar_linha_detalhe_inclusao` e atualizando `montar_arquivo_txt` e `app.py`.



Alinhando o campo interno de 6 caracteres ao PHP (`000127` fixo, como no legado).



Resumo do que foi feito:

### [Python/serasa_conv_txt.py](Python/serasa_conv_txt.py)
- **`montar_linha_detalhe_inclusao`** passou a seguir o legado PHP: prefixo **`1I`** (inclusão) ou **`1E`** (exclusão) via `tipo_operacao_ie`; campo interno fixo **`000127`**; **`motivo_baixa`** `00` / `02`; documento **F/J + dígito 2/1 + 15 dígitos** + motivo + **55** espaços; **logradouro 45 + bairro 20**; cidade 25; UF 2; CEP 8; **valor 15** (centavos); contrato numérico 16; **`000000000`**; **`J10`** + bloco **51** (CNPJ 14 + razão 37); `  ` + código 4 + **70** espaços + sequencial 7 — **600** caracteres.
- Nova **`_montar_j10_bloco_credor_51`**: CNPJ/nome por código **5016** (GMAC) / **5015** (MAPFRE), como no PHP.
- **`montar_arquivo_txt`**: `tipo_operacao_ie` por defeito **`I`** em inclusão; `codigo_credor` do payload não duplica com o argumento explícito (`pop` antes do `**pl`).
- Mantidos **`montar_meio_67`** / **`montar_credor_113`** por compatibilidade (já não entram na linha de detalhe).

### [app.py](app.py)
- **`import re`**.
- **`_negativacao_fetch_serasa_inclusao_payloads`**: `e.bairro`, `valor_centavos` (centavos a partir de `valor_total`/`valor_nominal`), `empresa_apelido`, `credor_documento`; **`codigo_credor`** `5015` se `MAPFRE` no apelido, senão **`5016`**; **`cnpj_credor`** só se o documento do credor tiver ≥14 dígitos.

### [app.py](app.py) — rota
- Docstring de **`api_negativacao_serasa_arquivo_txt`** atualizada (**`1I`**, motivo `00`, layout PHP).

### [static/negativacao.js](static/negativacao.js)
- Confirmação do lote carteira e comentário de **`downloadSerasaConvTxt`** alinhados ao novo layout.

**Nota:** `templates/negativacao.html` não foi alterado (só carrega o JS; sem lógica de TXT).

**Verificação:** geração de ficheiro de teste com `PYTHONPATH=Python` — cabeçalho 600 chars, linha de detalhe com **`1I000127`** e comprimento 600.

---

**User**

o que seria o 5016 no arquivo txt?
ex:
1I0001272026051120260410C3     F200002875369784700                                                       JAILSON MESSIAS DE SOUZA                                              19800510                                                                                                                                            RUA GUIDO ALVES PEREIRA 118                  JARDIM O L CAMARGO  RIBEIRAO PRETO           SP140663400000000000730200000000190150266000000000J1049937055000111GMAC ADMINISTRADORA DE CONSORCIO LTDA  5016                                                                      0000002

---

**Cursor**

O **5016** no TXT SERASA-CONVEM é o **código do credor / produto** que identifica **quem está a registar a negativação** junto do convênio (no vosso legado PHP, era o `cod_id_serasa` associado à **GMAC** — administradora GM; a **MAPFRE** usava **5015**).

Na linha que mostrou, o bloco final segue o padrão do layout: depois de **`J10`** + **14 dígitos de CNPJ** + **37 caracteres do nome da credora** (`GMAC ADMINISTRADORA DE CONSORCIO LTDA`), vêm **dois espaços** e depois os **4 dígitos** `5016` — é esse identificador institucional no ficheiro, não o número da parcela nem o contrato.

No protótipo actual isso vem de `codigo_credor` em [Python/serasa_conv_txt.py](Python/serasa_conv_txt.py) (`_montar_j10_bloco_credor_51` / linha de detalhe) e em [app.py](app.py) em `_negativacao_fetch_serasa_inclusao_payloads` costuma ser **5016** por defeito e **5015** quando o apelido da empresa contém **MAPFRE** (regra alinhada ao PHP antigo).

---

**User**

coloque o codigo do credor para a posicao 527.
ex:
1I0001272026031020260310C3     F200003036168184400                                                       FABIANA CRISTINA DIAS                                                 19830520                                                                                                                                            RUA CASSEMIRO GOMES FILHO 870                                    BOTUCATU                 SP186064000000000000822560000000960110190000000000J1049937055000111GMAC ADMINISTRADORA DE CONSORCIO LTDA         5016                                                               0000009

---

**Cursor**

Analisando o layout atual da linha de detalhe e a posição de `5016` no exemplo.



Verificando no exemplo do utilizador o índice de `5016` e ajustando o padding.



Ajustando o layout: o exemplo tem 600 caracteres e `5016` começa na coluna 527 (índice 526). O prefixo atual termina em 519 caracteres antes do código — adicionar 7 espaços antes de `5016` e reduzir os espaços posteriores de 70 para 63.



A posição do `5016` está correta (coluna 527). A linha completa difere do teu exemplo noutros campos (ex.: contrato/valor), por causa dos dados de teste — o pedido era só alinhar o código do credor.



Alteração feita em [Python/serasa_conv_txt.py](Python/serasa_conv_txt.py):

- Constante **`_POS_INICIO_CODIGO_CREDOR_1 = 527`** (primeira coluna 1-based do código de 4 dígitos).
- A linha de detalhe passa a ser montada assim: **`prefix`** (até aos dois espaços após o bloco de 51 caracteres do `J10`) + **`pad_before`** espaços para o prefixo ficar com comprimento **526** (índice 0) + **`cod4`** + **`pad_after`** espaços + **sequencial 7** (`pad_after` calculado para manter **600** caracteres).

Assim o `5016` (ou outro `cod4`) fica sempre a começar na **posição 527**, como no teu exemplo. Antes havia só 519 caracteres antes do código; agora há **7** espaços extra antes do `5016` e **63** espaços depois (em vez de 70), para o total continuar 600.

---

**User**

no banco e nos scripts, faça alteracao nos status de contrato e parcela.
- substituir status 'aberto' para 'cobranca'
- substituir status 'fechado' para 'pago'

---

**Cursor**

Mapeando o uso de `aberto` e `fechado` em esquema e código para dimensionar o impacto.



Confirmando: `ocorrencia` também usa os literais `aberto`/`fechado` no schema — o plano inclui alinhar isso para o tracker e relatórios não ficarem incoerentes.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano completo: começando pelo script SQL e pelo schema em `criar_banco.py`, depois `app.py` e os restantes ficheiros.



Criando o ficheiro SQL de migração e atualizando `criar_banco.py`. Em seguida aplicando substituições seguras em `app.py`.



## Estado

Todos os itens do plano foram aplicados (o ficheiro do plano não foi alterado).

### Base de dados
- **`Banco/migrate_status_aberto_fechado_para_cobranca_pago.sql`**: já existia; confirmei que corre em MariaDB (expandir ENUM → UPDATE → contrair). Na tua BD local `consorcio_gm` o script executou com sucesso e os ENUMs de `contrato`/`parcela` ficaram `cobranca`/`pago`/`indenizado`.
- **`Banco/criar_banco.py`**: ENUMs e `DEFAULT` alinhados a `cobranca`/`pago` em `contrato`, `parcela`, `ocorrencia` e `performance.ocorrencia_status`.

### Backend (`app.py`)
- Constantes `_STATUS_BD_COBRANCA`, `_STATUS_BD_PAGO`, `_LEGACY_STATUS_CONTRATO_MAP`, `_STATUS_CONTRATO_VALIDOS` e **`_normalize_contrato_status_arg`** para aceitar ainda `?status=aberto|fechado` nas APIs.
- Literais SQL de estado passaram a **`cobranca`/`pago`**; **`_DASH_PIE_LABELS`** usa chaves `cobranca`/`pago` (coerente com `SELECT status ... GROUP BY status`).
- Tipos de relatório na API **`abertos`** / **`pagos`** mantêm-se; só o SQL usa os novos valores.

### Scripts `Python/`
- **`tracker_gm_range_date_contratos.py`**: `OCORRENCIA_COBRANCA` / `OCORRENCIA_PAGO`, SQL e updates de parcela/contrato coerentes com `pago` em vez de `fechado`.
- **`distribuir_funcionarios_cobranca.py`** e **`performance_sincronizar.py`**: filtros SQL atualizados.

### Frontend
- **`static/*.js`**: classes de badge aceitam **`cobranca`/`pago`** e mantêm **`aberto`/`fechado`** para bases ainda não migradas.
- **`static/dashboard.js`**: `PIE_META` com `cobranca`/`pago` e aliases `aberto`/`fechado` para a pizza.
- **`templates/busca.html`**, **`dashboard.html`**, **`performance.html`**: opções do filtro com `value="cobranca"` / `value="pago"`; textos de ajuda onde fazia sentido (ex. `status=cobranca`).

### Documentação
- **`AGENTS.md`**: SMS automáticos, relatórios, performance e secção 5 atualizados para os literais de BD; referência ao script de migração.

`python3 -m py_compile` nos ficheiros Python alterados passou sem erros.

Se quiseres, no próximo passo podes validar no browser: Busca (filtro status), Dashboard (pizza + painel), Cobrança, importação/tracker e relatórios tipo **Contratos Abertos**.

---

**User**

gere um layout da estrutura do txt de negativacao. mostra a posicao de inicio de cada campo, o tamanho e em qual posicao termina.

---

**Cursor**

Segue o **layout da linha de detalhe de inclusão (negativação)** tal como está implementado em `Python/serasa_conv_txt.py` (`montar_linha_detalhe_inclusao`): **600 caracteres por linha**, **posições em base 1** (início e fim inclusivos), codificação **Latin-1**, ficheiro com **CRLF** (`\r\n`).

---

## Ficheiro (visão geral)

| Ordem | Tipo de linha | Conteúdo |
|------|----------------|----------|
| 1 | Cabeçalho | 600 chars copiados do modelo `SERASA_GM_*4912*.TXT`; substituem-se **data remessa** (primeiro `YYYYMMDD`) e o **token** a partir de `SERASA-CONVEM` (mesmo comprimento). |
| 2 … N−1 | Detalhe inclusão | Uma linha por registo — tabela abaixo. |
| N | Rodapé | `9` + espaços + **sequencial 7 dígitos** (número da última linha do ficheiro). |

**Positivação (exclusão):** só cabeçalho (modelo `*4910*.TXT`) + linha de rodapé com sequencial `2` — **sem** linhas de detalhe.

---

## Linha de detalhe — inclusão (`1` + `I` ou `E`)

O prefixo fixo tem **519** caracteres; seguem **7** espaços de enchimento; **`codigo_credor` (4)** na posição **527–530** (constante `_POS_INICIO_CODIGO_CREDOR_1 = 527`); mais **63** espaços; **sequencial da linha no ficheiro (7)** nas posições **594–600**.

### Campos do prefixo (posições 1–519)

| # | Campo (lógico) | Início | Tamanho | Fim | Notas |
|---|----------------|--------|---------|-----|--------|
| 1 | Tipo registro + operação | 1 | 2 | 2 | `1` + `I` (inclusão) ou `E` (exclusão no mesmo formato de linha). |
| 2 | Sequencial interno fixo | 3 | 6 | 8 | Literal `000127` (parâmetro `seq_interno6` não altera o layout). |
| 3 | Data referência | 9 | 8 | 16 | `AAAAMMDD` (`data_ref`). |
| 4 | Data vencimento | 17 | 8 | 24 | `AAAAMMDD` (`data_vencimento`; se inválida, repete data referência). |
| 5 | Código CX | 25 | 2 | 26 | Ex.: `C3` (`SERASA_CONV_CX_DETALHE`). |
| 6 | Reservado (brancos) | 27 | 5 | 31 | Espaços. |
| 7 | Tipo pessoa + tipo doc + documento + motivo | 32 | 19 | 50 | `F`/`J` (1) + `2`/`1` (1) + CPF/CNPJ **15** dígitos + motivo **2** (`00` se `I`, `02` se `E`). |
| 8 | Brancos | 51 | 55 | 105 | |
| 9 | Nome devedor | 106 | 70 | 175 | Maiúsculas, truncado/preenchido à esquerda com espaços. |
| 10 | Data nascimento | 176 | 8 | 183 | `AAAAMMDD`; `00000000` se pessoa jurídica. |
| 11 | Reservado (brancos) | 184 | 140 | 323 | |
| 12 | Logradouro | 324 | 45 | 368 | |
| 13 | Bairro | 369 | 20 | 388 | |
| 14 | Cidade | 389 | 25 | 413 | |
| 15 | UF | 414 | 2 | 415 | 2 letras. |
| 16 | CEP | 416 | 8 | 423 | Só dígitos, 8 posições. |
| 17 | Valor (centavos) | 424 | 15 | 438 | Inteiro em centavos, **15** dígitos com zeros à esquerda. |
| 18 | Número contrato (grupo+cota) | 439 | 16 | 454 | Dígitos de grupo+cota, **16** posições (`zfill`). |
| 19 | Literal zeros | 455 | 9 | 463 | `000000000`. |
| 20 | Literal `J10` | 464 | 3 | 466 | |
| 21 | Bloco credor 51 | 467 | 51 | 517 | **14** CNPJ + **37** razão social (conforme credor; ver `_montar_j10_bloco_credor_51`). |
| 22 | Espaços | 518 | 2 | 519 | Dois espaços antes do padding. |

### Trailing (posições 520–600)

| # | Campo | Início | Tamanho | Fim | Notas |
|---|--------|--------|---------|-----|--------|
| 23 | Padding | 520 | 7 | 526 | Espaços até **antes** do código credor. |
| 24 | Código do credor | 527 | 4 | 530 | 4 dígitos (`codigo_credor`). |
| 25 | Padding | 531 | 63 | 593 | Espaços. |
| 26 | Sequencial da linha no ficheiro | 594 | 7 | 600 | `seq_linha_arquivo` com 7 dígitos (`zfill`). |

---

## Linha de rodapé (`montar_linha_trailer`)

| Campo | Início | Tamanho | Fim | Conteúdo |
|--------|--------|---------|-----|----------|
| Tipo rodapé + fill | 1 | 593 | 593 | `9` seguido de espaços até totalizar 593 caracteres. |
| Sequencial arquivo | 594 | 7 | 600 | Número da linha (7 dígitos). |

---

## Referência no código

A montagem do prefixo e o alinhamento do código do credor na posição 527 estão em:

```204:244:Python/serasa_conv_txt.py
    prefix = ''.join(
        [
            '1' + tipo_ie,
            '000127',
            dt1,
            dt2,
            _fit(cx, 2, align='left').upper()[:2].ljust(2)[:2],
            ' ' * 5,
            bloco_doc_motivo,
            brancos55,
            _fit(_ascii_latin1(nome, upper=True), 70, align='left', pad=' '),
            dtnasc_linha,
            ' ' * 140,
            _fit(_ascii_latin1(logradouro, upper=True), 45, align='left', pad=' '),
            _fit(_ascii_latin1(bairro, upper=True), 20, align='left', pad=' '),
            _fit(_ascii_latin1(cidade, upper=True), 25, align='left', pad=' '),
            uf2,
            cep8,
            valor15,
            contrato_nrs,
            '000000000',
            'J10',
            bloco51,
            '  ',
        ]
    )
    cod_start0 = _POS_INICIO_CODIGO_CREDOR_1 - 1
    pad_before = cod_start0 - len(prefix)
    ...
    line = prefix + (' ' * pad_before) + cod4 + (' ' * pad_after) + seq7
```

O **cabeçalho de 600 posições** não está decomposto no código (vem do ficheiro modelo em `TXT Negativacao e Positivacao/`); para campo a campo do header seria preciso alinhar ao manual CONVEM ou anotar a partir do `.TXT` de exemplo linha a linha.

Se quiseres, no passo seguinte posso gerar a mesma tabela a partir de um ficheiro `SERASA_GM_*4912*.TXT` concreto da pasta do projeto (deslocamentos exactos do header).

