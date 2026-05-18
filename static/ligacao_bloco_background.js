/**
 * Bolha e painel da sequencia de ligacoes em bloco (Cobranca).
 */
(function () {
    'use strict';

    var SS_JOB = 'saj_ligacao_bg_job_id';
    var SS_ACTIVE = 'saj_ligacao_bg_active';

    var pollTimer = null;
    var lastState = null;

    function esc(s) {
        if (s === null || s === undefined) return '';
        var div = document.createElement('div');
        div.textContent = String(s);
        return div.innerHTML;
    }

    function fmtCpf(v) {
        if (!v) return '\u2014';
        var s = String(v).replace(/\D/g, '');
        if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return v;
    }

    function fmtTel(v) {
        if (!v) return '';
        var s = String(v).replace(/\D/g, '');
        if (s.length === 11) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 7) + '-' + s.slice(7);
        if (s.length === 10) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 6) + '-' + s.slice(6);
        return v;
    }

    function fmtDateTime(v) {
        if (!v) return '\u2014';
        try {
            var d = new Date(v);
            if (!isNaN(d.getTime())) return d.toLocaleString('pt-BR');
        } catch (e) { /* ignore */ }
        return String(v);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function ensureDom() {
        if (document.getElementById('sajLigBgRoot')) return;
        var root = document.createElement('div');
        root.id = 'sajLigBgRoot';
        root.style.display = 'none';
        root.innerHTML =
            '<button type="button" id="sajLigBgBubble" title="Ligacoes em andamento">' +
            '<span id="sajLigBgCount">0/0</span><span id="sajLigBgLbl">Ligar</span></button>' +
            '<div id="sajLigBgOverlay" aria-hidden="true">' +
            '<div id="sajLigBgCard" role="dialog" aria-modal="true">' +
            '<div id="sajLigBgCardHead"><h3 id="sajLigBgTitle">Ligar</h3>' +
            '<button type="button" id="sajLigBgCloseX" aria-label="Fechar">&times;</button></div>' +
            '<div id="sajLigBgBody"></div><div id="sajLigBgActions"></div></div></div>';
        root.innerHTML = root.innerHTML.split('motion').join('div');
        document.body.appendChild(root);
        document.getElementById('sajLigBgCloseX').addEventListener('click', closePanel);
        document.getElementById('sajLigBgBubble').addEventListener('click', openPanel);
        document.getElementById('sajLigBgOverlay').addEventListener('click', function (e) {
            if (e.target.id === 'sajLigBgOverlay') closePanel();
        });
    }

    function showBubble(show) {
        var root = document.getElementById('sajLigBgRoot');
        if (root) root.style.display = show ? 'block' : 'none';
    }

    function openPanel() {
        ensureDom();
        var ov = document.getElementById('sajLigBgOverlay');
        if (ov) ov.classList.add('saj-lig-open');
        renderPanel(lastState);
        fetchState(false);
    }

    function closePanel() {
        var ov = document.getElementById('sajLigBgOverlay');
        if (ov) ov.classList.remove('saj-lig-open');
    }

    function updateBubble(st) {
        ensureDom();
        var bubble = document.getElementById('sajLigBgBubble');
        var countEl = document.getElementById('sajLigBgCount');
        var lbl = document.getElementById('sajLigBgLbl');
        if (!st || st.phase === 'completed' || st.phase === 'cancelled') {
            showBubble(false);
            return;
        }
        showBubble(true);
        var pos = st.posicao || 0;
        var total = st.total || 0;
        if (countEl) countEl.textContent = pos + '/' + total;
        if (lbl) lbl.textContent = st.nivel_label || 'Ligar';
        if (bubble) bubble.classList.toggle('saj-lig-dialing', st.phase === 'dialing' || st.running);
    }

    function renderSummary(cur) {
        if (!cur) return '<p>Nenhuma ligacao ativa.</p>';
        var telExtra = '';
        if (cur.telefones_no_contrato > 1) {
            telExtra = ' <span style="color:#64748b">(' + cur.telefone_indice + ' de ' +
                cur.telefones_no_contrato + ')</span>';
        }
        return (
            '<div class="saj-lig-summary">' +
            '<h4>' + esc(cur.nome_devedor || '\u2014') + '</h4>' +
            '<div class="saj-lig-row"><strong>Grupo/Cota:</strong> ' + esc(cur.grupo || '\u2014') +
            ' / ' + esc(cur.cota || '\u2014') + '</div>' +
            '<div class="saj-lig-row"><strong>Contrato:</strong> ' + esc(cur.numero_contrato || '\u2014') + '</div>' +
            '<div class="saj-lig-row"><strong>CPF/CNPJ:</strong> ' + esc(fmtCpf(cur.cpf_cnpj)) + '</div>' +
            '<div class="saj-lig-row"><strong>Telefone:</strong> ' + esc(fmtTel(cur.numero)) + telExtra + '</div>' +
            '<div class="saj-lig-row"><strong>Atraso:</strong> ' + esc(String(cur.dias_atraso || 0)) + ' dias</div>' +
            '<div class="saj-lig-row"><strong>Operador:</strong> ' + esc(cur.nome_funcionario || '\u2014') + '</div>' +
            '</div>'
        );
    }

    function renderPanel(st) {
        ensureDom();
        if (!st) return;
        var title = document.getElementById('sajLigBgTitle');
        if (title) title.textContent = 'Ligar \u2014 bloco ' + (st.nivel_label || st.nivel || '');
        var body = document.getElementById('sajLigBgBody');
        var actions = document.getElementById('sajLigBgActions');
        if (!body || !actions) return;

        var cur = st.current;
        var statusCls = 'saj-lig-status';
        if (st.last_dial && !st.last_dial.ok) statusCls += ' saj-lig-err';

        var html = renderSummary(cur);
        html = html.split('motion').join('div');
        html += '<p class="' + statusCls + '">' + esc(st.status_text || '') + '</p>';
        if (st.phase === 'dialing' || st.running) {
            html += '<p class="saj-lig-status"><i class="fa-solid fa-spinner fa-spin"></i> Discando...</p>';
        }
        html += '<div id="sajLigBgTramitMount" style="display:none"></div>';
        html = html.split('motion').join('div');
        body.innerHTML = html;

        actions.innerHTML = '';
        var btnFechar = document.createElement('button');
        btnFechar.type = 'button';
        btnFechar.textContent = 'Fechar';
        btnFechar.addEventListener('click', closePanel);
        actions.appendChild(btnFechar);

        if (st.phase === 'completed' || st.phase === 'cancelled') {
            var btnOk = document.createElement('button');
            btnOk.type = 'button';
            btnOk.className = 'saj-lig-btn-primary';
            btnOk.textContent = 'Concluir';
            btnOk.addEventListener('click', function () {
                closePanel();
                endJob();
            });
            actions.appendChild(btnOk);
            return;
        }

        var btnTramit = document.createElement('button');
        btnTramit.type = 'button';
        btnTramit.className = 'saj-lig-btn-primary';
        btnTramit.innerHTML = '<i class="fa-solid fa-comments"></i> Registrar Tramita\u00e7\u00e3o';
        btnTramit.disabled = st.phase !== 'awaiting_tramitacao';
        btnTramit.addEventListener('click', function () {
            openTramitacaoWizard(cur);
        });
        actions.appendChild(btnTramit);

        var btnProx = document.createElement('button');
        btnProx.type = 'button';
        btnProx.className = 'saj-lig-btn-primary';
        btnProx.innerHTML = '<i class="fa-solid fa-phone-volume"></i> Ligar para Pr\u00f3ximo';
        btnProx.disabled = !st.tramitacao_ok || st.phase !== 'awaiting_continue' || st.running;
        btnProx.addEventListener('click', postProximo);
        actions.appendChild(btnProx);

        if (st.phase === 'awaiting_continue' && st.tramitacao_ok) {
            var box = document.createElement('div');
            box.className = 'saj-lig-continue-box';
            box.innerHTML = '<p>Deseja seguir para a pr\u00f3xima liga\u00e7\u00e3o?</p>';
            var btnSim = document.createElement('button');
            btnSim.type = 'button';
            btnSim.className = 'saj-lig-btn-primary';
            btnSim.textContent = 'Sim, pr\u00f3xima liga\u00e7\u00e3o';
            btnSim.addEventListener('click', postProximo);
            var btnNao = document.createElement('button');
            btnNao.type = 'button';
            btnNao.className = 'saj-lig-btn-danger';
            btnNao.textContent = 'Cancelar a sequ\u00eancia';
            btnNao.addEventListener('click', postCancel);
            box.appendChild(btnSim);
            box.appendChild(document.createTextNode(' '));
            box.appendChild(btnNao);
            body.appendChild(box);
        }
    }

    function openTramitacaoWizard(cur) {
        if (!cur || !cur.contrato_id) return;
        var mount = document.getElementById('sajLigBgTramitMount');
        if (!mount || !window.TramitacoesDetalhe) {
            alert('Modulo de tramitacao nao disponivel.');
            return;
        }
        mount.style.display = 'block';
        var cid = cur.contrato_id;
        var opts = { esc: esc, formatDateTime: fmtDateTime };
        mount.innerHTML = window.TramitacoesDetalhe.buildSection([], cid, opts);
        window.TramitacoesDetalhe.attachModal(mount, cid, {
            esc: esc,
            formatDateTime: fmtDateTime,
            onReload: postTramitacaoOk,
        });
        var btnNova = mount.querySelector('.btn-tramit-nova');
        if (btnNova) btnNova.click();
    }

    function jobId() {
        return sessionStorage.getItem(SS_JOB);
    }

    function fetchState(autoOpen) {
        var jid = jobId();
        if (!jid) return;
        fetch('/api/cobranca/ligacao-bloco/' + encodeURIComponent(jid) + '/state', {
            credentials: 'same-origin',
        })
            .then(function (r) {
                return r.json().then(function (j) {
                    return { ok: r.ok, j: j };
                });
            })
            .then(function (res) {
                if (!res.ok || res.j.error) {
                    if (res.j && res.j.error === 'Sequencia nao encontrada.') endJob();
                    return;
                }
                lastState = res.j;
                updateBubble(lastState);
                if (autoOpen && lastState.phase === 'awaiting_tramitacao') {
                    var ov = document.getElementById('sajLigBgOverlay');
                    if (!ov || !ov.classList.contains('saj-lig-open')) openPanel();
                }
                var ov = document.getElementById('sajLigBgOverlay');
                if (ov && ov.classList.contains('saj-lig-open')) renderPanel(lastState);
                if (lastState.phase === 'completed' || lastState.phase === 'cancelled') {
                    stopPolling();
                    sessionStorage.setItem(SS_ACTIVE, '0');
                }
            })
            .catch(function () { /* ignore */ });
    }

    function startPolling() {
        stopPolling();
        pollTimer = setInterval(function () {
            fetchState(true);
        }, 900);
    }

    function postTramitacaoOk() {
        var jid = jobId();
        if (!jid) return;
        fetch('/api/cobranca/ligacao-bloco/' + encodeURIComponent(jid) + '/tramitacao-ok', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(function (r) {
                return r.json().then(function (j) {
                    return { ok: r.ok, j: j };
                });
            })
            .then(function (res) {
                if (!res.ok) {
                    alert((res.j && res.j.error) || 'Nao foi possivel registrar.');
                    return;
                }
                lastState = res.j;
                updateBubble(lastState);
                renderPanel(lastState);
            });
    }

    function postProximo() {
        var jid = jobId();
        if (!jid) return;
        fetch('/api/cobranca/ligacao-bloco/' + encodeURIComponent(jid) + '/proximo', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
        })
            .then(function (r) {
                return r.json().then(function (j) {
                    return { ok: r.ok, j: j };
                });
            })
            .then(function (res) {
                if (!res.ok) {
                    alert((res.j && res.j.error) || 'Nao foi possivel avancar.');
                    return;
                }
                lastState = res.j;
                updateBubble(lastState);
                renderPanel(lastState);
                if (lastState.completed) {
                    stopPolling();
                    sessionStorage.setItem(SS_ACTIVE, '0');
                }
            });
    }

    function postCancel() {
        if (!confirm('Cancelar a sequencia de ligacoes?')) return;
        var jid = jobId();
        if (!jid) return;
        fetch('/api/cobranca/ligacao-bloco/' + encodeURIComponent(jid) + '/cancel', {
            method: 'POST',
            credentials: 'same-origin',
        }).then(function () {
            endJob();
            closePanel();
        });
    }

    function endJob() {
        stopPolling();
        sessionStorage.removeItem(SS_JOB);
        sessionStorage.setItem(SS_ACTIVE, '0');
        lastState = null;
        showBubble(false);
    }

    function onJobStarted(data) {
        ensureDom();
        if (!data || !data.job_id) return;
        sessionStorage.setItem(SS_JOB, data.job_id);
        sessionStorage.setItem(SS_ACTIVE, '1');
        lastState = data;
        updateBubble(data);
        startPolling();
        openPanel();
    }

    function resumeIfAny() {
        if (sessionStorage.getItem(SS_ACTIVE) !== '1') return;
        if (!jobId()) return;
        ensureDom();
        startPolling();
        fetchState(false);
    }

    window.SajLigacaoBloco = { onJobStarted: onJobStarted };

    document.addEventListener('DOMContentLoaded', resumeIfAny);
})();
