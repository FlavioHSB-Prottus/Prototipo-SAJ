# Deploy e ambientes � Prototipo-SAJ

Este documento descreve **como o projeto � executado e implantado hoje**: n�o h� no reposit�rio Dockerfile, pipeline CI/CD, scripts `deploy.sh`, ficheiros systemd nem configura��o nginx versionada. O deploy � **manual** (clone/pull no servidor, `.env`, base de dados, processo Python). O objetivo � qualquer membro da equipa repetir o arranque em **desenvolvimento local** ou numa **VM de testes atr�s de VPN**.

**Refer�ncias cruzadas:** [`README.md`](../README.md) (resumo), [`.env.example`](../.env.example) (vari�veis), [`AGENTS.md`](../AGENTS.md) (neg�cio), [`DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`](DOCUMENTACAO_PYTHON_PROJETO_SAJ.md) (arranque Flask e importa��o GM).

---

## 1. Vis�o geral

| Camada | Tecnologia | Notas |
|--------|------------|--------|
| Aplica��o | Python 3, Flask (`app.py`) | Mon�lito; rotas HTML + API JSON |
| Base de dados | MariaDB / MySQL (`consorcio_gm`) | Credenciais `DB_*` |
| Configura��o | `.env` na raiz (n�o versionado) | `load_dotenv` no arranque de `app.py` |
| Pipelines GM | `Python/*.py` via subprocesso / thread | Mesmas vari�veis `DB_*` |
| Frontend | `templates/` + `static/` | Servido pelo Flask |
| Integra��es | MessageCenter, discador B2, SMTP Google (opcional) | S� no servidor; nunca no JS |

```
[Browser] --HTTPS ou HTTP--> [Reverse proxy opcional] --> [Flask / Gunicorn :5000]
                                                                  |
                                                                  v
                                                          [MariaDB consorcio_gm]
                                                                  ^
[Operador CLI] --> Python/Banco/*.py -----------------------------+
```

---

## 2. O que existe (e o que n�o existe) no Git

| Existe | N�o existe no repo (deploy � parte) |
|--------|-------------------------------------|
| `app.py` com `app.run(host='0.0.0.0', port=5000, debug=True)` em `__main__` | Automa��o de deploy (GitHub Actions, Ansible, etc.) |
| `requirements.txt` | `gunicorn` (instalar no servidor se usar WSGI) |
| `Banco/criar_banco.py`, seeds, SQL de migra��o | systemd / supervisor unit versionado |
| `.env.example` | Certificados TLS / nginx.conf |
| Documenta��o de vari�veis e fluxos | Hostname fixo da VM de testes (definir na equipa) |

---

## 3. Ambientes

### 3.1 Desenvolvimento local

Uso di�rio na m�quina do desenvolvedor.

1. **Python 3** e **MariaDB/MySQL** acess�vel.
2. Clone do reposit�rio; na raiz:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate   # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env        # editar DB_* e FLASK_SECRET_KEY
   ```
3. **Base de dados** (primeira vez ou ambiente limpo):
   ```bash
   python Banco/criar_banco.py
   python Banco/seed_funcionarios.py
   ```
   Em bases j� existentes, aplicar migra��es em `Banco/*.sql` conforme o hist�rico do projeto (ver coment�rios nos ficheiros e `AGENTS.md`).
4. **Arranque:**
   ```bash
   python app.py
   ```
   O servidor sobe em **`http://0.0.0.0:5000`** com **`debug=True`** (recarrega c�digo; **n�o** usar assim em ambiente partilhado de testes/produ��o).
5. Opcional: pasta local **`ARQUIVO GM/`** na raiz (TXT hist�ricos; **n�o** � o destino do upload web; ver README). N�o versionar.

### 3.2 Homologa��o / testes (VM + VPN)

Modelo acordado para valida��o pela equipa **sem** expor o prot�tipo � internet p�blica.

| Aspeto | Pr�tica recomendada |
|--------|---------------------|
| Acesso | VM acess�vel **s�** via VPN corporativa |
| C�digo | `git clone` / `git pull` na branch acordada; `.env` criado no servidor (canal seguro) |
| Base | Inst�ncia MariaDB dedicada a testes (dados sint�ticos ou dump anonimizado) |
| Servidor app | **Gunicorn** (1 worker) ou `flask run` apenas para smoke r�pido |
| Rede | Firewall na VM: portas m�nimas (ex.: 443 no proxy, 5000 s� localhost se houver nginx) |
| HTTPS | Reverse proxy (nginx/Caddy) com certificado interno ou Let's Encrypt, conforme infra |
| URL | Documentar host interno no coment�rio da tarefa / wiki (n�o commitar credenciais) |

**Crit�rio m�nimo de �ambiente no ar�:** login na aplica��o, um fluxo de importa��o ou cobran�a testado por quem n�o montou a VM, seguindo apenas este documento e o README.

### 3.3 Produ��o (futuro)

O prot�tipo ainda n�o define pipeline de produ��o no reposit�rio. Quando existir ambiente definitivo, reutilizar a sec��o 4 com:

- `FLASK_SECRET_KEY` forte e �nico por ambiente
- `debug=False` / sem `app.run(debug=True)`
- HTTPS obrigat�rio
- Rate limiting e revis�o de depend�ncias (`requirements.txt`)
- Backups da base e rota��o de logs sem dados sens�veis

---

## 4. Procedimento de deploy manual (servidor Linux)

Passos t�picos ap�s a VM ou servidor estar provisionado.

### 4.1 Pr�-requisitos no servidor

- Python 3.10+ (ou vers�o alinhada � equipa)
- MariaDB/MySQL client e servidor (local ou remoto)
- Git
- Opcional: nginx, certbot

### 4.2 Instala��o da aplica��o

```bash
cd /opt/prototipo-saj   # exemplo; ajustar caminho
git clone <url-do-repositorio> .
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install gunicorn    # n�o est� em requirements.txt; necess�rio para WSGI
cp .env.example .env
# Editar .env: DB_*, FLASK_SECRET_KEY, DISCADOR_*, integra��es
```

### 4.3 Base de dados

Com `DB_*` do `.env` exportadas ou lidas pelo script:

```bash
python Banco/criar_banco.py
python Banco/seed_funcionarios.py
# Opcional: python Banco/popular_relacao_operadores_saj.py
# Migra��es em bases antigas:
# mysql ... < Banco/migrate_status_aberto_fechado_para_cobranca_pago.sql
# mysql ... < Banco/migrate_ocorrencia_pago_para_total_parcial.sql
```

### 4.4 Arranque do servidor web

**Desenvolvimento / teste r�pido (n�o recomendado para equipa inteira):**

```bash
python app.py
```

**Recomendado para VM de testes (um processo, importa��o GM em mem�ria):**

```bash
gunicorn -w 1 -b 127.0.0.1:5000 app:app
```

- **`-w 1`:** jobs de importa��o em segundo plano (`_import_jobs`) vivem **s� na mem�ria desse processo**. V�rios workers Gunicorn **n�o** partilham estado de importa��o (ver `DOCUMENTACAO_PYTHON_PROJETO_SAJ.md`).
- Expor `127.0.0.1:5000` e colocar **nginx** (ou equivalente) � frente com TLS e `proxy_pass`.

Exemplo m�nimo de bloco nginx (ajustar `server_name` e certificados):

```nginx
server {
    listen 443 ssl;
    server_name prototipo-saj.interno.exemplo;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;   # �til para SSE (/api/processar, importa��o background)
    }
}
```

**Servi�o systemd (exemplo local, n�o versionado):** criar `/etc/systemd/system/prototipo-saj.service` com `WorkingDirectory`, `EnvironmentFile=/opt/prototipo-saj/.env`, `ExecStart=/opt/prototipo-saj/.venv/bin/gunicorn -w 1 -b 127.0.0.1:5000 app:app`, `Restart=on-failure`. Depois: `systemctl enable --now prototipo-saj`.

### 4.5 Atualiza��o (nova vers�o)

```bash
cd /opt/prototipo-saj
git pull
source .venv/bin/activate
pip install -r requirements.txt
# Se houver novos .sql em Banco/, aplicar na BD
sudo systemctl restart prototipo-saj   # ou reiniciar gunicorn manualmente
```

Validar: p�gina de login, `GET /api/notificacoes` (sess�o), smoke de um m�dulo cr�tico (ex. Cobran�a ou Importa��o).

---

## 5. Vari�veis de ambiente no deploy

| Vari�vel | Obrigat�rio | Uso |
|----------|-------------|-----|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Sim | Flask e scripts `Python/` / `Banco/` |
| `DB_PORT` | N�o (3306) | Porta MySQL |
| `FLASK_SECRET_KEY` | Sim em servidor partilhado | Sess�o Flask |
| `SESSION_IDLE_MAX_SEC` | N�o (3600) | Expira��o por inatividade |
| `DISCADOR_*` | Se usar discador | Proxy `/api/discar` |
| `GOOGLE_SMTP_*` | Opcional | S� lote e-mail autom�tico na **Importa��o** |
| `SERASA_CONV_*` | Opcional | Layout TXT SERASA |

Lista completa: [`.env.example`](../.env.example). **Nunca** commitar `.env` nem tokens reais.

---

## 6. Seguran�a no deploy

- Aplica��o e MariaDB **atr�s de VPN** ou rede privada; evitar `0.0.0.0:5000` exposto � internet sem proxy e TLS.
- Segredos apenas em `.env` ou cofre da equipa.
- `FLASK_SECRET_KEY` diferente por ambiente.
- N�o usar `debug=True` em VM partilhada (stack traces e recarregamento inseguros).
- Integra��es (SMS, e-mail, discador) s� no backend; o frontend chama `/api/...`.
- Logs: sem corpos completos de mensagens, senhas ou tokens.
- Pasta **`ARQUIVO GM/`**: se existir no servidor, permiss�es restritas; n�o � backup substituto da BD.

---

## 7. Comportamentos operacionais importantes

| T�pico | Comportamento |
|--------|----------------|
| Importa��o GM em background | Estado em mem�ria no processo Flask; reiniciar o servi�o **cancela** jobs em curso |
| Upload web | Ficheiros em diret�rio tempor�rio (`/api/upload`), n�o em `ARQUIVO GM/` |
| Sess�o | `SESSION_IDLE_MAX_SEC`; cliente renova com `POST /api/sessao/atividade` |
| DDL em runtime | Algumas tabelas/colunas s�o criadas na primeira utiliza��o (`app.py`); o utilizador MySQL precisa permiss�es adequadas em ambiente novo |
| Performance | Tabela `performance` repovoada por `Python/performance_sincronizar.py` (CLI), n�o no deploy autom�tico |

---

## 8. Checklist p�s-deploy

- [ ] `.env` presente no servidor, ausente do Git
- [ ] `FLASK_SECRET_KEY` definido
- [ ] `python Banco/criar_banco.py` (ou BD j� migrada)
- [ ] Login com utilizador de teste (`seed_funcionarios.py`)
- [ ] Health: p�gina inicial ou login responde
- [ ] Um fluxo cr�tico validado (importa��o, cobran�a ou relat�rio)
- [ ] Firewall/VPN revistos; porta 5000 n�o p�blica se usar nginx
- [ ] Documentar URL interna e contacto de suporte (wiki/Asana, n�o no repo com segredos)

---

## 9. Troubleshooting

| Sintoma | Verifica��o |
|---------|-------------|
| Erro de liga��o � BD | `DB_*` no `.env`; MariaDB a escutar; firewall entre app e BD |
| Discador �n�o configurado� | `DISCADOR_URL`, `DISCADOR_USUARIO`, `DISCADOR_TOKEN`; reiniciar ap�s editar `.env` (`load_dotenv(..., override=True)`) |
| Importa��o some ao refrescar job | Normal se houve restart com v�rios workers � usar **1 worker** |
| SSE/importa��o corta atr�s de proxy | `proxy_buffering off` no nginx; timeouts aumentados se necess�rio |
| Sess�o expira r�pido | `SESSION_IDLE_MAX_SEC`; cliente com `sessao_idle.js` |

---

*�ltima revis�o alinhada ao reposit�rio: deploy manual, Flask em `app.py`, sem automa��o CI/CD versionada.*
