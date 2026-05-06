/**
 * Clique no icone "WhatsApp" (botao .btn-whatsapp) ao lado de telefones nos modais de detalhe.
 * Usa data-numero no botao; chama POST /api/enviar-whatsapp (proxy no Flask).
 */
(function () {
    'use strict';

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-whatsapp');
        if (!btn) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        var numero = (btn.getAttribute('data-numero') || '').trim();
        if (!numero) {
            var li = btn.closest('li');
            if (li) {
                numero = (li.getAttribute('data-numero') || '').trim();
            }
        }
        if (!numero) {
            window.alert('Numero nao identificado.');
            return;
        }
        var mensagem = window.prompt('Mensagem WhatsApp para ' + numero + ':', '');
        if (mensagem === null) {
            return;
        }
        mensagem = String(mensagem).trim();
        if (!mensagem) {
            window.alert('Mensagem vazia.');
            return;
        }
        if (!window.confirm('Enviar WhatsApp para ' + numero + '?')) {
            return;
        }
        var prev = btn.disabled;
        btn.disabled = true;
        window.fetch('/api/enviar-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: numero, mensagem: mensagem }),
        })
            .then(function (r) {
                return r.json().then(function (d) {
                    return { ok: r.ok, d: d };
                });
            })
            .then(function (res) {
                if (res.d.error) {
                    window.alert('Falha: ' + res.d.error);
                    return;
                }
                if (!res.ok) {
                    window.alert('Falha: ' + (res.d.error || 'erro desconhecido'));
                    return;
                }
                window.alert('WhatsApp enfileirado para ' + numero + '.');
            })
            .catch(function (err) {
                window.alert('Erro: ' + (err && err.message ? err.message : String(err)));
            })
            .finally(function () {
                btn.disabled = prev;
            });
    });
})();
