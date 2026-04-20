/* ===========================================================================
 * Cobrança - Automações em lote (SMS / E-mail / Ligação)
 * ---------------------------------------------------------------------------
 * Exposto via window.CobrancaAutomacoes para ser acionado pelo cobranca.js,
 * tanto no painel analítico quanto no Kanban.
 *
 * Fluxos:
 *   - SMS / E-mail: confirmação -> POST único com todos os IDs do bloco.
 *   - Ligação:     confirmação -> sequência contrato a contrato. Após cada
 *                  ligação o usuário decide "Próxima", "Pular" ou "Encerrar".
 *
 * O backend (/api/automacao/<tipo>) é por enquanto um mock - quando o Flávio
 * publicar a API real, basta substituir o TODO em app.py.
 * =========================================================================== */
(function () {
    'use strict';

    // ---- Metadados visuais por tipo ------------------------------------------------
    var TIPO_META = {
        ligacao: {
            label: 'Ligação',
            verbo: 'iniciar as ligações',
            verboCurto: 'Ligar',
            icone: 'fa-solid fa-phone',
            cor: '#10b981',
            bgIcone: 'rgba(16,185,129,0.12)'
        },
        sms: {
            label: 'SMS',
            verbo: 'enviar os SMS',
            verboCurto: 'Enviar SMS',
            icone: 'fa-solid fa-comment-sms',
            cor: '#8b5cf6',
            bgIcone: 'rgba(139,92,246,0.12)'
        },
        email: {
            label: 'E-mail',
            verbo: 'enviar os e-mails',
            verboCurto: 'Enviar e-mail',
            icone: 'fa-solid fa-envelope',
            cor: '#f59e0b',
            bgIcone: 'rgba(245,158,11,0.15)'
        }
    };

    var NIVEL_LABEL = {
        critico: 'Crítico',
        atencao: 'Atenção',
        recente: 'Recente'
    };

    // ---- DOM cache (carregado on demand) -------------------------------------------
    var $ = function (sel) { return document.querySelector(sel); };

    function dom() {
        return {
            confirmOverlay: $('#autoConfirmOverlay'),
            confirmTitle:   $('#autoConfirmTitle'),
            confirmIcon:    $('#autoConfirmIcon'),
            confirmBody:    $('#autoConfirmBody'),
            confirmGo:      $('#autoConfirmGo'),
            confirmGoLabel: $('.auto-confirm-go-label'),
            statusOverlay:  $('#autoStatusOverlay'),
            statusTitle:    $('#autoStatusTitle'),
            statusIcon:     $('#autoStatusIcon'),
            statusBody:     $('#autoStatusBody'),
            statusFooter:   $('#autoStatusFooter'),
            statusCloseX:   $('#autoStatusCloseX')
        };
    }

    // ---- Helpers -------------------------------------------------------------------
    function esc(val) {
        if (val === null || val === undefined) return '';
        var div = document.createElement('div');
        div.textContent = String(val);
        return div.innerHTML;
    }

    function fmtCpf(v) {
        if (!v) return '';
        var s = String(v).replace(/\D/g, '');
        if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        return v;
    }

    function fmtTelefone(v) {
        if (!v) return '';
        var s = String(v).replace(/\D/g, '');
        if (s.length === 11) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 7) + '-' + s.slice(7);
        if (s.length === 10) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 6) + '-' + s.slice(6);
        return v;
    }

    function setIcon(el, iconClass, color, bg) {
        if (!el) return;
        el.innerHTML = '<i class="' + iconClass + '"></i>';
        el.style.color = color || '';
        el.style.background = bg || '';
    }

    function abrir(overlay) {
        if (!overlay) return;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function fechar(overlay) {
        if (!overlay) return;
        overlay.classList.remove('active');
        // só libera scroll se nenhum modal continua aberto
        if (!document.querySelector('.auto-overlay.active') &&
            !document.querySelector('.modal-overlay.active')) {
            document.body.style.overflow = '';
        }
    }

    // ---- Estado da ligação sequencial ---------------------------------------------
    var seqState = null;

    // ---- API pública --------------------------------------------------------------
    var Auto = {
        /** Disparado pelo botão "Ligar/SMS/E-mail" do cabeçalho de cada bloco. */
        iniciar: function (tipo, nivel, contratos) {
            if (!TIPO_META[tipo]) {
                console.warn('[automacao] tipo desconhecido:', tipo);
                return;
            }
            contratos = (contratos || []).filter(Boolean);
            if (contratos.length === 0) {
                alert('Não há contratos neste bloco para ' + TIPO_META[tipo].verboCurto.toLowerCase() + '.');
                return;
            }
            mostrarConfirmacao(tipo, nivel, contratos);
        }
    };

    // ---- Modal de confirmação ------------------------------------------------------
    function mostrarConfirmacao(tipo, nivel, contratos) {
        var d = dom();
        var meta = TIPO_META[tipo];
        var nivelLabel = NIVEL_LABEL[nivel] || nivel;

        setIcon(d.confirmIcon, meta.icone, meta.cor, meta.bgIcone);
        d.confirmTitle.textContent = meta.verboCurto + ' - bloco ' + nivelLabel;
        d.confirmGoLabel.textContent = tipo === 'ligacao'
            ? 'Iniciar ligações sequenciais'
            : 'Confirmar e disparar';
        d.confirmGo.style.background = meta.cor;
        d.confirmGo.style.borderColor = meta.cor;

        var detalhe = tipo === 'ligacao'
            ? ('As ligações serão feitas <strong>uma a uma</strong>, na ordem da lista. ' +
               'Após cada chamada o sistema perguntará se deseja seguir para a próxima.')
            : ('Será disparado <strong>1 ' + meta.label.toLowerCase() + '</strong> para ' +
               '<strong>cada um</strong> dos contratos do bloco selecionado.');

        d.confirmBody.innerHTML =
            '<div class="auto-info-row">' +
            '  <span class="auto-info-label">Tipo de ação</span>' +
            '  <span class="auto-info-value"><i class="' + meta.icone + '" style="color:' + meta.cor + '"></i> ' +
                 esc(meta.label) + '</span>' +
            '</div>' +
            '<div class="auto-info-row">' +
            '  <span class="auto-info-label">Bloco</span>' +
            '  <span class="auto-info-value auto-pill auto-pill-' + esc(nivel) + '">' + esc(nivelLabel) + '</span>' +
            '</div>' +
            '<div class="auto-info-row">' +
            '  <span class="auto-info-label">Contratos alvo</span>' +
            '  <span class="auto-info-value"><strong>' + contratos.length.toLocaleString('pt-BR') + '</strong></span>' +
            '</div>' +
            '<p class="auto-helper-text">' + detalhe + '</p>';

        // (re)bind handlers
        d.confirmGo.onclick = function () {
            fechar(d.confirmOverlay);
            if (tipo === 'ligacao') {
                iniciarLigacaoSequencial(nivel, contratos);
            } else {
                dispararLote(tipo, nivel, contratos);
            }
        };
        bindFechamentoConfirm();
        abrir(d.confirmOverlay);
    }

    function bindFechamentoConfirm() {
        var d = dom();
        if (d.confirmOverlay && !d.confirmOverlay._bound) {
            d.confirmOverlay._bound = true;
            d.confirmOverlay.addEventListener('click', function (e) {
                if (e.target === d.confirmOverlay) fechar(d.confirmOverlay);
            });
            d.confirmOverlay.querySelectorAll('[data-close-auto]').forEach(function (b) {
                b.addEventListener('click', function () { fechar(d.confirmOverlay); });
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && d.confirmOverlay.classList.contains('active')) {
                    fechar(d.confirmOverlay);
                }
            });
        }
    }

    // ---- Disparo em lote (SMS / E-mail) -------------------------------------------
    function dispararLote(tipo, nivel, contratos) {
        var d = dom();
        var meta = TIPO_META[tipo];
        var ids = contratos.map(function (c) { return c.id; }).filter(Boolean);

        setIcon(d.statusIcon, meta.icone, meta.cor, meta.bgIcone);
        d.statusTitle.textContent = meta.verboCurto + ' - enviando...';
        d.statusBody.innerHTML =
            '<div class="auto-status-loading">' +
            '  <i class="fa-solid fa-spinner fa-spin"></i>' +
            '  <p>Disparando <strong>' + ids.length.toLocaleString('pt-BR') + '</strong> ' +
            esc(meta.label.toLowerCase()) + ' para o bloco <strong>' + esc(NIVEL_LABEL[nivel] || nivel) +
            '</strong>...</p>' +
            '  <small>Aguarde, não feche esta janela.</small>' +
            '</div>';
        d.statusFooter.innerHTML = '';
        d.statusCloseX.disabled = true;
        bindFechamentoStatus();
        abrir(d.statusOverlay);

        fetch('/api/automacao/' + tipo, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contrato_ids: ids, nivel: nivel })
        })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
            d.statusCloseX.disabled = false;
            if (!res.ok || res.body.error) {
                renderStatusErro(meta, res.body.error || 'Falha ao disparar.', tipo);
                return;
            }
            renderStatusSucessoLote(meta, res.body, nivel);
        })
        .catch(function (err) {
            d.statusCloseX.disabled = false;
            renderStatusErro(meta, err.message || String(err), tipo);
        });
    }

    function renderStatusSucessoLote(meta, body, nivel) {
        var d = dom();
        var enviados = body.enviados != null ? body.enviados : 0;
        var falhas   = body.falhas   != null ? body.falhas   : 0;
        d.statusTitle.textContent = meta.verboCurto + ' - concluído';
        d.statusBody.innerHTML =
            '<div class="auto-status-result auto-status-success">' +
            '  <div class="auto-result-icon"><i class="fa-solid fa-circle-check"></i></div>' +
            '  <h4>Disparo concluído</h4>' +
            '  <div class="auto-result-stats">' +
            '    <div class="auto-stat"><span class="auto-stat-num">' + enviados.toLocaleString('pt-BR') +
                 '</span><span class="auto-stat-lbl">Enviados</span></div>' +
            '    <div class="auto-stat"><span class="auto-stat-num auto-stat-fail">' + falhas.toLocaleString('pt-BR') +
                 '</span><span class="auto-stat-lbl">Falhas</span></div>' +
            '  </div>' +
            (body.mock ? '<p class="auto-mock-note"><i class="fa-solid fa-flask"></i> Resposta simulada (a API definitiva ainda será integrada).</p>' : '') +
            '  <p class="auto-result-msg">' + esc(body.mensagem || '') + '</p>' +
            '</div>';
        d.statusFooter.innerHTML =
            '<button type="button" class="auto-btn-primary" data-close-status>' +
            '<i class="fa-solid fa-check"></i> Concluir</button>';
        d.statusFooter.querySelector('[data-close-status]').onclick = function () {
            fechar(d.statusOverlay);
        };
    }

    function renderStatusErro(meta, msg, tipo) {
        var d = dom();
        d.statusTitle.textContent = meta.verboCurto + ' - erro';
        d.statusBody.innerHTML =
            '<div class="auto-status-result auto-status-error">' +
            '  <div class="auto-result-icon"><i class="fa-solid fa-circle-xmark"></i></div>' +
            '  <h4>Falha ao disparar</h4>' +
            '  <p class="auto-result-msg">' + esc(msg) + '</p>' +
            '</div>';
        d.statusFooter.innerHTML =
            '<button type="button" class="auto-btn-secondary" data-close-status>Fechar</button>';
        d.statusFooter.querySelector('[data-close-status]').onclick = function () {
            fechar(d.statusOverlay);
        };
    }

    function bindFechamentoStatus() {
        var d = dom();
        if (d.statusOverlay && !d.statusOverlay._bound) {
            d.statusOverlay._bound = true;
            d.statusOverlay.addEventListener('click', function (e) {
                // só permite fechar pelo backdrop quando NÃO há ligação em andamento
                if (e.target === d.statusOverlay && !d.statusCloseX.disabled) {
                    fechar(d.statusOverlay);
                }
            });
            d.statusCloseX.addEventListener('click', function () {
                if (d.statusCloseX.disabled) return;
                if (seqState) seqState.encerrado = true;
                fechar(d.statusOverlay);
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && d.statusOverlay.classList.contains('active') && !d.statusCloseX.disabled) {
                    if (seqState) seqState.encerrado = true;
                    fechar(d.statusOverlay);
                }
            });
        }
    }

    // ---- Ligação sequencial -------------------------------------------------------
    function iniciarLigacaoSequencial(nivel, contratos) {
        seqState = {
            nivel: nivel,
            lista: contratos.slice(),   // ordem ja vem da view (mesmo sort)
            indice: 0,
            sucessos: 0,
            falhas: 0,
            puladas: 0,
            encerrado: false
        };
        var d = dom();
        var meta = TIPO_META.ligacao;
        setIcon(d.statusIcon, meta.icone, meta.cor, meta.bgIcone);
        d.statusTitle.textContent = 'Ligações em andamento - ' + (NIVEL_LABEL[nivel] || nivel);
        d.statusCloseX.disabled = false;
        bindFechamentoStatus();
        abrir(d.statusOverlay);
        renderEtapaPreLigacao();
    }

    function contratoAtual() {
        if (!seqState) return null;
        return seqState.lista[seqState.indice] || null;
    }

    function renderProgressoBar() {
        var total = seqState.lista.length;
        var feitas = seqState.indice;
        var pct = total === 0 ? 0 : Math.round((feitas / total) * 100);
        return '<div class="auto-seq-progress">' +
               '  <div class="auto-seq-progress-bar"><div class="auto-seq-progress-fill" style="width:' + pct + '%"></div></div>' +
               '  <div class="auto-seq-progress-info">' +
               '    <span><strong>' + feitas + '</strong> / ' + total + ' tratados</span>' +
               '    <span class="auto-seq-stats">' +
               '      <span title="Sucessos"><i class="fa-solid fa-circle-check" style="color:#10b981"></i> ' + seqState.sucessos + '</span>' +
               '      <span title="Pulados"><i class="fa-solid fa-forward" style="color:#f59e0b"></i> ' + seqState.puladas + '</span>' +
               '      <span title="Falhas"><i class="fa-solid fa-circle-xmark" style="color:#ef4444"></i> ' + seqState.falhas + '</span>' +
               '    </span>' +
               '  </div>' +
               '</div>';
    }

    function renderCardContrato(c) {
        var tel = c.telefone || c.telefone_principal || '';
        return '<div class="auto-seq-contract-card">' +
               '  <div class="auto-seq-contract-head">' +
               '    <span class="auto-seq-pos">#' + (seqState.indice + 1) + ' de ' + seqState.lista.length + '</span>' +
               '    <span class="auto-seq-grupo">Grupo/Cota <strong>' + esc(c.grupo || '') + '/' + esc(c.cota || '') + '</strong></span>' +
               '  </div>' +
               '  <h4 class="auto-seq-nome">' + esc(c.nome_devedor || '') + '</h4>' +
               '  <div class="auto-seq-row"><i class="fa-solid fa-id-card"></i> ' + esc(fmtCpf(c.cpf_cnpj)) + '</div>' +
               (tel ? '<div class="auto-seq-row auto-seq-tel"><i class="fa-solid fa-phone"></i> ' + esc(fmtTelefone(tel)) + '</div>' : '') +
               (c.bem_descricao ? '<div class="auto-seq-row"><i class="fa-solid fa-car-side"></i> ' + esc(c.bem_descricao) + '</div>' : '') +
               '  <div class="auto-seq-row"><i class="fa-solid fa-clock"></i> ' + (c.dias_atraso || 0) + ' dias de atraso</div>' +
               '</div>';
    }

    function renderEtapaPreLigacao() {
        if (!seqState || seqState.encerrado) return;
        if (seqState.indice >= seqState.lista.length) {
            return renderEtapaConcluido();
        }
        var d = dom();
        var c = contratoAtual();
        d.statusBody.innerHTML =
            renderProgressoBar() +
            '<div class="auto-seq-stage-label"><i class="fa-solid fa-circle-play"></i> Próxima ligação:</div>' +
            renderCardContrato(c);

        d.statusFooter.innerHTML =
            '<button type="button" class="auto-btn-secondary" id="seqEncerrar">' +
            '  <i class="fa-solid fa-stop"></i> Encerrar' +
            '</button>' +
            '<button type="button" class="auto-btn-secondary" id="seqPular">' +
            '  <i class="fa-solid fa-forward"></i> Pular' +
            '</button>' +
            '<button type="button" class="auto-btn-primary" id="seqDiscar" style="background:#10b981;border-color:#10b981">' +
            '  <i class="fa-solid fa-phone-volume"></i> Discar agora' +
            '</button>';

        document.getElementById('seqEncerrar').onclick = encerrarSequencia;
        document.getElementById('seqPular').onclick = function () {
            seqState.puladas++;
            seqState.indice++;
            renderEtapaPreLigacao();
        };
        document.getElementById('seqDiscar').onclick = function () { dispararLigacaoAtual(); };
    }

    function dispararLigacaoAtual() {
        if (!seqState || seqState.encerrado) return;
        var d = dom();
        var c = contratoAtual();
        if (!c) return renderEtapaConcluido();

        d.statusCloseX.disabled = true;
        d.statusBody.innerHTML =
            renderProgressoBar() +
            '<div class="auto-seq-stage-label"><i class="fa-solid fa-tower-broadcast fa-beat-fade"></i> Discando...</div>' +
            renderCardContrato(c) +
            '<div class="auto-seq-loading">' +
            '  <i class="fa-solid fa-spinner fa-spin"></i> Aguardando resposta da API...' +
            '</div>';
        d.statusFooter.innerHTML = '';

        fetch('/api/automacao/ligacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contrato_id: c.id,
                nivel: seqState.nivel,
                nome: c.nome_devedor,
                telefone: c.telefone || c.telefone_principal || ''
            })
        })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
            d.statusCloseX.disabled = false;
            if (!res.ok || res.body.error) {
                seqState.falhas++;
                renderEtapaPosLigacao(c, false, res.body.error || 'Falha na chamada.');
            } else {
                seqState.sucessos++;
                renderEtapaPosLigacao(c, true, res.body.mensagem || 'Chamada concluída.', !!res.body.mock);
            }
        })
        .catch(function (err) {
            d.statusCloseX.disabled = false;
            seqState.falhas++;
            renderEtapaPosLigacao(c, false, err.message || String(err));
        });
    }

    function renderEtapaPosLigacao(contrato, ok, mensagem, mock) {
        if (!seqState) return;
        var d = dom();
        var ehUltimo = (seqState.indice + 1) >= seqState.lista.length;

        d.statusBody.innerHTML =
            renderProgressoBar() +
            '<div class="auto-seq-stage-label ' + (ok ? 'auto-stage-ok' : 'auto-stage-err') + '">' +
            (ok
                ? '<i class="fa-solid fa-circle-check"></i> Ligação concluída'
                : '<i class="fa-solid fa-circle-exclamation"></i> Ligação não realizada') +
            '</div>' +
            renderCardContrato(contrato) +
            '<p class="auto-seq-msg">' + esc(mensagem || '') + '</p>' +
            (mock ? '<p class="auto-mock-note"><i class="fa-solid fa-flask"></i> Resposta simulada (API ainda será integrada).</p>' : '') +
            (ehUltimo
                ? '<p class="auto-seq-finish">Esta era a última ligação do bloco.</p>'
                : '<p class="auto-seq-question"><strong>Deseja prosseguir para a próxima ligação?</strong></p>');

        if (ehUltimo) {
            d.statusFooter.innerHTML =
                '<button type="button" class="auto-btn-primary" id="seqFinalizar">' +
                '  <i class="fa-solid fa-flag-checkered"></i> Finalizar' +
                '</button>';
            document.getElementById('seqFinalizar').onclick = function () {
                seqState.indice++;
                renderEtapaConcluido();
            };
        } else {
            d.statusFooter.innerHTML =
                '<button type="button" class="auto-btn-secondary" id="seqEncerrar2">' +
                '  <i class="fa-solid fa-stop"></i> Encerrar agora' +
                '</button>' +
                '<button type="button" class="auto-btn-primary" id="seqProximo" style="background:#10b981;border-color:#10b981">' +
                '  <i class="fa-solid fa-phone"></i> Próxima ligação' +
                '</button>';
            document.getElementById('seqEncerrar2').onclick = encerrarSequencia;
            document.getElementById('seqProximo').onclick = function () {
                seqState.indice++;
                renderEtapaPreLigacao();
            };
        }
    }

    function renderEtapaConcluido() {
        if (!seqState) return;
        var d = dom();
        var st = seqState;
        d.statusTitle.textContent = 'Ligações concluídas';
        d.statusBody.innerHTML =
            '<div class="auto-status-result auto-status-success">' +
            '  <div class="auto-result-icon"><i class="fa-solid fa-flag-checkered"></i></div>' +
            '  <h4>Sequência finalizada</h4>' +
            '  <div class="auto-result-stats">' +
            '    <div class="auto-stat"><span class="auto-stat-num">' + st.sucessos + '</span><span class="auto-stat-lbl">Sucessos</span></div>' +
            '    <div class="auto-stat"><span class="auto-stat-num" style="color:#f59e0b">' + st.puladas + '</span><span class="auto-stat-lbl">Pulados</span></div>' +
            '    <div class="auto-stat"><span class="auto-stat-num auto-stat-fail">' + st.falhas + '</span><span class="auto-stat-lbl">Falhas</span></div>' +
            '  </div>' +
            '  <p class="auto-result-msg">Total processado: <strong>' + st.indice + '</strong> de <strong>' + st.lista.length + '</strong> contratos.</p>' +
            '</div>';
        d.statusFooter.innerHTML =
            '<button type="button" class="auto-btn-primary" id="seqFechar">' +
            '  <i class="fa-solid fa-check"></i> Fechar' +
            '</button>';
        document.getElementById('seqFechar').onclick = function () {
            fechar(d.statusOverlay);
            seqState = null;
        };
    }

    function encerrarSequencia() {
        if (!seqState) return;
        if (!confirm('Encerrar as ligações agora? Os contratos restantes não serão chamados.')) return;
        seqState.encerrado = true;
        renderEtapaConcluido();
    }

    // ---- Expor --------------------------------------------------------------------
    window.CobrancaAutomacoes = Auto;

})();
