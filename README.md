# Prototipo-SAJ

Sistema centralizado para gestão e cobrança de consórcios: importação de arquivos GM, carteira, negativação, relatórios e cadastros. Use o menu lateral para navegar entre os módulos.

## Metodologia e padroes

- **Metodologia obrigatoria (texto completo):** [`.cursor/rules/metodologia-joao-barbosa.mdc`](.cursor/rules/metodologia-joao-barbosa.mdc) — regras de engenharia e processo; **nao** podem ser descumpridas em alteracoes ao projeto.
- **Produto e negocio:** [`AGENTS.md`](AGENTS.md).
- **Documentacao tecnica (modulos, APIs, fluxos):** [`docs/DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`](docs/DOCUMENTACAO_PYTHON_PROJETO_SAJ.md), [`docs/DOCUMENTACAO_JS_PROJETO_SAJ.md`](docs/DOCUMENTACAO_JS_PROJETO_SAJ.md).
- **Deploy e ambientes (local, VM/VPN, servidor):** [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Referencias (PDFs, SERASA, PHP legado):** [`docs/referencias/README.md`](docs/referencias/README.md).

## Configuração e segredos

1. Copie `.env.example` para `.env` e defina valores (não versionar `.env` — está no `.gitignore`).
2. Variáveis **`DB_*`** alinham o Flask aos scripts em `Python/` (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; opcional `DB_PORT`).
3. **`FLASK_SECRET_KEY`** para sessão em produção.
4. Opcional: **`DISCADOR_URL`**, **`DISCADOR_USUARIO`**, **`DISCADOR_TOKEN`** — API de discagem (botão Ligar nos telefones; ver `.env.example`). O ramal de origem vem do cadastro do funcionário logado (`funcionario.ramal`).
5. **E-mail Google Workspace (só lote automático na página Importação):** `GOOGLE_SMTP_*` em `.env`; implementação em [`Python/google_workspace_smtp.py`](Python/google_workspace_smtp.py) (carregado por `app.py`).
6. Sem arquivo `.env`, o aplicativo usa os **mesmos padrões de desenvolvimento** de antes (`localhost`, usuário `root`, etc.).

## Layout do repositório

| Caminho | Função |
|---------|--------|
| `app.py` | Aplicação Flask (rotas, APIs e regras de negócio). Monólito intencional neste protótipo. |
| `Python/google_workspace_smtp.py` | SMTP opcional Google Workspace para e-mails automáticos da **Importação** (quando `GOOGLE_SMTP_*` está definido). |
| `templates/` | Páginas HTML (estendem `layout.html`). |
| `static/` | CSS e JS por módulo (`cobranca.js`, `busca.js`, …) + assets compartilhados (`contrato_detalhes_modal.js`, `tramitacoes_detail.js`). |
| `Python/` | Scripts GM (subprocesso), SERASA, distribuição, performance, **SMTP Google** (`google_workspace_smtp.py`). Modelos TXT SERASA em `Python/serasa_templates/`. |
| `Banco/` | Scripts auxiliares de criação/seed do MySQL (uso manual ou deploy). |
| `docs/` | Documentacao tecnica (`DOCUMENTACAO_*`), [`docs/referencias/`](docs/referencias/) (PDFs, amostras SERASA, PHP legado como referencia). |

**`ARQUIVO GM/` (local, obrigatório na tua máquina):** é a tua **base de ficheiros TXT GM** (histórico/arquivo morto). **Não é** o destino do upload da aplicação (a importação na web usa pastas temporárias via `/api/upload`). **Não deve ser commitada nem enviada ao remoto** — está em `.gitignore` para só existir no teu disco e nunca “subir” no `git push`.

Renomear ou mover `templates/` ou `static/` exige ajustar `url_for`, `render_template` e tags `<script>`/`href` em todo o projeto.

## Revisão de código (manutenção)

- Há **duplicação** de `renderContratoModal` em vários JS (`cobranca.js`, `busca.js`, `agenda.js`, …); unificar reduziria linhas, mas é refatoração arriscada — avaliar com testes manuais por módulo.

## Execução

Requisitos: Python 3 com dependências de `requirements.txt`, MySQL acessível com as credenciais configuradas (env ou padrão local).

Com `python-dotenv` instalado (está em `requirements.txt`), o `app.py` carrega o arquivo `.env` da raiz, se existir, antes de montar `DB_CONFIG`. Sem o pacote ou sem `.env`, o comportamento segue os padrões locais documentados em `.env.example`.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # editar DB_* e FLASK_SECRET_KEY
python Banco/criar_banco.py
python Banco/seed_funcionarios.py
python app.py
```

Acesso local: **http://127.0.0.1:5000** (servidor em `0.0.0.0:5000`, `debug=True` — só para desenvolvimento).

## Deploy e ambientes

O repositório **não inclui** Docker, CI/CD nem scripts de deploy automatizados. A implantação é **manual**: código no servidor (git), `.env`, MariaDB e processo Python.

| Ambiente | Como sobe | Documentação |
|----------|-----------|--------------|
| **Local** | `python app.py` após `criar_banco` + `.env` | Secção [Execução](#execução) acima |
| **Testes (VM + VPN)** | Gunicorn (1 worker) + opcional nginx/HTTPS; BD dedicada | [`docs/DEPLOY.md`](docs/DEPLOY.md) §3.2 e §4 |
| **Produção** | Mesmo padrão WSGI; `FLASK_SECRET_KEY` forte, sem `debug` | [`docs/DEPLOY.md`](docs/DEPLOY.md) §3.3 |

Pontos críticos no servidor:

- Variáveis **`DB_*`** e **`FLASK_SECRET_KEY`** no `.env` (nunca no Git).
- Importação GM em segundo plano guarda estado **em memória** — usar **um** worker Gunicorn ou um único processo Flask.
- Integrações (discador, SMS/e-mail) configuradas no `.env`; ver [`.env.example`](.env.example).
- Migrações SQL em `Banco/*.sql` aplicar em bases já existentes após `git pull`.

Procedimento completo, nginx, systemd, checklist e troubleshooting: **[`docs/DEPLOY.md`](docs/DEPLOY.md)**.
