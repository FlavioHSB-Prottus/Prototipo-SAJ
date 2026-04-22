document.addEventListener('DOMContentLoaded', function() {
    
    // Atualização de Data e Hora no Header
    const timeDisplay = document.getElementById('currentTime');
    const dateDisplay = document.getElementById('currentDate');

    function updateClock() {
        if (!timeDisplay || !dateDisplay) return;

        const now = new Date();
        
        // Formatar Hora (HH:MM:SS)
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        timeDisplay.textContent = `${hours}:${minutes}:${seconds}`;

        // Formatar Data (DD/MM/YYYY)
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        dateDisplay.textContent = `${day}/${month}/${year}`;
    }

    // Iniciar o relógio e atualizar a cada segundo
    updateClock();
    setInterval(updateClock, 1000);

    // Lógica do Dropdown de Perfil
    const profileBtn = document.getElementById('userProfileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Evita que o click feche imediatamente
            
            // Fecha notificação se estiver aberta
            if(notificationDropdown) notificationDropdown.classList.remove('show');

            this.classList.toggle('active');
            profileDropdown.classList.toggle('show');
        });

        // Fechar dropdown se clicar fora dele
        document.addEventListener('click', function(e) {
            if (!profileBtn.contains(e.target)) {
                profileBtn.classList.remove('active');
                profileDropdown.classList.remove('show');
            }
        });
    }

    // Lógica do Sino de Notificações
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBadge = document.getElementById('notificationBadge');

    if (notificationBtn && notificationDropdown) {
        notificationBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Fecha perfil se estiver aberto
            if(profileDropdown) {
                profileDropdown.classList.remove('show');
                if(profileBtn) profileBtn.classList.remove('active');
            }

            notificationDropdown.classList.toggle('show');
            
            // Fazer a bolinha do badge sumir na hora que visualiza
            if (notificationBadge) {
                notificationBadge.style.opacity = '0';
                setTimeout(() => notificationBadge.style.display = 'none', 300);
            }
        });

        document.addEventListener('click', function(e) {
            if (!notificationBtn.contains(e.target)) {
                notificationDropdown.classList.remove('show');
            }
        });
    }

    // Toggle Sidebar (Retrair/Expandir)
    const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
    const sidebarArea = document.getElementById('sidebarArea');

    if (toggleSidebarBtn && sidebarArea) {
        toggleSidebarBtn.addEventListener('click', function() {
            sidebarArea.classList.toggle('collapsed');
        });
    }

    // Seletor de Empresa (cliente atendido)
    const departamentoSelector = document.getElementById('departamentoSelector');
    const departamentoDropdown = document.getElementById('departamentoDropdown');
    const departamentoAtual = document.getElementById('departamentoAtual');

    if (departamentoSelector && departamentoDropdown) {
        const savedDep = localStorage.getItem('departamento_atual') || 'GM';
        if (departamentoAtual) departamentoAtual.textContent = savedDep;
        departamentoDropdown.querySelectorAll('.dep-item').forEach(function (el) {
            el.classList.toggle('active', el.getAttribute('data-dep') === savedDep);
        });

        departamentoSelector.addEventListener('click', function (e) {
            e.stopPropagation();
            if (profileDropdown) {
                profileDropdown.classList.remove('show');
                if (profileBtn) profileBtn.classList.remove('active');
            }
            if (notificationDropdown) notificationDropdown.classList.remove('show');

            departamentoSelector.classList.toggle('active');
            departamentoDropdown.classList.toggle('show');
        });

        departamentoDropdown.querySelectorAll('.dep-item').forEach(function (el) {
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                if (el.classList.contains('disabled')) return;
                const dep = el.getAttribute('data-dep');
                if (!dep) return;

                localStorage.setItem('departamento_atual', dep);
                if (departamentoAtual) departamentoAtual.textContent = dep;

                departamentoDropdown.querySelectorAll('.dep-item').forEach(function (i) {
                    i.classList.toggle('active', i.getAttribute('data-dep') === dep);
                });

                departamentoSelector.classList.remove('active');
                departamentoDropdown.classList.remove('show');

                document.dispatchEvent(new CustomEvent('departamentoChange', { detail: { departamento: dep } }));
            });
        });

        document.addEventListener('click', function (e) {
            if (!departamentoSelector.contains(e.target)) {
                departamentoSelector.classList.remove('active');
                departamentoDropdown.classList.remove('show');
            }
        });
    }

    // Configurações: card para enviar foto de perfil
    const openConfigFotoBtn = document.getElementById('openConfigFotoBtn');
    const configFotoOverlay = document.getElementById('configFotoOverlay');
    const configFotoCard = document.getElementById('configFotoCard');
    const configFotoCloseBtn = document.getElementById('configFotoCloseBtn');
    const configFotoInput = document.getElementById('configFotoInput');
    const configFotoSubmitBtn = document.getElementById('configFotoSubmitBtn');
    const configFotoMsg = document.getElementById('configFotoMsg');

    function closeConfigFoto() {
        if (!configFotoOverlay) return;
        configFotoOverlay.classList.remove('show');
        configFotoOverlay.setAttribute('aria-hidden', 'true');
        if (configFotoMsg) {
            configFotoMsg.textContent = '';
            configFotoMsg.hidden = true;
        }
    }

    function openConfigFoto() {
        if (!configFotoOverlay) return;
        if (profileDropdown) profileDropdown.classList.remove('show');
        if (profileBtn) profileBtn.classList.remove('active');
        configFotoOverlay.classList.add('show');
        configFotoOverlay.setAttribute('aria-hidden', 'false');
        if (configFotoMsg) {
            configFotoMsg.textContent = '';
            configFotoMsg.hidden = true;
        }
    }

    if (openConfigFotoBtn && configFotoOverlay) {
        openConfigFotoBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            openConfigFoto();
        }, true);
    }

    if (configFotoCard) {
        configFotoCard.addEventListener('click', function (e) {
            e.stopPropagation();
        });
    }

    if (configFotoOverlay) {
        configFotoOverlay.addEventListener('click', function (e) {
            if (e.target === configFotoOverlay) closeConfigFoto();
        });
    }

    if (configFotoCloseBtn) {
        configFotoCloseBtn.addEventListener('click', function () {
            closeConfigFoto();
        });
    }

    if (configFotoSubmitBtn && configFotoOverlay && configFotoInput) {
        configFotoSubmitBtn.addEventListener('click', function () {
            const url = configFotoOverlay.getAttribute('data-minha-foto-url');
            if (!url) return;
            const file = configFotoInput.files && configFotoInput.files[0];
            if (!file) {
                if (configFotoMsg) {
                    configFotoMsg.textContent = 'Selecione uma imagem.';
                    configFotoMsg.hidden = false;
                }
                return;
            }
            const formData = new FormData();
            formData.append('foto', file);
            configFotoSubmitBtn.disabled = true;
            fetch(url, { method: 'POST', body: formData, credentials: 'include' })
                .then(function (r) {
                    return r.text().then(function (t) {
                        var j = {};
                        try {
                            j = t ? JSON.parse(t) : {};
                        } catch (ignore) {
                            j = {};
                        }
                        return { ok: r.ok, body: j };
                    });
                })
                .then(function (res) {
                    if (res.ok && res.body && res.body.ok) {
                        const img = document.querySelector('.header-avatar-img');
                        if (img) img.src = url + '?t=' + Date.now();
                        closeConfigFoto();
                        configFotoInput.value = '';
                    } else if (configFotoMsg) {
                        configFotoMsg.textContent = (res.body && res.body.error) || 'Erro ao enviar.';
                        configFotoMsg.hidden = false;
                    }
                })
                .catch(function () {
                    if (configFotoMsg) {
                        configFotoMsg.textContent = 'Erro de rede.';
                        configFotoMsg.hidden = false;
                    }
                })
                .finally(function () {
                    configFotoSubmitBtn.disabled = false;
                });
        });
    }
});
