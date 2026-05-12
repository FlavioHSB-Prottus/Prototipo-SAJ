# Prototipo-SAJ

Sistema centralizado para gestão e cobrança de consórcios: importação de arquivos GM, carteira, negativação, relatórios e cadastros. Use o menu lateral para navegar entre os módulos.

## Metodologia e padrões

- Documento original: `Metodologia - Joao Barbosa.odt` (raiz).
- **Versão adaptada** ao stack Python/Flask/MySQL deste repo: [`docs/METODOLOGIA-JOAO-BARBOSA.md`](docs/METODOLOGIA-JOAO-BARBOSA.md).
- **Visão técnica dos ficheiros Python**: [`docs/DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`](docs/DOCUMENTACAO_PYTHON_PROJETO_SAJ.md).
- **Visão técnica dos ficheiros JavaScript** (`static/`): [`docs/DOCUMENTACAO_JS_PROJETO_SAJ.md`](docs/DOCUMENTACAO_JS_PROJETO_SAJ.md).
- Regras para o agente no Cursor: `.cursor/rules/metodologia-joao-barbosa.mdc`.
- Contexto persistente do agente: [`AGENTS.md`](AGENTS.md).

## Configuração e segredos

1. Copie `.env.example` para `.env` e defina valores (não versionar `.env` — está no `.gitignore`).
2. Variáveis **`DB_*`** alinham o Flask aos scripts em `Python/` (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`; opcional `DB_PORT`).
3. **`FLASK_SECRET_KEY`** para sessão em produção.
4. Opcional: **`DISCADOR_URL`**, **`DISCADOR_USUARIO`**, **`DISCADOR_TOKEN`** — API de discagem (botão Ligar nos telefones; ver `.env.example`). O ramal de origem vem do cadastro do funcionário logado (`funcionario.ramal`).
5. Sem arquivo `.env`, o aplicativo usa os **mesmos padrões de desenvolvimento** de antes (`localhost`, usuário `root`, etc.).

## Layout do repositório

| Caminho | Função |
|---------|--------|
| `app.py` | Aplicação Flask (rotas, APIs e regras de negócio). Monólito intencional neste protótipo. |
| `templates/` | Páginas HTML (estendem `layout.html`). |
| `static/` | CSS e JS por módulo (`cobranca.js`, `busca.js`, …) + assets compartilhados (`contrato_detalhes_modal.js`, `tramitacoes_detail.js`). |
| `Python/` | Scripts chamados por subprocess a partir do app: tracker GM, importação, distribuição de cobrança. Depende de `Python/layout.json` e `pessoa_satellite.py`. |
| `Banco/` | Scripts auxiliares de criação/seed do MySQL (uso manual ou deploy). |
| `docs/` | Metodologia, [documentação Python](docs/DOCUMENTACAO_PYTHON_PROJETO_SAJ.md), [documentação JS](docs/DOCUMENTACAO_JS_PROJETO_SAJ.md), etc. |
| `docs/conversa-agentes/` | Exportações antigas de conversas com agentes (não usadas em runtime). |

Renomear ou mover `templates/` ou `static/` exige ajustar `url_for`, `render_template` e tags `<script>`/`href` em todo o projeto.

## Revisão de código (manutenção)

- Há **duplicação** de `renderContratoModal` em vários JS (`cobranca.js`, `busca.js`, `agenda.js`, …); unificar reduziria linhas, mas é refatoração arriscada — avaliar com testes manuais por módulo.

## Execução

Requisitos: Python 3 com dependências de `requirements.txt`, MySQL acessível com as credenciais configuradas (env ou padrão local).

Com `python-dotenv` instalado (está em `requirements.txt`), o `app.py` carrega o arquivo `.env` da raiz, se existir, antes de montar `DB_CONFIG`. Sem o pacote ou sem `.env`, o comportamento segue os padrões locais documentados em `.env.example`.
