// core.js
//! INICIO CORE.JS
// core.js - Configurações iniciais, API, socket, loading, safeApi, debounce, DOMContentLoaded
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = isLocal ? "http://localhost:10000" : "https://mmorpg-crafter.onrender.com";
const RECAPTCHA_SITE_KEY = "6LeLG-krAAAAAFhUEHtBb3UOQefm93Oz8k5DTpx_"; // SUBSTITUA PELA SITE KEY OBTIDA NO GOOGLE
let processedFotoBlob = null;
// Socket.IO para atualizações em tempo real
const socket = io.connect(isLocal ? 'http://localhost:10000' : 'https://mmorpg-crafter.onrender.com');
// Nova função para mostrar o loading global
function showLoading() {
    // Remover loading existente se houver
    const existingLoading = document.getElementById("loadingOverlay");
    if (existingLoading) existingLoading.remove();
    const overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "10000";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    spinner.style.border = "8px solid #f3f3f3";
    spinner.style.borderTop = "8px solid #3498db";
    spinner.style.borderRadius = "50%";
    spinner.style.width = "60px";
    spinner.style.height = "60px";
    spinner.style.animation = "spin 1s linear infinite";
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
}
// Nova função para esconder o loading
function hideLoading() {
    const loading = document.getElementById("loadingOverlay");
    if (loading) loading.remove();
}
// Função safeApi modificada para incluir loading
async function safeApi(endpoint, init = {}) {
    // Mostrar loading apenas se não estiver logado (para login/cadastro)
    if (!sessionStorage.getItem("loggedIn")) {
        showLoading();
    }
    try {
        if (!init.credentials) init.credentials = 'include';
        const url = `${API}${endpoint}`;
        const response = await fetch(url, init);
        if (response.status === 403) {
            mostrarPopupAcessoNegado();
            throw new Error('Acesso negado');
        }
        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error('Resposta inválida do servidor');
        }
        if (!response.ok) {
            throw new Error(data.erro || `HTTP error! status: ${response.status}`);
        }
        return data;
    } finally {
        // Esconder loading apenas se não estiver logado
        if (!sessionStorage.getItem("loggedIn")) {
            hideLoading();
        }
    }
}
function mostrarPopupAcessoNegado() {
    // Remover overlay e modal existentes para evitar conflitos
    const existingOverlay = document.getElementById("overlayAcessoNegado");
    if (existingOverlay) existingOverlay.remove();
    const existingModal = document.getElementById("modalAcessoNegado");
    if (existingModal) existingModal.remove();
    const overlay = document.createElement("div");
    overlay.id = "overlayAcessoNegado";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "999";
    document.body.appendChild(overlay);
    const popup = document.createElement("div");
    popup.id = "modalAcessoNegado";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1001";
    popup.style.borderRadius = "5px";
    popup.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
    popup.innerHTML = `
    <div id="popupDeErro403" style="display: flex; justify-content: space-between; align-items: center;">
      <h3>Acesso Negado</h3>
      <button id="fecharAcessoNegado" style="background: none; border: none; font-size: 16px; cursor: pointer;">❌</button>
    </div>
    <p>Você não tem permissão para esta ação.</p>
    <p>A página será recarregada em 3 segundos...</p>
    <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Recarregar agora</button>
  `;
    document.body.appendChild(popup);
    const fecharBtn = document.getElementById("fecharAcessoNegado");
    if (fecharBtn) {
        fecharBtn.addEventListener("click", () => {
            popup.remove();
            overlay.remove();
        });
    }
    overlay.addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
    setTimeout(() => {
        window.location.reload();
    }, 3000);
}
const conteudo = document.getElementById("conteudo");
function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}
document.addEventListener("DOMContentLoaded", async () => {
    // Inicializar o modo escuro/claro baseado no localStorage
    const savedMode = localStorage.getItem("themeMode") || "bright";
    document.body.classList.remove("bright-mode", "dark-mode");
    document.body.classList.add(savedMode + "-mode");
    if (sessionStorage.getItem("loggedIn")) {
        initMenu();
        try {
            const games = await safeApi('/games');
            if (games.length === 0) {
                const pendencias = await safeApi('/pendencias');
                if (pendencias.length > 0) {
                    mostrarPopupPendencias(pendencias);
                } else {
                    mostrarPopupNovoJogo();
                }
            } else {
                await initGames();
                await carregarUserStatus(); // Carregar status do usuário incluindo isAdmin
                const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
                carregarSecao(ultimaSecao);
            }
        } catch (error) {
            console.error('Error during init after login:', error);
            if (error.message === 'Acesso negado') {
                sessionStorage.removeItem("loggedIn");
                mostrarPopupLogin();
            } else {
                mostrarErro("Erro ao inicializar: " + error.message);
            }
        }
    } else {
        mostrarPopupLogin();
    }
    // Socket.IO - Atualizações em tempo real
    socket.on('connect', () => {
        console.log('[SOCKET.IO] Conectado ao servidor');
        const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
        socket.emit('joinGame', currentGame);
    });
    socket.on('update', async (data) => {
        console.log('[SOCKET.IO] Atualização recebida:', data);
        const currentSecao = localStorage.getItem("ultimaSecao") || "receitas";
        // Recarregar seções afetadas
        if (data.type === 'receitas') {
            if (currentSecao === 'receitas') await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false);
            if (currentSecao === 'farmar') await carregarListaFarmar(document.getElementById("buscaFarmar")?.value || "", document.getElementById("ordemFarmar")?.value || "pendente-desc", document.getElementById("filtroReceitaFarmar")?.value || "", document.getElementById("filtroCategoriaFarmar")?.value || "");
            if (currentSecao === 'roadmap') await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
            if (currentSecao === 'arquivados') await carregarArquivados();
        } else if (data.type === 'estoque') {
            if (currentSecao === 'estoque') await carregarEstoque(document.getElementById("buscaEstoque")?.value || "", document.getElementById("ordemEstoque")?.value || "az");
            if (currentSecao === 'farmar') await carregarListaFarmar(document.getElementById("buscaFarmar")?.value || "", document.getElementById("ordemFarmar")?.value || "pendente-desc", document.getElementById("filtroReceitaFarmar")?.value || "", document.getElementById("filtroCategoriaFarmar")?.value || "");
            if (currentSecao === 'roadmap') await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
        } else if (data.type === 'componentes') {
            if (currentSecao === 'componentes') await carregarComponentesLista(document.getElementById("buscaComponentes")?.value || "", document.getElementById("ordemComponentes")?.value || "az", document.getElementById("filtroCategoriaComponentes")?.value || "");
            if (currentSecao === 'estoque') await carregarEstoque(document.getElementById("buscaEstoque")?.value || "", document.getElementById("ordemEstoque")?.value || "az");
            if (currentSecao === 'farmar') await carregarListaFarmar(document.getElementById("buscaFarmar")?.value || "", document.getElementById("ordemFarmar")?.value || "pendente-desc", document.getElementById("filtroReceitaFarmar")?.value || "", document.getElementById("filtroCategoriaFarmar")?.value || "");
            if (currentSecao === 'roadmap') await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
            if (currentSecao === 'precosComponentes') await montarPrecosComponentes();
        } else if (data.type === 'categorias') {
            if (currentSecao === 'categorias') await carregarCategoriasLista(document.getElementById("buscaCategorias")?.value || "", document.getElementById("ordemCategorias")?.value || "az");
        } else if (data.type === 'log') {
            if (currentSecao === 'estoque') await carregarLog(document.getElementById("buscaLogComponente")?.value || "", document.getElementById("filtroLogUser")?.value || "", document.getElementById("filtroLogData")?.value || "");
        } else if (data.type === 'arquivados') {
            if (currentSecao === 'arquivados') await carregarArquivados();
        } else if (data.type === 'roadmap') {
            if (currentSecao === 'roadmap') await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
        }
    });
    socket.on('disconnect', () => {
        console.log('[SOCKET.IO] Desconectado do servidor');
    });
    socket.on('teamUpdate', async (data) => {
        console.log('[SOCKET.IO] Atualização de time recebida:', data);
        const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
        if (data.game === currentGame) {
            await carregarListaTime();
            await carregarUserStatus(); // Atualiza permissões
            // Recarregar seções que dependem de permissões
            const currentSecao = localStorage.getItem("ultimaSecao") || "receitas";
            await carregarSecao(currentSecao);
        }
    });
});
// Função para mostrar popup de pendências
function mostrarPopupPendencias(pendencias) {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupPendencias";
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
        <h2>Convites Pendentes</h2>
        <p>Você tem convites para times. Aceite um para acessar os jogos compartilhados.</p>
        <ul id="listaPendenciasPopup">
            ${pendencias.map(p => `
                <li style="margin-bottom: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                    Convite de <strong>${p.from}</strong>
                    <div style="margin-top: 8px;">
                        <button onclick="aceitarConvidar('${p.from}'); document.getElementById('popupPendencias').remove(); document.getElementById('overlay').remove();" style="margin-right: 8px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Aceitar</button>
                        <button onclick="recusarConvidar('${p.from}'); refreshPendenciasPopup();" style="padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Recusar</button>
                    </div>
                </li>
            `).join("")}
        </ul>
        <button onclick="mostrarPopupNovoJogo(); document.getElementById('popupPendencias').remove(); document.getElementById('overlay').remove();" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Criar Meu Próprio Jogo</button>
        <button id="btnFecharPendencias" style="margin-top: 10px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Fechar</button>
    `;
    document.body.appendChild(popup);
    document.getElementById("btnFecharPendencias").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
        mostrarPopupNovoJogo();
    });
    // Função auxiliar para refresh da lista após recusar
    window.refreshPendenciasPopup = async () => {
        try {
            const novasPendencias = await safeApi('/pendencias');
            const lista = document.getElementById("listaPendenciasPopup");
            if (novasPendencias.length === 0) {
                lista.innerHTML = '<li>Nenhum convite pendente restante.</li>';
                document.querySelector('button[onclick*="mostrarPopupNovoJogo"]').style.display = 'none';
                document.getElementById("btnFecharPendencias").textContent = 'Criar Novo Jogo';
                document.getElementById("btnFecharPendencias").onclick = () => {
                    popup.remove();
                    overlay.remove();
                    mostrarPopupNovoJogo();
                };
            } else {
                lista.innerHTML = novasPendencias.map(p => `
                    <li style="margin-bottom: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                        Convite de <strong>${p.from}</strong>
                        <div style="margin-top: 8px;">
                            <button onclick="aceitarConvidar('${p.from}'); document.getElementById('popupPendencias').remove(); document.getElementById('overlay').remove();" style="margin-right: 8px; padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Aceitar</button>
                            <button onclick="recusarConvidar('${p.from}'); refreshPendenciasPopup();" style="padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Recusar</button>
                        </div>
                    </li>
                `).join("");
            }
        } catch (error) {
            console.error('Erro ao recarregar pendências:', error);
        }
    };
}
// Função para carregar status do usuário (inclui isFounder, isAdmin, permissões)
async function carregarUserStatus() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const status = await safeApi(`/user-status?game=${encodeURIComponent(currentGame)}`);
        sessionStorage.setItem('isFounder', status.isFounder.toString());
        sessionStorage.setItem('isAdmin', status.isAdmin.toString()); // Salvar isAdmin
        sessionStorage.setItem('effectiveUser', status.effectiveUser);
        // Salvar permissões granulares se existirem
        sessionStorage.setItem('permissao', JSON.stringify(status.permissao || {}));
    } catch (error) {
        console.error('[USER STATUS] Erro ao carregar status:', error);
        sessionStorage.setItem('isFounder', 'false');
        sessionStorage.setItem('isAdmin', 'false');
        sessionStorage.setItem('permissao', JSON.stringify({}));
    }
}
// Função auxiliar para checar se é admin (founder ou co-founder)
function isUserAdmin() {
    return sessionStorage.getItem('isAdmin') === 'true';
}
// Função auxiliar para checar se é founder
function isUserFounder() {
    return sessionStorage.getItem('isFounder') === 'true';
}
// Função para checar permissão granular
function hasPermission(permissionKey) {
    const permissao = JSON.parse(sessionStorage.getItem('permissao') || '{}');
    return isUserAdmin() || permissao[permissionKey] === true;
}
async function initGames() {
    let currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    if (!currentGame) {
        currentGame = "Pax Dei";
        localStorage.setItem("currentGame", currentGame);
    }
    // Validar se o currentGame ainda é acessível
    try {
        const games = await safeApi(`/games`);
        if (!games.includes(currentGame)) {
            currentGame = games.length > 0 ? games[0] : "Pax Dei";
            localStorage.setItem("currentGame", currentGame);
        }
    } catch (error) {
        console.error('[INIT GAMES] Erro ao validar jogos acessíveis:', error);
        // Fallback para o default se houver erro na validação
        currentGame = "Pax Dei";
        localStorage.setItem("currentGame", currentGame);
    }
    // Não renderizar no menu mais; será renderizado no dropdown de Minha Conta
    // Entrar na room do game atual
    socket.emit('joinGame', currentGame);
}
function mostrarPopupNovoJogo() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupNovoJogo";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Novo Jogo</h2>
        <form id="formNovoJogo">
            <input type="text" id="nomeJogo" placeholder="Nome do Jogo" required pattern="[a-zA-Z0-9 ]+">
            <button type="submit">Criar</button>
            <button type="button" id="btnCancelarNovoJogo">Cancelar</button>
            <p id="erroNovoJogo" style="color: red; display: none;"></p>
        </form>
    `;
    document.body.appendChild(popup);
    document.getElementById("formNovoJogo").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = document.getElementById("nomeJogo").value.trim();
        if (!nome) {
            document.getElementById("erroNovoJogo").textContent = "Nome do jogo é obrigatório";
            document.getElementById("erroNovoJogo").style.display = "block";
            return;
        }
        try {
            const data = await safeApi(`/games`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: nome })
            });
            if (data.sucesso) {
                localStorage.setItem("currentGame", nome);
                popup.remove();
                overlay.remove();
                window.location.reload();
            } else {
                document.getElementById("erroNovoJogo").textContent = data.erro || "Erro ao criar jogo";
                document.getElementById("erroNovoJogo").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroNovoJogo").textContent = "Erro ao criar jogo";
            document.getElementById("erroNovoJogo").style.display = "block";
        }
    });
    document.getElementById("btnCancelarNovoJogo").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}
//! FIM CORE.JS