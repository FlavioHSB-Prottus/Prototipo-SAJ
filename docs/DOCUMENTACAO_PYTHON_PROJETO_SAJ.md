# Documentacao Python - Prototipo SAJ

Este documento descreve **todos os ficheiros `.py`** do repositorio, o **fluxo de execucao** entre eles, e como se ligam ao **Flask (`app.py`)**, ao **MariaDB/MySQL** e a **integracoes externas**. Objetivo: um desenvolvedor novo orientar-se sem depender so de inferencia sobre o monolito.

**Ambiente:** `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (e opcional `DB_PORT` / `MYSQL_*`). Opcional **`SESSION_IDLE_MAX_SEC`** (defeito 3600): tempo maximo sem renovar `session['_idle_last']` antes de expirar a sessao. Ver `.env.example` e `AGENTS.md`.

**Metodologia e governanca:** regras obrigatorias em `.cursor/rules/metodologia-joao-barbosa.mdc` (raiz do repo); produto e negocio consolidados em `AGENTS.md`.

---

## 1. Visao geral da arquitetura Python

| Camada | Ficheiros | Papel |
|--------|-----------|--------|
| **Aplicacao web** | `app.py` | Monolito Flask: rotas HTML + API JSON, SQL com PyMySQL, subprocessos na importacao GM. |
| **SMTP opcional** | `Python/google_workspace_smtp.py` | Carregado por `app.py` via `importlib` no arranque; Gmail/Workspace quando `GOOGLE_SMTP_*` definido. |
| **Pipelines GM** | `Python/*.py` + **`Python/importacao_pipeline_events.py`** | CLI ou **chamados por `app.py`** em `/api/processar` (SSE) ou em **thread** (`/api/importacao/background/*`). |
| **Base de dados (CLI)** | `Banco/*.py` | Schema, seeds, Excel legado; nao importados pelo Flask no arranque normal. |

**Fluxo da importacao (browser -> servidor):**  
`POST /api/upload` guarda TXT numa pasta temporaria.

**Modo recomendado (segundo plano):** `POST /api/importacao/background/start` com JSON `{ "temp_dir": "<pasta>" }` devolve `job_id`; uma **thread daemon** no processo Flask executa o mesmo pipeline que o SSE e grava eventos em memoria (`_import_jobs`). O cliente usa `GET /api/importacao/background/<job_id>/stream?from=N` (SSE) na pagina Importacao e **polling** `GET .../state` na bolha global; `GET .../snapshot` devolve JSON com fila de eventos; `POST .../cancel` marca cancelamento e faz `terminate` no subprocesso activo. **Nota:** jobs vivem **so na memoria do processo** — varios workers Gunicorn nao partilham estado.

**Modo SSE directo (legado / compativel):** `GET /api/processar?dir=...` devolve **SSE** e executa as **tres fases** no pedido (sem `job_id`):

1. `Python/import_only_arquivos_gm.py` com argumento `temp_dir` (pasta ou ficheiro `.txt`) -> grava em `arquivos_gm` (`data_processamento = NULL` na ingestao/reimportacao).
2. `Python/tracker_gm_range_date_contratos.py` com o mesmo `temp_dir` -> varre TXT via `gm_txt_io`, processa apenas `arquivos_gm` com `data_arquivo IN (...)` das datas da sessao e `data_processamento IS NULL`; parse GM, `pessoa_satellite.py`, etc.
3. `Python/distribuir_funcionarios_cobranca.py` (sem args na chamada web) -> `funcionario_cobranca`.

As duas vias usam o mesmo gerador **`iter_importacao_events`** em `Python/importacao_pipeline_events.py` (carregado por `app.py` via `importlib`).

**Fluxo legado SAJ -> distribuicao:** executar `Banco/popular_relacao_operadores_saj.py` (Excel -> `relacao_contrato_operador`) **antes** da distribuicao automatica, quando se quiser mapear operadores do sistema antigo.

**Tabela `performance`:** `Python/performance_sincronizar.py` repovoa dados alinhados ao Dashboard/Performance do `app.py` (operacao batch; **nao** e fase 4 do `/api/processar` no codigo atual).

---

## 2. Inventario (ficheiros `.py` principais)

| Caminho | Papel |
|---------|--------|
| `app.py` | Monolito Flask (ver secao 3). |
| `Python/google_workspace_smtp.py` | SMTP Google na importacao (lote e-mail). |
| `Python/importacao_pipeline_events.py` | Gerador `iter_importacao_events` (fases 1-3, eventos SSE, cancelamento). |
| `Python/gm_txt_io.py` | Varredura TXT GM (ficheiro ou pasta) e data do header H (pos. 65-73). |
| `Python/import_only_arquivos_gm.py` | Fase 1 GM -> `arquivos_gm`. |
| `Python/tracker_gm_range_date_contratos.py` | Fase 2 tracker / ocorrencias. |
| `Python/pessoa_satellite.py` | Contatos satellite usados pelo tracker. |
| `Python/distribuir_funcionarios_cobranca.py` | Fase 3 `funcionario_cobranca`. |
| `Python/serasa_conv_txt.py` | TXT SERASA-CONVEM 600 chars. |
| `Python/serasa_pefin_erros.py` | Tabela/descricoes codigos erro PEFIN (retorno SERASA); carregado por `app.py` sob demanda. |
| `Python/performance_sincronizar.py` | Repovoar tabela `performance` (CLI). |
| `Python/migrar_remover_avalista_contatos.py` | Migracao one-off contatos avalista. |
| `Banco/criar_banco.py` | Schema inicial. |
| `Banco/seed_funcionarios.py` | Seeds `funcionario`. |
| `Banco/popular_relacao_operadores_saj.py` | Excel -> `relacao_contrato_operador`. |

---

## 3. `app.py` (monolito Flask)

**Localizacao:** raiz. **Tamanho:** muito grande; tratar como **varios modulos conceituais** num so ficheiro.

### 3.1 Arranque

- `threading`, `uuid`, `stream_with_context` (importacao em segundo plano + SSE).
- `load_dotenv` opcional para `.env`.
- `DB_CONFIG` (PyMySQL), alinhado a `Python/` e `Banco/`.
- `_SESSION_IDLE_MAX_SEC` (env `SESSION_IDLE_MAX_SEC`), helpers `_request_skips_idle_touch`, `_session_idle_expired_response`, `_enforce_and_touch_session_idle` (renovacao de `session['_idle_last']` e expiracao).
- `PYTHON_DIR`, `PYTHON_EXE` para `subprocess`.
- `_import_jobs`, `_import_job_lock`, `_get_iter_importacao_events()`, `_importacao_background_worker()` (importacao GM em thread).
- `_load_google_workspace_smtp()` carrega `Python/google_workspace_smtp.py` no arranque (SMTP Google na Importacao).
- `_get_serasa_conv_txt()` carrega `Python/serasa_conv_txt.py` via `importlib` sob demanda.
- `_get_serasa_pefin_erros()` carrega `Python/serasa_pefin_erros.py` via `importlib` sob demanda.

### 3.2 Seguranca, perfis e sessao por inatividade

Helpers `_nivel_normalizado`, `_session_pode_gerir_operadores`, `_admin_json_forbidden`, `_enforce_nivel_acesso_modulos` (before_request), listas `_cobranca_api_ok` / `_cobranca_html_ok`, contexto Bradesco/multi-empresa, `inject_perfil_ui` para templates.

**Inatividade (servidor):** o primeiro `before_request` registado (`_session_idle_and_touch`) verifica `session['_idle_last']` face a `_SESSION_IDLE_MAX_SEC`. Se expirou, limpa a sessao e devolve 401 JSON (`sessao_expirada`) ou redirect ao login com flash. Caso contrario, **atualiza** `_idle_last` em cada pedido **excepto** rotas automaticas listadas em `_request_skips_idle_touch` (ex.: prefixo **`/api/importacao/background/`**, **`GET /api/notificacoes`**), para nao manter sessao viva apenas por polling. **`POST /api/sessao/atividade`** renova a marca (usado pelo `sessao_idle.js` com throttle). No **login** bem-sucedido define-se `_idle_last`.

### 3.3 Rotas HTML

Exemplos: `/`, `/home`, `/busca`, `/cobranca`, `/importacao`, `/relatorios`, `/negativacao`, `/performance`, `/agenda`, `/cadastro`, `/operadores`, `/protocolo`, `/solicitacao`, `/mensagem`, `/pasta-virtual`, `/recuperar_senha`, `/minha-foto`. Cada uma liga a `templates/` e `static/`.

### 3.4 Rotas API (por dominio)

| Dominio | Rotas / prefixo | Ligacao principal |
|---------|-----------------|-------------------|
| Auth / sessao | `/`, `/logout`, `/api/sessao/empresa`, **`POST /api/sessao/atividade`** | `funcionario`, `session`, `_idle_last` |
| Upload / processar GM | `/api/upload`, `/api/processar` (SSE), **`POST /api/importacao/background/start`**, **`GET /api/importacao/background/<job_id>/stream`**, **`.../snapshot`**, **`.../state`**, **`POST .../cancel`** | subprocessos `Python/*.py`, `_import_jobs`, SSE |
| Distribuicao importacao | `/api/importacao/distribuicao`, reassign, transferir, restaurar, aprovar | `funcionario_cobranca`; pode chamar `distribuir_funcionarios_cobranca.py` |
| SMS/email automaticos | `sms-automatizados/*` | SQL `_SMS_AUTOM_*`, MessageCenter, `registro_sms` / `registro_email` |
| Busca / cadastro | `/api/busca`, `/api/pessoa/*`, `/api/contrato/*` | leitura SQL agregada |
| Comunicacao | `/api/discar`, `/api/enviar-sms`, `/api/enviar-email-html`, `/api/enviar-whatsapp` | HTTP externo + `registro_*` |
| Tramitacao | `/api/contrato/.../tramitacao`, `/api/tramitacao/*`, fluxo | tabela `tramitacao` |
| Relatorios | `/api/relatorios`, excel, pdf, `email-lote` | `_fetch_relatorio_rows`, exports |
| Dashboard / Performance | `/api/dashboard`, `/api/performance`, `/api/performance/panel_contratos`, **`/api/performance/export/<formato>`** (POST) | SQL; alinhado a `performance_sincronizar.py`; export xlsx/pdf/csv — ver secao 3.4.1 |
| Cobranca | `/api/cobranca`, consorciados, avalistas, operadores | carteira, `funcionario_cobranca` |
| Automacao carteira | `/api/cobranca/sms-email/*`, `/api/automacao/<tipo>` | filtros por `contrato_ids` |
| Negativacao | `/api/negativacao/*`, SERASA TXT | `negativacao`, modulo `serasa_conv_txt` |
| Admin | `/api/admin/funcionario`, `/api/funcionarios`, perfil | gestores |
| Agenda / avisos / notificacoes | rotas correspondentes | modulos operacionais |
| Mensagem / protocolo / solicitacao | rotas correspondentes | moderacao interna |
| Pasta virtual | `/api/pasta-virtual*` | ficheiros e meta |

### 3.4.1 Exportacao Performance (`POST /api/performance/export/<formato>`)

Formatos aceites: **`xlsx`**, **`pdf`**, **`powerbi`** (CSV com `;`, BOM UTF-8, pensado para Power BI).

**Corpo JSON** (validado por `_resolve_export_payload`): `mes` (YYYY-MM), `safra_index` (`all` ou 0–3), `series` (subset de `novos` / `pagos` / `indenizados`), `faixas` (`d30` / `d60` / `d90`), `atraso_teto` (30, 60 ou 90). Para **PDF**, o cliente pode enviar `bar_image` / `pie_image` (`data:image/png;base64,...`).

**Dataset** (`_fetch_export_dataset`): agrega por faixa de calendario do mes com `_aggregate_performance_faixa` e `_safra_entrada_rows` (SQL `_SAFRA_ENTRADA_SQL`). Metricas de valor: **`_valor_metrica_performance_brl`** (parcela de referencia, alinhada ao painel) e **`_valor_credito_contrato_brl`** (usada noutros pontos; o export tidy nao inclui medida de credito). No SQL, quitação com prazo **>90** dias (pagamento vs vencimento da parcela de referencia) classifica-se em **`d90`** (mesmo bucket que 61–90). O bloco **`resumo`** tem sempre as quatro safras com cohort (quantidade + R$ parcela metrica), **`performado`** por faixas exclusivas `d30`/`d60`/`d90`/`dplus` (este ultimo so para chaves inesperadas; na pratica tende a zero) e **`nao_performado`** por `b30`/`b60`/`b90`/`bplus`. **`resumo_tidy`** — **`_build_performance_resumo_tidy`** — formato longo: `contratos` e `brl_parcela_metrica` por situacao/faixa.

**Excel (`_export_to_xlsx`)**: abas `Parametros`, **`Resumo Safras`** (cohort: contratos + R$ parcela; performado: ate 30d exclusivo, ate 60d e ate 90d **cumulativos**; nao performado em quatro faixas; linha **TOTAL** com `SUM`; sem colunas de R$ credito), **`Resumo Safras pivot`**, **`Resumo pivot notas`**, `Series Graficas`, `Faixas de Atraso`, `Contratos`. **`_export_to_csv_powerbi`**: inclui linhas `resumo_safra_tidy` com cabecalho proprio apos a tabela `series`.

### 3.5 Importacao pipeline (`Python/importacao_pipeline_events.py`)

| Funcao / simbolo | Descricao |
|------------------|------------|
| `iter_importacao_events(temp_dir, job, *, ...)` | Iterator de dicts com `type`: `log`, `progress`, `status`, `done`, `error`. Executa fases 1-3 com `subprocess.Popen`; se `job` nao for `None`, regista `active_proc` e respeita `job['cancel_requested']` (terminate). |
| `_job_set_active` / `_job_clear_active` | Liga o `Popen` atual ao dict `job` para cancelamento. |
| `_job_cancelled` | Le flag `cancel_requested`. |

**Ligacao:** `app.py` — `GET /api/processar` itera com `job=None`; `_importacao_background_worker` itera com o dict do `_import_jobs[job_id]`.

### 3.6 Helpers transversais (amostra)

`_get_db()`, `_clean_rows`, integracao **MessageCenter** (`_messagecenter_post_email_html`, URLs e headers), integracao **Google SMTP** (`Python/google_workspace_smtp.py` carregado no arranque do `app.py`, ramo `usar_smtp_google` em envio automatico na importacao), negativacao SERASA, relatorios (`_relatorio_email_lote_disparar`, etc.).

**Como navegar:** `grep "^@app.route"` no `app.py` ou outline do IDE; seguir chamadas a funcoes `_` a partir da rota.

---

## 4. `Python/google_workspace_smtp.py`

| Funcao | Descricao |
|--------|-----------|
| `google_smtp_config_from_env()` | Le `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_PASSWORD`, opcionais host/port/from. |
| `send_google_workspace_email(...)` | Envia HTML (multipart); retorna `(ok, erro)`. |

**Ligacao:** `app.py` chama `_load_google_workspace_smtp()` no arranque e guarda o modulo em `_smtp_google_workspace`. Nao e subprocesso da importacao GM; so o Flask usa.

---

## 5. `Python/gm_txt_io.py`

`iter_txt_paths(root)` (ficheiro `.txt` unico ou `os.walk` em pasta), `data_arquivo_from_header_line`, `collect_dates_from_txt_root`. Partilhado por `import_only`, pipeline e tracker.

---

## 6. `Python/import_only_arquivos_gm.py`

Ingestao bruta de `.txt` via `gm_txt_io.iter_txt_paths`. `select_folder()` (tkinter) se sem argv; aceita pasta ou ficheiro `.txt` em argv. `INSERT ... ON DUPLICATE KEY UPDATE` com `data_processamento = NULL` ao actualizar conteudo.

**Ligacao:** fase 1 do pipeline GM com `[PYTHON_EXE, '-u', script1, temp_dir]`.

---

## 7. `Python/pessoa_satellite.py`

Upserts em `endereco`, `telefone`, `email` por `id_pessoa`. `telefone_e_valido_para_tracker` (>= 8 digitos significativos). `upsert_devedor_contatos` / `upsert_avalista_contatos` mapeiam campos GM (registro_1 / registro5).

**Ligacao:** importado por `tracker_gm_range_date_contratos.py`.

---

## 8. `Python/tracker_gm_range_date_contratos.py`

Motor pos-GM: `arquivos_gm`, `layout.json`, SQL massivo, ocorrencias, deltas. Seleccao de ficheiros da sessao: `argv[1]` = pasta/`temp_dir` (mesma varredura que importacao por pasta ou por TXT); SQL `data_arquivo IN (...)` e `data_processamento IS NULL` (nao usa `BETWEEN` com dias intermédios ausentes no upload). Stdin com duas datas mantido como legado CLI.

**Ligacao:** fase 2 do pipeline GM com `[PYTHON_EXE, '-u', script2, temp_dir]`.

---

## 9. `Python/distribuir_funcionarios_cobranca.py`

Distribui contratos abertos a funcionarios **Cobranca** em `funcionario_cobranca` (valor, quantidade, estabilidade, `relacao_contrato_operador`).

**Ligacao:** fase 3 do pipeline GM; tambem `subprocess.run` noutras rotas de distribuicao.

---

## 10. `Python/serasa_conv_txt.py`

TXT 600 caracteres SERASA-CONVEM; inclusao (detalhe) vs exclusao (header+trailer). `montar_arquivo_txt`, helpers `_fit`, `patch_header_*`.

**Modelos por defeito:** `Python/serasa_templates/` (`SERASA_GM_*4912*.TXT`, `SERASA_GM_*4910*.TXT`). Sobrescrever com `SERASA_CONV_TEMPLATE_DIR` se necessario.

**Legado de referencia:** `docs/referencias/legacy-php/sistema.geracao.arquivo.negativacao.serasa.php` (nao executado pelo Flask).

**Ligacao:** `app.py` via `_get_serasa_conv_txt()`; sem rede.

**Retorno PEFIN (codigos 3 digitos):** `Python/serasa_pefin_erros.py` — dicionario `PEFIN_CODIGO_ERRO_DESCRICAO`, constante `LINHA_DETALHE_PEFIN_LEN`; carregamento lazy com `_get_serasa_pefin_erros()` no `app.py`.

---

## 11. `Python/performance_sincronizar.py`

Reconstroi `performance` a partir de ocorrencias (contrato novo / voltou), alinhado ao app.

**Ligacao:** CLI / cron; verificar `app.py` se no futuro for integrado ao processar.

---

## 12. `Python/migrar_remover_avalista_contatos.py`

Migracao one-off de tipos `telefone`/`email` com prefixo avalista; `--dry-run`.

**Ligacao:** manutencao manual.

---

## 13. `Banco/criar_banco.py`

`RAW_SQL` embutido + `argparse` para criar/atualizar schema.

**Ligacao:** setup inicial; independente do Flask.

---

## 14. `Banco/seed_funcionarios.py`

Upsert idempotente em `funcionario` a partir de `DADOS`; `SENHA_PADRAO` via env.

**Ligacao:** demo/homolog.

---

## 15. `Banco/popular_relacao_operadores_saj.py`

Excel -> `relacao_contrato_operador` (grupo/cota normalizados).

**Ligacao:** prioridade 0 do `distribuir_funcionarios_cobranca.py`.

---

## 16. Diagrama de dependencias

```
[Browser]
  -> app.py (Flask)
       -> PyMySQL -> MariaDB
       -> requests -> MessageCenter, discador, etc.
       -> Python/google_workspace_smtp.py (opcional Google SMTP)
       -> subprocess (via importacao_pipeline_events):
            import_only_arquivos_gm.py -> arquivos_gm
            tracker_gm_range_date_contratos.py + pessoa_satellite.py -> nucleo de dados
            distribuir_funcionarios_cobranca.py -> funcionario_cobranca
       -> importlib -> serasa_conv_txt.py, serasa_pefin_erros.py

[CLI operador]
  Banco/criar_banco.py
  Banco/seed_funcionarios.py
  Banco/popular_relacao_operadores_saj.py
  Python/performance_sincronizar.py
  Python/migrar_remover_avalista_contatos.py
```

---

## 17. Documentacao JS (frontend)

Comportamento de `static/*.js`, ordem de scripts em `layout.html` e mapa template -> API: **`docs/DOCUMENTACAO_JS_PROJETO_SAJ.md`**.

---

*Estado do repositorio: monolito `app.py` + modulos em `Python/` e `Banco/` conforme tabela da secao 2. Frontend: ver `DOCUMENTACAO_JS_PROJETO_SAJ.md`.*
