/* ===========================================================================
 * Cobrança - Automações em lote (SMS / E-mail / Ligação)
 * ---------------------------------------------------------------------------
 * Exposto via window.CobrancaAutomacoes para ser acionado pelo cobranca.js,
 * tanto no painel analítico quanto no Kanban.
 *
 * Fluxos:
 *   - SMS / E-mail: confirmação -> POST único com todos os IDs do bloco.
 *   - Ligação:     confirmação -> job em background (/api/cobranca/ligacao-bloco/*)
 *                  com bolha global (ligacao_bloco_background.js). Discador real via
 *                  /api/discar; tramitação obrigatória entre cada número.
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
        },
        sms_email: {
            label: 'SMS / E-mail',
            verbo: 'enviar SMS e e-mails automáticos',
            verboCurto: 'SMS / E-mail',
            icone: 'fa-solid fa-comments',
            cor: '#7c3aed',
            bgIcone: 'rgba(124,58,237,0.12)'
        },
        negativacao: {
            label: 'Negativação',
            verbo: 'negativar os contratos elegíveis',
            verboCurto: 'Negativar',
            icone: 'fa-solid fa-ban',
            cor: '#b91c1c',
            bgIcone: 'rgba(185,28,28,0.12)',
            endpoint: '/api/negativacao/enviar'
        }
    };

    var NIVEL_LABEL = {
        critico: 'Crítico',
        atencao: 'Atenção',
        recente: 'Recente',
        todos: 'Todos os blocos'
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
            confirmExcel:   $('#autoConfirmExcel'),
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

    // ---- Classificação para negativação (por parcela) -------------------------------
    //
    // Regras sincronizadas com o backend (/api/negativacao/enviar e /api/cobranca):
    //   Elegível = (30 < dias_atraso < 90) e parcela-alvo ainda NÃO em
    //              `negativacao` (1 ou N parcelas em aberto).
    //
    // Separa a lista em categorias para o modal de confirmação deixar claro
    // quais contratos serão afetados e quais foram descartados (e por quê).
    function classificarParaNegativacao(contratos) {
        var elegiveis     = [];
        var jaNegativados = [];
        var foraJanela    = [];
        (contratos || []).forEach(function (c) {
            if (!c) return;

            // Usa status calculado pelo backend quando disponível. Fallback para
            // o flag antigo `negativado` para clientes que consumiram o dataset
            // antes de recarregar.
            var st = c.status_negativacao;
            if (st === 'negativado' || (!st && c.negativado)) {
                jaNegativados.push(c);
                return;
            }

            var d = parseInt(c.dias_atraso, 10);
            if (!isFinite(d)) d = 0;

            if (d > 30 && d < 90) {
                elegiveis.push(c);
            } else {
                foraJanela.push(c);
            }
        });
        return {
            elegiveis:     elegiveis,
            jaNegativados: jaNegativados,
            foraJanela:    foraJanela
        };
    }

    // ---- API pública --------------------------------------------------------------
    var Auto = {
        /** Disparado pelo botão "Ligar/SMS/E-mail/Negativação" do painel. */
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

            // Para negativação, pré-classifica no cliente e aborta cedo se
            // nenhum contrato for elegível (evita abrir modal vazio).
            if (tipo === 'negativacao') {
                var cls = classificarParaNegativacao(contratos);
                if (cls.elegiveis.length === 0) {
                    alert(
                        'Nenhuma parcela elegível para negativação.\n\n' +
                        'Critério: parcela mais antiga com mais de 30 e menos de 90 ' +
                        'dias de atraso, e ainda não negativada (1 ou mais parcelas em aberto).\n\n' +
                        'Na lista atual:\n' +
                        '  • ' + cls.jaNegativados.length + ' parcela(s) já negativada(s)\n' +
                        '  • ' + cls.foraJanela.length    + ' fora da janela (≤30 ou ≥90 dias)\n'
                    );
                    return;
                }
                mostrarConfirmacao(tipo, nivel, cls.elegiveis, {
                    jaNegativados: cls.jaNegativados.length,
                    foraJanela:    cls.foraJanela.length,
                    totalOriginal: contratos.length
                });
                return;
            }

            if (tipo === 'sms' || tipo === 'email' || tipo === 'sms_email') {
                iniciarComPreviewSmsEmail(tipo, nivel, contratos);
                return;
            }

            if (tipo === 'ligacao') {
                mostrarConfirmacaoLigacao(nivel, contratos);
            } else {
                mostrarConfirmacao(tipo, nivel, contratos);
            }
        }
    };

    var PREVIEW_TABLE_MAX = 50;

    /** Preview/disparo: rota estável sob /api/cobranca (mesmo prefixo do painel). */
    var SMS_EMAIL_PREVIEW_URL = '/api/cobranca/sms-email/preview';
    var SMS_EMAIL_EXCEL_URL = '/api/cobranca/sms-email/excel';
    var BLOCO_LIGACAO_EXCEL_URL = '/api/cobranca/bloco/excel';
    var BLOCO_LIGACAO_PREVIEW_URL = '/api/cobranca/ligacao-bloco/preview';

    /** Lista do modal de confirmação de ligação (export Excel). */
    var pendingBlocoExport = null;

    /** Estado do modal estilo Importação (rodapé SMS/E-mail, lista «todos»). */
    var lastCobrancaCarteiraPreview = null;

    function cobrancaCarteiraModalEls() {
        return {
            overlay: document.getElementById('cobrancaSmsCarteiraOverlay'),
            body: document.getElementById('cobrancaSmsCarteiraBody'),
            fechar: document.getElementById('cobrancaSmsCarteiraFechar'),
            fecharX: document.getElementById('cobrancaSmsCarteiraFecharX'),
            envSms: document.getElementById('cobrancaSmsCarteiraEnvioSms'),
            envEmail: document.getElementById('cobrancaSmsCarteiraEnvioEmail'),
            envAmbos: document.getElementById('cobrancaSmsCarteiraEnvioAmbos'),
            excel: document.getElementById('cobrancaSmsCarteiraExcel'),
        };
    }

    function fmtIntPreview(n) {
        var x = Number(n);
        if (!isFinite(x)) return '0';
        return x.toLocaleString('pt-BR');
    }

    /** Alinha rodapé do modal carteira ao estado (loading / erro / sem previsto / sucesso). */
    function syncCarteiraSmsModalFooter(opts) {
        var m = cobrancaCarteiraModalEls();
        opts = opts || {};
        var phase = opts.phase || 'loading';
        var pv = opts.pv;
        var st = lastCobrancaCarteiraPreview;
        var ids = st && st.contrato_ids ? st.contrato_ids : [];
        var hasIds = ids.length > 0;

        function disableEnvio(titSms, titEmail, titAmbos) {
            if (m.envSms) {
                m.envSms.disabled = true;
                m.envSms.title = titSms || '';
            }
            if (m.envEmail) {
                m.envEmail.disabled = true;
                m.envEmail.title = titEmail || '';
            }
            if (m.envAmbos) {
                m.envAmbos.disabled = true;
                m.envAmbos.title = titAmbos || '';
            }
        }

        if (phase === 'loading') {
            disableEnvio();
            if (m.excel) {
                m.excel.disabled = true;
                m.excel.removeAttribute('title');
            }
            return;
        }

        if (phase === 'error') {
            disableEnvio();
            if (m.excel) {
                m.excel.disabled = !hasIds;
                m.excel.title = hasIds
                    ? ''
                    : 'Nenhuma lista de contratos para exportar.';
            }
            return;
        }

        if (phase === 'sem_previsto') {
            disableEnvio(
                'Nenhum SMS previsto neste momento.',
                'Nenhum e-mail previsto neste momento.',
                'Nenhum canal previsto.'
            );
            if (m.excel) {
                m.excel.disabled = !hasIds;
                m.excel.title = hasIds
                    ? 'Exportar grupo, cota e dias de atraso dos contratos desta lista no roteiro (0, 16, 31, 61 ou 85).'
                    : 'Nenhuma lista de contratos para exportar.';
            }
            return;
        }

        if (phase === 'success' && pv) {
            var prevSms = pv.sms_previstos != null ? pv.sms_previstos : 0;
            var prevMail = pv.emails_previstos != null ? pv.emails_previstos : 0;
            if (m.envSms) {
                m.envSms.disabled = prevSms < 1;
                m.envSms.title = prevSms < 1 ? 'Nenhum SMS previsto neste momento.' : '';
            }
            if (m.envEmail) {
                m.envEmail.disabled = prevMail < 1;
                m.envEmail.title = prevMail < 1 ? 'Nenhum e-mail previsto neste momento.' : '';
            }
            if (m.envAmbos) {
                var ambosOff = prevSms < 1 && prevMail < 1;
                m.envAmbos.disabled = ambosOff;
                if (ambosOff) {
                    m.envAmbos.title = 'Nenhum canal previsto.';
                } else if (prevSms >= 1 && prevMail >= 1) {
                    m.envAmbos.title = 'Dispara SMS e e-mail no mesmo processamento.';
                } else if (prevSms >= 1) {
                    m.envAmbos.title =
                        'Dispara SMS e e-mail: só contratos com disparo SMS e/ou e-mail previsto entram no lote.';
                } else {
                    m.envAmbos.title =
                        'Dispara SMS e e-mail: só contratos com e-mail previsto entram no lote.';
                }
            }
            if (m.excel) {
                m.excel.disabled = false;
                m.excel.removeAttribute('title');
            }
        }
    }

    function fecharModalCarteiraSmsEmail() {
        var m = cobrancaCarteiraModalEls();
        if (!m.overlay) return;
        m.overlay.classList.add('d-none');
        m.overlay.setAttribute('aria-hidden', 'true');
        if (!document.querySelector('.auto-overlay.active')) {
            document.body.style.overflow = '';
        }
        lastCobrancaCarteiraPreview = null;
    }

    function abrirModalCarteiraSmsEmailCarregando() {
        var m = cobrancaCarteiraModalEls();
        if (!m.body || !m.overlay) return;
        m.body.innerHTML =
            '<div class="sms-preview-loading">' +
            '<p><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Calculando resumo…</p>' +
            '<p class="sms-preview-loading-hint">Mesmo critério da lista Excel (contratos abertos no roteiro 0, 16, 31, 61 ou 85 dias), restrito à lista visível no painel.</p>' +
            '</div>';
        syncCarteiraSmsModalFooter({ phase: 'loading' });
        m.overlay.classList.remove('d-none');
        m.overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function mostrarModalCarteiraSmsEmailErro(msg) {
        var m = cobrancaCarteiraModalEls();
        if (!m.body) return;
        var podeExcel =
            lastCobrancaCarteiraPreview &&
            lastCobrancaCarteiraPreview.contrato_ids &&
            lastCobrancaCarteiraPreview.contrato_ids.length > 0;
        m.body.innerHTML =
            '<div class="sms-preview-erro">' +
            '<p><strong>Não foi possível calcular o resumo.</strong></p>' +
            '<p class="sms-preview-erro-msg">' + esc(msg) + '</p>' +
            '<p class="sms-preview-loading-hint">' +
            (podeExcel
                ? 'Confira os logs do servidor ou use <strong>Lista SMS/E-mail</strong> para exportar o roteiro desta lista. '
                : '') +
            'Use <strong>Fechar</strong> abaixo quando terminar.</p>' +
            '</div>';
        syncCarteiraSmsModalFooter({ phase: 'error' });
    }

    function mostrarModalCarteiraSmsEmailSemPrevisto(pv) {
        var m = cobrancaCarteiraModalEls();
        if (!m.body) return;
        var ign = pv.ignorados_ja_enviados_hoje != null ? pv.ignorados_ja_enviados_hoje : 0;
        m.body.innerHTML =
            '<div class="sms-preview-erro sms-preview-erro-info">' +
            '<p><strong>Nenhum envio previsto neste momento.</strong></p>' +
            '<p class="sms-preview-loading-hint">Nenhum contrato no roteiro (0, 16, 31, 61 ou 85 dias) com telefone e/ou e-mail válidos, ' +
            'ou todos já receberam SMS ou e-mail hoje (<strong>' +
            fmtIntPreview(ign) +
            '</strong> ignorados por duplicidade do dia).</p>' +
            '<p class="sms-preview-loading-hint">Pode usar <strong>Lista SMS/E-mail</strong> para ver grupo, cota e dias dos contratos desta lista no roteiro.</p>' +
            '</div>';
        syncCarteiraSmsModalFooter({ phase: 'sem_previsto' });
    }

    function preencherModalCarteiraSmsEmail(pv) {
        var m = cobrancaCarteiraModalEls();
        if (!m.body) return;
        var prevSms = pv.sms_previstos != null ? pv.sms_previstos : 0;
        var prevMail = pv.emails_previstos != null ? pv.emails_previstos : 0;
        var msgSms = pv.sms_mensagens_previstas != null ? pv.sms_mensagens_previstas : prevSms;
        var msgMail = pv.email_mensagens_previstas != null ? pv.email_mensagens_previstas : prevMail;
        var cAlgum =
            pv.contratos_previstos_algum_canal != null ? pv.contratos_previstos_algum_canal : 0;
        var ignHoje = pv.ignorados_ja_enviados_hoje != null ? pv.ignorados_ja_enviados_hoje : 0;
        var ignRota = pv.ignorados_fora_rota != null ? pv.ignorados_fora_rota : 0;
        var ignTel = pv.ignorados_sem_telefone != null ? pv.ignorados_sem_telefone : 0;
        var ignEm = pv.ignorados_sem_email != null ? pv.ignorados_sem_email : 0;
        var proc = pv.carteira_ids != null ? pv.carteira_ids : 0;
        var bloq = pv.tentativas_bloqueadas_cadastro != null ? pv.tentativas_bloqueadas_cadastro : 0;
        var ignSemContrato = pv.ignorados_sem_contrato_aberto != null ? pv.ignorados_sem_contrato_aberto : 0;
        var ignSemPessoa = pv.ignorados_sem_pessoa != null ? pv.ignorados_sem_pessoa : 0;

        m.body.innerHTML =
            '<dl class="sms-preview-stats">' +
            '<dt>Contratos analisados (lista enviada)</dt><dd>' + fmtIntPreview(proc) + '</dd>' +
            '<dt>Contratos no roteiro com SMS previsto</dt><dd>' + fmtIntPreview(prevSms) + '</dd>' +
            '<dt>Contratos no roteiro com e-mail previsto</dt><dd>' + fmtIntPreview(prevMail) + '</dd>' +
            '<dt>Contratos com pelo menos SMS ou e-mail previsto</dt><dd>' + fmtIntPreview(cAlgum) + '</dd>' +
            '<dt>Total de SMS previstos (um por número válido)</dt><dd>' + fmtIntPreview(msgSms) + '</dd>' +
            '<dt>Total de e-mails previstos (um por endereço válido)</dt><dd>' + fmtIntPreview(msgMail) + '</dd>' +
            '<dt>Ignorados (fora do roteiro 0/16/31/61/85)</dt><dd>' + fmtIntPreview(ignRota) + '</dd>' +
            '<dt>Ignorados (já SMS ou e-mail hoje)</dt><dd>' + fmtIntPreview(ignHoje) + '</dd>' +
            '<dt>Sem telefone no cadastro</dt><dd>' + fmtIntPreview(ignTel) + '</dd>' +
            '<dt>Sem e-mail no cadastro</dt><dd>' + fmtIntPreview(ignEm) + '</dd>' +
            '<dt>Tentativas bloqueadas (validação cadastro)</dt><dd>' + fmtIntPreview(bloq) + '</dd>' +
            '<dt>Sem contrato aberto na lista</dt><dd>' + fmtIntPreview(ignSemContrato) + '</dd>' +
            '<dt>Sem pessoa (devedor)</dt><dd>' + fmtIntPreview(ignSemPessoa) + '</dd>' +
            '</dl>' +
            '<p class="sms-preview-note">Os totais por canal em contratos alinham-se ao Excel do roteiro; os totais “um por número/endereço” refletem quantas mensagens o POST envia quando há vários contactos válidos. ' +
            'Mesmo texto no SMS e no e-mail (templates 1–4). Use <strong>Lista SMS/E-mail</strong> para exportar o roteiro. Escolha abaixo apenas SMS, apenas e-mail ou ambos.</p>';

        syncCarteiraSmsModalFooter({ phase: 'success', pv: pv });
    }

    function contratosIdsParaEnvioCarteira(canais) {
        var st = lastCobrancaCarteiraPreview;
        if (!st || !st.pv) return [];
        var wantSms = canais.indexOf('sms') >= 0;
        var wantEm = canais.indexOf('email') >= 0;
        var det = st.pv.detalhes || [];
        var seen = {};
        var out = [];
        det.forEach(function (row) {
            var ok =
                (wantSms && (row.disparos_sms || 0) > 0) || (wantEm && (row.disparos_email || 0) > 0);
            if (!ok) return;
            var id = row.id_contrato;
            if (id == null || seen[id]) return;
            seen[id] = true;
            out.push({ id: id });
        });
        return out;
    }

    function executarEnvioCarteiraSmsEmail(canais) {
        var st = lastCobrancaCarteiraPreview;
        if (!st || !st.pv) return;
        var pv = st.pv;
        var prevSms = pv.sms_previstos != null ? pv.sms_previstos : 0;
        var prevMail = pv.emails_previstos != null ? pv.emails_previstos : 0;
        var querSms = canais.indexOf('sms') >= 0;
        var querEm = canais.indexOf('email') >= 0;
        if (querSms && prevSms < 1) return;
        if (querEm && prevMail < 1) return;
        if (querSms && querEm && prevSms < 1 && prevMail < 1) return;

        var contratos = contratosIdsParaEnvioCarteira(canais);
        if (!contratos.length) {
            alert('Nenhum contrato elegível para os canais escolhidos.');
            return;
        }

        var n = contratos.length;
        var nLabel = n === 1 ? '1 contrato' : n.toLocaleString('pt-BR') + ' contratos';
        var msgConfirm;
        if (querSms && querEm) {
            msgConfirm =
                'Confirma o envio de SMS e e-mail para ' + nLabel + '?\n\n' +
                'O processamento pode levar vários minutos. Cancelar interrompe antes de enviar.';
        } else if (querSms) {
            msgConfirm =
                'Confirma o envio de SMS para ' + nLabel + '?\n\n' +
                'O processamento pode levar vários minutos. Cancelar interrompe antes de enviar.';
        } else {
            msgConfirm =
                'Confirma o envio de e-mail para ' + nLabel + '?\n\n' +
                'O processamento pode levar vários minutos. Cancelar interrompe antes de enviar.';
        }
        if (!window.confirm(msgConfirm)) {
            return;
        }

        var m = cobrancaCarteiraModalEls();
        var footerEnvio = m.overlay ? m.overlay.querySelectorAll('.sms-autom-envio-btn') : [];
        footerEnvio.forEach(function (b) {
            b.disabled = true;
        });
        if (m.excel) m.excel.disabled = true;

        var tipo = canais.length >= 2 ? 'sms_email' : canais[0];
        var nivel = st.nivel;
        fecharModalCarteiraSmsEmail();
        dispararLote(tipo, nivel, contratos);
    }

    function abrirModalCarteiraSmsEmail(contratos) {
        var ids = contratos.map(function (c) {
            return c.id;
        }).filter(function (id) {
            return id != null && id !== '';
        });
        if (!ids.length) {
            alert('Nenhum contrato disponível na lista atual.');
            return;
        }

        lastCobrancaCarteiraPreview = { pv: null, nivel: 'todos', contrato_ids: ids };
        abrirModalCarteiraSmsEmailCarregando();

        fetch(SMS_EMAIL_PREVIEW_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ contrato_ids: ids }),
        })
            .then(parseResponseJson)
            .then(function (res) {
                if (res.alertMsg) {
                    mostrarModalCarteiraSmsEmailErro(res.alertMsg);
                    return;
                }
                var body = res.body || {};
                if (!res.ok || body.error) {
                    mostrarModalCarteiraSmsEmailErro(body.error || 'HTTP ' + (res.status || ''));
                    return;
                }
                var pv = body;
                lastCobrancaCarteiraPreview.pv = pv;
                var prevSms = pv.sms_previstos != null ? pv.sms_previstos : 0;
                var prevMail = pv.emails_previstos != null ? pv.emails_previstos : 0;
                if (prevSms < 1 && prevMail < 1) {
                    mostrarModalCarteiraSmsEmailSemPrevisto(pv);
                    return;
                }
                preencherModalCarteiraSmsEmail(pv);
            })
            .catch(function (err) {
                mostrarModalCarteiraSmsEmailErro(err.message || String(err));
            });
    }

    async function downloadCarteiraSmsEmailExcel() {
        var m = cobrancaCarteiraModalEls();
        if (!m.excel || m.excel.disabled) return;
        var st = lastCobrancaCarteiraPreview;
        var ids = st && st.contrato_ids ? st.contrato_ids : [];
        if (!ids.length) {
            alert('Nenhuma lista de contratos disponível para exportar.');
            return;
        }
        var prevHtml = m.excel.innerHTML;
        m.excel.disabled = true;
        m.excel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
        try {
            var resp = await fetch(SMS_EMAIL_EXCEL_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contrato_ids: ids }),
            });
            if (!resp.ok) {
                var msg = 'HTTP ' + resp.status;
                try {
                    var errJson = await resp.json();
                    if (errJson.error) msg = errJson.error;
                } catch (e2) { /* ignore */ }
                throw new Error(msg);
            }
            var blob = await resp.blob();
            var cd = resp.headers.get('Content-Disposition');
            var fname = 'sms_email_carteira_cobranca.xlsx';
            if (cd) {
                var mfn = /filename\*?=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
                if (mfn) fname = decodeURIComponent(mfn[1].replace(/['"]/g, '').trim());
            }
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Não foi possível baixar a lista Excel: ' + (err.message || err));
        } finally {
            m.excel.innerHTML = prevHtml;
            var pv = lastCobrancaCarteiraPreview && lastCobrancaCarteiraPreview.pv;
            var okExcel =
                pv &&
                ((pv.sms_previstos || 0) >= 1 || (pv.emails_previstos || 0) >= 1);
            if (m.excel && okExcel) {
                m.excel.disabled = false;
            }
        }
    }

    function bindModalCarteiraSmsEmailOnce() {
        var m = cobrancaCarteiraModalEls();
        if (!m.overlay || m.overlay._cobrancaSmsBound) return;
        m.overlay._cobrancaSmsBound = true;
        function fe() {
            fecharModalCarteiraSmsEmail();
        }
        if (m.fechar) m.fechar.addEventListener('click', fe);
        if (m.fecharX) m.fecharX.addEventListener('click', fe);
        m.overlay.addEventListener('click', function (e) {
            if (e.target === m.overlay) fe();
        });
        document.addEventListener('keydown', function (e) {
            if (
                e.key === 'Escape' &&
                m.overlay &&
                !m.overlay.classList.contains('d-none')
            ) {
                fe();
            }
        });
        if (m.envSms) {
            m.envSms.addEventListener('click', function () {
                executarEnvioCarteiraSmsEmail(['sms']);
            });
        }
        if (m.envEmail) {
            m.envEmail.addEventListener('click', function () {
                executarEnvioCarteiraSmsEmail(['email']);
            });
        }
        if (m.envAmbos) {
            m.envAmbos.addEventListener('click', function () {
                executarEnvioCarteiraSmsEmail(['sms', 'email']);
            });
        }
        if (m.excel) {
            m.excel.addEventListener('click', function () {
                downloadCarteiraSmsEmailExcel();
            });
        }
    }
    bindModalCarteiraSmsEmailOnce();

    function parseResponseJson(r) {
        var status = r.status;
        return r.text().then(function (text) {
            var trimmed = (text || '').trim();
            var body = null;
            if (trimmed) {
                try {
                    body = JSON.parse(trimmed);
                } catch (ignore) {
                    var snippet = trimmed.length > 280 ? trimmed.slice(0, 280) + '…' : trimmed;
                    return {
                        ok: false,
                        status: status,
                        body: null,
                        alertMsg:
                            'Resposta inválida do servidor (HTTP ' +
                            status +
                            '). Esperávamos JSON — pode ser erro de proxy ou servidor sobrecarregado.\n\n' +
                            snippet,
                    };
                }
            }
            return { ok: r.ok, status: status, body: body, alertMsg: null };
        });
    }

    function rowElegivelCanal(tipo, row) {
        if (tipo === 'sms') return row.disparos_sms > 0;
        if (tipo === 'email') return row.disparos_email > 0;
        return row.disparos_sms > 0 || row.disparos_email > 0;
    }

    function iniciarComPreviewSmsEmail(tipo, nivel, contratos) {
        if (tipo === 'sms_email' && nivel === 'todos') {
            abrirModalCarteiraSmsEmail(contratos);
            return;
        }

        var ids = contratos.map(function (c) { return c.id; }).filter(function (id) {
            return id != null && id !== '';
        });
        if (!ids.length) {
            alert('Nenhum contrato disponível na lista atual.');
            return;
        }

        fetch(SMS_EMAIL_PREVIEW_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ contrato_ids: ids }),
        })
            .then(parseResponseJson)
            .then(function (res) {
                if (res.alertMsg) {
                    alert(res.alertMsg);
                    return;
                }
                var body = res.body || {};
                if (!res.ok || body.error) {
                    alert(
                        'Não foi possível calcular o preview: ' +
                            (body.error || ('HTTP ' + (res.status || '')))
                    );
                    return;
                }
                var pv = body;
                var prevSms = pv.sms_previstos != null ? pv.sms_previstos : 0;
                var prevMail = pv.emails_previstos != null ? pv.emails_previstos : 0;
                var prevAlgum =
                    pv.contratos_previstos_algum_canal != null
                        ? pv.contratos_previstos_algum_canal
                        : (pv.detalhes || []).filter(function (row) {
                              return rowElegivelCanal('sms_email', row);
                          }).length;
                var prev =
                    tipo === 'sms' ? prevSms : tipo === 'email' ? prevMail : prevAlgum;
                var contratosCanal =
                    tipo === 'sms'
                        ? pv.contratos_com_sms
                        : tipo === 'email'
                          ? pv.contratos_com_email
                          : null;
                if (tipo === 'sms_email') {
                    contratosCanal = prevAlgum;
                }
                if (!prev || prev < 1) {
                    alert(
                        'Nenhum disparo previsto para os contratos da sua lista neste momento.\n\n' +
                            'Critérios (iguais à Lista SMS/E-mail na Importação): roteiro nos dias ' +
                            '0, 16, 31, 61 ou 85 (vencimento mais antigo em parcelas em aberto); sem SMS ' +
                            'nem e-mail registrados hoje para o contrato; telefone ou e-mail válido no cadastro.\n\n' +
                            'Contratos na carteira enviados ao preview: ' +
                            (pv.carteira_ids != null ? pv.carteira_ids : ids.length) +
                            '.'
                    );
                    return;
                }
                mostrarConfirmacaoSmsEmail(tipo, nivel, pv, contratosCanal, prev);
            })
            .catch(function (err) {
                alert('Falha ao consultar o servidor: ' + (err.message || String(err)));
            });
    }

    function mostrarConfirmacaoSmsEmail(tipo, nivel, pv, contratosCanal, totalDisparos) {
        var d = dom();
        var meta = TIPO_META[tipo];
        var nivelLabel = NIVEL_LABEL[nivel] || nivel;
        var msgSmsTot =
            pv.sms_mensagens_previstas != null ? pv.sms_mensagens_previstas : pv.sms_previstos || 0;
        var msgEmTot =
            pv.email_mensagens_previstas != null
                ? pv.email_mensagens_previstas
                : pv.emails_previstos || 0;

        var detalhesFiltrados = (pv.detalhes || []).filter(function (row) {
            return rowElegivelCanal(tipo, row);
        });

        var elegiveisParaEnvio = detalhesFiltrados.map(function (row) {
            return { id: row.id_contrato };
        });

        setIcon(d.confirmIcon, meta.icone, meta.cor, meta.bgIcone);
        d.confirmTitle.textContent = meta.verboCurto + ' — resumo (carteira)';
        d.confirmGoLabel.textContent = 'Confirmar e disparar';
        d.confirmGo.style.background = meta.cor;
        d.confirmGo.style.borderColor = meta.cor;
        atualizarBotaoExcelConfirmacao(tipo, nivel, []);

        var subtipo =
            tipo === 'sms' ? 'SMS' : tipo === 'email' ? 'E-mail' : 'SMS e e-mail';
        var tableHtml = '';
        var showRows = detalhesFiltrados.slice(0, PREVIEW_TABLE_MAX);
        var omitidos = detalhesFiltrados.length - showRows.length;
        if (showRows.length) {
            var headExtra =
                tipo === 'sms_email'
                    ? '<th>Msgs SMS (por contrato)</th><th>Msgs e-mail (por contrato)</th>'
                    : '<th>' +
                      (tipo === 'sms' ? 'Msgs SMS (por contrato)' : 'Msgs e-mail (por contrato)') +
                      '</th>';
            tableHtml =
                '<div class="auto-preview-table-wrap">' +
                '<table class="auto-preview-table"><thead><tr>' +
                '<th>Grupo / Cota</th><th>Devedor</th><th>Dias rota</th>' +
                headExtra +
                '</tr></thead><tbody>';
            showRows.forEach(function (row) {
                var gc = esc(String(row.grupo || '')) + ' / ' + esc(String(row.cota || ''));
                var dias = row.dias_atraso != null ? esc(String(row.dias_atraso)) : '—';
                var cells =
                    tipo === 'sms_email'
                        ? '<td>' +
                          esc(String(row.disparos_sms || 0)) +
                          '</td><td>' +
                          esc(String(row.disparos_email || 0)) +
                          '</td>'
                        : '<td>' +
                          esc(String(tipo === 'sms' ? row.disparos_sms : row.disparos_email)) +
                          '</td>';
                tableHtml +=
                    '<tr><td>' +
                    gc +
                    '</td><td>' +
                    esc(row.nome_devedor || '') +
                    '</td>' +
                    '<td>' +
                    dias +
                    '</td>' +
                    cells +
                    '</tr>';
            });
            tableHtml += '</tbody></table>';
            if (omitidos > 0) {
                tableHtml +=
                    '<p class="auto-preview-more">… e mais ' +
                    omitidos.toLocaleString('pt-BR') +
                    ' contrato(s) elegível(is).</p>';
            }
            tableHtml += '</div>';
        }

        var detalhe =
            'Mesma regra da <strong>Lista SMS/E-mail</strong> na Importação e Distribuição, aplicada só aos ' +
            'contratos da sua lista (operador / busca).';

        var destaqueContratos =
            tipo === 'sms_email'
                ? '<div class="auto-info-row auto-preview-highlight">' +
                  '  <span class="auto-info-label">Contratos com ao menos SMS ou e-mail previsto</span>' +
                  '  <span class="auto-info-value"><strong>' +
                  (contratosCanal || 0).toLocaleString('pt-BR') +
                  '</strong></span>' +
                  '</div>' +
                  '<div class="auto-info-row auto-preview-highlight" style="border-top:none;padding-top:4px;margin-top:0">' +
                  '  <span class="auto-info-label">Total mensagens SMS (um por número válido)</span>' +
                  '  <span class="auto-info-value"><strong>' +
                  msgSmsTot.toLocaleString('pt-BR') +
                  '</strong></span>' +
                  '</div>' +
                  '<div class="auto-info-row auto-preview-highlight" style="border-top:none;padding-top:4px;margin-top:0">' +
                  '  <span class="auto-info-label">Total mensagens e-mail (um por endereço válido)</span>' +
                  '  <span class="auto-info-value"><strong>' +
                  msgEmTot.toLocaleString('pt-BR') +
                  '</strong></span>' +
                  '</div>'
                : '<div class="auto-info-row auto-preview-highlight">' +
                  '  <span class="auto-info-label">Contratos que receberão ' +
                  esc(subtipo) +
                  '</span>' +
                  '  <span class="auto-info-value"><strong>' +
                  (contratosCanal || 0).toLocaleString('pt-BR') +
                  '</strong></span>' +
                  '</div>' +
                  '<div class="auto-info-row auto-preview-highlight" style="border-top:none;padding-top:4px;margin-top:0">' +
                  '  <span class="auto-info-label">Total de mensagens ' +
                  esc(subtipo) +
                  '</span>' +
                  '  <span class="auto-info-value"><strong>' +
                  (tipo === 'sms' ? msgSmsTot : msgEmTot).toLocaleString('pt-BR') +
                  '</strong></span>' +
                  '</div>';

        d.confirmBody.innerHTML =
            '<div class="auto-info-row">' +
            '  <span class="auto-info-label">Tipo</span>' +
            '  <span class="auto-info-value"><i class="' +
            meta.icone +
            '" style="color:' +
            meta.cor +
            '"></i> ' +
            esc(subtipo) +
            '</span>' +
            '</div>' +
            '<div class="auto-info-row">' +
            '  <span class="auto-info-label">Escopo</span>' +
            '  <span class="auto-info-value auto-pill auto-pill-' +
            esc(nivel) +
            '">' +
            esc(nivelLabel) +
            '</span>' +
            '</div>' +
            '<div class="auto-info-row auto-info-sub">' +
            '  <span class="auto-info-label">Contratos na lista (carteira)</span>' +
            '  <span class="auto-info-value auto-sub-value">' +
            (pv.carteira_ids != null ? pv.carteira_ids : 0).toLocaleString('pt-BR') +
            '</span>' +
            '</div>' +
            '<div class="auto-info-row auto-info-sub">' +
            '  <span class="auto-info-label">Fora do roteiro de dias</span>' +
            '  <span class="auto-info-value auto-sub-value">' +
            (pv.ignorados_fora_rota != null ? pv.ignorados_fora_rota : 0).toLocaleString('pt-BR') +
            '</span>' +
            '</div>' +
            '<div class="auto-info-row auto-info-sub">' +
            '  <span class="auto-info-label">Já enviados hoje (SMS ou e-mail)</span>' +
            '  <span class="auto-info-value auto-sub-value">' +
            (pv.ignorados_ja_enviados_hoje != null ? pv.ignorados_ja_enviados_hoje : 0).toLocaleString(
                'pt-BR'
            ) +
            '</span>' +
            '</div>' +
            '<div class="auto-info-row auto-info-sub">' +
            '  <span class="auto-info-label">Sem contrato aberto na lista</span>' +
            '  <span class="auto-info-value auto-sub-value">' +
            (pv.ignorados_sem_contrato_aberto != null ? pv.ignorados_sem_contrato_aberto : 0).toLocaleString(
                'pt-BR'
            ) +
            '</span>' +
            '</div>' +
            destaqueContratos +
            '<p class="auto-helper-text">' +
            detalhe +
            '</p>' +
            (tableHtml || '');

        d.confirmGo.onclick = function () {
            fechar(d.confirmOverlay);
            dispararLote(tipo, nivel, elegiveisParaEnvio);
        };
        bindFechamentoConfirm();
        abrir(d.confirmOverlay);
    }

    function atualizarBotaoExcelConfirmacao(tipo, nivel, contratos) {
        var d = dom();
        if (!d.confirmExcel) return;
        if (tipo === 'ligacao' && contratos && contratos.length > 0) {
            d.confirmExcel.hidden = false;
            pendingBlocoExport = {
                nivel: nivel,
                contrato_ids: contratos.map(function (c) { return c.id; }).filter(Boolean),
            };
        } else {
            d.confirmExcel.hidden = true;
            pendingBlocoExport = null;
        }
    }

    async function downloadBlocoLigacaoExcel() {
        var d = dom();
        if (!d.confirmExcel || d.confirmExcel.hidden) return;
        var st = pendingBlocoExport;
        if (!st || !st.contrato_ids || !st.contrato_ids.length) {
            alert('Nenhuma lista de contratos disponível para exportar.');
            return;
        }
        var prevHtml = d.confirmExcel.innerHTML;
        d.confirmExcel.disabled = true;
        d.confirmExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
        try {
            var resp = await fetch(BLOCO_LIGACAO_EXCEL_URL, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contrato_ids: st.contrato_ids,
                    nivel: st.nivel,
                }),
            });
            if (!resp.ok) {
                var msg = 'HTTP ' + resp.status;
                try {
                    var errJson = await resp.json();
                    if (errJson.error) msg = errJson.error;
                } catch (e2) { /* ignore */ }
                throw new Error(msg);
            }
            var blob = await resp.blob();
            var cd = resp.headers.get('Content-Disposition');
            var fname = 'lista_ligacao_cobranca.xlsx';
            if (cd) {
                var mfn = /filename\*?=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
                if (mfn) fname = decodeURIComponent(mfn[1].replace(/['"]/g, '').trim());
            }
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Não foi possível baixar a lista Excel: ' + (err.message || err));
        } finally {
            d.confirmExcel.innerHTML = prevHtml;
            d.confirmExcel.disabled = false;
        }
    }

    function renderListaExclusaoLigacao(titulo, itens, icone, cor) {
        if (!itens || !itens.length) return '';
        var lim = 12;
        var html = '<div class="auto-lig-excl-block" style="margin:10px 0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">';
        html = html.replace('div', 'div');
        html = '<div class="auto-lig-excl-block" style="margin:10px 0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">';
        html += '<div style="font-weight:600;font-size:0.88rem;margin-bottom:6px;color:' + cor + '">';
        html += '<i class="' + icone + '"></i> ' + esc(titulo) + ' (' + itens.length + ')</div>';
        html += '<ul style="margin:0;padding-left:18px;font-size:0.82rem;color:#475569;max-height:120px;overflow-y:auto">';
        itens.slice(0, lim).forEach(function (x) {
            var linha = esc((x.grupo || '') + '/' + (x.cota || '')) + ' — ' + esc(x.nome_devedor || '');
            if (x.motivo_label) linha += ' <em>(' + esc(x.motivo_label) + ')</em>';
            if (x.proxima_agenda) linha += ' — ' + esc(x.proxima_agenda);
            html += '<li style="margin:4px 0">' + linha + '</li>';
        });
        if (itens.length > lim) {
            html += '<li style="margin:4px 0;color:#64748b">… e mais ' + (itens.length - lim) + '</li>';
        }
        html += '</ul></div>';
        return html;
    }

    function mostrarConfirmacaoLigacao(nivel, contratos) {
        var d = dom();
        var meta = TIPO_META.ligacao;
        var nivelLabel = NIVEL_LABEL[nivel] || nivel;
        var ids = (contratos || []).map(function (c) { return c.id; }).filter(Boolean);

        setIcon(d.confirmIcon, meta.icone, meta.cor, meta.bgIcone);
        d.confirmTitle.textContent = meta.verboCurto + ' - bloco ' + nivelLabel;
        d.confirmGoLabel.textContent = 'Iniciar ligações sequenciais';
        d.confirmGo.style.background = meta.cor;
        d.confirmGo.style.borderColor = meta.cor;
        d.confirmGo.disabled = true;
        atualizarBotaoExcelConfirmacao('ligacao', nivel, contratos);

        d.confirmBody.innerHTML =
            '<p class="auto-helper-text"><i class="fa-solid fa-spinner fa-spin"></i> Analisando contratos do bloco…</p>';
        bindFechamentoConfirm();
        abrir(d.confirmOverlay);

        fetch(BLOCO_LIGACAO_PREVIEW_URL, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contrato_ids: ids, nivel: nivel }),
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (res) {
                var pv = res.j || {};
                if (!res.ok || pv.error) {
                    d.confirmBody.innerHTML =
                        '<p class="auto-helper-text" style="color:#b91c1c">' +
                        esc(pv.error || 'Falha ao analisar o bloco.') + '</p>';
                    d.confirmGo.disabled = true;
                    return;
                }
                var eleg = pv.ligacoes_previstas || 0;
                d.confirmGo.disabled = eleg === 0;

                var html =
                    '<div class="auto-info-row"><span class="auto-info-label">Bloco</span>' +
                    '<span class="auto-info-value auto-pill auto-pill-' + esc(nivel) + '">' +
                    esc(nivelLabel) + '</span></div>' +
                    '<div class="auto-info-row auto-info-total"><span class="auto-info-label">Ligações previstas</span>' +
                    '<span class="auto-info-value"><strong>' + eleg.toLocaleString('pt-BR') +
                    '</strong> <span style="font-weight:400;color:#64748b">(' +
                    (pv.elegiveis_contratos || 0).toLocaleString('pt-BR') + ' contratos)</span></span></div>' +
                    '<div class="auto-info-row auto-info-sub"><span class="auto-info-label">Total no bloco</span>' +
                    '<span class="auto-info-value auto-sub-value">' +
                    (pv.total_solicitados || 0).toLocaleString('pt-BR') + '</span></div>';

                html += renderListaExclusaoLigacao(
                    'Não serão discados — agendamento pendente',
                    pv.excluidos_agendamento,
                    'fa-solid fa-calendar-check',
                    '#b45309'
                );
                html += renderListaExclusaoLigacao(
                    'Não serão discados — já concluídos hoje (tramitação registrada)',
                    pv.excluidos_ja_tramitados_hoje,
                    'fa-solid fa-circle-check',
                    '#047857'
                );
                html += renderListaExclusaoLigacao(
                    'Sem telefone cadastrado',
                    pv.excluidos_sem_telefone,
                    'fa-solid fa-phone-slash',
                    '#6b7280'
                );
                html += '<p class="auto-helper-text">Contratos com <strong>sucesso e tramitação hoje</strong> não voltam ao bloco. ' +
                    'Os <strong>pulados</strong> continuam elegíveis. Ligações em segundo plano com bolha verde.</p>';

                d.confirmBody.innerHTML = html;

                d.confirmGo.onclick = function () {
                    fechar(d.confirmOverlay);
                    iniciarLigacaoSequencial(nivel, contratos);
                };
            })
            .catch(function (err) {
                d.confirmBody.innerHTML =
                    '<p class="auto-helper-text" style="color:#b91c1c">' + esc(err.message || String(err)) + '</p>';
                d.confirmGo.disabled = true;
            });
    }

    function mostrarConfirmacao(tipo, nivel, contratos, infoNeg) {
        var d = dom();
        var meta = TIPO_META[tipo];
        var nivelLabel = NIVEL_LABEL[nivel] || nivel;

        setIcon(d.confirmIcon, meta.icone, meta.cor, meta.bgIcone);
        d.confirmTitle.textContent = meta.verboCurto + ' - bloco ' + nivelLabel;
        if (tipo === 'ligacao') {
            d.confirmGoLabel.textContent = 'Iniciar ligações sequenciais';
        } else if (tipo === 'negativacao') {
            d.confirmGoLabel.textContent = 'Confirmar e negativar';
        } else {
            d.confirmGoLabel.textContent = 'Confirmar e disparar';
        }
        d.confirmGo.style.background = meta.cor;
        d.confirmGo.style.borderColor = meta.cor;
        atualizarBotaoExcelConfirmacao(tipo, nivel, contratos);

        var detalhe;
        if (tipo === 'ligacao') {
            detalhe = 'As ligações rodam <strong>em segundo plano</strong> (um número por vez, na ordem da lista). ' +
                'Após cada discagem é <strong>obrigatório</strong> registrar a tramitação antes da próxima. ' +
                'Acompanhe pela bolha verde no canto da tela.';
        } else if (tipo === 'sms' || tipo === 'email') {
            detalhe = 'O servidor envia apenas para contratos no <strong>roteiro automático</strong> ' +
                '(dias 0, 16, 31, 61 ou 85 desde o vencimento mais antigo em parcelas abertas) e que ' +
                '<strong>ainda não tiveram SMS nem e-mail registrados hoje</strong>. Os demais são ignorados.';
        } else if (tipo === 'negativacao') {
            detalhe = 'Serão negativadas no Serasa <strong>apenas as parcelas elegíveis</strong> ' +
                '(parcela mais antiga com <strong>31 a 89 dias</strong> de atraso, ' +
                'ainda não negativada, com 1 ou mais parcelas em aberto). ' +
                'Os demais foram <strong>descartados automaticamente</strong> abaixo.';
        } else {
            detalhe = 'Será disparado <strong>1 ' + meta.label.toLowerCase() + '</strong> para ' +
                '<strong>cada um</strong> dos contratos do bloco selecionado.';
        }

        // Breakdown extra exclusivo da negativação - mostra ao usuário
        // exatamente quantos foram descartados e por qual motivo.
        var breakdownHTML = '';
        if (tipo === 'negativacao' && infoNeg) {
            breakdownHTML =
                '<div class="auto-info-row auto-info-sub">' +
                '  <span class="auto-info-label">Total da lista</span>' +
                '  <span class="auto-info-value auto-sub-value">' +
                    infoNeg.totalOriginal.toLocaleString('pt-BR') + '</span>' +
                '</div>' +
                '<div class="auto-info-row auto-info-sub">' +
                '  <span class="auto-info-label"><i class="fa-solid fa-ban" style="color:#6b7280"></i> Já negativados (ignorados)</span>' +
                '  <span class="auto-info-value auto-sub-value">-' +
                    infoNeg.jaNegativados.toLocaleString('pt-BR') + '</span>' +
                '</div>' +
                '<div class="auto-info-row auto-info-sub">' +
                '  <span class="auto-info-label"><i class="fa-solid fa-clock" style="color:#f59e0b"></i> Fora da janela 31-89 dias</span>' +
                '  <span class="auto-info-value auto-sub-value">-' +
                    infoNeg.foraJanela.toLocaleString('pt-BR') + '</span>' +
                '</div>';
        }

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
            breakdownHTML +
            '<div class="auto-info-row auto-info-total">' +
            '  <span class="auto-info-label">' +
                (tipo === 'negativacao' ? 'Serão negativados' : 'Contratos alvo') +
            '  </span>' +
            '  <span class="auto-info-value"><strong>' +
                contratos.length.toLocaleString('pt-BR') + '</strong></span>' +
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
            if (d.confirmExcel && !d.confirmExcel._boundExcel) {
                d.confirmExcel._boundExcel = true;
                d.confirmExcel.addEventListener('click', function () {
                    downloadBlocoLigacaoExcel();
                });
            }
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && d.confirmOverlay.classList.contains('active')) {
                    fechar(d.confirmOverlay);
                }
            });
        }
    }

    // ---- Disparo em lote (SMS / E-mail / Negativação) -----------------------------
    function dispararLote(tipo, nivel, contratos) {
        var d = dom();
        var meta = TIPO_META[tipo];
        var ids = contratos.map(function (c) { return c.id; }).filter(Boolean);
        var endpoint = meta.endpoint || ('/api/automacao/' + tipo);

        setIcon(d.statusIcon, meta.icone, meta.cor, meta.bgIcone);
        d.statusTitle.textContent = meta.verboCurto + ' - enviando...';

        var msgLoad;
        if (tipo === 'negativacao') {
            msgLoad = 'Avaliando <strong>' + ids.length.toLocaleString('pt-BR') + '</strong> contrato(s) ' +
                      'e enviando os elegíveis ao Serasa...';
        } else {
            msgLoad = 'Disparando <strong>' + ids.length.toLocaleString('pt-BR') + '</strong> ' +
                      esc(meta.label.toLowerCase()) + ' para o bloco <strong>' +
                      esc(NIVEL_LABEL[nivel] || nivel) + '</strong>...';
        }

        d.statusBody.innerHTML =
            '<div class="auto-status-loading">' +
            '  <i class="fa-solid fa-spinner fa-spin"></i>' +
            '  <p>' + msgLoad + '</p>' +
            '  <small>Aguarde, não feche esta janela.</small>' +
            '</div>';
        d.statusFooter.innerHTML = '';
        d.statusCloseX.disabled = true;
        bindFechamentoStatus();
        abrir(d.statusOverlay);

        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ contrato_ids: ids, nivel: nivel }),
        })
            .then(parseResponseJson)
            .then(function (res) {
                d.statusCloseX.disabled = false;
                if (res.alertMsg) {
                    renderStatusErro(meta, res.alertMsg, tipo);
                    return;
                }
                var body = res.body || {};
                if (!res.ok || body.error) {
                    var errLote = body.error || 'Falha ao disparar.';
                    if (
                        (tipo === 'email' || tipo === 'sms_email') &&
                        (res.status === 403 || errLote === 'voce nao tem permissao')
                    ) {
                        fechar(d.statusOverlay);
                        window.alert('voce nao tem permissao');
                        return;
                    }
                    renderStatusErro(meta, errLote, tipo);
                    return;
                }
                renderStatusSucessoLote(meta, body, nivel, tipo);
            })
        .catch(function (err) {
            d.statusCloseX.disabled = false;
            renderStatusErro(meta, err.message || String(err), tipo);
        });
    }

    function renderStatusSucessoLote(meta, body, nivel, tipo) {
        var d = dom();
        var enviados = body.enviados != null ? body.enviados : 0;
        var falhas   = body.falhas   != null ? body.falhas   : 0;
        d.statusTitle.textContent = meta.verboCurto + ' - concluído';

        var statsHTML;
        if (tipo === 'negativacao') {
            // Estatísticas: enviados, já negativados, fora da janela, falhas.
            var jaNeg    = body.ja_negativados != null ? body.ja_negativados : 0;
            var foraJan  = body.fora_janela    != null ? body.fora_janela    : 0;
            statsHTML =
                '  <div class="auto-result-stats auto-result-stats-neg">' +
                '    <div class="auto-stat"><span class="auto-stat-num">' + enviados.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">Negativados</span></div>' +
                '    <div class="auto-stat"><span class="auto-stat-num" style="color:#6b7280">' + jaNeg.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">Já negativados</span></div>' +
                '    <div class="auto-stat"><span class="auto-stat-num" style="color:#f59e0b">' + foraJan.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">Fora da janela</span></div>' +
                '    <div class="auto-stat"><span class="auto-stat-num auto-stat-fail">' + falhas.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">Falhas</span></div>' +
                '  </div>';
        } else if (tipo === 'sms_email') {
            var es = body.envios_sms != null ? body.envios_sms : 0;
            var ee = body.envios_email != null ? body.envios_email : 0;
            statsHTML =
                '  <div class="auto-result-stats auto-result-stats-neg">' +
                '    <div class="auto-stat"><span class="auto-stat-num">' + es.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">SMS enviados</span></div>' +
                '    <div class="auto-stat"><span class="auto-stat-num">' + ee.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">E-mails enviados</span></div>' +
                '    <div class="auto-stat"><span class="auto-stat-num auto-stat-fail">' + falhas.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">Falhas</span></div>' +
                '  </div>';
        } else {
            statsHTML =
                '  <div class="auto-result-stats">' +
                '    <div class="auto-stat"><span class="auto-stat-num">' + enviados.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">Enviados</span></div>' +
                '    <div class="auto-stat"><span class="auto-stat-num auto-stat-fail">' + falhas.toLocaleString('pt-BR') +
                     '</span><span class="auto-stat-lbl">Falhas</span></div>' +
                '  </div>';
        }

        var titulo = tipo === 'negativacao' ? 'Negativação concluída' : 'Disparo concluído';
        d.statusBody.innerHTML =
            '<div class="auto-status-result auto-status-success">' +
            '  <div class="auto-result-icon"><i class="fa-solid fa-circle-check"></i></div>' +
            '  <h4>' + titulo + '</h4>' +
            statsHTML +
            (body.mock ? '<p class="auto-mock-note"><i class="fa-solid fa-flask"></i> Resposta simulada (a API definitiva ainda será integrada).</p>' : '') +
            '  <p class="auto-result-msg">' + esc(body.mensagem || '') + '</p>' +
            '</div>';
        d.statusFooter.innerHTML =
            '<button type="button" class="auto-btn-primary" data-close-status>' +
            '<i class="fa-solid fa-check"></i> Concluir</button>';
        d.statusFooter.querySelector('[data-close-status]').onclick = function () {
            fechar(d.statusOverlay);
            if (tipo === 'negativacao' && typeof window.CobrancaReload === 'function') {
                try { window.CobrancaReload(); } catch (e) { /* silencioso */ }
            }
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
                fechar(d.statusOverlay);
            });
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && d.statusOverlay.classList.contains('active') && !d.statusCloseX.disabled) {
                    fechar(d.statusOverlay);
                }
            });
        }
    }

    // ---- Ligação sequencial (background + bolha global) ---------------------------
    function iniciarLigacaoSequencial(nivel, contratos) {
        var ids = (contratos || []).map(function (c) { return c.id; }).filter(Boolean);
        if (!ids.length) {
            alert('Não há contratos neste bloco para ligar.');
            return;
        }
        fetch('/api/cobranca/ligacao-bloco/start', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contrato_ids: ids, nivel: nivel }),
        })
            .then(function (r) {
                return r.json().then(function (j) {
                    return { ok: r.ok, status: r.status, j: j };
                });
            })
            .then(function (res) {
                if (res.status === 409 && res.j && res.j.job_id) {
                    if (window.SajLigacaoBloco && window.SajLigacaoBloco.onJobStarted) {
                        window.SajLigacaoBloco.onJobStarted(res.j);
                    }
                    return;
                }
                if (!res.ok || res.j.error) {
                    alert(res.j.error || 'Não foi possível iniciar as ligações.');
                    return;
                }
                if (window.SajLigacaoBloco && window.SajLigacaoBloco.onJobStarted) {
                    window.SajLigacaoBloco.onJobStarted(res.j);
                } else {
                    alert('Sequência iniciada, mas o painel flutuante não carregou. Recarregue a página.');
                }
            })
            .catch(function (err) {
                alert('Falha ao iniciar ligações: ' + (err.message || err));
            });
    }

    // ---- Expor --------------------------------------------------------------------
    window.CobrancaAutomacoes = Auto;

})();
