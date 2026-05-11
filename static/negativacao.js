document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var sortAtivos = { col: 'data', dir: 'desc' };
    /** Ordenacao independente: blocos Negativados e Positivados (Carteira). */
    var sortCarteiraBloco = {
        negativados: { col: 'data', dir: 'desc' },
        positivados: { col: 'data', dir: 'desc' }
    };

    var cfg = window.NEGATIVACAO_PAGE_CONFIG || {};
    var STORAGE_KEY = 'negativacao_modo_cobranca';

    /** Deep link ex.: /negativacao?carteira=1&pesquisar=1&funcionario_id= (painel Cobrança). */
    var negUrlBootstrap = (function () {
        try {
            var p = new URLSearchParams(window.location.search);
            return {
                forceCarteira: p.get('carteira') === '1' ||
                    (p.get('modo') || '').toLowerCase() === 'carteira',
                autoPesquisar: p.get('pesquisar') === '1' || p.get('auto') === '1',
                funcionarioId: (p.get('funcionario_id') || p.get('operador') || '').trim()
            };
        } catch (err) {
            return {
                forceCarteira: false,
                autoPesquisar: false,
                funcionarioId: ''
            };
        }
    }());

    var negDeepLinkOperadorId = negUrlBootstrap.funcionarioId || null;
    var negStripDeepLinkAfterLoad = !!(negUrlBootstrap.forceCarteira && negUrlBootstrap.autoPesquisar);

    function stripNegativacaoDeepLinkParams() {
        try {
            var u = new URL(window.location.href);
            if (!u.search) return;
            var keys = [
                'carteira',
                'pesquisar',
                'auto',
                'modo',
                'funcionario_id',
                'operador',
                'sem_operador_cobranca'
            ];
            var touched = false;
            keys.forEach(function (k) {
                if (u.searchParams.has(k)) {
                    u.searchParams.delete(k);
                    touched = true;
                }
            });
            if (!touched) return;
            var q = u.searchParams.toString();
            history.replaceState({}, '', u.pathname + (q ? '?' + q : '') + u.hash);
        } catch (e) { /* ignore */ }
    }

    /** Apos populateOperadorSelect: aplica operador vindo da Cobrança e pede novo load se necessário. */
    function tryApplyDeepLinkOperador() {
        if (!negDeepLinkOperadorId || !modoCobranca || !negOperadorCobranca || cfg.perfilCobranca) {
            negDeepLinkOperadorId = null;
            return false;
        }
        var wanted = String(negDeepLinkOperadorId).trim();
        negDeepLinkOperadorId = null;
        if (!wanted) return false;
        var ok = false;
        for (var i = 0; i < negOperadorCobranca.options.length; i++) {
            if (negOperadorCobranca.options[i].value === wanted) {
                ok = true;
                break;
            }
        }
        if (!ok) return false;
        if (negOperadorCobranca.value !== wanted) {
            negOperadorCobranca.value = wanted;
            return true;
        }
        return false;
    }

    function initialModoCobranca() {
        if (negUrlBootstrap.forceCarteira) {
            sessionStorage.setItem(STORAGE_KEY, '1');
            return true;
        }
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw === '1') return true;
        if (raw === '0') return false;
        if (cfg.defaultFuncionarioCobrancaId != null) return true;
        return false;
    }

    var modoCobranca = initialModoCobranca();
    /** Apos clicar em Pesquisar, lista todas as parcelas ativas (sem limite 20). */
    var negAtivosListagemCompleta = false;
    /** Ultimo JSON da listagem em carteira cobranca (blocos Negativados / Positivados). */
    var negUltimoPayloadCobranca = null;
    /** Linhas da visao geral repartidas entre os dois paineis colapsaveis (bulk actions). */
    var negGeralRowsNeg = [];
    var negGeralRowsPos = [];
    /** Ultima listagem visao geral para reordenar sem novo fetch. */
    var negUltimoPayloadGeralAtivos = null;
    var lastDataRefCobranca = null;

    var negRoot = document.getElementById('negRoot');
    var negBtnModoGeral = document.getElementById('negBtnModoGeral');
    var negBtnModoCobranca = document.getElementById('negBtnModoCobranca');
    var negModoCobrancaBanner = document.getElementById('negModoCobrancaBanner');
    var negFilterTitle = document.getElementById('negFilterTitle');
    var negFilterSub = document.getElementById('negFilterSub');
    var negResultsTitle = document.getElementById('negResultsTitle');
    var negOperadorWrap = document.getElementById('negOperadorWrap');
    var negOperadorCobranca = document.getElementById('neg_operador_cobranca');
    var negAtivosBlocksContainer = document.getElementById('negAtivosBlocksContainer');

    var negSearchForm = document.getElementById('negSearchForm');
    var negTipoBusca = document.getElementById('neg_tipo_busca');
    var negTermo = document.getElementById('neg_termo');
    var negEvento = document.getElementById('neg_evento');
    var negStatusAtivo = document.getElementById('neg_status_ativo');
    var negDataInicio = document.getElementById('neg_data_inicio');
    var negDataFim = document.getElementById('neg_data_fim');
    var negBtnLimpar = document.getElementById('negBtnLimpar');
    var negBtnExportarExcel = document.getElementById('negBtnExportarExcel');
    var negResultsSection = document.getElementById('negResultsSection');
    var negNoResults = document.getElementById('negNoResults');
    var negAtivosMeta = document.getElementById('negAtivosMeta');

    function esc(val) {
        if (val === null || val === undefined) return '';
        var div = document.createElement('div');
        div.textContent = String(val);
        return div.innerHTML;
    }

    function fmtDt(val) {
        if (!val) return '-';
        var parts = String(val).replace(' ', 'T').split('T');
        var d = parts[0];
        var ps = d.split('-');
        if (ps.length === 3) return ps[2] + '/' + ps[1] + '/' + ps[0];
        return val;
    }

    function tipoLabel(t) {
        var m = {
            negativado_manual: 'Negativado (manual)',
            negativado_tracker: 'Negativado (automatico)',
            removido_pagamento: 'Positivacao (pagamento)',
            removido_manual: 'Positivacao (manual)',
            observacao: 'Observacao'
        };
        return m[t] || (t || '-');
    }

    function statusAtivoLabel(s) {
        var m = {
            registrado_tracker: 'Negativado (tracker)',
            enviado: 'Negativado (envio)',
            falhou: 'Falha envio',
            aguardando_positivacao_serasa: 'Positivacao interna — pendente Serasa'
        };
        return m[s] || (s || '-');
    }

    function statusAtivoBadgeClass(s) {
        var st = (s || '').toLowerCase();
        if (st === 'aguardando_positivacao_serasa') return 'status-warning';
        return 'status-danger';
    }

    /** Badge da coluna Status quando tipo_evento vem na linha (ex.: resposta estendida). */
    function badgeClassTipoEventoNeg(t) {
        var s = String(t || '');
        if (s.indexOf('removido') === 0) return 'status-success';
        if (s === 'observacao') return 'status-active';
        return 'status-danger';
    }

    /** Positivar todos: positivação no histórico (removido_*) ou aguardando envio Serasa. */
    function rowCarteiraBulkPositivar(r) {
        if (r.serasa_elegivel_positivar) return true;
        var t = String(r.tipo_evento || '');
        return t.indexOf('removido') === 0;
    }

    /** Negativar todos: só linhas de negativação ativa (tracker/falha), não positivação do histórico. */
    function rowCarteiraBulkNegativar(r) {
        var t = String(r.tipo_evento || '');
        if (t.indexOf('removido') === 0) return false;
        return !!r.serasa_elegivel_negativar;
    }

    function countSerasaElegivelCarteira(rows, tipoOperacao) {
        var n = 0;
        (rows || []).forEach(function (r) {
            if (tipoOperacao === 'positivar') {
                if (rowCarteiraBulkPositivar(r)) n++;
            } else if (rowCarteiraBulkNegativar(r)) {
                n++;
            }
        });
        return n;
    }

    function eventoLabel(ev) {
        var m = {
            todos: 'Todos',
            negativado: 'Negativados (qualquer)',
            positivado: 'Positivados (qualquer)',
            observacao: 'Observacao',
            negativado_manual: 'Negativado manual',
            negativado_tracker: 'Negativado (tracker)',
            removido_pagamento: 'Positivacao (pagamento)',
            removido_manual: 'Positivacao (manual)'
        };
        return m[ev] || ev;
    }

    function applyPlaceholder() {
        if (!negTipoBusca || !negTermo) return;
        if (negTipoBusca.value === 'texto') {
            negTermo.placeholder = 'Parte do texto do detalhe ou do tipo de evento...';
        } else {
            negTermo.placeholder = 'Grupo, cota ou numero do contrato (ex.: 027004/0040)';
        }
    }

    function buildFilterDesc(q) {
        var parts = [];
        if (modoCobranca) parts.push('visao: Carteira Cobranca');
        if (q) parts.push('texto: "' + q + '"');
        if (negEvento && negEvento.value && negEvento.value !== 'todos') {
            parts.push('ocorrencia: ' + eventoLabel(negEvento.value));
        }
        if (negStatusAtivo && negStatusAtivo.value) {
            parts.push('status ativo: ' + negStatusAtivo.value);
        }
        if (!modoCobranca && negDataInicio && negDataInicio.value) {
            parts.push('de ' + negDataInicio.value);
        }
        if (negDataFim && negDataFim.value) {
            parts.push(modoCobranca ? ('negativacao (evento) em ' + negDataFim.value) : ('ate ' + negDataFim.value));
        }
        if (modoCobranca && negOperadorCobranca && negOperadorCobranca.value && !cfg.perfilCobranca) {
            var opLab = negOperadorCobranca.options[negOperadorCobranca.selectedIndex];
            parts.push('operador: ' + (opLab ? opLab.textContent : negOperadorCobranca.value));
        }
        return parts.length ? parts.join(' | ') : 'sem filtro extra';
    }

    function applyModoUI() {
        if (negRoot) negRoot.classList.toggle('neg-mod-cobranca', modoCobranca);
        if (negBtnModoGeral) {
            negBtnModoGeral.classList.toggle('active', !modoCobranca);
            negBtnModoGeral.setAttribute('aria-pressed', modoCobranca ? 'false' : 'true');
        }
        if (negBtnModoCobranca) {
            negBtnModoCobranca.classList.toggle('active', modoCobranca);
            negBtnModoCobranca.setAttribute('aria-pressed', modoCobranca ? 'true' : 'false');
        }
        if (negModoCobrancaBanner) negModoCobrancaBanner.classList.toggle('d-none', !modoCobranca);

        var mt = document.querySelector('.module-title');
        if (mt) mt.textContent = modoCobranca ? 'Negativacao — Cobranca' : 'Negativacao';

        if (negFilterTitle) {
            negFilterTitle.innerHTML = modoCobranca
                ? '<i class="fa-solid fa-filter"></i> Negativacao / positivacao — carteira Cobranca'
                : '<i class="fa-solid fa-filter"></i> Busca em negativacao e positivacao';
        }
        if (negFilterSub) {
            negFilterSub.textContent = modoCobranca
                ? ('Negativacoes ativas: universo do painel Cobranca (ultimo snapshot GM, parcelas em aberto)' +
                    (cfg.perfilCobranca ? '; apenas contratos atribuidos a voce.' : '. ') +
                    'Positivacoes (removido_* no historico): mesma selecao da visao Geral na Data fim, ' +
                    'incluindo contratos que ja sairam da carteira. Padrao Data fim: dia do ultimo GM.')
                : 'Alterne para analisar apenas contratos que constam no painel de Cobranca (ultimo snapshot GM).';
        }
        if (negResultsTitle) {
            negResultsTitle.textContent = modoCobranca
                ? 'Negativacao e positivacao — Cobranca'
                : 'Negativacao e positivacao';
        }
        if (negOperadorWrap) {
            negOperadorWrap.classList.toggle('neg-operador-hidden', modoCobranca && !!cfg.perfilCobranca);
        }
    }

    function updateBannerText() {
        if (!negModoCobrancaBanner || !modoCobranca) return;
        var chunks = [
            'Negativacoes ativas: snapshot GM e carteira. Positivacoes do dia: todos com evento no historico (igual visao Geral), mesmo fora da carteira.'
        ];
        if (cfg.defaultFuncionarioCobrancaId != null) {
            chunks.push('Operador: ' + (cfg.defaultFuncionarioCobrancaNome || ('#' + cfg.defaultFuncionarioCobrancaId)) + '.');
        }
        if (lastDataRefCobranca) {
            chunks.push('Data referencia GM: ' + fmtDt(lastDataRefCobranca) + '.');
        } else {
            chunks.push('Pesquise para carregar a data de referencia.');
        }
        if (negDataFim && negDataFim.value) {
            chunks.push(
                'Data fim: negativacoes ativas com evento nesse dia; positivacoes removido_* nesse dia (base ampla, como Geral).'
            );
        }
        negModoCobrancaBanner.textContent = chunks.join(' ');
    }

    function setModoCobranca(on) {
        modoCobranca = !!on;
        sessionStorage.setItem(STORAGE_KEY, modoCobranca ? '1' : '0');
        if (!modoCobranca) lastDataRefCobranca = null;
        negAtivosListagemCompleta = false;
        applyModoUI();
        updateBannerText();
        if (modoCobranca) {
            negAtivosListagemCompleta = true;
            if (negResultsSection) negResultsSection.classList.remove('d-none');
            load();
            return;
        }
        if (negResultsSection && !negResultsSection.classList.contains('d-none')) {
            load();
        }
    }

    if (negBtnModoGeral) negBtnModoGeral.addEventListener('click', function () { setModoCobranca(false); });
    if (negBtnModoCobranca) negBtnModoCobranca.addEventListener('click', function () { setModoCobranca(true); });

    if (negOperadorCobranca) {
        negOperadorCobranca.addEventListener('change', function () {
            if (!modoCobranca) return;
            if (negResultsSection && !negResultsSection.classList.contains('d-none')) {
                load();
            }
        });
    }

    applyModoUI();
    updateBannerText();

    if (negUrlBootstrap.autoPesquisar && modoCobranca) {
        negAtivosListagemCompleta = true;
        if (negResultsSection) negResultsSection.classList.remove('d-none');
        load();
    }

    function populateOperadorSelect(data) {
        if (!negOperadorCobranca || cfg.perfilCobranca) return;
        var list = data.funcionarios_cobranca || [];
        var prev = negOperadorCobranca.value;
        negOperadorCobranca.innerHTML = '<option value="">Todos os operadores</option>';
        list.forEach(function (f) {
            var o = document.createElement('option');
            o.value = String(f.id);
            o.textContent = f.nome || ('#' + f.id);
            negOperadorCobranca.appendChild(o);
        });
        if (prev && negOperadorCobranca.querySelector('option[value="' + prev + '"]')) {
            negOperadorCobranca.value = prev;
        }
    }

    function parseNegNum(v) {
        if (v === null || v === undefined || v === '') return NaN;
        if (typeof v === 'number') return v;
        var n = parseFloat(String(v).replace(',', '.'));
        return n;
    }

    /** Ordena copia de linhas de ativos (mesmas chaves que /api/negativacao/listagem). */
    function sortNegAtivosRowsCopy(rows, col, dir) {
        var out = rows.slice();
        var mult = dir === 'desc' ? -1 : 1;
        function tieBreak(ra, rb) {
            var ida = parseNegNum(ra.id);
            var idb = parseNegNum(rb.id);
            if (!isNaN(ida) && !isNaN(idb) && ida !== idb) return ida - idb;
            var pa = parseNegNum(ra.id_parcela);
            var pb = parseNegNum(rb.id_parcela);
            if (!isNaN(pa) && !isNaN(pb) && pa !== pb) return pa - pb;
            return 0;
        }
        function cmpStr(a, b) {
            if (a < b) return -1 * mult;
            if (a > b) return 1 * mult;
            return 0;
        }
        out.sort(function (ra, rb) {
            var c = col || 'data';
            switch (c) {
            case 'contrato': {
                var ga = parseNegNum(ra.grupo);
                var gb = parseNegNum(rb.grupo);
                var ca = parseNegNum(ra.cota);
                var cb = parseNegNum(rb.cota);
                if (!isNaN(ga) && !isNaN(gb) && ga !== gb) return (ga - gb) * mult;
                if (!isNaN(ca) && !isNaN(cb) && ca !== cb) return (ca - cb) * mult;
                var sa = String(ra.grupo || '') + '/' + String(ra.cota || '');
                var sb = String(rb.grupo || '') + '/' + String(rb.cota || '');
                var sc = cmpStr(sa, sb);
                if (sc) return sc;
                return tieBreak(ra, rb);
            }
            case 'parcela': {
                var pa = parseNegNum(ra.numero_parcela);
                var pb = parseNegNum(rb.numero_parcela);
                if (isNaN(pa)) pa = dir === 'desc' ? -Infinity : Infinity;
                if (isNaN(pb)) pb = dir === 'desc' ? -Infinity : Infinity;
                if (pa !== pb) return (pa - pb) * mult;
                return tieBreak(ra, rb);
            }
            case 'dias': {
                var da = parseNegNum(ra.dias_atraso);
                var db = parseNegNum(rb.dias_atraso);
                if (isNaN(da)) da = dir === 'desc' ? -Infinity : Infinity;
                if (isNaN(db)) db = dir === 'desc' ? -Infinity : Infinity;
                if (da !== db) return (da - db) * mult;
                return tieBreak(ra, rb);
            }
            case 'status': {
                var sta = String(ra.tipo_evento || ra.status || '');
                var stb = String(rb.tipo_evento || rb.status || '');
                var st = cmpStr(sta, stb);
                if (st) return st;
                return tieBreak(ra, rb);
            }
            case 'data': {
                var dta = String(ra.data_negativacao || '').replace(' ', 'T');
                var dtb = String(rb.data_negativacao || '').replace(' ', 'T');
                var dt = cmpStr(dta, dtb);
                if (dt) return dt;
                return tieBreak(ra, rb);
            }
            case 'operador': {
                var oa = String(ra.funcionario_nome || '').toLowerCase();
                var ob = String(rb.funcionario_nome || '').toLowerCase();
                var oc = cmpStr(oa, ob);
                if (oc) return oc;
                return tieBreak(ra, rb);
            }
            default:
                return tieBreak(ra, rb);
            }
        });
        return out;
    }

    function createAtivoRow(r) {
        var tr = document.createElement('tr');
        var gc = esc(r.grupo) + '/' + esc(r.cota);
        var idp = r.id_parcela;
        var idc = r.id_contrato;
        var tipoEv = r.tipo_evento ? String(r.tipo_evento) : '';
        var tipoEvLow = tipoEv.toLowerCase();
        var stLow = String(r.status || '').toLowerCase();
        var badgeCls = statusAtivoBadgeClass(r.status);
        var statusCellHtml;
        if (tipoEv) {
            statusCellHtml = '<span class="status-badge ' + badgeClassTipoEventoNeg(tipoEv) + '">' +
                esc(tipoLabel(tipoEv)) + '</span>';
        } else {
            statusCellHtml = '<span class="status-badge ' + badgeCls + '">' + esc(statusAtivoLabel(r.status)) + '</span>';
        }
        var acaoPos;
        if (tipoEvLow.indexOf('removido') === 0) {
            acaoPos = (idp != null && idp !== '')
                ? ('<button type="button" class="btn-neg-danger btn-neg-negativar-hist" data-id-parcela="' +
                    esc(String(idp)) + '">Negativação</button>')
                : '<span style="font-size:0.78rem;color:#64748b">\u2014</span>';
        } else if (stLow === 'aguardando_positivacao_serasa') {
            acaoPos = '<span style="font-size:0.78rem;color:#92400e;white-space:normal;max-width:9rem;display:inline-block;text-align:right">' +
                'Pendente envio Serasa (use Positivar todos)</span>';
        } else {
            acaoPos = '<button type="button" class="btn-neg-positivar btn-neg-positivar-ativo" data-id-parcela="' +
                esc(String(idp)) + '">Positivar</button>';
        }
        tr.innerHTML =
            '<td>' + gc + '</td>' +
            '<td>' + esc(r.numero_parcela != null ? r.numero_parcela : '-') + '</td>' +
            '<td>' + esc(r.dias_atraso != null ? r.dias_atraso : '-') + '</td>' +
            '<td>' + statusCellHtml + '</td>' +
            '<td>' + fmtDt(r.data_negativacao) + '</td>' +
            '<td>' + esc(r.funcionario_nome || '-') + '</td>' +
            '<td class="text-right">' +
            '<button type="button" class="action-btn btn-neg-detalhe" data-contrato-id="' + esc(String(idc)) + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button> ' +
            acaoPos +
            '</td>';
        return tr;
    }

    /**
     * Bloco colapsavel da Carteira: um unico botao em lote (negativar OU positivar).
     * @param {string} visualClass Classe visual do bloco (ex.: critico, neg-carteira-pos).
     * @param {string} blocoKey negativados | positivados (ordem + API faixa)
     * @param {string} bulkSerasaTipo negativar | positivar
     */
    function buildNegCarteiraBlock(visualClass, blocoKey, title, iconClass, rows, bulkSerasaTipo) {
        var block = document.createElement('div');
        block.className = 'priority-block ' + visualClass + ' collapsed';

        var count = rows ? rows.length : 0;
        var bulkHtml = '';
        if (bulkSerasaTipo === 'negativar') {
            var nNeg = countSerasaElegivelCarteira(rows, 'negativar');
            var disNeg = count === 0 || nNeg === 0 ? ' disabled' : '';
            var titNeg = nNeg === 0
                ? 'Nenhuma parcela com negativacao (tracker ou falha de envio) elegivel neste bloco.'
                : ('Negativar todos: ' + nNeg + ' parcela(s).');
            bulkHtml =
                '<div class="neg-priority-bulk-wrap">' +
                '<button type="button" class="bulk-btn bulk-btn-negativar-lote btn-neg-blk-pos"' + disNeg +
                ' data-neg-blk-level="' + esc(blocoKey) + '" data-neg-blk-serasa-tipo="negativar" ' +
                'title="' + esc(titNeg) + '">' +
                '<i class="fa-solid fa-ban"></i><span>Negativar todos</span></button>' +
                '</div>';
        } else if (bulkSerasaTipo === 'positivar') {
            var nPos = countSerasaElegivelCarteira(rows, 'positivar');
            var disPos = count === 0 || nPos === 0 ? ' disabled' : '';
            var titPos = nPos === 0
                ? ('Nenhuma parcela elegivel (positivacao no historico ou aguardando Serasa) neste bloco.')
                : ('Positivar todos: ' + nPos + ' parcela(s).');
            bulkHtml =
                '<div class="neg-priority-bulk-wrap">' +
                '<button type="button" class="bulk-btn bulk-btn-positivar-lote btn-neg-blk-pos"' + disPos +
                ' data-neg-blk-level="' + esc(blocoKey) + '" data-neg-blk-serasa-tipo="positivar" ' +
                'title="' + esc(titPos) + '">' +
                '<i class="fa-solid fa-check-double"></i><span>Positivar todos</span></button>' +
                '</div>';
        }

        var header = document.createElement('div');
        header.className = 'priority-header';
        header.innerHTML =
            '<div class="priority-header-left">' +
            '  <div class="priority-icon"><i class="' + iconClass + '"></i></div>' +
            '  <div class="priority-info">' +
            '    <h4>' + esc(title) + '</h4>' +
            '  </div>' +
            '</div>' +
            '<div class="priority-header-right">' +
            bulkHtml +
            '  <span class="priority-count">' + count + ' parcela' + (count !== 1 ? 's' : '') + '</span>' +
            '  <i class="fa-solid fa-chevron-down priority-chevron"></i>' +
            '</div>';

        var bulkWrap = header.querySelector('.neg-priority-bulk-wrap');
        if (bulkWrap) {
            bulkWrap.addEventListener('click', function (e) {
                e.stopPropagation();
            });
            bulkWrap.querySelectorAll('.btn-neg-blk-pos').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (btn.disabled) return;
                    enviarLoteSerasaCarteiraCobranca(
                        btn.getAttribute('data-neg-blk-serasa-tipo'),
                        btn.getAttribute('data-neg-blk-level')
                    );
                });
            });
        }

        header.addEventListener('click', function () {
            block.classList.toggle('collapsed');
        });
        block.appendChild(header);

        var body = document.createElement('div');
        body.className = 'priority-body';

        var emptyMsg = bulkSerasaTipo === 'negativar'
            ? 'Nenhuma parcela negativada neste bloco.'
            : 'Nenhuma parcela com positivacao (historico) neste bloco.';
        if (!rows || !rows.length) {
            body.innerHTML =
                '<div class="empty-block"><i class="fa-regular fa-circle-check"></i>' + esc(emptyMsg) + '</div>';
        } else {
            var wrap = document.createElement('div');
            wrap.className = 'table-responsive';
            var table = document.createElement('table');
            table.className = 'styled-table busca-results-table';
            var tblTag = 'cobranca-' + blocoKey;
            table.innerHTML =
                '<thead><tr>' +
                '<th class="neg-sort" data-neg-table="' + tblTag + '" data-neg-sort="contrato">Contrato <span class="sort-ind" aria-hidden="true"></span></th>' +
                '<th class="neg-sort" data-neg-table="' + tblTag + '" data-neg-sort="parcela">Parcela <span class="sort-ind"></span></th>' +
                '<th class="neg-sort" data-neg-table="' + tblTag + '" data-neg-sort="dias">Dias atraso <span class="sort-ind"></span></th>' +
                '<th class="neg-sort" data-neg-table="' + tblTag + '" data-neg-sort="status">Status <span class="sort-ind"></span></th>' +
                '<th class="neg-sort" data-neg-table="' + tblTag + '" data-neg-sort="data">Data <span class="sort-ind"></span></th>' +
                '<th class="neg-sort" data-neg-table="' + tblTag + '" data-neg-sort="operador">Operador <span class="sort-ind"></span></th>' +
                '<th class="text-right">Acoes</th>' +
                '</tr></thead>';
            var tb = document.createElement('tbody');
            rows.forEach(function (r) {
                tb.appendChild(createAtivoRow(r));
            });
            table.appendChild(tb);
            wrap.appendChild(table);
            body.appendChild(wrap);
            bindPositivar(tb);
            bindNegativarHistorico(tb);
            bindDetalhes(tb);
        }

        block.appendChild(body);
        return block;
    }

    function collectParcelaIdsCarteiraFaixa(faixa, tipoOperacao) {
        if (!negUltimoPayloadCobranca || (faixa !== 'negativados' && faixa !== 'positivados')) return [];
        var rows = faixa === 'negativados'
            ? (negUltimoPayloadCobranca.ativos_negativados || [])
            : (negUltimoPayloadCobranca.ativos_positivados || []);
        var seen = {};
        var out = [];
        var st = faixa === 'negativados' ? sortCarteiraBloco.negativados : sortCarteiraBloco.positivados;
        var sorted = sortNegAtivosRowsCopy(rows, st.col, st.dir);
        sorted.forEach(function (r) {
            var ok = tipoOperacao === 'positivar' ? rowCarteiraBulkPositivar(r) : rowCarteiraBulkNegativar(r);
            if (!ok) return;
            var id = r.id_parcela;
            if (id == null || id === '') return;
            var n = parseInt(id, 10);
            if (!n || seen[n]) return;
            seen[n] = true;
            out.push(n);
        });
        return out;
    }

    function renderAtivosCobranca(data) {
        negUltimoPayloadCobranca = data;
        var negativados = sortNegAtivosRowsCopy(
            data.ativos_negativados || [],
            sortCarteiraBloco.negativados.col,
            sortCarteiraBloco.negativados.dir
        );
        var positivados = sortNegAtivosRowsCopy(
            data.ativos_positivados || [],
            sortCarteiraBloco.positivados.col,
            sortCarteiraBloco.positivados.dir
        );
        var nn = negativados.length;
        var np = positivados.length;
        var sum = nn + np;

        var kNeg = document.getElementById('negKpiNegativados');
        var kPos = document.getElementById('negKpiPositivados');
        var kt = document.getElementById('negKpiTotalAtivos');
        if (kNeg) kNeg.textContent = String(nn);
        if (kPos) kPos.textContent = String(np);
        if (kt) kt.textContent = String(sum);

        if (!negAtivosBlocksContainer) return;
        negAtivosBlocksContainer.innerHTML = '';
        negAtivosBlocksContainer.appendChild(
            buildNegCarteiraBlock(
                'critico',
                'negativados',
                'Negativados',
                'fa-solid fa-ban',
                negativados,
                'negativar'
            )
        );
        negAtivosBlocksContainer.appendChild(
            buildNegCarteiraBlock(
                'neg-carteira-pos',
                'positivados',
                'Positivados',
                'fa-solid fa-check',
                positivados,
                'positivar'
            )
        );
        updateSortIndicators();
    }

    function updateSortIndicators() {
        document.querySelectorAll('th.neg-sort').forEach(function (th) {
            var tbl = th.getAttribute('data-neg-table');
            var col = th.getAttribute('data-neg-sort');
            var ind = th.querySelector('.sort-ind');
            if (!ind) return;
            var dir = null;
            if (tbl === 'ativos' && sortAtivos.col === col) dir = sortAtivos.dir;
            else if (tbl === 'cobranca-negativados' && sortCarteiraBloco.negativados.col === col) {
                dir = sortCarteiraBloco.negativados.dir;
            } else if (tbl === 'cobranca-positivados' && sortCarteiraBloco.positivados.col === col) {
                dir = sortCarteiraBloco.positivados.dir;
            }
            ind.textContent = dir ? (dir === 'asc' ? '▲' : '▼') : '';
        });
    }

    function renderAtivos(rows, filterDesc, payload) {
        var tbNeg = document.getElementById('negTbodyGeralNeg');
        var tbPos = document.getElementById('negTbodyGeralPos');
        if (!tbNeg || !tbPos || !negAtivosMeta) return;
        if (negAtivosBlocksContainer) negAtivosBlocksContainer.innerHTML = '';

        var list = rows || [];
        var negRows = [];
        var posRows = [];
        list.forEach(function (r) {
            var t = String(r.tipo_evento || '').toLowerCase();
            if (t.indexOf('removido') === 0) posRows.push(r);
            else negRows.push(r);
        });
        negGeralRowsNeg = negRows;
        negGeralRowsPos = posRows;

        var nTot = list.length;
        var meta = (nTot ? nTot + ' registro(s)' : 'Nenhuma parcela no resultado.') +
            (nTot ? (' (' + negRows.length + ' para negativação, ' + posRows.length + ' para positivação)') : '') +
            (filterDesc ? (' | ' + filterDesc) : '');
        if (payload && payload.ativos_em_preview) {
            var tot = payload.total_ativos != null ? Number(payload.total_ativos) : 0;
            if (tot > nTot) {
                meta += ' | Mostrando as 20 mais recentes (' + tot + ' no total). Ajuste filtros e Pesquisar para listar todas.';
            }
        }
        negAtivosMeta.textContent = meta;

        var cn = document.getElementById('negSplitNegativacaoCount');
        var cp = document.getElementById('negSplitPositivacaoCount');
        if (cn) cn.textContent = String(negRows.length);
        if (cp) cp.textContent = String(posRows.length);

        var sn = sortNegAtivosRowsCopy(negRows, sortAtivos.col, sortAtivos.dir);
        var sp = sortNegAtivosRowsCopy(posRows, sortAtivos.col, sortAtivos.dir);

        function fillTb(tb, sortedRows) {
            tb.innerHTML = '';
            if (!sortedRows.length) {
                tb.innerHTML = '<tr><td colspan="7" style="color:#64748b">Sem registros nesta lista.</td></tr>';
                return;
            }
            sortedRows.forEach(function (r) {
                tb.appendChild(createAtivoRow(r));
            });
        }
        fillTb(tbNeg, sn);
        fillTb(tbPos, sp);

        bindPositivar(tbNeg);
        bindNegativarHistorico(tbNeg);
        bindDetalhes(tbNeg);
        bindPositivar(tbPos);
        bindNegativarHistorico(tbPos);
        bindDetalhes(tbPos);

        updateGeralBulkButtonsState();
        updateSortIndicators();
    }

    function bindDetalhes(container) {
        container.querySelectorAll('.btn-neg-detalhe').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = parseInt(btn.getAttribute('data-contrato-id'), 10);
                if (!id || typeof window.ContratoDetalhesModal === 'undefined' || !window.ContratoDetalhesModal.open) return;
                window.ContratoDetalhesModal.open(id);
            });
        });
    }

    function bindPositivar(container) {
        container.querySelectorAll('.btn-neg-positivar-ativo').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idParcela = parseInt(btn.getAttribute('data-id-parcela'), 10);
                if (!idParcela || !window.confirm(
                    'Registrar positivacao interna para esta parcela? Sera gravado o evento no historico; ' +
                    'a linha permanece ate o envio ao Serasa (botao Positivar todos no bloco).'
                )) return;
                fetch('/api/negativacao/remover-manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_parcela: idParcela,
                        motivo: 'Positivação manual pelo módulo Negativação.'
                    })
                }).then(function (res) { return res.json().then(function (j) { return { res: res, j: j }; }); })
                    .then(function (o) {
                        if (!o.res.ok) throw new Error(o.j.error || o.res.statusText);
                        load();
                    })
                    .catch(function (e) { alert(e.message || String(e)); });
            });
        });
    }

    function bindNegativarHistorico(container) {
        container.querySelectorAll('.btn-neg-negativar-hist').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idParcela = parseInt(btn.getAttribute('data-id-parcela'), 10);
                if (!idParcela || !window.confirm(
                    'Registrar negativação novamente para esta parcela? ' +
                    'Só é permitido com parcela e contrato em aberto e atraso entre 31 e 89 dias (mesma regra do painel de cobrança).'
                )) return;
                fetch('/api/negativacao/registrar-manual-parcela', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_parcela: idParcela })
                }).then(function (res) { return res.json().then(function (j) { return { res: res, j: j }; }); })
                    .then(function (o) {
                        if (!o.res.ok) throw new Error(o.j.error || o.res.statusText);
                        load();
                    })
                    .catch(function (e) { alert(e.message || String(e)); });
            });
        });
    }

    function collectParcelaIdsGeralNegativarManual() {
        var seen = {};
        var out = [];
        negGeralRowsNeg.forEach(function (r) {
            var id = r.id_parcela;
            if (id == null || id === '') return;
            var n = parseInt(id, 10);
            if (!n || seen[n]) return;
            seen[n] = true;
            out.push(n);
        });
        return out;
    }

    function collectParcelaIdsGeralPositivar() {
        var seen = {};
        var out = [];
        negGeralRowsPos.forEach(function (r) {
            if (!rowCarteiraBulkPositivar(r)) return;
            var id = r.id_parcela;
            if (id == null || id === '') return;
            var n = parseInt(id, 10);
            if (!n || seen[n]) return;
            seen[n] = true;
            out.push(n);
        });
        return out;
    }

    function updateGeralBulkButtonsState() {
        var bn = document.getElementById('negBtnBulkNegativarGeral');
        var bp = document.getElementById('negBtnBulkPositivarGeral');
        if (bn) bn.disabled = collectParcelaIdsGeralNegativarManual().length === 0;
        if (bp) bp.disabled = collectParcelaIdsGeralPositivar().length === 0;
    }

    function enviarLoteRegistroNegativacaoGeral() {
        var ids = collectParcelaIdsGeralNegativarManual();
        if (!ids.length) {
            alert('Nenhuma parcela nesta lista.');
            return;
        }
        if (!window.confirm(
            'Registrar negativação novamente para ' + ids.length + ' parcela(s)? ' +
            'Cada parcela será validada (contrato e parcela em aberto, atraso entre 31 e 89 dias na data GM). ' +
            'Itens fora da regra falham individualmente.'
        )) return;
        var ok = 0;
        var failMsgs = [];
        function step(i) {
            if (i >= ids.length) {
                var msg = 'Concluído: ' + ok + ' registrada(s)';
                if (failMsgs.length) msg += '; ' + failMsgs.length + ' falha(s).';
                if (failMsgs.length && failMsgs.length <= 8) {
                    failMsgs.forEach(function (x) { msg += '\n- ' + x; });
                } else if (failMsgs.length > 8) {
                    console.warn(failMsgs);
                    msg += '\n(detalhes das falhas no console do navegador)';
                }
                alert(msg);
                load();
                return;
            }
            var idp = ids[i];
            fetch('/api/negativacao/registrar-manual-parcela', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_parcela: idp })
            }).then(function (res) { return res.json().then(function (j) { return { res: res, j: j }; }); })
                .then(function (o) {
                    if (!o.res.ok) throw new Error(o.j.error || o.res.statusText);
                    ok++;
                })
                .catch(function (e) {
                    failMsgs.push('#' + idp + ': ' + (e.message || String(e)));
                })
                .then(function () { step(i + 1); });
        }
        step(0);
    }

    function parseFilenameContentDisposition(cd) {
        if (!cd) return null;
        var star = /filename\*=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
        if (star) {
            var raw = star[1].trim().replace(/^"+|"+$/g, '');
            try {
                return decodeURIComponent(raw);
            } catch (e) {
                return raw;
            }
        }
        var m = /filename="([^"]+)"/i.exec(cd);
        if (m) return m[1];
        m = /filename=([^;\n]+)/i.exec(cd);
        return m ? m[1].trim().replace(/^"+|"+$/g, '') : null;
    }

    /** Descarrega TXT SERASA-CONVEM (POST); nao altera estado no servidor. */
    function downloadSerasaConvTxt(tipoOperacao, ids, faixa) {
        return fetch('/api/negativacao/serasa-arquivo-txt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo_operacao: tipoOperacao,
                ids_parcela: ids,
                faixa: faixa || null
            })
        }).then(function (res) {
            if (!res.ok) {
                return res.json().then(function (j) {
                    throw new Error((j && j.error) || res.statusText || 'Falha ao gerar arquivo.');
                }).catch(function (err) {
                    if (err instanceof Error && err.message && err.message.indexOf('JSON') === -1) {
                        throw err;
                    }
                    throw new Error('Falha ao gerar arquivo.');
                });
            }
            var fname = parseFilenameContentDisposition(res.headers.get('Content-Disposition')) ||
                (tipoOperacao === 'positivar' ? 'SERASA_POSITIVACAO.TXT' : 'SERASA_NEGATIVACAO.TXT');
            return res.blob().then(function (blob) {
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fname;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
        });
    }

    function enviarLoteSerasaGeralPositivar() {
        var ids = collectParcelaIdsGeralPositivar();
        if (!ids.length) {
            alert(
                'Nenhuma parcela elegível para positivação ao Serasa nesta lista ' +
                '(somente sem cadastro ativo em negativação ou status aguardando envio Serasa).'
            );
            return;
        }
        var qtd = ids.length;
        if (!window.confirm(
            'Gerar TXT de positivação (exclusão SERASA-CONVEM; modelo GM só cabeçalho e rodapé) ' +
            'para ' + qtd + ' parcela(s) elegível(is)? O ficheiro será descarregado; não envia à API.'
        )) return;
        downloadSerasaConvTxt('positivar', ids, null)
            .catch(function (err) { alert(err.message || String(err)); });
    }

    function bindNegSplitPanels() {
        document.querySelectorAll('.neg-split-panel').forEach(function (panel) {
            var hdr = panel.querySelector('.neg-split-panel-header');
            if (!hdr || hdr.dataset.negSplitBound === '1') return;
            hdr.dataset.negSplitBound = '1';
            function toggle() {
                panel.classList.toggle('collapsed');
                hdr.setAttribute(
                    'aria-expanded',
                    panel.classList.contains('collapsed') ? 'false' : 'true'
                );
            }
            hdr.addEventListener('click', function (e) {
                if (e.target.closest('button')) return;
                toggle();
            });
            hdr.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        });
        var bn = document.getElementById('negBtnBulkNegativarGeral');
        var bp = document.getElementById('negBtnBulkPositivarGeral');
        if (bn && bn.dataset.negBulkBound !== '1') {
            bn.dataset.negBulkBound = '1';
            bn.addEventListener('click', function (e) {
                e.stopPropagation();
                enviarLoteRegistroNegativacaoGeral();
            });
        }
        if (bp && bp.dataset.negBulkBound !== '1') {
            bp.dataset.negBulkBound = '1';
            bp.addEventListener('click', function (e) {
                e.stopPropagation();
                enviarLoteSerasaGeralPositivar();
            });
        }
    }

    function isNegFiltersDefault() {
        var q = negTermo ? negTermo.value.trim() : '';
        var ev = negEvento ? String(negEvento.value || '').toLowerCase() : 'todos';
        var st = negStatusAtivo ? String(negStatusAtivo.value || '').trim() : '';
        var di = (!modoCobranca && negDataInicio) ? String(negDataInicio.value || '').trim() : '';
        var df = negDataFim ? String(negDataFim.value || '').trim() : '';
        return !q && (!ev || ev === 'todos') && !st && !di && !df;
    }

    function enviarLoteSerasaCarteiraCobranca(tipoOperacao, faixa) {
        if (tipoOperacao !== 'positivar' && tipoOperacao !== 'negativar') return;
        var ids = collectParcelaIdsCarteiraFaixa(faixa, tipoOperacao);
        if (!ids.length) {
            alert(tipoOperacao === 'positivar'
                ? ('Nenhuma parcela elegivel para positivacao neste bloco ' +
                    '(linhas de positivacao no historico ou status aguardando Serasa).')
                : ('Nenhuma parcela elegivel para negativacao neste bloco ' +
                    '(somente negativado tracker ou falha de envio).'));
            return;
        }
        var nomeBloco = faixa === 'negativados' ? 'Negativados' : 'Positivados';
        var qtd = ids.length;
        var msgTipo = tipoOperacao === 'positivar'
            ? ('gerar TXT de positivacao (_POSITIVACAO.TXT; modelo GM sem linhas de detalhe) para ' +
                qtd + ' parcela(s) elegivel(is) no bloco ' + nomeBloco)
            : ('gerar TXT de negativacao (_NEGATIVACAO.TXT, inclusao SERASA-CONVEM) com ' +
                qtd + ' linha(s) de detalhe no bloco ' + nomeBloco);
        if (!window.confirm(
            'Confirmar ' + msgTipo + '? O ficheiro sera descarregado; nao envia automaticamente para a API Serasa.'
        )) return;
        downloadSerasaConvTxt(tipoOperacao, ids, faixa)
            .catch(function (err) { alert(err.message || String(err)); });
    }

    /**
     * Query string para GET /api/negativacao/listagem e /api/negativacao/listagem/excel.
     * @param {boolean} forExcel exportação: sem preview limitado; envia ordenação por folha do Excel.
     */
    function buildNegListagemApiParams(forExcel) {
        var tipoBusca = negTipoBusca ? negTipoBusca.value : 'contrato';
        var q = negTermo ? negTermo.value.trim() : '';
        var params = new URLSearchParams({
            q: q,
            tipo_busca: tipoBusca,
            sort_ativos: sortAtivos.col,
            order_ativos: sortAtivos.dir
        });
        if (negEvento && negEvento.value) params.set('evento', negEvento.value);
        if (negStatusAtivo && negStatusAtivo.value) params.set('status_ativo', negStatusAtivo.value);
        if (!modoCobranca && negDataInicio && negDataInicio.value) {
            params.set('data_inicio', negDataInicio.value);
        }
        if (negDataFim && negDataFim.value) params.set('data_fim', negDataFim.value);

        if (!forExcel && !modoCobranca && isNegFiltersDefault() && !negAtivosListagemCompleta) {
            params.set('preview_ativos', '1');
        }

        if (modoCobranca) {
            params.set('apenas_cobranca', '1');
            var fidOp = null;
            if (cfg.perfilCobranca && cfg.defaultFuncionarioCobrancaId != null) {
                fidOp = cfg.defaultFuncionarioCobrancaId;
            } else if (negOperadorCobranca && negOperadorCobranca.value) {
                var parsedFo = parseInt(negOperadorCobranca.value, 10);
                fidOp = parsedFo > 0 ? parsedFo : null;
            }
            if (fidOp != null) params.set('funcionario_id', String(fidOp));
        }

        if (forExcel) {
            if (modoCobranca) {
                params.set('excel_sort_neg_col', sortCarteiraBloco.negativados.col);
                params.set('excel_sort_neg_dir', sortCarteiraBloco.negativados.dir);
                params.set('excel_sort_pos_col', sortCarteiraBloco.positivados.col);
                params.set('excel_sort_pos_dir', sortCarteiraBloco.positivados.dir);
            } else {
                params.set('excel_sort_neg_col', sortAtivos.col);
                params.set('excel_sort_neg_dir', sortAtivos.dir);
                params.set('excel_sort_pos_col', sortAtivos.col);
                params.set('excel_sort_pos_dir', sortAtivos.dir);
            }
        }

        return params;
    }

    function exportNegativacaoExcel() {
        if (!negBtnExportarExcel || negBtnExportarExcel.disabled) return;
        var prevHtml = negBtnExportarExcel.innerHTML;
        negBtnExportarExcel.disabled = true;
        negBtnExportarExcel.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...';
        var params = buildNegListagemApiParams(true);
        fetch('/api/negativacao/listagem/excel?' + params.toString(), { credentials: 'same-origin' })
            .then(function (resp) {
                if (!resp.ok) {
                    return resp.json().then(function (j) {
                        throw new Error((j && j.error) ? j.error : ('HTTP ' + resp.status));
                    }, function () {
                        throw new Error('HTTP ' + resp.status);
                    });
                }
                return resp.blob().then(function (blob) {
                    return { blob: blob, resp: resp };
                });
            })
            .then(function (o) {
                var blob = o.blob;
                var resp = o.resp;
                var cd = resp.headers.get('Content-Disposition');
                var fname = 'negativacao_listagem.xlsx';
                if (cd) {
                    var m = /filename\*?=(?:UTF-8'')?([^;\n]+)/i.exec(cd);
                    if (m) fname = decodeURIComponent(m[1].replace(/['"]/g, '').trim());
                }
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fname;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            })
            .catch(function (err) {
                alert('Não foi possível exportar o Excel: ' + (err.message || err));
            })
            .finally(function () {
                negBtnExportarExcel.disabled = false;
                negBtnExportarExcel.innerHTML = prevHtml;
            });
    }

    function load() {
        var q = negTermo ? negTermo.value.trim() : '';
        var params = buildNegListagemApiParams(false);

        if (negAtivosMeta) negAtivosMeta.textContent = 'Carregando...';

        var fd = buildFilterDesc(q);

        fetch('/api/negativacao/listagem?' + params.toString())
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.data_referencia_cobranca) {
                    lastDataRefCobranca = data.data_referencia_cobranca;
                    updateBannerText();
                }
                if (modoCobranca && negDataFim && data.carteira_filtro_data_negativacao) {
                    var cfd = data.carteira_filtro_data_negativacao;
                    var cfFim = cfd.data_fim || '';
                    if (cfFim && (!negDataFim.value || cfd.usou_data_padrao_ultimo_gm)) {
                        negDataFim.value = cfFim;
                        updateBannerText();
                    }
                }

                var ativos = data.ativos || [];

                if (modoCobranca) {
                    negUltimoPayloadGeralAtivos = null;
                    populateOperadorSelect(data);
                    if (tryApplyDeepLinkOperador()) {
                        load();
                        return;
                    }
                    renderAtivosCobranca(data);
                    var tbGN = document.getElementById('negTbodyGeralNeg');
                    var tbGP = document.getElementById('negTbodyGeralPos');
                    if (tbGN) tbGN.innerHTML = '';
                    if (tbGP) tbGP.innerHTML = '';
                    negGeralRowsNeg = [];
                    negGeralRowsPos = [];
                } else {
                    negUltimoPayloadCobranca = null;
                    negUltimoPayloadGeralAtivos = { rows: ativos, fd: fd, payload: data };
                    renderAtivos(ativos, fd, data);
                }

                var sumCob = 0;
                if (modoCobranca) {
                    sumCob = (data.ativos_negativados || []).length +
                        (data.ativos_positivados || []).length;
                }
                var empty = modoCobranca ? (sumCob === 0) : (ativos.length === 0);
                if (negNoResults) {
                    negNoResults.classList.toggle('d-none', !empty);
                }

                if (negStripDeepLinkAfterLoad && modoCobranca) {
                    stripNegativacaoDeepLinkParams();
                    negStripDeepLinkAfterLoad = false;
                }
            })
            .catch(function (e) {
                console.error(e);
                if (negAtivosMeta) negAtivosMeta.textContent = '';
                if (negAtivosBlocksContainer) negAtivosBlocksContainer.innerHTML = '';
                negUltimoPayloadCobranca = null;
                negUltimoPayloadGeralAtivos = null;
                var tbGN = document.getElementById('negTbodyGeralNeg');
                var tbGP = document.getElementById('negTbodyGeralPos');
                if (tbGN) tbGN.innerHTML = '';
                if (tbGP) tbGP.innerHTML = '';
                negGeralRowsNeg = [];
                negGeralRowsPos = [];
            });
    }

    function onSortClick(th) {
        var tbl = th.getAttribute('data-neg-table');
        var col = th.getAttribute('data-neg-sort');
        if (!tbl || !col) return;
        if (tbl === 'cobranca-negativados' || tbl === 'cobranca-positivados') {
            var faixa = tbl === 'cobranca-negativados' ? 'negativados' : 'positivados';
            var st = sortCarteiraBloco[faixa];
            if (st.col === col) {
                st.dir = st.dir === 'asc' ? 'desc' : 'asc';
            } else {
                st.col = col;
                st.dir = 'desc';
            }
            if (negUltimoPayloadCobranca) renderAtivosCobranca(negUltimoPayloadCobranca);
            return;
        }
        if (tbl === 'ativos') {
            if (sortAtivos.col === col) {
                sortAtivos.dir = sortAtivos.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortAtivos.col = col;
                sortAtivos.dir = 'desc';
            }
            if (!modoCobranca && negUltimoPayloadGeralAtivos) {
                renderAtivos(negUltimoPayloadGeralAtivos.rows, negUltimoPayloadGeralAtivos.fd, negUltimoPayloadGeralAtivos.payload);
                return;
            }
        }
        load();
    }

    document.querySelectorAll('#negTableGeralNeg thead, #negTableGeralPos thead').forEach(function (thead) {
        thead.addEventListener('click', function (e) {
            var th = e.target.closest('th.neg-sort');
            if (!th || !thead.contains(th)) return;
            e.preventDefault();
            onSortClick(th);
        });
    });

    if (negAtivosBlocksContainer) {
        negAtivosBlocksContainer.addEventListener('click', function (e) {
            var th = e.target.closest('th.neg-sort');
            if (!th || !negAtivosBlocksContainer.contains(th)) return;
            var tbl = th.getAttribute('data-neg-table');
            if (tbl !== 'cobranca-negativados' && tbl !== 'cobranca-positivados') return;
            e.preventDefault();
            onSortClick(th);
        });
    }

    if (negTipoBusca && negTermo) {
        negTipoBusca.addEventListener('change', applyPlaceholder);
        applyPlaceholder();
    }

    if (negSearchForm) {
        negSearchForm.addEventListener('submit', function (e) {
            e.preventDefault();
            negAtivosListagemCompleta = true;
            if (negResultsSection) negResultsSection.classList.remove('d-none');
            load();
        });
    }

    if (negBtnLimpar) {
        negBtnLimpar.addEventListener('click', function () {
            if (negTermo) negTermo.value = '';
            if (negEvento) negEvento.value = 'todos';
            if (negStatusAtivo) negStatusAtivo.value = '';
            if (negDataInicio) negDataInicio.value = '';
            if (negDataFim) {
                if (modoCobranca && lastDataRefCobranca) {
                    negDataFim.value = lastDataRefCobranca;
                } else {
                    negDataFim.value = '';
                }
            }
            if (negOperadorCobranca) negOperadorCobranca.value = '';
            negAtivosListagemCompleta = false;
            sortAtivos = { col: 'data', dir: 'desc' };
            sortCarteiraBloco = {
                negativados: { col: 'data', dir: 'desc' },
                positivados: { col: 'data', dir: 'desc' }
            };
            if (negResultsSection) negResultsSection.classList.add('d-none');
            var tbGN = document.getElementById('negTbodyGeralNeg');
            var tbGP = document.getElementById('negTbodyGeralPos');
            if (tbGN) tbGN.innerHTML = '';
            if (tbGP) tbGP.innerHTML = '';
            negGeralRowsNeg = [];
            negGeralRowsPos = [];
            negUltimoPayloadGeralAtivos = null;
            var cnClr = document.getElementById('negSplitNegativacaoCount');
            var cpClr = document.getElementById('negSplitPositivacaoCount');
            if (cnClr) cnClr.textContent = '0';
            if (cpClr) cpClr.textContent = '0';
            updateGeralBulkButtonsState();
            if (negAtivosBlocksContainer) negAtivosBlocksContainer.innerHTML = '';
            negUltimoPayloadCobranca = null;
            var kNeg = document.getElementById('negKpiNegativados');
            var kPos = document.getElementById('negKpiPositivados');
            var kt = document.getElementById('negKpiTotalAtivos');
            if (kNeg) kNeg.textContent = '0';
            if (kPos) kPos.textContent = '0';
            if (kt) kt.textContent = '0';
            if (negNoResults) negNoResults.classList.add('d-none');
            updateSortIndicators();
        });
    }

    if (negBtnExportarExcel) {
        negBtnExportarExcel.addEventListener('click', exportNegativacaoExcel);
    }

    bindNegSplitPanels();

    updateSortIndicators();

    if (modoCobranca && negResultsSection && !negUrlBootstrap.autoPesquisar) {
        negResultsSection.classList.remove('d-none');
        negAtivosListagemCompleta = true;
        load();
    } else if (!modoCobranca && negResultsSection) {
        negResultsSection.classList.remove('d-none');
        negAtivosListagemCompleta = false;
        load();
    }
});
