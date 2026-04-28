/**
 * Lista de contratos alinhada ao painel (Dashboard / Performance) + busca estilo mùdulo Busca.
 * Requer: busca.css, tabela .styled-table, funùùo onDetalhe(id) no parent (ex.: openDetails do dashboard).
 */
(function () {
    'use strict';

    function esc(val) {
        if (val === null || val === undefined) return '-';
        var d = document.createElement('div');
        d.textContent = String(val);
        return d.innerHTML;
    }

    function getStatusClass(status) {
        if (!status) return '';
        var s = String(status).toLowerCase();
        if (s === 'aberto' || s === 'em cobranca' || s === 'em cobranùa') return 'status-active';
        if (s === 'fechado' || s === 'pago') return 'status-success';
        if (s === 'indenizado') return 'status-warning';
        return 'status-active';
    }

    function init(config) {
        var endpoint = config.endpoint;
        var getBaseQuery = config.getBaseQuery; // function -> URLSearchParams or object
        var onDetalhe = config.onDetalhe; // function(id)
        var mode = config.mode || 'dashboard';
        var colspan = mode === 'performance' ? 8 : 5;

        var form = document.getElementById('painelBuscaForm');
        var tipoEl = document.getElementById('painelTipoBusca');
        var termoEl = document.getElementById('painelTermo');
        var statusEl = document.getElementById('painelStatusFiltro');
        var tbody = document.getElementById('painelContratosBody');
        var titleEl = document.getElementById('painelContratosTitle');
        var limEl = document.getElementById('painelContratosLimitado');
        var noEl = document.getElementById('painelContratosVazio');
        if (!form || !tbody) return;

        var deb;
        function buildParams() {
            var q = (typeof getBaseQuery === 'function') ? getBaseQuery() : {};
            if (q instanceof URLSearchParams) {
                if (tipoEl && tipoEl.value) q.set('tipo', tipoEl.value);
                if (termoEl) q.set('termo', (termoEl.value || '').trim());
                if (statusEl && statusEl.value) q.set('status', statusEl.value);
                return q;
            }
            var o = q && typeof q === 'object' ? Object.assign({}, q) : {};
            if (tipoEl) o.tipo = tipoEl.value;
            if (termoEl) o.termo = (termoEl.value || '').trim();
            if (statusEl) o.status = statusEl.value || '';
            return o;
        }

        function toQueryString(obj) {
            if (obj instanceof URLSearchParams) return obj.toString();
            var p = new URLSearchParams();
            Object.keys(obj).forEach(function (k) {
                var v = obj[k];
                if (v === null || v === undefined || v === '') return;
                if (Array.isArray(v)) v.forEach(function (x) { p.append(k, x); });
                else p.set(k, v);
            });
            return p.toString();
        }

        function renderRows(rows) {
            tbody.innerHTML = '';
            if (!rows || !rows.length) {
                if (noEl) noEl.classList.remove('d-none');
                return;
            }
            if (noEl) noEl.classList.add('d-none');
            rows.forEach(function (c) {
                var tr = document.createElement('tr');
                var extra = '';
                if (mode === 'performance') {
                    extra =
                        '<td>' +
                        esc(c.faixa_calendario || '-') +
                        '</td><td><span class="status-badge ' +
                        (c.desempenho && String(c.desempenho).indexOf('Nùo') >= 0 ? 'status-warning' : 'status-success') +
                        '">' +
                        esc(c.desempenho || '-') +
                        '</span></td><td class="text-muted" style="font-size:0.8rem">' +
                        esc(c.prazo_atraso || '-') +
                        '</td>';
                }
                tr.innerHTML =
                    '<td class="fw-bold">' +
                    esc(c.grupo) +
                    '/' +
                    esc(c.cota) +
                    '</td>' +
                    '<td>' +
                    esc(c.numero_contrato) +
                    '</td>' +
                    '<td>' +
                    esc(c.devedor || c.nome_devedor || '-') +
                    '</td>' +
                    '<td><span class="status-badge ' +
                    getStatusClass(c.status) +
                    '">' +
                    esc(c.status) +
                    '</span></td>' +
                    extra +
                    '<td class="text-right"><button type="button" class="action-btn painel-detalhe-btn" data-id="' +
                    c.id +
                    '"><i class="fa-solid fa-file-lines"></i> Detalhes</button></td>';
                tbody.appendChild(tr);
            });
            tbody.querySelectorAll('.painel-detalhe-btn').forEach(function (b) {
                b.addEventListener('click', function () {
                    var id = this.getAttribute('data-id');
                    if (onDetalhe) onDetalhe(id);
                });
            });
        }

        async function load() {
            var qs = buildParams();
            var str = toQueryString(qs);
            if (titleEl) titleEl.textContent = 'Carregando...';
            tbody.innerHTML =
                '<tr><td colspan="' + colspan + '" style="text-align:center;padding:20px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';
            if (noEl) noEl.classList.add('d-none');
            if (limEl) {
                limEl.textContent = '';
                limEl.style.display = 'none';
            }
            try {
                var url = endpoint + (str ? '?' + str : '');
                var resp = await fetch(url);
                var data = await resp.json();
                if (data.error) {
                    tbody.innerHTML =
                        '<tr><td colspan="' + colspan + '" style="text-align:center;color:#ef4444;padding:16px">' + esc(data.error) + '</td></tr>';
                    if (titleEl) titleEl.textContent = 'Contratos do painel';
                    return;
                }
                var n = (data.total != null ? data.total : (data.results || []).length) || 0;
                var lim = data.limit || 500;
                if (titleEl) {
                    var base =
                        'Contratos (painel' +
                        (mode === 'performance' ? ' ? Performance' : ' ? Dashboard') +
                        '): ';
                    if (data.limited && n > lim) {
                        titleEl.textContent =
                            base +
                            n.toLocaleString('pt-BR') +
                            ' no total (mostrando ' +
                            lim.toLocaleString('pt-BR') +
                            ' na tabela)';
                    } else {
                        titleEl.textContent =
                            base + n.toLocaleString('pt-BR') + ' exibido(s)';
                    }
                }
                if (limEl) {
                    if (data.limited) {
                        limEl.style.display = 'block';
                        limEl.textContent =
                            'Listagem limitada a ' + (data.limit || 500) + ' contratos. Refine a busca ou use export para lista completa.';
                    } else {
                        limEl.style.display = 'none';
                    }
                }
                renderRows(data.results || []);
            } catch (e) {
                tbody.innerHTML =
                    '<tr><td colspan="' + colspan + '" style="text-align:center;color:#ef4444;padding:16px">Erro: ' + esc(e.message) + '</td></tr>';
            }
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            load();
        });

        if (tipoEl) {
            tipoEl.addEventListener('change', function () {
                if (this.value === 'pessoa' && termoEl) {
                    termoEl.placeholder = 'Nome ou CPF/CNPJ do devedor ou avalista...';
                } else if (this.value === 'bem' && termoEl) {
                    termoEl.placeholder = 'Descriùùo do bem...';
                } else if (termoEl) {
                    termoEl.placeholder = 'Grupo/cota (ex: 001234/0012)...';
                }
            });
        }

        if (termoEl) {
            termoEl.addEventListener('input', function () {
                clearTimeout(deb);
                deb = setTimeout(load, 500);
            });
        }
        if (statusEl) {
            statusEl.addEventListener('change', function () { load(); });
        }

        window[config.hookName || 'painelListaRefresh'] = load;
        load();
    }

    window.PainelListaContratos = { init: init, esc: esc, getStatusClass: getStatusClass };
})();
