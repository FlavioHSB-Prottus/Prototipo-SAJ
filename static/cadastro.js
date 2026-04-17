document.addEventListener('DOMContentLoaded', () => {
    
    // Seleciona todos os botões que ativam os detalhes
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Pega o ID da row alvo mapeada no data-target do botão
            const targetId = this.getAttribute('data-target');
            const targetRow = document.getElementById(targetId);
            const icon = this.querySelector('.toggle-icon');

            // Verifica se está fechada e atua
            if (targetRow.classList.contains('expanded')) {
                // Se sim, esconde = Recolher
                targetRow.classList.remove('expanded');
                
                // Transforma setinha pra baixo
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            } else {
                // Se não, mostra = Expandir
                targetRow.classList.add('expanded');
                
                // Transforma setinha pra cima
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        });
    });

});
