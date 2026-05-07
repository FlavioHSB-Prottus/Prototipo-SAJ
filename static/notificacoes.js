/* ==========================================================================
 * Notificacoes do header: mural (aviso) + agenda do operador.
 * Botoes Lido / Ir; modal "Todas notificacoes" via GET /api/notificacoes/todas.
 * ========================================================================== */

(function () {
    const API = "/api/notificacoes";
    const API_TODAS = "/api/notificacoes/todas";
    const API_LIDA = "/api/notificacoes/lida";

    /**
     * Textos do usuario via escapes \\uXXXX � assim o browser interpreta certo
     * mesmo se o static/notificacoes.js for lido/servido sem UTF-8.
     * (\u00e7=c \u00e3=a \u00f5=o \u00ed=i)
     */
    const TXT = {
        nenhumaNotifPendente: "Nenhuma notifica\u00e7\u00e3o pendente.",
        entreParaVerNotif: "Entre para ver notifica\u00e7\u00f5es.",
        naoPossivelCarregar: "N\u00e3o foi poss\u00edvel carregar.",
        naoPossivelCarregarLista: "N\u00e3o foi poss\u00edvel carregar a lista.",
        naoPossivelMarcarLida: "N\u00e3o foi poss\u00edvel marcar como lida: ",
    };

    /** API pode enviar lida como boolean, numero ou string ("0"/"1") apos _serialize. */
    function notificacaoJaLida(v) {
        return v === true || v === 1 || v === "1";
    }

    function escapeHtml(s) {
        return String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /** Tipos aceitos pelo POST /api/notificacoes/lida e pelo dropdown. */
    function normalizeNotifTipo(t) {
        const x = String(t || "").toLowerCase();
        if (x === "agenda") return "agenda";
        if (x === "mensagem") return "mensagem";
        if (x === "solicitacao") return "solicitacao";
        if (x === "protocolo") return "protocolo";
        return "aviso";
    }

    function irPara(tipo, refId) {
        const id = encodeURIComponent(String(refId));
        if (tipo === "agenda") {
            window.location.href = "/agenda?notif_id=" + id;
            return;
        }
        if (tipo === "mensagem") {
            window.location.href = "/mensagem?notif_id=" + id;
            return;
        }
        if (tipo === "solicitacao") {
            window.location.href = "/solicitacao?notif_id=" + id;
            return;
        }
        if (tipo === "protocolo") {
            window.location.href = "/protocolo?notif_id=" + id;
            return;
        }
        window.location.href = "/home#mural-avisos";
    }

    function updateBadge(count) {
        const badge = document.getElementById("notificationBadge");
        if (!badge) return;
        const n = Math.max(0, parseInt(count, 10) || 0);
        if (n > 0) {
            badge.textContent = n > 99 ? "99+" : String(n);
            badge.style.display = "flex";
            badge.style.opacity = "1";
        } else {
            badge.style.display = "none";
        }
    }

    function botoesHtml(tipo, refId) {
        const t = normalizeNotifTipo(tipo);
        const r = parseInt(refId, 10);
        if (!Number.isFinite(r)) return "";
        return `
            <div class="notif-actions">
                <button type="button" class="notif-btn notif-btn-lido" data-act="lido" data-tipo="${t}" data-ref-id="${r}">Lido</button>
                <button type="button" class="notif-btn notif-btn-ir" data-act="ir" data-tipo="${t}" data-ref-id="${r}">Ir</button>
            </div>`;
    }

    /** Modal "Todas as notificacoes": so mostra "Lido" se ainda nao foi lida. */
    function botoesModalHtml(tipo, refId, jaLida) {
        const t = normalizeNotifTipo(tipo);
        const r = parseInt(refId, 10);
        if (!Number.isFinite(r)) return "";
        const btnLido = jaLida
            ? ""
            : `<button type="button" class="notif-btn notif-btn-lido" data-act="lido" data-tipo="${t}" data-ref-id="${r}">Lido</button>`;
        const wrapCls =
            "notif-actions notif-actions-modal" + (jaLida ? " notif-actions-modal-so-ir" : "");
        return `
            <div class="${wrapCls}">
                ${btnLido}
                <button type="button" class="notif-btn notif-btn-ir" data-act="ir" data-tipo="${t}" data-ref-id="${r}">Ir</button>
            </div>`;
    }

    function renderDropdownItem(it) {
        const tipo = normalizeNotifTipo(it.tipo);
        const refId = parseInt(it.ref_id, 10);
        if (!Number.isFinite(refId)) return "";
        const pri =
            tipo === "agenda" && it.prioridade
                ? `<span class="notif-prio">${escapeHtml(it.prioridade)}</span>`
                : "";
        return `
            <li class="bulletin-item notif-item-row" data-tipo="${tipo}" data-ref-id="${refId}">
                <div class="bulletin-content">
                    <div class="notif-meta">${escapeHtml(it.subtitulo || "")}${pri}</div>
                    <h4>${escapeHtml(it.titulo)}</h4>
                    <p>${escapeHtml(it.descricao || "")}</p>
                    ${botoesHtml(tipo, refId)}
                </div>
            </li>`;
    }

    function renderModalItem(it) {
        const tipo = normalizeNotifTipo(it.tipo);
        const refId = parseInt(it.ref_id, 10);
        if (!Number.isFinite(refId)) return "";
        const jaLida = notificacaoJaLida(it.lida);
        const lidaclass = jaLida ? "notif-row-lida" : "notif-row-nao-lida";
        const pri =
            tipo === "agenda" && it.prioridade
                ? `<span class="notif-prio">${escapeHtml(it.prioridade)}</span>`
                : "";
        const selo = jaLida
            ? '<span class="notif-selo notif-selo-lida">Lido</span>'
            : '<span class="notif-selo notif-selo-novo">Novo</span>';
        return `
            <div class="notif-modal-row ${lidaclass}" data-tipo="${tipo}" data-ref-id="${refId}">
                <div class="notif-modal-row-head">
                    <span class="notif-modal-sub">${escapeHtml(it.subtitulo || "")}</span>
                    ${selo}${pri}
                </div>
                <strong>${escapeHtml(it.titulo)}</strong>
                <p>${escapeHtml(it.descricao || "")}</p>
                ${botoesModalHtml(tipo, refId, jaLida)}
            </div>`;
    }

    async function marcarLida(tipo, refId) {
        const r = await fetch(API_LIDA, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify({ tipo, ref_id: refId }),
        });
        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            throw new Error(err.error || "HTTP " + r.status);
        }
    }

    async function carregarDropdown() {
        const ul = document.getElementById("bulletinBoardHeader");
        try {
            const r = await fetch(API, { cache: "no-store", credentials: "same-origin" });
            if (r.status === 401) {
                updateBadge(0);
                if (ul) {
                    ul.innerHTML =
                        '<li class="bulletin-empty"><i class="fa-regular fa-user"></i> ' +
                        TXT.entreParaVerNotif +
                        "</li>";
                }
                return;
            }
            if (!r.ok) throw new Error("HTTP " + r.status);
            const data = await r.json();
            const items = Array.isArray(data.items) ? data.items : [];
            updateBadge(data.unread_count != null ? data.unread_count : items.length);
            if (!ul) return;
            if (!items.length) {
                ul.innerHTML =
                    '<li class="bulletin-empty"><i class="fa-regular fa-bell-slash"></i> ' +
                    TXT.nenhumaNotifPendente +
                    "</li>";
                return;
            }
            ul.innerHTML = items.map(renderDropdownItem).join("");
        } catch (e) {
            console.warn("[notificacoes]", e);
            updateBadge(0);
            if (ul) {
                ul.innerHTML =
                    '<li class="bulletin-empty"><i class="fa-regular fa-circle-xmark"></i> ' +
                    TXT.naoPossivelCarregar +
                    "</li>";
            }
        }
    }

    async function carregarModalBody() {
        const body = document.getElementById("notificacoesTodasBody");
        if (!body) return;
        body.innerHTML = '<p class="notificacoes-todas-loading">Carregando...</p>';
        try {
            const r = await fetch(API_TODAS, { cache: "no-store", credentials: "same-origin" });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const data = await r.json();
            const items = Array.isArray(data.items) ? data.items : [];
            if (!items.length) {
                body.innerHTML = '<p class="notificacoes-todas-empty">Nenhum registro.</p>';
                return;
            }
            body.innerHTML = items.map(renderModalItem).join("");
        } catch (e) {
            console.warn("[notificacoes todas]", e);
            body.innerHTML =
                '<p class="notificacoes-todas-empty">' + TXT.naoPossivelCarregarLista + "</p>";
        }
    }

    function fecharModalTodas() {
        const ov = document.getElementById("notificacoesTodasOverlay");
        if (ov) {
            ov.classList.remove("show");
            ov.setAttribute("aria-hidden", "true");
        }
    }

    function abrirModalTodas() {
        const ov = document.getElementById("notificacoesTodasOverlay");
        if (!ov) return;
        ov.classList.add("show");
        ov.setAttribute("aria-hidden", "false");
        carregarModalBody();
    }

    async function onClickAcao(ev) {
        const btn = ev.target.closest(".notif-btn");
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        const act = btn.getAttribute("data-act");
        const tipo = btn.getAttribute("data-tipo");
        const refId = parseInt(btn.getAttribute("data-ref-id"), 10);
        if (!act || !tipo || !Number.isFinite(refId)) return;

        if (act === "ir") {
            const modulosComLida = ["mensagem", "solicitacao", "protocolo"];
            const tnorm = normalizeNotifTipo(tipo);
            if (modulosComLida.includes(tnorm)) {
                marcarLida(tnorm, refId)
                    .catch(() => {})
                    .finally(() => irPara(tnorm, refId));
                return;
            }
            irPara(tnorm, refId);
            return;
        }
        if (act === "lido") {
            try {
                btn.disabled = true;
                await marcarLida(tipo, refId);
                await carregarDropdown();
                const modalOpen = document.getElementById("notificacoesTodasOverlay");
                if (modalOpen && modalOpen.classList.contains("show")) {
                    await carregarModalBody();
                }
            } catch (err) {
                alert(TXT.naoPossivelMarcarLida + err.message);
            } finally {
                btn.disabled = false;
            }
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const ul = document.getElementById("bulletinBoardHeader");
        if (ul) {
            ul.addEventListener("click", onClickAcao);
        }
        const modalBody = document.getElementById("notificacoesTodasBody");
        if (modalBody) {
            modalBody.addEventListener("click", onClickAcao);
        }

        const btnTodas = document.getElementById("btnAbrirTodasNotificacoes");
        if (btnTodas) {
            btnTodas.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                abrirModalTodas();
            });
        }

        const btnFechar = document.getElementById("notificacoesTodasClose");
        const overlay = document.getElementById("notificacoesTodasOverlay");
        if (btnFechar) {
            btnFechar.addEventListener("click", (e) => {
                e.preventDefault();
                fecharModalTodas();
            });
        }
        if (overlay) {
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay) fecharModalTodas();
            });
        }

        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;
            const ov = document.getElementById("notificacoesTodasOverlay");
            if (ov && ov.classList.contains("show")) fecharModalTodas();
        });

        carregarDropdown();
        setInterval(carregarDropdown, 60000);
        window.__notificacoesRecarregar = carregarDropdown;
    });
})();
