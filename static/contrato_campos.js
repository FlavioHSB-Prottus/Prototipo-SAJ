/**
 * Formatacao compartilhada de campos do contrato nos modais de detalhe.
 * taxa_administracao e percentual_lance no GM costumam vir em centesimos de percentual
 * (ex.: 1100 -> 11,00%; 4500 -> 45,00%). Valores ja na escala 0-100 sao percentual direto.
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

    /**
     * Rótulo para coluna `fonte` em telefone/email (importação TXT GM, enriquecimento, etc.).
     */
    function formatContatoFonteLabel(fonte) {
        if (fonte === null || fonte === undefined || fonte === '') return '';
        var k = String(fonte).trim().toLowerCase();
        var map = {
            gmac: 'Importação GM (TXT)',
            enriquecimento: 'Enriquecimento / pós-índice',
            terceiro: 'Terceiro',
            manual: 'Cadastro manual'
        };
        return map[k] || String(fonte);
    }

    global.formatContatoFonteLabel = formatContatoFonteLabel;
})(typeof window !== 'undefined' ? window : this);
