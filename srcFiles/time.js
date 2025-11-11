// time.js
//! INICIO TIME.JS
// time.js - Módulo de time, permissões, compartilhamento de jogos
// Dependências: core.js, utils.js (safeApi, mostrarErro, etc.)
async function montarTime() {
    conteudo.innerHTML = `
        <h2>Membros</h2>
        <div id="time-lista" class="lista"></div>
    `;
    await carregarListaTime();
}
async function carregarListaTime() {
    const userEmail = sessionStorage.getItem('userEmail');
    let isFounder = isUserFounder();
    let effectiveUser = sessionStorage.getItem('effectiveUser') || userEmail;
    try {
        const status = await safeApi(`/user-status`);
        isFounder = status.isFounder;
        effectiveUser = status.effectiveUser;
        sessionStorage.setItem('isFounder', status.isFounder.toString());
        sessionStorage.setItem('effectiveUser', status.effectiveUser);
    } catch (error) {
        console.error('[TIME] Erro ao carregar status do usuário:', error);
    }
    const div = document.getElementById("time-lista");
    div.innerHTML = '';
    // Sempre adicionar seção de pendências
    let html = `
        <div class="secao" id="pendencias-secao">
            <h3>Pendências de Convite</h3>
            <ul id="pendencias-lista"></ul>
        </div>
    `;
    if (!isFounder) {
        html = `
            <div class="secao">
                <h3>Seu Status no Time</h3>
                <p>Você é membro do time de <strong>${effectiveUser}</strong>. Contate o fundador para gerenciar membros.</p>
                <button class="btn-desvincular" onclick="sairDoTime('${effectiveUser}')">Sair do Time</button>
            </div>
        ` + html;
    }
    if (isFounder) {
        try {
            const [associados, banidosComRole, disponiveisAll] = await Promise.all([
                safeApi(`/associacoes`),
                safeApi(`/banidos`),
                safeApi(`/usuarios-disponiveis`)
            ]);
            // Filtrar associados para excluir o próprio email do usuário logado
            const associadosFiltrados = associados.filter(a => a.secondary !== userEmail);
            const associadosEmails = associadosFiltrados.map(a => a.secondary);
            const banidosEmails = banidosComRole.map(b => b.banned);
            // Filtrar disponíveis para excluir pendências recebidas
            const disponiveis = disponiveisAll.filter(d => !d.pendingReceived);
            html += `
                <div class="secao">
                    <h3>Associados</h3>
                    <ul>${associadosFiltrados.map(a => {
                const isCoFounder = a.role === 'co-founder';
                const permissoesHtml = !isCoFounder ? `<button class="btn-permissoes" onclick="mostrarPopupPermissoes('${a.secondary}')">Permissões</button>` : '';
                return `
                            <li class="time-item">
                                ${a.secondary}
                                ${isCoFounder ? '<span style="color: green;"> (Co-Fundador)</span>' : ''}
                                <button class="btn-promote-cofounder" onclick="toggleCoFounder('${a.secondary}', ${isCoFounder})">${isCoFounder ? 'Remover Co-Fundador' : 'Promover a Co-Fundador'}</button>
                                ${permissoesHtml}
                                <button class="btn-desvincular" onclick="desvincularUsuario('${a.secondary}', '${a.role}')">Desvincular</button>
                                <button class="btn-banir" onclick="banirUsuario('${a.secondary}', '${a.role}')">Banir</button>
                            </li>
                        `;
            }).join("") || '<li>Nenhum associado</li>'}</ul>
                </div>
                <div class="secao">
                    <h3>Convidar Novo Membro</h3>
                    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
                        <input type="text" id="inputEmailConvidar" class="input-convidar" placeholder="Digite o email para convidar">
                        <button id="btnConvidar" class="btn-vincular">Convidar</button>
                    </div>
                    <div id="feedbackConvidar" style="font-weight: 500; margin-top: 8px; display: none;"></div>
                </div>
                <div class="secao">
                    <h3>Banidos</h3>
                    <ul>${banidosComRole.map(b => `
                        <li class="time-item">
                            ${b.banned}
                            <button class="btn-desbanir" onclick="desbanirUsuario('${b.banned}', '${b.role}')">Desbanir</button>
                        </li>
                    `).join("") || '<li>Nenhum banido</li>'}</ul>
                </div>
            `;
            // Seção para compartilhar jogos (somente para founder)
            html += await getSharedGamesSection();
        } catch (error) {
            console.error('[TIME] Erro ao carregar lista:', error);
            html += '<p>Erro ao carregar dados do time.</p>';
        }
    }
    div.innerHTML = html;
    await carregarPendencias();
    // Event listener para toggle co-founder (apenas se founder)
    if (isFounder) {
        const btnConvidar = document.getElementById("btnConvidar");
        const inputEmail = document.getElementById("inputEmailConvidar");
        const feedbackDiv = document.getElementById("feedbackConvidar");
        btnConvidar.addEventListener("click", async () => {
            const email = inputEmail.value.trim();
            if (!email) {
                showFeedback(feedbackDiv, "Digite um email válido", "error");
                return;
            }
            await enviarConvidar(email, btnConvidar, feedbackDiv, inputEmail);
        });
    }
    // Adicionar event listeners para toggles de compartilhamento de jogos
    if (isFounder) {
        document.querySelectorAll('.toggle-share').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const game = e.target.dataset.game;
                const share = e.target.checked;
                await toggleShareGame(game, share);
            });
        });
    }
}
// Nova função para mostrar popup de permissões granulares
async function mostrarPopupPermissoes(secondary) {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupPermissoes";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.style.maxHeight = "80vh";
    popup.style.overflowY = "auto";
    popup.innerHTML = `
        <h2>Permissões para ${secondary}</h2>
        <form id="formPermissoes">
            <h3>Categorias</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="criarCategorias"> Criar Categorias</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="excluirCategorias"> Excluir Categorias</label>
            <h3>Componentes e Estoque</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="criarComponente"> Criar Componente</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="editarComponente"> Editar Componente</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="excluirComponente"> Excluir Componente</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="debitarEstoque"> Debitar Estoque</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="zerarEstoque"> Zerar Estoque</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="exportarEstoque"> Exportar Estoque</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="importarEstoque"> Importar Estoque</label>
            <h3>Receitas</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="criarReceitas"> Criar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="favoritarReceitas"> Favoritar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="concluirReceitas"> Concluir e Arquivar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="duplicarReceitas"> Duplicar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="editarReceitas"> Editar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="excluirArquivados"> Excluir Arquivados</label>
            <h3>Farmar Receitas Favoritas</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="fabricarComponentes"> Fabricar Componentes</label>
            <h3>Roadmap</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="criarRoadmap"> Criar Roadmap</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="excluirRoadmap"> Excluir Roadmap</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="reordenarRoadmap"> Reordenar Roadmap</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="marcarProntoRoadmap"> Marcar Pronto Roadmap</label>
            <h3>Atividades da Guilda</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="criarEvento"> Criar Evento</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="editarEvento"> Editar Evento</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="excluirEvento"> Excluir Evento</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="associarMembrosEvento"> Associar Membros ao Evento</label>           
            <button type="submit">Salvar</button>
            <button type="button" id="btnCancelarPermissoes">Cancelar</button>
        </form>
    `;
    document.body.appendChild(popup);
    // Carregar permissões atuais
    try {
        const associacoes = await safeApi('/associacoes');
        const assoc = associacoes.find(a => a.secondary === secondary);
        const permissao = assoc.permissao || {}; // CORRIGIDO: era 'permissoes' → agora 'permissao'
        document.querySelectorAll('.perm-checkbox').forEach(cb => {
            cb.checked = permissao[cb.dataset.key] || false;
        });
    } catch (error) {
        console.error('[PERMISSOES] Erro ao carregar permissões:', error);
    }
    document.getElementById("formPermissoes").addEventListener("submit", async (e) => {
        e.preventDefault();
        const permissao = {};
        document.querySelectorAll('.perm-checkbox').forEach(cb => {
            permissao[cb.dataset.key] = cb.checked;
        });
        try {
            const data = await safeApi('/set-permissoes', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ secondary, permissao })
            });
            if (data.sucesso) {
                popup.remove();
                overlay.remove();
                await carregarListaTime();
                emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
            } else {
                alert(data.erro || 'Erro ao salvar permissões');
            }
        } catch (error) {
            alert('Erro ao salvar permissões: ' + error.message);
        }
    });
    document.getElementById("btnCancelarPermissoes").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}
// Nova função para obter seção de jogos compartilhados
async function getSharedGamesSection() {
    try {
        const games = await safeApi(`/games`);
        const shared = await safeApi(`/shared`).catch(() => []);
        let html = `
            <div class="secao">
                <h3>Compartilhar Jogos com Membros</h3>
                <ul>
        `;
        games.forEach(g => {
            const isShared = shared.includes(g);
            html += `
                <li class="time-item">
                    ${g}
                    <label>
                        Compartilhar: <input type="checkbox" class="toggle-share" data-game="${g}" ${isShared ? 'checked' : ''}>
                    </label>
                </li>
            `;
        });
        html += '</ul></div>';
        return html;
    } catch (error) {
        console.error('[SHARED GAMES] Erro ao carregar jogos compartilhados:', error);
        return '<div class="secao"><h3>Compartilhar Jogos com Membros</h3><p>Erro ao carregar dados.</p></div>';
    }
}
// Nova função para toggle compartilhamento de jogo
async function toggleShareGame(game, share) {
    try {
        const data = await safeApi(`/shared`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game, share })
        });
        if (data.sucesso) {
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao atualizar compartilhamento');
        }
    } catch (error) {
        console.error('[TOGGLE SHARE] Erro:', error);
        alert('Erro ao atualizar compartilhamento');
    }
}
// Nova: Função para toggle co-founder
async function toggleCoFounder(secondary, isCoFounder) {
    if (!confirm(`Confirmar ${isCoFounder ? 'remoção de co-fundador' : 'promoção a co-fundador'} para ${secondary}?`)) return;
    try {
        const data = await safeApi(`/promote-cofounder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secondary, promote: !isCoFounder })
        });
        if (data.sucesso) {
            await carregarUserStatus();
            await carregarListaTime();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao atualizar co-founder');
        }
    } catch (error) {
        console.error('[TOGGLE CO-FOUNDER] Erro:', error);
        alert('Erro ao atualizar co-founder');
    }
}
async function carregarPendencias() {
    try {
        const pendencias = await safeApi(`/pendencias`);
        const lista = document.getElementById("pendencias-lista");
        if (pendencias.length === 0) {
            lista.innerHTML = '<li>Nenhuma pendência de convite.</li>';
        } else {
            lista.innerHTML = pendencias.map(p => `
                <li class="time-item">
                    Convite de <strong>${p.from}</strong>
                    <button class="btn-vincular" onclick="aceitarConvidar('${p.from}')">Aceitar</button>
                    <button class="btn-desvincular" onclick="recusarConvidar('${p.from}')">Recusar</button>
                </li>
            `).join("");
        }
    } catch (error) {
        console.error('[TIME] Erro ao carregar pendências:', error);
        document.getElementById("pendencias-lista").innerHTML = '<li>Erro ao carregar pendências.</li>';
    }
}
function emitTeamUpdate() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    socket.emit('teamUpdate', { game: currentGame });
}
async function enviarConvidar(email, btn = null, feedbackDiv = null, input = null) {
    if (!confirm(`Enviar convite para ${email}?`)) return;
    if (btn) btn.disabled = true;
    if (input) input.disabled = true;
    if (feedbackDiv) feedbackDiv.style.display = "none";
    try {
        const data = await safeApi(`/enviar-convite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: email })
        });
        if (data.sucesso) {
            mostrarSucesso("Convite enviado ✅");
            if (input) input.value = "";
            await carregarListaTime();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            showFeedback(feedbackDiv, data.erro || 'Erro ao enviar convite', "error", btn);
        }
    } catch (error) {
        console.error('[TIME] Erro ao enviar convite:', error);
        showFeedback(feedbackDiv, 'Erro ao enviar convite', "error", btn);
    } finally {
        if (btn) setTimeout(() => { btn.disabled = false; }, 3000);
        if (input) setTimeout(() => { input.disabled = false; }, 3000);
    }
}
// Função auxiliar para mostrar feedback no botão/div
function showFeedback(feedbackDiv, message, type, btn = null) {
    if (feedbackDiv) {
        feedbackDiv.textContent = message;
        feedbackDiv.style.display = "block";
        feedbackDiv.className = `feedback-${type}`;
        if (type === "success") {
            feedbackDiv.style.color = "#48bb78";
        } else {
            feedbackDiv.style.color = "#f56565";
        }
    }
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = message;
        if (type === "success") {
            btn.style.background = "linear-gradient(135deg, #38ef7d 0%, #11998e 100%)";
        } else {
            btn.style.background = "linear-gradient(135deg, #fc466b 0%, #f56565 100%)";
        }
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = "";
        }, 3000);
    }
}
async function aceitarConvidar(from) {
    if (!confirm(`Aceitar convite de ${from}?`)) return;
    try {
        const data = await safeApi(`/aceitar-convite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from })
        });
        if (data.sucesso) {
            await carregarListaTime();
            window.location.reload();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao aceitar convite');
        }
    } catch (error) {
        console.error('[TIME] Erro ao aceitar convite:', error);
        alert('Erro ao aceitar convite');
    }
}
async function recusarConvidar(from) {
    if (!confirm(`Recusar convite de ${from}?`)) return;
    try {
        const data = await safeApi(`/recusar-convite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from })
        });
        if (data.sucesso) {
            window.location.reload();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao recusar convite');
        }
    } catch (error) {
        console.error('[TIME] Erro ao recusar convite:', error);
        alert('Erro ao recusar convite');
    }
}
async function sairDoTime(primary) {
    if (!confirm(`Sair do time de ${primary}?`)) return;
    try {
        const data = await safeApi(`/dissociate-as-secondary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ primary })
        });
        if (data.sucesso) {
            localStorage.removeItem("currentGame");
            await carregarListaTime();
            window.location.reload();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao sair do time');
        }
    } catch (error) {
        console.error('[TIME] Erro ao sair do time:', error);
        alert('Erro ao sair do time');
    }
}
async function vincularUsuario(email) {
    if (!confirm(`Vincular ${email} ao seu time?`)) return;
    try {
        const data = await safeApi(`/associate-self`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secondary: email })
        });
        if (data.sucesso) {
            await carregarListaTime();
        } else {
            alert(data.erro || 'Erro ao vincular usuário');
        }
    } catch (error) {
        console.error('[TIME] Erro ao vincular:', error);
        alert('Erro ao vincular usuário');
    }
}
async function desvincularUsuario(email, role) {
    if (!confirm(`Desvincular ${email} do seu time?`)) return;
    let endpoint = '/dissociate-self';
    let body = { secondary: email };
    if (role === 'secondary') {
        endpoint = '/dissociate-as-secondary';
        body = { primary: email };
    }
    try {
        const data = await safeApi(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (data.sucesso) {
            await carregarListaTime();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao desvincular usuário');
        }
    } catch (error) {
        console.error('[TIME] Erro ao desvincular:', error);
        alert('Erro ao desvincular usuário');
    }
}
async function banirUsuario(email, role) {
    if (!confirm(`Banir ${email} do seu time?`)) return;
    let endpoint = '/ban-user';
    let body = { secondary: email };
    if (role === 'secondary') {
        endpoint = '/ban-as-secondary';
        body = { primary: email };
    }
    try {
        const data = await safeApi(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (data.sucesso) {
            await carregarListaTime();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao banir usuário');
        }
    } catch (error) {
        console.error('[TIME] Erro ao banir:', error);
        alert('Erro ao banir usuário');
    }
}
async function desbanirUsuario(email, role) {
    if (!confirm(`Desbanir ${email}?`)) return;
    let endpoint = '/unban-user';
    let body = { bannedEmail: email };
    if (role === 'banned') {
        endpoint = '/unban-as-banned';
        body = { primary: email };
    }
    try {
        const data = await safeApi(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (data.sucesso) {
            await carregarListaTime();
            emitTeamUpdate(); // <--- EMITIR ATUALIZAÇÃO
        } else {
            alert(data.erro || 'Erro ao desbanir usuário');
        }
    } catch (error) {
        console.error('[TIME] Erro ao desbanir:', error);
        alert('Erro ao desbanir usuário');
    }
}
//! FIM TIME.JS