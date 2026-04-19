# Implementação de scripts para importação de dados
_Exported on 4/19/2026 at 13:42:41 GMT-3 from Cursor (3.1.15)_

---

**User**

ao clicar para importar pasta, ele aparece o prompt para importar arquivo txt, e não a pasta com TXTs.

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

ao clicar para iniciar o processamento, deve-se comparar todos os arquivos para obter a data mais antiga e a mais nova e colocar essas datas no range do tracker e rodar. No linux importei uma pasta e o tracker errou a data mais nova no tracker.

@templates/relatorios.html na pagina de relatorio, implemente os filtros para gerar relatorios/filtrar contratos a partir de um range de 2 datas. tambem faça a implementacao para gerar esse relatorio em excel ou PDF

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

informacao do banco de dados:
1- MariaDB
2- Nome: consorcio_gm
2- User: root
3- Password: root
5- IP: localhost:3306

@scripts na pasta a seguir, implemente os 2 scripts para serem executados quando o usuário importar um txt e clicar no botao de iniciar processamente na pagina @templates/importacao.html. Não mudar a lógica dos codigos.

---

**Cursor**

Let me explore the codebase to understand the current structure and the scripts that need to be integrated.

Now let me also read the `importacao.js` file and the `pessoa_satellite` dependency to understand what's already in place.

I have a thorough understanding of the project. Before creating the plan, I need to clarify some critical points.

**Dependencias e detalhes de implementacao**

> **O script tracker_gm_range_date_contratos.py depende de 2 arquivos que NAO existem no projeto: pessoa_satellite.py (modulo Python) e layout.json (mapeamento de campos). Voce tem esses arquivos em outro local?**
> - Sim, tenho os arquivos e posso fornecer / adicionar ao projeto ✔
> - Nao tenho. Implemente sem essa parte por enquanto (comentar imports)
> - Tenho apenas o layout.json
> - Tenho apenas o pessoa_satellite.py

> **Como o usuario deve enviar os arquivos TXT na pagina de importacao?**
> - Upload de multiplos arquivos TXT de uma vez
> - Upload de um unico arquivo TXT por vez
> - Upload de uma pasta inteira com TXT
>
> Answer: pasta inteiro com varios TXTs ou apenas um TXT

> **O tracker (script 2) usa um range de datas para processar. Como ele deve ser acionado apos o import?**
> - Automaticamente apos o import, usando as datas dos arquivos importados ✔
> - O usuario informa as datas na interface antes de processar
> - Processar todos os arquivos que ainda nao foram processados (data_processamento IS NULL)

**Arquivos necessarios**

> **Para prosseguir, preciso que voce adicione os arquivos pessoa_satellite.py e layout.json na pasta scripts/ do projeto. Pode fazer isso agora?**
> - Pronto, ja adicionei os arquivos ✔
> - Vou adicionar depois, pode seguir com o plano assumindo que estarao la

Now I have a complete understanding of the codebase. Let me create the plan.

---

**User**

Integrar Scripts de Importacao na Interface Web

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Let me start implementing the plan. I'll begin with the backend routes.

Backend routes done. Now let's update the HTML template.

HTML template updated. Now let's rewrite the JavaScript.

Now let's create the `requirements.txt`.

Let me do a final review of all modified files to make sure everything is consistent.

I notice `import time` is unused. Let me clean that up.

Todos os 4 itens estao concluidos. Aqui esta o resumo do que foi feito:

---

**1. `app.py`** -- Duas novas rotas adicionadas (rotas existentes intactas):
- `POST /api/upload` -- recebe multiplos TXT via FormData, salva em pasta temporaria, retorna path e lista de arquivos
- `GET /api/processar` -- endpoint SSE que executa os 2 scripts em sequencia como subprocessos, capturando stdout linha a linha e emitindo eventos em tempo real. Entre os dois scripts, consulta o banco para detectar automaticamente o range de datas dos arquivos recem-importados

**2. `templates/importacao.html`** -- Alteracao minima:
- Input de arquivo agora aceita `multiple` e `accept=".txt"`
- IDs adicionados para nome/tamanho dos arquivos (dinamico via JS)

**3. `static/importacao.js`** -- Reescrito completamente:
- Upload real com `fetch` + `FormData` (suporta multiplos arquivos)
- Drag-and-drop real (`dragover`, `drop`)
- Processamento via `EventSource` (SSE) com logs em tempo real no terminal
- Barra de progresso atualizada conforme eventos do backend
- Classificacao visual dos logs (info/update/alert/success) usando as classes CSS ja existentes

**4. `requirements.txt`** -- Criado com `flask` e `pymysql`

Os scripts em `scripts/` **nao foram modificados** -- toda a integracao funciona via subprocess, respeitando a restricao original.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

essa implementacao deve funcionar tanto para o windows quanto para o linux.

---

**Cursor**

Let me review the current implementation for cross-platform issues.

Good, I've reviewed the full implementation. The code is already largely cross-platform thanks to `os.path`, `subprocess`, `tempfile`, and `shutil`. However, I identified a few real issues that need addressing. Let me switch to agent mode to apply the fixes.

---

**User**

Compatibilidade Cross-Platform (Windows + Linux)

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll apply both fixes together since they target the same code blocks. First, I'll add the shared config right after `PYTHON_EXE`, then update both `Popen` calls.

Now update the first `subprocess.Popen` (script 1 - import):

Now update the second `subprocess.Popen` (script 2 - tracker):

Ambos os fixes foram aplicados. Resumo das alteracoes no `app.py`:

1. **`PYTHONUNBUFFERED=1` + flag `-u`** -- Adicionados nos dois `subprocess.Popen`. Isso forca o Python filho a fazer flush do stdout a cada `print()`, garantindo streaming de logs em tempo real tanto no Windows quanto no Linux.

2. **`CREATE_NO_WINDOW`** -- Adicionado condicionalmente (`sys.platform == 'win32'`) via `_POPEN_EXTRA`. No Windows, impede que uma janela de console preta pisque na tela durante a execucao dos scripts. No Linux, o dict fica vazio e nao afeta nada.

A configuracao compartilhada (`_SUBPROCESS_ENV` e `_POPEN_EXTRA`) foi definida uma unica vez no topo do arquivo e reutilizada em ambos os blocos, evitando duplicacao.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

@templates/busca.html nesta pagina, implemente a busca de pessoa (a partir do nome ou cpf) e a busca por contrato (a partir de grupo e cota. ex: 'numero do grupo'/'numero da cota') a partir do banco. ao clicar no botão de detalhes, mostrar todas as informações relacionadas ao que foi buscado. Se a busca for pela pessoa, mostrar todos os enderecos, telefones, emails, e contratos relacionados aquela pessoa. e se a busca for de contrato, mostrar todas as informacoes do contrato, informacoes das parcelas daquele contrato, informacoes da pessoa do contrato e do avalista.

---

**Cursor**

Let me explore the codebase to understand the database schema, existing templates, and current page structure.

Now let me check the database schema from the tracker script to understand all the tables and relationships.

I now have a complete understanding of the database schema (inferred from the tracker and pessoa_satellite scripts), the current page structure, and the existing CSS classes. Let me create the plan.

---

**User**

Implementar Busca por Pessoa e Contrato

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Now I'll add the 3 new API routes before the `if __name__` block. I need a helper for DB connections with DictCursor and a JSON serializer for dates.

Backend done. Now the HTML template.

I need to add CSS for the no-results message and the `d-none` class (which is in `importacao.css` but should be available here too). Let me check if `d-none` is in dashboard.css or busca.css.

I need to add `d-none` and the no-results style to `busca.css`.

Now the JavaScript - the biggest piece.

Todos os 3 itens estao concluidos. Resumo do que foi implementado:

### 1. Backend (`app.py`) -- 3 novas rotas + helpers

- **`_get_db()`** / **`_serialize()`** / **`_clean_rows()`** -- helpers reutilizaveis para conexao com DictCursor e serializacao de `date`, `Decimal`, `bytes` para JSON
- **`GET /api/busca?tipo=pessoa&termo=...`** -- busca em `pessoa` por CPF ou nome (LIKE), ou em `contrato` por grupo/cota com JOIN em pessoa
- **`GET /api/pessoa/<id>`** -- retorna pessoa + todos enderecos, telefones, emails e contratos vinculados (como devedor ou avalista)
- **`GET /api/contrato/<id>`** -- retorna contrato + devedor completo (com contatos), avalista completo (com contatos), todas as parcelas e historico de ocorrencias

### 2. HTML (`busca.html`) -- Reestruturado

- Formulario com select dinamico (Pessoa / Contrato) e campo de texto com placeholder que muda
- Tabela de resultados vazia, preenchida via JS, inicialmente oculta
- Modal generico com `<div id="modalContent">` preenchido dinamicamente

### 3. JavaScript (`busca.js`) -- Logica completa

- **Busca:** intercepta submit, chama `/api/busca`, renderiza tabela com colunas diferentes por tipo
- **Modal Pessoa:** secoes Dados Pessoais, Enderecos, Contatos (telefones + emails), Contratos Vinculados
- **Modal Contrato:** secoes Dados do Contrato, Devedor (com contatos), Avalista (com contatos), Parcelas (tabela), Ocorrencias (timeline)
- Helpers: `formatDate`, `formatCurrency`, `getStatusClass`, XSS-safe `esc()`

### 4. CSS (`busca.css`) -- Estilos adicionados

- `d-none`, `.no-results`, `.contact-grid`, `.contact-list` com badges de tipo

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

na busca por contrato, adicionar o filtro de status.

---

**Cursor**

Let me check the current state of the relevant files.

This is a small, well-scoped change. I have full context on all three files. Let me switch to agent mode to implement it directly.

Let me implement the status filter for contract search across all three files.

Now update the JS to show/hide the status filter and send it in the request.

Now update the fetch call to include the status parameter.

Now update the backend to accept and apply the status filter.

Pronto. O filtro de status para busca por contrato foi adicionado em 3 pontos:

1. **`busca.html`** -- Novo `<select id="status_filtro">` com opcoes Todos/Aberto/Fechado/Indenizado, oculto por padrao (`d-none`).

2. **`busca.js`** -- O select aparece automaticamente quando o tipo de busca muda para "Contrato" e desaparece para "Pessoa". O valor selecionado e enviado como `&status=` na URL do fetch.

3. **`app.py`** -- A rota `/api/busca` le o parametro `status` e, se preenchido, adiciona `AND c.status = %s` ao WHERE da query de contratos.

---

**User**

na importacao TXT, implemente para que o usuario possa importar pastas com TXTs dentro, e nao apenas arquivos TXT.

---

**Cursor**

Analisando a página de importação e o JavaScript atuais.



Verificando como o upload salva os arquivos — pastas podem conter TXT com o mesmo nome em subpastas.



Implementando seletor de pasta (`webkitdirectory`), ajustando o upload no servidor para caminhos relativos seguros e suporte a arrastar pastas (File System API).



Simplificando `_safe_txt_dest`: removendo a verificação regex redundante e corrigindo a lógica de `commonpath`.



Atualizando o HTML e o JavaScript, e adicionando estilos mínimos.



Resumo do que foi feito:

### Interface ([`templates/importacao.html`](templates/importacao.html))
- Dois botões na zona de upload: **Arquivos TXT** e **Pasta com TXT**.
- Input oculto extra com `webkitdirectory` e `directory` para escolher a pasta no sistema.
- Texto explicando que pastas são lidas em subpastas (só `.txt`).

### JavaScript ([`static/importacao.js`](static/importacao.js))
- **Pasta:** o seletor nativo preenche `File` com `webkitRelativePath`; no `FormData` usa-se `append('files', f, rel)` para o servidor receber o caminho relativo (evita colisão de nomes iguais em subpastas).
- **Arrastar e soltar:** uso de `webkitGetAsEntry` + leitura recursiva de diretórios (com `readEntries` em loop, como o Chrome exige) para juntar todos os `.txt`.
- Clique na área vazia da zona continua abrindo o seletor de **arquivos**; os botões abrem arquivo ou pasta e usam `stopPropagation` para não disparar o clique da zona.

### Backend ([`app.py`](app.py))
- **`_safe_txt_dest`:** grava cada upload só dentro da pasta temporária, preservando subpastas com `secure_filename` em cada segmento e `os.path.commonpath` contra path traversal.
- **`total_files`** no processamento SSE passou a contar `.txt` com `os.walk` na pasta temporária, alinhado ao script de importação que já faz `os.walk`.

### CSS ([`static/importacao.css`](static/importacao.css))
- Estilos para `.upload-pickers` e `.picker-btn`.

**Nota:** escolher pasta via diálogo depende de Chrome/Edge/Firefox (atributo `webkitdirectory`). Arrastar pasta costuma funcionar nos mesmos navegadores com File System API.

---

**User**

ao clicar para importar pasta, ele aparece o prompt para importar arquivo txt, e não a pasta com TXTs.

---

**Cursor**

Analisando o HTML e o JS da importação para identificar por que o clique em "Pasta" abre o seletor de arquivos.



Identificando a causa provável: o `dropZone` contém os dois `<input type="file">`. Um `folderInput.click()` programático pode gerar um evento de clique que sobe até o `dropZone`; o handler não reconhece o alvo como botão e chama `fileInput.click()`, abrindo o seletor de arquivos.



---

**User**

Corrigir prompt de pasta vs arquivo na importacao

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Duas correções aplicadas:

1. **`importacao.js`** -- Adicionada a guarda `if (e.target.closest('input[type="file"]')) return;` no handler de clique do `dropZone`, impedindo que um `click()` programático no `folderInput` propague e dispare `fileInput.click()`.

2. **`importacao.html`** -- Os dois `<input type="file">` foram movidos para **fora** da `div#dropZone`, eliminando a possibilidade de propagação de cliques na hierarquia DOM.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

ao clicar para iniciar o processamento, deve-se comparar todos os arquivos para obter a data mais antiga e a mais nova e colocar essas datas no range do tracker e rodar. No linux importei uma pasta e o tracker errou a data mais nova no tracker.

---

**Cursor**

Vou verificar a lógica atual de detecção de datas no backend.

Encontrei o problema. A query na linha 214-216 busca `WHERE data_processamento IS NULL`, que pode incluir arquivos de importações anteriores que nunca foram processados, ou pode retornar datas erradas se o `import_only_arquivos_gm.py` faz `ON DUPLICATE KEY UPDATE` e sobrescreve o `data_processamento` de arquivos que já tinham sido processados.

A solução correta é extrair as datas diretamente dos arquivos TXT no `temp_dir` **antes** de rodar o tracker, exatamente como o script de importação faz (lendo o header, posição 65-73, formato YYYYMMDD).

Agora tenho tudo o que preciso. A correção é direta - vou mudar para agent mode.

O problema está claro: a query `WHERE data_processamento IS NULL` pode incluir arquivos de importações anteriores pendentes, resultando em datas erradas no range do tracker. A correção correta é extrair as datas diretamente dos headers dos arquivos TXT que foram efetivamente enviados pelo usuário.

Vou substituir a consulta ao banco pela leitura direta dos arquivos.

Vou verificar o resultado final da seção alterada para confirmar que ficou correto.

A correção está feita. Aqui está o que mudou:

**Problema:** A detecção de datas usava uma query no banco (`SELECT MIN/MAX(data_arquivo) FROM arquivos_gm WHERE data_processamento IS NULL`), que incluía arquivos de importações anteriores pendentes, gerando um range de datas errado para o tracker.

**Correção:** Agora as datas são extraídas diretamente dos headers dos arquivos TXT que foram efetivamente enviados pelo usuário (no `temp_dir`), usando a mesma lógica do `import_only_arquivos_gm.py` - posição 65-73 da primeira linha (header `H`), formato `YYYYMMDD`. O `min()` e `max()` dessas datas determinam o range passado ao tracker.

Isso garante que o range sempre reflete exatamente os arquivos que o usuário importou naquela sessão, independentemente do estado do banco de dados.

---

**User**

@templates/relatorios.html na pagina de relatorio, implemente os filtros para gerar relatorios/filtrar contratos a partir de um range de 2 datas. tambem faça a implementacao para gerar esse relatorio em excel ou PDF

---

**Cursor**

Vou explorar o código atual para entender a estrutura da página de relatórios, o banco de dados e os padrões já usados no projeto.

Agora preciso entender a estrutura da tabela `contrato` no banco para saber quais colunas de data existem e como os "tipos" de relatório se mapeiam.

Now let me check the database schema more precisely to understand the `contrato` table columns and the `data_adesao` and `data_arquivo` fields.

> **Para o filtro de range de datas nos relatorios, qual campo de data do contrato deve ser usado para filtrar? As opcoes abaixo sao colunas que existem na tabela 'contrato'.**
> - data_adesao (data de adesao do contrato)
> - data_arquivo (a partir da tabela ocorrencia, data do arquivo que gerou a ultima ocorrencia)
> - Outro campo / Quero especificar
>
> Answer: query para contratos novos:
select distinct c.grupo, c.cota, o.data_arquivo from ocorrencia o 
left join contrato c on c.id = o.id_contrato
where o.status = 'aberto' and descricao like '%novo%'
and o.data_arquivo >= '2026-04-09' and o.data_arquivo <= '2026-04-30'

query para contratos fechados:
select distinct c.grupo, c.cota, o.data_arquivo from ocorrencia o 
left join contrato c on c.id = o.id_contrato
where c.status = 'fechado' and o.status = 'fechado'
and o.data_arquivo >= '2026-04-09' and o.data_arquivo <= '2026-04-30'

query para contratos indenizados:
select distinct c.grupo, c.cota, o.data_arquivo from ocorrencia o 
left join contrato c on c.id = o.id_contrato
where c.status = 'indenizado' and o.status = 'indenizado'
and o.data_arquivo >= '2026-04-09' and o.data_arquivo <= '2026-04-30'

> **O select 'Tipos de Contratos' na pagina mostra: Abertos, Pagos/Fechados, Indenizados, e Novos. 'Novos' deve filtrar contratos por qual criterio exatamente?**
> - Contratos cuja primeira ocorrencia (ou data de criacao no banco) esta dentro do range selecionado
> - Contratos com status = 'aberto' que nao possuem ocorrencia do tipo 'contrato voltou' (ou seja, realmente novos)
> - Outro criterio / Quero explicar
>
> Answer: contratos que estao na ocorrencia onde a coluna data_arquivo esta dentro do range e a descricao da ocorrencia é "contrato novo".

> **Voce forneceu as queries para Novos, Fechados e Indenizados. Qual seria a query para 'Contratos Abertos'? Seguindo o mesmo padrao:**
> - c.status = 'aberto' AND o.status = 'aberto' AND o.data_arquivo BETWEEN datas (mesma logica dos outros) ✔
> - c.status = 'aberto' (todos os contratos atualmente abertos, sem filtro de data da ocorrencia)
> - Outro criterio / Quero explicar

Tenho todas as informacoes necessarias. Vou montar o plano.

---

**User**

Relatorios - Filtros por data e exportacao Excel/PDF

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

I'll implement the plan step by step. Let me start by reading the current files I need to modify.

Now I have everything I need. Let me implement all changes.

**Step 1: Update requirements.txt**

**Step 2-4: Add all backend endpoints to app.py**

Now I'll add `send_file` to the Flask import and add all three endpoints plus the query builder:

Now add the import for `io` (needed for in-memory file generation):

Now add all the relatorio endpoints before the `if __name__` block:

**Step 5: Update relatorios.html**

**Step 6: Create relatorios.js**

Now let me check for lint errors on the modified files:

That warning is just because `fpdf2` is not installed yet in the environment - the package provides the `fpdf` module. This will resolve when `pip install fpdf2` is run. No actual code issue.

Let me install the new dependencies:

Todas as tarefas foram concluidas. Aqui esta o resumo do que foi implementado:

### Backend (`app.py`)

- **`_build_relatorio_query(tipo, data_inicial, data_final)`** - Monta a query SQL correta para cada tipo de relatorio (abertos, pagos, indenizados, novos), usando a tabela `ocorrencia` com `data_arquivo` como filtro de range, exatamente conforme as queries que voce especificou.

- **`GET /api/relatorios`** - Retorna JSON com os contratos filtrados (grupo, cota, numero_contrato, nome_devedor, status, data_arquivo).

- **`GET /api/relatorios/excel`** - Gera e retorna um arquivo `.xlsx` com header formatado (azul, bold, branco), linhas alternadas em cores, colunas com auto-width, e titulo com o tipo e periodo.

- **`GET /api/relatorios/pdf`** - Gera e retorna um PDF em paisagem (A4) com tabela formatada, header colorido, linhas alternadas, e contador de registros.

### Frontend (`relatorios.html` + `relatorios.js`)

- O HTML foi atualizado para usar IDs dinamicos, `<tbody>` vazio, e modal dinamico (mesmo padrao do modulo de busca).

- O JS implementa:
  - **Visualizar na Tela**: busca via `/api/relatorios` e renderiza tabela com resultados.
  - **Exportar Excel/PDF**: redireciona diretamente para os endpoints de download.
  - **Detalhes**: abre modal com dados completos do contrato via `/api/contrato/<id>` (mesmo endpoint ja existente).
  - **Validacao**: exige ambas as datas preenchidas e data inicial <= data final.

### Dependencias

- `openpyxl` e `fpdf2` adicionados ao `requirements.txt` e ja instalados.

---

**User**

ao selecionar o filtro de contratos novos na pagina relatorio, o seguinte erro aparece:
Erro: Unexpected token '<', "<!doctype "... is not valid JSON

Corrija este erro.

---

**Cursor**

Let me check the backend endpoint to find the bug.

Found the issue. The problem is in `_build_relatorio_query` -- for `novos`, the `LIKE '%novo%'` contains literal `%` signs that, combined with the query string construction, cause a SQL error. But more specifically, the `descricao` column likely contains "contrato novo" (not just "novo"), and the real issue is that Flask is returning a 500 error HTML page because the query crashes.

Let me check the `relatorios` route itself -- it could be that the `/relatorios` page route is intercepting `/api/relatorios`:

The routes look fine -- `/relatorios` and `/api/relatorios` are distinct. The issue is a SQL crash. The `LIKE '%novo%'` in the query uses `%` which pymysql might be misinterpreting because the `%` characters get mixed with the `%s` parameter placeholders when the full SQL string is constructed via concatenation.

Let me verify by looking at the exact query string generated:

The query for `novos` would be:
```
...WHERE o.status = 'aberto' AND o.descricao LIKE '%novo%' AND o.data_arquivo >= %s AND o.data_arquivo <= %s
```

With pymysql, the `%` in `'%novo%'` is interpreted as a format specifier when the library does parameter substitution. The `%n` in `%novo%` is treated as an invalid format code, causing a crash.

The fix is straightforward: escape the `%` as `%%` in the LIKE literal so pymysql treats them as literal percent signs.

This is a simple one-line fix. Let me switch to agent mode.

The error happens because pymysql uses `%` for parameter substitution, so `'%novo%'` in the SQL string gets misinterpreted -- `%n` is treated as an invalid format specifier, causing a crash. The fix is to escape the `%` as `%%` so pymysql treats them as literal percent signs.

Pronto. O problema era que o `%` em `LIKE '%novo%'` era interpretado pelo pymysql como especificador de formato (o `%n` em `%novo` causava o crash). Com `%%`, o pymysql entende como `%` literal, e a query enviada ao MariaDB fica corretamente `LIKE '%novo%'`.

---

**User**

para filtrar os contratos em abertos na pagina relatorio use a query:
SELECT 
    c.id AS id_contrato,
    c.grupo, 
    c.cota, 
    c.status AS status_contrato,
    MAX(o.data_arquivo) AS ultima_data_arquivo
FROM 
    contrato c
INNER JOIN 
    ocorrencia o ON c.id = o.id_contrato
WHERE 
    c.status = 'aberto'
GROUP BY 
    c.id, 
    c.grupo, 
    c.cota, 
    c.status;

podendo altera-la para mostrar mais informacoes.

---

**Cursor**

A query para "abertos" precisa ser diferente das demais -- ela usa `GROUP BY` com `MAX(o.data_arquivo)` em vez de `DISTINCT`. A correção é simples: tratar o caso `abertos` com uma query separada dentro de `_build_relatorio_query`.

Pronto. A query para "Contratos Abertos" agora usa a estrutura que voce especificou:

- `INNER JOIN ocorrencia` (em vez de `LEFT JOIN` partindo da ocorrencia)
- `WHERE c.status = 'aberto'` com filtro de range em `o.data_arquivo`
- `GROUP BY` nos campos do contrato + pessoa
- `MAX(o.data_arquivo)` para trazer a data do arquivo mais recente

As colunas extras (`numero_contrato`, `nome_devedor`) foram mantidas para a tabela e os exports ficarem completos. Os demais tipos (novos, pagos, indenizados) continuam com suas queries originais.

---

**User**

na pagina @templates/dashboard.html integre o banco para que os graficos sejam relacionados com os contratos. as querys para fazer essa filtragem de contratos pode ser relacionada com as queries do feitas na pagina relatorio.

---

**Cursor**

Let me explore the dashboard page and its related files to understand the current structure.

Now let me check the backend query helper and the relevant app.py sections for the relatorio queries:

I have all the context needed. Let me understand what the dashboard needs:

1. **4 KPI cards** - currently hardcoded: Em Cobranca (1.452), Pagos (284), Indenizados (56), Retomados (12)
2. **Line chart** - "Evolucao: Pagos vs Indenizados" - last 6 months, hardcoded data
3. **Pie/Doughnut chart** - "Distribuicao da Carteira" - hardcoded data
4. **Priority table** - "Prioridade de Cobranca" - hardcoded rows with contratos abertos
5. **Detail modal** - hardcoded, needs to be dynamic like busca/relatorios

I need to ask what "Retomados" means in terms of the database query, since the existing report types are abertos/pagos/indenizados/novos.

> **O KPI 'Retomados' no dashboard corresponde a qual criterio no banco? (os tipos conhecidos dos relatorios sao: abertos, pagos/fechados, indenizados, novos)**
> - Contratos com ocorrencia 'contrato voltou' (retornou ao status aberto apos ter sido fechado/indenizado)
> - E o mesmo que 'Contratos Novos' dos relatorios (descricao LIKE '%novo%')
> - Remover este KPI, nao se aplica
> - Outro criterio / Quero explicar ✔

> **O grafico de linhas 'Pagos vs Indenizados' mostra os ultimos 6 meses. Esses dados devem ser agrupados por mes de qual campo de data?**
> - data_arquivo da ocorrencia (quando a mudanca de status foi registrada)
> - data_adesao do contrato
> - Outro / Quero explicar
>
> Answer: correspodem a linhas da tabela de ocorrencia onde o status é aberto e descricao é "contrato voltou"

> **Pode explicar o criterio para 'Retomados'? Qual query ou condicao no banco define um contrato retomado?**
> - Ocorrencia com status='aberto' e descricao='contrato voltou' (contratos que voltaram a ficar abertos) ✔
> - Outro criterio / Quero digitar

Agora tenho tudo. Vou montar o plano.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Now I'll add the `/api/dashboard` endpoint before the `if __name__` block:

Now update the dashboard HTML:

Now rewrite dashboard.js:

Todas as tarefas concluidas. Aqui esta o resumo:

### Backend (`app.py`) - `GET /api/dashboard`

Um unico endpoint que retorna tudo que o dashboard precisa:

- **KPIs**: contagem de contratos abertos (total), pagos no mes, indenizados (total), retomados no mes (ocorrencias com `descricao = 'contrato voltou'`)
- **Grafico de linhas**: pagos e indenizados agrupados por mes (`DATE_FORMAT(o.data_arquivo, '%Y-%m')`) nos ultimos 6 meses
- **Grafico doughnut**: distribuicao total da carteira por `c.status`
- **Tabela de prioridade**: top 20 contratos abertos com parcelas em aberto, ordenados pelo vencimento mais antigo (`MIN(par.vencimento)`)

### Frontend (`dashboard.html`)

- KPIs com IDs dinamicos (`kpiAbertos`, `kpiPagos`, etc.) preenchidos via JS
- `<tbody id="prioridadeBody">` vazio para preenchimento dinamico
- Modal dinamico com `id="modalContent"` (mesmo padrao de busca/relatorios)
- Removido `busca.js` do block scripts

### Frontend (`dashboard.js`)

- Faz `fetch('/api/dashboard')` ao carregar a pagina
- Popula os 4 KPIs formatados com `toLocaleString('pt-BR')`
- Cria grafico de linhas (Chart.js) com labels de mes formatados (ex: "Abr/26")
- Cria grafico doughnut com cores mapeadas por status
- Renderiza tabela de prioridade com classificacao automatica:
  - **Critico**: vencimento > 60 dias atras
  - **Atencao**: vencimento > 30 dias atras
  - **Recente**: < 30 dias
- Botao "Acessar" abre modal com detalhes completos via `/api/contrato/<id>`
- Filtro de status na tabela funcional (checkboxes Critico/Atencao/Recente)

---

**User**

no banco, crie uma tabela de funcionarios que contem colunas de id auto increment primary key, nome, data de nascimento, cpf/cnpj (chave unica), status com valores de "operando" ou "inoperante" somente.

crie outra tabela chamada funcionario_cobranca onde tem a coluna id auto increment primary key, id_funcionario, id_contrato.

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

The FK error means the `contrato.id` column type doesn't match `INT`. Let me check:

The `contrato.id` is `BIGINT(20)`, so the FK column needs to match. Same check for `funcionario.id` - I'll use `BIGINT` for consistency:

Ambas criadas. Vou verificar:

As duas tabelas foram criadas com sucesso no banco `consorcio_gm`:

**`funcionario`**
| Coluna | Tipo | Detalhes |
|---|---|---|
| id | INT | AUTO_INCREMENT, PRIMARY KEY |
| nome | VARCHAR(255) | NOT NULL |
| data_nascimento | DATE | |
| cpf_cnpj | VARCHAR(20) | NOT NULL, UNIQUE |
| status | ENUM('operando','inoperante') | NOT NULL, DEFAULT 'operando' |

**`funcionario_cobranca`**
| Coluna | Tipo | Detalhes |
|---|---|---|
| id | BIGINT | AUTO_INCREMENT, PRIMARY KEY |
| id_funcionario | INT | NOT NULL, FK -> funcionario(id) |
| id_contrato | BIGINT | NOT NULL, FK -> contrato(id) |

Nota: `id_contrato` foi criado como `BIGINT` para ser compativel com a coluna `contrato.id` que ja existia como `BIGINT(20)` (a FK exige tipos identicos).

---

**User**

nas tabelas de funcionario e funcionario_cobranca, adicione mais 2 colunas chamadas created_at tipo timestamp e updated_at do tipo timestamp, ambas com valor default igual a data que foram inseridas.

---

**Cursor**

Pronto. As duas colunas foram adicionadas em ambas as tabelas:

- **`created_at`** - `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` (preenchido automaticamente na inserção)
- **`updated_at`** - `TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` (atualizado automaticamente a cada modificação)

---

**User**

na tabela de funcionario, adicione colunas de login e senha. ambas sendo do tipo varchar(50)

---

**Cursor**

Feito. As colunas `login` e `senha` (ambas `VARCHAR(50)`) foram adicionadas à tabela `funcionario`.

---

**User**

mude a coluna status da tabela funcionario para o nome ativo e para o tipo bit(1)

---

**Cursor**

Feito. A coluna foi renomeada de `status` para `ativo`, tipo alterado para `BIT(1)` com default `1` (ativo).

---

**User**

na tabela de telefone, adicione coluna chamada CPC que pode ser nula e limitar os valores para "sim", "não", "amigo", "parente" e outra coluna de status que pode ser nula e limitar os valores para "bom", "medio", "ruim".

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Feito. As duas colunas foram adicionadas à tabela `telefone`:

- **`cpc`** - `ENUM('sim','não','amigo','parente')` DEFAULT NULL
- **`status`** - `ENUM('bom','medio','ruim')` DEFAULT NULL

---

**User**

quando o usuario clicar para expandir os detalhes de algum contrato ou pessoa/consorciado/avalista, quando aparecer o telefone, adicionar um botao ao lado com um icone de telefone para ligar. nao adicionar a funcionalidade ligar.

---

**Cursor**

Let me check all the files that render phone numbers in modals.

Now let me also check `busca.js` for the `renderPessoaModal` phone rendering (separate from `renderPessoaSection`):

All files have the same 3-line pattern. The change is identical in all of them: add a call button before the `</li>`. This is a simple, repetitive change across 5 JS files plus a small CSS addition.

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Now update all 5 JS files. The replacement is the same in all of them — adding the button line after the ramal line and before the contact-tipo line.

`busca.js` has 2 occurrences. Let me check the exact context to make unique replacements.

The first occurrence (line 182) uses `data.telefones.forEach` and the second (line 314) uses `telefones.forEach`. Both have the same 3-line inner block. I'll use `replace_all` since the 3-line pattern is identical in both places within the file.

Feito. O botao de ligar foi adicionado em todos os modais:

- **CSS** (`busca.css`): estilo `.btn-ligar` com borda azul, hover com fundo azul e texto branco
- **JS** (6 ocorrencias em 5 arquivos): botao com icone `fa-phone-volume` inserido ao lado de cada telefone, entre o ramal e o tipo de contato

O botao aparece em qualquer modal que exiba telefones — busca, dashboard, relatorios, cobranca e cadastro. Nenhuma funcionalidade de ligacao foi adicionada, conforme solicitado.

---

**User**

ao pesquisar por pessoa e aparecer os contratos que estao relacionados a ela, adicione um botao ao lado para mostrar os detalhes do contrato tmb. se possivel, adicionar um botao de voltar para tras.

---

**Cursor**

Now let me also look at the `renderContratoModal` function and the modal open/close logic in `busca.js`:

I now have the full picture. The plan is straightforward:

---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementing CSS and busca.js changes.



Usando `String(c.id)` no atributo `data-contrato-id` — IDs numéricos não precisam de `esc`; mantendo `String(c.id)` para segurança.



Resumo do que foi feito:

### [static/busca.css](static/busca.css)
- Estilos para `.modal-nav-back` e `.btn-voltar-pessoa` (botão discreto com hover).

### [static/busca.js](static/busca.js)
- **`_pessoaCache`** e **`_fromPessoa`**: ao abrir detalhes da pessoa, os dados ficam em `_pessoaCache`; ao abrir contrato a partir desse modal, `_fromPessoa` fica `true`.
- **`openDetails`**: no início define `_fromPessoa = false` (detalhe de contrato vindo da busca não mostra “Voltar”).
- **Tabela “Contratos vinculados”**: coluna **Ações** com botão **Detalhes** (`data-contrato-id`).
- **`bindPessoaModalContratoButtons`**: após renderizar o modal da pessoa, associa o clique ao fetch de `/api/contrato/<id>` e chama `renderContratoModal`.
- **`renderContratoModal`**: se `_fromPessoa`, inclui o botão **“Voltar para pessoa”** no topo; o clique chama `renderPessoaModal(_pessoaCache)` e os botões de contrato são ligados de novo.

Abrir contrato pela busca (tipo contrato) continua sem o botão voltar; só aparece quando o contrato é aberto a partir do modal da pessoa.

---

**User**

na pagina de performance @templates/performance.html integre as safras aos contratos do banco de dados. Pode usar a tabela de ocorrencias que possui a coluna data_arquivo para saber os contratos que foram abertos, fechados ou indenizados no periodo da safra.

A safra tem 4 partes dentro de um mes:
parte1: dia 1 ao dia 9 do mes;
parte2: dia 10 ate o dia 12 do mes;
parte3: dia 13 ao dia 19 do mes;
parte4: dia 20 ate o ultimo dia do mes.

a safra, como mostra no arquivo html, tem que mostrar o que aconteceu no mes escolhido (30 dias, mes escolhido pelo usuario), segundo mes (60 dias, o proximo mes do mes escolhido pelo usuario) e no terceiro mes (90 dias)

---

**Cursor**

Analisando a página de performance e a estrutura atual para planejar a integração.



Implementando o endpoint `/api/performance` com a lógica de safras e atualizando `performance.html` e `performance.js`.



Corrigindo a função de divisão de intervalos e o doughnut por safra; ajustando a consulta SQL global.



Resumo do que foi implementado:

### Backend – [`app.py`](app.py)

Novo endpoint **`GET /api/performance?mes=YYYY-MM`**:

- **Safras** (mesmo recorte de dias em cada mês): parte 0 = dias 1–9, 1 = 10–12, 2 = 13–19, 3 = 20 até o fim do mês.
- **Por safra** (no mês escolhido **M** e nas mesmas janelas de dias em **M+1** e **M+2**):
  - **volume**: contratos distintos com qualquer ocorrência em `data_arquivo` na safra só em **M**.
  - **Até 30 dias**: distintos com `status IN ('fechado','indenizado')` na safra em **M**.
  - **Até 60 dias**: mesma regra na união das safras de **M** e **M+1**.
  - **Até 90 dias**: união das safras de **M**, **M+1** e **M+2**.
- **Gráfico geral (barras)**: por safra, novos (`aberto` + `descricao LIKE '%novo%'`) vs fechado/indenizado no mês **M**.
- **Detalhe “Analisar safra”**: o mês **M** é dividido em 4 subperíodos dentro da safra; em cada um conta novos vs fechado/indenizado.
- **Doughnut do detalhe da safra**: fatias `[d30, max(0,d60-d30), max(0,d90-d60)]` (camadas cumulativas de recuperação).
- **Doughnut global**: contratos **abertos** com parcela **vencida**, agrupados por atraso do **menor vencimento** em aberto: 1–30, 31–60, &gt;60 dias.
- **KPIs**: novos no mês; safra do dia (calendário atual); % recuperação (fechado+indenizado / todas as ocorrências com status aberto/fechado/indenizado no mês); parcelas críticas (aberto, vencimento há mais de 90 dias).

### Frontend – [`templates/performance.html`](templates/performance.html)

- KPIs com IDs para preenchimento via JS.
- Tabela com `<tbody id="safraTableBody">` preenchido pela API.
- `input type="month"` sem valor fixo; o mês padrão é definido no JS.

### Frontend – [`static/performance.js`](static/performance.js)

- Define o mês atual no filtro e chama **`/api/performance`** ao carregar e ao mudar o mês.
- Monta a tabela, os gráficos e os botões **Analisar Safra** com os dados retornados.

Assim, as colunas **30 / 60 / 90 dias** refletem o **mesmo recorte de safra** (dias do mês) repetido no mês selecionado e nos dois seguintes, usando **`ocorrencia.data_arquivo`** e status **fechado / indenizado**, alinhado ao que você descreveu.

