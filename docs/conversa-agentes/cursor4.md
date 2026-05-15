# Context and project overview
_Exported on 5/7/2026 at 21:41:15 GMT-3 from Cursor (3.3.16)_

---

**User**

leia o arquivo @docs/conversa-agentes/cursor3.md para entender o contexto e o que foi feito no projeto.

---

**Cursor**

Lendo o arquivo em partes para capturar o contexto e o resumo do trabalho.



Li o export `docs/conversa-agentes/cursor3.md` (conversa longa exportada do Cursor em 29/04/2026). Abaixo está o **contexto** e o que foi **feito no projeto**, em ordem temática.

## Contexto geral

O ficheiro é um registo de uma sessão de trabalho no **Prototipo-SAJ** (Flask + MySQL): correções de bugs, alinhamento de schema com a base real, feature de **performance/safra**, página **Pasta Virtual**, contactos (telefone/e-mail), integração com **discador** B2, e ajustes de scripts em `Python/`.

## Principais entregas

1. **Avatar / foto errada entre utilizadores**  
   Cache HTTP em `/minha-foto` fazia aparecer a foto da sessão anterior. Corrigido com `Cache-Control: private, no-store`, `Vary: Cookie`, query `?u=` no `src` do avatar em `layout.html`, e bust de cache no upload em `home.js`.

2. **Schema vs `criar_banco.py`**  
   Comparação entre dump oficial e script de criação: diferenças em `funcionario` (ex. `foto`), `contrato`, `funcionario_cobranca`, enum de `ocorrencia`, `negativacao`, etc. Recomendação de atualizar `RAW_SQL` ou migrações.

3. **Migrações e enums**  
   - Script SQL para `NOT NULL` em `contrato` (`id_empresa`, `id_seguradora`) e `negativacao.id_parcela` (com passos de limpeza).  
   - Remoção de `'ativo'` do enum de `ocorrencia` em `criar_banco.py` e ajuste do **tracker** para usar `'aberto'`.  
   - Substituição do bloco SQL em `criar_banco.py` pelo dump fornecido (várias tabelas).

4. **Performance / “safra”**  
   Regra de negócio: cohort por mês com ocorrências `aberto` (“contrato novo” / “contrato voltou”), parcela de entrada inferida do texto, agregações, KPIs, export e atualização de `performance.html` / `performance.js`.

5. **Scripts em `Python/`**  
   `app.py` passou a usar `PYTHON_DIR` para subprocessos (`import_only_arquivos_gm.py`, tracker, `distribuir_funcionarios_cobranca.py`). Scripts alinhados a `DB_*`, charset, docstrings de uso.

6. **Pasta Virtual**  
   Página no estilo do sistema, listagem com deteção de colunas via `INFORMATION_SCHEMA`, card de contrato como na busca, download de ficheiro, inserção com modal, filtros dinâmicos, fluxo entre modais e integração com outras páginas.

7. **Contactos globais (+ telefone / + e-mail)**  
   Modal no `layout`, `window.__refreshContatoSrc` em vários JS, botões em `renderPessoaSection`. Depois: remoção de tipos `avalista_*` (backend, front, `pessoa_satellite.py`, script de migração; correção de `commit` no migrador).

8. **Tabela `telefone`**  
   Coluna `ddd` removida (BD + `app.py` + `pessoa_satellite` + modal + `criar_banco.py`).

9. **409 “já existe” incorreto**  
   Validação explícita de duplicidade e tratamento fino de `IntegrityError` (1062 vs 1452, etc.).

10. **Vários telefones/e-mails do mesmo tipo**  
    UK alterada para `(pessoa, tipo, número)` e `(pessoa, tipo, email)`; `app.py` e `criar_banco.py` atualizados.

11. **Discador (API B2)**  
    `POST /api/discar` como proxy, `requests`, variáveis `DISCADOR_*` no `.env`, `discador.js`, botões `.btn-ligar` nos sítios certos, inclusão em perfil **Cobrança** (`_COBRANCA_API_PREFIXES_OK`), simplificação do ramal (int da BD), robustez no carregamento do `.env` (override, fallback manual, codificações cp1252/latin-1).

---

Em resumo: o documento é um **diário técnico** dessa conversa — bugs de cache e permissões, evolução do modelo de dados, safra na performance, Pasta Virtual, contactos e discador — com caminhos de ficheiros e notas de validação ao longo do texto. Se quiser aprofundar **uma** área (por exemplo só safra ou só discador), diga qual.

---

**User**

na pagina @templates/busca.html , ao clicar em detalhes de contrato, adicione ao botao de enviar email a funcao de fazer a seguinte requisicao post:
URL: https://sistema.messagecenter.com.br/api/Integracao/EnviarEmailHtml?Destinatario=EmailEscolhido&RemetenteNome=PrimeiroNomeDoFuncionario&RemetenteEmail=atendimento@joaobarbosa.com.br&Assunto=Cobranca&Identificador&ClienteNome=PrimeiroNomeDaPessoaComOEmailEscolhido&ClienteDocumento=&CentroCusto=&CamposCustomizados1&CamposCustomizados2&CamposCustomizados3&CamposCustomizados4&CamposCustomizados5;
Authorization: o mesmo da api sms
BodyTipo: form-data
Key: CorpoHtml, tipo texto, value: <p>Mensagem</p>

---

**Cursor**

Analisando a página de busca, o botão de enviar e-mail e a integração SMS existente para definir um plano coerente.



Confirmando: o botão de e-mail usa `btn-mensagem` sem `data-numero`, então o handler de SMS em `sms_messagecenter.js` ignora o clique. Vamos corrigir isso e integrar o envio via backend (mesmo padrão de cabeçalho `apikey` que o SMS no servidor).



Elaborando o plano: o envio deve passar pelo Flask (como o SMS em `api_enviar_sms`) para usar o cabeçalho `apikey` sem expor a chave num novo script — alinhado às regras do projeto sobre segredos.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano: começando pelo backend em `app.py`, depois `busca.js`, o novo script e o template.



Implementação fechada conforme o plano. Resumo objetivo:

### Backend — [`app.py`](app.py)
- Constantes `EMAIL_MC_URL`, `EMAIL_MC_REMETENTE` (override por env `EMAIL_MC_REMETENTE`).
- Helpers `_primeiro_nome` e `_validar_contexto_envio_email_html` (confere `email` + `id_pessoa` + `id_email`; se vier `id_contrato`, valida devedor/avalista).
- Rota **`POST /api/enviar-email-html`**: monta query (`Destinatario`, `RemetenteNome` da sessão, `RemetenteEmail`, `Assunto=Cobranca`, `Identificador` e demais campos vazios, `ClienteNome` com primeiro nome da pessoa), envia **`multipart/form-data`** com `CorpoHtml` e header **`apikey`** igual ao SMS.
- Whitelist: **`/api/enviar-email-html`** em `_COBRANCA_API_PREFIXES_OK` e `_path_ok_bradesco_em_gm`.

### Busca — [`static/busca.js`](static/busca.js)
- Nos dois blocos de e-mail (modal de pessoa e `renderPessoaSection`), botão **`btn-enviar-email-html`** com `data-email`, `data-pessoa-id`, `data-email-id`, e `data-contrato-id` quando houver contrato.

### Front — [`static/email_html_busca.js`](static/email_html_busca.js) + [`templates/busca.html`](templates/busca.html)
- Script só na Busca: `prompt` de texto, corpo como `<p>…</p>` com escape HTML e quebras em `<br>`, `fetch` JSON para o proxy.

### Config — [`.env.example`](.env.example)
- Comentário sobre `EMAIL_MC_REMETENTE` (opcional).

**Como testar:** login → Busca → detalhes de pessoa ou contrato → ícone de envelope ao lado do e-mail → mensagem → confirmar; o servidor deve chamar a MessageCenter com a mesma `apikey` do SMS.

Todos os to-dos do plano estão **concluídos**.

---

**User**

no card de detalhes de contratos na pagina @templates/busca.html e de outras paginas, adicione ao lado de numero telefone, um botao com icone de whatsapp. ao clicar neste botao, vai ser chamado uma api.
Informacoes da API:
url: https://joaobarbosa.atenderbem.com/int/enqueueMessageToSend
body: {
  "queueId": coluna fila do usuario logado,
  "apiKey": "334b7c42cfca4d669200a3f5c0af452c",
  "number": "numero escolhido para o envio da mensagem",
  "text": "mensagem a ser enviada"
}

---

**Cursor**

Entendi: você quer botão de WhatsApp ao lado de cada telefone no card de contrato (Busca e demais telas), chamando a API com `queueId` da coluna `fila` do usuário logado. Vou mapear rapidamente os pontos já existentes para te devolver um plano fechado.



**Detalhes para fechar o plano do botão WhatsApp**

> **Quando você disse "outras páginas", devo aplicar o botão WhatsApp em todos os modais de contrato que hoje já têm os botões de ligar/SMS?**
> - Sim, em todas: busca, cadastro, cobranca, agenda, relatorios, contrato e pasta virtual ✔
> - Não, apenas na busca por enquanto
> - Outro escopo (eu te digo quais)

> **Se o usuário logado não tiver valor na coluna `funcionario.fila`, qual comportamento você quer?**
> - Bloquear o envio e mostrar erro pedindo para cadastrar a fila ✔
> - Usar um queueId fixo padrão
> - Pedir queueId na hora do envio

Perfeito — com essas escolhas, vou montar o plano já fechado para aplicar em todas as páginas com modal de contrato e com bloqueio quando `funcionario.fila` estiver vazio.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Vou executar o plano agora: primeiro backend (`/api/enviar-whatsapp` + permissões), depois o script global e por fim os botões nos 7 arquivos de tela, com validação no final.



Agora vou aplicar o bloco principal no `app.py`: nova rota `/api/enviar-whatsapp`, constantes da API e permissões para perfis restritos.



Backend pronto. Vou criar o script global de WhatsApp e conectar no `layout.html`, depois faço o ajuste dos botões em todas as telas.



Vou aplicar agora os botões `.btn-whatsapp` nos 7 JS de tela e incluir o novo script no `layout.html`.



Implementei o plano completo para o botão de WhatsApp nos detalhes de contrato.

Alterei o backend para suportar envio via proxy e apliquei o botão em todas as telas de detalhe de contrato que já tinham ações de telefone/SMS, mantendo o padrão do projeto.

- `app.py`
  - Nova rota `POST /api/enviar-whatsapp`.
  - Busca `funcionario.fila` do usuário logado (`session['funcionario_id']`).
  - Bloqueia com erro claro quando `fila` está vazia/inválida.
  - Chama `https://joaobarbosa.atenderbem.com/int/enqueueMessageToSend` com:
    - `queueId` = `fila` do funcionário logado
    - `apiKey` = `334b7c42cfca4d669200a3f5c0af452c`
    - `number` = número escolhido
    - `text` = mensagem digitada
  - Tratamento de erro no mesmo estilo dos proxies existentes.
  - Permissões atualizadas:
    - `_COBRANCA_API_PREFIXES_OK` inclui `/api/enviar-whatsapp`
    - `_path_ok_bradesco_em_gm` inclui `/api/enviar-whatsapp`

- `templates/layout.html`
  - Incluído script global novo: `static/whatsapp_sender.js`.

- `static/whatsapp_sender.js` (novo)
  - Delegação de clique para `.btn-whatsapp`.
  - Lê `data-numero`, pede mensagem via `prompt`, confirma envio.
  - Faz `fetch('/api/enviar-whatsapp', { numero, mensagem })`.
  - Exibe retorno de sucesso/erro e desabilita botão durante envio.

- Botão WhatsApp inserido ao lado do telefone nestes arquivos:
  - `static/busca.js`
  - `static/cadastro.js`
  - `static/cobranca.js`
  - `static/agenda.js`
  - `static/relatorios.js`
  - `static/contrato_detalhes_modal.js`
  - `static/pasta_virtual.js`

Validação executada:
- `python3 -m py_compile app.py` sem erros.
- Lints sem erros nos arquivos alterados.

Se quiser, no próximo passo eu adiciono também o registro desse disparo em tabela de histórico/tramitação (tipo `whatsapp`) para auditoria no sistema.

---

**User**

o funcionario que tem nivel de acesso cobranca tem acesso a api de enviar-whatsapp?

---

**Cursor**

Sim, **tem acesso**.

No `app.py`, a rota está explicitamente permitida para perfil cobrança dentro da whitelist:

```103:126:app.py
_COBRANCA_API_PREFIXES_OK = (
    ...
    '/api/enviar-sms',
    '/api/enviar-email-html',
    '/api/enviar-whatsapp',
)
```

E no `before_request`, para usuário `cobranca`, o fluxo de API retorna `None` (não bloqueia):

```170:174:app.py
if n == 'cobranca':
    if path.startswith('/api/'):
        if not _cobranca_api_ok(path):
            return None #jsonify({'error': 'Acesso negado.'}), 403
        return None
```

Observação importante: esse trecho comentado (`#jsonify...403`) faz com que hoje **nem APIs fora da whitelist sejam bloqueadas** para cobrança. Ou seja, no estado atual, o acesso está ainda mais aberto do que o esperado.

---

**User**

ao tentar enviar uma mensagem atraves da api do whatsapp, aparece o erro 502.

---

**Cursor**

Vou investigar a rota `/api/enviar-whatsapp` e o script do botão para identificar por que está voltando `502`, e já te devolvo uma correção direta.



Achei a causa mais provável no código atual: ele envia o `number` exatamente como vem da tela (com parênteses, espaços, hífen), e essa API costuma exigir número só com dígitos. Vou ajustar isso e melhorar a mensagem de erro retornada para ficar claro o motivo real quando a API externa rejeitar.



---

**User**

no header da api do whatsapp, adicione as seguintes informacoes se necessario:

---

**Cursor**

Perfeito — vou ajustar a chamada da API do WhatsApp para enviar headers equivalentes ao teste do Postman (onde fizer sentido) e aproveitar para melhorar o retorno de erro, assim fica mais fácil diagnosticar quando a API externa recusar.



Ajustei sim os headers “se necessário” e corrigi pontos que costumam causar esse `502`.

O que foi alterado na rota `POST /api/enviar-whatsapp` em `app.py`:

- **Headers enviados para API externa** agora incluem:
  - `Content-Type: application/json`
  - `Accept: */*`
  - `User-Agent: PostmanRuntime/7.53.0`

- **Número normalizado antes do envio**:
  - remove caracteres não numéricos
  - adiciona `55` quando vier número local (até 11 dígitos)

- **Propagação de status da API externa**:
  - antes qualquer erro remoto virava `502`
  - agora retorna o **mesmo status HTTP** da API de WhatsApp (com `detalhe`), facilitando diagnóstico real (ex.: 400/401/403/422)

Trecho atualizado:

```2589:2646:app.py
raw = (payload.get('numero') or '').strip()
digits = ''.join(ch for ch in raw if ch.isdigit())
if digits and not digits.startswith('55') and len(digits) <= 11:
    digits = '55' + digits
...
resp = requests.post(
    WHATSAPP_AB_URL,
    json=body,
    headers={
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': 'PostmanRuntime/7.53.0',
    },
    timeout=30,
)
...
if not resp.ok:
    return jsonify({
        'error': 'Falha ao enviar WhatsApp.',
        'status': resp.status_code,
        'detalhe': data,
    }), resp.status_code
```

Também validei sintaxe com `py_compile` sem erro.

Se quiser, no próximo passo eu deixo o backend logando (temporariamente) o payload mascarado e o retorno bruto da API para fechar 100% o diagnóstico em produção.

---

**User**

o number no body pode ser a variavel raw. deletar a variavel digits.

---

**Cursor**

Alteração feita em `api_enviar_whatsapp`:

- Removida a variável `digits` e a normalização com `55`.
- Validação volta a ser `if not raw`.
- O JSON enviado à API usa `'number': raw` (o mesmo valor recebido em `numero`, após `strip`).

Os headers (`Content-Type`, `Accept`, `User-Agent`) e o restante da rota permanecem iguais. `py_compile` em `app.py` passou sem erro.

---

**User**

ao enviar uma mensagem pela api de email, fazer uma insercao na tabela registro_email. fazer igual a insercao de registro_sms quando a api sms e enviada com sucesso.

---

**Cursor**

Analisando a estrutura de `registro_email` e o fluxo de `registro_sms` para replicar após envio de e-mail bem-sucedido.



Adicionando `_resolve_ids_registro_email` (espelhando a resolução de contrato do SMS) e inserindo em `registro_email` após sucesso da API, truncando o corpo para 1600 caracteres (limite da coluna `mensagem`).



Resumo do que foi feito no [`app.py`](app.py):

### 1. `_resolve_ids_registro_email`
- Garante `id_contrato` para o `INSERT` (coluna `NOT NULL`), no mesmo critério do SMS:
  - Se vier `id_contrato` no JSON, usa esse id (já validado em `_validar_contexto_envio_email_html`).
  - Se não vier, busca o primeiro contrato em que a pessoa é devedor ou avalista.
- Se não existir contrato, devolve **400** com a mesma ideia do SMS: *não é possível registrar o envio* — e a API externa **não** é chamada (igual ao fluxo do SMS com `registro_sms`).

### 2. `api_enviar_email_html`
- Depois da validação do e-mail, resolve os ids com `_resolve_ids_registro_email` **antes** do `POST` ao MessageCenter.
- Após resposta **ok** da API, faz `INSERT INTO registro_email (id_contrato, id_pessoa, id_email, id_funcionario, mensagem)` com:
  - `mensagem` = `corpo_html` truncado em **1600** caracteres (limite de `varchar(1600)` na tabela).
- Se o `INSERT` falhar, registra **warning** no log e ainda retorna `ok: true` com a resposta do provedor, como no SMS (`registro_sms`).

`py_compile` em `app.py` passou sem erro.

---

**User**

na pagina @templates/importacao.html , apos expandir a parte de distribuicao, adicione botao sms que faz a requisicao da api de enviar sms de todos os numeros que estao em contratos abertos. aqui estao os templates de mensagens para ser enviados:
 1 - (PRIMEIRO NOME CLIENTE): sua cota foi encaminhada à João Barbosa Assessoria. Para regularização, ligue 08000012323. (enviar no 1º dia da entrada em cobrança)
2 – (PRIMEIRO NOME CLIENTE), não identificamos o pagamento da(s) parcela(s) (NUMEROPARCELA), referente(s) ao contrato (NUMEROCONTRATO). Entre em contato conosco JOAO BARBOSA ASSESSORIA, 08000012323. (enviar no 16º dia da entrada em cobrança)
3 – (PRIMEIRO NOME CLIENTE), não identificamos o pagamento da(s) parcela(s) (NUMEROPARCELA), referente(s) ao contrato (NUMEROCONTRATO). Entre em contato conosco JOAO BARBOSA ASSESSORIA, 08000012323. (enviar no 31º dia da entrada em cobrança)
4 - (PRIMEIRO NOME CLIENTE), seu contrato com o Consórcio Nacional Chevrolet Ltda encontra-se em atraso. Evite medidas judiciais. Ligue 08000012323 e renegocie seu acordo! (enviar no 61º e no 85º dia de atraso – casos críticos)

OBS: o dia da entrada é quando aquele contrato aparece pela primeira vez ou quando ele aparece depois de ser fechado/indenizado.

---

**Cursor**

Analisando a página de importação, a seção de distribuição e como o sistema determina contratos abertos e ocorrências de entrada em cobrança.



Confirmando contagem de dias (1º / 16º / 31º) e prioridade quando coincidirem regras.



**Regras de disparo dos SMS**

> **Para contar o “1º / 16º / 31º dia da entrada em cobrança”, qual convenção você quer? (Entrada = data da ocorrência `contrato novo` ou `contrato voltou`, campo `data_arquivo`.)**
> - Dia = DATEDIFF(hoje, data_entrada) + 1 (entrada no mesmo dia conta como dia 1) ✔
> - Dia = DATEDIFF(hoje, data_entrada) (entrada no mesmo dia conta como dia 0; dia 16 quando DATEDIFF = 16)

> **Se no mesmo contrato couber mensagem por “dias desde entrada” (1/16/31) E também por atraso 61/85 (template 4), o que prevalece?**
> - Priorizar template 4 quando dias_atraso for 61 ou 85; senão avaliar 1/16/31 ✔
> - Priorizar sempre 1/16/31 se bater; só usar template 4 se nenhum dos três bater
> - Enviar as duas mensagens no mesmo clique se ambas as condições baterem (não recomendado)

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano: começando pelo backend e, em seguida, o front-end e o CSS.



Inserindo helpers e a rota logo após `api_distribuicao_aprovar`.



Corrigindo a lógica de contadores (evitar dupla contagem) e verificando se `_get_db` não foi duplicado.



Ajustando os textos dos templates para coincidir com o pedido (acentos) e adicionando o botão no HTML/JS/CSS.



Resumo do que foi implementado:

### Backend — [`app.py`](app.py)
- **`POST /api/importacao/distribuicao/sms-automatizados`**: só **Gestor** ou **Administrador** (`403` para outros).
- Seleciona os mesmos contratos do painel: `funcionario_cobranca` + `contrato.status = 'aberto'`.
- **`data_entrada`**: `MAX(ocorrencia.data_arquivo)` com `status = 'aberto'` e `descricao IN ('contrato novo','contrato voltou')`.
- **`dia_entrada`**: `DATEDIFF(hoje, data_entrada) + 1`.
- **Prioridade**: se `dias_atraso` (parcelas abertas, como no painel) for **61 ou 85** → template **4**; senão dias **1, 16, 31** → templates **1, 2, 3**.
- **Parcelas** nos templates 2 e 3: abertas vencidas; se não houver, todas em aberto; senão `-`.
- Para cada telefone do devedor: valida com **`_resolve_ids_registro_sms`**, envia **GET** ao MessageCenter (igual ao SMS manual) e faz **`INSERT` em `registro_sms`** após sucesso.
- Resposta JSON: `enviados`, `falhas`, `ignorados_sem_entrada`, `ignorados_sem_template`, `ignorados_sem_telefone`, `contratos_processados`, `erros_amostra` (até 20).

Textos alinhados ao pedido (João Barbosa, regularização, não, Consórcio Nacional Chevrolet Ltda).

### Frontend — [`templates/importacao.html`](templates/importacao.html) + [`static/importacao.js`](static/importacao.js)
- Botão **“SMS automáticos (cobrança)”** no rodapé da distribuição.
- Habilitado quando `totals.count > 0` (como a lógica do aprovar).
- Confirmação + `POST`; `alert` com o resumo; desabilita durante o envio; em “Restaurar inicial” também fica desabilitado durante a operação.

### CSS — [`static/importacao.css`](static/importacao.css)
- Estilo **`.btn-sms-automatizados-dist`** (verde suave + hover) e inclusão no media query mobile do rodapé.

Todos os to-dos do plano estão **concluídos**.

---

**User**

ao clicar no botao gerado, o seguinte erro apareceu:

---

**Cursor**

Investigando o envio em lote de SMS: HTTP 400 da API MessageCenter costuma indicar formato inválido do número ou da mensagem.



Normalizando números para o formato internacional (55): a API MessageCenter frequentemente retorna HTTP 400 quando o telefone tem só DDD+9 dígitos sem o código do país.



Adicionando normalização E.164 (prefixo 55) para a API MessageCenter e melhorando o alerta para exibir o corpo do erro da API.



O que estava a acontecer:

1. **HTTP 400 na API MessageCenter** – Com números só com DDD + 9 dígitos (ex.: `81999999999`), muitas integrações SMS exigem **E.164 com país** (`5581999999999`). O envio manual até podia “parecer” OK se o utilizador digitasse já com `55`; em **lote**, os números vinham da BD só com formato nacional → a API devolvia **400**.

2. **2771 ignorados (sem template)** – Comportamento esperado do plano: só há SMS nos **dias 1, 16 e 31** desde a entrada (`contrato novo` / `contrato voltou`) ou nos **atrasos 61 e 85** dias. Os restantes contratos não recebem mensagem nesse clique.

### Alterações feitas

- **`_sms_phone_digits_para_messagecenter`** em [`app.py`](app.py): mantém só dígitos e, se não começar por `55` e tiver até **11** dígitos, acrescenta **`55`** (Brasil).
- Uso dessa função no **lote** (`sms-automatizados`) e também em **`/api/enviar-sms`**, para ficar igual em todo o sistema.
- **`importacao.js`**: no resumo, passa a mostrar **`detalhe`** da API (quando existir), para veres a mensagem real do MessageCenter se ainda falhar.

Reinicia o Flask e volta a correr o lote. Se ainda aparecer 400, o alerta deve trazer o JSON/texto em **`detalhe`** para afinarmos o próximo passo (ex.: limite de caracteres ou outro formato).

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

