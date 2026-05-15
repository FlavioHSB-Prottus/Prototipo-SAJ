# Context and project overview
_Exported on 5/12/2026 at 12:52:55 GMT-3 from Cursor (3.3.30)_

---

**User**

no SMS, nao adicionar o 55 no comeco do numero. ajeitar isso na importacao

---

**Cursor**

Removendo o prefixo `55` no fluxo de SMS da importação e revertendo o uso da normalização em `/api/enviar-sms`, removendo o helper se ficar sem uso.



Alterações feitas no [`app.py`](app.py):

1. **SMS em lote da importação** (`/api/importacao/distribuicao/sms-automatizados`): o número passa a ser só **dígitos** do cadastro, **sem** acrescentar `55` no início.

2. **`/api/enviar-sms`**: voltou a usar o mesmo critério (apenas dígitos, sem `55`).

3. Removida a função **`_sms_phone_digits_para_messagecenter`**, que era a responsável por prefixar `55`.

O `_resolve_ids_registro_sms` continua a comparar com as variantes com/sem `55` na BD, por isso o registro em `registro_sms` mantém-se coerente mesmo quando o envio usa só o número nacional.

Reinicia o Flask para carregar o código novo. Se a API MessageCenter voltar a exigir `55`, o formato terá de estar **gravado na base** ou noutro passo explícito — não será mais inferido automaticamente no código.

---

**User**

ao clicar no botao, mostrar quantos SMS's serao enviados.

---

**Cursor**

Adicionando um endpoint de pré-visualização e exibindo a contagem no diálogo de confirmação antes do envio.



Adicionando `GET .../preview` que calcula quantos SMS seriam enviados (após validação de telefone) e atualizando o `confirm` no front para exibir esse número.



Evitando POST desnecessário quando o preview for 0 e mantendo o botão consistente.



Resumo do que foi feito:

### Backend — [`app.py`](app.py)
- Nova rota **`GET /api/importacao/distribuicao/sms-automatizados/preview`** (mesma permissão: gestor/administrador).
- Calcula **`sms_previstos`**: número de envios que o POST faria após as mesmas regras de template e **`_resolve_ids_registro_sms`** (telefone com dígitos + correspondência com cadastro).
- Devolve também **`contratos_com_sms`** (contratos com pelo menos um SMS previsto), **`ignorados_*`**, **`tentativas_bloqueadas_cadastro`** (sem dígitos ou erro na validação), **`contratos_processados`**.

### Frontend — [`static/importacao.js`](static/importacao.js)
1. Ao clicar: estado **“Calculando…”** e **`GET` preview**.
2. Se der erro no preview: alerta e restaura o botão.
3. Se **`sms_previstos === 0`**: alerta explicando que não há SMS a enviar e **não** chama o POST.
4. Se **> 0**: **`confirm`** com texto do tipo:  
   **`Serão enviados X SMS (Y contratos com pelo menos um telefone válido).`** … e só então o **`POST`** de envio.

Assim o utilizador vê sempre quantos SMS serão tentados antes de confirmar o lote.

---

**User**

adicione ao lado do botao de sms na pagina de importacao, um botao que pega os contratos('numero do grupo'/'numero da cota') que vao ter o SMS enviado e cria um arquivo excel que sera baixado.

---

**Cursor**

Analisando a página de importação e padrões de exportação Excel no projeto.



Confirmando: a query do preview não inclui `grupo`/`cota`; será necessário incluí-los na listagem ou na função partilhada.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o helper no backend, refatorando o preview e adicionando o endpoint Excel.



Inserindo a constante SQL e a função `_sms_automatizados_analise` antes da rota `preview`. Verificando onde `_resolve_ids_registro_sms` está definida:



Implementando: inserindo a constante SQL e `_sms_automatizados_analise`, substituindo o preview e adicionando a rota Excel.



Aplicando alterações em HTML, JS e CSS.



Corrigindo o regex de `Content-Disposition`: escape incorreto.



Implementação concluída conforme o plano. Resumo:

### Backend (`app.py`)
- **`_SMS_AUTOM_DISTRIBUICAO_SQL`**: passa a incluir `c.grupo` e `c.cota` no mesmo `SELECT` usado antes para distribuição/SMS.
- **`_sms_automatizados_analise(conn)`**: única fonte da lógica do preview (template dia/atraso 61–85, telefones, `_resolve_ids_registro_sms`). Devolve o dicionário de estatísticas e uma lista de linhas `{grupo, cota, id_contrato, template_id, qtd_sms}` para contratos com pelo menos um SMS válido.
- **`GET .../sms-automatizados/preview`**: apenas autenticação + `_sms_automatizados_analise` + JSON.
- **`GET .../sms-automatizados/excel`**: mesma permissão (`_pode_sms_automatizados_importacao`), `openpyxl`, colunas Grupo, Cota, ID contrato, Template, Qtd SMS; se não houver linhas, cabeçalho + linha *“Nenhum contrato elegivel neste momento.”*; ficheiro `sms_automatizados_distribuicao_YYYYMMDD_HHMM.xlsx`.
- **`POST .../sms-automatizados`**: usa `_SMS_AUTOM_DISTRIBUICAO_SQL` em vez de SQL duplicado.

### Frontend
- **`templates/importacao.html`**: botão **Lista Excel** (`btnSmsAutomatizadosExcel`) antes do SMS automáticos.
- **`static/importacao.js`**: `syncSmsDistribuicaoFooterButtons()` alinha o estado desativado do SMS e do Excel a `totals.count`; download por `fetch` + `blob` + `Content-Disposition`; desativa ambos em “Restaurar inicial”, no fluxo do SMS e ao gerar o Excel.
- **`static/importacao.css`**: classe `btn-sms-excel-dist` (verde discreto) e inclusão na media query do rodapé em ecrãs estreitos.

To-dos `backend-helper-excel`, `frontend-excel-btn` e `css-excel-btn` estão **concluídos**.

---

**User**

ao clicar para baixar o excel, o erro 500 apareceu.

---

**Cursor**

Investigando a causa do erro 500 no endpoint Excel: verificando o código e o esquema da base de dados.



Corrigindo o tratamento de `telefone.numero`: quando o MySQL/PyMySQL devolve `bytes`, `for ch in raw_num if ch.isdigit()` itera inteiros e provoca `AttributeError` — isso derruba o endpoint Excel (e o preview). Corrigindo `_sms_digits_only` e unificando a extração de dígitos nos dois locais.



Corrigindo `_sms_digits_only` para aceitar `bytes`/`memoryview` (evita `AttributeError` ao iterar dígitos) e endurecendo o endpoint Excel com tratamento de erros e valores seguros para células.



Eis o que provavelmente causava o **500** e o que foi alterado:

### Causa mais provável
Em alguns ambientes o MySQL/PyMySQL devolve `telefone.numero` como **`bytes`** (ou `memoryview`). O código fazia:

```python
''.join(ch for ch in raw_num if ch.isdigit())
```

Em `bytes`, cada `ch` é um **inteiro** (0–255), que **não tem** `.isdigit()` → **`AttributeError`** e resposta 500. Isso afectava o loop da análise (preview e Excel usam o mesmo helper).

### Correcções feitas
1. **`_sms_digits_only`** – passa a normalizar `bytes` / `bytearray` / `memoryview` para texto antes de extrair dígitos.
2. **`_sms_automatizados_analise` e o POST de SMS** – uso directo de `_sms_digits_only(tel.get('numero'))` em vez do `join` sobre `raw_num`.
3. **`GET .../sms-automatizados/excel`** – `try/except` com log (`app.logger.exception`), mensagem JSON em caso de falha na análise ou ao gerar o ficheiro, **`ImportError`** do `openpyxl` → **503** com texto a indicar `pip install openpyxl`, e **`_xlsx_cell_str`** para valores de célula (bytes, `Decimal`, caracteres de controlo ilegais no openpyxl).

Reinicia o servidor Flask e volta a testar o download. Se ainda falhar, o alerta no browser deve mostrar a mensagem JSON (e no servidor aparece o stack trace completo no log).

---

**User**

ao clicar no botao do sms, o sistema pega todos os contratos com status 'aberto', obtem a parcela com status 'aberto' mais antiga no contrato, faz a diferenca da data atual com a data de vencimento da parcela e verifica se o contrato esta dentro daquele de dias de atraso especificos.

---

**Cursor**

Analisando o código actual do SMS automático na importação para comparar com a descrição que deu.



Confirmando: a descrição cobre só a parte de atraso; o fluxo real também usa “dia de entrada” e limita os contratos à distribuição.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando os to-dos: o plano documenta o comportamento actual e opções futuras; sem decisão de produto para alterar regras, vamos documentar o comportamento canónico em `AGENTS.md` e marcar o âmbito como resolvido.



Adicionando a secção 4.7 em `AGENTS.md` com o comportamento canónico e nota sobre alterações futuras (sem mudança de código — o plano indica "Se aprovado" para alterações em `app.py`).



### O que foi feito

O plano descreve o **comportamento actual** versus uma descrição informal e lista **mudanças opcionais** que só fariam sentido com decisão de negócio (“Se aprovado” para mexer em SQL/`template_id`). Não havia nenhuma dessas opções escolhida, por isso **não alterei** [`app.py`](app.py).

**To-do `confirm-scope`:** o âmbito ficou fixado como o que o código já faz: só `funcionario_cobranca` + contrato aberto, `MIN(vencimento)` nas parcelas abertas, templates 4 (61/85) com prioridade e 1–3 por dia de entrada, validação de telefone partilhada.

**To-do `implement-if-needed`:** cumpri a parte **documentar** registando tudo em **[`AGENTS.md`](AGENTS.md)** na nova secção **4.7 SMS automáticos (importacao / distribuicao)** (universo, atraso, templates, telefones, nota para alterações futuras).

Assim o plano fica aplicado no repositório sem mudar regras de negócio sem aprovação explícita. Se quiserem uma das opções do plano (todos os abertos, outra parcela, faixas de dias, remover entrada), digam qual e aí sim alteramos `app.py` em conjunto.

---

**User**

o excel nao foi alterado. o excel deve ser alterado para mostrar os contratos aos quais vao receber o sms.

---

**Cursor**

Analisando o Excel actual e o fluxo de dados para alinhar com os contratos que efectivamente recebem SMS.



Alterando a lista do Excel para uma linha por SMS efectivamente enviável (um telefone validado = uma linha), com dados do contrato e do destinatário para espelhar o POST.



### Alteração feita

O Excel deixou de ser **uma linha por contrato** com só “Qtd SMS” e passou a listar **cada envio previsto**: **uma linha por telefone** que passa na mesma validação do envio (`_resolve_ids_registro_sms`), ou seja, o mesmo conjunto de SMS que o POST dispararia.

**Colunas:** Grupo, Cota, ID contrato, N. contrato, Devedor, Template, Dias atraso, Dia entrada, Motivo, Telefone (cadastro), Telefone (digitos envio), ID telefone.

**Motivo:** texto curto (ex. “Atraso 61 dias (regra 61 ou 85)” ou “Dia 16 desde entrada cobranca (template 2)”).

**Ficheiro:** [`app.py`](app.py) — `_sms_automatizados_motivo_envio`, `_sms_automatizados_analise` (append por telefone válido) e `api_distribuicao_sms_automatizados_excel` (cabeçalhos e linhas).

**Documentação:** [AGENTS.md](AGENTS.md) secção 4.7 — nota sobre o Excel linha-a-linha por SMS.

Os contadores do **preview** mantêm-se: `sms_previstos` = número de SMS; `contratos_com_sms` = contratos com pelo menos um telefone válido.

---

**User**

para obter esses contrato, gere uma query que pega os contratos com status 'aberto', depois verifique as parcelas com status 'aberto' e obtenha a com o vencimento mais antigo, depois pega a data atual e faca a diferenca dela com a data do vencimento da parcela. se a diferenca for igual a 0, 16, 31, 61 e 85, mandar o sms. ajeitar a implementacao na pagina sms.

---

**Cursor**

Analisando a implementação actual do SMS na importação para planear a alteração às novas regras (dias 0, 16, 31, 61, 85 relativos ao vencimento mais antigo).



Confirmando um ponto crítico: o universo de contratos altera o volume de SMS e a segurança do lote.



**SMS automáticos — universo de contratos**

> **A nova regra (dias 0, 16, 31, 61, 85 desde o vencimento mais antigo da parcela aberta) deve aplicar a que conjunto de contratos?**
> - Só contratos na distribuição atual (como hoje: JOIN funcionario_cobranca + contrato aberto)
> - Todos os contratos com status aberto na base (sem exigir funcionario_cobranca) ✔

Confirmado: todos os contratos `aberto` na base (sem `funcionario_cobranca`). Criando o plano.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano: começando pelo SQL, helper `template_id` e `_sms_automatizados_analise`.



Aplicando alterações em `app.py`.



### Resumo da implementação

**Backend ([`app.py`](app.py))**
- **`_SMS_AUTOM_DISTRIBUICAO_SQL`:** `FROM contrato c` com `status = 'aberto'`, `LEFT JOIN pessoa`, só a subquery `dias_atraso` (`DATEDIFF(CURDATE(), MIN(vencimento))` em parcelas `aberto`). Removidos `funcionario_cobranca` e `data_entrada`.
- **`_sms_automatizados_template_id_por_dias(da_int)`:** devolve template **1–4** só para dias **0, 16, 31, 61, 85** (int, `>= 0`); caso contrário `None`.
- **`_sms_automatizados_analise`:** usa o helper; **`ignorados_sem_entrada`** fica sempre **0**; removida lógica de ocorrência/dia de entrada.
- **`_sms_automatizados_motivo_envio(da_int, template_id)`:** texto baseado na diferença em dias vs. vencimento mais antigo.
- **POST** `sms-automatizados`: mesma SQL e o mesmo helper de template; sem `dia_entrada` / `data_entrada`.
- **Excel:** coluna “Dia entrada” removida; “Dias atraso” renomeada para **“Dias desde vencimento”**.

**Frontend**
- [`static/importacao.js`](static/importacao.js): mensagens de preview vazio, confirmação de envio e resumo do POST alinhadas à nova regra; removida a linha do alerta sobre `ignorados_sem_entrada`.
- [`templates/importacao.html`](templates/importacao.html): `title` dos botões SMS e Excel actualizados.

**Documentação**
- [`AGENTS.md`](AGENTS.md) secção **4.7** reescrita com a regra nova.

**Nota:** os botões de SMS/Excel na importação continuam **desactivados** quando `totals.count` da distribuição é zero (comportamento anterior); o lote de SMS percorre **todos** os contratos abertos na base quando o utilizador clica. Se quiserem desbloquear os botões sem depender da distribuição, isso é um ajuste separado no JS.

---

**User**

apenas incluir o grupo, cota e dias de atraso do contrato no excel gerado

---

**Cursor**

Simplificando o Excel para três colunas (Grupo, Cota, Dias desde vencimento) e uma linha por contrato com SMS previsto.



### Alterações

**[`app.py`](app.py)**  
- **`_sms_automatizados_analise`:** removida a função `_sms_automatizados_motivo_envio` (já não era usada). O Excel passa a ter **uma linha por contrato** com pelo menos um telefone válido para SMS; cada linha só tem `grupo`, `cota` e `dias_atraso` (o mesmo `DATEDIFF` / regra 0, 16, 31, 61, 85). O preview e o POST **não mudam**: `sms_previstos` continua a contar **por telefone**.  
- **`api_distribuicao_sms_automatizados_excel`:** cabeçalhos **Grupo**, **Cota**, **Dias de atraso**; linha vazia com mensagem em 3 colunas.

**[`AGENTS.md`](AGENTS.md)** e **[`templates/importacao.html`](templates/importacao.html)** — texto do export Excel alinhado a isto.

---

**User**

utilizar a seguinte query para gerar o excel:
WITH MenorVencimento AS (
    -- Busca a data da parcela mais antiga que ainda está 'aberta' por contrato
    SELECT 
        id_contrato, 
        MIN(vencimento) as data_vencimento_minima
    FROM parcela
    WHERE status = 'aberto'
    GROUP BY id_contrato
)
SELECT 
    c.id AS contrato_id,
    c.numero_contrato,
    c.grupo,
    c.cota,
    mv.data_vencimento_minima,
    DATEDIFF(CURRENT_DATE, mv.data_vencimento_minima) AS dias_atraso
FROM contrato c
JOIN MenorVencimento mv ON c.id = mv.id_contrato
WHERE c.status = 'aberto'
  AND DATEDIFF(CURRENT_DATE, mv.data_vencimento_minima) IN (0, 16, 31, 61, 85)
ORDER BY dias_atraso DESC;

---

**Cursor**

Alterando o endpoint do Excel para executar a query com CTE fornecida e preencher as colunas Grupo, Cota e Dias de atraso.



Adicionando a constante SQL com a CTE e fazendo o endpoint Excel executá-la directamente. Removendo a construção de `linhas_excel` de `_sms_automatizados_analise`, pois deixa de ser necessária.



Corrigindo o fecho da conexão: evitar `close` duplicado no `except`.



### O que mudou

1. **Nova constante [`_SMS_AUTOM_EXCEL_SQL`](app.py)**  
   Contém a query com CTE `MenorVencimento` que indicou (`MIN(vencimento)` por `id_contrato` em parcelas `aberto`, `JOIN` em `contrato` aberto, `DATEDIFF(CURRENT_DATE, …) IN (0, 16, 31, 61, 85)`, `ORDER BY dias_atraso DESC`). Removi só o ponto e vírgula final para o `execute()`.

2. **`GET .../sms-automatizados/excel`**  
   Deixa de usar `_sms_automatizados_analise` para as linhas. Abre a conexão, executa **`_SMS_AUTOM_EXCEL_SQL`**, e grava no Excel apenas **Grupo**, **Cota** e **Dias de atraso** (a query ainda devolve `contrato_id`, `numero_contrato` e `data_vencimento_minima`, mas não são escritos na folha).

3. **`_sms_automatizados_analise`**  
   Passa a devolver sempre **`([],)`** na segunda posição (preview/POST inalterados na lógica de contagem e telefone).

4. **[`AGENTS.md`](AGENTS.md)**  
   Secção 4.7 actualizada: Excel = esta query; pode haver mais linhas que SMS efectivos se não houver telefone válido.

**Nota:** o Excel alinha-se à query SQL; o **preview** e o **envio** continuam a considerar só contratos com telefone que passa em `_resolve_ids_registro_sms`.

---

**User**

no botao do excel na importacao, mudar o texto para "lista sms"

---

**Cursor**

No [`templates/importacao.html`](templates/importacao.html) o rótulo do botão passou de **Lista Excel** para **lista sms** (com o ícone `fa-file-excel` igual). O `title` do botão mantém-se; se quiseres que eu o encurte ou alinhe ao novo nome, diz como preferes o texto.

---

**User**

ao clicar no botao de SMS no card de detalhes de contrato na pagina @templates/busca.html , em vez de permitir o usuario de escolher a mensagem que vai enviar, ja enviar automaticamente a seguinte mensagem:
(PRIMEIRO NOME PESSOA): sua cota do Consórcio Chevrolet encontra-se em atraso e foi encaminhada à João Barbosa Assessoria. Para regularização, ligue 08000012323.

---

**Cursor**

Vou mapear onde o botão de SMS do detalhe de contrato abre a escolha de mensagem (frontend) e onde ocorre o envio (backend), para propor o plano exacto sem quebrar o fluxo atual.



**Comportamento do envio automático de SMS**

> **No clique do botão de SMS no detalhe de contrato (Busca), quer manter uma confirmação antes de enviar a mensagem automática?**
> - Enviar imediatamente (sem prompt e sem confirmação)
> - Enviar automático, mas com confirmação "Deseja enviar?" antes do POST ✔

Perfeito — com confirmação antes do envio. Vou gerar o plano de alteração focado só no fluxo do detalhe de contrato na Busca.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Começando pelo primeiro to-do: vou marcar os botões de SMS no detalhe de contrato em `static/busca.js` com os novos `data-*`.



Agora vou alterar `static/busca.js` para marcar apenas os botões do detalhe de contrato com `data-sms-auto-contrato` e o primeiro nome.



Vou ajustar o handler global de SMS para enviar automaticamente a mensagem fixa quando `data-sms-auto-contrato="1"`.



Implementado conforme o plano.

### O que mudou

- Em `static/busca.js`, no `renderPessoaSection(...)` (detalhe de contrato), o botão `.btn-mensagem` agora recebe:
  - `data-sms-auto-contrato="1"`
  - `data-primeiro-nome="<primeiro nome da pessoa>"`
- Isso foi aplicado apenas quando existe `data-contrato-id` (fluxo de detalhe de contrato), sem alterar o fluxo geral de detalhe de pessoa.

- Em `static/sms_messagecenter.js`:
  - adicionei `montarMensagemAutomaticaContrato(primeiroNome)`;
  - quando `data-sms-auto-contrato="1"`, o script **não abre prompt** e usa automaticamente a mensagem:
    - `PRIMEIRO_NOME: sua cota do Consórcio Chevrolet encontra-se em atraso e foi encaminhada à João Barbosa Assessoria. Para regularização, ligue 08000012323.`
  - mantém a confirmação `confirm(...)` antes do envio;
  - para os demais contextos, continua com o prompt manual como antes.

### Verificação

- `node --check` em `static/busca.js` e `static/sms_messagecenter.js` sem erros.
- `ReadLints` sem erros nos arquivos alterados.

---

**User**

o mesmo serve para o botao de enviar email que se localiza no mesmo card. enviar a mesma mensagem e tirar a opcao do usuario digitar a mensagem a ser enviada.

---

**Cursor**

Perfeito — vou aplicar o mesmo comportamento no botão de e-mail do card de contrato: mensagem fixa automática, sem campo para digitar, mantendo só confirmação antes de enviar.



Vou ajustar `static/busca.js` para marcar também o botão de e-mail nesse card e alterar `static/email_html_busca.js` para usar mensagem fixa automática (sem prompt), mantendo apenas confirmação.



Feito — apliquei o mesmo comportamento ao botão de **enviar e-mail** no card de detalhes de contrato.

### O que mudou

- Em `static/busca.js` (no `renderPessoaSection`, que monta o card de contrato):
  - o botão `.btn-enviar-email-html` agora recebe, quando houver `idContrato`:
    - `data-email-auto-contrato="1"`
    - `data-primeiro-nome="<primeiro nome da pessoa>"`

- Em `static/email_html_busca.js`:
  - adicionei `montarMensagemAutomaticaContrato(primeiroNome)` com a mesma mensagem fixa;
  - quando `data-email-auto-contrato="1"`:
    - **não abre prompt** para digitar mensagem;
    - monta automaticamente a mensagem com primeiro nome (fallback `Cliente`);
    - mantém a confirmação antes do envio;
  - para os outros contextos, o fluxo antigo com prompt continua igual.

### Mensagem automática usada

`PRIMEIRO_NOME: sua cota do Consórcio Chevrolet encontra-se em atraso e foi encaminhada à João Barbosa Assessoria. Para regularização, ligue 08000012323.`

Também validei sintaxe/lint dos dois arquivos alterados e está tudo ok.

---

**User**

na api de enviar whatsapp, a apikey deve ser obtida atraves da coluna 'apikey' da tabela funcionario.

---

**Cursor**

Analisando a rota de WhatsApp e o esquema da tabela `funcionario`.



Alterando `api_enviar_whatsapp` para ler `fila` e `apikey` na mesma consulta e removendo a API key hardcoded.



### Alterações

**[`app.py`](app.py)** — `api_enviar_whatsapp`:
- Consulta passou a ser `SELECT fila, apikey FROM funcionario WHERE id = %s`.
- O corpo enviado ao AtenderBem usa `apiKey` com o valor de `funcionario.apikey` (após `strip`; se vier `bytes`, decodifica em UTF-8).
- Se `apikey` estiver vazia ou inexistente, resposta **400** com mensagem clara para cadastrar o campo no funcionário.
- Removida a constante **`WHATSAPP_AB_APIKEY`** (chave fixa no código).

**[`AGENTS.md`](AGENTS.md)** — na secção do discador, registo de que o WhatsApp usa `funcionario.fila` e `funcionario.apikey`.

A coluna `apikey` já existe em [`Banco/criar_banco.py`](Banco/criar_banco.py) na tabela `funcionario`; basta preencher por utilizador na base.

---

**User**

ao clicar para enviar whatsapp, mandar a mesma mensagem padrão utilizada para sms e email.

---

**Cursor**

Verificando como o WhatsApp é disparado na busca e alinhando à mensagem fixa do SMS/e-mail.



Adicionando atributos no botão WhatsApp do detalhe de contrato e usando a mesma mensagem fixa em `whatsapp_sender.js`.



### Alterações

**[`static/busca.js`](static/busca.js)** — No detalhe do **contrato** (`renderPessoaSection` com `idContrato`), o botão `.btn-whatsapp` passa a ter `data-wa-auto-contrato="1"` e `data-primeiro-nome` (mesmo primeiro nome usado no SMS/e-mail). No modal só de **pessoa** nada muda: continua sem esses atributos.

**[`static/whatsapp_sender.js`](static/whatsapp_sender.js)** — Mesma função de texto que SMS/e-mail (`montarMensagemAutomaticaContrato`). Se `data-wa-auto-contrato="1"`, **não abre o prompt**; monta a mensagem e mantém só o **confirm** antes do envio. Nos restantes ecrãs, o prompt manual mantém-se.

Texto enviado:

`(Primeiro nome): sua cota do Consórcio Chevrolet encontra-se em atraso e foi encaminhada à João Barbosa Assessoria. Para regularização, ligue 08000012323.`

---

**User**

replique as funconalidades dos botoes dentro do card de detalhes de contrato que aparecem em outras paginas como a de @templates/cobranca.html para que as funcionalidades fique iguaisaos botoes dentro do card de detalhe de contrato da pagina @templates/busca.html. ex: ao enviar o whatsapp na pagina cobranca, o usuario tem que digitar a mensagem que vai ser enviada, nao e automatico igual ao do card de busca. 

---

**Cursor**

Analisando como o card de contrato é montado na cobrança versus na busca.



Alinhando o padrão de atributos e o carregamento do script de e-mail: só a Busca inclui `email_html_busca.js` e a Cobrança duplica `renderPessoaSection` sem os `data-*` de mensagem automática.



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

