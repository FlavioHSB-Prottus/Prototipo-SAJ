/**
 * Formatacao compartilhada de campos do contrato nos modais de detalhe.
 * taxa_administracao no GM vem em centesimos de percentual (ex.: 1700 -> 17,00%).
 * Valores ja na escala 0-100 sao tratados como percentual direto.
 */
(function (global) {
    'use strict';

    function formatTaxaAdministracaoPercent(val) {
        if (val === null || val === undefined || val === '') return '-';
        var n = parseFloat(String(val).replace(/\s/g, '').replace(',', '.'));
        if (!isFinite(n)) return String(val);
        var pct = Math.abs(n) > 100 ? n / 100 : n;
        return pct.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
    }

    global.formatTaxaAdministracaoPercent = formatTaxaAdministracaoPercent;
})(typeof window !== 'undefined' ? window : this);
