# AGENTS Contexto Mestre - Prototipo SAJ

Este arquivo guarda o contexto principal do projeto para orientar agentes de IA.
Objetivo: evitar perda de contexto entre sessoes e manter o desenvolvimento consistente.

## 1) Objetivo do produto

Sistema web para gestao de cobranca de consorcios, com foco em:
- importacao de arquivos GM (TXT),
- acompanhamento de contratos e pessoas,
- tramitacao e agenda de cobranca,
- relatorios e dashboard com dados reais do banco,
- acompanhamento de performance por safra.

## 2) Stack e arquitetura

- Backend: Python + Flask (`app.py`) em formato monolito (intencional no prototipo).
- Frontend: HTML + CSS + JS vanilla por modulo em `templates/` e `static/`.
- Banco: MariaDB (`consorcio_gm`).
- Scripts de negocio em `Python/` (executados por subprocesso no backend).

## 3) Convencoes criticas (sempre aplicar)

- Nao commitar segredos (`.env`, tokens, credenciais).
- Usar variaveis de ambiente: `DB_*`, opcional `MYSQL_*`, `FLASK_SECRET_KEY`.
- Mudancas pequenas e legiveis; evitar refactor amplo sem pedido explicito.
- Nao silenciar erros; retornar mensagens claras sem expor dado sensivel.
- Manter compatibilidade entre `app.py` e scripts em `Python/` para nomes `DB_*`.
- Atualizar README/docs quando mudar setup, comportamento ou convencao.

## 4) Regras de negocio consolidadas

### 4.1 Importacao TXT
- Usuario pode importar arquivo TXT unico, varios arquivos, ou pasta com subpastas.
- Fluxo de processamento roda scripts via subprocesso com logs em tempo real (SSE).
- Range de datas do tracker deve vir dos arquivos importados na sessao atual, nao de pendencias antigas no banco.
- Implementacao deve funcionar em Linux e Windows.

### 4.2 Busca (Pessoa e Contrato)
- Busca por pessoa: nome/CPF, com detalhes de enderecos, telefones, emails e contratos vinculados.
- Busca por contrato: grupo/cota com filtro de status.
- Modal de contrato deve incluir dados do contrato, devedor, avalista, parcelas, ocorrencias e tramitacoes.
- Nos telefones, manter botoes de acao visual (ligar/mensagem) conforme implementado.

### 4.3 Relatorios
- Filtro por tipo + range de datas.
- Exportacao para Excel e PDF.
- Query de "novos" deve considerar ocorrencia de contrato novo no periodo.
- "Abertos" segue logica dedicada baseada em contrato aberto e agregacao de data de ocorrencia.

### 4.4 Dashboard
- KPIs e graficos baseados em banco (nao dados hardcoded).
- Reaproveitar logica de status/queries de relatorios quando fizer sentido.

### 4.5 Performance por safra
- Safra em 4 partes no mes: 1-9, 10-12, 13-19, 20-fim.
- Analise usa `ocorrencia.data_arquivo` para eventos de aberto/fechado/indenizado.
- Visao de 30/60/90 dias usa mes selecionado + dois meses seguintes.
- Definicao de safra prioriza entrada em cobranca (contrato novo/voltou) e parcela de entrada.

### 4.6 Discador
- Botao de ligar deve acionar API backend (`/api/discar`), nunca expor token no frontend.
- Numero de origem vem de `funcionario.ramal` do usuario logado.
- Configuracao via `DISCADOR_URL`, `DISCADOR_USUARIO`, `DISCADOR_TOKEN`.

## 5) Tabelas e entidades chave

- `contrato`, `pessoa`, `parcela`, `ocorrencia`
- `telefone`, `email`, `endereco`
- `tramitacao`, `agenda`
- `funcionario`, `funcionario_cobranca`
- `arquivos_gm` e tabelas de importacao GM

## 6) Diretriz de implementacao futura

Ao receber uma nova tarefa:
1. Preservar comportamento ja estabilizado.
2. Priorizar compatibilidade com dados existentes no banco.
3. Reutilizar endpoints/helpers ja existentes antes de criar novos.
4. Validar impacto em modais de detalhes (contrato/pessoa), pois sao compartilhados em varios modulos.
5. Se mudar regra de negocio, registrar neste arquivo e no README.
