# Prototipo-SAJ

Sistema centralizado para gestão e cobrança de consórcios: importação de arquivos GM, carteira, negativação, relatórios e cadastros. Use o menu lateral para navegar entre os módulos.

## Layout do repositório

| Caminho | Função |
|---------|--------|
| `app.py` | Aplicação Flask (rotas, APIs e regras de negócio). Monólito intencional neste protótipo. |
| `templates/` | Páginas HTML (estendem `layout.html`). |
| `static/` | CSS e JS por módulo (`cobranca.js`, `busca.js`, …) + assets compartilhados (`contrato_detalhes_modal.js`, `tramitacoes_detail.js`). |
| `Python/` | Scripts chamados por subprocess a partir do app: tracker GM, importação, distribuição de cobrança. Depende de `Python/layout.json` e `pessoa_satellite.py`. |
| `Banco/` | Scripts auxiliares de criação/seed do MySQL (uso manual ou deploy). |
| `docs/conversa-agentes/` | Exportações antigas de conversas com agentes (não usadas em runtime). |

Renomear ou mover `templates/` ou `static/` exige ajustar `url_for`, `render_template` e tags `<script>`/`href` em todo o projeto.

## Revisão de código (manutenção)

- Imports em `app.py` estão em uso; a única constante órfã removida foi `SCRIPTS_DIR` (apontava para uma pasta `scripts/` que não existe).
- Há **duplicação** de `renderContratoModal` em vários JS (`cobranca.js`, `busca.js`, `agenda.js`, …) por histórico de telas; unificar num único módulo reduziria linhas, mas é refatoração arriscada para regressões de UI — avaliar com testes manuais por módulo.

## Execução

Requisitos: Python 3 com dependências de `requirements.txt`, MySQL conforme `DB_CONFIG` em `app.py`.
