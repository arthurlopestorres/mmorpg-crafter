// atividadesGuilda.js
//! INICIO ATIVIDADESGUILDA.JS
// atividadesGuilda.js - Módulo para gerenciar atividades da guilda
// Dependências: core.js, utils.js, time.js (para permissões e membros do time)
// Removido: const socket = io(); // Assumindo que socket é definido globalmente em outro arquivo para evitar redeclaração
async function montarAtividadesGuilda() {
    const currentUserResp = await safeApi('/me');
    window.currentUserEmail = currentUserResp.email; // Armazenar email do usuário atual para uso no módulo
    conteudo.innerHTML = `
        <h2>Eventos</h2>
        <div class="filtros">
            <label for="filtroEventos">Filtrar por:</label>
            <select id="filtroEventos">
                <option value="proximos">Próximos Eventos</option>
                <option value="concluidos">Eventos Concluídos</option>
            </select>
        </div>
        <div id="atividades-lista" class="lista"></div>
    `;
    await carregarListaEventos(); // Carrega próximos eventos por padrão
    // Registrar usuário e entrar no game via socket
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    socket.emit('registerUser', { email: window.currentUserEmail, game: currentGame });
    socket.emit('joinGame', currentGame);
    // Listener para atualizações via websocket
    socket.on('update', (data) => {
        if (data.type === 'atividadesGuilda') {
            atualizarListaEventos();
        }
    });
    // Evento de mudança no filtro
    document.getElementById("filtroEventos").addEventListener("change", async (e) => {
        const valor = e.target.value;
        if (valor === "proximos") {
            await carregarListaEventos();
        } else if (valor === "concluidos") {
            await carregarListaEventosConcluidos();
        }
    });
}
async function atualizarListaEventos() {
    const filtro = document.getElementById("filtroEventos").value;
    if (filtro === "proximos") {
        await carregarListaEventos();
    } else if (filtro === "concluidos") {
        await carregarListaEventosConcluidos();
    }
}
async function carregarListaEventos() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const currentUser = window.currentUserEmail;
    const div = document.getElementById("atividades-lista");
    div.innerHTML = '';
    let html = '';
    if (hasPermission('criarEvento') || isUserAdmin()) {
        html += `
            <div class="secao">
                <button class="botaoNovoEvento" onclick="mostrarPopupNovoEvento()">+ Criar Evento</button>
            </div>
        `;
    }
    try {
        const eventos = await safeApi(`/atividadesGuilda?game=${encodeURIComponent(currentGame)}`);
        html += `
            <div class="secao">
                <h3>Próximos Eventos</h3>
                <ul>${eventos.map(e => gerarHtmlEvento(e, currentUser)).join("") || '<li class="fraseNenhumEvento">Nenhum evento agendado</li>'}</ul>
            </div>
        `;
    } catch (error) {
        console.error('[ATIVIDADES GUILDA] Erro ao carregar eventos:', error);
        html += '<p>Erro ao carregar eventos.</p>';
    }
    div.innerHTML = html;
}
async function carregarListaEventosConcluidos() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const currentUser = window.currentUserEmail;
    const div = document.getElementById("atividades-lista");
    div.innerHTML = '';
    let html = '';
    try {
        const eventos = await safeApi(`/atividadesGuilda?game=${encodeURIComponent(currentGame)}&concluded=true`);
        html += `
            <div class="secao">
                <h3>Eventos Concluídos</h3>
                <ul>${eventos.map(e => gerarHtmlEvento(e, currentUser, true)).join("") || '<li class="fraseNenhumEvento">Nenhum evento concluído</li>'}</ul>
            </div>
        `;
    } catch (error) {
        console.error('[ATIVIDADES GUILDA] Erro ao carregar eventos concluídos:', error);
        html += '<p>Erro ao carregar eventos concluídos.</p>';
    }
    div.innerHTML = html;
}
function gerarHtmlEvento(e, currentUser, isConcluded = false) {
    const hasPresence = e.presencas && e.presencas.includes(currentUser);
    const isCreator = e.criador === currentUser;
    const isInvited = (e.membros || []).includes(currentUser);
    const isAdmin = isUserAdmin(); // Verifica se é founder ou co-founder
    const podeMarcarPresenca = !hasPresence && (isInvited || isCreator || isAdmin);
    const hasAssocPermission = hasPermission('associarMembrosEvento') || isUserAdmin();
    let botaoPresenca = '';
    if (!isConcluded && (hasPresence || podeMarcarPresenca)) {
        botaoPresenca = `<button class="evento-item--botaoMarcarPresenca" onclick="${hasPresence ? 'desmarcarPresenca' : 'marcarPresenca'}('${e.id}')">${hasPresence ? 'Desmarcar Presença' : 'Marcar Presença'}</button>`;
    }
    let botaoConcluir = '';
    if (!isConcluded && (hasPermission('concluirEvento') || isUserAdmin())) {
        botaoConcluir = `<button class="evento-item--botaoConcluir" onclick="concluirEvento('${e.id}')">Concluir</button>`;
    }
    let botaoConvidar = '';
    if (!isConcluded && hasAssocPermission) {
        botaoConvidar = `<button class="evento-item--botaoConvidar" onclick="mostrarPopupAssociarMembros('${e.id}')">Convidar Membros</button>`;
    }
    let botaoEditar = '';
    if (!isConcluded && (hasPermission('editarEvento') || isUserAdmin())) {
        botaoEditar = `<button class="evento-item--botaoEditar" onclick="mostrarPopupEditarEvento('${e.id}')">Editar</button>`;
    }
    let botaoExcluir = '';
    if (hasPermission('excluirEvento') || isUserAdmin()) {
        botaoExcluir = `<button class="evento-item--botaoExcluirEvento" onclick="excluirEvento('${e.id}')">Excluir Evento</button>`;
    }
    let membrosHtml = '';
    if (hasAssocPermission) {
        membrosHtml = `
            <ul class="evento-item--membrosConvidados--lista">${e.membros ? e.membros.map(m => `
                <li class="evento-item--membrosConvidados--item">
                    ${escapeHtml(m)}
                    ${!isConcluded ? `<button class="evento-item--membrosConvidados--item--botaoCancelar" onclick="cancelarConvite('${e.id}', '${m}')">Cancelar Convite</button>` : ''}
                </li>
            `).join('') : '' || '<li>Nenhum</li>'}</ul>
        `;
    } else if (e.membros && e.membros.includes(currentUser)) {
        membrosHtml = `
            <ul class="evento-item--membrosConvidados--lista"><li class="evento-item--membrosConvidados--item">${escapeHtml(currentUser)}</li></ul>
        `;
    } else {
        membrosHtml = `
            <p class="evento-item--membrosConvidados--avisoNaoConvidado">Você não está convidado para este evento.</p>
        `;
    }
    return `
        <li class="evento-item item" data-id="${e.id}">
            <strong class="evento-item--titulo">${escapeHtml(e.titulo)}</strong>
            <p class="evento-item--time">${e.data} ${e.horario} (${e.timezone})</p>
            <p class="evento-item--descricao">${escapeHtml(e.descricao)}</p>
            <p class="evento-item--aviso">Aviso: ${e.avisoAntes} minutos antes</p>
            ${botaoConvidar}
            ${botaoPresenca}
            ${botaoEditar}
            ${botaoExcluir}
            ${botaoConcluir}
            <div class="evento-item--listaDePresencaWrapper">Presenças:
                <ul class="evento-item--listaDePresencaWrapper--lista">${e.presencas ? e.presencas.map(p => `<li class="evento-item--listaDePresencaWrapper--lista--item" data-email="${escapeHtml(p)}">${escapeHtml(p)}</li>`).join('') : '<li>Nenhuma</li>'}</ul>
            </div>
            <div class="evento-item--membrosConvidados--Wrapper">
                <h4 class="evento-item--membrosConvidados--titulo">Membros Convidados:</h4>
                ${membrosHtml}
            </div>
        </li>
    `;
}
async function concluirEvento(id) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    if (!confirm('Concluir este evento?')) return;
    try {
        const data = await safeApi(`/atividadesGuilda/${id}/concluir?game=${encodeURIComponent(currentGame)}`, { method: "POST" });
        if (data.sucesso) {
            atualizarListaEventos();
        } else {
            mostrarErro(data.erro || 'Erro ao concluir evento');
        }
    } catch (error) {
        mostrarErro('Erro ao concluir evento');
    }
}
async function cancelarConvite(id, email) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    if (!confirm(`Cancelar convite para ${email}?`)) return;
    try {
        const evento = await safeApi(`/atividadesGuilda/${id}?game=${encodeURIComponent(currentGame)}`);
        const novosMembros = (evento.membros || []).filter(m => m !== email);
        const data = await safeApi(`/atividadesGuilda/${id}/membros?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ membros: novosMembros })
        });
        if (data.sucesso) {
            atualizarListaEventos();
        } else {
            mostrarErro(data.erro || 'Erro ao cancelar convite');
        }
    } catch (error) {
        mostrarErro('Erro ao cancelar convite');
    }
}
function mostrarPopupNovoEvento() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    // Detectar fuso horário do navegador do usuário
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupNovoEvento";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Novo Evento</h2>
        <form id="formNovoEvento">
            <label class="fomrNovoEvento-Titulo">Título:</label>
            <input type="text" id="tituloEvento" placeholder="Título do Evento" required>
            <label class="fomrNovoEvento-Titulo">Descrição:</label>
            <textarea id="descricaoEvento" placeholder="Descrição do Evento" required></textarea>
            <label class="fomrNovoEvento-Titulo">Data do Evento:</label>
            <input type="date" id="dataEvento" required>
            <label class="fomrNovoEvento-Titulo">Horário do Evento:</label>
            <input type="time" id="horarioEvento" required>
            <label class="fomrNovoEvento-Titulo">Time Zone:</label>
            <select id="timezoneEvento" disabled>
                <option value="${userTimezone}">${userTimezone}</option>
            </select>
            <small>Fuso horário detectado automaticamente do seu navegador.</small>
            <label class="fomrNovoEvento-Titulo">Minutos de atencedência para aviso por e-mail:</label>
            <input type="number" id="avisoAntes" placeholder="Aviso antes (minutos)" required>
            <button type="submit">Criar</button>
            <button type="button" id="btnCancelarNovoEvento">Cancelar</button>
        </form>
    `;
    document.body.appendChild(popup);
    document.getElementById("formNovoEvento").addEventListener("submit", async (e) => {
        e.preventDefault();
        const titulo = document.getElementById("tituloEvento").value;
        const descricao = document.getElementById("descricaoEvento").value;
        const data = document.getElementById("dataEvento").value;
        const horario = document.getElementById("horarioEvento").value;
        const timezone = document.getElementById("timezoneEvento").value;
        const avisoAntes = document.getElementById("avisoAntes").value;
        try {
            const dataResp = await safeApi(`/atividadesGuilda?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ titulo, descricao, data, horario, timezone, avisoAntes: parseInt(avisoAntes), criador: window.currentUserEmail })
            });
            if (dataResp.sucesso) {
                popup.remove();
                overlay.remove();
                atualizarListaEventos();
            } else {
                mostrarErro(dataResp.erro || 'Erro ao criar evento');
            }
        } catch (error) {
            mostrarErro('Erro ao criar evento');
        }
    });
    document.getElementById("btnCancelarNovoEvento").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}
async function mostrarPopupEditarEvento(id) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    // Detectar fuso horário do navegador do usuário
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
        const evento = await safeApi(`/atividadesGuilda/${id}?game=${encodeURIComponent(currentGame)}`);
        const overlay = criarOverlay();
        const popup = document.createElement("div");
        popup.id = "popupEditarEvento";
        popup.style.position = "fixed";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        popup.style.backgroundColor = "white";
        popup.style.padding = "20px";
        popup.style.zIndex = "1000";
        popup.innerHTML = `
            <h2>Editar Evento</h2>
            <form id="formEditarEvento">
                <label class="formEditarEvento-Titulo">Título:</label>
                <input type="text" id="tituloEventoEdit" value="${escapeHtml(evento.titulo)}" required>
                <label class="formEditarEvento-Titulo">Descrição:</label>
                <textarea id="descricaoEventoEdit">${escapeHtml(evento.descricao)}</textarea>
                <label class="formEditarEvento-Titulo">Data do Evento:</label>
                <input type="date" id="dataEventoEdit" value="${evento.data}" required>
                <label class="formEditarEvento-Titulo">Horário do Evento:</label>
                <input type="time" id="horarioEventoEdit" value="${evento.horario}" required>
                <label class="formEditarEvento-Titulo">Time Zone:</label>
                <select id="timezoneEventoEdit" disabled>
                    <option value="${userTimezone}">${userTimezone}</option>
                </select>
                <small>Fuso horário detectado automaticamente do seu navegador.</small>
                <label class="formEditarEvento-Titulo">Minutos de atencedência para aviso por e-mail:</label>
                <input type="number" id="avisoAntesEdit" value="${evento.avisoAntes}" required>
                <button type="submit">Salvar</button>
                <button type="button" id="btnCancelarEditarEvento">Cancelar</button>
            </form>
        `;
        document.body.appendChild(popup);
        document.getElementById("formEditarEvento").addEventListener("submit", async (e) => {
            e.preventDefault();
            const titulo = document.getElementById("tituloEventoEdit").value;
            const descricao = document.getElementById("descricaoEventoEdit").value;
            const data = document.getElementById("dataEventoEdit").value;
            const horario = document.getElementById("horarioEventoEdit").value;
            const timezone = document.getElementById("timezoneEventoEdit").value;
            const avisoAntes = document.getElementById("avisoAntesEdit").value;
            try {
                const dataResp = await safeApi(`/atividadesGuilda/${id}?game=${encodeURIComponent(currentGame)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ titulo, descricao, data, horario, timezone, avisoAntes: parseInt(avisoAntes) })
                });
                if (dataResp.sucesso) {
                    popup.remove();
                    overlay.remove();
                    atualizarListaEventos();
                } else {
                    mostrarErro(dataResp.erro || 'Erro ao editar evento');
                }
            } catch (error) {
                mostrarErro('Erro ao editar evento');
            }
        });
        document.getElementById("btnCancelarEditarEvento").addEventListener("click", () => {
            popup.remove();
            overlay.remove();
        });
    } catch (error) {
        mostrarErro('Erro ao carregar evento para edição');
    }
}
async function excluirEvento(id) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    if (!confirm('Excluir este evento?')) return;
    try {
        const data = await safeApi(`/atividadesGuilda/${id}?game=${encodeURIComponent(currentGame)}`, { method: "DELETE" });
        if (data.sucesso) {
            atualizarListaEventos();
        } else {
            mostrarErro(data.erro || 'Erro ao excluir evento');
        }
    } catch (error) {
        mostrarErro('Erro ao excluir evento');
    }
}
async function mostrarPopupAssociarMembros(id) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    if (!hasPermission('associarMembrosEvento') && !isUserAdmin()) {
        mostrarErro('Sem permissão para associar membros');
        return;
    }
    // Nova verificação: Checar se o jogo está compartilhado (para founders)
    try {
        const status = await safeApi(`/user-status?game=${encodeURIComponent(currentGame)}`);
        if (status.isFounder) {
            const shared = await safeApi('/shared');
            if (!shared.includes(currentGame)) {
                mostrarErro('Este jogo não está compartilhado com membros. Compartilhe-o primeiro para associar membros a eventos.');
                return;
            }
        }
        // Para não-founders, se eles podem ver o jogo, ele está compartilhado
    } catch (error) {
        console.error('[ASSOCIAR MEMBROS] Erro ao verificar compartilhamento:', error);
        mostrarErro('Erro ao verificar acesso ao jogo');
        return;
    }
    try {
        const [evento, associados] = await Promise.all([
            safeApi(`/atividadesGuilda/${id}?game=${encodeURIComponent(currentGame)}`),
            safeApi('/associacoes')
        ]);
        const membrosAssociados = evento.membros || [];
        const overlay = criarOverlay();
        const popup = document.createElement("div");
        popup.id = "popupAssociarMembros";
        popup.style.position = "fixed";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        popup.style.backgroundColor = "white";
        popup.style.padding = "20px";
        popup.style.zIndex = "1000";
        popup.innerHTML = `
            <h2>Associar Membros ao Evento</h2>
            <label><input type="checkbox" id="convidarTodosCheckbox"> Convidar Todos</label>
            <ul>
                ${associados.map(a => `
                    <li>
                        <label>
                            <input type="checkbox" class="membro-checkbox" data-email="${a.secondary}" ${membrosAssociados.includes(a.secondary) ? 'checked' : ''}>
                            ${a.secondary}
                        </label>
                    </li>
                `).join("")}
            </ul>
            <button id="btnSalvarMembros">Salvar</button>
            <button type="button" id="btnCancelarAssociar">Cancelar</button>
        `;
        document.body.appendChild(popup);
        document.getElementById("convidarTodosCheckbox").addEventListener("change", (e) => {
            const checkboxes = document.querySelectorAll('.membro-checkbox');
            checkboxes.forEach(cb => cb.checked = e.target.checked);
        });
        document.getElementById("btnSalvarMembros").addEventListener("click", async () => {
            const membros = [];
            document.querySelectorAll('.membro-checkbox:checked').forEach(cb => {
                membros.push(cb.dataset.email);
            });
            try {
                const data = await safeApi(`/atividadesGuilda/${id}/membros?game=${encodeURIComponent(currentGame)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ membros })
                });
                if (data.sucesso) {
                    popup.remove();
                    overlay.remove();
                    atualizarListaEventos();
                } else {
                    mostrarErro(data.erro || 'Erro ao associar membros');
                }
            } catch (error) {
                mostrarErro('Erro ao associar membros');
            }
        });
        document.getElementById("btnCancelarAssociar").addEventListener("click", () => {
            popup.remove();
            overlay.remove();
        });
    } catch (error) {
        mostrarErro('Erro ao carregar membros');
    }
}
async function marcarPresenca(id) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/atividadesGuilda/${id}/presenca?game=${encodeURIComponent(currentGame)}`, { method: "POST" });
        if (data.sucesso) {
            const updatedEvent = await safeApi(`/atividadesGuilda/${id}?game=${encodeURIComponent(currentGame)}`);
            const existingLi = document.querySelector(`.evento-item[data-id="${id}"]`);
            if (existingLi) {
                existingLi.outerHTML = gerarHtmlEvento(updatedEvent, window.currentUserEmail);
            } else {
                atualizarListaEventos();
            }
        } else {
            mostrarErro(data.erro || 'Erro ao marcar presença');
        }
    } catch (error) {
        mostrarErro('Erro ao marcar presença');
    }
}
async function desmarcarPresenca(id) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/atividadesGuilda/${id}/presenca?game=${encodeURIComponent(currentGame)}`, { method: "DELETE" });
        if (data.sucesso) {
            const updatedEvent = await safeApi(`/atividadesGuilda/${id}?game=${encodeURIComponent(currentGame)}`);
            const existingLi = document.querySelector(`.evento-item[data-id="${id}"]`);
            if (existingLi) {
                existingLi.outerHTML = gerarHtmlEvento(updatedEvent, window.currentUserEmail);
            } else {
                atualizarListaEventos();
            }
        } else {
            mostrarErro(data.erro || 'Erro ao desmarcar presença');
        }
    } catch (error) {
        mostrarErro('Erro ao desmarcar presença');
    }
}
// Exportar a função principal para o escopo global para ser acessível pelo menu.js
window.montarAtividadesGuilda = montarAtividadesGuilda;
//! FIM ATIVIDADES GUILDA.JS