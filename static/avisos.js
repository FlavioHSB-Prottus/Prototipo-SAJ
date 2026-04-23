/* ==========================================================================
 * Mural de Avisos - CRUD persistido em /api/avisos (tabela MySQL `aviso`).
 *
 * Cuida de dois lugares:
 *   - #bulletinBoardHome   (card principal na home, editavel)
 *   - #bulletinBoardHeader (dropdown do sino no header, somente leitura)
 * ========================================================================== */

(function () {
    const API = "/api/avisos";
    const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // cache local para evitar refetchs em telas que so mostram o header
    let _cache = null;

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function parseISODate(iso) {
        if (!iso) return null;
        const parts = String(iso).split("-");
        if (parts.length !== 3) return null;
        const [y, m, d] = parts.map((n) => parseInt(n, 10));
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d);
    }

    function formatarData(iso) {
        const d = parseISODate(iso);
        if (!d) return "--";
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const alvo = new Date(d);
        alvo.setHours(0, 0, 0, 0);
        const diff = Math.round((hoje - alvo) / (1000 * 60 * 60 * 24));
        if (diff === 0) return "Hoje";
        if (diff === 1) return "Ontem";
        return `${String(d.getDate()).padStart(2, "0")}/${MESES[d.getMonth()]}`;
    }

    function isRecente(iso) {
        const d = parseISODate(iso);
        if (!d) return false;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const alvo = new Date(d);
        alvo.setHours(0, 0, 0, 0);
        const diff = Math.round((hoje - alvo) / (1000 * 60 * 60 * 24));
        return diff <= 1;
    }

    async function fetchAvisos(forcarReload = false) {
        if (_cache && !forcarReload) return _cache;
        try {
            const r = await fetch(API, { cache: "no-store" });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const data = await r.json();
            _cache = Array.isArray(data) ? data : [];
        } catch (e) {
            console.warn("[avisos] erro ao carregar:", e);
            _cache = [];
        }
        return _cache;
    }

    function renderListaHome(avisos) {
        const ul = document.getElementById("bulletinBoardHome");
        if (!ul) return;
        if (!avisos.length) {
            ul.innerHTML = `
                <li class="bulletin-empty">
                    <i class="fa-regular fa-face-smile"></i>
                    Nenhum aviso no momento. Clique em "Novo" para adicionar.
                </li>`;
            return;
        }
        ul.innerHTML = avisos
            .map((a) => {
                const novo = isRecente(a.data_iso);
                return `
                <li class="bulletin-item ${novo ? "new" : ""}" data-id="${a.id}">
                    <span class="bulletin-date">${escapeHtml(formatarData(a.data_iso))}</span>
                    <div class="bulletin-content">
                        <h4>${escapeHtml(a.titulo)}</h4>
                        <p>${escapeHtml(a.descricao || "")}</p>
                    </div>
                    <div class="bulletin-actions">
                        <button type="button" class="bulletin-action edit" title="Editar"
                                data-act="edit" data-id="${a.id}">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="bulletin-action delete" title="Excluir"
                                data-act="del" data-id="${a.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </li>`;
            })
            .join("");
    }

    function renderListaHeader(avisos) {
        const ul = document.getElementById("bulletinBoardHeader");
        if (!ul) return;
        const recent = avisos.slice(0, 5);
        if (!recent.length) {
            ul.innerHTML = `<li class="bulletin-empty">Nenhum aviso.</li>`;
        } else {
            ul.innerHTML = recent
                .map(
                    (a) => `
                <li class="bulletin-item ${isRecente(a.data_iso) ? "new" : ""}">
                    <div class="bulletin-content">
                        <h4>${escapeHtml(a.titulo)}</h4>
                        <p>${escapeHtml(a.descricao || "")}</p>
                    </div>
                </li>`,
                )
                .join("");
        }
        const badge = document.getElementById("notificationBadge");
        if (badge) {
            const novos = avisos.filter((a) => isRecente(a.data_iso)).length;
            if (novos > 0) {
                badge.textContent = String(novos);
                badge.style.display = "";
            } else {
                badge.style.display = "none";
            }
        }
    }

    async function atualizarTodosOsLugares(forcarReload = true) {
        const avisos = await fetchAvisos(forcarReload);
        renderListaHome(avisos);
        renderListaHeader(avisos);
    }

    /* ------------------------------------------------------------------- *
     * Modal de criacao/edicao (somente presente na home)
     * ------------------------------------------------------------------- */
    function bindFormulario() {
        const overlay = document.getElementById("avisoOverlay");
        const form = document.getElementById("avisoForm");
        const btnNovo = document.getElementById("btnNovoAviso");
        if (!overlay || !form || !btnNovo) return;

        const title = document.getElementById("avisoModalTitle");
        const idInput = document.getElementById("avisoId");
        const tituloInput = document.getElementById("avisoTitulo");
        const dataInput = document.getElementById("avisoData");
        const descInput = document.getElementById("avisoDescricao");
        const submitLabel = overlay.querySelector(".aviso-submit-label");

        function abrir(aviso) {
            if (aviso) {
                title.textContent = "Editar aviso";
                submitLabel.textContent = "Salvar alterações";
                idInput.value = aviso.id;
                tituloInput.value = aviso.titulo || "";
                dataInput.value = aviso.data_iso || "";
                descInput.value = aviso.descricao || "";
            } else {
                title.textContent = "Novo aviso";
                submitLabel.textContent = "Salvar";
                form.reset();
                idInput.value = "";
                const hoje = new Date();
                dataInput.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
            }
            overlay.classList.add("show");
            setTimeout(() => tituloInput.focus(), 80);
        }

        function fechar() {
            overlay.classList.remove("show");
        }

        btnNovo.addEventListener("click", () => abrir(null));
        overlay.querySelectorAll("[data-close-aviso]").forEach((b) =>
            b.addEventListener("click", fechar),
        );
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) fechar();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && overlay.classList.contains("show")) fechar();
        });

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = idInput.value;
            const payload = {
                titulo: tituloInput.value.trim(),
                descricao: descInput.value.trim(),
                data_iso: dataInput.value,
            };
            if (!payload.titulo) {
                alert("Informe um título para o aviso.");
                return;
            }
            if (!payload.data_iso) {
                alert("Informe a data do aviso.");
                return;
            }
            try {
                const url = id ? `${API}/${id}` : API;
                const method = id ? "PUT" : "POST";
                const r = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.error || "HTTP " + r.status);
                }
                fechar();
                await atualizarTodosOsLugares(true);
            } catch (err) {
                console.error(err);
                alert("Falha ao salvar o aviso: " + err.message);
            }
        });

        // expoe para a lista chamar o modo edicao
        window.__avisosAbrirEdicao = (aviso) => abrir(aviso);
    }

    /* ------------------------------------------------------------------- *
     * Modal de confirmacao de exclusao
     * ------------------------------------------------------------------- */
    function bindConfirmacao() {
        const overlay = document.getElementById("avisoConfirmOverlay");
        if (!overlay) return;
        const btnConf = document.getElementById("btnConfirmarExclusao");
        let _alvoId = null;

        function abrir(id) {
            _alvoId = id;
            overlay.classList.add("show");
        }
        function fechar() {
            _alvoId = null;
            overlay.classList.remove("show");
        }

        overlay.querySelectorAll("[data-close-confirm]").forEach((b) =>
            b.addEventListener("click", fechar),
        );
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) fechar();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && overlay.classList.contains("show")) fechar();
        });

        btnConf.addEventListener("click", async () => {
            if (!_alvoId) return;
            try {
                const r = await fetch(`${API}/${_alvoId}`, { method: "DELETE" });
                if (!r.ok) {
                    const err = await r.json().catch(() => ({}));
                    throw new Error(err.error || "HTTP " + r.status);
                }
                fechar();
                await atualizarTodosOsLugares(true);
            } catch (err) {
                console.error(err);
                alert("Falha ao excluir: " + err.message);
            }
        });

        window.__avisosConfirmarExclusao = (id) => abrir(id);
    }

    /* ------------------------------------------------------------------- *
     * Delegacao de clique na lista (editar / excluir)
     * ------------------------------------------------------------------- */
    function bindListaHome() {
        const ul = document.getElementById("bulletinBoardHome");
        if (!ul) return;
        ul.addEventListener("click", async (e) => {
            const btn = e.target.closest(".bulletin-action");
            if (!btn) return;
            const id = parseInt(btn.getAttribute("data-id"), 10);
            const act = btn.getAttribute("data-act");
            const avisos = await fetchAvisos(false);
            const aviso = avisos.find((a) => a.id === id);
            if (!aviso) return;
            if (act === "edit") {
                if (window.__avisosAbrirEdicao) window.__avisosAbrirEdicao(aviso);
            } else if (act === "del") {
                if (window.__avisosConfirmarExclusao) window.__avisosConfirmarExclusao(id);
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        bindFormulario();
        bindConfirmacao();
        bindListaHome();
        atualizarTodosOsLugares(true);
    });
})();
