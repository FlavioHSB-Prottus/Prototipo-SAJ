/**
 * Destaca linha da tabela e abre o modal "Ver" quando a URL traz ?notif_id= (ex.: clique em Ir no sininho).
 */
(function () {
    function stripQueryParam(name) {
        if (!history.replaceState) return;
        try {
            var u = new URL(window.location.href);
            if (!u.searchParams.has(name)) return;
            u.searchParams.delete(name);
            var qs = u.searchParams.toString();
            history.replaceState({}, '', u.pathname + (qs ? '?' + qs : '') + u.hash);
        } catch (e) {
            /* ignore */
        }
    }

    /**
     * @param {string} tbodyId - id do tbody que contem tr[data-row-id]
     * @param {{ param?: string, autoOpenModal?: boolean }} opts
     */
    window.applyNotifDeepLink = function (tbodyId, opts) {
        opts = opts || {};
        var param = opts.param || 'notif_id';
        var params = new URLSearchParams(window.location.search);
        var nid = params.get(param);
        if (!nid) return;
        var idNum = parseInt(nid, 10);
        if (!isFinite(idNum)) return;
        var tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        var attempts = 0;
        var autoOpen = opts.autoOpenModal !== false;

        function tick() {
            var row = tbody.querySelector('tr[data-row-id="' + idNum + '"]');
            if (row) {
                row.classList.add('notif-row-highlight');
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (autoOpen) {
                    var btn = row.querySelector('.view-btn');
                    if (btn) {
                        setTimeout(function () {
                            btn.click();
                        }, 350);
                    }
                }
                stripQueryParam(param);
                return;
            }
            attempts += 1;
            if (attempts < 80) {
                setTimeout(tick, 120);
            } else {
                stripQueryParam(param);
            }
        }
        tick();
    };
})();
