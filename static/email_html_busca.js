/**
 * Busca: envio de e-mail HTML via MessageCenter (proxy POST /api/enviar-email-html).
 * Botões .btn-enviar-email-html com data-email, data-pessoa-id, data-email-id e opcional data-contrato-id.
 */
(function () {
    'use strict';

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-enviar-email-html');
        if (!btn) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        var email = (btn.getAttribute('data-email') || '').trim();
        var idPessoa = (btn.getAttribute('data-pessoa-id') || '').trim();
        var idEmail = (btn.getAttribute('data-email-id') || '').trim();
        var idContrato = (btn.getAttribute('data-contrato-id') || '').trim();
        if (!email || !idPessoa || !idEmail) {
            window.alert('Dados do e-mail incompletos.');
            return;
        }
        var texto = window.prompt('Mensagem do e-mail (texto simples) para ' + email + ':', '');
        if (texto === null) {
            return;
        }
        texto = String(texto).trim();
        if (!texto) {
            window.alert('Mensagem vazia.');
            return;
        }
        var corpoHtml = '<p>' + escapeHtml(texto).replace(/\r\n|\r|\n/g, '<br>') + '</p>';
        if (!window.confirm('Enviar e-mail para ' + email + '?')) {
            return;
        }
        var prev = btn.disabled;
        btn.disabled = true;
        var body = {
            email: email,
            corpo_html: corpoHtml,
            id_pessoa: parseInt(idPessoa, 10),
            id_email: parseInt(idEmail, 10),
        };
        if (idContrato) {
            body.id_contrato = parseInt(idContrato, 10);
        }
        window.fetch('/api/enviar-email-html', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
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
                window.alert('E-mail enviado para ' + email + '.');
            })
            .catch(function (err) {
                window.alert('Erro: ' + (err && err.message ? err.message : String(err)));
            })
            .finally(function () {
                btn.disabled = prev;
            });
    });
})();
