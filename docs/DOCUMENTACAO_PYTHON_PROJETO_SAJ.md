# Documentacao Python - Prototipo SAJ

Este documento descreve **todos os ficheiros `.py`** do repositorio, o **fluxo de execucao** entre eles, e como se ligam ao **Flask (`app.py`)**, ao **MariaDB/MySQL** e a **integracoes externas**. Objetivo: um desenvolvedor novo orientar-se sem depender so de inferencia sobre o monolito.

**Ambiente:** `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (e opcional `DB_PORT` / `MYSQL_*`). Ver `.env.example` e `AGENTS.md`.

---

## 1. Visao geral da arquitetura Python

| Camada | Ficheiros | Papel |
|--------|-----------|--------|
| **Aplicacao web** | `app.py` | Monolito Flask: rotas HTML + API JSON, SQL com PyMySQL, subprocessos na importacao GM. |
| **SMTP opcional** | `smtp.py` | Modulo na raiz; envio via Google Workspace (Gmail SMTP) quando configurado. |
| **Pipelines GM** | `Python/*.py` | CLI ou **chamados por `app.py`** em `/api/processar` (SSE). |
| **Base de dados (CLI)** | `Banco/*.py` | Schema, seeds, Excel legado; nao importados pelo Flask no arranque normal. |

**Fluxo da importacao (browser -> servidor):**  
`POST /api/upload` guarda TXT numa pasta temporaria. `GET /api/processar?dir=...` devolve **SSE** e executa **tres fases**:

1. `Python/import_only_arquivos_gm.py` com argumento `temp_dir` -> grava em `arquivos_gm`.
2. `Python/tracker_gm_range_date_contratos.py` -> **stdin**: duas linhas `YYYY-MM-DD` (min e max das datas extraidas dos TXT da sessao); parse GM, atualiza `pessoa`, `contrato`, `parcela`, `ocorrencia`, etc.; usa `pessoa_satellite.py`.
3. `Python/distribuir_funcionarios_cobranca.py` (sem args na chamada web) -> `funcionario_cobranca`.

**Fluxo legado SAJ -> distribuicao:** executar `Banco/popular_relacao_operadores_saj.py` (Excel -> `relacao_contrato_operador`) **antes** da distribuicao automatica, quando se quiser mapear operadores do sistema antigo.

**Tabela `performance`:** `Python/performance_sincronizar.py` repovoa dados alinhados ao Dashboard/Performance do `app.py` (operacao batch; **nao** e fase 4 do `/api/processar` no codigo atual).

---

## 2. Inventario (12 ficheiros Python)

| Caminho |
|---------|
| `app.py` |
| `smtp.py` |
| `Python/import_only_arquivos_gm.py` |
| `Python/tracker_gm_range_date_contratos.py` |
| `Python/pessoa_satellite.py` |
| `Python/distribuir_funcionarios_cobranca.py` |
| `Python/serasa_conv_txt.py` |
| `Python/performance_sincronizar.py` |
| `Python/migrar_remover_avalista_contatos.py` |
| `Banco/criar_banco.py` |
| `Banco/seed_funcionarios.py` |
| `Banco/popular_relacao_operadores_saj.py` |

---

## 3. `app.py` (monolito Flask)

**Localizacao:** raiz. **Tamanho:** muito grande; tratar como **varios modulos conceituais** num so ficheiro.

### 3.1 Arranque

- `Flask`, `session`, `render_template`, `jsonify`, `send_file`, etc.
- `load_dotenv` opcional para `.env`.
- `DB_CONFIG` (PyMySQL), alinhado a `Python/` e `Banco/`.
- `PYTHON_DIR`, `PYTHON_EXE` para `subprocess`.
- `_get_serasa_conv_txt()` carrega `Python/serasa_conv_txt.py` via `importlib` sob demanda.

### 3.2 Seguranca e perfis

Helpers `_nivel_normalizado`, `_session_pode_gerir_operadores`, `_admin_json_forbidden`, `_enforce_nivel_acesso_modulos` (before_request), listas `_cobranca_api_ok` / `_cobranca_html_ok`, contexto Bradesco/multi-empresa, `inject_perfil_ui` para templates.

### 3.3 Rotas HTML

Exemplos: `/`, `/home`, `/busca`, `/cobranca`, `/importacao`, `/relatorios`, `/negativacao`, `/performance`, `/agenda`, `/cadastro`, `/operadores`, `/protocolo`, `/solicitacao`, `/mensagem`, `/pasta-virtual`, `/recuperar_senha`, `/minha-foto`. Cada uma liga a `templates/` e `static/`.

### 3.4 Rotas API (por dominio)

| Dominio | Rotas / prefixo | Ligacao principal |
|---------|-----------------|-------------------|
| Auth / sessao | `/`, `/logout`, `/api/sessao/empresa` | `funcionario`, `session` |
| Upload / processar GM | `/api/upload`, `/api/processar` | subprocessos `Python/*.py`, SSE |
| Distribuicao importacao | `/api/importacao/distribuicao`, reassign, transferir, restaurar, aprovar | `funcionario_cobranca`; pode chamar `distribuir_funcionarios_cobranca.py` |
| SMS/email automaticos | `sms-automatizados/*` | SQL `_SMS_AUTOM_*`, MessageCenter, `registro_sms` / `registro_email` |
| Busca / cadastro | `/api/busca`, `/api/pessoa/*`, `/api/contrato/*` | leitura SQL agregada |
| Comunicacao | `/api/discar`, `/api/enviar-sms`, `/api/enviar-email-html`, `/api/enviar-whatsapp` | HTTP externo + `registro_*` |
| Tramitacao | `/api/contrato/.../tramitacao`, `/api/tramitacao/*`, fluxo | tabela `tramitacao` |
| Relatorios | `/api/relatorios`, excel, pdf, `email-lote` | `_fetch_relatorio_rows`, exports |
| Dashboard / Performance | `/api/dashboard`, `/api/performance`, exports | SQL; alinhado a `performance_sincronizar.py` |
| Cobranca | `/api/cobranca`, consorciados, avalistas, operadores | carteira, `funcionario_cobranca` |
| Automacao carteira | `/api/cobranca/sms-email/*`, `/api/automacao/<tipo>` | filtros por `contrato_ids` |
| Negativacao | `/api/negativacao/*`, SERASA TXT | `negativacao`, modulo `serasa_conv_txt` |
| Admin | `/api/admin/funcionario`, `/api/funcionarios`, perfil | gestores |
| Agenda / avisos / notificacoes | rotas correspondentes | modulos operacionais |
| Mensagem / protocolo / solicitacao | rotas correspondentes | moderacao interna |
| Pasta virtual | `/api/pasta-virtual*` | ficheiros e meta |

### 3.5 Helpers transversais (amostra)

`_get_db()`, `_clean_rows`, integracao **MessageCenter** (`_messagecenter_post_email_html`, URLs e headers), integracao **Google SMTP** (`import smtp as _smtp_google_workspace`, ramo `usar_smtp_google` em envio automatico na importacao), negativacao SERASA, relatorios (`_relatorio_email_lote_disparar`, etc.).

**Como navegar:** `grep "^@app.route"` no `app.py` ou outline do IDE; seguir chamadas a funcoes `_` a partir da rota.

---

## 4. `smtp.py` (raiz)

| Funcao | Descricao |
|--------|-----------|
| `google_smtp_config_from_env()` | Le `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_PASSWORD`, opcionais host/port/from. |
| `send_google_workspace_email(...)` | Envia HTML (multipart); retorna `(ok, erro)`. |

**Ligacao:** `app.py` importa como `_smtp_google_workspace`. Nao usado pelos scripts em `Python/` da importacao GM.

---

## 5. `Python/import_only_arquivos_gm.py`

Ingestao bruta de `.txt` (walk recursivo) em `arquivos_gm`. `select_folder()` (tkinter) se sem argv; `main()` valida header `H` e data fixa, `INSERT ... ON DUPLICATE KEY UPDATE`.

**Ligacao:** fase 1 de `/api/processar` com `[PYTHON_EXE, '-u', script1, temp_dir]`.

---

## 6. `Python/pessoa_satellite.py`

Upserts em `endereco`, `telefone`, `email` por `id_pessoa`. `telefone_e_valido_para_tracker` (>= 8 digitos significativos). `upsert_devedor_contatos` / `upsert_avalista_contatos` mapeiam campos GM (registro_1 / registro5).

**Ligacao:** importado por `tracker_gm_range_date_contratos.py`.

---

## 7. `Python/tracker_gm_range_date_contratos.py`

Motor pos-GM: `arquivos_gm`, `layout.json`, SQL massivo, `operador` (legado GM), ocorrencias, deltas. `distribuir_operadores` no contexto do arquivo GM.

**Ligacao:** fase 2 de `/api/processar`; stdin = `start_date\n` + `end_date\n` (ver `app.py` linhas ~1425-1428).

---

## 8. `Python/distribuir_funcionarios_cobranca.py`

Distribui contratos abertos a funcionarios **Cobranca** em `funcionario_cobranca` (valor, quantidade, estabilidade, `relacao_contrato_operador`).

**Ligacao:** fase 3 de `/api/processar`; tambem `subprocess.run` noutras rotas de distribuicao.

---

## 9. `Python/serasa_conv_txt.py`

TXT 600 caracteres SERASA-CONVEM; inclusao (detalhe) vs exclusao (header+trailer). `montar_arquivo_txt`, helpers `_fit`, `patch_header_*`.

**Ligacao:** `app.py` via `_get_serasa_conv_txt()`; sem rede.

---

## 10. `Python/performance_sincronizar.py`

Reconstroi `performance` a partir de ocorrencias (contrato novo / voltou), alinhado ao app.

**Ligacao:** CLI / cron; verificar `app.py` se no futuro for integrado ao processar.

---

## 11. `Python/migrar_remover_avalista_contatos.py`

Migracao one-off de tipos `telefone`/`email` com prefixo avalista; `--dry-run`.

**Ligacao:** manutencao manual.

---

## 12. `Banco/criar_banco.py`

`RAW_SQL` embutido + `argparse` para criar/atualizar schema.

**Ligacao:** setup inicial; independente do Flask.

---

## 13. `Banco/seed_funcionarios.py`

Upsert idempotente em `funcionario` a partir de `DADOS`; `SENHA_PADRAO` via env.

**Ligacao:** demo/homolog.

---

## 14. `Banco/popular_relacao_operadores_saj.py`

Excel -> `relacao_contrato_operador` (grupo/cota normalizados).

**Ligacao:** prioridade 0 do `distribuir_funcionarios_cobranca.py`.

---

## 15. Diagrama de dependencias

```
[Browser]
  -> app.py (Flask)
       -> PyMySQL -> MariaDB
       -> requests -> MessageCenter, discador, etc.
       -> smtp.py (opcional Google SMTP)
       -> subprocess:
            import_only_arquivos_gm.py -> arquivos_gm
            tracker_gm_range_date_contratos.py + pessoa_satellite.py -> nucleo de dados
            distribuir_funcionarios_cobranca.py -> funcionario_cobranca
       -> importlib -> serasa_conv_txt.py

[CLI operador]
  Banco/criar_banco.py
  Banco/seed_funcionarios.py
  Banco/popular_relacao_operadores_saj.py
  Python/performance_sincronizar.py
  Python/migrar_remover_avalista_contatos.py
```

---

## 16. Documentacao JS (frontend)

Comportamento de `static/*.js`, ordem de scripts em `layout.html` e mapa template -> API: **`docs/DOCUMENTACAO_JS_PROJETO_SAJ.md`**.

---

*Estado do repositorio: monolito `app.py` + 11 outros modulos/scripts listados acima. Frontend: ver DOCUMENTACAO_JS_PROJETO_SAJ.md.*
