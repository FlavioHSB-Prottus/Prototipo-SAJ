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
});
