/**
 * Logout por inatividade: aviso aos 50 min + 10 min de tolerancia.
 * Renova a sessao no servidor (POST /api/sessao/atividade) com throttle.
 */
(function () {
    var IDLE_WARN_MS = 50 * 60 * 1000;
    var GRACE_MS = 10 * 60 * 1000;
    var PING_MIN_MS = 120 * 1000;
    var CHECK_MS = 5000;

    var overlay = null;
    var elCountdown = null;
    var checkTimer = null;
    var tickTimer = null;
    var graceDeadline = null;
    var graceTimer = null;
    var modalOpen = false;
    var lastActivity = Date.now();
    var lastPing = 0;

    function $(id) {
        return document.getElementById(id);
    }

    function clearGraceTimers() {
        if (graceTimer) {
            clearTimeout(graceTimer);
            graceTimer = null;
        }
        if (tickTimer) {
            clearInterval(tickTimer);
            tickTimer = null;
        }
        graceDeadline = null;
    }

    function hideModal() {
        if (!overlay) return;
        overlay.classList.remove('sessao-idle-open');
        overlay.setAttribute('aria-hidden', 'true');
        modalOpen = false;
        clearGraceTimers();
    }

    function formatRemain(ms) {
        if (ms < 0) ms = 0;
        var totalSec = Math.ceil(ms / 1000);
        var m = Math.floor(totalSec / 60);
        var s = totalSec % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function updateCountdownLabel() {
        if (!elCountdown || !graceDeadline) return;
        elCountdown.textContent = formatRemain(graceDeadline - Date.now());
    }

    function forceLogout() {
        hideModal();
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
        if (window.__sajMarkInternalNavigationForImport) {
            window.__sajMarkInternalNavigationForImport();
        }
        window.location.href = '/logout';
    }

    function showModal() {
        if (modalOpen || !overlay) return;
        modalOpen = true;
        overlay.classList.add('sessao-idle-open');
        overlay.setAttribute('aria-hidden', 'false');
        graceDeadline = Date.now() + GRACE_MS;
        updateCountdownLabel();
        tickTimer = setInterval(updateCountdownLabel, 500);
        graceTimer = setTimeout(forceLogout, GRACE_MS);
        var btn = $('sessaoIdleBtnPresente');
        if (btn) btn.focus();
    }

    function pingServerThrottled() {
        var now = Date.now();
        if (now - lastPing < PING_MIN_MS) return;
        lastPing = now;
        fetch('/api/sessao/atividade', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        }).catch(function () {});
    }

    function onUserInteraction() {
        if (modalOpen) {
            /* Durante o aviso, so os botoes do modal renovam a sessao (requisito de seguranca). */
            return;
        }
        lastActivity = Date.now();
        pingServerThrottled();
    }

    function checkIdle() {
        var now = Date.now();
        if (modalOpen) {
            if (graceDeadline && now >= graceDeadline) {
                forceLogout();
            }
            return;
        }
        if (now - lastActivity >= IDLE_WARN_MS) {
            showModal();
        }
    }

    function onStillHere() {
        lastActivity = Date.now();
        pingServerThrottled();
        hideModal();
    }

    function onLogoutSelf() {
        hideModal();
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
        if (window.__sajMarkInternalNavigationForImport) {
            window.__sajMarkInternalNavigationForImport();
        }
        window.location.href = '/logout';
    }

    function bindDom() {
        overlay = $('sessaoIdleOverlay');
        elCountdown = $('sessaoIdleCountdown');
        if (!overlay) return;
        var btn1 = $('sessaoIdleBtnPresente');
        var btn2 = $('sessaoIdleBtnSair');
        if (btn1) btn1.addEventListener('click', onStillHere);
        if (btn2) btn2.addEventListener('click', onLogoutSelf);
    }

    var evs = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    function wireEvents() {
        evs.forEach(function (name) {
            document.addEventListener(name, onUserInteraction, { passive: true, capture: true });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        bindDom();
        lastActivity = Date.now();
        pingServerThrottled();
        checkTimer = setInterval(checkIdle, CHECK_MS);
        wireEvents();
    });
})();
