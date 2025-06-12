document.addEventListener('DOMContentLoaded', () => {
    // ELEMENTOS DO DOM
    const monthYearStr = document.getElementById('month-year-str');
    const calendarDays = document.getElementById('calendar-days');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // ELEMENTOS DO MODAL
    const eventModal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const eventIdInput = document.getElementById('event-id');
    const eventTitleInput = document.getElementById('event-title-input');
    const eventDescInput = document.getElementById('event-desc-input');
    const saveEventBtn = document.getElementById('save-event-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const closeBtn = document.querySelector('.close-btn');

    // NOVOS ELEMENTOS DO MODAL PARA PARTICIPANTES
    const participantCheckboxes = document.querySelectorAll('input[name="event-participant"]'); // Seleciona todos os checkboxes de participantes

    // ESTADO DO CALENDÁRIO
    let currentDate = new Date();
    let db;
    let selectedDate;

    // INICIALIZAÇÃO DO INDEXEDDB
    function initDB() {
        const request = indexedDB.open('agendaDB', 1);

        request.onerror = (event) => console.error("Erro no IndexedDB:", event.target.errorCode);

        request.onsuccess = (event) => {
            db = event.target.result;
            renderCalendar();
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('events', { keyPath: 'id' });
        };
    }

    // RENDERIZAÇÃO DO CALENDÁRIO
    async function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        monthYearStr.textContent = `${new Date(year, month).toLocaleString('pt-br', { month: 'long' })} ${year}`;
        calendarDays.innerHTML = '';

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const events = await getEventsForMonth(year, month);

        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('day', 'empty');
            calendarDays.appendChild(emptyDay);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const daySquare = document.createElement('div');
            daySquare.classList.add('day');
            daySquare.textContent = day;
            daySquare.dataset.date = new Date(year, month, day).toISOString().split('T')[0];

            const today = new Date();
            if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                daySquare.classList.add('today');
            }

            const dateStr = daySquare.dataset.date;
            if (events.some(e => e.id.startsWith(dateStr))) {
                const eventIndicator = document.createElement('div');
                eventIndicator.classList.add('event-indicator');
                daySquare.appendChild(eventIndicator);
            }

            daySquare.addEventListener('click', () => openModal(daySquare.dataset.date));
            calendarDays.appendChild(daySquare);
        }
    }

    async function openModal(date) {
        selectedDate = date;
        resetModal();

        const events = await getEventsForDate(date);

        modalTitle.textContent = 'Adicionar Evento';

        const existingList = document.getElementById('event-list');
        if (existingList) existingList.remove();

        if (events.length > 0) {
            const list = document.createElement('ul');
            list.id = 'event-list';
            list.style.marginTop = '15px';

            events.forEach(event => {
                const item = document.createElement('li');
                item.textContent = `${event.hour || '—'} - ${event.title}`;
                item.style.cursor = 'pointer';
                item.style.marginBottom = '5px';
                item.style.borderBottom = '1px solid #ccc';
                item.style.padding = '5px 0';

                item.addEventListener('click', () => {
                    eventIdInput.value = event.id;
                    eventTitleInput.value = event.title;
                    eventDescInput.value = event.description;
                    document.getElementById('event-hour-input').value = event.hour || '';
                    // Marcar os checkboxes de participantes
                    participantCheckboxes.forEach(checkbox => {
                        checkbox.checked = event.participants && event.participants.includes(checkbox.value);
                    });
                    modalTitle.textContent = 'Editar Evento';
                    deleteEventBtn.style.display = 'inline-block';
                });

                list.appendChild(item);
            });

            document.querySelector('.modal-content').appendChild(list);
        }

        eventModal.style.display = 'flex';
    }

    function closeModal() {
        eventModal.style.display = 'none';
    }

    function resetModal() {
        modalTitle.textContent = 'Adicionar Evento';
        eventIdInput.value = '';
        eventTitleInput.value = '';
        eventDescInput.value = '';
        document.getElementById('event-hour-input').value = '';
        // Desmarcar todos os checkboxes de participantes
        participantCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        deleteEventBtn.style.display = 'none';
    }

    function saveEvent() {
        const title = eventTitleInput.value.trim();
        if (!title) {
            alert('O título do evento é obrigatório!');
            return;
        }

        const description = eventDescInput.value.trim();
        const eventId = eventIdInput.value || `${selectedDate}-${Date.now()}`;
        const hour = document.getElementById('event-hour-input').value;

        // Coletar os participantes selecionados
        const selectedParticipants = Array.from(participantCheckboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        const eventData = {
            id: eventId,
            title,
            description,
            hour,
            participants: selectedParticipants // Adiciona os participantes ao objeto do evento
        };

        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        store.put(eventData);

        transaction.oncomplete = () => {
            closeModal();
            renderCalendar();
        };

        transaction.onerror = (event) => console.error("Erro ao salvar evento:", event.target.errorCode);
    }

    function deleteEvent() {
        const eventId = eventIdInput.value;
        if (!eventId) return;

        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        store.delete(eventId);

        transaction.oncomplete = () => {
            closeModal();
            renderCalendar();
        };

        transaction.onerror = (event) => console.error("Erro ao deletar evento:", event.target.errorCode);
    }

    async function getEventsForMonth(year, month) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const request = store.getAll();

            request.onsuccess = () => {
                const allEvents = request.result;
                const monthEvents = allEvents.filter(e => e.id.startsWith(monthStr));
                resolve(monthEvents);
            };

            request.onerror = (event) => reject("Erro ao buscar eventos:", event.target.errorCode);
        });
    }

    async function getEventsForDate(dateStr) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const request = store.getAll();

            request.onsuccess = () => {
                const allEvents = request.result;
                const dateEvents = allEvents.filter(e => e.id.startsWith(dateStr));
                resolve(dateEvents);
            };

            request.onerror = (event) => reject("Erro ao buscar eventos:", event.target.errorCode);
        });
    }

    async function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthName = new Date(year, month).toLocaleString('pt-br', { month: 'long' });

        doc.setFontSize(20);
        doc.text(`Relatório de Eventos - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`, 14, 22);

        const events = await getEventsForMonth(year, month);

        if (events.length === 0) {
            doc.setFontSize(12);
            doc.text("Nenhum evento agendado para este mês.", 14, 35);
        } else {
            // Ordena os eventos pela data, como você já faz
            events.sort((a, b) => {
                const dateA = a.id.split('-').slice(0, 3).join('-'); // Pega YYYY-MM-DD
                const dateB = b.id.split('-').slice(0, 3).join('-'); // Pega YYYY-MM-DD
                return new Date(dateA) - new Date(dateB);
            });

            const tableBody = events.map(event => {
                // A data já está armazenada no formato YYYY-MM-DD no início do ID
                // Basta extrair essa parte do ID para usar diretamente
                const datePart = event.id.split('-').slice(0, 3).join('-'); // Pega "YYYY-MM-DD"
                
                // Converte para o formato dd/mm/yyyy para exibição
                const [y, m, d] = datePart.split('-');
                const formattedDate = `${d}/${m}/${y}`; // Formato dd/mm/yyyy para o Brasil

                const participants = event.participants && event.participants.length > 0 ? event.participants.join(', ') : "Nenhum";
                return [
                    formattedDate,
                    event.hour || "—",
                    event.title,
                    event.description || "Sem descrição",
                    participants
                ];
            });


            doc.autoTable({
                head: [["Data", "Horário", "Título", "Descrição", "Participantes"]],
                body: tableBody,
                startY: 30
            });
        }

        doc.save(`Relatorio_${monthName}_${year}.pdf`);
    }

    // EVENT LISTENERS
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == eventModal) closeModal();
    });

    saveEventBtn.addEventListener('click', saveEvent);
    deleteEventBtn.addEventListener('click', deleteEvent);
    exportPdfBtn.addEventListener('click', exportToPDF);

    // INICIALIZAÇÃO
    initDB();
});
