/**
 * Bolha de progresso da importacao GM em segundo plano + beforeunload.
 * Nao exibe na rota /importacao (log completo fica no modulo).
 */
(function () {
    var SS_JOB = 'saj_import_bg_job_id';
    var SS_ACTIVE = 'saj_import_bg_active';

    /**
     * beforeunload dispara em qualquer unload (navegacao interna incluida).
     * Marca navegacao same-origin para nao mostrar o aviso ao mudar de modulo.
     */
    var internalNavigation = false;

    function markInternalNavigation() {
        internalNavigation = true;
        window.setTimeout(function () {
            internalNavigation = false;
        }, 2000);
    }

    document.addEventListener(
        'click',
        function (e) {
            var t = e.target;
            if (!t || !t.closest) return;
            var a = t.closest('a[href]');
            if (!a) return;
            var href = (a.getAttribute('href') || '').trim();
            if (!href || href.startsWith('#') || href.toLowerCase().indexOf('javascript:') === 0) return;
            try {
                var u = new URL(href, window.location.href);
                if (u.origin === window.location.origin) {
                    markInternalNavigation();
                }
            } catch (err) {
                /* ignore */
            }
        },
        true,
    );

    document.addEventListener(
        'submit',
        function (e) {
            var f = e.target;
            if (!f || f.tagName !== 'FORM') return;
            var act = f.getAttribute('action');
            if (!act || act.trim() === '') {
                markInternalNavigation();
                return;
            }
            try {
                var u = new URL(act, window.location.href);
                if (u.origin === window.location.origin) {
                    markInternalNavigation();
                }
            } catch (err) {
                /* ignore */
            }
        },
        true,
    );

    function isImportPage() {
        var p = window.location.pathname || '';
        return p === '/importacao' || p.endsWith('/importacao');
    }

    var pollTimer = null;

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function ensureDom() {
        if (document.getElementById('sajImportBgRoot')) return;
        var root = document.createElement('div');
        root.id = 'sajImportBgRoot';
        root.style.display = 'none';
        root.innerHTML = ''
            + '<button type="button" id="sajImportBgBubble" title="Importacao em andamento">'
            + '<span id="sajImportBgPct">0%</span>'
            + '<span id="sajImportBgLbl">GM</span>'
            + '</button>'
            + '<div id="sajImportBgOverlay" aria-hidden="true">'
            + '<div id="sajImportBgCard" role="dialog" aria-modal="true" aria-labelledby="sajImportBgTitle">'
            + '<div id="sajImportBgCardHead">'
            + '<h3 id="sajImportBgTitle">Importacao em andamento</h3>'
            + '<button type="button" id="sajImportBgCloseX" aria-label="Fechar">&times;</button>'
            + '</div>'
            + '<div id="sajImportBgLog"></div>'
            + '<div id="sajImportBgActions">'
            + '<button type="button" id="sajImportBtnFechar">Fechar</button>'
            + '<button type="button" id="sajImportBtnIr" class="saj-ib-primary">Ir para importacao</button>'
            + '<button type="button" id="sajImportBtnCancelar" class="saj-ib-danger">Cancelar importacao</button>'
            + '</div>'
            + '</div></div>';
        document.body.appendChild(root);

        document.getElementById('sajImportBgCloseX').addEventListener('click', closePanel);
        document.getElementById('sajImportBtnFechar').addEventListener('click', closePanel);
        document.getElementById('sajImportBtnIr').addEventListener('click', function () {
            markInternalNavigation();
            window.location.href = '/importacao';
        });
        document.getElementById('sajImportBtnCancelar').addEventListener('click', onCancelClick);
        document.getElementById('sajImportBgOverlay').addEventListener('click', function (e) {
            if (e.target.id === 'sajImportBgOverlay') closePanel();
        });
        document.getElementById('sajImportBgBubble').addEventListener('click', openPanelWithSnapshot);
    }

    function closePanel() {
        var ov = document.getElementById('sajImportBgOverlay');
        if (ov) {
            ov.classList.remove('saj-ib-open');
            ov.setAttribute('aria-hidden', 'true');
        }
    }

    function levelClass(level) {
        if (level === 'alert') return 'log-alert';
        if (level === 'success') return 'log-success';
        if (level === 'update') return 'log-update';
        return 'log-info';
    }

    function renderLog(events) {
        var log = document.getElementById('sajImportBgLog');
        if (!log) return;
        log.innerHTML = '';
        (events || []).forEach(function (ev) {
            if (ev.type !== 'log') return;
            var p = document.createElement('p');
            p.className = 'log-line ' + levelClass(ev.level || 'info');
            p.textContent = '> ' + (ev.text || '');
            log.appendChild(p);
        });
        log.scrollTop = log.scrollHeight;
    }

    function openPanelWithSnapshot() {
        var root = document.getElementById('sajImportBgRoot');
        var jid = root && root.dataset.jobId;
        if (!jid) return;
        var ov = document.getElementById('sajImportBgOverlay');
        if (!ov) return;
        ov.classList.add('saj-ib-open');
        ov.setAttribute('aria-hidden', 'false');
        fetch('/api/importacao/background/' + encodeURIComponent(jid) + '/snapshot', { credentials: 'same-origin' })
            .then(function (r) { return r.json().then(function (d) { return { r: r, d: d }; }); })
            .then(function (x) {
                if (!x.r.ok) {
                    renderLog([{ type: 'log', level: 'alert', text: x.d.error || 'Falha ao carregar log.' }]);
                    return;
                }
                renderLog(x.d.events || []);
            })
            .catch(function () {
                renderLog([{ type: 'log', level: 'alert', text: 'Erro de rede ao carregar log.' }]);
            });
    }

    function onCancelClick() {
        var msg = 'Você tem certeza que quer cancelar a importação? Você irá perder todos os dados já importados até aqui!';
        if (!window.confirm(msg)) return;
        var root = document.getElementById('sajImportBgRoot');
        var jid = root && root.dataset.jobId;
        if (!jid) return;
        fetch('/api/importacao/background/' + encodeURIComponent(jid) + '/cancel', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        })
            .then(function (r) { return r.json(); })
            .then(function () {
                sessionStorage.removeItem(SS_JOB);
                sessionStorage.removeItem(SS_ACTIVE);
                stopPolling();
                hideRoot();
                closePanel();
                window.dispatchEvent(new CustomEvent('saj-import-bg-ended'));
            })
            .catch(function () {
                alert('Nao foi possivel cancelar. Tente novamente.');
            });
    }

    function hideRoot() {
        var root = document.getElementById('sajImportBgRoot');
        if (root) root.style.display = 'none';
    }

    function showRoot(jobId) {
        ensureDom();
        var root = document.getElementById('sajImportBgRoot');
        if (!root) return;
        root.dataset.jobId = jobId;
        root.style.display = 'block';
    }

    function updatePct(n) {
        var el = document.getElementById('sajImportBgPct');
        if (el) el.textContent = Math.round(n || 0) + '%';
    }

    function startPolling(jobId) {
        stopPolling();
        pollTimer = setInterval(function () {
            if (isImportPage()) return;
            fetch('/api/importacao/background/' + encodeURIComponent(jobId) + '/state', { credentials: 'same-origin' })
                .then(function (r) { return r.json().then(function (d) { return { r: r, d: d }; }); })
                .then(function (x) {
                    if (!x.r.ok) {
                        /* Nao limpar sessionStorage em erro temporario (rede, 401 momentaneo). */
                        if (x.r.status === 404) {
                            stopPolling();
                            hideRoot();
                            closePanel();
                            sessionStorage.removeItem(SS_JOB);
                            sessionStorage.removeItem(SS_ACTIVE);
                            window.dispatchEvent(new CustomEvent('saj-import-bg-ended'));
                        }
                        return;
                    }
                    updatePct(x.d.progress);
                    if (!x.d.running) {
                        stopPolling();
                        sessionStorage.removeItem(SS_JOB);
                        sessionStorage.removeItem(SS_ACTIVE);
                        hideRoot();
                        closePanel();
                        window.dispatchEvent(new CustomEvent('saj-import-bg-ended'));
                    }
                })
                .catch(function () {});
        }, 900);
    }

    function tick() {
        var jid = sessionStorage.getItem(SS_JOB);
        var act = sessionStorage.getItem(SS_ACTIVE);
        if (!jid || act !== '1') {
            stopPolling();
            hideRoot();
            closePanel();
            return;
        }
        if (isImportPage()) {
            stopPolling();
            hideRoot();
            closePanel();
            return;
        }
        showRoot(jid);
        updatePct(0);
        startPolling(jid);
    }

    window.addEventListener('saj-import-bg-started', function () {
        sessionStorage.setItem(SS_ACTIVE, '1');
        tick();
    });

    window.addEventListener('saj-import-bg-ended', function () {
        stopPolling();
        hideRoot();
        closePanel();
    });

    window.addEventListener('beforeunload', function (e) {
        if (sessionStorage.getItem(SS_ACTIVE) !== '1') {
            return;
        }
        if (internalNavigation) {
            return;
        }
        e.preventDefault();
        e.returnValue =
            'Você tem certeza que quer sair da página? Todo o registro da importação '
            + 'feito até agora será perdido. Deseja continuar com o fechamento da página?';
    });

    window.__sajMarkInternalNavigationForImport = markInternalNavigation;

    document.addEventListener('DOMContentLoaded', tick);
})();
