/**
 * Tramitações no modal de contrato: lista + wizard guiado (fluxo) ou formulário legado (edição).
 */
(function (global) {
    'use strict';

    var TIPOS = ['ligacao', 'whatsapp', 'email'];
    var CPCS = ['sim', 'nao', 'parente', 'amigo', 'avalista'];

    var MOTIVOS_NA = [
        { v: 'caixa_postal', t: 'Caixa Postal' },
        { v: 'chama_nao_atende', t: 'Chama e Não atende' },
        { v: 'chamada_incompleta', t: 'Chamada Não Completada' },
        { v: 'ligacao_caiu', t: 'Ligação Caiu' },
        { v: 'numero_inexistente', t: 'Número não existe' }
    ];
    var CPC_QUEM = [
        { v: 'nao_consorciado_conhece', t: 'Não é o consorciado, o conhece, mas não é o responsável' },
        { v: 'nao_consorciado_nao_conhece', t: 'Não é consorciado e não conhece' }
    ];
    var CPC_QUAL = [
        { v: 'consorciado', t: 'Consorciado' },
        { v: 'terceiro', t: 'Terceiro' },
        { v: 'avalista', t: 'Avalista' }
    ];
    var STATUS_FINAL = [
        { v: 'alega_pagamento', t: 'Alega pagamento' },
        { v: 'agendamento', t: 'Agendamento' },
        { v: 'acordo_firmado', t: 'Acordo Firmado' },
        { v: 'sem_condicoes', t: 'Sem condições financeiras' },
        { v: 'sem_interesse', t: 'Sem interesse no pagamento' },
        { v: 'nao_confirma_dados', t: 'Não confirma os dados' },
        { v: 'atende_desliga', t: 'Atende e desliga' },
        { v: 'ligacao_muda', t: 'Ligação ficou muda' }
    ];

    function escAttr(s) {
        if (s == null) s = '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function cpcBadgeClass(cpc) {
        var x = String(cpc || '').toLowerCase();
        if (x === 'sim') return 'status-success';
        if (x === 'nao') return 'status-danger';
        return 'status-warning';
    }

    function toDateTimeLocal(val) {
        if (!val) return '';
        var s = String(val);
        if (s.indexOf('T') > 0) return s.substring(0, 16);
        if (s.indexOf(' ') > 0) return s.replace(' ', 'T').substring(0, 16);
        return s.length >= 16 ? s.substring(0, 16) : s;
    }

    function defaultNowLocal() {
        var d = new Date();
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        return y + '-' + m + '-' + day + 'T' + h + ':' + min;
    }

    function defaultOptions(o) {
        o = o || {};
        if (!o.esc) {
            o.esc = function (v) {
                if (v == null || v === '') return '-';
                var el = document.createElement('div');
                el.textContent = v;
                return el.innerHTML;
            };
        }
        if (!o.formatDateTime) {
            o.formatDateTime = function (v) { return v == null ? '-' : String(v); };
        }
        return o;
    }

    function formatBRL(n) {
        if (n == null || n === '') return 'R$ 0,00';
        var x = Number(n);
        if (isNaN(x)) return String(n);
        return x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function sumParcelasAberto(parcelas) {
        var t = 0;
        (parcelas || []).forEach(function (p) {
            if (String(p.status || '').toLowerCase() === 'aberto') {
                var v = parseFloat(p.valor_total);
                if (!isNaN(v)) t += v;
            }
        });
        return t;
    }

    function formatTelRow(t) {
        var d = t.ddd ? String(t.ddd).trim() : '';
        var n = t.numero ? String(t.numero).trim() : '';
        var raw = (d + n).replace(/\D/g, '');
        var disp = (d ? '(' + d + ') ' : '') + n;
        return { raw: raw || disp, label: disp };
    }

    function collectPhones(snapshot) {
        var out = [];
        function add(list, prefix) {
            (list || []).forEach(function (t) {
                var ft = formatTelRow(t);
                if (ft.raw) {
                    out.push({ value: ft.raw, label: (prefix || '') + ft.label });
                }
            });
        }
        add(snapshot.devedor_telefones, 'Devedor ');
        add(snapshot.avalista_telefones, 'Avalista ');
        return out;
    }

    function parseFluxoJson(row) {
        if (!row || !row.fluxo_json) return null;
        try {
            return typeof row.fluxo_json === 'object' ? row.fluxo_json : JSON.parse(row.fluxo_json);
        } catch (e) {
            return null;
        }
    }

    function buildSection(tramitacoes, contratoId, options) {
        var o = defaultOptions(options);
        var esc = o.esc;
        var formatDateTime = o.formatDateTime;
        var list = tramitacoes || [];
        var n = list.length;
        var cid = String(contratoId);

        var html = '';
        html += '<div class="detail-section tramitacao-section" data-contrato-id="' + escAttr(cid) + '">';
        html += '<h3><i class="fa-solid fa-comments"></i> Tramitações <span class="tramitacoes-count">(' + n + ')</span></h3>';
        html += '<div class="tramitacao-container">';

        if (n === 0) {
            html += '<p class="tramitacao-empty-hint" style="margin:0 0 12px;font-size:0.9rem;color:var(--text-muted, #6b7280)">Nenhuma tramitação registrada ainda.</p>';
        } else {
            html += '<div class="table-responsive"><table class="styled-table modal-table tramitacao-table"><thead><tr>';
            html += '<th>Data</th><th>Resultado</th><th>Resumo</th><th>Funcionário</th><th class="text-right" style="white-space:nowrap">Ações</th>';
            html += '</tr></thead><tbody>';
            list.forEach(function (t) {
                var fluxo = parseFluxoJson(t);
                var pl = {
                    id: t.id,
                    tipo: t.tipo,
                    cpc: t.cpc,
                    data: t.data,
                    descricao: t.descricao != null ? t.descricao : '',
                    fluxo_json: null
                };
                if (!fluxo) {
                    pl.fluxo_legacy = true;
                }
                var payload = escAttr(JSON.stringify(pl));
                var resultado = fluxo
                    ? esc(t.status_tramitacao || '—')
                    : '<span class="status-badge status-active">' + esc(t.tipo) + '</span>';
                var resumo;
                if (fluxo) {
                    resumo = formatBRL(fluxo.carteira_devendo) + ' · Discado: ' + esc(fluxo.numero_discado || '—');
                } else {
                    resumo = '<span class="status-badge ' + cpcBadgeClass(t.cpc) + '">CPC ' + esc(t.cpc) + '</span>';
                }
                html += '<tr class="tramitacao-row-main' + (fluxo ? ' tramitacao-row-fluxo' : '') + '" data-tramit-payload="' + payload + '" data-fluxo="' + (fluxo ? '1' : '0') + '">';
                html += '<td>' + formatDateTime(t.data) + '</td>';
                html += '<td>' + resultado + '</td>';
                html += '<td style="max-width:280px;font-size:0.88rem">' + resumo + '</td>';
                html += '<td>' + esc(t.funcionario_nome) + '</td>';
                html += '<td class="text-right" style="white-space:nowrap">';
                if (!fluxo) {
                    html += '<button type="button" class="action-btn btn-sm btn-tramit-edit" title="Editar"><i class="fa-solid fa-pen"></i></button> ';
                }
                html += '<button type="button" class="action-btn btn-sm btn-tramit-del" title="Excluir" style="color:#b91c1c"><i class="fa-solid fa-trash"></i></button>';
                html += '</td></tr>';
                html += '<tr class="tramitacao-row-desc"><td colspan="5">';
                html += '<span class="tramitacao-desc-label">Detalhes:</span> ';
                html += '<span class="tramitacao-desc-text">' + esc(t.descricao) + '</span>';
                html += '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        html += '<div class="tramitacao-toolbar" style="margin-top:12px">';
        html += '<button type="button" class="action-btn btn-tramit-nova" style="background:var(--color-accent, #1e3a5f);color:#fff;border:0;padding:8px 14px;border-radius:6px">';
        html += '<i class="fa-solid fa-plus"></i> Nova tramitação</button></div>';

        var inpSt = 'width:100%;max-width:100%;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px;box-sizing:border-box;font:inherit';

        html += '<div class="tramitacao-form-panel tramitacao-wizard-panel" data-tramit-wizard-wrap style="display:none;margin-top:16px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc">';
        html += '<div class="tramit-wizard-head" style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px">';
        html += '<h4 class="tramit-wizard-title" style="margin:0;font-size:1rem">Nova tramitação (ligação)</h4>';
        html += '<button type="button" class="action-btn tramit-wiz-close" style="border:1px solid #cbd5e1;background:#fff;font-size:0.85rem">Fechar</button>';
        html += '</div>';
        html += '<div class="tramit-wizard-root" data-tramit-wizard-root></div>';
        html += '<p class="tramit-wizard-msg" style="margin:8px 0 0;font-size:0.85rem;color:#b91c1c;display:none"></p>';
        html += '</div>';

        html += '<div class="tramitacao-form-panel tramitacao-form-legacy" data-tramit-form-wrap style="display:none;margin-top:16px;padding:16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc">';
        html += '<h4 class="tramit-form-title" style="margin:0 0 12px;font-size:0.95rem">Editar tramitação (legado)</h4>';
        html += '<input type="hidden" class="tramit-form-id" value="">';
        html += '<div style="display:grid;gap:12px;max-width:100%">';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">Data e hora</label>';
        html += '<input class="tramit-in-data" type="datetime-local" required style="max-width:320px;' + inpSt + '"/></div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:end">';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">Tipo</label>';
        html += '<select class="tramit-sel-tipo" style="min-width:160px;' + inpSt + '">';
        TIPOS.forEach(function (tt) { html += '<option value="' + tt + '">' + tt + '</option>'; });
        html += '</select></div>';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">CPC</label>';
        html += '<select class="tramit-sel-cpc" style="min-width:160px;' + inpSt + '">';
        CPCS.forEach(function (c) { html += '<option value="' + c + '">' + c + '</option>'; });
        html += '</select></div></div>';
        html += '<div><label class="data-label" style="display:block;margin-bottom:4px">Descrição</label>';
        html += '<textarea class="tramit-ta-desc" rows="3" style="' + inpSt + '"></textarea></div>';
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
        html += '<button type="button" class="action-btn tramit-btn-salvar-legacy" style="background:var(--color-accent, #1e3a5f);color:#fff;border:0">Salvar</button>';
        html += '<button type="button" class="action-btn tramit-btn-cancelar-legacy" style="border:1px solid #cbd5e1;background:#fff">Cancelar</button>';
        html += '</div>';
        html += '<p class="tramit-form-msg" style="margin:8px 0 0;font-size:0.85rem;color:#b91c1c;display:none"></p>';
        html += '</div></div>';

        html += '</div></div>';
        return html;
    }

    function wizardMarkup() {
        var html = '';
        html += '<div class="tramit-wizard-steps">';
        html += '<div class="tramit-wiz-block" data-wiz="base">';
        html += '<p class="tramit-wiz-kicker">Preencha na ordem. Carteira = soma das parcelas em aberto.</p>';
        html += '<div class="tramit-wiz-field"><label>Carteira (total devendo)</label>';
        html += '<input type="text" class="tramit-wiz-carteira" readonly /></div>';
        html += '<div class="tramit-wiz-field"><label>Discado — número ligado <span class="req">*</span></label>';
        html += '<select class="tramit-wiz-discado-sel"><option value="">Selecione ou digite abaixo</option></select>';
        html += '<input type="text" class="tramit-wiz-discado-out" placeholder="Ou informe o número manualmente" /></div>';
        html += '<button type="button" class="action-btn tramit-wiz-next-base">Continuar</button>';
        html += '</div>';

        html += '<div class="tramit-wiz-block" data-wiz="atendido" hidden>';
        html += '<div class="tramit-wiz-field"><label>1. Atendido? <span class="req">*</span></label>';
        html += '<div class="tramit-wiz-chips">';
        html += '<button type="button" class="tramit-chip" data-atendido="sim">Sim</button>';
        html += '<button type="button" class="tramit-chip" data-atendido="nao">Não</button>';
        html += '</div></div>';
        html += '<div class="tramit-wiz-field tramit-wiz-motivo-wrap" hidden>';
        html += '<label>Motivo (ligação não atendida)</label><select class="tramit-wiz-motivo">';
        html += '<option value="">Selecione…</option>';
        MOTIVOS_NA.forEach(function (m) {
            html += '<option value="' + m.v + '">' + m.t + '</option>';
        });
        html += '</select></div>';
        html += '<div class="tramit-wiz-field tramit-wiz-indef-wrap" hidden>';
        html += '<p class="tramit-wiz-hint">Atendeu e desligou sem registrar o restante?</p>';
        html += '<button type="button" class="action-btn tramit-wiz-indef secondary">Registrar como indefinido</button>';
        html += '</div>';
        html += '<div class="tramit-wiz-nav"><button type="button" class="action-btn tramit-wiz-back secondary">Voltar</button>';
        html += '<button type="button" class="action-btn tramit-wiz-next-atend">Continuar</button></div>';
        html += '</div>';

        html += '<div class="tramit-wiz-block" data-wiz="cpc1" hidden>';
        html += '<div class="tramit-wiz-field"><label>2. CPC — contato com a pessoa certa? <span class="req">*</span></label>';
        html += '<div class="tramit-wiz-chips">';
        html += '<button type="button" class="tramit-chip" data-cpcok="sim">Sim</button>';
        html += '<button type="button" class="tramit-chip" data-cpcok="nao">Não</button>';
        html += '</div></div>';
        html += '<div class="tramit-wiz-field tramit-wiz-cpc-quem-wrap" hidden>';
        html += '<label>Quem atendeu?</label><select class="tramit-wiz-cpc-quem">';
        html += '<option value="">Selecione…</option>';
        CPC_QUEM.forEach(function (m) { html += '<option value="' + m.v + '">' + m.t + '</option>'; });
        html += '</select>';
        html += '<label style="margin-top:10px">Descrição (opcional)</label>';
        html += '<textarea class="tramit-wiz-cpc-etapa-desc" rows="2" placeholder="Detalhe o que ocorreu nesta etapa"></textarea>';
        html += '</div>';
        html += '<div class="tramit-wiz-nav"><button type="button" class="action-btn tramit-wiz-back secondary">Voltar</button>';
        html += '<button type="button" class="action-btn tramit-wiz-next-cpc1">Continuar</button></div>';
        html += '</div>';

        html += '<div class="tramit-wiz-block" data-wiz="cpc2" hidden>';
        html += '<div class="tramit-wiz-field"><label>3. Qual CPC foi atendido? <span class="req">*</span></label>';
        html += '<select class="tramit-wiz-cpc-qual">';
        html += '<option value="">Selecione…</option>';
        CPC_QUAL.forEach(function (m) { html += '<option value="' + m.v + '">' + m.t + '</option>'; });
        html += '</select></div>';
        html += '<div class="tramit-wiz-nav"><button type="button" class="action-btn tramit-wiz-back secondary">Voltar</button>';
        html += '<button type="button" class="action-btn tramit-wiz-next-cpc2">Continuar</button></div>';
        html += '</div>';

        html += '<div class="tramit-wiz-block" data-wiz="status" hidden>';
        html += '<div class="tramit-wiz-field"><label>4. Status <span class="req">*</span></label>';
        html += '<select class="tramit-wiz-status-fin">';
        html += '<option value="">Selecione…</option>';
        STATUS_FINAL.forEach(function (m) { html += '<option value="' + m.v + '">' + m.t + '</option>'; });
        html += '</select></div>';
        html += '<div class="tramit-wiz-extra-agenda" hidden>';
        html += '<label>Data e hora do retorno (agenda)</label>';
        html += '<input type="datetime-local" class="tramit-wiz-ag-data" />';
        html += '<label style="margin-top:8px">Título da atividade</label>';
        html += '<input type="text" class="tramit-wiz-ag-titulo" placeholder="Ex.: Retorno cobrança" />';
        html += '</div>';
        html += '<div class="tramit-wiz-extra-acordo" hidden>';
        html += '<label>Data prevista do pagamento</label>';
        html += '<input type="datetime-local" class="tramit-wiz-acordo-data" />';
        html += '<label style="margin-top:8px">Quantidade de parcelas no acordo</label>';
        html += '<input type="number" class="tramit-wiz-acordo-qtd" min="1" step="1" placeholder="Ex.: 3" />';
        html += '</div>';
        html += '<div class="tramit-wiz-nav"><button type="button" class="action-btn tramit-wiz-back secondary">Voltar</button>';
        html += '<button type="button" class="action-btn tramit-wiz-next-status">Continuar</button></div>';
        html += '</div>';

        html += '<div class="tramit-wiz-block" data-wiz="final" hidden>';
        html += '<div class="tramit-wiz-field"><label>Descrição final (opcional)</label>';
        html += '<textarea class="tramit-wiz-desc-final" rows="4" placeholder="Resumo do que aconteceu na ligação"></textarea></div>';
        html += '<div class="tramit-wiz-nav"><button type="button" class="action-btn tramit-wiz-back secondary">Voltar</button>';
        html += '<button type="button" class="action-btn tramit-wiz-submit" style="background:#047857;color:#fff;border:0">Salvar tramitação</button></div>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    function showOnly(root, name) {
        root.querySelectorAll('.tramit-wiz-block').forEach(function (el) {
            var w = el.getAttribute('data-wiz');
            el.hidden = w !== name;
        });
    }

    function attachModal(root, contratoId, options) {
        var o = defaultOptions(options);
        var onReload = o.onReload;
        if (!onReload) return;

        var section = root.querySelector('.tramitacao-section');
        if (!section) return;

        var wizardWrap = section.querySelector('[data-tramit-wizard-wrap]');
        var wizardRoot = section.querySelector('[data-tramit-wizard-root]');
        var wizardMsg = section.querySelector('.tramit-wizard-msg');
        var formWrap = section.querySelector('[data-tramit-form-wrap]');
        var titleEl = formWrap ? formWrap.querySelector('.tramit-form-title') : null;
        var idInput = formWrap ? formWrap.querySelector('.tramit-form-id') : null;
        var inData = formWrap ? formWrap.querySelector('.tramit-in-data') : null;
        var selTipo = formWrap ? formWrap.querySelector('.tramit-sel-tipo') : null;
        var selCpc = formWrap ? formWrap.querySelector('.tramit-sel-cpc') : null;
        var taDesc = formWrap ? formWrap.querySelector('.tramit-ta-desc') : null;
        var msgEl = formWrap ? formWrap.querySelector('.tramit-form-msg') : null;
        var btnNova = section.querySelector('.btn-tramit-nova');
        var btnSalvarLegacy = formWrap ? formWrap.querySelector('.tramit-btn-salvar-legacy') : null;
        var btnCancelarLegacy = formWrap ? formWrap.querySelector('.tramit-btn-cancelar-legacy') : null;

        var snapshot = null;
        var state = {};

        function showWizardErr(t) {
            if (!wizardMsg) return;
            wizardMsg.textContent = t || '';
            wizardMsg.style.display = t ? 'block' : 'none';
        }

        function fetchSnapshot(cb) {
            if (snapshot) {
                cb(snapshot);
                return;
            }
            fetch('/api/contrato/' + encodeURIComponent(contratoId), { credentials: 'same-origin' })
                .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
                .then(function (res) {
                    if (!res.ok || !res.j) {
                        showWizardErr((res.j && res.j.error) || 'Não foi possível carregar o contrato.');
                        return;
                    }
                    snapshot = res.j;
                    cb(snapshot);
                })
                .catch(function () { showWizardErr('Falha de rede ao carregar dados.'); });
        }

        function fillWizardDom() {
            if (!wizardRoot) return;
            wizardRoot.innerHTML = wizardMarkup();
            var wr = wizardRoot.querySelector('.tramit-wiz-root') || wizardRoot;

            var carteiraVal = sumParcelasAberto(snapshot.parcelas);
            var inpCart = wizardRoot.querySelector('.tramit-wiz-carteira');
            if (inpCart) inpCart.value = formatBRL(carteiraVal);

            var selDisc = wizardRoot.querySelector('.tramit-wiz-discado-sel');
            var phones = collectPhones(snapshot);
            phones.forEach(function (p) {
                var opt = document.createElement('option');
                opt.value = p.value;
                opt.textContent = p.label;
                selDisc.appendChild(opt);
            });

            state = {
                carteira_devendo: carteiraVal,
                atendido: null,
                modo_indefinido: false,
                motivo_nao_atendido: null,
                cpc_correto: null,
                cpc_quem: null,
                cpc_etapa_descricao: '',
                cpc_qual: null,
                status_final: null
            };

            function syncDiscado() {
                var out = wizardRoot.querySelector('.tramit-wiz-discado-out');
                var v = (selDisc && selDisc.value) ? selDisc.value : '';
                if (!v && out) v = out.value.trim();
                state.numero_discado = v;
            }

            wizardRoot.querySelector('.tramit-wiz-next-base').addEventListener('click', function () {
                showWizardErr('');
                syncDiscado();
                if (!state.numero_discado) {
                    showWizardErr('Informe o número discado.');
                    return;
                }
                state.carteira_devendo = carteiraVal;
                showOnly(wizardRoot, 'atendido');
                wizardRoot.querySelector('.tramit-wiz-motivo-wrap').hidden = true;
                wizardRoot.querySelector('.tramit-wiz-indef-wrap').hidden = true;
            });

            wizardRoot.querySelectorAll('[data-atendido]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    state.atendido = btn.getAttribute('data-atendido');
                    wizardRoot.querySelectorAll('[data-atendido]').forEach(function (b) {
                        b.classList.toggle('is-selected', b === btn);
                    });
                    var mw = wizardRoot.querySelector('.tramit-wiz-motivo-wrap');
                    var iw = wizardRoot.querySelector('.tramit-wiz-indef-wrap');
                    if (state.atendido === 'nao') {
                        if (mw) mw.hidden = false;
                        if (iw) iw.hidden = true;
                    } else {
                        if (mw) mw.hidden = true;
                        if (iw) iw.hidden = false;
                    }
                });
            });

            wizardRoot.querySelector('.tramit-wiz-next-atend').addEventListener('click', function () {
                showWizardErr('');
                if (!state.atendido) {
                    showWizardErr('Indique se foi atendido.');
                    return;
                }
                if (state.atendido === 'nao') {
                    var mv = wizardRoot.querySelector('.tramit-wiz-motivo');
                    state.motivo_nao_atendido = mv ? mv.value : '';
                    if (!state.motivo_nao_atendido) {
                        showWizardErr('Selecione o motivo.');
                        return;
                    }
                    state.modo_indefinido = false;
                    showOnly(wizardRoot, 'final');
                    return;
                }
                state.modo_indefinido = false;
                showOnly(wizardRoot, 'cpc1');
            });

            wizardRoot.querySelector('.tramit-wiz-indef').addEventListener('click', function () {
                state.modo_indefinido = true;
                showOnly(wizardRoot, 'final');
            });

            wizardRoot.querySelectorAll('[data-cpcok]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    state.cpc_correto = btn.getAttribute('data-cpcok');
                    wizardRoot.querySelectorAll('[data-cpcok]').forEach(function (b) {
                        b.classList.toggle('is-selected', b === btn);
                    });
                    var qw = wizardRoot.querySelector('.tramit-wiz-cpc-quem-wrap');
                    if (qw) qw.hidden = state.cpc_correto !== 'nao';
                });
            });

            wizardRoot.querySelector('.tramit-wiz-next-cpc1').addEventListener('click', function () {
                showWizardErr('');
                if (!state.cpc_correto) {
                    showWizardErr('Responda CPC.');
                    return;
                }
                if (state.cpc_correto === 'nao') {
                    var sq = wizardRoot.querySelector('.tramit-wiz-cpc-quem');
                    state.cpc_quem = sq ? sq.value : '';
                    var td = wizardRoot.querySelector('.tramit-wiz-cpc-etapa-desc');
                    state.cpc_etapa_descricao = td ? td.value.trim() : '';
                    if (!state.cpc_quem) {
                        showWizardErr('Selecione quem atendeu.');
                        return;
                    }
                    showOnly(wizardRoot, 'status');
                    return;
                }
                showOnly(wizardRoot, 'cpc2');
            });

            wizardRoot.querySelector('.tramit-wiz-next-cpc2').addEventListener('click', function () {
                var sq = wizardRoot.querySelector('.tramit-wiz-cpc-qual');
                state.cpc_qual = sq ? sq.value : '';
                if (!state.cpc_qual) {
                    showWizardErr('Selecione qual CPC foi atendido.');
                    return;
                }
                showOnly(wizardRoot, 'status');
            });

            function toggleStatusExtras() {
                var sf = wizardRoot.querySelector('.tramit-wiz-status-fin');
                var v = sf ? sf.value : '';
                var ag = wizardRoot.querySelector('.tramit-wiz-extra-agenda');
                var ac = wizardRoot.querySelector('.tramit-wiz-extra-acordo');
                if (ag) ag.hidden = v !== 'agendamento';
                if (ac) ac.hidden = v !== 'acordo_firmado';
            }

            wizardRoot.querySelector('.tramit-wiz-status-fin').addEventListener('change', toggleStatusExtras);

            wizardRoot.querySelector('.tramit-wiz-next-status').addEventListener('click', function () {
                showWizardErr('');
                var sf = wizardRoot.querySelector('.tramit-wiz-status-fin');
                state.status_final = sf ? sf.value : '';
                if (!state.status_final) {
                    showWizardErr('Selecione o status.');
                    return;
                }
                if (state.status_final === 'agendamento') {
                    var ad = wizardRoot.querySelector('.tramit-wiz-ag-data');
                    if (!ad || !ad.value) {
                        showWizardErr('Informe data e hora do retorno.');
                        return;
                    }
                    state.agenda_retorno_data = ad.value;
                    var tit = wizardRoot.querySelector('.tramit-wiz-ag-titulo');
                    state.agenda_retorno_atividade = tit ? tit.value.trim() : '';
                } else {
                    state.agenda_retorno_data = null;
                    state.agenda_retorno_atividade = '';
                }
                if (state.status_final === 'acordo_firmado') {
                    var acd = wizardRoot.querySelector('.tramit-wiz-acordo-data');
                    var acq = wizardRoot.querySelector('.tramit-wiz-acordo-qtd');
                    if (!acd || !acd.value) {
                        showWizardErr('Informe a data prevista do pagamento.');
                        return;
                    }
                    state.acordo_data_pagamento = acd.value;
                    state.acordo_qtd_parcelas = acq ? parseInt(acq.value, 10) : 0;
                    if (!state.acordo_qtd_parcelas || state.acordo_qtd_parcelas < 1) {
                        showWizardErr('Informe a quantidade de parcelas (≥ 1).');
                        return;
                    }
                } else {
                    state.acordo_data_pagamento = null;
                    state.acordo_qtd_parcelas = null;
                }
                showOnly(wizardRoot, 'final');
            });

            wizardRoot.querySelector('.tramit-wiz-submit').addEventListener('click', function () {
                var df = wizardRoot.querySelector('.tramit-wiz-desc-final');
                state.descricao_final = df ? df.value.trim() : '';
                var body = {
                    carteira_devendo: state.carteira_devendo,
                    numero_discado: state.numero_discado,
                    atendido: state.atendido,
                    modo_indefinido: !!state.modo_indefinido,
                    motivo_nao_atendido: state.motivo_nao_atendido || undefined,
                    cpc_correto: state.cpc_correto || undefined,
                    cpc_quem: state.cpc_quem || undefined,
                    cpc_etapa_descricao: state.cpc_etapa_descricao || undefined,
                    cpc_qual: state.cpc_qual || undefined,
                    status_final: state.status_final || undefined,
                    agenda_retorno_data: state.agenda_retorno_data,
                    agenda_retorno_atividade: state.agenda_retorno_atividade,
                    acordo_data_pagamento: state.acordo_data_pagamento,
                    acordo_qtd_parcelas: state.acordo_qtd_parcelas,
                    descricao_final: state.descricao_final
                };
                if (state.atendido === 'nao') {
                    body.modo_indefinido = false;
                    delete body.cpc_correto;
                    delete body.status_final;
                    delete body.modo_indefinido;
                }
                if (state.modo_indefinido) {
                    body.atendido = 'sim';
                    body.modo_indefinido = true;
                    delete body.cpc_correto;
                    delete body.status_final;
                    delete body.motivo_nao_atendido;
                }
                var btn = wizardRoot.querySelector('.tramit-wiz-submit');
                if (btn) btn.disabled = true;
                fetch('/api/contrato/' + encodeURIComponent(contratoId) + '/tramitacao/fluxo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    credentials: 'same-origin'
                })
                    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
                    .then(function (res) {
                        if (!res.ok) {
                            showWizardErr((res.j && res.j.error) || 'Erro ao salvar.');
                            return;
                        }
                        if (wizardWrap) wizardWrap.style.display = 'none';
                        onReload();
                    })
                    .catch(function () { showWizardErr('Falha de conexão.'); })
                    .then(function () { if (btn) btn.disabled = false; });
            });

            wizardRoot.querySelectorAll('.tramit-wiz-back').forEach(function (bt) {
                bt.addEventListener('click', function () {
                    var vis = wizardRoot.querySelector('.tramit-wiz-block:not([hidden])');
                    var w = vis ? vis.getAttribute('data-wiz') : '';
                    if (w === 'atendido') showOnly(wizardRoot, 'base');
                    else if (w === 'cpc1') showOnly(wizardRoot, 'atendido');
                    else if (w === 'cpc2') showOnly(wizardRoot, 'cpc1');
                    else if (w === 'status') {
                        if (state.cpc_correto === 'sim') showOnly(wizardRoot, 'cpc2');
                        else showOnly(wizardRoot, 'cpc1');
                    } else if (w === 'final') {
                        if (state.atendido === 'nao' || state.modo_indefinido) {
                            showOnly(wizardRoot, 'atendido');
                        } else {
                            showOnly(wizardRoot, 'status');
                        }
                    }
                });
            });

            showOnly(wizardRoot, 'base');
        }

        function openWizard() {
            showWizardErr('');
            if (wizardWrap) wizardWrap.style.display = 'block';
            if (formWrap) formWrap.style.display = 'none';
            fetchSnapshot(function () {
                fillWizardDom();
                var cls = wizardWrap ? wizardWrap.querySelector('.tramit-wiz-close') : null;
                if (cls) {
                    cls.onclick = function () {
                        hideWizard();
                    };
                }
            });
        }

        function hideWizard() {
            if (wizardWrap) wizardWrap.style.display = 'none';
        }

        function showFormLegacy() {
            if (formWrap) formWrap.style.display = 'block';
            hideWizard();
        }

        function hideFormLegacy() {
            if (formWrap) formWrap.style.display = 'none';
            if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
        }

        function openNovo() {
            openWizard();
        }

        function openEditarLegacy(payload) {
            if (idInput) idInput.value = String(payload.id);
            if (titleEl) titleEl.textContent = 'Editar tramitação (legado)';
            if (inData) inData.value = toDateTimeLocal(payload.data);
            if (selTipo && payload.tipo) selTipo.value = String(payload.tipo);
            if (selCpc && payload.cpc) selCpc.value = String(payload.cpc);
            if (taDesc) taDesc.value = payload.descricao != null ? String(payload.descricao) : '';
            if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
            showFormLegacy();
        }

        if (btnNova) {
            btnNova.addEventListener('click', function (e) {
                e.preventDefault();
                openNovo();
            });
        }
        if (btnCancelarLegacy) {
            btnCancelarLegacy.addEventListener('click', function (e) {
                e.preventDefault();
                hideFormLegacy();
            });
        }

        section.addEventListener('click', function (ev) {
            var t = ev.target;
            var ed = t && t.closest && t.closest('.btn-tramit-edit');
            if (ed) {
                ev.preventDefault();
                var tr = ed.closest('tr');
                if (!tr) return;
                if (tr.getAttribute('data-fluxo') === '1') {
                    alert('Tramitações registradas pelo fluxo guiado não podem ser editadas (apenas excluídas).');
                    return;
                }
                var raw = tr.getAttribute('data-tramit-payload');
                if (!raw) return;
                var payload;
                try { payload = JSON.parse(raw); } catch (err) { return; }
                openEditarLegacy(payload);
                return;
            }
            var de = t && t.closest && t.closest('.btn-tramit-del');
            if (de) {
                ev.preventDefault();
                var tr2 = de.closest('tr');
                if (!tr2) return;
                var raw2 = tr2.getAttribute('data-tramit-payload');
                if (!raw2) return;
                var p2;
                try { p2 = JSON.parse(raw2); } catch (e2) { return; }
                if (!p2 || !p2.id) return;
                if (!global.confirm('Excluir esta tramitação?')) return;
                de.disabled = true;
                fetch('/api/tramitacao/' + encodeURIComponent(p2.id), { method: 'DELETE', credentials: 'same-origin' })
                    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j, status: r.status }; }); })
                    .then(function (res) {
                        if (!res.ok) {
                            var err = (res.j && (res.j.error || res.j.message)) || 'Erro ao excluir';
                            alert(err);
                            return;
                        }
                        onReload();
                    })
                    .catch(function () { alert('Falha de conexao ao excluir.'); })
                    .then(function () { de.disabled = false; });
            }
        });

        if (btnSalvarLegacy) {
            btnSalvarLegacy.addEventListener('click', function (e) {
                e.preventDefault();
                if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
                var idVal = idInput && idInput.value;
                if (!inData || !inData.value) {
                    if (msgEl) { msgEl.textContent = 'Informe data e hora.'; msgEl.style.display = 'block'; }
                    return;
                }
                var body = {
                    tipo: selTipo ? selTipo.value : 'ligacao',
                    cpc: selCpc ? selCpc.value : 'nao',
                    data: inData.value,
                    descricao: taDesc ? taDesc.value : ''
                };
                var method = idVal ? 'PUT' : 'POST';
                var url = idVal
                    ? '/api/tramitacao/' + encodeURIComponent(idVal)
                    : '/api/contrato/' + encodeURIComponent(contratoId) + '/tramitacao';
                btnSalvarLegacy.disabled = true;
                fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                    credentials: 'same-origin',
                })
                    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
                    .then(function (res) {
                        if (!res.ok) {
                            var err = (res.j && (res.j.error || res.j.message)) || 'Nao foi possivel salvar.';
                            if (msgEl) { msgEl.textContent = err; msgEl.style.display = 'block'; }
                            return;
                        }
                        hideFormLegacy();
                        onReload();
                    })
                    .catch(function () {
                        if (msgEl) { msgEl.textContent = 'Falha de conexao ao salvar.'; msgEl.style.display = 'block'; }
                    })
                    .then(function () { btnSalvarLegacy.disabled = false; });
            });
        }
    }

    global.TramitacoesDetalhe = { buildSection: buildSection, attachModal: attachModal };
})(typeof window !== 'undefined' ? window : this);
