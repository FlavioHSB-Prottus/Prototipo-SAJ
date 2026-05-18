/**
 * Modal completo "Detalhes do Contrato" (parcelas, ocorrências, tramitações, etc.)
 * Usado em Dashboard e Performance JB (painel de busca). Requer tramitacoes_detail.js e #detalhesModal no HTML.
 */
(function (global) {
    'use strict';

    function esc(val) {
        if (val === null || val === undefined) return '-';
        var div = document.createElement('div');
        div.textContent = String(val);
        return div.innerHTML;
    }

    function formatDate(val) {
        if (!val) return '-';
        var parts = String(val).split('T')[0].split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        return val;
    }

    function formatDateTime(val) {
        if (!val) return '-';
        var parts = String(val).split('T');
        var dPart = parts[0];
        var tPart = parts[1] || '';
        if (parts.length === 1 && String(val).indexOf(' ') !== -1) {
            var spaceParts = String(val).split(' ');
            dPart = spaceParts[0];
            tPart = spaceParts[1] || '';
        }
        var dSplit = dPart.split('-');
        var fmtDate = dSplit.length === 3 ? dSplit[2] + '/' + dSplit[1] + '/' + dSplit[0] : dPart;
        var fmtTime = tPart ? tPart.substring(0, 5) : '';
        return fmtDate + (fmtTime ? ' ' + fmtTime : '');
    }

    function formatCurrency(val) {
        if (val === null || val === undefined || val === '') return '-';
        var num = parseFloat(val);
        if (isNaN(num)) return esc(val);
        return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    var CONTRATO_PARCELAS_STATUS_TODOS = '__todos__';

    function calendarDayKey(val) {
        var raw = String(val || '').trim();
        var datePart = raw.split('T')[0];
        if (datePart.indexOf(' ') !== -1) datePart = datePart.split(' ')[0];
        return datePart;
    }

    function parseDataArquivoMs(val) {
        if (!val) return 0;
        var s = String(val).trim().replace(' ', 'T');
        var d = new Date(s);
        var t = d.getTime();
        return isNaN(t) ? 0 : t;
    }

    /** Mais recente primeiro: dia desc, depois hora desc, depois id desc. */
    function sortOcorrenciasForTimeline(arr) {
        return arr.slice().sort(function (a, b) {
            var da = calendarDayKey(a.data_arquivo);
            var db = calendarDayKey(b.data_arquivo);
            if (da !== db) return da < db ? 1 : da > db ? -1 : 0;
            var ta = parseDataArquivoMs(a.data_arquivo);
            var tb = parseDataArquivoMs(b.data_arquivo);
            if (ta !== tb) return tb - ta;
            var ida = parseInt(a.id, 10);
            var idb = parseInt(b.id, 10);
            ida = isNaN(ida) ? 0 : ida;
            idb = isNaN(idb) ? 0 : idb;
            return idb - ida;
        });
    }

    function buildParcelasSectionHtml(parcelas) {
        if (!parcelas || !parcelas.length) return '';
        var labelsByLower = {};
        parcelas.forEach(function (p) {
            var raw = (p.status != null && p.status !== '') ? String(p.status) : '-';
            var lo = raw.toLowerCase();
            if (!Object.prototype.hasOwnProperty.call(labelsByLower, lo)) {
                labelsByLower[lo] = raw;
            }
        });
        var lowers = Object.keys(labelsByLower);
        lowers.sort();
        var hasCobranca = lowers.indexOf('cobranca') !== -1;
        var defaultVal = hasCobranca ? 'cobranca' : CONTRATO_PARCELAS_STATUS_TODOS;

        var html = '';
        html += '<div class="detail-section" data-contrato-parcelas-section="1">';
        html += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-bottom:10px">';
        html += '<h3 style="margin:0"><i class="fa-solid fa-list-ol"></i> Parcelas (' + parcelas.length + ')</h3>';
        html += '<span style="font-size:0.85rem;color:#64748b">A mostrar <strong class="js-contrato-parcelas-visible">0</strong> de <strong>' +
            parcelas.length + '</strong></span>';
        html += '<label style="display:inline-flex;align-items:center;gap:8px;margin-left:auto;font-size:0.88rem;color:#334155;flex-wrap:wrap">';
        html += 'Status <select id="contratoParcelasStatusFilter" class="form-control" style="max-width:220px;display:inline-block">';
        html += '<option value="' + esc(CONTRATO_PARCELAS_STATUS_TODOS) + '"' +
            (defaultVal === CONTRATO_PARCELAS_STATUS_TODOS ? ' selected' : '') + '>Todos</option>';
        lowers.forEach(function (lo) {
            var sel = defaultVal === lo ? ' selected' : '';
            html += '<option value="' + esc(lo) + '"' + sel + '>' + esc(labelsByLower[lo]) + '</option>';
        });
        html += '</select></label></div>';
        html += '<div class="table-responsive"><table class="styled-table modal-table"><thead><tr>';
        html += '<th>Nro</th><th>Vencimento</th><th>Valor Nominal</th><th>Multa/Juros</th><th>Valor Total</th><th>Status</th>';
        html += '</tr></thead><tbody id="contratoParcelasTbody">';
        parcelas.forEach(function (p) {
            var stRaw = (p.status != null && p.status !== '') ? String(p.status) : '-';
            var stLo = stRaw.toLowerCase();
            var hide = defaultVal !== CONTRATO_PARCELAS_STATUS_TODOS && stLo !== defaultVal;
            html += '<tr data-parcela-status="' + esc(stLo) + '"' + (hide ? ' style="display:none"' : '') + '>';
            html += '<td>' + esc(p.numero_parcela) + '</td>';
            html += '<td>' + formatDate(p.vencimento) + '</td>';
            html += '<td>' + formatCurrency(p.valor_nominal) + '</td>';
            html += '<td>' + formatCurrency(p.multa_juros) + '</td>';
            html += '<td class="fw-bold">' + formatCurrency(p.valor_total) + '</td>';
            html += '<td><span class="status-badge ' + getStatusClass(p.status) + '">' + esc(p.status || '-') + '</span></td>';
            html += '</tr>';
        });
        html += '</tbody></table></div></div>';
        return html;
    }

    function initParcelasFilter(container) {
        if (!container || !container.querySelector) return;
        var sel = container.querySelector('#contratoParcelasStatusFilter');
        var tb = container.querySelector('#contratoParcelasTbody');
        var visEl = container.querySelector('.js-contrato-parcelas-visible');
        if (!sel || !tb) return;
        function apply() {
            var v = sel.value;
            var rows = tb.querySelectorAll('tr');
            var n = 0;
            for (var i = 0; i < rows.length; i++) {
                var tr = rows[i];
                var st = tr.getAttribute('data-parcela-status') || '';
                var show = v === CONTRATO_PARCELAS_STATUS_TODOS || st === v;
                tr.style.display = show ? '' : 'none';
                if (show) n += 1;
            }
            if (visEl) visEl.textContent = String(n);
        }
        sel.addEventListener('change', apply);
        apply();
    }

    var _MESES_PT = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    function parseYmFromDateRaw(dateRaw) {
        var datePart = calendarDayKey(dateRaw);
        var parts = datePart.split('-');
        if (parts.length < 2) return null;
        var y = parseInt(parts[0], 10);
        var mo = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(mo) || mo < 1 || mo > 12) return null;
        return {
            ym: y + '-' + (mo < 10 ? '0' + mo : String(mo)),
            label: _MESES_PT[mo - 1] + ' de ' + y
        };
    }

    function groupByMonth(items, getDateRaw, monthSort) {
        var map = {};
        var order = [];
        (items || []).forEach(function (item) {
            var info = parseYmFromDateRaw(getDateRaw(item));
            var ym = info ? info.ym : '0000-00';
            var label = info ? info.label : 'Sem data definida';
            if (!map[ym]) {
                map[ym] = { ym: ym, label: label, items: [] };
                order.push(ym);
            }
            map[ym].items.push(item);
        });
        order.sort(function (a, b) {
            if (a === '0000-00') return 1;
            if (b === '0000-00') return -1;
            if (monthSort === 'desc') return a < b ? 1 : a > b ? -1 : 0;
            return a < b ? -1 : a > b ? 1 : 0;
        });
        var latestYm = null;
        for (var i = 0; i < order.length; i++) {
            if (order[i] !== '0000-00') {
                latestYm = monthSort === 'desc' ? order[0] : order[order.length - 1];
                break;
            }
        }
        if (!latestYm && order.length) latestYm = order[order.length - 1];
        return { map: map, order: order, latestYm: latestYm };
    }

    function renderTimelineMonthGroups(groups, renderItemHtml) {
        var html = '';
        groups.order.forEach(function (ym) {
            var g = groups.map[ym];
            if (!g || !g.items.length) return;
            var expanded = ym === groups.latestYm;
            var countLbl = g.items.length === 1 ? '1 registro' : g.items.length + ' registros';
            html += '<div class="timeline-month-group' + (expanded ? ' is-expanded' : '') + '" data-ym="' + esc(ym) + '">';
            html += '<button type="button" class="timeline-month-toggle" aria-expanded="' + (expanded ? 'true' : 'false') + '">';
            html += '<i class="fa-solid fa-chevron-right timeline-month-chevron" aria-hidden="true"></i>';
            html += '<span class="timeline-month-label">' + esc(g.label) + '</span>';
            html += '<span class="timeline-month-count">' + esc(countLbl) + '</span>';
            html += '</button>';
            html += '<div class="timeline-month-body"' + (expanded ? '' : ' hidden') + '>';
            g.items.forEach(function (item) {
                html += renderItemHtml(item);
            });
            html += '</div></div>';
        });
        return html;
    }

    function initTimelineMonthGroups(container) {
        if (!container || container._timelineMonthBound) return;
        container._timelineMonthBound = true;
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('.timeline-month-toggle');
            if (!btn || !container.contains(btn)) return;
            e.preventDefault();
            var group = btn.closest('.timeline-month-group');
            if (!group) return;
            var body = group.querySelector('.timeline-month-body');
            var open = group.classList.toggle('is-expanded');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (body) {
                if (open) body.removeAttribute('hidden');
                else body.setAttribute('hidden', '');
            }
        });
    }

    function buildTramitacoesSectionHtml(data, contratoId, helpers) {
        if (typeof TramitacoesDetalhe === 'undefined') return '';
        var h = helpers || {};
        return TramitacoesDetalhe.buildSection(data.tramitacoes || [], contratoId, {
            esc: h.esc || esc,
            formatDateTime: h.formatDateTime || formatDateTime,
            registrosSmsEmail: data.registros_sms_email || [],
        });
    }

    function buildOcorrenciaItemHtml(o) {
        var html = '<div class="timeline-item">';
        html += '<div class="timeline-date">' + formatDate(o.data_arquivo) + '</div>';
        html += '<div class="timeline-event"><strong><span class="status-badge ' + getStatusClass(o.status) + '">' +
            esc(o.status || '') + '</span></strong> ' + esc(o.descricao || '') + '</div>';
        html += '</div>';
        return html;
    }

    function buildOcorrenciasTimelineHtml(ocorrencias) {
        if (!ocorrencias || !ocorrencias.length) return '';
        var sorted = sortOcorrenciasForTimeline(ocorrencias);
        var groups = groupByMonth(sorted, function (o) { return o.data_arquivo; }, 'desc');
        var html = '';
        html += '<div class="detail-section"><h3><i class="fa-solid fa-timeline"></i> Histórico de Ocorrências (' + ocorrencias.length + ')</h3>';
        html += '<p class="timeline-month-hint">Clique no mês para expandir ou recolher. O mês mais recente inicia aberto.</p>';
        html += '<div class="timeline timeline-ocorrencias timeline-month-groups">';
        html += renderTimelineMonthGroups(groups, buildOcorrenciaItemHtml);
        html += '</div></div>';
        return html;
    }

    function negativacaoTipoLabel(tipo) {
        var m = {
            negativado_manual: 'Negativado (manual)',
            negativado_tracker: 'Negativado (automático)',
            removido_pagamento: 'Positivação (pagamento)',
            positivado_tracker: 'Positivado (automático)',
            removido_manual: 'Positivação (manual)',
            negativacao_retorno: 'Retorno SERASA (negativação)',
            positivacao_retorno: 'Retorno SERASA (positivação)',
            observacao: 'Observação'
        };
        return m[tipo] || (tipo || 'Evento');
    }

    function negativacaoTipoClass(tipo) {
        if (!tipo) return 'status-active';
        if (String(tipo).indexOf('negativado') === 0) return 'status-danger';
        if (String(tipo).indexOf('removido') === 0 || tipo === 'positivado_tracker') return 'status-success';
        if (tipo === 'observacao') return 'status-warning';
        return 'status-active';
    }

    function sortNegativacaoHistoricoForTimeline(arr) {
        return arr.slice().sort(function (a, b) {
            var da = calendarDayKey(a.data_evento);
            var db = calendarDayKey(b.data_evento);
            if (da !== db) return da < db ? -1 : da > db ? 1 : 0;
            var ta = parseDataArquivoMs(a.data_evento);
            var tb = parseDataArquivoMs(b.data_evento);
            if (ta !== tb) return ta - tb;
            var ida = parseInt(a.id, 10);
            var idb = parseInt(b.id, 10);
            ida = isNaN(ida) ? 0 : ida;
            idb = isNaN(idb) ? 0 : idb;
            return ida - idb;
        });
    }

    function negativacaoEhTipoNegativado(tipo) {
        var t = String(tipo || '');
        return t === 'negativado_manual' || t === 'negativado_tracker';
    }

    /** True se existe positivação (removido_*) para a parcela depois deste evento na linha do tempo. */
    function negativacaoHaRemocaoDepois(sortedHist, ev) {
        if (!ev || ev.numero_parcela == null || ev.numero_parcela === '') return false;
        var parc = String(ev.numero_parcela);
        var idx = -1;
        for (var i = 0; i < sortedHist.length; i++) {
            if (String(sortedHist[i].id) === String(ev.id)) {
                idx = i;
                break;
            }
        }
        if (idx < 0) return false;
        for (var j = idx + 1; j < sortedHist.length; j++) {
            var h = sortedHist[j];
            if (String(h.numero_parcela) !== parc) continue;
            var t = String(h.tipo_evento || '');
            if (t.indexOf('removido') === 0 || t === 'positivado_tracker') return true;
        }
        return false;
    }

    function negativacaoHistoricoTemNegativadoParaParcela(hist, parcela) {
        var p = String(parcela);
        for (var i = 0; i < hist.length; i++) {
            var h = hist[i];
            if (String(h.numero_parcela) !== p) continue;
            if (negativacaoEhTipoNegativado(h.tipo_evento)) return true;
        }
        return false;
    }

    function statusAtivaLegivel(status) {
        var s = String(status || '').toLowerCase();
        if (s === 'registrado_tracker') return 'registro via tracker';
        if (s === 'enviado') return 'enviado à birô';
        if (s === 'falhou') return 'falha no envio';
        return status || 'cadastro interno';
    }


    function negativacaoRowDateRaw(row) {
        if (row.kind === 'hist') return row.ev.data_evento;
        return row.ativa.data_negativacao;
    }

    function buildNegativacaoRowItemHtml(row) {
        var whenRaw;
        if (row.kind === 'hist') whenRaw = row.ev.data_evento;
        else whenRaw = row.ativa.data_negativacao;
        var html = '<div class="timeline-item">';
        if (row.kind === 'hist') {
            var ev = row.ev;
            html += '<div class="timeline-date">' + formatDateTime(whenRaw) + '</div>';
            var rot = negativacaoTipoLabel(ev.tipo_evento);
            var extra = '';
            if (ev.funcionario_nome) extra += ' · Operador: ' + esc(ev.funcionario_nome);
            if (ev.numero_parcela != null && ev.numero_parcela !== '' &&
                    String(ev.tipo_evento || '') !== 'removido_pagamento') {
                extra += ' · Parcela nº ' + esc(ev.numero_parcela);
            }
            if (row.emVigor) {
                extra += ' · <span class="status-badge status-warning" style="font-size:0.78em">Em vigor no cadastro</span>';
            }
            html += '<div class="timeline-event"><strong><span class="status-badge ' + negativacaoTipoClass(ev.tipo_evento) + '">' + esc(rot) + '</span></strong> ';
            html += esc(ev.detalhe || '') + (extra ? '<span style="color:#64748b;font-size:0.92em">' + extra + '</span>' : '');
            html += '</div>';
        } else {
            var n = row.ativa;
            html += '<div class="timeline-date">' + formatDateTime(whenRaw) + '</div>';
            var op = n.funcionario_nome ? ('Operador: ' + esc(n.funcionario_nome) + ' · ') : '';
            var det = 'Negativação ativa registrada apenas no cadastro interno (' + esc(statusAtivaLegivel(n.status)) +
                '). ' + op + 'Parcela nº ' + esc(n.numero_parcela != null ? n.numero_parcela : '—') + '.';
            html += '<div class="timeline-event"><strong><span class="status-badge status-danger">Negativação em vigor</span></strong> ';
            html += '<span style="color:#334155">' + det + '</span>';
            html += ' <span class="status-badge status-warning" style="font-size:0.78em">Sem evento no histórico</span>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    /**
     * Uma única linha do tempo: histórico ordenado + linhas sintéticas só quando
     * há negativação ativa sem evento de negativação correspondente no histórico.
     * Eventos de negativação cuja parcela ainda está ativa recebem nota "Em vigor".
     */
    function buildNegativacaoSectionHtml(data) {
        var ativas = data.negativacao_ativas || [];
        var historico = data.negativacao_historico || [];
        var sorted = sortNegativacaoHistoricoForTimeline(historico);
        var parcelasAtivas = {};
        ativas.forEach(function (a) {
            if (a.numero_parcela != null && a.numero_parcela !== '') {
                parcelasAtivas[String(a.numero_parcela)] = true;
            }
        });

        var timelineRows = [];

        sorted.forEach(function (ev) {
            var parc = ev.numero_parcela != null && ev.numero_parcela !== '' ? String(ev.numero_parcela) : '';
            var emVigor = false;
            if (parc && negativacaoEhTipoNegativado(ev.tipo_evento) && parcelasAtivas[parc] &&
                    !negativacaoHaRemocaoDepois(sorted, ev)) {
                emVigor = true;
            }
            timelineRows.push({
                sortMs: parseDataArquivoMs(ev.data_evento),
                kind: 'hist',
                ev: ev,
                emVigor: emVigor
            });
        });

        ativas.forEach(function (a) {
            if (negativacaoHistoricoTemNegativadoParaParcela(historico, a.numero_parcela)) return;
            timelineRows.push({
                sortMs: parseDataArquivoMs(a.data_negativacao),
                kind: 'ativa',
                ativa: a
            });
        });

        timelineRows.sort(function (x, y) {
            var dx = (x.sortMs || 0) - (y.sortMs || 0);
            if (dx !== 0) return dx;
            if (x.kind !== y.kind) return x.kind === 'hist' ? -1 : 1;
            return 0;
        });

        var tituloCount = timelineRows.length;

        var html = '';
        html += '<div class="detail-section"><h3><i class="fa-solid fa-ban"></i> Negativação e positivação (' +
            tituloCount + ' ' + (tituloCount === 1 ? 'registro' : 'registros') + ')</h3>';

        if (timelineRows.length === 0 && ativas.length === 0) {
            html += '<p style="color:#64748b;margin:0">Nenhum evento de negativação ou positivação registrado para este contrato.</p>';
            html += '</div>';
            return html;
        }

        html += '<p style="margin:0 0 8px;font-size:0.88rem;color:#64748b">Meses do mais recente ao mais antigo; dentro de cada mês, do mais antigo ao mais recente. ' +
            (ativas.length ? ('<strong>' + ativas.length + '</strong> parcela(s) com negativação ainda ativa no cadastro.') : '') +
            '</p>';
        html += '<p class="timeline-month-hint">Clique no mês para expandir ou recolher. O mês mais recente inicia aberto.</p>';
        html += '<div class="timeline timeline-ocorrencias timeline-month-groups">';
        var negGroups = groupByMonth(timelineRows, negativacaoRowDateRaw, 'desc');
        html += renderTimelineMonthGroups(negGroups, buildNegativacaoRowItemHtml);
        html += '</div></div>';
        return html;
    }

    function getStatusClass(status) {
        if (!status) return '';
        var s = String(status).toLowerCase();
        if (s === 'cobranca' || s === 'aberto' || s === 'em cobranca' || s === 'em cobrança') return 'status-active';
        if (s === 'pago' || s === 'pago total' || s === 'fechado') return 'status-success';
        if (s === 'pago parcial') return 'status-warning';
        if (s === 'indenizado') return 'status-warning';
        if (s === 'parcela paga') return 'status-success';
        if (s === 'parcela vencida') return 'status-danger';
        return 'status-active';
    }

    function dataItem(label, value, isBadge, badgeStatus) {
        var display = (value !== null && value !== undefined && value !== '') ? esc(value) : '-';
        if (isBadge && badgeStatus) {
            display = '<span class="status-badge ' + getStatusClass(badgeStatus) + '">' + esc(value) + '</span>';
        }
        return '<div class="data-item"><span class="data-label">' + esc(label) + '</span><span class="data-value">' + display + '</span></div>';
    }

    function humanizeBemField(key) {
        var map = {
            descricao: 'Descrição', descricao_bem: 'Descrição',
            modelo: 'Modelo', marca: 'Marca', categoria: 'Categoria',
            codigo: 'Código', codigo_bem: 'Código do Bem',
            valor: 'Valor', valor_bem: 'Valor do Bem', valor_avaliacao: 'Valor de Avaliação',
            nome: 'Nome', ano: 'Ano', ano_fabricacao: 'Ano de Fabricação',
            ano_modelo: 'Ano Modelo', placa: 'Placa', chassi: 'Chassi',
            renavam: 'Renavam', cor: 'Cor', tipo: 'Tipo', status: 'Status',
            combustivel: 'Combustível', observacao: 'Observação', observacoes: 'Observações'
        };
        if (map[key]) return map[key];
        return String(key).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function formatBemValue(key, value) {
        var k = String(key).toLowerCase();
        if (k.indexOf('valor') !== -1 || k.indexOf('preco') !== -1) {
            var n = Number(value);
            if (!isNaN(n) && isFinite(n)) return formatCurrency(n);
        }
        if (k === 'data' || k.indexOf('data_') === 0 || k.indexOf('_data') !== -1) return formatDate(value);
        return value;
    }

    function renderBemSection(bens) {
        if (!bens || bens.length === 0) return '';
        var skipFields = { id: 1, id_contrato: 1, grupo: 1, cota: 1, created_at: 1, updated_at: 1 };
        var titulo = bens.length > 1 ? ('Bem (' + bens.length + ')') : 'Bem';
        var html = '<div class="detail-section"><h3><i class="fa-solid fa-box"></i> ' + titulo + '</h3>';
        bens.forEach(function (bem, idx) {
            if (bens.length > 1) html += '<h4 style="margin:16px 0 8px;color:#6b7280;font-size:0.95rem;">Item ' + (idx + 1) + '</h4>';
            html += '<div class="detail-grid">';
            var anyField = false;
            Object.keys(bem).forEach(function (key) {
                if (skipFields[key]) return;
                var value = bem[key];
                if (value === null || value === undefined || value === '') return;
                anyField = true;
                html += dataItem(humanizeBemField(key), formatBemValue(key, value));
            });
            if (!anyField) html += '<div style="color:#9ca3af;">Sem informações adicionais.</div>';
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderPessoaSection(titulo, pessoa, enderecos, telefones, emails, idContrato) {
        var icon = titulo === 'Avalista' ? 'fa-user-shield' : 'fa-user-tie';
        var html = '<div class="detail-section"><h3><i class="fa-solid ' + icon + '"></i> ' + esc(titulo) + '</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Nome', pessoa.nome_completo);
        html += dataItem('CPF / CNPJ', pessoa.cpf_cnpj);
        html += dataItem('Data de Nascimento', formatDate(pessoa.data_nascimento));
        html += dataItem('Profissão', pessoa.profissao);
        html += dataItem('Cônjuge', pessoa.conjuge_nome);
        html += '</div>';
        var _papelEnd = titulo === 'Avalista' ? 'avalista' : 'devedor';
        if (pessoa && pessoa.id) {
            var _pEncEnd = encodeURIComponent(pessoa.nome_completo || '');
            var _pIdEnd = String(pessoa.id);
            html += '<div style="margin-top:12px">';
            html += '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">';
            html += '<h4 style="font-size:0.85rem;color:var(--text-muted);margin:0">Endereços</h4>';
            html += '<button type="button" class="action-btn btn-add-endereco-pessoa" data-pessoa-id="' + _pIdEnd + '" data-pessoa-nome="' + _pEncEnd + '" data-pessoa-papel="' + esc(_papelEnd) + '"><i class="fa-solid fa-plus"></i> Endereço</button>';
            html += '</div>';
            if (enderecos && enderecos.length > 0) {
                enderecos.forEach(function (e) {
                    html += '<div class="detail-grid" style="margin-bottom:12px">';
                    html += dataItem('Tipo', e.tipo);
                    html += dataItem('Logradouro', e.logradouro);
                    html += dataItem('Bairro', e.bairro);
                    html += dataItem('Complemento', e.complemento);
                    html += dataItem('CEP', e.cep);
                    html += dataItem('Cidade', e.cidade);
                    html += dataItem('Estado', e.estado);
                    var _fonteEnd = (typeof window.formatContatoFonteLabel === 'function') ? window.formatContatoFonteLabel(e.fonte) : '';
                    html += dataItem('Fonte', _fonteEnd || '-');
                    html += '</div>';
                });
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;margin:0">Nenhum endereco cadastrado.</p>';
            }
            html += '</div>';
        } else if (enderecos && enderecos.length > 0) {
            enderecos.forEach(function (e) {
                html += '<div class="detail-grid" style="margin-top:12px">';
                html += dataItem('Endereço (' + (e.tipo || '') + ')', [e.logradouro, e.complemento, e.bairro, e.cidade, e.estado, e.cep].filter(Boolean).join(', '));
                var _fonteEnd2 = (typeof window.formatContatoFonteLabel === 'function') ? window.formatContatoFonteLabel(e.fonte) : '';
                if (_fonteEnd2) html += dataItem('Fonte', _fonteEnd2);
                html += '</div>';
            });
        }
        if (pessoa && pessoa.id) {
            var _pEnc = encodeURIComponent(pessoa.nome_completo || '');
            var _pId = String(pessoa.id);
            var _pnSms = String((pessoa && pessoa.nome_completo) || '').trim();
            if (_pnSms) {
                _pnSms = _pnSms.split(/\s+/)[0];
            } else {
                _pnSms = 'Cliente';
            }
            html += '<div class="contact-grid" style="margin-top:12px">';
            html += '<div><div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px"><h4 style="font-size:0.85rem;color:var(--text-muted);margin:0">Telefones</h4>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="action-btn btn-add-telefone-pessoa" data-pessoa-id="' + _pId + '" data-pessoa-nome="' + _pEnc + '" data-recurso="telefone"><i class="fa-solid fa-plus"></i> Telefone</button></div></div>';
            if (telefones && telefones.length) {
                html += '<ul class="contact-list">';
                telefones.forEach(function (t) {
                    html += '<li><i class="fa-solid fa-phone"></i> ' + esc(t.numero || '-');
                    if (t.ramal) html += ' (ramal ' + esc(t.ramal) + ')';
                    var _waExtra = '';
                    if (idContrato != null && String(idContrato) !== '') {
                        _waExtra = ' data-wa-auto-contrato="1" data-primeiro-nome="' + esc(_pnSms) + '"';
                    }
                    html += '<button type="button" class="btn-ligar" title="Ligar" data-numero="' + esc(t.numero || '') + '"><i class="fa-solid fa-phone-volume"></i></button>' +
                        '<button type="button" class="btn-whatsapp" title="Enviar WhatsApp" data-numero="' + esc(t.numero || '') + '"' + _waExtra + '><i class="fa-brands fa-whatsapp"></i></button>';
                    var _smsA = ' data-pessoa-id="' + esc(_pId) + '"';
                    if (t.id != null && t.id !== '') { _smsA += ' data-telefone-id="' + esc(String(t.id)) + '"'; }
                    if (idContrato != null && String(idContrato) !== '') {
                        _smsA += ' data-contrato-id="' + esc(String(idContrato)) + '"';
                        _smsA += ' data-sms-auto-contrato="1"';
                        _smsA += ' data-primeiro-nome="' + esc(_pnSms) + '"';
                    }
                    html += '<button type="button" class="btn-mensagem" title="Enviar SMS" data-numero="' + esc(t.numero || '') + '"' + _smsA + '"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-meta">';
                    var _fonteTel = (typeof window.formatContatoFonteLabel === 'function') ? window.formatContatoFonteLabel(t.fonte) : '';
                    if (_fonteTel) html += '<span class="contact-fonte" title="Origem do cadastro">' + esc(_fonteTel) + '</span>';
                    html += '<span class="contact-tipo">' + esc(t.tipo) + '</span></span></li>';
                });
                html += '</ul>';
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;margin:0">Nenhum telefone cadastrado.</p>';
            }
            html += '</div><div><div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px"><h4 style="font-size:0.85rem;color:var(--text-muted);margin:0">E-mails</h4>';
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="action-btn btn-add-email-pessoa" data-pessoa-id="' + _pId + '" data-pessoa-nome="' + _pEnc + '" data-recurso="email"><i class="fa-solid fa-plus"></i> Email</button></div></div>';
            if (emails && emails.length) {
                html += '<ul class="contact-list">';
                emails.forEach(function (em) {
                    html += '<li><i class="fa-solid fa-envelope"></i> ' + esc(em.email || '-');
                    var _emC = ' data-email="' + esc(em.email || '') + '" data-pessoa-id="' + esc(_pId) + '"';
                    if (em.id != null && em.id !== '') { _emC += ' data-email-id="' + esc(String(em.id)) + '"'; }
                    if (idContrato != null && String(idContrato) !== '') {
                        _emC += ' data-contrato-id="' + esc(String(idContrato)) + '"';
                        _emC += ' data-email-auto-contrato="1"';
                        _emC += ' data-primeiro-nome="' + esc(_pnSms) + '"';
                    }
                    html += '<button type="button" class="btn-enviar-email-html" title="Enviar e-mail"' + _emC +
                        '><i class="fa-solid fa-envelope"></i></button>';
                    html += '<span class="contact-meta">';
                    var _fonteEm = (typeof window.formatContatoFonteLabel === 'function') ? window.formatContatoFonteLabel(em.fonte) : '';
                    if (_fonteEm) html += '<span class="contact-fonte" title="Origem do cadastro">' + esc(_fonteEm) + '</span>';
                    html += '<span class="contact-tipo">' + esc(em.tipo) + '</span></span></li>';
                });
                html += '</ul>';
            } else {
                html += '<p style="color:var(--text-muted);font-size:0.85rem;margin:0">Nenhum e-mail cadastrado.</p>';
            }
            html += '</div></div>';
        }
        html += '</div>';
        return html;
    }

    function renderContratoModal(data, modalTitle, modalContent, reloadFn) {
        var c = data.contrato;
        modalTitle.innerHTML = 'Detalhes do Contrato: <span class="text-accent">' + esc(c.grupo) + '/' + esc(c.cota) + '</span>';

        var html = '';
        html += '<div class="detail-section"><h3><i class="fa-solid fa-file-contract"></i> Dados do Contrato</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Grupo / Cota', c.grupo + '/' + c.cota);
        html += dataItem('Nro Contrato', c.numero_contrato);
        html += dataItem('Versão', c.versao);
        html += dataItem('Status', c.status || c.status_txt, true, c.status);
        html += dataItem('Valor do Crédito', formatCurrency(c.valor_credito));
        html += dataItem('Prazo (meses)', c.prazo_meses);
        html += dataItem('Data de Adesão', formatDate(c.data_adesao));
        html += dataItem('Encerramento Grupo', formatDate(c.encerramento_grupo));
        html += dataItem('Taxa Administração', typeof formatTaxaAdministracaoPercent === 'function'
            ? formatTaxaAdministracaoPercent(c.taxa_administracao)
            : c.taxa_administracao);
        html += dataItem('Fundo Reserva', c.fundo_reserva);
        html += dataItem('Percentual Lance', typeof formatTaxaAdministracaoPercent === 'function'
            ? formatTaxaAdministracaoPercent(c.percentual_lance)
            : c.percentual_lance);
        html += '</div>';
        html += '<div style="margin-top:14px"><button type="button" class="btn-search btn-pv-insert-from-contrato" style="max-width:380px" data-grupo="' + encodeURIComponent(String(c.grupo != null ? c.grupo : '')) + '" data-cota="' + encodeURIComponent(String(c.cota != null ? c.cota : '')) + '"><i class="fa-solid fa-folder-plus"></i> Registrar na Pasta Virtual</button></div>';
        html += '</div>';

        if (data.devedor) html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails, c.id);
        if (data.avalista) html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails, c.id);
        html += buildTramitacoesSectionHtml(data, c.id, { esc: esc, formatDateTime: formatDateTime });
        html += renderBemSection(data.bens);

        if (data.parcelas && data.parcelas.length > 0) {
            html += buildParcelasSectionHtml(data.parcelas);
        }

        if (data.ocorrencias && data.ocorrencias.length > 0) {
            html += buildOcorrenciasTimelineHtml(data.ocorrencias);
        }

        html += buildNegativacaoSectionHtml(data);

        modalContent.innerHTML = html;

        initParcelasFilter(modalContent);
        initTimelineMonthGroups(modalContent);

        if (typeof TramitacoesDetalhe !== 'undefined') {
            TramitacoesDetalhe.attachModal(modalContent, c.id, {
                esc: esc,
                formatDateTime: formatDateTime,
                onReload: function () { return reloadFn(c.id); }
            });
        }
    }

    function closeModal() {
        var detalhesModal = document.getElementById('detalhesModal');
        if (detalhesModal) {
            detalhesModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function bindModalUiOnce() {
        var modal = document.getElementById('detalhesModal');
        if (!modal || modal.dataset.contratoDetalhesBound) return;
        modal.dataset.contratoDetalhesBound = '1';
        var closeBtn = document.getElementById('closeModalBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeModal();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
        });
    }

    async function open(contratoId) {
        bindModalUiOnce();
        var detalhesModal = document.getElementById('detalhesModal');
        var modalTitle = document.getElementById('modalTitle');
        var modalContent = document.getElementById('modalContent');
        if (!detalhesModal || !modalTitle || !modalContent) {
            console.warn('[ContratoDetalhesModal] Elementos #detalhesModal / #modalTitle / #modalContent não encontrados.');
            return;
        }

        modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';
        modalTitle.textContent = 'Carregando...';
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        window.__refreshContatoSrc = function () { return open(contratoId); };

        async function reloadFn(id) {
            return open(id);
        }

        try {
            var resp = await fetch('/api/contrato/' + encodeURIComponent(contratoId));
            var d = await resp.json();
            if (d.error) {
                modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">' + esc(d.error) + '</p>';
                return;
            }
            renderContratoModal(d, modalTitle, modalContent, reloadFn);
        } catch (err) {
            modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">Erro: ' + esc(err.message) + '</p>';
        }
    }

    global.ContratoDetalhesModal = {
        open: open,
        close: closeModal,
        renderPessoaSection: renderPessoaSection,
        buildOcorrenciasTimelineHtml: buildOcorrenciasTimelineHtml,
        buildNegativacaoSectionHtml: buildNegativacaoSectionHtml,
        buildParcelasSectionHtml: buildParcelasSectionHtml,
        initParcelasFilter: initParcelasFilter,
        initTimelineMonthGroups: initTimelineMonthGroups,
        buildTramitacoesSectionHtml: buildTramitacoesSectionHtml,
    };

    document.addEventListener('DOMContentLoaded', bindModalUiOnce);
})(window);
