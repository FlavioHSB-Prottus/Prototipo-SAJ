document.addEventListener('DOMContentLoaded', function() {
    
    const detalhesModal = document.getElementById('detalhesModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    // Pega todos os botões que têm o texto "Detalhes" ou a classe action-btn
    const detailButtons = document.querySelectorAll('.action-btn');

    // Função para abrir o modal
    function openModal() {
        if(detalhesModal) {
            detalhesModal.classList.add('active');
            document.body.style.overflow = 'hidden'; // Evita scroll do fundo
        }
    }

    // Função para fechar o modal
    function closeModal() {
        if(detalhesModal) {
            detalhesModal.classList.remove('active');
            document.body.style.overflow = ''; // Restaura scroll
        }
    }

    // Adiciona evento de clique a todas as linhas da tabela no botão "Detalhes"
    detailButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Em um sistema real, faríamos um fetch() com o ID do contrato aqui
            openModal();
        });
    });

    // Fechar ao clicar no "X"
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }

    // Fechar ao clicar no fundo escuro fora do modal
    if(detalhesModal) {
        detalhesModal.addEventListener('click', function(e) {
            if(e.target === detalhesModal) {
                closeModal();
            }
        });
    }

    // Fechar ao apertar ESC
    document.addEventListener('keydown', function(e) {
        if(e.key === 'Escape' && detalhesModal.classList.contains('active')) {
            closeModal();
        }
    });

});
