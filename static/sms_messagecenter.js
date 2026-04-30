/**
 * SMS MessageCenter: clique em .btn-mensagem com data-numero (telefone).
 * Envio via POST /api/enviar-sms (proxy Flask). Constantes espelhadas do app.py.
 */
(function () {
    'use strict';

    /* Mesmos valores que em app.py (visiveis no codigo-fonte do cliente). */
    var SMS_MC_URL = 'https://sistema.messagecenter.com.br/api/Integracao/enviarsms';
    var SMS_MC_HEADER_NAME = 'apikey';
    var SMS_MC_HEADER_VALUE = 'MC.cC719ae5-22B3-439b-9D63-4D544f79Fffc-788B1CE2-9af2-417F-85Ba-67d3E16a7243';

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-mensagem');
        if (!btn) {
            return;
        }
        var numero = (btn.getAttribute('data-numero') || '').trim();
        if (!numero) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        var mensagem = window.prompt('Mensagem SMS para ' + numero + ':', '');
        if (mensagem === null) {
            return;
        }
        mensagem = String(mensagem).trim();
        if (!mensagem) {
            window.alert('Mensagem vazia.');
            return;
        }
        if (!window.confirm('Enviar SMS para ' + numero + '?')) {
            return;
        }
        var prev = btn.disabled;
        btn.disabled = true;
        window.fetch('/api/enviar-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: numero, mensagem: mensagem }),
        })
            .then(function (r) {
                return r.text().then(function (text) {
                    var d;
                    try {
                        d = text ? JSON.parse(text) : {};
                    } catch (ignore) {
                        d = {
                            error: 'Resposta invalida (HTTP ' + r.status + '). ' +
                                (text ? String(text).slice(0, 200) : '(vazio)'),
                        };
                    }
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
                window.alert('SMS enviado para ' + numero + '.');
            })
            .catch(function (err) {
                window.alert('Erro: ' + (err && err.message ? err.message : String(err)));
            })
            .finally(function () {
                btn.disabled = prev;
            });
    });
})();
