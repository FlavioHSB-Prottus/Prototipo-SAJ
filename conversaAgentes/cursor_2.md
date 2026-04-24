# Implementação de scripts para importação de dados
_Exported on 4/24/2026 at 14:47:59 GMT-3 from Cursor (3.1.17)_

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

---

**User**

Leia o arquivo @transcripts/gemini.md  para entender o contexto do que já foi construído neste projeto e as decisões que tomamos até agora. Me avise quando terminar para continuarmos.

---

**Cursor**

Terminei de ler o `transcripts/gemini.md` (o arquivo é muito grande; li o início, trechos do meio e usei busca por seções principais). Segue o que ficou claro do contexto e das decisões:

### Stack e base
- **Flask** + **MariaDB** `consorcio_gm` (user `root`), front em **HTML + JS vanilla** (sem framework pesado).
- **Modais** padronizados com estilos de `busca.css` em várias telas.

### Funcionalidades já construídas (transcript)
- **Tramitação no modal de contrato**: `/api/contrato/<id>` passou a incluir `tramitacao` (JOIN com `funcionario` para nome); seção colapsável **Tramitações** (Data, Tipo, CPC, Descrição, depois **Funcionário**); replicada em **busca, dashboard, relatórios, cobrança, cadastro, operadores**.
- **Coluna `descricao` (TEXT)** em `tramitacao` + exibição no front.
- **Botões** ao lado de telefone/e-mail: **ligar** (`.btn-ligar`) e **enviar mensagem** (`.btn-mensagem`).
- **Agenda**: calendário dinâmico, `GET/POST/PATCH` em `/api/agenda`, tarefas por dia, `status` pendente/concluído, vínculo opcional **Grupo/Cota** (validação se contrato existe), modal estilo busca (`busca.css` na agenda), **Acessar contrato** abre o mesmo fluxo de detalhe que a busca.
- **`scripts/criar_banco.py`**: refatorado para **SQL em bloco** (`RAW_SQL`), `IF NOT EXISTS`, remoção de sufixos `ENGINE/CHARSET` nas `CREATE TABLE` por pedido.
- **`contrato`**: colunas **`id_empresa`** e **`id_seguradora`** (FK `empresa`); discussão sobre **NOT NULL** vs dados legados (muitos contratos, `empresa` vazia).
- **`funcionario`**: colunas de contato/endereço, `departamento`, `nivel_acesso`, `sexo`, `matricula`, etc.

### Decisões / padrões
- Reutilizar **`renderContratoModal`** (e padrões de busca) onde faz sentido (ex.: agenda).
- **SSE + subprocessos** para importação TXT (mencionado no resumo cruzado com `cursor_transcript` dentro do próprio gemini.md).
- Evolução do schema documentada no transcript e alinhada ao `criar_banco.py`.

---

**Pode continuar:** estou alinhado com esse contexto. Diga o próximo passo (tela, API, migração ou ajuste) que seguimos a partir daí.

---

**User**

na pagina de login @templates/login.html , use a tabela funcionario e as colunas login e senha desta tabela para efetuar o login no sistema. no momento, apenas altere esta pagina html

---

**Cursor**

Ajustando apenas o HTML: campos `login` e `senha` (nomes alinhados à tabela `funcionario`) e `action` apontando para a rota de login.



Alterações feitas **somente** em `templates/login.html`:

### O que mudou
1. **`action`** — de `#` para `{{ url_for('login') }}`, para o `POST` ir para a mesma rota `/` (`login()` no Flask).
2. **Campos alinhados à tabela `funcionario`** — `name="login"` e `name="senha"`, com `id` correspondentes, para o backend poder usar `request.form['login']` e `request.form['senha']` num `SELECT` em `funcionario`.
3. **Rótulos e placeholders** — texto focado em login de funcionário e senha.
4. **`autocomplete`** — `username` no login e `current-password` na senha, para o navegador preencher corretamente.

### Observação
A validação contra o banco ainda precisa ser implementada em `app.py` (por exemplo, consultar `funcionario` onde `login` = valor enviado e conferir `senha`). Enquanto isso não existir, o comportamento do servidor continua o de antes (qualquer `POST` em `/` redireciona para `home`). Quando for implementar, use os nomes **`login`** e **`senha`** no formulário.

---

**User**

implemente esta consulta

---

**Cursor**

Explorando como o projeto conecta ao banco e implementando a autenticação na rota de login.



Implementando a consulta na rota `login`, usando `_get_db()` existente, sessão Flask e proteção básica das rotas. Verificando onde inserir `before_request` e se `login.html` precisa exibir mensagens.



Implementando a consulta em `app.py`, configurando sessão e adicionando exibição de erros em `login.html` e estilos mínimos em `login.css`.



## O que foi feito

### `app.py`
- **`login()` (POST)**  
  - Lê `login` e `senha` do formulário.  
  - Executa:  
    `SELECT id, nome, senha, ativo FROM funcionario WHERE login = %s LIMIT 1`  
  - Exige funcionário **ativo** (`ativo` bit(1)).  
  - Compara a senha com `secrets.compare_digest` (texto igual ao da coluna `senha`, como no seed).  
  - Em caso de sucesso: `session['funcionario_id']`, `session['funcionario_nome']` e redirecionamento para `home`.  
  - Em falha ou erro de banco: `flash` e volta ao template de login.

- **Sessão**  
  - `app.secret_key` vindo de `FLASK_SECRET_KEY` no ambiente, com fallback só para desenvolvimento.

- **`@app.before_request`**  
  - Rotas públicas: `login`, `static`, `recuperar_senha`.  
  - Demais rotas exigem `funcionario_id` na sessão.  
  - URLs `/api/...` sem sessão respondem **401 JSON** `{ "error": "Não autenticado" }`.

### `templates/login.html` + `static/login.css`
- Bloco para **`get_flashed_messages`** e estilo `.login-flash-error` para mensagens de erro.

---

**Produção:** defina `FLASK_SECRET_KEY` com um valor aleatório forte.

**Logout:** não foi criada rota de saída; se quiser, dá para acrescentar algo como `GET /logout` que faz `session.clear()` e redireciona para `/`.

Se o front chamar APIs sem cookie de sessão (outro domínio ou `fetch` sem `credentials`), será preciso ajustar o `fetch` para `credentials: 'include'` ou tratar o 401 na interface.

---

**User**

ainda na pagina de login, remova a funcionalidade e a opcao de "esquecer a senha".

---

**Cursor**

Alteração localizada: o link está em `login.html`; o CSS `.forgot-password` ficará órfão se não for removido.



A página `recuperar_senha.html` reutiliza a classe `.forgot-password` para o link “Voltar para o login”, portanto não devemos apagar essas regras em `login.css` sem ajustar esse template.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Removi o bloco com o link **“Esqueceu a senha?”** em [`templates/login.html`](templates/login.html): o formulário passa do campo de senha direto para o botão **Entrar**.

As regras `.forgot-password` em `login.css` e a rota `/recuperar_senha` foram mantidas, como no plano, para não afetar a página de recuperação e o link “Voltar para o login”.

---

**User**

nas demais pagina onde aparece a seguinte parte da imagem, altere a palavra João Barbosa para o nome do funcionário e adicione a função de sair da conta no botão.

---

**Cursor**

Procurando onde o cabeçalho com "João Barbosa" e "Sair" aparece nos templates e como a sessão expõe o nome do funcionário.



Confirmando: o cabeçalho está centralizado em `layout.html`; todas as páginas autenticadas que o usam estendem esse template. Não há rota `logout` em `app.py`.



O cabeçalho está apenas em `layout.html`; não é necessário editar cada página individualmente.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Resumo do que foi feito:

### [`templates/layout.html`](templates/layout.html)
- **Nome:** `João Barbosa` passou a `{{ session.get('funcionario_nome') or 'Usuário' }}` (usa o nome gravado no login; se vier vazio, mostra "Usuário").
- **Sair:** o `href` deixou de ser `/` e passou a `{{ url_for('logout') }}`.

### [`app.py`](app.py)
- Nova rota **`GET /logout`:** `session.clear()` e redirecionamento para a página de login.
- **`_require_login`:** `'logout'` incluído em `public`, para `/logout` funcionar mesmo sem sessão.
- Docstring de `_require_login` atualizada para citar o logout.

Como todas as páginas internas usam `{% extends 'layout.html' %}`, o nome e o sair passam a valer em todas elas de uma vez.

---

**User**

na tabela funcionario, adicionei uma coluna chamada foto do tipo mediumblob. na pagina @templates/layout.html altere a parte de imagem de perfil para aceitar a imagem da coluna foto.

---

**Cursor**

Analisando o layout atual, o login e o esquema da tabela `funcionario` para definir como servir o `mediumblob`.



Confirmando: não colocar o BLOB na sessão; servir bytes via rota autenticada e referenciar essa URL no `<img>`.



---

**User**

adicionar: no botao configuracao, quando o usuario clicar, adicionar um card com opcao de inserir foto

---

**Cursor**

Iterando o plano: explorar como o menu de perfil e a UI funcionam para descrever o card de upload ao clicar em "Configurações".



Atualizando o plano: incluir o card "Configurações" com upload de foto, rota POST e integração com `home.js`/`home.css`.



Atualizei o plano em [`avatar_foto_funcionario_bc740274.plan.md`](file:///c%3A/Users/flavi/.cursor/plans/avatar_foto_funcionario_bc740274.plan.md) com o que pediu. Resumo do que foi acrescentado:

### Novo comportamento: **Configurações → card com foto**
- O link **Configurações** deixa de ser só `#`: ganha um id (ex. `openConfigFotoBtn`) para o [`home.js`](c:\Users\flavi\OneDrive\Desktop\JB\GM\Prototipo-SAJ\static\home.js) abrir um **overlay + card** (markup novo no [`layout.html`](c:\Users\flavi\OneDrive\Desktop\JB\GM\Prototipo-SAJ\templates\layout.html)).
- O card inclui **input file** (tipos de imagem aceites), **Enviar** e **Fechar** (e fechar ao clicar fora, alinhado ao padrão dos outros dropdowns).
- **Backend:** rota **POST** (mesmo URL que o GET da foto ou endpoint `/api/...`) que grava o binário em `funcionario.foto` para o `funcionario_id` da sessão, com validação de tamanho e assinatura mágica.
- **Front:** `fetch` com **`credentials: 'include'`**; após sucesso, refrescar o `src` do avatar com `?t=timestamp` para evitar cache antigo.
- Estilos novos em [`home.css`](c:\Users\flavi\OneDrive\Desktop\JB\GM\Prototipo-SAJ\static\home.css).

### To-dos no plano (4 itens)
1. GET `/minha-foto` + helper MIME  
2. POST upload + `UPDATE`  
3. `layout.html`: avatar + modal/card + id no Configurações  
4. `home.js` + `home.css`: abrir/fechar, envio, feedback  

Quando quiser que isto passe a código no repositório, diga para **executar o plano** (implementação).

---

**User**

executar o plano

---

**Cursor**

Implementando o plano completo: lendo os ficheiros relevantes e aplicando as alterações.



Implementando: inserindo a rota e os helpers após `logout`; adicionando `abort` ao import do Flask.



Implementação concluída. Resumo:

### [`app.py`](app.py)
- **`abort`** importado no Flask.
- **`FOTO_MAX_BYTES`** = 5 MB; **`_guess_image_mimetype`** e **`_mimetype_for_stored_blob`** (JPEG, PNG, GIF, WebP).
- **`GET /minha-foto`:** lê `foto` do `funcionario` do utilizador em sessão; **404** se não houver registo/foto; resposta com `Cache-Control: private, max-age=3600`.
- **`POST /minha-foto`:** campo de ficheiro **`foto`**, validação de tamanho e formato; **`UPDATE funcionario SET foto = %s WHERE id = %s`** com `commit` / `rollback`; JSON `{ "ok": true }` ou `{ "error": "..." }` com código adequado.

### [`templates/layout.html`](templates/layout.html)
- Avatar: **`src="{{ url_for('minha_foto') }}"`**, classe **`header-avatar-img`**, **`onerror`** para o logo estático se não existir foto ou falhar o carregamento.
- Link **Configurações** com **`id="openConfigFotoBtn"`**.
- **Overlay** `#configFotoOverlay` com **`data-minha-foto-url`**, card com título, texto de ajuda, input file, botão Enviar, mensagem de erro e botão fechar (**×**).

### [`static/home.js`](static/home.js)
- Abrir modal em **capture** no Configurações (evita o toggle do dropdown do perfil).
- Fechar: fundo do overlay, **×**, após envio com sucesso.
- **`fetch`** com **`credentials: 'include'`** e `FormData` com **`foto`**; resposta tratada como texto + JSON opcional.
- Em sucesso: atualiza **`src`** do avatar com **`?t=timestamp`**.

### [`static/home.css`](static/home.css)
- Estilos para **`.config-foto-overlay`**, **`.config-foto-card`**, botões e mensagem, alinhados ao restante do layout (overlay semelhante aos modais de avisos).

**Nota:** a coluna **`foto`** tem de existir na base (como já referiu). Se o `UPDATE` falhar (ex.: coluna em falta), o utilizador vê a mensagem devolvida em JSON.

---

**User**

quando o usuario clicar em "meu perfil", mostrar um card. contendo todas as informacoes do funcionario que esta logado(exceto o id). o card deve ser similar ao que aparece quando o usuario clica em detalhes de um contrato.

---

**Cursor**

Analisando o card de detalhes do contrato e os dados disponíveis do funcionário para elaborar o plano.



Confirmando: o modal de contrato usa `#detalhesModal`, `.modal-overlay`, `.modal-container`, `.detail-section` e `.detail-grid` em `busca.css`; `layout.html` só carrega `home.css`, portanto precisamos replicar esses estilos ou incluir uma folha adicional.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando a rota da API e, em seguida, layout, JS e CSS.



Resumo do que foi implementado:

### [`app.py`](app.py)
- **`GET /api/funcionario/perfil`** (`api_funcionario_perfil`): usa `funcionario_id` da sessão, faz `SELECT` só com `nome`, `data_nascimento`, `cpf_cnpj`, `ativo`, `created_at`, `updated_at`, `login`, `acesso_externo`, `email`, `ddd`, `numero`, `logradouro`, `bairro`, `complemento`, `cep`, `cidade`, `estado`, `departamento`, `nivel_acesso`, `sexo`, `matricula` (sem **`id`**, **`senha`** e **`foto`**). Resposta `{ "funcionario": _clean_row(row) }` ou erro 404/500/401.

### [`templates/layout.html`](templates/layout.html)
- Link **Meu Perfil** com **`id="openPerfilBtn"`**.
- Modal **`#perfilModal.modal-overlay`** com `data-perfil-url="{{ url_for('api_funcionario_perfil') }}"`, `.modal-container`, cabeçalho com **`#perfilModalTitle`** e botão **`#closePerfilModalBtn`**, corpo **`#perfilModalBody`**.

### [`static/home.js`](static/home.js)
- Abertura em **capture** em `#openPerfilBtn` (fecha o dropdown do perfil).
- Spinner → **`fetch`** com `credentials: 'include'` → conteúdo com **`.detail-section`**, **`.detail-grid`** e **`.data-item`** / rótulos em português (`PERFIL_LABELS` + ordem em `PERFIL_FIELD_ORDER`).
- Título com nome em **`.text-accent`** quando existir.
- Fecho: botão X, clique no fundo do overlay; repõe **`overflow`** do `body`.

### [`static/home.css`](static/home.css)
- Estilos do modal sob **`#perfilModal`**, alinhados ao modal de detalhes em `busca.css`, com **`z-index: 10050`** (acima do overlay de foto ~1200).

---

**User**

se o funcionario tive foto igual a null, mostrar a seguinte imagem com um fundo azul:

---

**Cursor**

Confirmando: hoje `GET /minha-foto` devolve 404 sem foto e o `onerror` do header usa o logo da empresa. O plano deve usar o ícone fornecido sobre fundo azul.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Criando `avatar-placeholder.svg` (ícone de perfil em linha, fundo transparente) — o PNG fornecido não está no repositório; o SVG reproduz o efeito pedido com o fundo azul no CSS.



Usando o PNG copiado do asset do utilizador como ficheiro principal.



Implementação concluída. Resumo:

### Asset
- Copiado o PNG do Cursor para [`static/imagens/avatar-placeholder.png`](c:\Users\flavi\OneDrive\Desktop\JB\GM\Prototipo-SAJ\static\imagens\avatar-placeholder.png) (~3,7 KB).

### [`app.py`](app.py)
- Funções **`_avatar_placeholder_path()`** e **`_send_avatar_placeholder()`** (ficheiro PNG, `Content-Type: image/png`, `Cache-Control: private, max-age=3600`).
- Em **`GET /minha-foto`**, se `foto` for `NULL` ou vazia (mas o funcionário existir), responde com **`send_file`** do placeholder em vez de **404**. Se o ficheiro não existir, mantém-se **404**.

### [`static/home.css`](static/home.css)
- **`.avatar`**: fundo **`var(--accent-color)`** (azul do tema).
- **`.avatar img`**: **`object-fit: contain`** e **`padding: 3px`** para o ícone não encostar à borda e o azul aparecer à volta.

### [`templates/layout.html`](templates/layout.html)
- **`onerror`** do avatar passa a usar **`imagens/avatar-placeholder.png`** em vez do logo.

Assim, sem foto na base, `/minha-foto` devolve o ícone; com foto, devolve a imagem guardada; o círculo do header fica sempre com fundo azul.

---

**User**

camila tem a coluna foto igual a null no banco e mesmo assim a foto de ana aparece no lugar. corrija este erro.

---

**Cursor**

Investigando: a mesma URL `/minha-foto` para todos os utilizadores pode fazer o browser reutilizar a imagem em cache ao trocar de sessão.



Causa provável: cache HTTP do browser — `/minha-foto` é igual para todos; com `max-age=3600` o browser pode mostrar a foto da sessão anterior (Ana) quando Camila entra.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Alterações feitas:

### [`app.py`](app.py)
- **`_send_avatar_placeholder`:** `Cache-Control: private, no-store` e **`Vary: Cookie`** (em vez de `max-age=3600`).
- **Resposta `Response` da foto na BD:** os mesmos cabeçalhos.

Assim o browser deixa de guardar `/minha-foto` entre sessões de forma a mostrar a imagem de outro utilizador.

### [`templates/layout.html`](templates/layout.html)
- **`src` do avatar:** `{{ url_for('minha_foto') }}?u={{ session.get('funcionario_id', '') }}` para a chave de cache variar por utilizador.
- **`data-minha-foto-url`:** o mesmo URL (o **POST** continua a funcionar com a query).

### [`static/home.js`](static/home.js)
- Após upload com sucesso: se o URL já tiver `?`, usa **`&t=`**; senão **`?t=`**, para invalidar a imagem sem duplicar `?`.

Com isto, ao entrar com a Camila (`foto` NULL), o pedido vai ao servidor e deve aparecer o placeholder, não a foto em cache da Ana.

---

**User**

qual a diferença da query de criar banco e dessa aqui?
-- consorcio_gm.arquivos_gm definition

CREATE TABLE `arquivos_gm` (
  `id_arquivo_gm` int(11) NOT NULL AUTO_INCREMENT,
  `data_arquivo` date DEFAULT NULL,
  `conteudo` longtext DEFAULT NULL,
  `data_processamento` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_arquivo_gm`),
  UNIQUE KEY `arquivos_gm_data_arquivo_IDX` (`data_arquivo`) USING BTREE,
  KEY `idx_dt_arq` (`data_arquivo`)
) ENGINE=InnoDB AUTO_INCREMENT=817 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.funcionario definition

CREATE TABLE `funcionario` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `data_nascimento` date DEFAULT NULL,
  `cpf_cnpj` varchar(20) NOT NULL,
  `ativo` bit(1) NOT NULL DEFAULT b'1',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `login` varchar(50) DEFAULT NULL,
  `senha` varchar(50) DEFAULT NULL,
  `acesso_externo` bit(1) DEFAULT b'0',
  `email` varchar(255) DEFAULT NULL,
  `ddd` varchar(5) DEFAULT NULL,
  `numero` varchar(30) DEFAULT NULL,
  `logradouro` varchar(255) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cep` varchar(10) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `departamento` varchar(25) DEFAULT NULL,
  `nivel_acesso` varchar(20) DEFAULT NULL,
  `sexo` varchar(1) DEFAULT NULL,
  `matricula` varchar(25) DEFAULT NULL,
  `foto` mediumblob DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf_cnpj` (`cpf_cnpj`),
  UNIQUE KEY `funcionario_login_IDX` (`login`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.grupo definition

CREATE TABLE `grupo` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.pessoa definition

CREATE TABLE `pessoa` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cpf_cnpj` varchar(20) DEFAULT NULL,
  `nome_completo` varchar(255) DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `profissao` varchar(100) DEFAULT NULL,
  `conjuge_nome` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf_cnpj` (`cpf_cnpj`)
) ENGINE=InnoDB AUTO_INCREMENT=2298384 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.email definition

CREATE TABLE `email` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL DEFAULT 'principal',
  `email` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_email_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_email_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=535551 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.empresa definition

CREATE TABLE `empresa` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `apelido` varchar(15) NOT NULL,
  `ativo` bit(1) DEFAULT NULL,
  `bradesco` bit(1) DEFAULT NULL,
  `id_pessoa` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_pessoa` (`id_pessoa`),
  CONSTRAINT `empresa_ibfk_1` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.endereco definition

CREATE TABLE `endereco` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL COMMENT 'principal, secundario, avalista_principal, ...',
  `logradouro` varchar(255) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cep` varchar(10) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_endereco_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_endereco_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_endereco_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=505582 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.funcionario_grupo definition

CREATE TABLE `funcionario_grupo` (
  `id_funcionario` int(11) NOT NULL,
  `id_grupo` bigint(20) NOT NULL,
  PRIMARY KEY (`id_funcionario`,`id_grupo`),
  KEY `fk_grupo` (`id_grupo`),
  CONSTRAINT `fk_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_grupo` FOREIGN KEY (`id_grupo`) REFERENCES `grupo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.header definition

CREATE TABLE `header` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_reg` varchar(1) DEFAULT NULL,
  `cnpj` varchar(14) DEFAULT NULL,
  `empresa` varchar(50) DEFAULT NULL,
  `data` varchar(15) DEFAULT NULL,
  `numero_do_lote` varchar(6) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_header_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_header_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1020 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro2 definition

CREATE TABLE `registro2` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `aviso` varchar(8) DEFAULT NULL,
  `tipomov` varchar(4) DEFAULT NULL,
  `vencimento` varchar(15) DEFAULT NULL,
  `agentecob` varchar(6) DEFAULT NULL,
  `valorpar` varchar(30) DEFAULT NULL,
  `multajur` varchar(30) DEFAULT NULL,
  `valortot` varchar(30) DEFAULT NULL,
  `numeroext` varchar(20) DEFAULT NULL,
  `datenvio` varchar(15) DEFAULT NULL,
  `assembléia` varchar(3) DEFAULT NULL,
  `numero_parcela` varchar(3) DEFAULT NULL,
  `fdo_comum` varchar(30) DEFAULT NULL,
  `tx_adm` varchar(30) DEFAULT NULL,
  `fd_reserva` varchar(30) DEFAULT NULL,
  `seguro` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r2_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r2_parcela` (`numero_parcela`),
  KEY `idx_r2_vencimento` (`vencimento`),
  KEY `idx_r2_join` (`id_arquivo_gm`,`grupo`,`cota`),
  KEY `idx_r2_num_venc` (`numero_parcela`,`vencimento`),
  KEY `idx_r2_parcela_single` (`numero_parcela`),
  KEY `idx_r2_vencimento_single` (`vencimento`),
  KEY `idx_r2_valor` (`valortot`),
  KEY `idx_r2_juros` (`multajur`),
  CONSTRAINT `fk_registro2_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2433933 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro3 definition

CREATE TABLE `registro3` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `chassi` varchar(21) DEFAULT NULL,
  `placa` varchar(10) DEFAULT NULL,
  `codigo_renavam` varchar(13) DEFAULT NULL,
  `modelo` varchar(15) DEFAULT NULL,
  `ano_modelo` varchar(9) DEFAULT NULL,
  `cor` varchar(16) DEFAULT NULL,
  `marca` varchar(20) DEFAULT NULL,
  `data_nota_fiscal` varchar(15) DEFAULT NULL,
  `endereco` varchar(100) DEFAULT NULL,
  `bairro` varchar(30) DEFAULT NULL,
  `cep` varchar(8) DEFAULT NULL,
  `cidade` varchar(50) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `matricula` varchar(8) DEFAULT NULL,
  `cartorio` varchar(50) DEFAULT NULL,
  `vl_avaliacao` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r3_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r3_join` (`id_arquivo_gm`,`grupo`,`cota`),
  CONSTRAINT `fk_registro3_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1694932 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro4 definition

CREATE TABLE `registro4` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `tipo_referencia` varchar(21) DEFAULT NULL,
  `nome` varchar(40) DEFAULT NULL,
  `endereço` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `ddd` varchar(3) DEFAULT NULL,
  `fone` varchar(15) DEFAULT NULL,
  `ramal` varchar(4) DEFAULT NULL,
  `observação_1` varchar(255) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_registro4_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_registro4_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=825859 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro5 definition

CREATE TABLE `registro5` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `cpf_avalista` varchar(14) DEFAULT NULL,
  `avalista` varchar(40) DEFAULT NULL,
  `end_aval` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `compl_aval` varchar(10) DEFAULT NULL,
  `cep_aval` varchar(8) DEFAULT NULL,
  `cidade_aval` varchar(30) DEFAULT NULL,
  `estado_aval` varchar(2) DEFAULT NULL,
  `ddd_aval` varchar(3) DEFAULT NULL,
  `telefone_aval` varchar(15) DEFAULT NULL,
  `ddd_celular_aval` varchar(3) DEFAULT NULL,
  `celular_aval` varchar(15) DEFAULT NULL,
  `email_aval` varchar(50) DEFAULT NULL,
  `empresa_aval` varchar(30) DEFAULT NULL,
  `endereco2_aval` varchar(40) DEFAULT NULL,
  `bairro2` varchar(25) DEFAULT NULL,
  `cep2_aval` varchar(8) DEFAULT NULL,
  `cidade2_aval` varchar(30) DEFAULT NULL,
  `estado2_aval` varchar(2) DEFAULT NULL,
  `ddd2_coml_aval` varchar(3) DEFAULT NULL,
  `telefone2_aval` varchar(15) DEFAULT NULL,
  `ramal_coml_aval` varchar(4) DEFAULT NULL,
  `conjuge_avalista` varchar(40) DEFAULT NULL,
  `ddd_coml_conj_aval` varchar(3) DEFAULT NULL,
  `fon_coml_conj_aval` varchar(15) DEFAULT NULL,
  `ramal_coml_conj_aval` varchar(4) DEFAULT NULL,
  `refer_a_aval` varchar(40) DEFAULT NULL,
  `endref_a_aval` varchar(40) DEFAULT NULL,
  `bairr_refe_aval` varchar(25) DEFAULT NULL,
  `ddd_a_ref_aval` varchar(3) DEFAULT NULL,
  `fon_a_aval` varchar(15) DEFAULT NULL,
  `ram_a_aval` varchar(4) DEFAULT NULL,
  `refer_b_aval` varchar(40) DEFAULT NULL,
  `endref_b_aval` varchar(40) DEFAULT NULL,
  `bairrob_refe_aval` varchar(25) DEFAULT NULL,
  `ddd_b_ref_aval` varchar(3) DEFAULT NULL,
  `fon_b_aval` varchar(15) DEFAULT NULL,
  `ram_b_aval` varchar(4) DEFAULT NULL,
  `refer_c_aval` varchar(40) DEFAULT NULL,
  `endref_c_aval` varchar(40) DEFAULT NULL,
  `bairro_c_aval` varchar(25) DEFAULT NULL,
  `ddd_c_ref_aval` varchar(3) DEFAULT NULL,
  `fon_c_aval` varchar(15) DEFAULT NULL,
  `ram_c_aval` varchar(4) DEFAULT NULL,
  `refer_d_aval` varchar(40) DEFAULT NULL,
  `endref_d_aval` varchar(40) DEFAULT NULL,
  `bairro_d_aval` varchar(25) DEFAULT NULL,
  `ddd_d_ref_aval` varchar(3) DEFAULT NULL,
  `fon_d_aval` varchar(15) DEFAULT NULL,
  `ram_d_aval` varchar(4) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r5_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r5_join` (`id_arquivo_gm`,`grupo`,`cota`),
  CONSTRAINT `fk_registro5_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=418402 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro_1 definition

CREATE TABLE `registro_1` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `versao` varchar(2) DEFAULT NULL,
  `cgc_cpf` varchar(14) DEFAULT NULL,
  `nome` varchar(40) DEFAULT NULL,
  `status` varchar(15) DEFAULT NULL,
  `amort` varchar(30) DEFAULT NULL,
  `atras` varchar(30) DEFAULT NULL,
  `mensal` varchar(30) DEFAULT NULL,
  `mensal_c_taxas` varchar(30) DEFAULT NULL,
  `seguro_mensal_c_taxas` varchar(30) DEFAULT NULL,
  `taxa_adm_do_grupo` varchar(30) DEFAULT NULL,
  `fundo_de_reserva_do_grupo` varchar(30) DEFAULT NULL,
  `prazo` varchar(3) DEFAULT NULL,
  `plano_basico` varchar(3) DEFAULT NULL,
  `dt_ult_ass_gr` varchar(15) DEFAULT NULL,
  `cat_c_seg` varchar(11) DEFAULT NULL,
  `valor_do_bem_sem_taxas` varchar(30) DEFAULT NULL,
  `dif_parc_acumulado` varchar(30) DEFAULT NULL,
  `vl_parc` varchar(30) DEFAULT NULL,
  `modelo` varchar(12) DEFAULT NULL,
  `endereco` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `compl` varchar(10) DEFAULT NULL,
  `cep` varchar(8) DEFAULT NULL,
  `cidade` varchar(30) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `ddd_telefone` varchar(3) DEFAULT NULL,
  `telefone` varchar(15) DEFAULT NULL,
  `ddd_celular` varchar(3) DEFAULT NULL,
  `celular` varchar(15) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `empresa` varchar(30) DEFAULT NULL,
  `endereco2` varchar(40) DEFAULT NULL,
  `bairro2` varchar(25) DEFAULT NULL,
  `compl_2` varchar(10) DEFAULT NULL,
  `cep2` varchar(8) DEFAULT NULL,
  `cidade2` varchar(30) DEFAULT NULL,
  `estado2` varchar(2) DEFAULT NULL,
  `ddd2` varchar(3) DEFAULT NULL,
  `telefone2` varchar(15) DEFAULT NULL,
  `ramal_coml_devedor` varchar(4) DEFAULT NULL,
  `conjuge_consorciado` varchar(40) DEFAULT NULL,
  `ddd_coml_conj` varchar(3) DEFAULT NULL,
  `fon_coml_conj` varchar(15) DEFAULT NULL,
  `ramal_coml_conj_devedor` varchar(4) DEFAULT NULL,
  `data_nascimento` varchar(15) DEFAULT NULL,
  `nome_pai` varchar(40) DEFAULT NULL,
  `nome_mae` varchar(40) DEFAULT NULL,
  `profissao` varchar(40) DEFAULT NULL,
  `data_entrega_bem` varchar(15) DEFAULT NULL,
  `data_da_expectativa` varchar(15) DEFAULT NULL,
  `data_adesão` varchar(15) DEFAULT NULL,
  `data_transferencia` varchar(15) DEFAULT NULL,
  `tipo_contemplacao` varchar(1) DEFAULT NULL,
  `data_contemplacao` varchar(15) DEFAULT NULL,
  `percentual_lance` varchar(30) DEFAULT NULL,
  `rev` varchar(6) DEFAULT NULL,
  `nome_rev` varchar(40) DEFAULT NULL,
  `codigo_da_campanha` varchar(6) DEFAULT NULL,
  `numero_do_contrato` varchar(10) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r1_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r1_join` (`id_arquivo_gm`,`grupo`,`cota`),
  KEY `idx_r1_cpf` (`cgc_cpf`),
  KEY `idx_r1_contrato` (`numero_do_contrato`),
  KEY `idx_r1_status` (`status`),
  KEY `idx_r1_adesao` (`data_adesão`),
  KEY `idx_r1_updated` (`updated_at`),
  KEY `idx_r1_encerramento` (`dt_ult_ass_gr`),
  CONSTRAINT `fk_registro_1_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1739812 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro_6 definition

CREATE TABLE `registro_6` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `aviso` varchar(8) DEFAULT NULL,
  `tipomov` varchar(4) DEFAULT NULL,
  `vencimento` varchar(15) DEFAULT NULL,
  `agentecob` varchar(6) DEFAULT NULL,
  `valorpar` varchar(30) DEFAULT NULL,
  `multajur` varchar(30) DEFAULT NULL,
  `valortot` varchar(30) DEFAULT NULL,
  `numeroext` varchar(20) DEFAULT NULL,
  `datenvio` varchar(15) DEFAULT NULL,
  `assembléia` varchar(3) DEFAULT NULL,
  `numero_parcela` varchar(3) DEFAULT NULL,
  `fdo_comum` varchar(30) DEFAULT NULL,
  `tx_adm` varchar(30) DEFAULT NULL,
  `fd_reserva` varchar(30) DEFAULT NULL,
  `seguro` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_registro_6_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_registro_6_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41594101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.telefone definition

CREATE TABLE `telefone` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL COMMENT 'fixo, celular, comercial_devedor, comercial_conjuge, avalista_fixo, avalista_celular, ...',
  `ddd` varchar(5) DEFAULT NULL,
  `numero` varchar(30) NOT NULL,
  `ramal` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cpc` enum('sim','não','amigo','parente') DEFAULT NULL,
  `status` enum('bom','medio','ruim') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_telefone_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_telefone_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_telefone_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2030568 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.trailer definition

CREATE TABLE `trailer` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_reg` varchar(1) DEFAULT NULL,
  `data` varchar(15) DEFAULT NULL,
  `total_reg_1` varchar(30) DEFAULT NULL,
  `qtd_parcelas` varchar(30) DEFAULT NULL,
  `valor_parcelas` varchar(30) DEFAULT NULL,
  `qtd_parcelas_1` varchar(10) DEFAULT NULL,
  `valor_parcelas_1` varchar(30) DEFAULT NULL,
  `numero_do_lote` varchar(8) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_trailer_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_trailer_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1010 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.contrato definition

CREATE TABLE `contrato` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `id_avalista` bigint(20) DEFAULT NULL,
  `numero_contrato` varchar(50) DEFAULT NULL,
  `grupo` varchar(20) DEFAULT NULL,
  `cota` varchar(20) DEFAULT NULL,
  `versao` varchar(10) DEFAULT NULL,
  `status_txt` varchar(50) DEFAULT NULL,
  `valor_credito` decimal(16,2) DEFAULT NULL,
  `prazo_meses` int(11) DEFAULT NULL,
  `data_adesao` date DEFAULT NULL,
  `encerramento_grupo` date DEFAULT NULL,
  `taxa_administracao` decimal(16,4) DEFAULT NULL,
  `fundo_reserva` decimal(16,4) DEFAULT NULL,
  `percentual_lance` decimal(16,4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('aberto','fechado','indenizado') DEFAULT 'aberto',
  `id_empresa` bigint(20) DEFAULT NULL,
  `id_seguradora` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grupo_cota` (`grupo`,`cota`),
  KEY `id_pessoa` (`id_pessoa`),
  KEY `id_avalista` (`id_avalista`),
  KEY `contrato_ibfk_3` (`id_empresa`),
  KEY `contrato_ibfk_4` (`id_seguradora`),
  CONSTRAINT `contrato_ibfk_1` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`),
  CONSTRAINT `contrato_ibfk_2` FOREIGN KEY (`id_avalista`) REFERENCES `pessoa` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contrato_ibfk_3` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contrato_ibfk_4` FOREIGN KEY (`id_seguradora`) REFERENCES `empresa` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1826270 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.funcionario_cobranca definition

CREATE TABLE `funcionario_cobranca` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_funcionario` int(11) NOT NULL,
  `id_contrato` bigint(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `responsavel_primario` bit(1) NOT NULL DEFAULT b'1',
  `relacao_ativa` bit(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `funcionario_cobranca_id_funcionario_IDX` (`id_funcionario`,`id_contrato`) USING BTREE,
  KEY `id_contrato` (`id_contrato`),
  CONSTRAINT `funcionario_cobranca_ibfk_1` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`),
  CONSTRAINT `funcionario_cobranca_ibfk_2` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2720 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.ocorrencia definition

CREATE TABLE `ocorrencia` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `descricao` varchar(255) DEFAULT '',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('aberto','fechado','indenizado','parcela paga','parcela vencida') DEFAULT NULL,
  `data_arquivo` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_contrato` (`id_contrato`),
  KEY `id_arquivo_gm` (`id_arquivo_gm`),
  KEY `fk_ocorrencia_data` (`data_arquivo`),
  CONSTRAINT `fk_ocorrencia_data` FOREIGN KEY (`data_arquivo`) REFERENCES `arquivos_gm` (`data_arquivo`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ocorrencia_ibfk_1` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ocorrencia_ibfk_2` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2407 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.parcela definition

CREATE TABLE `parcela` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `numero_parcela` int(11) DEFAULT NULL,
  `vencimento` date DEFAULT NULL,
  `valor_nominal` decimal(16,2) DEFAULT NULL,
  `valor_total` decimal(16,2) DEFAULT NULL,
  `multa_juros` decimal(16,2) DEFAULT NULL,
  `status` enum('aberto','fechado','indenizado') DEFAULT 'aberto',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contrato_parcela` (`id_contrato`,`numero_parcela`,`vencimento`),
  CONSTRAINT `parcela_ibfk_1` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2564525 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.tramitacao definition

CREATE TABLE `tramitacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `id_contrato` bigint(20) NOT NULL,
  `tipo` enum('ligacao','whatsapp','email') NOT NULL,
  `cpc` enum('sim','nao','parente','amigo','avalista') NOT NULL,
  `data` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `descricao` text DEFAULT NULL,
  `id_funcionario` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tramitacao_pessoa` (`id_pessoa`),
  KEY `idx_tramitacao_contrato` (`id_contrato`),
  KEY `fk_tramitacao_funcionario` (`id_funcionario`),
  CONSTRAINT `fk_tramitacao_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tramitacao_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`),
  CONSTRAINT `fk_tramitacao_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.agenda definition

CREATE TABLE `agenda` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `atividade` varchar(255) NOT NULL,
  `descricao` text DEFAULT NULL,
  `data` timestamp NOT NULL,
  `prioridade` enum('baixa','media','alta') NOT NULL,
  `id_contrato` bigint(20) DEFAULT NULL,
  `id_funcionario` int(11) NOT NULL,
  `status` enum('pendente','concluido') DEFAULT 'pendente',
  PRIMARY KEY (`id`),
  KEY `fk_agenda_contrato` (`id_contrato`),
  KEY `fk_agenda_funcionario` (`id_funcionario`),
  CONSTRAINT `fk_agenda_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_agenda_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.bens definition

CREATE TABLE `bens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) DEFAULT NULL,
  `chassi` varchar(30) DEFAULT NULL,
  `placa` varchar(15) DEFAULT NULL,
  `codigo_renavam` varchar(20) DEFAULT NULL,
  `modelo` varchar(50) DEFAULT NULL,
  `ano_modelo` varchar(15) DEFAULT NULL,
  `cor` varchar(30) DEFAULT NULL,
  `marca` varchar(30) DEFAULT NULL,
  `data_nota_fiscal` date DEFAULT NULL,
  `matricula` varchar(20) DEFAULT NULL,
  `cartorio` varchar(100) DEFAULT NULL,
  `vl_avaliacao` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_bens_contrato` (`id_contrato`),
  CONSTRAINT `fk_bens_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3486 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.cobranca definition

CREATE TABLE `cobranca` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `data_arquivo` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cobranca_id_contrato_IDX` (`id_contrato`,`data_arquivo`) USING BTREE,
  KEY `cobranca_arquivos_gm_fk` (`data_arquivo`),
  CONSTRAINT `cobranca_contrato_fk` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.negativacao definition

CREATE TABLE `negativacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `id_parcela` bigint(20) DEFAULT NULL,
  `dias_atraso` int(11) DEFAULT NULL,
  `data_negativacao` datetime DEFAULT current_timestamp(),
  `status` varchar(32) NOT NULL DEFAULT 'enviado',
  `resposta_api` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_negativacao_contrato` (`id_contrato`),
  KEY `negativacao_parcela_FK` (`id_parcela`),
  KEY `negativacao_id_contrato_IDX` (`id_contrato`,`id_parcela`) USING BTREE,
  CONSTRAINT `fk_negativacao_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `negativacao_parcela_FK` FOREIGN KEY (`id_parcela`) REFERENCES `parcela` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

---

**Cursor**

Comparando `scripts/criar_banco.py` com o DDL que colou para resumir as diferenças.



Comparando o [`scripts/criar_banco.py`](c:\Users\flavi\OneDrive\Desktop\JB\GM\Prototipo-SAJ\scripts\criar_banco.py) (constante `RAW_SQL`) com o DDL que colou do MySQL, as diferenças relevantes são estas:

## O que é igual (ou quase)

- Tabelas centrais (`arquivos_gm`, `funcionario` sem `foto`, `grupo`, `pessoa`, `header`, `registro_1` … `registro_6`, `trailer`, `parcela`, etc.) seguem a **mesma ideia** de colunas e muitos índices coincidem (ex.: `registro2` tem os mesmos índices extra no script e no seu dump).
- `RAW_SQL` **não declara** `ENGINE`, `CHARSET` nem `COLLATE`; o servidor usa os **predefinidos**. No dump aparecem `utf8mb4` e collations como `utf8mb4_uca1400_ai_ci` ou `utf8mb4_unicode_ci` — isso é **ambiente / versão do MySQL**, não diferença de colunas no script.

## Diferenças de schema importantes

### 1. `funcionario`

- **No seu banco:** coluna **`foto` `mediumblob` NULL**.
- **Em `criar_banco.py`:** essa coluna **não existe** (foi acrescentada depois na base real).

### 2. `contrato` (`id_empresa` / `id_seguradora`)

- **No seu banco:** `id_empresa` e `id_seguradora` são **`DEFAULT NULL`**, FKs com **`ON DELETE SET NULL`**.
- **No script:** os dois campos são **`NOT NULL`** e as FKs **não** têm `ON DELETE SET NULL` (comportamento de apagar/restringir diferente).

### 3. `funcionario_cobranca`

- **No seu banco:** **`UNIQUE (id_funcionario, id_contrato)`**, colunas **`responsavel_primario`** e **`relacao_ativa`** (`bit(1)` com default).
- **No script:** só índices simples em `id_funcionario` e `id_contrato`, **sem** essa UNIQUE nem as duas colunas `bit`.

### 4. `ocorrencia.status` (enum)

- **No seu banco:** 5 valores (`… 'parcela vencida'`).
- **No script:** inclui ainda **`'ativo'`** como sexto valor do enum.

### 5. `negativacao`

- **No seu banco:** `id_parcela` **pode ser NULL**; **não** há coluna `numero_parcela`; índices como `negativacao_id_contrato_IDX` / `negativacao_parcela_FK`.
- **No script:** `id_parcela` **NOT NULL**; existe **`numero_parcela`**; **`UNIQUE (id_parcela)`** e FK em `parcela` com **`ON DELETE CASCADE`**.

### 6. Nomes de índices / `AUTO_INCREMENT`

- Os **números de `AUTO_INCREMENT`** e alguns **nomes de índice** no dump são só estado do servidor; não alteram a lógica da app por si só.

---

**Resumo:** o `criar_banco.py` é um **script inicial** que já ficou **atrás** do que foi evoluindo na base real (`foto`, `funcionario_cobranca`, `contrato` nullable, `ocorrencia` enum, `negativacao`). Para bases novas ficarem iguais à sua, o ideal é **atualizar o `RAW_SQL`** (ou passar a usar migrações / `ALTER` versionados) em linha com o dump oficial.

---

**User**

no meu banco, altere as tabelas:
- contrato: colunas id_empresa e id_seguradora colocar para ser not null
- negativacao: coluna id_parcela colocar para ser not null

---

**Cursor**

Criando um script SQL de migração: antes de aplicar `NOT NULL` é preciso eliminar ou corrigir linhas com `NULL` — incluímos passos seguros e comentários.



Foi criado o ficheiro [`scripts/migracao_not_null_contrato_negativacao.sql`](c:\Users\flavi\OneDrive\Desktop\JB\GM\Prototipo-SAJ\scripts\migracao_not_null_contrato_negativacao.sql) para aplicar na sua base.

### O que faz

1. **`contrato`**  
   - Mostra quantos contratos têm `id_empresa` ou `id_seguradora` a `NULL`.  
   - Preenche esses `NULL` com o **menor `id` da tabela `empresa`** (os dois campos usam a mesma origem; ajuste se quiser outra regra).  
   - Depois executa `ALTER TABLE ... MODIFY ... NOT NULL` nas duas colunas.

2. **`negativacao`**  
   - Conta linhas com `id_parcela` `NULL`.  
   - **`DELETE FROM negativacao WHERE id_parcela IS NULL`** (obrigatório para o `ALTER` passar se existirem `NULL`; não há como inventar `id_parcela` válido).  
   - Depois `ALTER TABLE ... MODIFY id_parcela ... NOT NULL`.

### Como executar

No MySQL/MariaDB (linha de comando ou cliente gráfico), por exemplo:

```bash
mysql -u root -p consorcio_gm < scripts/migracao_not_null_contrato_negativacao.sql
```

Ou abra o `.sql` no cliente e execute por blocos.

### Atenções

- Se **não houver linhas em `empresa`**, os `UPDATE` do `contrato` não resolvem os `NULL`.  
- O **`DELETE`** em `negativacao` apaga só registos sem parcela; se precisar deles, corrija `id_parcela` à mão e só no fim aplique o `ALTER`.

O [`scripts/criar_banco.py`](c:\Users\flavi\OneDrive\Desktop\JB\GM\Prototipo-SAJ\scripts\criar_banco.py) já define `contrato.id_empresa` / `id_seguradora` como **NOT NULL** e `negativacao.id_parcela` como **NOT NULL**; não foi preciso alterar o script para novas instalações.

---

**User**

na tabela de ocorrencia ele esta registrando na coluna de descricao "contrato novo" e o status "aberto" que, esta correto
mas na tabela de ocorrencia ele esta registrando na coluna de descricao "Parcela (antes negativada) paga: contrato ativo; outra parcela podera ser negativada se elegivel." e o status "ativo" que, esta errado, deveria ser "aberto". delete o status "ativo" na tabela contrato no script @scripts/criar_banco.py e corrija o tracker @scripts/tracker_gm_range_date_contratos.py  para não aparecer o erro

---

**Cursor**

Removendo `'ativo'` do enum em `criar_banco.py` e ajustando o tracker para gravar `aberto` e eliminar a lógica que adicionava `'ativo'` ao enum.



Alterações feitas:

### [`scripts/criar_banco.py`](scripts/criar_banco.py)
- No `CREATE TABLE ocorrencia`, o `status` deixou de incluir **`'ativo'`**. O enum ficou só:  
  `'aberto','fechado','indenizado','parcela paga','parcela vencida'`.

### [`scripts/tracker_gm_range_date_contratos.py`](scripts/tracker_gm_range_date_contratos.py)
- Removidos **`OCORRENCIA_ATIVO`**, o uso em **`OCORRENCIA_STATUS`** e toda a função **`_ensure_ocorrencia_enum_ativo`** (que fazia `ALTER TABLE` para acrescentar `'ativo'` ao enum).
- Em **`_liberar_negativacao_parcela_paga`**, a ocorrência após apagar a negativação passa a ser gravada com **`OCORRENCIA_ABERTO`** (`"aberto"`), mantendo a mesma **descrição** em texto.
- Docstring atualizada para falar em status *aberto* em vez de *ativo*.

Assim o fluxo “parcela antes negativada paga” fica alinhado ao caso “contrato novo”: **`status = 'aberto'`**.

**Bases já criadas:** se o MySQL ainda tiver `'ativo'` no enum, é preciso migrar à mão, por exemplo:

```sql
UPDATE ocorrencia SET status = 'aberto' WHERE status = 'ativo';
ALTER TABLE ocorrencia MODIFY COLUMN status ENUM(
  'aberto','fechado','indenizado','parcela paga','parcela vencida'
) NULL DEFAULT NULL;
```

(Execute só depois de confirmar que não há mais linhas com `status = 'ativo'`.)

---

**User**

no script @scripts/criar_banco.py , substitua a query por esta (nao esqueca de removar os comentarios e tudo o que aparece depois do ultimo ')' do comando create table):
-- consorcio_gm.arquivos_gm definition

CREATE TABLE `arquivos_gm` (
  `id_arquivo_gm` int(11) NOT NULL AUTO_INCREMENT,
  `data_arquivo` date DEFAULT NULL,
  `conteudo` longtext DEFAULT NULL,
  `data_processamento` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_arquivo_gm`),
  UNIQUE KEY `arquivos_gm_data_arquivo_IDX` (`data_arquivo`) USING BTREE,
  KEY `idx_dt_arq` (`data_arquivo`)
) ENGINE=InnoDB AUTO_INCREMENT=875 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.funcionario definition

CREATE TABLE `funcionario` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `data_nascimento` date DEFAULT NULL,
  `cpf_cnpj` varchar(20) NOT NULL,
  `ativo` bit(1) NOT NULL DEFAULT b'1',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `login` varchar(50) DEFAULT NULL,
  `senha` varchar(50) DEFAULT NULL,
  `acesso_externo` bit(1) DEFAULT b'0',
  `email` varchar(255) DEFAULT NULL,
  `ddd` varchar(5) DEFAULT NULL,
  `numero` varchar(30) DEFAULT NULL,
  `logradouro` varchar(255) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cep` varchar(10) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `departamento` varchar(25) DEFAULT NULL,
  `nivel_acesso` varchar(20) DEFAULT NULL,
  `sexo` varchar(1) DEFAULT NULL,
  `matricula` varchar(25) DEFAULT NULL,
  `foto` mediumblob DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf_cnpj` (`cpf_cnpj`),
  UNIQUE KEY `funcionario_login_IDX` (`login`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.grupo definition

CREATE TABLE `grupo` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nome` varchar(255) NOT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.pessoa definition

CREATE TABLE `pessoa` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `cpf_cnpj` varchar(20) DEFAULT NULL,
  `nome_completo` varchar(255) DEFAULT NULL,
  `data_nascimento` date DEFAULT NULL,
  `profissao` varchar(100) DEFAULT NULL,
  `conjuge_nome` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `cpf_cnpj` (`cpf_cnpj`)
) ENGINE=InnoDB AUTO_INCREMENT=2378631 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.email definition

CREATE TABLE `email` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL DEFAULT 'principal',
  `email` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_email_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_email_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=615518 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.empresa definition

CREATE TABLE `empresa` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `apelido` varchar(15) NOT NULL,
  `ativo` bit(1) DEFAULT NULL,
  `bradesco` bit(1) DEFAULT NULL,
  `id_pessoa` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_pessoa` (`id_pessoa`),
  CONSTRAINT `empresa_ibfk_1` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.endereco definition

CREATE TABLE `endereco` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL COMMENT 'principal, secundario, avalista_principal, ...',
  `logradouro` varchar(255) DEFAULT NULL,
  `bairro` varchar(100) DEFAULT NULL,
  `complemento` varchar(100) DEFAULT NULL,
  `cep` varchar(10) DEFAULT NULL,
  `cidade` varchar(100) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_endereco_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_endereco_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_endereco_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=580148 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.funcionario_grupo definition

CREATE TABLE `funcionario_grupo` (
  `id_funcionario` int(11) NOT NULL,
  `id_grupo` bigint(20) NOT NULL,
  PRIMARY KEY (`id_funcionario`,`id_grupo`),
  KEY `fk_grupo` (`id_grupo`),
  CONSTRAINT `fk_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_grupo` FOREIGN KEY (`id_grupo`) REFERENCES `grupo` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.header definition

CREATE TABLE `header` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_reg` varchar(1) DEFAULT NULL,
  `cnpj` varchar(14) DEFAULT NULL,
  `empresa` varchar(50) DEFAULT NULL,
  `data` varchar(15) DEFAULT NULL,
  `numero_do_lote` varchar(6) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_header_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_header_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1020 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.mensagem definition

CREATE TABLE `mensagem` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_remetente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `assunto` text NOT NULL,
  `descricao` text DEFAULT NULL,
  `data_envio` datetime NOT NULL DEFAULT current_timestamp(),
  `id_resposta` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_remetente` (`id_remetente`),
  KEY `id_destinatario` (`id_destinatario`),
  KEY `id_resposta` (`id_resposta`),
  CONSTRAINT `mensagem_ibfk_1` FOREIGN KEY (`id_remetente`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mensagem_ibfk_2` FOREIGN KEY (`id_destinatario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mensagem_ibfk_3` FOREIGN KEY (`id_resposta`) REFERENCES `mensagem` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro2 definition

CREATE TABLE `registro2` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `aviso` varchar(8) DEFAULT NULL,
  `tipomov` varchar(4) DEFAULT NULL,
  `vencimento` varchar(15) DEFAULT NULL,
  `agentecob` varchar(6) DEFAULT NULL,
  `valorpar` varchar(30) DEFAULT NULL,
  `multajur` varchar(30) DEFAULT NULL,
  `valortot` varchar(30) DEFAULT NULL,
  `numeroext` varchar(20) DEFAULT NULL,
  `datenvio` varchar(15) DEFAULT NULL,
  `assembléia` varchar(3) DEFAULT NULL,
  `numero_parcela` varchar(3) DEFAULT NULL,
  `fdo_comum` varchar(30) DEFAULT NULL,
  `tx_adm` varchar(30) DEFAULT NULL,
  `fd_reserva` varchar(30) DEFAULT NULL,
  `seguro` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r2_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r2_parcela` (`numero_parcela`),
  KEY `idx_r2_vencimento` (`vencimento`),
  KEY `idx_r2_join` (`id_arquivo_gm`,`grupo`,`cota`),
  KEY `idx_r2_num_venc` (`numero_parcela`,`vencimento`),
  KEY `idx_r2_parcela_single` (`numero_parcela`),
  KEY `idx_r2_vencimento_single` (`vencimento`),
  KEY `idx_r2_valor` (`valortot`),
  KEY `idx_r2_juros` (`multajur`),
  CONSTRAINT `fk_registro2_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2433933 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro3 definition

CREATE TABLE `registro3` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `chassi` varchar(21) DEFAULT NULL,
  `placa` varchar(10) DEFAULT NULL,
  `codigo_renavam` varchar(13) DEFAULT NULL,
  `modelo` varchar(15) DEFAULT NULL,
  `ano_modelo` varchar(9) DEFAULT NULL,
  `cor` varchar(16) DEFAULT NULL,
  `marca` varchar(20) DEFAULT NULL,
  `data_nota_fiscal` varchar(15) DEFAULT NULL,
  `endereco` varchar(100) DEFAULT NULL,
  `bairro` varchar(30) DEFAULT NULL,
  `cep` varchar(8) DEFAULT NULL,
  `cidade` varchar(50) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `matricula` varchar(8) DEFAULT NULL,
  `cartorio` varchar(50) DEFAULT NULL,
  `vl_avaliacao` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r3_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r3_join` (`id_arquivo_gm`,`grupo`,`cota`),
  CONSTRAINT `fk_registro3_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1694932 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro4 definition

CREATE TABLE `registro4` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `tipo_referencia` varchar(21) DEFAULT NULL,
  `nome` varchar(40) DEFAULT NULL,
  `endereço` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `ddd` varchar(3) DEFAULT NULL,
  `fone` varchar(15) DEFAULT NULL,
  `ramal` varchar(4) DEFAULT NULL,
  `observação_1` varchar(255) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_registro4_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_registro4_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=825859 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro5 definition

CREATE TABLE `registro5` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `cpf_avalista` varchar(14) DEFAULT NULL,
  `avalista` varchar(40) DEFAULT NULL,
  `end_aval` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `compl_aval` varchar(10) DEFAULT NULL,
  `cep_aval` varchar(8) DEFAULT NULL,
  `cidade_aval` varchar(30) DEFAULT NULL,
  `estado_aval` varchar(2) DEFAULT NULL,
  `ddd_aval` varchar(3) DEFAULT NULL,
  `telefone_aval` varchar(15) DEFAULT NULL,
  `ddd_celular_aval` varchar(3) DEFAULT NULL,
  `celular_aval` varchar(15) DEFAULT NULL,
  `email_aval` varchar(50) DEFAULT NULL,
  `empresa_aval` varchar(30) DEFAULT NULL,
  `endereco2_aval` varchar(40) DEFAULT NULL,
  `bairro2` varchar(25) DEFAULT NULL,
  `cep2_aval` varchar(8) DEFAULT NULL,
  `cidade2_aval` varchar(30) DEFAULT NULL,
  `estado2_aval` varchar(2) DEFAULT NULL,
  `ddd2_coml_aval` varchar(3) DEFAULT NULL,
  `telefone2_aval` varchar(15) DEFAULT NULL,
  `ramal_coml_aval` varchar(4) DEFAULT NULL,
  `conjuge_avalista` varchar(40) DEFAULT NULL,
  `ddd_coml_conj_aval` varchar(3) DEFAULT NULL,
  `fon_coml_conj_aval` varchar(15) DEFAULT NULL,
  `ramal_coml_conj_aval` varchar(4) DEFAULT NULL,
  `refer_a_aval` varchar(40) DEFAULT NULL,
  `endref_a_aval` varchar(40) DEFAULT NULL,
  `bairr_refe_aval` varchar(25) DEFAULT NULL,
  `ddd_a_ref_aval` varchar(3) DEFAULT NULL,
  `fon_a_aval` varchar(15) DEFAULT NULL,
  `ram_a_aval` varchar(4) DEFAULT NULL,
  `refer_b_aval` varchar(40) DEFAULT NULL,
  `endref_b_aval` varchar(40) DEFAULT NULL,
  `bairrob_refe_aval` varchar(25) DEFAULT NULL,
  `ddd_b_ref_aval` varchar(3) DEFAULT NULL,
  `fon_b_aval` varchar(15) DEFAULT NULL,
  `ram_b_aval` varchar(4) DEFAULT NULL,
  `refer_c_aval` varchar(40) DEFAULT NULL,
  `endref_c_aval` varchar(40) DEFAULT NULL,
  `bairro_c_aval` varchar(25) DEFAULT NULL,
  `ddd_c_ref_aval` varchar(3) DEFAULT NULL,
  `fon_c_aval` varchar(15) DEFAULT NULL,
  `ram_c_aval` varchar(4) DEFAULT NULL,
  `refer_d_aval` varchar(40) DEFAULT NULL,
  `endref_d_aval` varchar(40) DEFAULT NULL,
  `bairro_d_aval` varchar(25) DEFAULT NULL,
  `ddd_d_ref_aval` varchar(3) DEFAULT NULL,
  `fon_d_aval` varchar(15) DEFAULT NULL,
  `ram_d_aval` varchar(4) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r5_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r5_join` (`id_arquivo_gm`,`grupo`,`cota`),
  CONSTRAINT `fk_registro5_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=418402 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro_1 definition

CREATE TABLE `registro_1` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `versao` varchar(2) DEFAULT NULL,
  `cgc_cpf` varchar(14) DEFAULT NULL,
  `nome` varchar(40) DEFAULT NULL,
  `status` varchar(15) DEFAULT NULL,
  `amort` varchar(30) DEFAULT NULL,
  `atras` varchar(30) DEFAULT NULL,
  `mensal` varchar(30) DEFAULT NULL,
  `mensal_c_taxas` varchar(30) DEFAULT NULL,
  `seguro_mensal_c_taxas` varchar(30) DEFAULT NULL,
  `taxa_adm_do_grupo` varchar(30) DEFAULT NULL,
  `fundo_de_reserva_do_grupo` varchar(30) DEFAULT NULL,
  `prazo` varchar(3) DEFAULT NULL,
  `plano_basico` varchar(3) DEFAULT NULL,
  `dt_ult_ass_gr` varchar(15) DEFAULT NULL,
  `cat_c_seg` varchar(11) DEFAULT NULL,
  `valor_do_bem_sem_taxas` varchar(30) DEFAULT NULL,
  `dif_parc_acumulado` varchar(30) DEFAULT NULL,
  `vl_parc` varchar(30) DEFAULT NULL,
  `modelo` varchar(12) DEFAULT NULL,
  `endereco` varchar(40) DEFAULT NULL,
  `bairro` varchar(25) DEFAULT NULL,
  `compl` varchar(10) DEFAULT NULL,
  `cep` varchar(8) DEFAULT NULL,
  `cidade` varchar(30) DEFAULT NULL,
  `estado` varchar(2) DEFAULT NULL,
  `ddd_telefone` varchar(3) DEFAULT NULL,
  `telefone` varchar(15) DEFAULT NULL,
  `ddd_celular` varchar(3) DEFAULT NULL,
  `celular` varchar(15) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `empresa` varchar(30) DEFAULT NULL,
  `endereco2` varchar(40) DEFAULT NULL,
  `bairro2` varchar(25) DEFAULT NULL,
  `compl_2` varchar(10) DEFAULT NULL,
  `cep2` varchar(8) DEFAULT NULL,
  `cidade2` varchar(30) DEFAULT NULL,
  `estado2` varchar(2) DEFAULT NULL,
  `ddd2` varchar(3) DEFAULT NULL,
  `telefone2` varchar(15) DEFAULT NULL,
  `ramal_coml_devedor` varchar(4) DEFAULT NULL,
  `conjuge_consorciado` varchar(40) DEFAULT NULL,
  `ddd_coml_conj` varchar(3) DEFAULT NULL,
  `fon_coml_conj` varchar(15) DEFAULT NULL,
  `ramal_coml_conj_devedor` varchar(4) DEFAULT NULL,
  `data_nascimento` varchar(15) DEFAULT NULL,
  `nome_pai` varchar(40) DEFAULT NULL,
  `nome_mae` varchar(40) DEFAULT NULL,
  `profissao` varchar(40) DEFAULT NULL,
  `data_entrega_bem` varchar(15) DEFAULT NULL,
  `data_da_expectativa` varchar(15) DEFAULT NULL,
  `data_adesão` varchar(15) DEFAULT NULL,
  `data_transferencia` varchar(15) DEFAULT NULL,
  `tipo_contemplacao` varchar(1) DEFAULT NULL,
  `data_contemplacao` varchar(15) DEFAULT NULL,
  `percentual_lance` varchar(30) DEFAULT NULL,
  `rev` varchar(6) DEFAULT NULL,
  `nome_rev` varchar(40) DEFAULT NULL,
  `codigo_da_campanha` varchar(6) DEFAULT NULL,
  `numero_do_contrato` varchar(10) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `idx_r1_grupo_cota` (`grupo`,`cota`),
  KEY `idx_r1_join` (`id_arquivo_gm`,`grupo`,`cota`),
  KEY `idx_r1_cpf` (`cgc_cpf`),
  KEY `idx_r1_contrato` (`numero_do_contrato`),
  KEY `idx_r1_status` (`status`),
  KEY `idx_r1_adesao` (`data_adesão`),
  KEY `idx_r1_updated` (`updated_at`),
  KEY `idx_r1_encerramento` (`dt_ult_ass_gr`),
  CONSTRAINT `fk_registro_1_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1739812 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.registro_6 definition

CREATE TABLE `registro_6` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` varchar(1) DEFAULT NULL,
  `grupo` varchar(6) DEFAULT NULL,
  `cota` varchar(4) DEFAULT NULL,
  `sequencia` varchar(2) DEFAULT NULL,
  `aviso` varchar(8) DEFAULT NULL,
  `tipomov` varchar(4) DEFAULT NULL,
  `vencimento` varchar(15) DEFAULT NULL,
  `agentecob` varchar(6) DEFAULT NULL,
  `valorpar` varchar(30) DEFAULT NULL,
  `multajur` varchar(30) DEFAULT NULL,
  `valortot` varchar(30) DEFAULT NULL,
  `numeroext` varchar(20) DEFAULT NULL,
  `datenvio` varchar(15) DEFAULT NULL,
  `assembléia` varchar(3) DEFAULT NULL,
  `numero_parcela` varchar(3) DEFAULT NULL,
  `fdo_comum` varchar(30) DEFAULT NULL,
  `tx_adm` varchar(30) DEFAULT NULL,
  `fd_reserva` varchar(30) DEFAULT NULL,
  `seguro` varchar(30) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_registro_6_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_registro_6_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41594101 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.telefone definition

CREATE TABLE `telefone` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `tipo` varchar(40) NOT NULL COMMENT 'fixo, celular, comercial_devedor, comercial_conjuge, avalista_fixo, avalista_celular, ...',
  `ddd` varchar(5) DEFAULT NULL,
  `numero` varchar(30) NOT NULL,
  `ramal` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `cpc` enum('sim','não','amigo','parente') DEFAULT NULL,
  `status` enum('bom','medio','ruim') DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_telefone_pessoa_tipo` (`id_pessoa`,`tipo`),
  KEY `idx_telefone_pessoa` (`id_pessoa`),
  CONSTRAINT `fk_telefone_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2335644 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.trailer definition

CREATE TABLE `trailer` (
  `id_registro` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_reg` varchar(1) DEFAULT NULL,
  `data` varchar(15) DEFAULT NULL,
  `total_reg_1` varchar(30) DEFAULT NULL,
  `qtd_parcelas` varchar(30) DEFAULT NULL,
  `valor_parcelas` varchar(30) DEFAULT NULL,
  `qtd_parcelas_1` varchar(10) DEFAULT NULL,
  `valor_parcelas_1` varchar(30) DEFAULT NULL,
  `numero_do_lote` varchar(8) DEFAULT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id_registro`),
  KEY `fk_trailer_arquivos` (`id_arquivo_gm`),
  CONSTRAINT `fk_trailer_arquivos` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1010 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.contrato definition

CREATE TABLE `contrato` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `id_avalista` bigint(20) DEFAULT NULL,
  `numero_contrato` varchar(50) DEFAULT NULL,
  `grupo` varchar(20) DEFAULT NULL,
  `cota` varchar(20) DEFAULT NULL,
  `versao` varchar(10) DEFAULT NULL,
  `status_txt` varchar(50) DEFAULT NULL,
  `valor_credito` decimal(16,2) DEFAULT NULL,
  `prazo_meses` int(11) DEFAULT NULL,
  `data_adesao` date DEFAULT NULL,
  `encerramento_grupo` date DEFAULT NULL,
  `taxa_administracao` decimal(16,4) DEFAULT NULL,
  `fundo_reserva` decimal(16,4) DEFAULT NULL,
  `percentual_lance` decimal(16,4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('aberto','fechado','indenizado') DEFAULT 'aberto',
  `id_empresa` bigint(20) DEFAULT NULL,
  `id_seguradora` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_grupo_cota` (`grupo`,`cota`),
  KEY `id_pessoa` (`id_pessoa`),
  KEY `id_avalista` (`id_avalista`),
  KEY `contrato_ibfk_3` (`id_empresa`),
  KEY `contrato_ibfk_4` (`id_seguradora`),
  CONSTRAINT `contrato_ibfk_1` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`),
  CONSTRAINT `contrato_ibfk_2` FOREIGN KEY (`id_avalista`) REFERENCES `pessoa` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contrato_ibfk_3` FOREIGN KEY (`id_empresa`) REFERENCES `empresa` (`id`) ON DELETE SET NULL,
  CONSTRAINT `contrato_ibfk_4` FOREIGN KEY (`id_seguradora`) REFERENCES `empresa` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=1890605 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.funcionario_cobranca definition

CREATE TABLE `funcionario_cobranca` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_funcionario` int(11) NOT NULL,
  `id_contrato` bigint(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `responsavel_primario` bit(1) NOT NULL DEFAULT b'1',
  `relacao_ativa` bit(1) NOT NULL DEFAULT b'1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `funcionario_cobranca_id_funcionario_IDX` (`id_funcionario`,`id_contrato`) USING BTREE,
  KEY `id_contrato` (`id_contrato`),
  CONSTRAINT `funcionario_cobranca_ibfk_1` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`),
  CONSTRAINT `funcionario_cobranca_ibfk_2` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3040 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.ocorrencia definition

CREATE TABLE `ocorrencia` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `id_arquivo_gm` int(11) DEFAULT NULL,
  `descricao` varchar(255) DEFAULT '',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('aberto','fechado','indenizado','parcela paga','parcela vencida') DEFAULT NULL,
  `data_arquivo` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_contrato` (`id_contrato`),
  KEY `id_arquivo_gm` (`id_arquivo_gm`),
  KEY `fk_ocorrencia_data` (`data_arquivo`),
  CONSTRAINT `fk_ocorrencia_data` FOREIGN KEY (`data_arquivo`) REFERENCES `arquivos_gm` (`data_arquivo`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ocorrencia_ibfk_1` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ocorrencia_ibfk_2` FOREIGN KEY (`id_arquivo_gm`) REFERENCES `arquivos_gm` (`id_arquivo_gm`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4597 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.parcela definition

CREATE TABLE `parcela` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `numero_parcela` int(11) DEFAULT NULL,
  `vencimento` date DEFAULT NULL,
  `valor_nominal` decimal(16,2) DEFAULT NULL,
  `valor_total` decimal(16,2) DEFAULT NULL,
  `multa_juros` decimal(16,2) DEFAULT NULL,
  `status` enum('aberto','fechado','indenizado') DEFAULT 'aberto',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contrato_parcela` (`id_contrato`,`numero_parcela`,`vencimento`),
  CONSTRAINT `parcela_ibfk_1` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2657259 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.protocolo definition

CREATE TABLE `protocolo` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_remetente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `data_envio` date DEFAULT curdate(),
  `data_resposta` date DEFAULT NULL,
  `aceito` bit(1) DEFAULT NULL,
  `titulo` varchar(50) NOT NULL,
  `descricao` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  `id_contrato` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_remetente` (`id_remetente`),
  KEY `id_destinatario` (`id_destinatario`),
  KEY `protocolo_contrato_fk` (`id_contrato`),
  CONSTRAINT `protocolo_contrato_fk` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `protocolo_ibfk_1` FOREIGN KEY (`id_remetente`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `protocolo_ibfk_2` FOREIGN KEY (`id_destinatario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.solicitacao definition

CREATE TABLE `solicitacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_remetente` int(11) NOT NULL,
  `id_destinatario` int(11) NOT NULL,
  `data_aguardar` date NOT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  `resposta_solicitacao` bigint(20) DEFAULT NULL,
  `data_envio` datetime NOT NULL DEFAULT current_timestamp(),
  `id_contrato` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `id_remetente` (`id_remetente`),
  KEY `id_destinatario` (`id_destinatario`),
  KEY `resposta_solicitacao` (`resposta_solicitacao`),
  KEY `solicitacao_contrato_fk` (`id_contrato`),
  CONSTRAINT `solicitacao_contrato_fk` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitacao_ibfk_1` FOREIGN KEY (`id_remetente`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitacao_ibfk_2` FOREIGN KEY (`id_destinatario`) REFERENCES `funcionario` (`id`) ON DELETE CASCADE,
  CONSTRAINT `solicitacao_ibfk_3` FOREIGN KEY (`resposta_solicitacao`) REFERENCES `solicitacao` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.tramitacao definition

CREATE TABLE `tramitacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_pessoa` bigint(20) NOT NULL,
  `id_contrato` bigint(20) NOT NULL,
  `forma` enum('ligacao','whatsapp','email') NOT NULL,
  `cpc` enum('sim','nao','parente','amigo','avalista') NOT NULL,
  `data` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `descricao` text DEFAULT NULL,
  `id_funcionario` int(11) NOT NULL,
  `tipo` enum('ativo','passivo') NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tramitacao_pessoa` (`id_pessoa`),
  KEY `idx_tramitacao_contrato` (`id_contrato`),
  KEY `fk_tramitacao_funcionario` (`id_funcionario`),
  CONSTRAINT `fk_tramitacao_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tramitacao_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`),
  CONSTRAINT `fk_tramitacao_pessoa` FOREIGN KEY (`id_pessoa`) REFERENCES `pessoa` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.agenda definition

CREATE TABLE `agenda` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `atividade` varchar(255) NOT NULL,
  `descricao` text DEFAULT NULL,
  `data` timestamp NOT NULL,
  `prioridade` enum('baixa','media','alta') NOT NULL,
  `id_contrato` bigint(20) DEFAULT NULL,
  `id_funcionario` int(11) NOT NULL,
  `status` enum('pendente','concluido') DEFAULT 'pendente',
  PRIMARY KEY (`id`),
  KEY `fk_agenda_contrato` (`id_contrato`),
  KEY `fk_agenda_funcionario` (`id_funcionario`),
  CONSTRAINT `fk_agenda_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_agenda_funcionario` FOREIGN KEY (`id_funcionario`) REFERENCES `funcionario` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- consorcio_gm.bens definition

CREATE TABLE `bens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) DEFAULT NULL,
  `chassi` varchar(30) DEFAULT NULL,
  `placa` varchar(15) DEFAULT NULL,
  `codigo_renavam` varchar(20) DEFAULT NULL,
  `modelo` varchar(50) DEFAULT NULL,
  `ano_modelo` varchar(15) DEFAULT NULL,
  `cor` varchar(30) DEFAULT NULL,
  `marca` varchar(30) DEFAULT NULL,
  `data_nota_fiscal` date DEFAULT NULL,
  `matricula` varchar(20) DEFAULT NULL,
  `cartorio` varchar(100) DEFAULT NULL,
  `vl_avaliacao` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_bens_contrato` (`id_contrato`),
  CONSTRAINT `fk_bens_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3721 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.cobranca definition

CREATE TABLE `cobranca` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `data_arquivo` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cobranca_id_contrato_IDX` (`id_contrato`,`data_arquivo`) USING BTREE,
  KEY `cobranca_arquivos_gm_fk` (`data_arquivo`),
  CONSTRAINT `cobranca_contrato_fk` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=98341 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


-- consorcio_gm.negativacao definition

CREATE TABLE `negativacao` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `id_contrato` bigint(20) NOT NULL,
  `id_parcela` bigint(20) NOT NULL,
  `dias_atraso` int(11) DEFAULT NULL,
  `data_negativacao` datetime DEFAULT current_timestamp(),
  `status` varchar(32) NOT NULL DEFAULT 'enviado',
  `resposta_api` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `numero_parcela` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_negativacao_contrato` (`id_contrato`),
  KEY `negativacao_parcela_FK` (`id_parcela`),
  KEY `negativacao_id_contrato_IDX` (`id_contrato`,`id_parcela`) USING BTREE,
  CONSTRAINT `fk_negativacao_contrato` FOREIGN KEY (`id_contrato`) REFERENCES `contrato` (`id`) ON DELETE CASCADE,
  CONSTRAINT `negativacao_parcela_FK` FOREIGN KEY (`id_parcela`) REFERENCES `parcela` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32743 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

---

**Cursor**

Substituindo `RAW_SQL` em `criar_banco.py` pelas definições fornecidas: `CREATE TABLE IF NOT EXISTS`, removendo comentários e sufixos `ENGINE=...` após o `)` de cada tabela. Verificando a estrutura do ficheiro e a ordem das tabelas para respeitar as FKs.



Substituindo `RAW_SQL` pelo DDL fornecido (com `CREATE TABLE IF NOT EXISTS`, sem comentários `--` e sem sufixos `ENGINE=...`), mantendo a tabela `aviso` usada pela API. Ajustando `app.py` para mapear `forma` ↔ `tipo` na API e compatibilizar inserções em `tramitacao`.



Escrevendo `scripts/criar_banco.py` completo: cabeçalho, `RAW_SQL` alinhado ao DDL do usuário (sem comentários `--`, sem `ENGINE...`, com `IF NOT EXISTS`, `aviso` no final) e funções inalteradas.



Gerando o arquivo com um script Python curto no repositório para evitar erros de digitação no DDL longo.



Criando `scripts/criar_banco_ddl.sql` com o DDL limpo e um script que monta `criar_banco.py`.



Escrevendo `criar_banco_ddl.sql` e o script `assemble_criar_banco.py` que reconstrói `criar_banco.py`.



---

**User**

na pagina @templates/performance.html o usuario seleciona o mes e ano da safra e os dados aparecem a partir do que foi obtido.

o que é safra? safra é quando um contrato novo/voltou fica em cobranca naquele mes e ano com somente uma parcela vencida. no contrato, considerar somente a parcela que fez essa entrada e seu valor. um contrato performado é quando a parcela que deu a entrada foi paga, ou seja, ignorar as outras parcelas e seus valores. para isso, fazer uso da tabela ocorrencia para obter o mes e ano a partir da coluna data_arquivo. pegar as ocorrencias com status 'aberto' e a parcela que deu essa entrada. caso haja mais de uma parcela, pegar somente aquela com o vencimento mais antigo.

---

**Cursor**

Analisando a página de performance e como os dados são carregados hoje para elaborar um plano alinhado à definição de safra.



Confirmando: no tracker, `status='aberto'` corresponde a "contrato novo" / "contrato voltou"; "parcela X vencida" usa `status='parcela vencida'`. Incluiremos isso no plano.



Elaborando o plano: a implementação atual difere da definição de safra; `ocorrencia` não tem `id_parcela`, mas a descrição padronizada permite inferir o número da parcela.



---

**User**

Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.

To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

---

**Cursor**

Implementando o plano: marcando o primeiro todo e analisando o código atual de performance e exportação.



Implementando a query da safra e, em seguida, alinhando KPIs, doughnut e exportação.



Otimizando: calcular d30/d60/d90 no mesmo loop que os segmentos para evitar consultas duplicadas.



Resumo do que foi implementado:

### Backend ([`app.py`](app.py))

1. **`_SAFRA_ENTRADA_SQL` + `_safra_entrada_rows`**  
   Cohort por faixa de calendário e mês (`YEAR`/`MONTH`): ocorrência **`aberto`** com descrição **`contrato novo`** ou **`contrato voltou`**, `data_arquivo` na janela; no **mesmo** `id_arquivo_gm` há **exatamente uma** ocorrência **`parcela vencida`** (descrição começando com `parcela`); número da parcela extraído do texto; join em **`parcela`** com **`MIN(vencimento)`** se houver mais de uma linha para o mesmo número.

2. **`_aggregate_performance_faixa`**  
   - Valor: **`COALESCE(valor_total, valor_nominal)`** da parcela-alvo.  
   - **Performado**: parcela **`fechado`** ou ocorrência **`parcela paga`** com texto **`parcela {n} paga`** em data ≥ entrada.  
   - Atraso só para não performados (parcela ainda aberta e vencida).  
   - **`recovery_d30` / `d60` / `d90`**: performados com dias entre entrada e primeira **`parcela paga`** (se não houver data de paga e estiver `fechado`, usa **hoje** para o prazo).

3. **`/api/performance`**  
   - **Taxa de recuperação**: `safra_performados_mes / safra_cohort_mes` no mês inteiro (mesma regra de cohort, sem subdivisão por faixa de dia).  
   - Por faixa: `volume` = tamanho do cohort; `d30`/`d60`/`d90` = recuperação cumulativa; séries em barra “pagos” = total **performado** na faixa.  
   - Resposta `desempenho`: inclui `valor_parcela_entrada_por_segmento_brl` e mantém `valor_credito_por_segmento_brl` como alias do mesmo valor.

4. **Export (`_fetch_export_dataset`)**  
   - Resumo por faixa usa os mesmos totais da agregação.  
   - Série **pagos** na visão geral = contratos **performados** do cohort na faixa.  
   - Lista de contratos = **apenas IDs do cohort** da seleção (visão geral = união das quatro faixas).

5. **`_SERIES_LABELS_EXPORT['pagos']`**  
   - Texto atualizado para refletir safra performada.

### Frontend

- **[`templates/performance.html`](templates/performance.html)** — KPI de recuperação, painel de safra, faixas, desempenho e pizza com textos alinhados à regra de negócio.  
- **[`static/performance.js`](static/performance.js)** — Labels (cohort, quit. ≤30/60/90d), séries “Safra performada”, subtítulo do gráfico em **valor da parcela de entrada**, rosca com **`PIE_META_RECOVERY`** quando uma faixa está selecionada (prazo após entrada), tooltip do KPI com `safra_cohort_mes` / `safra_performados_mes`.

O gráfico **“Abertos por Vencimento”** na **visão geral** continua com o doughnut **global** de atraso (contratos abertos); ao **focar uma faixa**, o rosca passa a mostrar **performados por faixa de dias até a quitação** da parcela de entrada.

---

**User**

ajeite os scripts @Python/import_only_arquivos_gm.py e @Python/import_only_arquivos_gm.py que agora estao localizados na pasta 'Python'.

---

**Cursor**

Analisando os scripts em `Python/` e corrigindo caminhos e referências após a mudança de pasta.



Corrigindo `app.py` para apontar para `Python/` e alinhando `import_only_arquivos_gm.py` ao restante do projeto (variáveis de ambiente do banco, `charset`).



Segue o que foi ajustado:

### [`app.py`](app.py)
- `PROJECT_DIR` e `PYTHON_DIR = .../Python` definidos ao lado de `SCRIPTS_DIR`.
- Caminhos dos subprocessos de importação passam a usar **`PYTHON_DIR`**:
  - `import_only_arquivos_gm.py`
  - `tracker_gm_range_date_contratos.py`
  - `distribuir_funcionarios_cobranca.py` (importação em lote e **restaurar distribuição**).
- Comentários que citavam `scripts/distribuir...` atualizados para **`Python/distribuir...`**.

### [`Python/import_only_arquivos_gm.py`](Python/import_only_arquivos_gm.py)
- Docstring com uso: `python Python/import_only_arquivos_gm.py [pasta]`.
- **`BASE_DIR`** (pasta do script) para mensagem final e referência futura.
- Conexão alinhada ao restante do projeto: **`DB_HOST`**, **`DB_USER`**, **`DB_PASSWORD`**, **`DB_NAME`** (com defaults iguais aos anteriores) e **`charset='utf8mb4'`**.
- Variáveis `n_ok` / `n_err` e remoção de import não usado.

### Outros na pasta `Python`
- [`Python/distribuir_funcionarios_cobranca.py`](Python/distribuir_funcionarios_cobranca.py): bloco **Uso** com `python Python/...`.
- [`Python/tracker_gm_range_date_contratos.py`](Python/tracker_gm_range_date_contratos.py): nota de **`layout.json`** + **`pessoa_satellite.py`** no mesmo diretório e exemplo de linha de comando com `Python/`.

O `tracker` já resolvia `layout.json` com `os.path.dirname(os.path.abspath(__file__))`, então continua correto com os arquivos na pasta `Python`. Você citou o mesmo arquivo duas vezes; se quiser outro script na pasta `Python` revisado, diga qual.

