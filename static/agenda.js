document.addEventListener('DOMContentLoaded', () => {
    const calendarGrid = document.getElementById('calendarGrid');
    const tasksList = document.getElementById('tasksList');
    const monthTitle = document.querySelector('.month-title');
    const btnPrev = document.querySelector('.nav-btn:first-child');
    const btnNext = document.querySelector('.nav-btn:last-child');
    const btnNewTask = document.querySelector('.btn-new-task');

    // Modais
    const agendaModal = document.getElementById('agendaModal');
    const closeAgendaModal = document.getElementById('closeAgendaModal');
    const btnSaveAgenda = document.getElementById('btnSaveAgenda');
    
    // Select Funcionario
    const selectFuncionario = document.getElementById('agendaFuncionario');

    let currentDate = new Date();
    let currentSelectDate = new Date();
    let agendaTasks = [];

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    function init() {
        loadFuncionarios();
        renderCalendar();
        setupEvents();
    }

    async function loadFuncionarios() {
        try {
            const res = await fetch('/api/funcionarios');
            const data = await res.json();
            selectFuncionario.innerHTML = '';
            data.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.nome;
                selectFuncionario.appendChild(opt);
            });
        } catch(e) {
            console.error('Erro ao carregar funcionarios', e);
        }
    }

    async function fetchTasks() {
        try {
            const m = currentDate.getMonth() + 1;
            const y = currentDate.getFullYear();
            const res = await fetch(`/api/agenda?month=${m}&year=${y}`);
            agendaTasks = await res.json();
        } catch(e) {
            console.error('Erro ao carregar agenda', e);
            agendaTasks = [];
        }
    }

    async function renderCalendar() {
        await fetchTasks();
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        monthTitle.textContent = `${monthNames[month]} ${year}`;

        calendarGrid.innerHTML = '';

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        // Empty days before 1st
        for (let i = 0; i < firstDayOfMonth; i++) {
            const div = document.createElement('div');
            div.className = 'calendar-day empty';
            calendarGrid.appendChild(div);
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const tasksForDay = agendaTasks.filter(t => t.data && t.data.startsWith(dateStr));
            
            const div = document.createElement('div');
            div.className = 'calendar-day';
            div.innerHTML = `${day}`;
            
            const today = new Date();
            if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                div.classList.add('today');
            }
            if (day === currentSelectDate.getDate() && month === currentSelectDate.getMonth() && year === currentSelectDate.getFullYear()) {
                div.style.border = '2px solid #3b82f6';
            }

            if (tasksForDay.length > 0) {
                const dotsDiv = document.createElement('div');
                dotsDiv.className = 'event-dots';
                tasksForDay.slice(0, 3).forEach(t => {
                    const dot = document.createElement('span');
                    let color = 'white';
                    if(!div.classList.contains('today')) {
                        if (t.prioridade === 'alta') color = 'red';
                        else if (t.prioridade === 'media') color = 'yellow';
                        else color = 'blue';
                    }
                    dot.className = `dot ${color}`;
                    dotsDiv.appendChild(dot);
                });
                div.appendChild(dotsDiv);
            }

            div.onclick = () => {
                currentSelectDate = new Date(year, month, day);
                renderCalendar(); // re-render to update selection style
                renderTasksForDay(dateStr);
                openModal(currentSelectDate);
            };

            calendarGrid.appendChild(div);
        }

        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(currentSelectDate.getDate()).padStart(2,'0')}`;
        renderTasksForDay(dateStr);
    }

    function renderTasksForDay(dateStr) {
        // Formatar para titulo
        const [y, m, d] = dateStr.split('-');
        document.querySelector('.tasks-header h3').innerHTML = `<i class="fa-solid fa-list-check"></i> Tarefas (${d}/${m}/${y})`;

        const tasksForDay = agendaTasks.filter(t => t.data && t.data.startsWith(dateStr));
        tasksList.innerHTML = '';

        if(tasksForDay.length === 0) {
            tasksList.innerHTML = '<div style="padding: 24px; color: #64748b; text-align: center;">Nenhuma tarefa para este dia.</div>';
            return;
        }

        tasksForDay.forEach(task => {
            const time = task.data ? task.data.substring(11, 16) : '--:--';
            const isCompleted = task.status === 'concluido';
            
            let badgeClass = 'p-media';
            if (task.prioridade === 'alta') badgeClass = 'p-alta';
            else if (task.prioridade === 'baixa') badgeClass = 'p-baixa'; // requires css update or just 'p-media'

            let prioridadeLabel = task.prioridade.charAt(0).toUpperCase() + task.prioridade.slice(1);
            if(task.prioridade === 'alta') prioridadeLabel = 'Prioridade Alta';

            const item = document.createElement('div');
            item.className = 'task-item';
            
            const btnContrato = task.id_contrato ? 
                `<button class="btn-acessar" onclick="window.openContratoModal(${task.id_contrato})"><i class="fa-solid fa-arrow-up-right-from-square"></i> Contrato ${escapeHtml(task.grupo || '')}/${escapeHtml(task.cota || '')}</button>` 
                : '';

            item.innerHTML = `
                <div class="task-left">
                    <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} onchange="toggleTaskStatus(${task.id}, this.checked)">
                    <span class="task-time ${isCompleted ? 'completed-text' : ''}"><i class="fa-regular fa-clock"></i> ${time}</span>
                    <div class="task-info">
                        <strong>${escapeHtml(task.atividade)}</strong>
                        <p class="task-desc ${isCompleted ? 'completed-text' : ''}">${escapeHtml(task.descricao || '')}</p>
                        <small style="color:#64748b; font-size: 0.75rem;"><i class="fa-solid fa-user"></i> ${escapeHtml(task.funcionario_nome || 'N/A')}</small>
                    </div>
                </div>
                <div class="task-right">
                    <span class="priority-badge ${badgeClass}">${prioridadeLabel}</span>
                    ${isCompleted ? '<button class="btn-acessar disabled" disabled><i class="fa-solid fa-check"></i> Concluído</button>' : btnContrato}
                </div>
            `;
            tasksList.appendChild(item);
        });
    }

    window.toggleTaskStatus = async function(id, isChecked) {
        const newStatus = isChecked ? 'concluido' : 'pendente';
        try {
            await fetch(`/api/agenda/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            await renderCalendar(); // reload state
        } catch(e) {
            console.error('Erro ao atualizar status', e);
        }
    };

    function setupEvents() {
        btnPrev.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            currentSelectDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            renderCalendar();
        });

        btnNext.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentSelectDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            renderCalendar();
        });

        btnNewTask.addEventListener('click', () => openModal(currentSelectDate));

        closeAgendaModal.addEventListener('click', () => {
            agendaModal.classList.remove('active');
        });

        btnSaveAgenda.addEventListener('click', saveAgenda);
    }

    function openModal(dateObj) {
        document.getElementById('agendaAtividade').value = '';
        document.getElementById('agendaDescricao').value = '';
        document.getElementById('agendaContrato').value = '';
        
        let d = dateObj || new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        // Default time to next hour
        const nextHour = String(new Date().getHours() + 1).padStart(2, '0');
        document.getElementById('agendaData').value = `${year}-${month}-${day}T${nextHour}:00`;

        agendaModal.classList.add('active');
    }

    async function saveAgenda() {
        const payload = {
            atividade: document.getElementById('agendaAtividade').value,
            descricao: document.getElementById('agendaDescricao').value,
            data: document.getElementById('agendaData').value,
            prioridade: document.getElementById('agendaPrioridade').value,
            id_funcionario: document.getElementById('agendaFuncionario').value,
            grupo_cota: document.getElementById('agendaContrato').value
        };

        if(!payload.atividade || !payload.data || !payload.id_funcionario) {
            alert('Preencha os campos obrigatórios: Atividade, Data e Funcionário.');
            return;
        }

        try {
            const res = await fetch('/api/agenda', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                agendaModal.classList.remove('active');
                renderCalendar();
            } else {
                const err = await res.json();
                alert('Erro ao salvar: ' + (err.error || 'Desconhecido'));
            }
        } catch(e) {
            console.error('Erro', e);
            alert('Erro de conexão ao salvar.');
        }
    }

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ==========================================
    // INÍCIO - FUNÇÕES GLOBAIS DE CONTRATO
    // ==========================================
    const detalhesModal = document.getElementById('detalhesModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    let _fromPessoa = false;

    window.openContratoModal = async function(cid) {
        if (!cid) return;
        _fromPessoa = false;
        modalContent.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem"></i><p style="margin-top:12px">Carregando detalhes...</p></div>';
        modalTitle.textContent = 'Carregando...';
        detalhesModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            const resp = await fetch('/api/contrato/' + cid);
            const d = await resp.json();
            if (d.error) {
                modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">' + escapeHtml(d.error) + '</p>';
                return;
            }
            renderContratoModal(d);
        } catch (err) {
            modalContent.innerHTML = '<p style="padding:24px;color:#ef4444">Erro: ' + escapeHtml(err.message) + '</p>';
        }
    };

    function renderContratoModal(data) {
        const c = data.contrato;
        modalTitle.innerHTML = 'Detalhes do Contrato: <span class="text-accent">' + escapeHtml(c.grupo) + '/' + escapeHtml(c.cota) + '</span>';

        let html = '';

        if (_fromPessoa) {
            html += '<div class="modal-nav-back"><button type="button" class="btn-voltar-pessoa"><i class="fa-solid fa-arrow-left"></i> Voltar para pessoa</button></div>';
        }

        // Dados do contrato
        html += '<div class="detail-section"><h3><i class="fa-solid fa-file-contract"></i> Dados do Contrato</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Grupo / Cota', c.grupo + '/' + c.cota);
        html += dataItem('Nro Contrato', c.numero_contrato);
        html += dataItem('Versao', c.versao);
        html += dataItem('Status', c.status || c.status_txt, true, c.status);
        html += dataItem('Valor do Credito', formatCurrency(c.valor_credito));
        html += dataItem('Prazo (meses)', c.prazo_meses);
        html += dataItem('Data de Adesao', formatDate(c.data_adesao));
        html += dataItem('Encerramento Grupo', formatDate(c.encerramento_grupo));
        html += dataItem('Taxa Administracao', c.taxa_administracao);
        html += dataItem('Fundo Reserva', c.fundo_reserva);
        html += dataItem('Percentual Lance', c.percentual_lance);
        html += '</div></div>';

        // Devedor
        if (data.devedor) {
            html += renderPessoaSection('Devedor', data.devedor, data.devedor_enderecos, data.devedor_telefones, data.devedor_emails);
        }

        // Avalista
        if (data.avalista) {
            html += renderPessoaSection('Avalista', data.avalista, data.avalista_enderecos, data.avalista_telefones, data.avalista_emails);
        }

        // Bem
        html += renderBemSection(data.bens);

        // Parcelas
        if (data.parcelas && data.parcelas.length > 0) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-list-ol"></i> Parcelas (' + data.parcelas.length + ')</h3>';
            html += '<div class="table-responsive"><table class="styled-table modal-table"><thead><tr>';
            html += '<th>Nro</th><th>Vencimento</th><th>Valor Nominal</th><th>Multa/Juros</th><th>Valor Total</th><th>Status</th>';
            html += '</tr></thead><tbody>';
            data.parcelas.forEach(function (p) {
                html += '<tr>';
                html += '<td>' + escapeHtml(p.numero_parcela) + '</td>';
                html += '<td>' + formatDate(p.vencimento) + '</td>';
                html += '<td>' + formatCurrency(p.valor_nominal) + '</td>';
                html += '<td>' + formatCurrency(p.multa_juros) + '</td>';
                html += '<td class="fw-bold">' + formatCurrency(p.valor_total) + '</td>';
                html += '<td><span class="status-badge ' + getStatusClass(p.status) + '">' + escapeHtml(p.status || '-') + '</span></td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // Ocorrencias
        if (data.ocorrencias && data.ocorrencias.length > 0) {
            html += '<div class="detail-section"><h3><i class="fa-solid fa-timeline"></i> Historico de Ocorrencias (' + data.ocorrencias.length + ')</h3>';
            html += '<div class="timeline">';
            data.ocorrencias.forEach(function (o) {
                html += '<div class="timeline-item">';
                html += '<div class="timeline-date">' + formatDate(o.data_arquivo) + '</div>';
                html += '<div class="timeline-event"><strong><span class="status-badge ' + getStatusClass(o.status) + '">' + escapeHtml(o.status || '') + '</span></strong> ' + escapeHtml(o.descricao || '') + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        // Tramitacoes 
        if (data.tramitacoes && data.tramitacoes.length > 0) {
            html += '<div class="detail-section tramitacao-section">';
            html += '<h3 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="var c = this.nextElementSibling; var i = this.querySelector(\'i.fa-chevron-down\'); if (c.classList.contains(\'d-none\')) { c.classList.remove(\'d-none\'); i.style.transform = \'rotate(180deg)\'; } else { c.classList.add(\'d-none\'); i.style.transform = \'rotate(0deg)\'; }">';
            html += '<span style="pointer-events:none;"><i class="fa-solid fa-comments"></i> Tramitações (' + data.tramitacoes.length + ')</span>';
            html += '<i class="fa-solid fa-chevron-down" style="pointer-events:none; transition: transform 0.3s ease;"></i></h3>';
            html += '<div class="tramitacao-container d-none">'; 
            html += '<div class="table-responsive"><table class="styled-table modal-table tramitacao-table"><thead><tr>';
            html += '<th>Data</th><th>Tipo</th><th>CPC</th><th>Funcionário</th>';
            html += '</tr></thead><tbody>';
            data.tramitacoes.forEach(function (t) {
                html += '<tr class="tramitacao-row-main">';
                html += '<td>' + formatDateTime(t.data) + '</td>';
                html += '<td><span class="status-badge status-active">' + escapeHtml(t.tipo) + '</span></td>';
                html += '<td><span class="status-badge ' + (String(t.cpc).toLowerCase()==='sim'?'status-success':(String(t.cpc).toLowerCase()==='nao'?'status-danger':'status-warning')) + '">' + escapeHtml(t.cpc) + '</span></td>';
                html += '<td>' + escapeHtml(t.funcionario_nome) + '</td>';
                html += '</tr>';
                html += '<tr class="tramitacao-row-desc"><td colspan="4">';
                html += '<span class="tramitacao-desc-label">Descrição:</span> ';
                html += '<span class="tramitacao-desc-text">' + escapeHtml(t.descricao) + '</span>';
                html += '</td></tr>';
            });
            html += '</tbody></table></div></div></div>';
        }

        modalContent.innerHTML = html;
    }

    function renderBemSection(bens) {
        if (!bens || bens.length === 0) return '';
        let skipFields = { id: 1, id_contrato: 1, grupo: 1, cota: 1, created_at: 1, updated_at: 1 };
        let titulo = bens.length > 1 ? ('Bem (' + bens.length + ')') : 'Bem';
        let html = '<div class="detail-section"><h3><i class="fa-solid fa-box"></i> ' + titulo + '</h3>';
        bens.forEach(function (bem, idx) {
            if (bens.length > 1) {
                html += '<h4 style="margin:16px 0 8px;color:#6b7280;font-size:0.95rem;">Item ' + (idx + 1) + '</h4>';
            }
            html += '<div class="detail-grid">';
            let anyField = false;
            Object.keys(bem).forEach(function (key) {
                if (skipFields[key]) return;
                let value = bem[key];
                if (value === null || value === undefined || value === '') return;
                anyField = true;
                html += dataItem(humanizeBemField(key), formatBemValue(key, value));
            });
            if (!anyField) {
                html += '<div style="color:#9ca3af;">Sem informações adicionais.</div>';
            }
            html += '</div>';
        });
        html += '</div>';
        return html;
    }

    function humanizeBemField(key) {
        let map = {
            descricao: 'Descrição', descricao_bem: 'Descrição',
            modelo: 'Modelo', marca: 'Marca', categoria: 'Categoria',
            codigo: 'Código', codigo_bem: 'Código do Bem',
            valor: 'Valor', valor_bem: 'Valor do Bem', valor_avaliacao: 'Valor de Avaliação',
            nome: 'Nome', ano: 'Ano', ano_fabricacao: 'Ano de Fabricação',
            ano_modelo: 'Ano Modelo', placa: 'Placa', chassi: 'Chassi',
            renavam: 'Renavam', cor: 'Cor', tipo: 'Tipo', status: 'Status',
            combustivel: 'Combustível', observacao: 'Observação', observacoes: 'Observações'
        };
        if (map[key]) return map[key];
        return String(key).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function formatBemValue(key, value) {
        let k = String(key).toLowerCase();
        if (k.indexOf('valor') !== -1 || k.indexOf('preco') !== -1) {
            let n = Number(value);
            if (!isNaN(n) && isFinite(n)) return formatCurrency(n);
        }
        if (k === 'data' || k.indexOf('data_') === 0 || k.indexOf('_data') !== -1) {
            return formatDate(value);
        }
        return value;
    }

    function renderPessoaSection(titulo, pessoa, enderecos, telefones, emails) {
        let icon = titulo === 'Avalista' ? 'fa-user-shield' : 'fa-user-tie';
        let html = '<div class="detail-section"><h3><i class="fa-solid ' + icon + '"></i> ' + escapeHtml(titulo) + '</h3>';
        html += '<div class="detail-grid">';
        html += dataItem('Nome', pessoa.nome_completo);
        html += dataItem('CPF / CNPJ', pessoa.cpf_cnpj);
        html += dataItem('Data de Nascimento', formatDate(pessoa.data_nascimento));
        html += dataItem('Profissao', pessoa.profissao);
        html += dataItem('Conjuge', pessoa.conjuge_nome);
        html += '</div>';

        if (enderecos && enderecos.length > 0) {
            enderecos.forEach(function (e) {
                html += '<div class="detail-grid" style="margin-top:12px">';
                html += dataItem('Endereco (' + (e.tipo || '') + ')', [e.logradouro, e.complemento, e.bairro, e.cidade, e.estado, e.cep].filter(Boolean).join(', '));
                html += '</div>';
            });
        }

        if ((telefones && telefones.length) || (emails && emails.length)) {
            html += '<div class="contact-grid" style="margin-top:12px">';
            if (telefones && telefones.length) {
                html += '<div><ul class="contact-list">';
                telefones.forEach(function (t) {
                    html += '<li><i class="fa-solid fa-phone"></i> ' + escapeHtml(t.numero || '-');
                    if (t.ramal) html += ' (ramal ' + escapeHtml(t.ramal) + ')';
                    html += '<button class="btn-ligar" title="Ligar"><i class="fa-solid fa-phone-volume"></i></button>';
                    html += '<button class="btn-mensagem" title="Enviar Mensagem"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-tipo">' + escapeHtml(t.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }
            if (emails && emails.length) {
                html += '<div><ul class="contact-list">';
                emails.forEach(function (em) {
                    html += '<li><i class="fa-solid fa-envelope"></i> ' + escapeHtml(em.email || '-');
                    html += '<button class="btn-mensagem" title="Enviar Mensagem"><i class="fa-solid fa-comment-dots"></i></button>';
                    html += '<span class="contact-tipo">' + escapeHtml(em.tipo) + '</span></li>';
                });
                html += '</ul></div>';
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function closeModal() {
        if(detalhesModal) {
            detalhesModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(detalhesModal) {
        detalhesModal.addEventListener('click', function (e) {
            if (e.target === detalhesModal) closeModal();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && detalhesModal && detalhesModal.classList.contains('active')) closeModal();
    });

    function dataItem(label, value, isBadge, badgeStatus) {
        let display = (value !== null && value !== undefined && value !== '') ? escapeHtml(value) : '-';
        if (isBadge && badgeStatus) {
            display = '<span class="status-badge ' + getStatusClass(badgeStatus) + '">' + escapeHtml(value) + '</span>';
        }
        return '<div class="data-item"><span class="data-label">' + escapeHtml(label) + '</span><span class="data-value">' + display + '</span></div>';
    }

    function formatDate(val) {
        if (!val) return '-';
        let parts = String(val).split('T')[0].split('-');
        if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        return val;
    }

    function formatDateTime(val) {
        if (!val) return '-';
        let parts = String(val).split('T');
        let dPart = parts[0];
        let tPart = parts[1] || '';
        if (parts.length === 1 && val.includes(' ')) {
            let spaceParts = val.split(' ');
            dPart = spaceParts[0];
            tPart = spaceParts[1] || '';
        }
        let dSplit = dPart.split('-');
        let fmtDate = dSplit.length === 3 ? dSplit[2] + '/' + dSplit[1] + '/' + dSplit[0] : dPart;
        let fmtTime = tPart ? tPart.substring(0, 5) : '';
        return fmtDate + (fmtTime ? ' ' + fmtTime : '');
    }

    function formatCurrency(val) {
        if (val === null || val === undefined || val === '') return '-';
        let num = parseFloat(val);
        if (isNaN(num)) return escapeHtml(val);
        return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function getStatusClass(status) {
        if (!status) return '';
        let s = String(status).toLowerCase();
        if (s === 'aberto' || s === 'em cobranca' || s === 'em cobrança') return 'status-active';
        if (s === 'fechado' || s === 'pago') return 'status-success';
        if (s === 'indenizado') return 'status-warning';
        if (s === 'parcela paga') return 'status-success';
        if (s === 'parcela vencida') return 'status-danger';
        return 'status-active';
    }

    init();
});
