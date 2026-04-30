document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    var page = 1;
    var perPage = 40;

    var sortAtivos = { col: 'data', dir: 'desc' };
    var sortHist = { col: 'data', dir: 'desc' };
    /** Ordenacao independente nas tabelas dos blocos Carteira Cobranca (apos fetch). */
    var sortCobrancaFaixa = {
        critico: { col: 'data', dir: 'desc' },
        atencao: { col: 'data', dir: 'desc' }
    };

    var cfg = window.NEGATIVACAO_PAGE_CONFIG || {};
    var STORAGE_KEY = 'negativacao_modo_cobranca';

    function initialModoCobranca() {
        var raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw === '1') return true;
        if (raw === '0') return false;
        if (cfg.defaultFuncionarioCobrancaId != null) return true;
        return false;
    }

    var modoCobranca = initialModoCobranca();
    /** Apos clicar em Pesquisar, lista todas as parcelas ativas (sem limite 20). */
    var negAtivosListagemCompleta = false;
    /** Ultimo JSON da listagem em carteira cobranca (blocos critico/atencao). */
    var negUltimoPayloadCobranca = null;
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
    var negSubcardHist = document.querySelector('#negResultsSection .neg-subcard-hist');

    var negSearchForm = document.getElementById('negSearchForm');
    var negTipoBusca = document.getElementById('neg_tipo_busca');
    var negTermo = document.getElementById('neg_termo');
    var negEvento = document.getElementById('neg_evento');
    var negStatusAtivo = document.getElementById('neg_status_ativo');
    var negDataInicio = document.getElementById('neg_data_inicio');
    var negDataFim = document.getElementById('neg_data_fim');
    var negBtnLimpar = document.getElementById('negBtnLimpar');
    var negResultsSection = document.getElementById('negResultsSection');
    var negNoResults = document.getElementById('negNoResults');
    var negHistMeta = document.getElementById('negHistMeta');
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

    function countSerasaElegivelCarteira(rows, tipoOperacao) {
        var key = tipoOperacao === 'positivar' ? 'serasa_elegivel_positivar' : 'serasa_elegivel_negativar';
        var n = 0;
        (rows || []).forEach(function (r) {
            if (r[key]) n++;
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
            parts.push('ate ' + negDataFim.value);
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
                ? ('Somente contratos no mesmo universo do modulo Cobranca (ultimo snapshot GM, parcelas em aberto).' +
                    (cfg.perfilCobranca ? ' Seu perfil lista apenas contratos atribuidos a voce.' : ''))
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
        if (negSubcardHist) {
            if (modoCobranca) {
                negSubcardHist.setAttribute('hidden', '');
            } else {
                negSubcardHist.removeAttribute('hidden');
            }
        }
    }

    function updateBannerText() {
        if (!negModoCobrancaBanner || !modoCobranca) return;
        var chunks = [
            'Lista filtrada como no painel Cobranca: snapshot GM e contrato em aberto com parcela em aberto.'
        ];
        if (cfg.defaultFuncionarioCobrancaId != null) {
            chunks.push('Operador: ' + (cfg.defaultFuncionarioCobrancaNome || ('#' + cfg.defaultFuncionarioCobrancaId)) + '.');
        }
        if (lastDataRefCobranca) {
            chunks.push('Data referencia GM: ' + fmtDt(lastDataRefCobranca) + '.');
        } else {
            chunks.push('Pesquise para carregar a data de referencia.');
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
        if (negResultsSection && !negResultsSection.classList.contains('d-none')) {
            page = 1;
            load();
        }
    }

    if (negBtnModoGeral) negBtnModoGeral.addEventListener('click', function () { setModoCobranca(false); });
    if (negBtnModoCobranca) negBtnModoCobranca.addEventListener('click', function () { setModoCobranca(true); });

    if (negOperadorCobranca) {
        negOperadorCobranca.addEventListener('change', function () {
            if (!modoCobranca) return;
            if (negResultsSection && !negResultsSection.classList.contains('d-none')) {
                page = 1;
                load();
            }
        });
    }

    applyModoUI();
    updateBannerText();

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
                var sta = String(ra.status || '');
                var stb = String(rb.status || '');
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
        var stLow = String(r.status || '').toLowerCase();
        var badgeCls = statusAtivoBadgeClass(r.status);
        var acaoPos = stLow === 'aguardando_positivacao_serasa'
            ? '<span style="font-size:0.78rem;color:#92400e;white-space:normal;max-width:9rem;display:inline-block;text-align:right">' +
            'Pendente envio Serasa (use Positivar todos)</span>'
            : '<button type="button" class="btn-neg-positivar btn-neg-positivar-ativo" data-id-parcela="' + esc(String(idp)) + '">Positivar</button>';
        tr.innerHTML =
            '<td>' + gc + '</td>' +
            '<td>' + esc(r.numero_parcela != null ? r.numero_parcela : '-') + '</td>' +
            '<td>' + esc(r.dias_atraso != null ? r.dias_atraso : '-') + '</td>' +
            '<td><span class="status-badge ' + badgeCls + '">' + esc(statusAtivoLabel(r.status)) + '</span></td>' +
            '<td>' + fmtDt(r.data_negativacao) + '</td>' +
            '<td>' + esc(r.funcionario_nome || '-') + '</td>' +
            '<td class="text-right">' +
            '<button type="button" class="action-btn btn-neg-detalhe" data-contrato-id="' + esc(String(idc)) + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button> ' +
            acaoPos +
            '</td>';
        return tr;
    }

    function buildNegPriorityBlock(level, title, desc, iconClass, rows, incluirBulkPositivar) {
        var block = document.createElement('div');
        block.className = 'priority-block ' + level + ' collapsed';

        var count = rows ? rows.length : 0;
        var bulkHtml = '';
        if (incluirBulkPositivar) {
            var nPos = countSerasaElegivelCarteira(rows, 'positivar');
            var nNeg = countSerasaElegivelCarteira(rows, 'negativar');
            var disPos = count === 0 || nPos === 0 ? ' disabled' : '';
            var disNeg = count === 0 || nNeg === 0 ? ' disabled' : '';
            var titPos = nPos === 0
                ? 'Somente parcelas com positivacao interna registrada (apos clicar Positivar na linha).'
                : ('Enviar positivacao ao Serasa: ' + nPos + ' parcela(s) elegivel(is) neste bloco.');
            var titNeg = nNeg === 0
                ? 'Somente parcelas com negativacao interna pendente de envio (tracker ou falha de envio).'
                : ('Enviar negativacao ao Serasa: ' + nNeg + ' parcela(s) elegivel(is) neste bloco.');
            bulkHtml =
                '<div class="neg-priority-bulk-wrap">' +
                '<button type="button" class="bulk-btn bulk-btn-positivar-lote btn-neg-blk-pos"' + disPos +
                ' data-neg-blk-level="' + esc(level) + '" data-neg-blk-serasa-tipo="positivar" ' +
                'title="' + esc(titPos) + '">' +
                '<i class="fa-solid fa-check-double"></i><span>Positivar todos</span></button>' +
                '<button type="button" class="bulk-btn bulk-btn-negativar-lote btn-neg-blk-pos"' + disNeg +
                ' data-neg-blk-level="' + esc(level) + '" data-neg-blk-serasa-tipo="negativar" ' +
                'title="' + esc(titNeg) + '">' +
                '<i class="fa-solid fa-ban"></i><span>Negativar todos</span></button>' +
                '</div>';
        }

        var header = document.createElement('div');
        header.className = 'priority-header';
        header.innerHTML =
            '<div class="priority-header-left">' +
            '  <div class="priority-icon"><i class="' + iconClass + '"></i></div>' +
            '  <div class="priority-info">' +
            '    <h4>' + esc(title) + '</h4>' +
            '    <span class="priority-desc">' + esc(desc) + '</span>' +
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

        if (!rows || !rows.length) {
            body.innerHTML =
                '<div class="empty-block"><i class="fa-regular fa-circle-check"></i>' +
                'Nenhuma parcela negativada nesta faixa.</div>';
        } else {
            var wrap = document.createElement('div');
            wrap.className = 'table-responsive';
            var table = document.createElement('table');
            table.className = 'styled-table busca-results-table';
            var tblTag = 'cobranca-' + level;
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
            bindDetalhes(tb);
        }

        block.appendChild(body);
        return block;
    }

    function collectParcelaIdsCarteiraFaixa(faixa, tipoOperacao) {
        if (!negUltimoPayloadCobranca || (faixa !== 'critico' && faixa !== 'atencao')) return [];
        var rows = faixa === 'critico'
            ? (negUltimoPayloadCobranca.ativos_critico || [])
            : (negUltimoPayloadCobranca.ativos_atencao || []);
        var seen = {};
        var out = [];
        var st = faixa === 'critico' ? sortCobrancaFaixa.critico : sortCobrancaFaixa.atencao;
        var sorted = sortNegAtivosRowsCopy(rows, st.col, st.dir);
        var key = tipoOperacao === 'positivar' ? 'serasa_elegivel_positivar' : 'serasa_elegivel_negativar';
        sorted.forEach(function (r) {
            if (!r[key]) return;
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
        var critico = sortNegAtivosRowsCopy(data.ativos_critico || [], sortCobrancaFaixa.critico.col, sortCobrancaFaixa.critico.dir);
        var atencao = sortNegAtivosRowsCopy(data.ativos_atencao || [], sortCobrancaFaixa.atencao.col, sortCobrancaFaixa.atencao.dir);
        var nc = critico.length;
        var na = atencao.length;
        var sum = nc + na;

        var kc = document.getElementById('negKpiCritico');
        var ka = document.getElementById('negKpiAtencao');
        var kt = document.getElementById('negKpiTotalAtivos');
        if (kc) kc.textContent = String(nc);
        if (ka) ka.textContent = String(na);
        if (kt) kt.textContent = String(sum);

        if (!negAtivosBlocksContainer) return;
        negAtivosBlocksContainer.innerHTML = '';
        negAtivosBlocksContainer.appendChild(
            buildNegPriorityBlock('critico', 'Cr\u00edtico', '60 \u2013 90+ dias de atraso',
                'fa-solid fa-fire', critico, true)
        );
        negAtivosBlocksContainer.appendChild(
            buildNegPriorityBlock('atencao', 'Aten\u00e7\u00e3o', '30 \u2013 60 dias de atraso',
                'fa-solid fa-exclamation-triangle', atencao, true)
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
            else if (tbl === 'hist' && sortHist.col === col) dir = sortHist.dir;
            else if (tbl === 'cobranca-critico' && sortCobrancaFaixa.critico.col === col) {
                dir = sortCobrancaFaixa.critico.dir;
            } else if (tbl === 'cobranca-atencao' && sortCobrancaFaixa.atencao.col === col) {
                dir = sortCobrancaFaixa.atencao.dir;
            }
            ind.textContent = dir ? (dir === 'asc' ? '▲' : '▼') : '';
        });
    }

    function renderAtivos(rows, filterDesc, payload) {
        var tb = document.getElementById('negTbodyAtivos');
        if (!tb || !negAtivosMeta) return;
        if (negAtivosBlocksContainer) negAtivosBlocksContainer.innerHTML = '';
        var meta = (rows && rows.length ? rows.length + ' registro(s)' : 'Nenhuma parcela negativada no momento.') +
            (filterDesc ? (' | ' + filterDesc) : '');
        if (payload && payload.ativos_em_preview) {
            var tot = payload.total_ativos != null ? Number(payload.total_ativos) : 0;
            if (tot > (rows ? rows.length : 0)) {
                meta += ' | Mostrando as 20 mais recentes (' + tot + ' no total). Ajuste filtros e Pesquisar para listar todas.';
            }
        }
        negAtivosMeta.textContent = meta;
        tb.innerHTML = '';
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="7" style="color:#64748b">Sem registros.</td></tr>';
            updateSortIndicators();
            return;
        }
        rows.forEach(function (r) {
            tb.appendChild(createAtivoRow(r));
        });
        bindPositivar(tb);
        bindDetalhes(tb);
        updateSortIndicators();
    }

    function renderHist(rows, filterDesc) {
        var tb = document.getElementById('negTbodyHist');
        if (!tb || !negHistMeta) return;
        if (!modoCobranca) {
            negHistMeta.textContent = (rows && rows.length ? rows.length + ' evento(s) nesta pagina' : 'Nenhum evento.') +
                (filterDesc ? (' | ' + filterDesc) : '');
        } else {
            negHistMeta.textContent = '';
        }
        tb.innerHTML = '';
        if (!rows || !rows.length) {
            tb.innerHTML = '<tr><td colspan="7" style="color:#64748b">Sem registros.</td></tr>';
            updateSortIndicators();
            return;
        }
        rows.forEach(function (r) {
            var tr = document.createElement('tr');
            var gc = esc(r.grupo) + '/' + esc(r.cota);
            var idc = r.id_contrato;
            var tipo = r.tipo_evento || '';
            var badgeClass = (tipo.indexOf('removido') === 0) ? 'status-success' : 'status-danger';
            if (tipo === 'observacao') badgeClass = 'status-active';
            var idpHist = r.id_parcela != null && r.id_parcela !== '' ? String(r.id_parcela) : '';
            var btnNeg = '';
            if (tipo.indexOf('removido') === 0 && idpHist) {
                btnNeg = ' <button type="button" class="btn-neg-danger btn-neg-negativar-hist" data-id-parcela="' + esc(idpHist) + '">Negativação</button>';
            }
            tr.innerHTML =
                '<td>' + fmtDt(r.data_evento) + '</td>' +
                '<td>' + gc + '</td>' +
                '<td>' + esc(r.numero_parcela != null ? r.numero_parcela : '-') + '</td>' +
                '<td><span class="status-badge ' + badgeClass + '">' + esc(tipoLabel(r.tipo_evento)) + '</span></td>' +
                '<td style="max-width:280px;white-space:normal">' + esc(r.detalhe || '-') + '</td>' +
                '<td>' + esc(r.funcionario_nome || '-') + '</td>' +
                '<td class="text-right">' +
                '<button type="button" class="action-btn btn-neg-detalhe" data-contrato-id="' + esc(String(idc)) + '"><i class="fa-solid fa-file-lines"></i> Detalhes</button>' +
                btnNeg +
                '</td>';
            tb.appendChild(tr);
        });
        bindDetalhes(tb);
        bindNegativarHistorico(tb);
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
                ? ('Nenhuma parcela elegivel para positivacao Serasa neste bloco. ' +
                    'E necessario registrar primeiro a positivacao interna (botao Positivar na linha).')
                : ('Nenhuma parcela elegivel para negativacao Serasa neste bloco. ' +
                    'So entram parcelas com negativacao interna pendente de envio (ex.: tracker ou falha).'));
            return;
        }
        var nomeBloco = faixa === 'critico' ? 'Critico' : 'Atencao';
        var qtd = ids.length;
        var msgTipo = tipoOperacao === 'positivar'
            ? ('enviar POSITIVACAO ao Serasa para ' + qtd + ' parcela(s) elegivel(is) no bloco ' + nomeBloco)
            : ('enviar NEGATIVACAO ao Serasa para ' + qtd + ' parcela(s) elegivel(is) no bloco ' + nomeBloco);
        if (!window.confirm(
            'Confirmar ' + msgTipo + '? Este passo dispara o envio para a API do Serasa (integracao em desenvolvimento).'
        )) return;
        fetch('/api/negativacao/positivar-lote-serasa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo_operacao: tipoOperacao,
                faixa: faixa,
                ids_parcela: ids
            })
        }).then(function (res) { return res.json().then(function (j) { return { res: res, j: j }; }); })
            .then(function (o) {
                if (!o.res.ok) throw new Error(o.j.error || o.res.statusText);
                alert(o.j.mensagem || 'Pedido registrado.');
                if (modoCobranca) load();
            })
            .catch(function (err) { alert(err.message || String(err)); });
    }

    function load() {
        var tipoBusca = negTipoBusca ? negTipoBusca.value : 'contrato';
        var q = negTermo ? negTermo.value.trim() : '';
        var params = new URLSearchParams({
            page: String(page),
            per_page: String(perPage),
            q: q,
            tipo_busca: tipoBusca,
            sort_hist: sortHist.col,
            order_hist: sortHist.dir,
            sort_ativos: sortAtivos.col,
            order_ativos: sortAtivos.dir
        });
        if (negEvento && negEvento.value) params.set('evento', negEvento.value);
        if (negStatusAtivo && negStatusAtivo.value) params.set('status_ativo', negStatusAtivo.value);
        if (!modoCobranca && negDataInicio && negDataInicio.value) {
            params.set('data_inicio', negDataInicio.value);
        }
        if (negDataFim && negDataFim.value) params.set('data_fim', negDataFim.value);

        if (!modoCobranca && isNegFiltersDefault() && !negAtivosListagemCompleta) {
            params.set('preview_ativos', '1');
        }

        if (modoCobranca) {
            params.set('apenas_cobranca', '1');
            var fidOp = null;
            if (cfg.perfilCobranca && cfg.defaultFuncionarioCobrancaId != null) {
                fidOp = cfg.defaultFuncionarioCobrancaId;
            } else if (negOperadorCobranca && negOperadorCobranca.value) {
                var parsed = parseInt(negOperadorCobranca.value, 10);
                fidOp = parsed > 0 ? parsed : null;
            }
            if (fidOp != null) params.set('funcionario_id', String(fidOp));
        }

        if (negHistMeta && !modoCobranca) negHistMeta.textContent = 'Carregando...';
        if (negAtivosMeta) negAtivosMeta.textContent = 'Carregando...';

        var fd = buildFilterDesc(q);

        fetch('/api/negativacao/listagem?' + params.toString())
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.data_referencia_cobranca) {
                    lastDataRefCobranca = data.data_referencia_cobranca;
                    updateBannerText();
                }

                var total = data.total_historico != null ? data.total_historico : 0;
                var maxPage = Math.max(1, Math.ceil(total / perPage));
                if (page > maxPage) {
                    page = maxPage;
                    return load();
                }

                var ativos = data.ativos || [];
                var hist = data.historico || [];

                if (modoCobranca) {
                    populateOperadorSelect(data);
                    renderAtivosCobranca(data);
                    var tbClear = document.getElementById('negTbodyAtivos');
                    if (tbClear) tbClear.innerHTML = '';
                } else {
                    negUltimoPayloadCobranca = null;
                    renderAtivos(ativos, fd, data);
                }
                if (modoCobranca) {
                    renderHist([], '');
                } else {
                    renderHist(hist, fd);
                }

                var info = document.getElementById('negPageInfo');
                if (info) {
                    info.textContent = 'Pagina ' + page + ' de ' + maxPage + ' / ' + total + ' evento(s) no historico';
                }

                var sumCob = 0;
                if (modoCobranca) {
                    sumCob = (data.ativos_critico || []).length +
                        (data.ativos_atencao || []).length;
                }
                var empty = modoCobranca ? (sumCob === 0)
                    : (ativos.length === 0 && hist.length === 0);
                if (negNoResults) {
                    negNoResults.classList.toggle('d-none', !empty);
                }
            })
            .catch(function (e) {
                console.error(e);
                if (negHistMeta) negHistMeta.textContent = 'Erro ao carregar.';
                if (negAtivosMeta) negAtivosMeta.textContent = '';
                if (negAtivosBlocksContainer) negAtivosBlocksContainer.innerHTML = '';
                negUltimoPayloadCobranca = null;
            });
    }

    function onSortClick(th) {
        var tbl = th.getAttribute('data-neg-table');
        var col = th.getAttribute('data-neg-sort');
        if (!tbl || !col) return;
        if (tbl === 'cobranca-critico' || tbl === 'cobranca-atencao') {
            var faixa = tbl === 'cobranca-critico' ? 'critico' : 'atencao';
            var st = sortCobrancaFaixa[faixa];
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
        } else if (tbl === 'hist') {
            if (sortHist.col === col) {
                sortHist.dir = sortHist.dir === 'asc' ? 'desc' : 'asc';
            } else {
                sortHist.col = col;
                sortHist.dir = 'desc';
            }
            page = 1;
        }
        load();
    }

    document.querySelectorAll('#negTableAtivos thead, #negTableHist thead').forEach(function (thead) {
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
            if (tbl !== 'cobranca-critico' && tbl !== 'cobranca-atencao') return;
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
            page = 1;
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
            if (negDataFim) negDataFim.value = '';
            if (negOperadorCobranca) negOperadorCobranca.value = '';
            page = 1;
            negAtivosListagemCompleta = false;
            sortAtivos = { col: 'data', dir: 'desc' };
            sortHist = { col: 'data', dir: 'desc' };
            sortCobrancaFaixa = {
                critico: { col: 'data', dir: 'desc' },
                atencao: { col: 'data', dir: 'desc' }
            };
            if (negResultsSection) negResultsSection.classList.add('d-none');
            var tbA = document.getElementById('negTbodyAtivos');
            var tbH = document.getElementById('negTbodyHist');
            if (tbA) tbA.innerHTML = '';
            if (tbH) tbH.innerHTML = '';
            if (negAtivosBlocksContainer) negAtivosBlocksContainer.innerHTML = '';
            negUltimoPayloadCobranca = null;
            var kc = document.getElementById('negKpiCritico');
            var ka = document.getElementById('negKpiAtencao');
            var kt = document.getElementById('negKpiTotalAtivos');
            if (kc) kc.textContent = '0';
            if (ka) ka.textContent = '0';
            if (kt) kt.textContent = '0';
            if (negNoResults) negNoResults.classList.add('d-none');
            updateSortIndicators();
        });
    }

    var prev = document.getElementById('negPrevPage');
    var next = document.getElementById('negNextPage');
    function resultsVisible() {
        return negResultsSection && !negResultsSection.classList.contains('d-none');
    }
    if (prev) prev.addEventListener('click', function () {
        if (!resultsVisible()) return;
        if (page > 1) { page--; load(); }
    });
    if (next) next.addEventListener('click', function () {
        if (!resultsVisible()) return;
        page++;
        load();
    });

    var formObs = document.getElementById('negObsForm');
    if (formObs) {
        formObs.addEventListener('submit', function (e) {
            e.preventDefault();
            var cid = parseInt(document.getElementById('negObsContratoId').value, 10);
            var txt = (document.getElementById('negObsTexto').value || '').trim();
            var msg = document.getElementById('negObsMsg');
            if (!cid || !txt) return;
            fetch('/api/negativacao/observacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_contrato: cid, detalhe: txt })
            }).then(function (res) { return res.json().then(function (j) { return { res: res, j: j }; }); })
                .then(function (o) {
                    if (!o.res.ok) throw new Error(o.j.error || o.res.statusText);
                    if (msg) {
                        msg.style.display = 'block';
                        msg.style.color = '#047857';
                        msg.textContent = 'Observacao registrada.';
                    }
                    document.getElementById('negObsTexto').value = '';
                    if (negResultsSection && !negResultsSection.classList.contains('d-none')) load();
                })
                .catch(function (err) {
                    if (msg) {
                        msg.style.display = 'block';
                        msg.style.color = '#b91c1c';
                        msg.textContent = err.message || String(err);
                    }
                });
        });
    }

    updateSortIndicators();

    if (!modoCobranca && negResultsSection) {
        negResultsSection.classList.remove('d-none');
        negAtivosListagemCompleta = false;
        load();
    }
});
