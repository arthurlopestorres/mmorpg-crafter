// index.js
//rodar node servidor.js (no terminal)
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
async function previewFotoPerfil(event) {
    const file = event.target.files[0];  // Correção: 'e' → 'event'
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview = document.getElementById("previewFotoPerfil");
        if (preview) {
            preview.src = ev.target.result;
        }

        // Compressão básica com canvas para preparar o blob (opcional, mas ajuda em consistência)
        const img = new Image();
        img.src = ev.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 100;  // Tamanho fixo para perfil
            canvas.height = 100;
            ctx.drawImage(img, 0, 0, 100, 100);
            canvas.toBlob((blob) => {
                processedFotoBlob = blob;  // Armazena o blob processado para upload
            }, 'image/jpeg', 0.8);  // Qualidade 80%
        };
    };
    reader.readAsDataURL(file);
}
// Função para upload da foto
async function uploadFotoPerfil() {
    if (!processedFotoBlob && !document.getElementById('inputFotoPerfil').files[0]) {
        mostrarErro('Selecione uma imagem primeiro');
        return;
    }

    const formData = new FormData();
    const fileToUpload = processedFotoBlob || document.getElementById('inputFotoPerfil').files[0];
    formData.append('foto', fileToUpload);

    try {
        const data = await safeApi('/upload-foto', {
            method: 'POST',
            body: formData
        });

        if (data.sucesso) {
            // Atualizar preview com cache busting
            const preview = document.getElementById("previewFotoPerfil");
            if (preview) {
                const timestamp = new Date().getTime();
                preview.src = `/data/${encodeURIComponent(sessionStorage.getItem('userEmail') || 'default')}/profile.jpg?${timestamp}`;
            }
            processedFotoBlob = null;  // Limpar após upload
            mostrarSucesso('Foto atualizada com sucesso!');  // Use mostrarErro ou crie um mostrarSucesso se preferir
        } else {
            mostrarErro(data.erro || 'Erro ao fazer upload');
        }
    } catch (error) {
        console.error('Erro no upload:', error);
        mostrarErro('Erro ao fazer upload: ' + error.message);
        if (error.message.includes('404')) {
            // Caso específico de 404: fallback para default
            const preview = document.getElementById("previewFotoPerfil");
            if (preview) preview.src = '/imagens/default-profile.jpg';
        }
    }
}
// Dropdown para "Minha Conta"
async function mostrarPopupMinhaConta() {
    // Remover dropdown existente se houver
    const existingPopup = document.getElementById("popupMinhaConta");
    if (existingPopup) existingPopup.remove();

    const menuItem = document.getElementById("menu-minha-conta");
    const rect = menuItem.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.id = "popupMinhaConta";
    popup.style.position = "fixed";
    popup.style.top = "auto";
    popup.style.bottom = "24px";
    popup.style.left = `${rect.right + 8}px`;
    popup.style.right = "auto";
    popup.style.transform = "none";
    popup.style.backgroundColor = "white";
    popup.style.padding = "0";
    popup.style.zIndex = "1001";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.minWidth = "300px";
    popup.style.maxWidth = "400px";
    popup.style.overflow = "hidden";

    // Buscar dados do usuário do servidor via endpoint /me
    try {
        const usuario = await safeApi(`/me`);
        sessionStorage.setItem('userEmail', usuario.email); // Armazena o email do usuário logado para uso consistente
        const games = await safeApi(`/games`);
        const isDark = document.body.classList.contains('dark-mode');

        // Foto de perfil com lápis de edição
        const fotoPath = usuario.fotoPath ? `${API}${usuario.fotoPath}?${Date.now()}` : null;
        const temFoto = !!fotoPath;

        popup.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 12px 0; font-size: 1.1rem;">Minha Conta</h3>
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 12px; position: relative;">
                    <div id="fotoPerfilContainer" style="position: relative; width: 150px; height: 150px; border-radius: 50%; overflow: hidden; border: 2px solid #e2e8f0; margin-bottom: 12px;">
                        <img id="fotoPerfilImg" src="${fotoPath || ''}" alt="Foto de Perfil" style="width: 100%; height: 100%; object-fit: cover; display: ${temFoto ? 'block' : 'none'};">
                        <div id="editPencilOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4);
        `;
        document.body.appendChild(popup); // Nota: O innerHTML está truncado no prompt original, mas assumi que continua como antes. Não alterei o resto do HTML.
    } catch (error) {
        console.error('Erro ao carregar dados da conta:', error);
    }
}
function abrirPopupTrocarFoto() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupTrocarFoto";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.zIndex = "1001";
    popup.style.maxWidth = "400px";
    popup.style.width = "90%";
    popup.innerHTML = `
        <h3 style="margin: 0 0 16px; font-size: 1.1rem;">Trocar Foto de Perfil</h3>
        <div style="text-align: center; margin-bottom: 16px;">
            <img id="previewTrocarFoto" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; display: none; margin-bottom: 12px;">
            <input type="file" id="inputTrocarFoto" accept="image/*" style="margin-bottom: 12px;">
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="btnCancelarTrocar" style="padding: 8px 16px; background: #e2e8f0; color: #2d3748; border: none; border-radius: var(--border-radius-sm); cursor: pointer;">Cancelar</button>
            <button id="btnConfirmarTrocar" style="padding: 8px 16px; background: var(--primary-gradient); color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer;">Confirmar</button>
        </div>
        <p id="erroTrocarFoto" style="color: red; font-size: 0.85rem; margin-top: 8px; display: none;"></p>
    `;
    document.body.appendChild(popup);

    const inputTrocar = document.getElementById("inputTrocarFoto");
    const previewTrocar = document.getElementById("previewTrocarFoto");
    let processedFotoBlob = null; // Local para este popup, para evitar global

    inputTrocar.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                previewTrocar.src = ev.target.result;
                previewTrocar.style.display = "block";

                // Compressão para garantir tamanho < 50KB
                const img = new Image();
                img.src = ev.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 100;
                    canvas.height = 100;
                    ctx.drawImage(img, 0, 0, 100, 100);
                    canvas.toBlob((blob) => {
                        processedFotoBlob = blob;
                    }, 'image/jpeg', 0.8);
                };
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById("btnCancelarTrocar").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });

    document.getElementById("btnConfirmarTrocar").addEventListener("click", async () => {
        const file = inputTrocar.files[0];
        if (!file) {
            document.getElementById("erroTrocarFoto").textContent = "Selecione uma imagem";
            document.getElementById("erroTrocarFoto").style.display = "block";
            return;
        }

        const formData = new FormData();
        const fileToUpload = processedFotoBlob || file;
        formData.append("foto", fileToUpload);

        try {
            const data = await safeApi('/upload-foto', {
                method: 'POST',
                body: formData
            });

            if (data.sucesso) {
                // Atualizar preview com cache busting
                const preview = document.getElementById("previewFotoPerfil");
                if (preview) {
                    const timestamp = new Date().getTime();
                    preview.src = `/data/${encodeURIComponent(sessionStorage.getItem('userEmail') || 'default')}/profile.jpg?${timestamp}`;
                }
                processedFotoBlob = null;  // Limpar após upload
                mostrarSucesso('Foto atualizada com sucesso!');  // Alterado para mostrarSucesso
            } else {
                document.getElementById("erroTrocarFoto").textContent = data.erro || 'Erro ao fazer upload';
                document.getElementById("erroTrocarFoto").style.display = "block";
            }
        } catch (error) {
            console.error('Erro no upload:', error);
            document.getElementById("erroTrocarFoto").textContent = 'Erro ao fazer upload: ' + error.message;
            document.getElementById("erroTrocarFoto").style.display = "block";
            if (error.message.includes('404')) {
                previewTrocar.src = '/imagens/default-profile.jpg';
            }
        }
    });
}
// Dropdown para "Minha Conta"
async function mostrarPopupMinhaConta() {
    // Remover dropdown existente se houver
    const existingPopup = document.getElementById("popupMinhaConta");
    if (existingPopup) existingPopup.remove();

    const menuItem = document.getElementById("menu-minha-conta");
    const rect = menuItem.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.id = "popupMinhaConta";
    popup.style.position = "fixed";
    popup.style.top = "auto";
    popup.style.bottom = "24px";
    popup.style.left = `${rect.right + 8}px`;
    popup.style.right = "auto";
    popup.style.transform = "none";
    popup.style.backgroundColor = "white";
    popup.style.padding = "0";
    popup.style.zIndex = "1001";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.minWidth = "300px";
    popup.style.maxWidth = "400px";
    popup.style.overflow = "hidden";

    // Buscar dados do usuário do servidor via endpoint /me
    try {
        const usuario = await safeApi(`/me`);
        sessionStorage.setItem('userEmail', usuario.email); // Armazena o email do usuário logado para uso consistente
        const games = await safeApi(`/games`);
        const isDark = document.body.classList.contains('dark-mode');

        // Foto de perfil com lápis de edição
        const fotoPath = usuario.fotoPath ? `${API}${usuario.fotoPath}?${Date.now()}` : null;
        const temFoto = !!fotoPath;

        popup.innerHTML = `
            <div style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 12px 0; font-size: 1.1rem;">Minha Conta</h3>
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 12px; position: relative;">
                    <div id="fotoPerfilContainer" style="position: relative; width: 150px; height: 150px; border-radius: 50%; overflow: hidden; border: 2px solid #e2e8f0; margin-bottom: 12px;">
                        <img id="fotoPerfilImg" src="${fotoPath || ''}" alt="Foto de Perfil" style="width: 100%; height: 100%; object-fit: cover; display: ${temFoto ? 'block' : 'none'};">
                        <div id="editPencilOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4);
        `;
        document.body.appendChild(popup); // Nota: O innerHTML está truncado no prompt original, mas assumi que continua como antes. Não alterei o resto do HTML.
    } catch (error) {
        console.error('Erro ao carregar dados da conta:', error);
    }
}
function abrirPopupTrocarFoto() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupTrocarFoto";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.zIndex = "1001";
    popup.style.maxWidth = "400px";
    popup.style.width = "90%";
    popup.innerHTML = `
        <h3 style="margin: 0 0 16px; font-size: 1.1rem;">Trocar Foto de Perfil</h3>
        <div style="text-align: center; margin-bottom: 16px;">
            <img id="previewTrocarFoto" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; display: none; margin-bottom: 12px;">
            <input type="file" id="inputTrocarFoto" accept="image/*" style="margin-bottom: 12px;">
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="btnCancelarTrocar" style="padding: 8px 16px; background: #e2e8f0; color: #2d3748; border: none; border-radius: var(--border-radius-sm); cursor: pointer;">Cancelar</button>
            <button id="btnConfirmarTrocar" style="padding: 8px 16px; background: var(--primary-gradient); color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer;">Confirmar</button>
        </div>
        <p id="erroTrocarFoto" style="color: red; font-size: 0.85rem; margin-top: 8px; display: none;"></p>
    `;
    document.body.appendChild(popup);

    const inputTrocar = document.getElementById("inputTrocarFoto");
    const previewTrocar = document.getElementById("previewTrocarFoto");
    let processedFotoBlob = null; // Local para este popup, para evitar global

    inputTrocar.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                previewTrocar.src = ev.target.result;
                previewTrocar.style.display = "block";

                // Compressão para garantir tamanho < 50KB
                const img = new Image();
                img.src = ev.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 100;
                    canvas.height = 100;
                    ctx.drawImage(img, 0, 0, 100, 100);
                    canvas.toBlob((blob) => {
                        processedFotoBlob = blob;
                    }, 'image/jpeg', 0.8);
                };
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById("btnCancelarTrocar").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });

    document.getElementById("btnConfirmarTrocar").addEventListener("click", async () => {
        const file = inputTrocar.files[0];
        if (!file) {
            document.getElementById("erroTrocarFoto").textContent = "Selecione uma imagem";
            document.getElementById("erroTrocarFoto").style.display = "block";
            return;
        }

        const formData = new FormData();
        const fileToUpload = processedFotoBlob || file;
        formData.append("foto", fileToUpload, 'profile.jpg'); // Adiciona filename para blobs

        try {
            const response = await fetch(`${API}/upload-foto`, {
                method: "POST",
                body: formData,
                credentials: "include"
            });
            const data = await response.json();

            if (data.sucesso) {
                // Atualizar foto no popup principal
                const imgPerfil = document.querySelector("#fotoPerfilImg");
                if (imgPerfil) {
                    imgPerfil.src = `${API}/data/${encodeURIComponent(sessionStorage.getItem('userEmail'))}/profile.jpg?${Date.now()}`;
                }
                popup.remove();
                overlay.remove();
            } else {
                document.getElementById("erroTrocarFoto").textContent = data.erro || 'Erro ao fazer upload';
                document.getElementById("erroTrocarFoto").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroTrocarFoto").textContent = 'Erro ao fazer upload: ' + error.message;
            document.getElementById("erroTrocarFoto").style.display = "block";
        }
    });
}

// Dropdown para "Minha Conta"
async function mostrarPopupMinhaConta() {
    // Remover dropdown existente se houver
    const existingPopup = document.getElementById("popupMinhaConta");
    if (existingPopup) existingPopup.remove();

    const menuItem = document.getElementById("menu-minha-conta");
    const rect = menuItem.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.id = "popupMinhaConta";
    popup.style.position = "fixed";
    popup.style.top = "auto";
    popup.style.bottom = "24px";
    popup.style.left = `${rect.right + 8}px`;
    popup.style.right = "auto";
    popup.style.transform = "none";
    popup.style.backgroundColor = "white";
    popup.style.padding = "0";
    popup.style.zIndex = "1001";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.minWidth = "300px";
    popup.style.maxWidth = "400px";
    popup.style.overflow = "hidden";

    // Buscar dados do usuário do servidor via endpoint /me
    try {
        const usuario = await safeApi(`/me`);
        const games = await safeApi(`/games`);
        const isDark = document.body.classList.contains('dark-mode');

        // Foto de perfil com lápis de edição
        const fotoPath = usuario.fotoPath ? `${API}${usuario.fotoPath}?${Date.now()}` : null;
        const temFoto = !!fotoPath;

        popup.innerHTML = `
            <div class="minhaContaResumo"style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
                <div class="minhaContaResumo-tituloEimg">
                    <h3 style="margin: 0 0 12px 0; font-size: 1.1rem;">Minha Conta</h3>
                    <div style="width: 50px; display: flex; flex-direction: column; align-items: center; margin-bottom: 12px; position: relative;">
                        <div id="fotoPerfilContainer" style="position: relative; width: 150px; height: 150px; border-radius: 50%; overflow: hidden; border: 2px solid #e2e8f0; margin-bottom: 12px;">
                            <img id="fotoPerfilImg" src="${fotoPath || ''}" alt="Foto de Perfil" style="width: 100%; height: 100%; object-fit: cover; display: ${temFoto ? 'block' : 'none'};">
                            <div id="editPencilOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: ${temFoto ? 'none' : 'none'}; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.3s; cursor: pointer; border-radius: 50%;">
                                <span style="color: white; font-size: 10px;">Edit</span>
                            </div>
                        </div>
                        <div id="uploadFotoContainer" style="width: 100%; text-align: center; display: ${temFoto ? 'none' : 'block'};">
                            <input type="file" id="inputFotoPerfil" accept="image/*" style="margin-bottom: 8px;">
                            <img id="previewFotoPerfil" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; display: none; margin: 8px 0;">
                            <button id="btnUploadFoto" style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Salvar Foto</button>
                            <p style="display: none; font-size: 0.8rem; color: #666; margin-top: 4px;">Máx 150x150px, 50KB</p>
                        </div>
                    </div>
                </div>
                <div class="minhaConta-nomeWrapper" style="margin: 0 0 8px 0; font-size: 0.9rem;">
                    <strong>Nome:</strong> 
                    <input type="text" id="editNome" value="#${usuario.id}${usuario.nome}">
                    <span class="lapisEditarNome"></span>
                    <button id="btnSalvarNome" style="margin-left: 8px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Salvar</button>
                </div>
                <p style="margin: 0 0 16px 0; font-size: 0.9rem;"><strong>Email:</strong> ${usuario.email}</p>
            </div>
            <div style="padding: 16px 20px;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 0.9rem;">Jogo Atual</label>
                    <select id="gameSelectorDropdown">
                        ${games.map(g => `<option value="${g}" ${g === localStorage.getItem("currentGame") ? 'selected' : ''}>${g}</option>`).join("")}
                    </select>
                </div>
                <button id="btnNovoJogoDropdown" style="width: 100%; margin-bottom: 12px; padding: 10px; background: var(--primary-gradient); color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Novo Jogo</button>
                <button id="btnMudarSenha" style="width: 100%; margin-bottom: 12px; padding: 10px; background: #e2e8f0; color: #2d3748; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Mudar Senha</button>
                <label style="display: flex; align-items: center; margin-bottom: 12px;">
                    <input type="checkbox" id="toggle2FA" ${usuario.doisFatores ? 'checked' : ''} style="margin-right: 8px;">
                    Ativar Autenticação de Dois Fatores
                </label>
            </div>
            <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 12px 0; font-size: 1rem;">Aparência</h4>
                <button id="themeToggleDropdown" style="width: 100%; padding: 10px; background: ${isDark ? '#e2e8f0' : 'var(--primary-gradient)'}; color: ${isDark ? '#2d3748' : 'white'}; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500; transition: all var(--transition-fast);">${isDark ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}</button>
            </div>
            <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0;">
                <button id="btnLogout" style="width: 100%; margin-bottom: 12px; padding: 10px; background: #f56565; color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Logout</button>
            </div>
        `;
    } catch (error) {
        console.error('[MINHA CONTA] Erro ao carregar dados:', error);
        popup.innerHTML = `
            <div style="padding: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 1.1rem;">Minha Conta</h3>
                <p style="margin: 0; color: #f56565;">Erro ao carregar dados: ${error.message}</p>
                <button id="btnLogout" style="width: 100%; margin-top: 16px; padding: 10px; background: #f56565; color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Logout</button>
            </div>
        `;
    }

    document.body.appendChild(popup);

    // === Eventos de Foto ===
    const inputFoto = document.getElementById("inputFotoPerfil");
    const btnUploadFoto = document.getElementById("btnUploadFoto");
    if (inputFoto && btnUploadFoto) {
        inputFoto.addEventListener("change", previewFotoPerfil);
        btnUploadFoto.addEventListener("click", uploadFotoPerfil);
    }

    // Hover no lápis
    const container = document.getElementById("fotoPerfilContainer");
    const pencil = document.getElementById("editPencilOverlay");
    if (container && pencil) {
        container.addEventListener("mouseenter", () => {
            pencil.style.opacity = "1";
            pencil.style.display = "flex";
        });
        container.addEventListener("mouseleave", () => {
            pencil.style.opacity = "0";
        });
        pencil.addEventListener("click", (e) => {
            e.stopPropagation();
            abrirPopupTrocarFoto();
        });
    }

    // Fechar dropdown ao clicar fora
    const fecharDropdown = (e) => {
        if (!popup.contains(e.target) && e.target.id !== 'menu-minha-conta') {
            popup.remove();
            document.removeEventListener('click', fecharDropdown);
        }
    };
    document.addEventListener('click', fecharDropdown);

    // === Eventos existentes (mantidos 100%) ===
    const btnMudarSenha = document.getElementById("btnMudarSenha");
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener("click", () => {
            popup.remove();
            mostrarPopupMudarSenha();
        });
    }

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            sessionStorage.removeItem("loggedIn");
            sessionStorage.removeItem("userEmail");
            popup.remove();
            window.location.reload();
        });
    }

    const gameSelector = document.getElementById("gameSelectorDropdown");
    if (gameSelector) {
        gameSelector.addEventListener("change", async (e) => {
            const newGame = e.target.value;
            localStorage.setItem("currentGame", newGame);
            await carregarUserStatus();
            const currentSecao = localStorage.getItem("ultimaSecao") || "receitas";
            await carregarSecao(currentSecao);
            const games = await safeApi(`/games`);
            gameSelector.innerHTML = games.map(g => `<option value="${g}" ${g === newGame ? 'selected' : ''}>${g}</option>`).join("");
            socket.emit('joinGame', newGame);
        });
    }

    const btnNovoJogo = document.getElementById("btnNovoJogoDropdown");
    if (btnNovoJogo) {
        btnNovoJogo.addEventListener("click", () => {
            popup.remove();
            mostrarPopupNovoJogo();
        });
    }

    const themeToggle = document.getElementById("themeToggleDropdown");
    if (themeToggle) {
        themeToggle.addEventListener("click", (e) => {
            const currentMode = document.body.classList.contains('dark-mode') ? "dark" : "bright";
            const newMode = currentMode === "dark" ? "bright" : "dark";
            document.body.classList.remove("bright-mode", "dark-mode");
            document.body.classList.add(newMode + "-mode");
            localStorage.setItem("themeMode", newMode);
            popup.remove();
            document.removeEventListener("click", fecharDropdown);
        });
    }

    const toggle2FA = document.getElementById("toggle2FA");
    if (toggle2FA) {
        toggle2FA.addEventListener("change", async () => {
            const enable = toggle2FA.checked;
            try {
                const data = await safeApi('/toggle-2fa', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enable })
                });
                if (!data.sucesso) {
                    alert(data.erro || 'Erro ao atualizar 2FA');
                    toggle2FA.checked = !enable;
                }
            } catch (error) {
                alert('Erro ao atualizar 2FA: ' + error.message);
                toggle2FA.checked = !enable;
            }
        });
    }

    const btnSalvarNome = document.getElementById("btnSalvarNome");
    if (btnSalvarNome) {
        btnSalvarNome.addEventListener("click", async () => {
            const editNomeInput = document.getElementById("editNome");
            const newName = editNomeInput.value.trim().replace(/^#\d+/, '');
            if (!newName || !/^[a-zA-Z0-9 ]+$/.test(newName) || newName.length > 50) {
                mostrarErro('Nome inválido: deve conter apenas letras, números e espaços, com até 50 caracteres.');
                return;
            }
            try {
                const data = await safeApi('/update-name', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newName })
                });
                if (data.sucesso) {
                    const updatedUser = await safeApi(`/me`);
                    editNomeInput.value = `#${updatedUser.id}${updatedUser.nome}`;
                    alert('Nome atualizado com sucesso!');
                } else {
                    mostrarErro(data.erro || 'Erro ao atualizar nome');
                }
            } catch (error) {
                mostrarErro('Erro ao atualizar nome: ' + error.message);
            }
        });
    }
}
function loadProfilePhotoWithFallback() {
    const preview = document.getElementById("previewFotoPerfil");
    if (!preview) return;

    const userEmail = sessionStorage.getItem('userEmail') || 'default';  // Ajuste se o email estiver em outro lugar
    const timestamp = new Date().getTime();
    const imgUrl = `/data/${encodeURIComponent(userEmail)}/profile.jpg?${timestamp}`;

    preview.src = imgUrl;
    preview.onerror = () => {
        preview.src = '/imagens/default-profile.jpg';  // Fallback se 404
    };
}
// Função para pré-visualizar a imagem selecionada
function previewImage(event, previewElementId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(previewElementId);
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}
function abrirPopupEditarFoto() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupEditarFoto";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Editar Foto de Perfil</h2>
        <form id="formEditarFoto">
            <input type="file" id="inputFotoEditar" accept="image/*" style="margin-bottom: 10px;">
            <img id="previewFotoEditar" style="max-width: 100px; max-height: 100px; border-radius: 50%; display: none; margin-bottom: 10px;">
            <button type="submit" id="btnUploadFotoEditar">Salvar Foto</button>
            <button type="button" id="btnCancelarEditarFoto">Cancelar</button>
            <p id="erroEditarFoto" style="color: red; display: none;"></p>
        </form>
    `;
    document.body.appendChild(popup);
    loadProfilePhotoWithFallback();
    // Evento para pré-visualização no popup de edição
    document.getElementById("inputFotoEditar").addEventListener("change", (e) => previewImage(e, "previewFotoEditar"));

    // Evento de submit para upload (reutiliza a lógica de handleUploadFoto, mas atualiza o popup principal após sucesso)
    document.getElementById("formEditarFoto").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("inputFotoEditar");
        if (!fileInput.files[0]) {
            const erroEl = document.getElementById("erroEditarFoto");
            if (erroEl) {
                erroEl.textContent = "Selecione uma imagem";
                erroEl.style.display = "block";
            }
            return;
        }
        const formData = new FormData();
        formData.append('foto', fileInput.files[0]);
        try {
            const response = await fetch(`${API}/upload-foto`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await response.json();
            if (data.sucesso) {
                // Fechar popup de edição
                popup.remove();
                overlay.remove();
                // Atualizar a foto no popup principal "Minha Conta" (se aberto)
                const profilePic = document.getElementById("profilePic");
                if (profilePic) {
                    profilePic.src = `${API}/data/${encodeURIComponent(sessionStorage.getItem('effectiveUser') || sessionStorage.getItem('user'))}/profile.jpg?${new Date().getTime()}`;
                    profilePic.style.display = 'block';
                }
                // Atualizar visibilidade no popup principal
                const uploadContainer = document.getElementById("uploadFotoContainer");
                if (uploadContainer) uploadContainer.style.display = 'none';
                const editPencil = document.getElementById("editPencil");
                if (editPencil) editPencil.style.display = 'block';
            } else {
                const erroEl = document.getElementById("erroEditarFoto");
                if (erroEl) {
                    erroEl.textContent = data.erro || "Erro ao fazer upload";
                    erroEl.style.display = "block";
                }
            }
        } catch (error) {
            const erroEl = document.getElementById("erroEditarFoto");
            if (erroEl) {
                erroEl.textContent = "Erro ao fazer upload";
                erroEl.style.display = "block";
            }
        }
    });

    document.getElementById("btnCancelarEditarFoto").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}
// Função para comprimir e redimensionar imagem (cliente-side)
async function compressAndResizeImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 150;
            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            // Comprimir para JPEG com qualidade inicial 0.7, ajustando se necessário para <50KB
            canvas.toBlob((blob) => {
                if (blob.size > 50 * 1024) {
                    // Se maior que 50KB, reduzir qualidade
                    canvas.toBlob((reducedBlob) => {
                        resolve(reducedBlob);
                    }, 'image/jpeg', 0.5); // Qualidade reduzida
                } else {
                    resolve(blob);
                }
            }, 'image/jpeg', 0.7); // Qualidade inicial
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}
// Popup para Mudar Senha
async function mostrarPopupMudarSenha() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupMudarSenha";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Mudar Senha</h2>
        <form id="formMudarSenha">
            <input type="password" id="senhaAtual" placeholder="Senha Atual" required>
            <p id="erroSenhaAtual" style="color: red; display: none;">Senha atual incorreta</p>
            <input type="password" id="novaSenha" placeholder="Nova Senha" required>
            <p id="erroNovaSenha" style="color: red; display: none;">Nova senha é obrigatória</p>
            <input type="password" id="confirmaNovaSenha" placeholder="Confirmar Nova Senha" required>
            <p id="erroConfirmaSenha" style="color: red; display: none;">Senhas não coincidem</p>
            <button type="submit">Salvar</button>
            <button type="button" id="btnCancelarMudarSenha">Cancelar</button>
        </form>
    `;
    document.body.appendChild(popup);
    document.getElementById("formMudarSenha").addEventListener("submit", async (e) => {
        e.preventDefault();
        const senhaAtual = document.getElementById("senhaAtual").value;
        const novaSenha = document.getElementById("novaSenha").value;
        const confirmaNovaSenha = document.getElementById("confirmaNovaSenha").value;
        // Resetar erros e bordas
        document.querySelectorAll("#formMudarSenha input").forEach(input => input.style.border = "1px solid #ccc");
        document.querySelectorAll("#formMudarSenha p").forEach(p => p.style.display = "none");
        let hasError = false;
        if (!senhaAtual) {
            document.getElementById("erroSenhaAtual").textContent = "Senha atual é obrigatória";
            document.getElementById("erroSenhaAtual").style.display = "block";
            document.getElementById("senhaAtual").style.border = "1px solid red";
            hasError = true;
        }
        if (!novaSenha) {
            document.getElementById("erroNovaSenha").textContent = "Nova senha é obrigatória";
            document.getElementById("erroNovaSenha").style.display = "block";
            document.getElementById("novaSenha").style.border = "1px solid red";
            hasError = true;
        }
        if (novaSenha !== confirmaNovaSenha) {
            document.getElementById("erroConfirmaSenha").textContent = "Senhas não coincidem";
            document.getElementById("erroConfirmaSenha").style.display = "block";
            document.getElementById("novaSenha").style.border = "1px solid red";
            document.getElementById("confirmaNovaSenha").style.border = "1px solid red";
            hasError = true;
        }
        if (hasError) return;
        try {
            const data = await safeApi(`/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldPassword: senhaAtual, newPassword: novaSenha })
            });
            if (data.sucesso) {
                alert("Senha alterada com sucesso!");
                popup.remove();
                overlay.remove();
            } else {
                document.getElementById("erroSenhaAtual").textContent = data.erro || "Erro ao mudar senha";
                document.getElementById("erroSenhaAtual").style.display = "block";
                document.getElementById("senhaAtual").style.border = "1px solid red";
            }
        } catch (error) {
            document.getElementById("erroSenhaAtual").textContent = "Erro ao mudar senha";
            document.getElementById("erroSenhaAtual").style.display = "block";
            document.getElementById("senhaAtual").style.border = "1px solid red";
        }
    });
    document.getElementById("btnCancelarMudarSenha").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
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
function initMenu() {
    const menu = document.querySelector(".menu");
    if (!menu) return;
    menu.innerHTML = ''; // Limpar menu existente para reordenar
    // Itens principais fora do dropdown
    const mainSections = [
        { section: "home", text: "Bem vindo!" },
        { section: "time", text: "Time" }
    ];
    let menuItemsCount = 0
    mainSections.forEach(sec => {
        menuItemsCount++
        const li = document.createElement("li");
        li.dataset.section = sec.section;
        li.textContent = sec.text;
        li.id = `menuItem${menuItemsCount}`
        li.addEventListener("click", () => carregarSecao(sec.section));
        menu.appendChild(li);
    });
    // Item "Crafting" com submenu inline
    const liCrafting = document.createElement("li");
    liCrafting.id = "menu-crafting";
    liCrafting.classList.add("menu-item-with-submenu"); // Nova classe para estilização
    const craftingToggle = document.createElement("span");
    const craftingToggleArrow = document.createElement("span");
    craftingToggle.innerHTML = "Crafting"; // Setinha inicial (fechado)
    craftingToggleArrow.classList.add('menu-crafting-SpanArrow')
    craftingToggleArrow.innerHTML = "▼"
    liCrafting.appendChild(craftingToggle);
    liCrafting.appendChild(craftingToggleArrow);
    liCrafting.addEventListener("click", toggleCraftingSubmenu); // Toggle ao clicar
    menu.appendChild(liCrafting);
    // Adicionar o submenu inline (inicialmente escondido)
    const submenuUl = document.createElement("ul");
    submenuUl.id = "submenu-crafting-inline";
    submenuUl.className = "submenu-crafting-inline";
    submenuUl.style.display = "none"; // Inicialmente fechado
    const craftingSections = [
        { section: "categorias", text: "Categorias" },
        // { section: "componentes", text: "Componentes" },
        { section: "estoque", text: "Componentes e Estoque" },
        { section: "receitas", text: "Receitas" },
        { section: "farmar", text: "Farmar Receitas Favoritas" },
        { section: "roadmap", text: "Roadmap" },
        { section: "arquivados", text: "Arquivados" }
    ];
    submenuUl.innerHTML = craftingSections.map(sec => `
        <li onclick="carregarSecao('${sec.section}')">${sec.text}</li>
    `).join("");
    // Inserir submenu logo após o liCrafting
    liCrafting.insertAdjacentElement('afterend', submenuUl);
    // Checar localStorage para abrir submenu se salvo como aberto
    if (localStorage.getItem("craftingMenuOpen") === "true") {
        toggleCraftingSubmenu(); // Expande automaticamente
    }
    // Adicionar item "Minha Conta" no final do menu
    const liMinhaConta = document.createElement("li");
    liMinhaConta.id = "menu-minha-conta";
    liMinhaConta.textContent = "Minha Conta";
    liMinhaConta.style.marginTop = "auto";
    liMinhaConta.addEventListener("click", mostrarPopupMinhaConta);
    menu.appendChild(liMinhaConta);
}
// Nova função para toggle do submenu inline de Crafting
function toggleCraftingSubmenu() {
    const submenu = document.getElementById("submenu-crafting-inline");
    const toggleSpan = document.querySelector("#menu-crafting span");
    const toggleSpanArrow = document.querySelector('#menu-crafting .menu-crafting-SpanArrow')
    const isOpen = submenu.style.display === "block";
    if (isOpen) {
        submenu.style.display = "none";
        toggleSpan.innerHTML = "Crafting"; // Fechado
        toggleSpanArrow.innerHTML = "▼" // Fechado
        localStorage.setItem("craftingMenuOpen", "false");
    } else {
        submenu.style.display = "block";
        toggleSpan.innerHTML = "Crafting"; // Aberto
        toggleSpanArrow.innerHTML = "▲" // Aberto
        localStorage.setItem("craftingMenuOpen", "true");
    }
}
const botaoDeMinimizar = document.querySelector('#botaoDeMinimizarMenu')
function minimizarOmenu() {
    const menuLateral = document.querySelector('aside')
    const itensDoMenu = document.querySelectorAll('.menu li')
    let listaDeClasseDoMenu = menuLateral.classList;
    if (listaDeClasseDoMenu.length < 1) {
        menuLateral.classList.add('menulateralMinimizado')
        botaoDeMinimizar.style = 'left: 80px!important;'
        //maximizar:
        botaoDeMinimizar.innerHTML = '▶'
        itensDoMenu.forEach(item => item.style.display = "none")
    } else {
        menuLateral.classList.remove('menulateralMinimizado')
        botaoDeMinimizar.style = 'left: 280px!important;'
        //minimizar:
        botaoDeMinimizar.innerHTML = '◀';
        itensDoMenu.forEach(item => item.style.removeProperty('display'))
    }
}
botaoDeMinimizar.addEventListener('click', minimizarOmenu)
/* ------------------ Funções de Login e Cadastro ------------------ */
function criarOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "999";
    document.body.appendChild(overlay);
    return overlay;
}
function mostrarPopupLogin() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupLogin";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Login</h2>
        <form id="formLogin">
            <input type="email" id="emailLogin" placeholder="Email" required>
            <input type="password" id="senhaLogin" placeholder="Senha" required>
            <div id="recaptcha-login" class="g-recaptcha"></div>
            <button type="submit">Entrar</button>
            <button type="button" id="btnCadastrar">Cadastrar-se</button>
            <p id="erroLogin" style="color: red; display: none;">Usuário ou senha não encontrados</p>
        </form>
        <div id="otpSectionLogin" style="display: none;">
            <p>Código de verificação enviado para o seu email.</p>
            <input type="text" id="otpLogin" placeholder="Código de 6 dígitos" required maxlength="6">
            <button id="btnVerifyOtpLogin">Confirmar</button>
            <p id="erroOtpLogin" style="color: red; display: none;">Código inválido</p>
        </div>
    `;
    document.body.appendChild(popup);
    // Carregar reCAPTCHA script se não carregado
    if (!window.grecaptcha) {
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }
    // Renderizar reCAPTCHA explicitamente
    let recaptchaWidgetLogin;
    const renderRecaptchaLogin = () => {
        if (window.grecaptcha && document.getElementById('recaptcha-login')) {
            recaptchaWidgetLogin = grecaptcha.render('recaptcha-login', {
                'sitekey': RECAPTCHA_SITE_KEY
            });
        } else {
            setTimeout(renderRecaptchaLogin, 100);
        }
    };
    renderRecaptchaLogin();
    document.getElementById("formLogin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = grecaptcha.getResponse(recaptchaWidgetLogin);
        if (!token) {
            document.getElementById("erroLogin").textContent = "Por favor, valide o reCAPTCHA.";
            document.getElementById("erroLogin").style.display = "block";
            return;
        }
        const email = document.getElementById("emailLogin").value;
        const senha = document.getElementById("senhaLogin").value;
        try {
            const data = await safeApi(`/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha, recaptchaToken: token })
            });
            if (data.sucesso === 'otp_sent') {
                // Mostrar seção OTP
                document.getElementById("formLogin").style.display = "none";
                document.getElementById("otpSectionLogin").style.display = "block";
                // Limpar erros
                document.getElementById("erroLogin").style.display = "none";
            } else if (data.sucesso) {
                sessionStorage.setItem("loggedIn", "true");
                sessionStorage.setItem("userEmail", email);
                popup.remove();
                overlay.remove();
                initMenu();
                await initGames();
                await carregarUserStatus(); // Carregar status após login
                const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
                carregarSecao(ultimaSecao);
            } else {
                document.getElementById("erroLogin").textContent = data.erro || "Usuário ou senha não encontrados";
                document.getElementById("erroLogin").style.display = "block";
                document.getElementById("emailLogin").style.border = "1px solid red";
                document.getElementById("senhaLogin").style.border = "1px solid red";
                grecaptcha.reset(recaptchaWidgetLogin); // Reset reCAPTCHA em caso de erro
            }
        } catch (error) {
            document.getElementById("erroLogin").textContent = "Erro ao fazer login";
            document.getElementById("erroLogin").style.display = "block";
            document.getElementById("emailLogin").style.border = "1px solid red";
            document.getElementById("senhaLogin").style.border = "1px solid red";
            grecaptcha.reset(recaptchaWidgetLogin);
        }
    });
    // Listener para verificar OTP
    document.getElementById("btnVerifyOtpLogin").addEventListener("click", async () => {
        const email = document.getElementById("emailLogin").value;
        const code = document.getElementById("otpLogin").value.trim();
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            document.getElementById("erroOtpLogin").textContent = "Código deve ser 6 dígitos numéricos";
            document.getElementById("erroOtpLogin").style.display = "block";
            return;
        }
        try {
            const data = await safeApi(`/verify-otp-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code })
            });
            if (data.sucesso) {
                sessionStorage.setItem("loggedIn", "true");
                sessionStorage.setItem("userEmail", email);
                popup.remove();
                overlay.remove();
                initMenu();
                await initGames();
                await carregarUserStatus(); // Carregar status após login
                const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
                carregarSecao(ultimaSecao);
            } else {
                document.getElementById("erroOtpLogin").textContent = data.erro || "Código inválido";
                document.getElementById("erroOtpLogin").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroOtpLogin").textContent = "Erro ao verificar código";
            document.getElementById("erroOtpLogin").style.display = "block";
        }
    });
    document.getElementById("btnCadastrar").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
        mostrarPopupCadastro();
    });
}
function mostrarPopupCadastro() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupCadastro";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Cadastro</h2>
        <form id="formCadastro">
            <input type="text" id="nomeCadastro" placeholder="Nome" required>
            <input type="email" id="emailCadastro" placeholder="Email" required>
            <input type="password" id="senhaCadastro" placeholder="Senha" required>
            <input type="password" id="confirmaSenha" placeholder="Confirme sua senha" required>
            <div id="recaptcha-cadastro" class="g-recaptcha"></div>
            <button type="submit">Enviar solicitação de acesso</button>
            <button type="button" id="btnVoltarLogin">Voltar para Login</button>
            <p id="erroCadastro" style="color: red; display: none;"></p>
            <p id="mensagemCadastro" style="display: none;">Solicitação enviada</p>
            <div id="voltarConfirmacao" style="display: none;">
                <button type="button" id="btnVoltarLoginConfirmacao">Voltar para Login</button>
            </div>
        </form>
        <div id="otpSectionCadastro" style="display: none;">
            <p>Código de verificação enviado para o seu email.</p>
            <input type="text" id="otpCadastro" placeholder="Código de 6 dígitos" required maxlength="6">
            <button id="btnVerifyOtpCadastro">Confirmar</button>
            <p id="erroOtpCadastro" style="color: red; display: none;">Código inválido</p>
        </div>
    `;
    document.body.appendChild(popup);
    // Carregar reCAPTCHA script se não carregado
    if (!window.grecaptcha) {
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }
    // Renderizar reCAPTCHA explicitamente
    let recaptchaWidgetCadastro;
    const renderRecaptchaCadastro = () => {
        if (window.grecaptcha && document.getElementById('recaptcha-cadastro')) {
            recaptchaWidgetCadastro = grecaptcha.render('recaptcha-cadastro', {
                'sitekey': RECAPTCHA_SITE_KEY
            });
        } else {
            setTimeout(renderRecaptchaCadastro, 100);
        }
    };
    renderRecaptchaCadastro();
    document.getElementById("formCadastro").addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = grecaptcha.getResponse(recaptchaWidgetCadastro);
        if (!token) {
            document.getElementById("erroCadastro").textContent = "Por favor, valide o reCAPTCHA.";
            document.getElementById("erroCadastro").style.display = "block";
            return;
        }
        const nome = document.getElementById("nomeCadastro").value;
        const email = document.getElementById("emailCadastro").value;
        const senha = document.getElementById("senhaCadastro").value;
        const confirma = document.getElementById("confirmaSenha").value;
        if (senha !== confirma) {
            document.getElementById("erroCadastro").textContent = "Senhas não coincidem";
            document.getElementById("erroCadastro").style.display = "block";
            document.getElementById("senhaCadastro").style.border = "1px solid red";
            document.getElementById("confirmaSenha").style.border = "1px solid red";
            grecaptcha.reset(recaptchaWidgetCadastro);
            return;
        }
        try {
            const data = await safeApi(`/cadastro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email, senha, recaptchaToken: token })
            });
            if (data.sucesso === 'otp_sent') {
                // Mostrar seção OTP
                document.getElementById("formCadastro").style.display = "none";
                document.getElementById("otpSectionCadastro").style.display = "block";
                // Limpar erros
                document.getElementById("erroCadastro").style.display = "none";
            } else if (data.sucesso) {
                document.getElementById("formCadastro").querySelectorAll("input, button").forEach(el => el.style.display = "none");
                document.getElementById("mensagemCadastro").style.display = "block";
                document.getElementById("voltarConfirmacao").style.display = "block";
                setTimeout(() => {
                    popup.remove();
                    overlay.remove();
                    mostrarPopupLogin();
                }, 2000);
            } else {
                document.getElementById("erroCadastro").textContent = data.erro || "Erro ao cadastrar";
                document.getElementById("erroCadastro").style.display = "block";
                document.getElementById("emailCadastro").style.border = "1px solid red";
                grecaptcha.reset(recaptchaWidgetCadastro);
            }
        } catch (error) {
            document.getElementById("erroCadastro").textContent = "Erro ao cadastrar";
            document.getElementById("erroCadastro").style.display = "block";
            document.getElementById("emailCadastro").style.border = "1px solid red";
            grecaptcha.reset(recaptchaWidgetCadastro);
        }
    });
    // Listener para verificar OTP
    document.getElementById("btnVerifyOtpCadastro").addEventListener("click", async () => {
        const email = document.getElementById("emailCadastro").value;
        const code = document.getElementById("otpCadastro").value.trim();
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            document.getElementById("erroOtpCadastro").textContent = "Código deve ser 6 dígitos numéricos";
            document.getElementById("erroOtpCadastro").style.display = "block";
            return;
        }
        try {
            const data = await safeApi(`/verify-otp-cadastro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code })
            });
            if (data.sucesso) {
                document.getElementById("otpSectionCadastro").style.display = "none";
                document.getElementById("mensagemCadastro").style.display = "block";
                document.getElementById("voltarConfirmacao").style.display = "block";
                setTimeout(() => {
                    popup.remove();
                    overlay.remove();
                    mostrarPopupLogin();
                }, 2000);
            } else {
                document.getElementById("erroOtpCadastro").textContent = data.erro || "Código inválido";
                document.getElementById("erroOtpCadastro").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroOtpCadastro").textContent = "Erro ao verificar código";
            document.getElementById("erroOtpCadastro").style.display = "block";
        }
    });
    document.getElementById("btnVoltarLogin").addEventListener("click", () => {
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.remove();
        popup.remove();
        mostrarPopupLogin();
    });
    document.getElementById("btnVoltarLoginConfirmacao").addEventListener("click", () => {
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.remove();
        popup.remove();
        mostrarPopupLogin();
    });
}
/* ------------------ Seções ------------------ */
async function carregarSecao(secao) {
    localStorage.setItem("ultimaSecao", secao); // Salvar a seção atual no localStorage
    if (secao === "receitas") return montarReceitas();
    if (secao === "componentes") return montarComponentes();
    if (secao === "estoque") return montarEstoque();
    if (secao === "arquivados") return montarArquivados();
    if (secao === "farmar") return montarFarmar();
    if (secao === "roadmap") return montarRoadmap();
    if (secao === "categorias") return montarCategorias();
    if (secao === "time") return montarTime();
    if (secao === "home") return montarManual(); // Manual de uso
    conteudo.innerHTML = `<h1 class="home--titulo-principal">Bem-vindo!</h1>
<p>Essa aplicação tem como finalidade servir como calculadora e gestão de estoque para qualquer jogo de RPG (aqueles que envolvem craft e coleta de itens)!</p>
<p>No momento, estamos jogando somente o jogo Pax Dei, por isso, seguem alguns links úteis para o jogo:</p>
<ul class="home lista-de-recomendacoes">
    <li><div><a href="https://paxdei.gaming.tools">PAX DEI DATABASE</a></div></li>
    <li><div><a href="https://paxdei.th.gl">MAPA INTERATIVO</a></div></li>
</ul>
<iframe id="mapaIframe" src="https://paxdei.th.gl/" title="Pax Dei Interactive Map" loading="lazy"></iframe>
<iframe id="paxDeiIframe" src="https://paxdei.gaming.tools/" title="Pax Dei DataBase" loading="lazy"></iframe>`;
}
// Função para montar o manual de uso
function montarManual() {
    conteudo.innerHTML = `
        <h2>Bem-vindo! Manual de Uso da Ferramenta</h2>
        <p>Use o filtro abaixo para buscar instruções por palavras-chave. Clique nas setas para expandir as seções.</p>
        <div class="filtros">
            <input type="text" id="buscaManual" placeholder="Buscar instruções (ex: 'time', 'receita')">
        </div>
        <div id="manualConteudo" class="manual-container">
            <!-- Seções serão geradas dinamicamente abaixo -->
        </div>
    `;
    // Gerar seções do manual
    const manualSeções = [
        {
            titulo: "Introdução à Ferramenta",
            itens: [
                "Esta ferramenta é um gerenciador completo para jogos MMORPG com foco em crafting e coleta de itens. Ela permite criar receitas, gerenciar componentes, rastrear estoque, planejar farms e mais.",
                "Todas as ações são salvas por jogo (você pode alternar entre jogos no menu em Minha Conta).",
                "A autenticação é obrigatória para acessar as funcionalidades. Após login, você tem acesso total às ferramentas."
            ]
        },
        {
            titulo: "Sistema de Time e Permissões",
            itens: [
                "O sistema de time permite colaborar com outros jogadores. Há três papéis: Fundador (dono do time), Co-fundador (pode editar tudo como o fundador) e Membro (pode visualizar e usar, mas não editar).",
                "Para adicionar alguém ao time: Vá na aba 'Time', na seção 'Convidar Novo Membro', digite o email e clique 'Convidar'. O convidado recebe uma pendência e pode aceitar/recusar. O convite chega na aba 'Time' do convidado.",
                "Aceitar convite: Na aba 'Time', na seção 'Pendências de Convite', clique 'Aceitar' para entrar no time do fundador.",
                "Promover a co-fundador: Na aba 'Time', na lista de associados, clique 'Promover a Co-Fundador' (apenas fundadores podem fazer isso).",
                "Desvincular/Banir: Na aba 'Time', use os botões 'Desvincular' ou 'Banir' para remover alguém. Banidos não podem se juntar novamente sem desbanimento.",
                "Sair do time: Na aba 'Time', clique 'Sair do Time' (apenas membros podem sair; fundadores desvinculam outros)."
            ]
        },
        {
            titulo: "Gerenciando Jogos",
            itens: [
                "Para criar um novo jogo: Clique em 'Novo Jogo' (fica em 'Minha Conta'), digite o nome e confirme. Um novo conjunto de arquivos (receitas, estoque etc.) é criado.",
                "Alternar jogo: Use o seletor de jogos no menu em 'Minha Conta' para mudar entre jogos salvos. As configurações (filtros, quantidades) são salvas por jogo.", "Jogos não são compartilhados automaticamente com os membros do time. Após a criação de um jogo, caso queira liberar sua visualização para o time, acesse a aba 'Time' e marque a opção de compartilhar no jogo desejado. (somente fundadores podem fazer isso)."
            ]
        },
        {
            titulo: "Gerenciando Componentes",
            itens: [
                "Para criar um novo componente: Na aba 'Componentes e Estoque', clique '+ Novo Componente'. Defina nome, categoria, quantidade produzida e materiais associados (outros Componentes cadastrados que façam parte do fluxo de crafting; apenas fundadores/co-fundadores).",
                "Editar: Clique 'Editar' para alterar (propaga mudanças para receitas, categoria e roadmap automaticamente; apenas fundadores/co-fundadores).",
                "Excluir: Clique 'Excluir' (remove referências em receitas/arquivados; apenas fundadores/co-fundadores).",
                "Categorias: Na aba 'Categorias', crie ou exclua categorias para organizar componentes."
            ]
        },
        {
            titulo: "Gerenciando Receitas",
            itens: [
                "Para criar uma nova receita: Na aba 'Receitas', clique '+ Nova Receita'. Digite o nome e adicione componentes com quantidades. (apenas fundadores/co-fundadores).",
                "Editar/Duplicar: Clique 'Editar' para modificar ou 'Duplicar' para criar uma cópia (útil para variações; apenas fundadores/co-fundadores).",
                "Favoritar: Clique 'Favoritar' para marcar como favorita (aparece em 'Farmar Receitas Favoritas').",
                "Concluir: Insira a quantidade desejada e clique 'Concluir' (debitará do estoque automaticamente; apenas fundadores/co-fundadores).",
                "Arquivar: Clique 'Arquivar' para mover para 'Arquivados' (remove de receitas ativas; apenas fundadores/co-fundadores).",
                "Visualizar detalhes: Clique na seta ▼ ao lado da receita para ver requisitos de componentes e subcomponentes."
            ]
        },
        {
            titulo: "Gerenciando Estoque e Log",
            itens: [
                "Adicionar/Debitar: Na aba 'Estoque', use o formulário para adicionar ou debitar itens manualmente. O log registra todas as movimentações. (membros somente podem adicionar itens em estoque, mas não debitar).",
                "Editar item: Clique 'Editar' em um item do estoque para ajustar a quantidade. (somente fundadores/co-fundadores).",
                "Excluir item: Clique 'Excluir' (remove do estoque e componente; afeta receitas; somente fundadores/co-fundadores).",
                "Zerar estoque: Clique 'Zerar todo o estoque' (apenas fundadores/co-fundadores).",
                "Filtrar log: Na seção 'Log de Movimentações', busque por componente, data ou usuário que fez a alteração."
            ]
        },
        {
            titulo: "Favoritos (O que Farmar?)",
            itens: [
                "Marque receitas como favoritas na aba 'Receitas' para vê-las aqui.",
                "Filtre por receitas selecionadas (checkboxes) ou categorias para ver o que falta farmar.",
                "Cores indicam status: Verde (suficiente), Amarelo (quase suficiente), Vermelho (falta muito).",
                "Fabricar: Clique 'Fabricar Tudo' em um componente com subcomponentes (verifica estoque e debita automaticamente)."
            ]
        },
        {
            titulo: "Roadmap",
            itens: [
                "Adicionar: Clique 'Inserir nova receita' e selecione uma receita para adicionar ao plano. (somente fundadores/co-fundadores).",
                "Reordenar: Use ↑/↓ para mover itens no roadmap. (somente fundadores/co-fundadores).",
                "Marcar como pronto: Marque o checkbox 'Pronto' para indicar conclusão (filtro para ver só prontas). (somente fundadores/co-fundadores).",
                "Excluir: Clique 'Excluir'. (somente fundadores/co-fundadores)."
            ]
        },
        {
            titulo: "Minha Conta",
            itens: [
                "Clique em 'Minha Conta' no menu lateral para abrir um dropdown com suas informações pessoais.",
                "No dropdown, você pode: ver seus dados (ID, nome, email), selecionar o jogo atual, criar novo jogo, mudar senha, alternar entre modo claro/escuro, e fazer logout.",
                "Mudar senha: Digite a senha atual e a nova (confirmação obrigatória)."
            ]
        }
    ];
    const manualDiv = document.getElementById("manualConteudo");
    manualSeções.forEach(secao => {
        const secaoHtml = `
            <div class="manual-section">
                <button class="manual-dropdown-toggle">▶ ${secao.titulo}</button>
                <div class="manual-dropdown-content" style="display: none;">
                    ${secao.itens.map(item => `<p class="manual-item">${item}</p>`).join('')}
                </div>
            </div>
        `;
        manualDiv.innerHTML += secaoHtml;
    });
    // Adicionar event listeners para dropdowns
    document.querySelectorAll('.manual-dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const content = toggle.nextElementSibling;
            const isOpen = content.style.display !== 'none';
            content.style.display = isOpen ? 'none' : 'block';
            const titulo = toggle.textContent.substring(2).trim(); // Extrair título removendo ícone e espaço
            toggle.textContent = isOpen ? '▶ ' + titulo : '▼ ' + titulo;
        });
    });
    // Filtro de busca
    const buscaInput = document.getElementById("buscaManual");
    const debouncedFiltrarManual = debounce(filtrarManual, 300);
    buscaInput.addEventListener("input", () => debouncedFiltrarManual(buscaInput.value.toLowerCase()));
}
// Função para filtrar manual
function filtrarManual(termo) {
    document.querySelectorAll('.manual-section').forEach(secao => {
        const toggle = secao.querySelector('.manual-dropdown-toggle');
        const itens = secao.querySelectorAll('.manual-item');
        const temMatch = Array.from(itens).some(item => item.textContent.toLowerCase().includes(termo));
        const temMatchTitulo = toggle.textContent.toLowerCase().includes(termo);
        secao.style.display = (temMatch || temMatchTitulo) ? 'block' : 'none';
        if (temMatch || temMatchTitulo) {
            const content = toggle.nextElementSibling;
            content.style.display = 'block'; // Expandir se match
            const titulo = toggle.textContent.substring(2).trim();
            toggle.textContent = '▼ ' + titulo;
        }
    });
}
/* ------------------ MÓDULO TIME ------------------ */
async function montarTime() {
    conteudo.innerHTML = `
        <h2>Time</h2>
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
            <label><input type="checkbox" class="perm-checkbox" data-key="exportarEstoque"> Exportar Estoque</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="importarEstoque"> Importar Estoque</label>
            <h3>Receitas</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="criarReceitas"> Criar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="favoritarReceitas"> Favoritar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="concluirReceitas"> Concluir Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="duplicarReceitas"> Duplicar Receitas</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="editarReceitas"> Editar Receitas</label>
            <h3>Farmar Receitas Favoritas</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="fabricarComponentes"> Fabricar Componentes</label>
            <h3>Roadmap</h3>
            <label><input type="checkbox" class="perm-checkbox" data-key="criarRoadmap"> Criar Roadmap</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="excluirRoadmap"> Excluir Roadmap</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="reordenarRoadmap"> Reordenar Roadmap</label>
            <label><input type="checkbox" class="perm-checkbox" data-key="marcarProntoRoadmap"> Marcar Pronto Roadmap</label>
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
// Nova função para mostrar popup de sucesso temporário
function mostrarSucesso(msg) {

    // Remover overlay e modal existentes para evitar conflitos
    const existingOverlay = document.getElementById("overlaySucesso");
    if (existingOverlay) existingOverlay.remove();
    const existingModal = document.getElementById("modalSucesso");
    if (existingModal) existingModal.remove();
    const overlay = criarOverlay();
    overlay.id = "overlaySucesso";
    const modalSucesso = document.createElement("div");
    modalSucesso.id = "modalSucesso";
    modalSucesso.style.position = "fixed";
    modalSucesso.style.top = "50%";
    modalSucesso.style.left = "50%";
    modalSucesso.style.transform = "translate(-50%, -50%)";
    modalSucesso.style.backgroundColor = "white";
    modalSucesso.style.padding = "20px";
    modalSucesso.style.zIndex = "1000";
    modalSucesso.style.borderRadius = "5px";
    modalSucesso.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
    // Criar o botão de fechar antes de append para garantir o listener
    const buttonClose = document.createElement("button");
    buttonClose.id = "fecharModalSucesso";
    buttonClose.style.background = "none";
    buttonClose.style.border = "none";
    buttonClose.style.fontSize = "16px";
    buttonClose.style.cursor = "pointer";
    buttonClose.innerHTML = "❌";
    modalSucesso.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Sucesso</h3>
            ${buttonClose.outerHTML}
        </div>
        <p id="mensagemSucesso" style="color: green;">${msg}</p>
    `;
    // Adicionar listener imediatamente após criar o botão
    buttonClose.addEventListener("click", () => {
        modalSucesso.remove();
        const currentOverlay = document.getElementById("overlaySucesso");
        if (currentOverlay) currentOverlay.remove();
    });
    document.body.appendChild(modalSucesso);
    // Re-adicionar listener para segurança (caso haja manipulação DOM)
    const fecharModal = document.getElementById("fecharModalSucesso");
    if (fecharModal) {
        fecharModal.addEventListener("click", () => {
            modalSucesso.remove();
            const currentOverlay = document.getElementById("overlaySucesso");
            if (currentOverlay) currentOverlay.remove();
        });
    }
    // Fechar ao clicar no overlay
    overlay.addEventListener("click", () => {
        modalSucesso.remove();
        overlay.remove();
    });
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
/* ------------------ Funções Auxiliares de Filtro e Ordenação ------------------ */
function ordenarItens(itens, ordem, campo) {
    return [...itens].sort((a, b) => {
        const valorA = (a[campo] || "").toLowerCase();
        const valorB = (b[campo] || "").toLowerCase();
        if (ordem === "az") return valorA.localeCompare(valorB);
        if (ordem === "za") return valorB.localeCompare(valorA);
        return 0;
    });
}
function filtrarItens(itens, termo, campo) {
    if (!termo) return itens;
    return itens.filter(item =>
        (item[campo] || "").toLowerCase().includes(termo.toLowerCase())
    );
}
/* ------------------ RECEITAS ------------------ */
async function montarReceitas() {
    const isAdmin = isUserAdmin();
    conteudo.innerHTML = `
    <h2>Receitas</h2>
    <div class="filtros">
        <input type="text" id="buscaReceitas" placeholder="Buscar por nome...">
        <select id="ordemReceitas">
            <option value="az">Alfabética A-Z</option>
            <option value="za">Alfabética Z-A</option>
        </select>
        <label><input type="checkbox" id="filtroFavoritas"> Somente Favoritas</label>
        ${hasPermission('criarReceitas') ? '<button id="btnNovaReceita" class="primary">+ Nova Receita</button>' : ''}
    </div>
    <div id="listaReceitas" class="lista"></div>
    `;
    if (hasPermission('criarReceitas')) {
        document.getElementById("btnNovaReceita").addEventListener("click", () => abrirPopupReceita(null));
    }
    const buscaInput = document.getElementById("buscaReceitas");
    const ordemSelect = document.getElementById("ordemReceitas");
    const filtroFavoritas = document.getElementById("filtroFavoritas");
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedFilters = JSON.parse(localStorage.getItem(`receitasFilters_${currentGame}`)) || {};
    buscaInput.value = savedFilters.termoBusca || "";
    ordemSelect.value = savedFilters.ordem || "az";
    filtroFavoritas.checked = savedFilters.onlyFavorites || false;
    const saveFilters = () => {
        localStorage.setItem(`receitasFilters_${currentGame}`, JSON.stringify({
            termoBusca: buscaInput.value,
            ordem: ordemSelect.value,
            onlyFavorites: filtroFavoritas.checked
        }));
    };
    const debouncedCarregarListaReceitas = debounce(carregarListaReceitas, 300);
    buscaInput.addEventListener("input", () => {
        debouncedCarregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked);
        saveFilters();
    });
    ordemSelect.addEventListener("change", () => {
        debouncedCarregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked);
        saveFilters();
    });
    filtroFavoritas.addEventListener("change", () => {
        debouncedCarregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked);
        saveFilters();
    });
    await carregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked);
}
async function carregarListaReceitas(termoBusca = "", ordem = "az", onlyFavorites = false) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    let quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    let url = `/receitas?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
    if (termoBusca) {
        url += `&search=${encodeURIComponent(termoBusca)}`;
    }
    if (onlyFavorites) {
        url += `&favoritas=true`;
    }
    if (!termoBusca && !onlyFavorites) {
        url += `&limit=10`;
    }
    try {
        let receitas = await safeApi(url);
        const componentes = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`);
        const estoqueList = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`);
        const estoque = {};
        estoqueList.forEach(e => { estoque[e.componente] = e.quantidade || 0; });
        if (termoBusca) {
            receitas = receitas.filter(r => r.nome.toLowerCase().includes(termoBusca.toLowerCase()));
        }
        if (onlyFavorites) {
            receitas = receitas.filter(r => r.favorita);
        }
        receitas = receitas.sort((a, b) => {
            if (a.favorita !== b.favorita) return b.favorita - a.favorita; // Favoritas primeiro
            const valorA = a.nome.toLowerCase();
            const valorB = b.nome.toLowerCase();
            return ordem === "az" ? valorA.localeCompare(valorB) : valorB.localeCompare(valorA);
        });
        if (!termoBusca && !onlyFavorites) {
            receitas = receitas.slice(0, 10);
        }
        const div = document.getElementById("listaReceitas");
        const isAdmin = isUserAdmin();
        div.innerHTML = receitas.filter(r => r.nome).map(r => {
            const id = `receita-${r.nome.replace(/\s/g, '-')}`;
            const comps = (r.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
            const savedQtd = quantities[r.nome] || 1;
            const btnConcluirHtml = hasPermission('concluirReceitas') ? `<button class="btn-concluir" data-receita="${r.nome}">Concluir</button>` : '';
            const btnEditarHtml = hasPermission('editarReceitas') ? `<button class="btn-editar" data-nome="${r.nome}">Editar</button>` : '';
            const btnArquivarHtml = hasPermission('concluirReceitas') ? `<button class="btn-arquivar" data-nome="${r.nome}">Arquivar</button>` : '';
            const btnDuplicarHtml = hasPermission('duplicarReceitas') ? `<button class="btn-duplicar" data-nome="${r.nome}">Duplicar</button>` : '';
            const btnFavoritarHtml = hasPermission('favoritarReceitas') ? `<button class="btn-favoritar ${r.favorita ? 'favorita' : ''}" data-nome="${r.nome}">${r.favorita ? 'Desfavoritar' : 'Favoritar'}</button>` : '';
            return `
        <div class="item ${r.favorita ? 'favorita' : ''}" data-receita="${r.nome}">
          <div class="receita-header">
            <div class = "receita-header--container1"><div style="margin-right: 15px;"><strong class= "receita-header--titulo">${r.nome}</strong>
            ${comps ? `<div class="comps-lista">${comps}</div>` : ""}
            <input type="number" class="qtd-desejada" min="0.001" step="any" value="${savedQtd}" data-receita="${r.nome}"></div>
            <button class="toggle-detalhes" data-target="${id}-detalhes">▼</button></div><div class="receitas-ButtonContainer">
            ${btnConcluirHtml}
            ${btnEditarHtml}
            ${btnDuplicarHtml}
            ${btnFavoritarHtml}
            ${btnArquivarHtml}</div>
          </div>
          <div class="detalhes" id="${id}-detalhes" style="display:none;"></div>
        </div>`;
        }).join("");
        document.querySelectorAll(".toggle-detalhes").forEach(btn => {
            btn.addEventListener("click", async () => {
                const targetId = btn.dataset.target;
                const detalhes = document.getElementById(targetId);
                if (!detalhes) {
                    console.error(`[DETALHES] Elemento com ID ${targetId} não encontrado`);
                    return;
                }
                const isVisible = detalhes.style.display !== "none";
                detalhes.style.display = isVisible ? "none" : "block";
                btn.textContent = isVisible ? "▼" : "▲";
                if (!isVisible) {
                    const receitaElement = btn.closest(".item");
                    const receitaNome = receitaElement.dataset.receita;
                    const qtd = Math.max(Number(receitaElement.querySelector(".qtd-desejada").value) || 0.001, 0.001);
                    await atualizarDetalhes(receitaNome, qtd, componentes, estoque);
                    if (hasPermission('concluirReceitas')) await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
                }
            });
        });
        document.querySelectorAll(".qtd-desejada").forEach(input => {
            input.addEventListener("input", async () => {
                const receitaElement = input.closest(".item");
                const receitaNome = receitaElement.dataset.receita;
                const qtd = Math.max(Number(input.value) || 0.001, 0.001);
                quantities[receitaNome] = qtd;
                localStorage.setItem(quantitiesKey, JSON.stringify(quantities));
                const detalhes = receitaElement.querySelector(".detalhes");
                if (detalhes && detalhes.style.display !== "none") {
                    await atualizarDetalhes(receitaNome, qtd, componentes, estoque);
                    if (hasPermission('concluirReceitas')) await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
                }
            });
        });
        if (hasPermission('concluirReceitas')) {
            document.querySelectorAll(".btn-concluir").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const receitaNome = btn.dataset.receita;
                    const qtd = Math.max(Number(btn.closest(".item").querySelector(".qtd-desejada").value) || 0.001, 0.001);
                    await concluirReceita(receitaNome, qtd, componentes, estoque);
                });
            });
            document.querySelectorAll(".btn-arquivar").forEach(btn => {
                btn.addEventListener("click", () => {
                    const nome = btn.dataset.nome;
                    console.log(`[ARQUIVAR] Botão Arquivar clicado para receita: ${nome}`);
                    arquivarReceita(nome);
                });
            });
        }
        if (hasPermission('editarReceitas')) {
            document.querySelectorAll(".btn-editar").forEach(btn => {
                btn.addEventListener("click", () => {
                    const nome = btn.dataset.nome;
                    console.log(`[EDITAR] Botão Editar clicado para receita: ${nome}`);
                    editarReceita(nome);
                });
            });
        }
        if (hasPermission('duplicarReceitas')) {
            document.querySelectorAll(".btn-duplicar").forEach(btn => {
                btn.addEventListener("click", () => {
                    const nome = btn.dataset.nome;
                    console.log(`[DUPLICAR] Botão Duplicar clicado para receita: ${nome}`);
                    duplicarReceita(nome);
                });
            });
        }
        if (hasPermission('favoritarReceitas')) {
            document.querySelectorAll(".btn-favoritar").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const nome = btn.dataset.nome;
                    const isFavorita = btn.classList.contains('favorita');
                    await toggleFavorita(nome, !isFavorita);
                });
            });
        }
        // Verificar botões inicialmente
        if (hasPermission('concluirReceitas')) {
            document.querySelectorAll(".item").forEach(async item => {
                const receitaNome = item.dataset.receita;
                const qtd = Math.max(Number(item.querySelector(".qtd-desejada").value) || 0.001, 0.001);
                await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
            });
        }
    } catch (error) {
        console.error('[RECEITAS] Erro ao carregar lista:', error);
        const div = document.getElementById("listaReceitas");
        div.innerHTML = '<p>Erro ao carregar receitas.</p>';
    }
}
async function toggleFavorita(nome, favorita) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/receitas/favoritar?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, favorita })
        });
        if (data.sucesso) {
            await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false);
        } else {
            mostrarErro(data.erro || "Erro ao favoritar receita");
        }
    } catch (error) {
        mostrarErro("Erro ao favoritar receita: " + error.message);
    }
}
async function arquivarReceita(receitaNome) {
    console.log(`[ARQUIVAR] Iniciando arquivamento da receita: ${receitaNome}`);
    if (!confirm(`Confirmar arquivamento de "${receitaNome}"?`)) {
        console.log(`[ARQUIVAR] Arquivamento de "${receitaNome}" cancelado pelo usuário.`);
        return;
    }
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    let quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    try {
        const receitasAtuais = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`);
        console.log(`[ARQUIVAR] Receitas atuais carregadas:`, receitasAtuais);
        const receitaIndex = receitasAtuais.findIndex(r => r.nome === receitaNome);
        if (receitaIndex === -1) {
            console.error(`[ARQUIVAR] Receita "${receitaNome}" não encontrada em receitas.json`);
            mostrarErro("Receita não encontrada para arquivamento.");
            return;
        }
        // Remover receita de receitas.json
        const receitaArquivada = receitasAtuais.splice(receitaIndex, 1)[0];
        console.log(`[ARQUIVAR] Removendo receita "${receitaNome}" de receitas.json`);
        const receitasData = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(receitasAtuais)
        });
        console.log(`[ARQUIVAR] Resposta do servidor (receitas):`, receitasData);
        if (!receitasData.sucesso) {
            console.error(`[ARQUIVAR] Erro ao salvar receitas.json:`, receitasData.erro);
            mostrarErro("Erro ao remover receita: " + (receitasData.erro || "Falha desconhecida"));
            return;
        }
        // Adicionar receita a arquivados.json
        let arquivados = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`).catch(() => []);
        console.log(`[ARQUIVAR] Arquivados atuais:`, arquivados);
        arquivados.push(receitaArquivada);
        console.log(`[ARQUIVAR] Adicionando receita "${receitaNome}" a arquivados.json`);
        const arquivadosData = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados)
        });
        console.log("[ARQUIVAR] Resposta do servidor (arquivados):", arquivadosData);
        if (!arquivadosData.sucesso) {
            console.error(`[ARQUIVAR] Erro ao salvar arquivados.json:`, arquivadosData.erro);
            mostrarErro("Erro ao arquivar receita: " + (arquivadosData.erro || "Falha desconhecida"));
            return;
        }
        // Remover quantidade salva no localStorage
        delete quantities[receitaNome];
        localStorage.setItem(quantitiesKey, JSON.stringify(quantities));
        // Atualizar UI
        console.log(`[ARQUIVAR] Atualizando interface do usuário para receita: ${receitaNome}`);
        await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az");
        await carregarArquivados();
        // Correção: Só recarregar farmar se a seção existir (evita erro de null.innerHTML)
        if (document.getElementById("listaFarmar")) {
            await carregarListaFarmar(
                document.getElementById("buscaFarmar")?.value || "",
                document.getElementById("ordemFarmar")?.value || "pendente-desc",
                document.getElementById("filtroReceitaFarmar")?.value || ""
            );
        }
        console.log(`[ARQUIVAR] Receita "${receitaNome}" arquivada com sucesso.`);
    } catch (error) {
        console.error(`[ARQUIVAR] Erro ao arquivar receita "${receitaNome}":`, error);
        mostrarErro("Erro ao arquivar receita: " + error.message);
    }
}
async function atualizarDetalhes(receitaNome, qtd, componentesData, estoque, collapsible = false, hidePrefix = false) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`);
        const receita = receitas.find(r => r.nome === receitaNome);
        if (!receita) {
            console.error(`[DETALHES] Receita "${receitaNome}" não encontrada`);
            return;
        }
        const detalhes = document.querySelector(`[data-receita="${receitaNome}"] .detalhes`);
        if (!detalhes) {
            console.error(`[DETALHES] Elemento com detalhes para receita "${receitaNome}" não encontrado`);
            return;
        }
        let requisitos = {};
        receita.componentes.forEach(comp => {
            const quantidadeNecessaria = comp.quantidade * qtd;
            mergeReq(requisitos, calculateComponentRequirements(comp.nome, quantidadeNecessaria, componentesData, estoque));
        });
        let html = "<ul>";
        let counter = 1;
        for (const comp of receita.componentes) {
            const quantidadeNecessaria = comp.quantidade * qtd;
            const disp = estoque[comp.nome] !== undefined ? estoque[comp.nome] : 0;
            const falta = Math.max(0, quantidadeNecessaria - disp);
            let classeLinha = '';
            if (disp >= quantidadeNecessaria) {
                classeLinha = 'comp-verde'; // Verde e negrito
            } else if (falta <= quantidadeNecessaria * 0.5) {
                classeLinha = 'comp-amarelo'; // Amarelo e negrito
            } else {
                classeLinha = 'comp-vermelho'; // Vermelho, sem negrito
            }
            const component = componentesData.find(c => c.nome === comp.nome);
            const hasSubs = component && component.associados && component.associados.length > 0;
            let toggleHtml = '';
            if (collapsible && hasSubs) {
                toggleHtml = `<button class="toggle-sub">▶</button>`;
            }
            html += `
            <li class="${classeLinha}">
              ${toggleHtml}
              ${!hidePrefix ? `<span class="prefix">${counter}-</span> ` : ''}${comp.nome} (Nec: ${formatQuantity(quantidadeNecessaria)}, Disp: ${formatQuantity(disp)}, Falta: ${formatQuantity(falta)})
              ${getComponentChain(comp.nome, quantidadeNecessaria, componentesData, estoque, `${counter}.`, collapsible, hidePrefix)}
            </li>`;
            counter++;
        }
        html += "</ul>";
        detalhes.innerHTML = html;
        if (collapsible) {
            detalhes.querySelectorAll('.toggle-sub').forEach(btn => {
                btn.addEventListener('click', () => {
                    const li = btn.closest('li');
                    const ul = li.querySelector('ul');
                    if (ul) {
                        if (ul.style.display === 'none') {
                            ul.style.display = 'block';
                            btn.textContent = '▼';
                        } else {
                            ul.style.display = 'none';
                            btn.textContent = '▶';
                        }
                    }
                });
            });
        }
    } catch (error) {
        console.error(`[DETALHES] Erro ao atualizar detalhes para ${receitaNome}:`, error);
    }
}
function getComponentChain(componentName, quantityNeeded, componentesData, estoque, prefix = "", collapsible = false, hidePrefix = false) {
    const component = componentesData.find(c => c.nome === componentName);
    const disp = estoque[componentName] !== undefined ? estoque[componentName] : 0;
    // Se o componente tem estoque suficiente, não exibir subcomponentes
    if (disp >= quantityNeeded) return "";
    if (!component || !component.associados || component.associados.length === 0) return "";
    let ulStyle = "";
    if (collapsible) {
        ulStyle = ' style="display:none;"';
    }
    let html = `<ul${ulStyle}>`;
    const qtdProd = component.quantidadeProduzida || 1;
    const numCrafts = Math.ceil((quantityNeeded - disp) / qtdProd);
    let subCounter = 1;
    component.associados.forEach(a => {
        const subNec = a.quantidade * numCrafts;
        const subDisp = estoque[a.nome] !== undefined ? estoque[a.nome] : 0;
        const subFalta = Math.max(0, subNec - subDisp);
        let classeLinha = '';
        if (subDisp >= subNec) {
            classeLinha = 'comp-verde'; // Verde e negrito
        } else if (subFalta <= subNec * 0.5) {
            classeLinha = 'comp-amarelo'; // Amarelo e negrito
        } else {
            classeLinha = 'comp-vermelho'; // Vermelho, sem negrito
        }
        const subComponent = componentesData.find(c => c.nome === a.nome);
        const hasSubs = subComponent && subComponent.associados && subComponent.associados.length > 0;
        let toggleHtml = '';
        if (collapsible && hasSubs) {
            toggleHtml = `<button class="toggle-sub">▶</button>`;
        }
        const level = prefix.split('.').length - 1;
        const arrowWidth = 10; // Assumindo largura da setinha como 10px
        html += `
        <li class="${classeLinha}" style="margin-left: ${level * (10 + arrowWidth)}px;">
          ${toggleHtml}
          ${!hidePrefix ? `<span class="prefix">${prefix}${subCounter}-</span> ` : ''}${a.nome} (Nec: ${formatQuantity(subNec)}, Disp: ${formatQuantity(subDisp)}, Falta: ${formatQuantity(subFalta)})
          ${getComponentChain(a.nome, subNec, componentesData, estoque, `${prefix}${subCounter}.`, collapsible, hidePrefix)}
        </li>`;
        subCounter++;
    });
    html += "</ul>";
    return html;
}
function calculateComponentRequirements(componentName, quantityNeeded, componentesData, estoque) {
    const disp = estoque[componentName] !== undefined ? estoque[componentName] : 0;
    // Se o componente tem estoque suficiente, retornar apenas ele
    if (disp >= quantityNeeded) {
        return { [componentName]: quantityNeeded };
    }
    const component = componentesData.find(c => c.nome === componentName);
    if (!component || !component.associados || component.associados.length === 0) {
        return { [componentName]: quantityNeeded };
    }
    let req = {};
    const qtdProd = component.quantidadeProduzida || 1;
    const numCrafts = Math.ceil((quantityNeeded - disp) / qtdProd);
    component.associados.forEach(a => {
        const subNec = a.quantidade * numCrafts;
        mergeReq(req, calculateComponentRequirements(a.nome, subNec, componentesData, estoque));
    });
    // Incluir o componente principal apenas se não tiver estoque suficiente
    req[componentName] = quantityNeeded;
    return req;
}
function mergeReq(target, source) {
    for (const [key, val] of Object.entries(source)) {
        target[key] = (target[key] || 0) + val;
    }
}
async function atualizarBotaoConcluir(receitaNome, qtd, componentesData, estoque) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`);
        const receita = receitas.find(r => r.nome === receitaNome);
        if (!receita) {
            console.error(`[CONCLUIR] Receita "${receitaNome}" não encontrada`);
            return;
        }
        let requisitos = {};
        receita.componentes.forEach(comp => {
            const quantidadeNecessaria = comp.quantidade * qtd;
            mergeReq(requisitos, calculateComponentRequirements(comp.nome, quantidadeNecessaria, componentesData, estoque));
        });
        const btn = document.querySelector(`[data-receita="${receitaNome}"] .btn-concluir`);
        if (!btn) return;
        const estoqueAtualizado = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`);
        const estoqueMap = {};
        estoqueAtualizado.forEach(e => { estoqueMap[e.componente] = e.quantidade || 0; });
        const podeConcluir = Object.entries(requisitos).every(([nome, nec]) => {
            const disp = estoqueMap[nome] || 0;
            return disp >= nec;
        });
        btn.disabled = !podeConcluir;
    } catch (error) {
        console.error(`[CONCLUIR] Erro ao atualizar botão para ${receitaNome}:`, error);
    }
}
async function concluirReceita(receitaNome, qtd, componentesData, estoque) {
    console.log(`[CONCLUIR] Iniciando conclusão da receita: ${receitaNome}, quantidade: ${qtd}`);
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    let quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    try {
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`);
        console.log("[CONCLUIR] Receitas recebidas do servidor:", receitas);
        const receita = receitas.find(r => r.nome === receitaNome);
        if (!receita) {
            console.error(`[CONCLUIR] Receita "${receitaNome}" não encontrada`);
            mostrarErro("Receita não encontrada.");
            return;
        }
        let requisitos = {};
        receita.componentes.forEach(comp => {
            const quantidadeNecessaria = comp.quantidade * qtd;
            mergeReq(requisitos, calculateComponentRequirements(comp.nome, quantidadeNecessaria, componentesData, estoque));
        });
        const podeConcluir = Object.entries(requisitos).every(([nome, nec]) => {
            const disp = estoque[nome] !== undefined ? estoque[nome] : 0;
            return disp >= nec;
        });
        if (!podeConcluir) {
            mostrarErro("Estoque insuficiente para concluir a receita.");
            return;
        }
        // Debitar do estoque
        for (const [componente, quantidade] of Object.entries(requisitos)) {
            console.log(`[CONCLUIR] Debitando ${quantidade} de ${componente} do estoque`);
            const data = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ componente, quantidade, operacao: "debitar" })
            });
            if (!data.sucesso) {
                mostrarErro(data.erro || `Erro ao debitar ${componente} do estoque.`);
                return;
            }
        }
        // Registrar no log
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = sessionStorage.getItem('userEmail');
        const logEntries = Object.entries(requisitos).map(([componente, quantidade]) => ({
            dataHora,
            componente,
            quantidade,
            operacao: "debitar",
            origem: `Conclusão de ${receitaNome}`,
            user: userEmail // Adicionar usuário
        }));
        console.log("[CONCLUIR] Registrando no log:", logEntries);
        const logData = await safeApi(`/log?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logEntries)
        });
        if (!logData.sucesso) {
            mostrarErro("Erro ao registrar log.");
            return;
        }
        // Arquivar a receita e remover de receitas
        let receitasAtuais = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`);
        console.log("[CONCLUIR] Receitas atuais antes da remoção:", receitasAtuais);
        const receitaIndex = receitasAtuais.findIndex(r => r.nome === receitaNome);
        if (receitaIndex === -1) {
            console.error(`[CONCLUIR] Receita "${receitaNome}" não encontrada para arquivamento`);
            mostrarErro("Receita não encontrada para arquivamento.");
            return;
        }
        const receitaArquivada = receitasAtuais.splice(receitaIndex, 1)[0];
        console.log(`[CONCLUIR] Removendo receita "${receitaNome}" de receitas.json`);
        console.log("[CONCLUIR] Receitas após remoção:", receitasAtuais);
        const receitasData = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(receitasAtuais)
        });
        console.log("[CONCLUIR] Resposta do servidor (receitas):", receitasData);
        if (!receitasData.sucesso) {
            console.error(`[CONCLUIR] Erro ao salvar receitas.json:`, receitasData.erro);
            mostrarErro("Erro ao remover receita: " + (receitasData.erro || "Falha desconhecida"));
            return;
        }
        let arquivados = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`).catch(() => []);
        arquivados.push(receitaArquivada);
        console.log(`[CONCLUIR] Adicionando receita "${receitaNome}" a arquivados.json`);
        const arquivadosData = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados)
        });
        console.log("[CONCLUIR] Resposta do servidor (arquivados):", arquivadosData);
        if (!arquivadosData.sucesso) {
            console.error(`[CONCLUIR] Erro ao salvar arquivados.json:`, arquivadosData.erro);
            mostrarErro("Erro ao arquivar receita.");
            return;
        }
        // Remover quantidade salva no localStorage
        delete quantities[receitaNome];
        localStorage.setItem(quantitiesKey, JSON.stringify(quantities));
        // Atualizar UI
        console.log("[CONCLUIR] Atualizando interface do usuário");
        const estoqueList = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`);
        estoqueList.forEach(e => { estoque[e.componente] = e.quantidade || 0; });
        await carregarListaReceitas();
        await carregarEstoque();
        await carregarLog();
        await carregarArquivados();
        // Correção: Só recarregar farmar sea seção existir (evita erro de null.innerHTML)
        if (document.getElementById("listaFarmar")) {
            await carregarListaFarmar(
                document.getElementById("buscaFarmar")?.value || "",
                document.getElementById("ordemFarmar")?.value || "pendente-desc",
                document.getElementById("filtroReceitaFarmar")?.value || ""
            );
        }
    } catch (error) {
        console.error("[CONCLUIR] Erro ao concluir receita:", error);
        mostrarErro("Erro ao concluir receita: " + error.message);
    }
}
async function editarReceita(nome) {
    console.log(`[EDITAR] Abrindo popup para editar receita: ${nome}`);
    abrirPopupReceita(nome);
}
async function duplicarReceita(nome) {
    console.log(`[DUPLICAR] Iniciando duplicação da receita: ${nome}`);
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`);
        const receita = receitas.find(r => r.nome === nome);
        if (!receita) {
            console.error(`[DUPLICAR] Receita "${nome}" não encontrada`);
            mostrarErro("Receita não encontrada para duplicação.");
            return;
        }
        // Gerar um nome único sugerido
        let nomeSugerido = `${nome} 1`;
        let contador = 1;
        while (receitas.some(r => r.nome === nomeSugerido)) {
            contador++;
            nomeSugerido = `${nome} ${contador}`;
        }
        abrirPopupReceita(nome, true, nomeSugerido);
    } catch (error) {
        console.error(`[DUPLICAR] Erro ao duplicar receita ${nome}:`, error);
        mostrarErro("Erro ao duplicar receita.");
    }
}
function abrirPopupReceita(nome = null, duplicar = false, nomeSugerido = null) {
    const popup = document.getElementById("popupReceita");
    const titulo = document.getElementById("tituloPopupReceita");
    const form = document.getElementById("formReceita");
    const container = document.getElementById("receitaAssociadosContainer");
    const inputNome = document.getElementById("receitaNome");
    const inputNomeOriginal = document.getElementById("inputNomeOriginalReceita");
    container.innerHTML = "";
    inputNome.value = "";
    inputNomeOriginal.value = "";
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    if (nome && !duplicar) {
        if (!hasPermission('editarReceitas')) {
            alert('Você não tem permissão para editar receitas.');
            return;
        }
    }
    if (nome) {
        titulo.textContent = duplicar ? "Duplicar Receita" : "Editar Receita";
        safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`).then(list => {
            const receita = list.find(r => r.nome === nome);
            if (!receita) {
                console.error(`[POPUP] Receita "${nome}" não encontrada`);
                mostrarErro("Receita não encontrada.");
                popup.style.display = "none";
                return;
            }
            inputNome.value = duplicar ? nomeSugerido : receita.nome;
            if (!duplicar) {
                inputNomeOriginal.value = receita.nome;
            }
            (receita.componentes || []).forEach(c => adicionarLinhaReceita(c));
            popup.style.display = "flex";
        }).catch(error => {
            console.error(`[POPUP] Erro ao carregar receita ${nome}:`, error);
            mostrarErro("Erro ao carregar receita.");
            popup.style.display = "none";
        });
    } else {
        titulo.textContent = "Nova Receita";
        popup.style.display = "flex";
    }
    document.getElementById("btnAddReceitaAssoc").onclick = () => adicionarLinhaReceita();
    form.onsubmit = async e => {
        e.preventDefault();
        console.log("[FORM] Formulário submetido");
        const nomeVal = inputNome.value.trim();
        const componentes = Array.from(container.querySelectorAll(".associado-row")).map(r => ({
            nome: r.querySelector(".assoc-nome").value,
            quantidade: Math.max(Number(r.querySelector(".assoc-qtd").value) || 0.001, 0.001)
        })).filter(x => x.nome && x.quantidade > 0);
        console.log("[FORM] Dados coletados:", { nomeVal, componentes });
        if (!nomeVal) {
            mostrarErro("Nome da receita é obrigatório.");
            return;
        }
        const payload = { nome: nomeVal, componentes };
        console.log("[FORM] Payload enviado:", payload);
        let endpoint = `/receitas?game=${encodeURIComponent(currentGame)}`;
        try {
            if (inputNomeOriginal.value && !duplicar) {
                const data = await safeApi(`/receitas/editar?game=${encodeURIComponent(currentGame)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nomeOriginal: inputNomeOriginal.value, ...payload })
                });
                console.log("[FORM] Resposta do servidor (edição):", data);
                if (!data.sucesso) {
                    mostrarErro(data.erro || "Erro ao editar receita");
                    return;
                }
            } else {
                const data = await safeApi(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                console.log("[FORM] Resposta do servidor (nova receita):", data);
                if (!data.sucesso) {
                    mostrarErro(data.erro || "Erro ao salvar receita");
                    return;
                }
            }
            popup.style.display = "none";
            await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az");
        } catch (error) {
            console.error("[FORM] Erro no fetch:", error);
            mostrarErro("Erro ao salvar a receita: " + error.message);
        }
    };
    document.getElementById("btnCancelarReceita").onclick = () => popup.style.display = "none";
}
async function adicionarLinhaReceita(dados = {}) {
    const container = document.getElementById("receitaAssociadosContainer");
    const row = document.createElement("div");
    row.className = "associado-row";
    const rowId = Math.random().toString(36).substring(7); // ID único para o datalist
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const comps = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`);
        row.innerHTML = `
      <input type="text" class="assoc-nome" list="assoc-datalist-${rowId}" value="${dados.nome || ''}" placeholder="Digite para buscar..." />
      <datalist id="assoc-datalist-${rowId}">
        ${comps.map(c => `<option value="${c.nome}">`).join("")}
      </datalist>
      <input type="number" class="assoc-qtd" min="0.001" step="any" value="${formatQuantity(dados.quantidade || 0.001)}" />
      <button type="button">❌</button>
    `;
    } catch (error) {
        console.error('[ADICIONAR LINHA] Erro ao carregar componentes:', error);
        row.innerHTML = `
      <input type="text" class="assoc-nome" list="assoc-datalist-${rowId}" value="${dados.nome || ''}" placeholder="Digite para buscar..." />
      <datalist id="assoc-datalist-${rowId}"></datalist>
      <input type="number" class="assoc-qtd" min="0.001" step="any" value="${formatQuantity(dados.quantidade || 0.001)}" />
      <button type="button">❌</button>
    `;
    }
    row.querySelector("button").addEventListener("click", () => row.remove());
    container.appendChild(row);
}
/* ------------------ COMPONENTES ------------------ */
async function montarComponentes() {
    const isAdmin = isUserAdmin();
    conteudo.innerHTML = `
    <h2>Componentes</h2>
    <div class="filtros">
        <input type="text" id="buscaComponentes" placeholder="Buscar por nome...">
        <select id="ordemComponentes">
            <option value="az">Alfabética A-Z</option>
            <option value="za">Alfabética Z-A</option>
        </select>
        <select id="filtroCategoriaComponentes">
            <option value="">Todas as categorias</option>
        </select>
        ${hasPermission('criarComponente') ? '<button id="btnNovoComponente" class="primary">+ Novo Componente</button>' : ''}
    </div>
    <div id="lista-componentes" class="lista"></div>
    `;
    if (hasPermission('criarComponente')) {
        document.getElementById("btnNovoComponente").addEventListener("click", () => abrirPopupComponente());
    }
    const buscaInput = document.getElementById("buscaComponentes");
    const ordemSelect = document.getElementById("ordemComponentes");
    const categoriaSelect = document.getElementById("filtroCategoriaComponentes");
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedFilters = JSON.parse(localStorage.getItem(`componentesFilters_${currentGame}`)) || {};
    buscaInput.value = savedFilters.termoBusca || "";
    ordemSelect.value = savedFilters.ordem || "az";
    categoriaSelect.value = savedFilters.categoria || "";
    const saveFilters = () => {
        localStorage.setItem(`componentesFilters_${currentGame}`, JSON.stringify({
            termoBusca: buscaInput.value,
            ordem: ordemSelect.value,
            categoria: categoriaSelect.value
        }));
    };
    const debouncedCarregarComponentesLista = debounce(carregarComponentesLista, 300);
    buscaInput.addEventListener("input", () => {
        debouncedCarregarComponentesLista(buscaInput.value, ordemSelect.value, categoriaSelect.value);
        saveFilters();
    });
    ordemSelect.addEventListener("change", () => {
        debouncedCarregarComponentesLista(buscaInput.value, ordemSelect.value, categoriaSelect.value);
        saveFilters();
    });
    categoriaSelect.addEventListener("change", () => {
        debouncedCarregarComponentesLista(buscaInput.value, ordemSelect.value, categoriaSelect.value);
        saveFilters();
    });
    await carregarComponentesLista(buscaInput.value, ordemSelect.value, categoriaSelect.value);
    await carregarCategoriasDatalist();
    await carregarCategoriasSelect();
}
async function carregarCategoriasSelect() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const categorias = await safeApi(`/categorias?game=${encodeURIComponent(currentGame)}`);
        const select = document.getElementById("filtroCategoriaComponentes");
        if (select) {
            select.innerHTML = '<option value="">Todas as categorias</option>' + categorias.map(cat => `<option value="${cat}">${cat}</option>`).join("");
        }
    } catch (error) {
        console.error('[CATEGORIAS SELECT] Erro ao carregar categorias:', error);
    }
}
async function carregarCategoriasDatalist() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const categorias = await safeApi(`/categorias?game=${encodeURIComponent(currentGame)}`);
        // Procurar por datalists com id contendo 'categoriasDatalist'
        const datalists = document.querySelectorAll('datalist[id*="categoriasDatalist"]');
        datalists.forEach(datalist => {
            datalist.innerHTML = categorias.map(cat => `<option value="${cat}">`).join("");
        });
    } catch (error) {
        console.error('[CATEGORIAS DATALIST] Erro ao carregar categorias:', error);
    }
}
async function carregarComponentesLista(termoBusca = "", ordem = "az", categoria = "") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    let url = `/componentes?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
    if (termoBusca) {
        url += `&search=${encodeURIComponent(termoBusca)}`;
    } else {
        url += `&limit=10`;
    }
    try {
        let comps = await safeApi(url);
        if (categoria) {
            comps = comps.filter(c => c.categoria === categoria);
        }
        const div = document.getElementById("lista-componentes");
        if (div) {
            div.innerHTML = comps.map(c => {
                const assoc = (c.associados || []).map(a => `${formatQuantity(a.quantidade)} x ${a.nome}`).join(", ");
                const btnEditarHtml = hasPermission('editarComponente') ? `<button onclick="abrirPopupComponente('${escapeJsString(c.nome)}')" class="primary">Editar</button>` : '';
                const btnExcluirHtml = hasPermission('excluirComponente') ? `<button onclick="excluirComponente('${escapeJsString(c.nome)}')" class="warn">Excluir</button>` : '';
                return `
          <div class="item">
            <div>
              <strong>${c.nome}</strong> <span class="categoria">(${c.categoria || "—"})</span>
              <div class="comps-lista">
                Produz: ${formatQuantity(c.quantidadeProduzida)}${assoc ? ` • Materiais: ${assoc}` : ""}
              </div>
            </div>
            <div class="acoes">
              ${btnEditarHtml}
              ${btnExcluirHtml}
            </div>
          </div>`;
            }).join("");
        }
    } catch (error) {
        console.error('[COMPONENTES] Erro ao carregar lista:', error);
        const div = document.getElementById("lista-componentes");
        if (div) div.innerHTML = '<p>Erro ao carregar componentes.</p>';
    }
}
async function excluirComponente(nome) {
    if (!hasPermission('excluirComponente')) {
        alert('Você não tem permissão para excluir componentes.');
        return;
    }
    if (!confirm(`Confirmar exclusão do componente "${nome}"? Isso removerá referências em receitas e estoque.`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/componentes/excluir?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome })
        });
        if (data.sucesso) {
            await carregarComponentesLista(
                document.getElementById("buscaComponentes")?.value || "",
                document.getElementById("ordemComponentes")?.value || "az",
                document.getElementById("filtroCategoriaComponentes")?.value || ""
            );
            if (document.getElementById("listaEstoque")) await carregarEstoque();
            if (document.getElementById("listaReceitas")) await carregarListaReceitas();
            if (document.getElementById("listaFarmar")) await carregarListaFarmar();
        } else {
            mostrarErro(data.erro || "Erro ao excluir componente");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir componente: " + error.message);
    }
}
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function escapeJsString(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
/* ------------------ Popup de Componente ------------------ */
function abrirPopupComponente(nome = null) {
    if (nome && !hasPermission('editarComponente')) {
        alert('Você não tem permissão para editar componentes.');
        return;
    }
    if (!nome && !hasPermission('criarComponente')) {
        alert('Você não tem permissão para criar componentes.');
        return;
    }
    const popup = document.getElementById("popupComponente");
    const titulo = document.getElementById("tituloPopup");
    const form = document.getElementById("formComponente");
    const container = document.getElementById("associadosContainer");
    const inputNome = document.getElementById("inputNome");
    const inputCategoria = document.getElementById("inputCategoria");
    const inputQuantidadeProduzida = document.getElementById("inputQuantidadeProduzida");
    const inputNomeOriginal = document.getElementById("inputNomeOriginal");
    container.innerHTML = "";
    inputNome.value = "";
    inputCategoria.value = "";
    inputQuantidadeProduzida.value = formatQuantity(0.001);
    inputNomeOriginal.value = "";
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    if (nome) {
        titulo.textContent = "Editar Componente";
        safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`).then(list => {
            const comp = list.find(c => c.nome === nome);
            if (!comp) return;
            inputNome.value = comp.nome;
            inputCategoria.value = comp.categoria || "";
            inputQuantidadeProduzida.value = formatQuantity(comp.quantidadeProduzida || 0.001);
            inputNomeOriginal.value = comp.nome;
            (comp.associados || []).forEach(a => adicionarAssociadoRow(a.nome, a.quantidade));
            popup.style.display = "flex";
        }).catch(error => {
            console.error('[POPUP COMPONENTE] Erro ao carregar componente:', error);
            mostrarErro("Erro ao carregar componente.");
            popup.style.display = "none";
        });
    } else {
        titulo.textContent = "Novo Componente";
        carregarCategoriasDatalist();
        popup.style.display = "flex";
    }
    document.getElementById("btnAddAssociado").onclick = () => adicionarAssociadoRow();
    form.onsubmit = async e => {
        e.preventDefault();
        const nomeVal = inputNome.value.trim();
        const categoriaVal = inputCategoria.value.trim();
        const qtdProd = Math.max(Number(inputQuantidadeProduzida.value) || 0.001, 0.001);
        const associados = Array.from(container.querySelectorAll(".associado-row")).map(row => ({
            nome: row.querySelector(".assoc-nome").value,
            quantidade: Math.max(Number(row.querySelector(".assoc-qtd").value) || 0.001, 0.001)
        })).filter(it => it.nome && it.quantidade > 0);
        if (!nomeVal) return mostrarErro("Nome inválido");
        const payload = { nome: nomeVal, categoria: categoriaVal, associados, quantidadeProduzida: qtdProd };
        let endpoint = `/componentes?game=${encodeURIComponent(currentGame)}`;
        if (inputNomeOriginal.value) {
            payload.nomeOriginal = inputNomeOriginal.value;
            endpoint = `/componentes/editar?game=${encodeURIComponent(currentGame)}`;
        }
        try {
            const data = await safeApi(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!data.sucesso) return mostrarErro(data.erro || "Erro ao salvar componente");
            popup.style.display = "none";
            await carregarComponentesLista(document.getElementById("buscaComponentes")?.value || "", document.getElementById("ordemComponentes")?.value || "az");
            await carregarCategoriasDatalist();
        } catch (error) {
            mostrarErro("Erro ao salvar componente: " + error.message);
        }
    };
    document.getElementById("btnCancelarComponente").onclick = () => popup.style.display = "none";
    popup.style.display = "flex";
}
async function adicionarAssociadoRow(nome = "", quantidade = "") {
    const container = document.getElementById("associadosContainer");
    const row = document.createElement("div");
    row.className = "associado-row";
    const rowId = Math.random().toString(36).substring(7); // ID único para o datalist
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const comps = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`);
        row.innerHTML = `
      <input type="text" class="assoc-nome" list="assoc-datalist-${rowId}" value="${nome}" placeholder="Digite para buscar..." />
      <datalist id="assoc-datalist-${rowId}">
        ${comps.map(c => `<option value="${c.nome}">`).join("")}
      </datalist>
      <input class="assoc-qtd" type="number" min="0.001" step="any" value="${formatQuantity(quantidade || 0.001)}" />
      <button type="button">❌</button>
    `;
    } catch (error) {
        console.error('[ADICIONAR ASSOCIADO] Erro ao carregar componentes:', error);
        row.innerHTML = `
      <input type="text" class="assoc-nome" list="assoc-datalist-${rowId}" value="${nome}" placeholder="Digite para buscar..." />
      <datalist id="assoc-datalist-${rowId}"></datalist>
      <input class="assoc-qtd" type="number" min="0.001" step="any" value="${formatQuantity(quantidade || 0.001)}" />
      <button type="button">❌</button>
    `;
    }
    row.querySelector("button").addEventListener("click", () => row.remove());
    container.appendChild(row);
}
/* ------------------ ESTOQUE ------------------ */
async function montarEstoque() {
    const isAdmin = isUserAdmin();
    conteudo.innerHTML = `
    <h2>Componentes e Estoque</h2>
    <div class="filtros">
        <h3 class="filtros-label">Filtros:</h3>
        <input type="text" id="buscaEstoque" placeholder="Buscar por nome...">
        <select id="ordemEstoque">
            <option value="az">Alfabética A-Z</option>
            <option value="za">Alfabética Z-A</option>
        </select>
    </div>
    <div style="display:flex; gap:16px;">
      <div style="flex:1">
        <form id="formEstoque">
        <h3 class="tituloFormEstoque">Atualize o estoque:</h2>
          <input type="text" id="selectComponenteEstoque" list="componentesDatalist" placeholder="Digite para buscar..." required>
          <datalist id="componentesDatalist"></datalist>
          <select id="selectOperacao">
            <option value="adicionar">Adicionar</option>
            ${isAdmin ? '<option value="debitar">Debitar</option>' : ''}
          </select>
          <input id="inputQuantidadeEstoque" type="number" min="0.001" step="any" value="0.001" />
          <button class="primary" type="submit">Confirmar</button>
        </form>
        ${hasPermission('importarEstoque') ? `
        <div class="estoque--acoes">
          <button id="btnExportEstoque" class="primary">Exportar Estoque (XLS)</button>
          <label id="btnImportEstoque" for="fileImportEstoque" class="primary">Importar Estoque (XLS)</label>
          <input type="file" id="fileImportEstoque" accept=".xls,.xlsx" style="display: none;">
        ${hasPermission('excluirComponente') ? '<button id="btnZerarEstoque" class="warn">Zerar todo o estoque</button>' : ''}
        </div>
        ` : ''}
     
        ${hasPermission('criarComponente') ? '<button id="btnNovoComponenteEstoque" class="primary">+ Novo Componente</button>' : ''}
        <div id="listaEstoque" class="lista"></div>
      </div>
      <div style="flex:1">
        <h3 class="estoque--log-de-movimentacoes">Log de Movimentações</h3>
        <div class="filtros">
            <input type="text" id="buscaLogComponente" list="logComponentesDatalist" placeholder="Digite componente para buscar...">
            <datalist id="logComponentesDatalist"></datalist>
            <input type="text" id="filtroLogUser" list="logUsersDatalist" placeholder="Digite usuário para buscar...">
            <datalist id="logUsersDatalist"></datalist>
            <input type="date" id="filtroLogData" placeholder="Selecionar data...">
            <button id="limparFiltrosLog" class="secondary">Limpar Filtros</button>
        </div>
        <div id="logMovimentacoes" class="lista" style="max-height:400px;overflow-y:auto;"></div>
      </div>
    </div>
    `;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    // Carregar componentes para o datalist do estoque
    safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`).then(comps => {
        const datalist = document.getElementById("componentesDatalist");
        datalist.innerHTML = comps.map(c => `<option value="${c.nome}">`).join("");
        // Atualizar datalist dinamicamente enquanto digita no estoque
        const inputComponente = document.getElementById("selectComponenteEstoque");
        inputComponente.addEventListener("input", () => {
            const termo = inputComponente.value.toLowerCase();
            const filteredOptions = comps.filter(c => c.nome.toLowerCase().includes(termo))
                .map(c => `<option value="${c.nome}">`);
            datalist.innerHTML = filteredOptions.join("");
        });
    }).catch(error => {
        console.error('[ESTOQUE DATALIST] Erro ao carregar componentes:', error);
    });
    const buscaEstoque = document.getElementById("buscaEstoque");
    const ordemEstoque = document.getElementById("ordemEstoque");
    const buscaLogComponente = document.getElementById("buscaLogComponente");
    const filtroLogUser = document.getElementById("filtroLogUser");
    const filtroLogData = document.getElementById("filtroLogData");
    const limparFiltrosLog = document.getElementById("limparFiltrosLog");
    const savedFilters = JSON.parse(localStorage.getItem(`estoqueFilters_${currentGame}`)) || {};
    buscaEstoque.value = savedFilters.termoBuscaEstoque || "";
    ordemEstoque.value = savedFilters.ordemEstoque || "az";
    buscaLogComponente.value = savedFilters.termoBuscaLog || "";
    filtroLogUser.value = savedFilters.userLog || "";
    filtroLogData.value = savedFilters.dataLog || "";
    const saveFilters = () => {
        localStorage.setItem(`estoqueFilters_${currentGame}`, JSON.stringify({
            termoBuscaEstoque: buscaEstoque.value,
            ordemEstoque: ordemEstoque.value,
            termoBuscaLog: buscaLogComponente.value,
            userLog: filtroLogUser.value,
            dataLog: filtroLogData.value
        }));
    };
    const debouncedCarregarEstoque = debounce(carregarEstoque, 300);
    const debouncedCarregarLog = debounce(carregarLog, 300);
    buscaEstoque.addEventListener("input", () => {
        debouncedCarregarEstoque(buscaEstoque.value, ordemEstoque.value);
        saveFilters();
    });
    ordemEstoque.addEventListener("change", () => {
        debouncedCarregarEstoque(buscaEstoque.value, ordemEstoque.value);
        saveFilters();
    });
    // Carregar componentes únicos para o datalist do log
    safeApi(`/log?game=${encodeURIComponent(currentGame)}`).then(logs => {
        const componentesUnicos = [...new Set(logs.map(log => log.componente).filter(Boolean))];
        const logDatalist = document.getElementById("logComponentesDatalist");
        logDatalist.innerHTML = componentesUnicos.map(c => `<option value="${c}">`).join("");
        // Carregar usuários únicos para o datalist do log
        const usuariosUnicos = [...new Set(logs.map(log => log.user).filter(Boolean))];
        const logUsersDatalist = document.getElementById("logUsersDatalist");
        logUsersDatalist.innerHTML = usuariosUnicos.map(u => `<option value="${u}">`).join("");
        // Atualizar datalist dinamicamente enquanto digita no log
        buscaLogComponente.addEventListener("input", () => {
            const termo = buscaLogComponente.value.toLowerCase();
            const filteredOptions = componentesUnicos.filter(c => c.toLowerCase().includes(termo))
                .map(c => `<option value="${c}">`);
            logDatalist.innerHTML = filteredOptions.join("");
            debouncedCarregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
            saveFilters();
        });
        filtroLogUser.addEventListener("input", () => {
            const termo = filtroLogUser.value.toLowerCase();
            const filteredOptions = usuariosUnicos.filter(u => u.toLowerCase().includes(termo))
                .map(u => `<option value="${u}">`);
            logUsersDatalist.innerHTML = filteredOptions.join("");
            debouncedCarregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
            saveFilters();
        });
    }).catch(error => {
        console.error('[LOG DATALIST] Erro ao carregar log:', error);
    });
    filtroLogData.addEventListener("change", () => {
        debouncedCarregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
        saveFilters();
    });
    // Limpar filtros
    limparFiltrosLog.addEventListener("click", () => {
        buscaLogComponente.value = "";
        filtroLogUser.value = "";
        filtroLogData.value = "";
        carregarLog("", "", "");
        saveFilters();
    });
    document.getElementById("formEstoque").onsubmit = async e => {
        e.preventDefault();
        const componente = document.getElementById("selectComponenteEstoque").value;
        const quantidade = Math.max(Number(document.getElementById("inputQuantidadeEstoque").value) || 0.001, 0.001);
        const operacao = document.getElementById("selectOperacao").value;
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = sessionStorage.getItem('userEmail');
        try {
            const data = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ componente, quantidade, operacao })
            });
            if (!data.sucesso) return mostrarErro(data.erro || "Erro ao movimentar estoque");
            const logEntry = {
                dataHora,
                componente,
                quantidade,
                operacao,
                origem: "Movimentação manual",
                user: userEmail // Adicionar usuário
            };
            const logData = await safeApi(`/log?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(logEntry)
            });
            if (!logData.sucesso) return mostrarErro("Erro ao registrar log.");
            await carregarEstoque(buscaEstoque.value, ordemEstoque.value);
            await carregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
        } catch (error) {
            mostrarErro("Erro ao movimentar estoque: " + error.message);
        }
    };
    // Exportar Estoque
    if (hasPermission('exportarEstoque')) {
        const btnExportEstoque = document.getElementById("btnExportEstoque");
        btnExportEstoque.addEventListener("click", async () => {
            try {
                const estoqueList = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`);
                const data = [['Componente', 'Quantidade'], ...estoqueList.map(e => [e.componente, e.quantidade])];
                const ws = XLSX.utils.aoa_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
                XLSX.writeFile(wb, `estoque_${currentGame}_${new Date().toISOString().split('T')[0]}.xlsx`);
            } catch (error) {
                mostrarErro("Erro ao exportar estoque: " + error.message);
            }
        });
    }
    // Importar Estoque
    if (hasPermission('importarEstoque')) {
        const fileInput = document.getElementById("fileImportEstoque");
        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                if (jsonData.length < 2) {
                    mostrarErro("Arquivo inválido: sem dados.");
                    return;
                }
                const headers = jsonData[0];
                const componenteIndex = headers.indexOf('Componente');
                const quantidadeIndex = headers.indexOf('Quantidade');
                if (componenteIndex === -1 || quantidadeIndex === -1) {
                    mostrarErro("Arquivo inválido: colunas 'Componente' e 'Quantidade' não encontradas.");
                    return;
                }
                const updates = jsonData.slice(1).map(row => ({
                    componente: row[componenteIndex],
                    novaQuantidade: parseFloat(row[quantidadeIndex]) || 0
                })).filter(u => u.componente && !isNaN(u.novaQuantidade));
                try {
                    const data = await safeApi(`/estoque/import?game=${encodeURIComponent(currentGame)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(updates)
                    });
                    if (data.sucesso) {
                        mostrarSucesso(`Estoque importado com sucesso! ${data.updated} itens atualizados.`);
                        await carregarEstoque(buscaEstoque.value, ordemEstoque.value);
                        await carregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
                    } else {
                        mostrarErro(data.erro || "Erro ao importar estoque.");
                    }
                } catch (error) {
                    mostrarErro("Erro ao importar estoque: " + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }
    const btnZerarEstoque = document.getElementById("btnZerarEstoque");
    if (btnZerarEstoque) {
        btnZerarEstoque.disabled = !hasPermission('excluirComponente');
        btnZerarEstoque.addEventListener("click", async () => {
            if (!hasPermission('excluirComponente')) {
                alert('Você não tem permissão para zerar o estoque.');
                return;
            }
            if (confirm("Tem certeza que deseja zerar todo o estoque? Essa ação não pode ser desfeita.")) {
                try {
                    const data = await safeApi(`/estoque/zerar?game=${encodeURIComponent(currentGame)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" }
                    });
                    if (data.sucesso) {
                        await carregarEstoque(buscaEstoque.value, ordemEstoque.value);
                        await carregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
                    } else {
                        mostrarErro(data.erro || "Erro ao zerar estoque");
                    }
                } catch (error) {
                    mostrarErro("Erro ao zerar estoque: " + error.message);
                }
            }
        });
    }
    // Botão para novo componente na aba de estoque
    if (hasPermission('criarComponente')) {
        const btnNovoCompEst = document.getElementById("btnNovoComponenteEstoque");
        btnNovoCompEst.addEventListener("click", () => abrirPopupComponenteEstoque(true)); // true para novo
    }
    await carregarEstoque(buscaEstoque.value, ordemEstoque.value);
    await carregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
}
// Nova função para abrir popup de componente no contexto de estoque (novo ou editar)
function abrirPopupComponenteEstoque(isNew = true, nome = null, quantidadeAtual = 0) {
    if (!isNew && !hasPermission('editarComponente')) {
        alert('Você não tem permissão para editar componentes.');
        return;
    }
    if (isNew && !hasPermission('criarComponente')) {
        alert('Você não tem permissão para criar componentes.');
        return;
    }
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupComponenteEstoque";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.style.maxHeight = "80vh";
    popup.style.overflowY = "auto";
    const titulo = isNew ? "Novo Componente" : `Editar Componente: ${nome}`;
    popup.innerHTML = `
        <h2>${titulo}</h2>
        <form id="formComponenteEstoque">
            <label>Nome do Componente:</label>
            <input type="text" id="inputNomeEstoque" value="${nome || ''}" required>
            <label>Categoria:</label>
            <input type="text" id="inputCategoriaEstoque" list="categoriasDatalistEstoque" placeholder="Categoria (opcional)">
            <datalist id="categoriasDatalistEstoque"></datalist>
            <label>Quantidade Produzida:</label>
            <input type="number" id="inputQuantidadeProduzidaEstoque" min="0.001" step="any" value="${formatQuantity(0.001)}" required>
            <label>Atualizar quantidade no estoque:</label>
            <input type="number" id="inputQuantidadeEstoqueInicial" min="0" step="any" value="${formatQuantity(quantidadeAtual)}" required>
            <input type="hidden" id="currentQuantidadeEstoque" value="${quantidadeAtual}">
            <h3>Materiais Associados:</h3>
            <button type="button" id="btnAddAssociadoEstoque" class="primary">+ Adicionar Material</button>
            <div id="associadosContainerEstoque"></div>
            <button type="submit">Salvar</button>
            <button type="button" id="btnCancelarComponenteEstoque">Cancelar</button>
            <p id="erroComponenteEstoque" style="color: red; display: none;"></p>
            <input type="hidden" id="inputNomeOriginalEstoque" value="${nome || ''}">
        </form>
    `;
    document.body.appendChild(popup);
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    // Carregar categorias para datalist
    carregarCategoriasDatalistEstoque();
    // Se editando, carregar dados existentes
    if (!isNew) {
        safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`).then(list => {
            const comp = list.find(c => c.nome === nome);
            if (comp) {
                document.getElementById("inputQuantidadeProduzidaEstoque").value = formatQuantity(comp.quantidadeProduzida || 0.001);
                document.getElementById("inputCategoriaEstoque").value = comp.categoria || "";
                (comp.associados || []).forEach(a => adicionarAssociadoRowEstoque(a.nome, a.quantidade));
            }
        }).catch(error => {
            console.error('[POPUP COMPONENTE ESTOQUE] Erro ao carregar componente:', error);
            mostrarErroEstoque("Erro ao carregar componente.");
        });
    }
    // Event listener para adicionar row de associado
    document.getElementById("btnAddAssociadoEstoque").addEventListener("click", () => adicionarAssociadoRowEstoque());
    // Submit form
    document.getElementById("formComponenteEstoque").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nomeVal = document.getElementById("inputNomeEstoque").value.trim();
        const categoriaVal = document.getElementById("inputCategoriaEstoque").value.trim();
        const qtdProd = Math.max(Number(document.getElementById("inputQuantidadeProduzidaEstoque").value) || 0.001, 0.001);
        const targetQtd = Number(document.getElementById("inputQuantidadeEstoqueInicial").value) || 0;
        const currentQtd = Number(document.getElementById("currentQuantidadeEstoque").value) || 0;
        const associados = Array.from(document.getElementById("associadosContainerEstoque").querySelectorAll(".associado-row")).map(row => ({
            nome: row.querySelector(".assoc-nome").value,
            quantidade: Math.max(Number(row.querySelector(".assoc-qtd").value) || 0.001, 0.001)
        })).filter(it => it.nome && it.quantidade > 0);
        const nomeOriginal = document.getElementById("inputNomeOriginalEstoque").value;
        const erroEl = document.getElementById("erroComponenteEstoque");
        if (!nomeVal) {
            erroEl.textContent = "Nome do componente é obrigatório";
            erroEl.style.display = "block";
            return;
        }
        const payloadComp = {
            nome: nomeVal,
            categoria: categoriaVal,
            associados,
            quantidadeProduzida: qtdProd
        };
        if (nomeOriginal) payloadComp.nomeOriginal = nomeOriginal;
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = sessionStorage.getItem('userEmail');
        let logEntries = [];
        try {
            // Salvar/atualizar componente
            let endpointComp = `/componentes?game=${encodeURIComponent(currentGame)}`;
            if (nomeOriginal) endpointComp = `/componentes/editar?game=${encodeURIComponent(currentGame)}`;
            const dataComp = await safeApi(endpointComp, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payloadComp)
            });
            if (!dataComp.sucesso) {
                erroEl.textContent = dataComp.erro || "Erro ao salvar componente";
                erroEl.style.display = "block";
                return;
            }
            // Log para criação/edição de componente
            logEntries.push({
                dataHora,
                componente: nomeVal,
                quantidade: 0,
                operacao: isNew ? "criar" : "editar",
                origem: isNew ? "Criação de novo componente" : `Edição de componente (nome: ${nomeOriginal} -> ${nomeVal}${categoriaVal !== (document.getElementById("inputCategoriaEstoque").dataset.original || '') ? `, categoria: ${document.getElementById("inputCategoriaEstoque").dataset.original || '—'} -> ${categoriaVal || '—'}` : ''})`,
                user: userEmail
            });
            // Atualizar estoque para a quantidade desejada
            if (targetQtd !== currentQtd) {
                let operacaoEstoque, absQtdEstoque;
                if (targetQtd > currentQtd) {
                    operacaoEstoque = "adicionar";
                    absQtdEstoque = targetQtd - currentQtd;
                } else if (targetQtd < currentQtd) {
                    operacaoEstoque = "debitar";
                    absQtdEstoque = currentQtd - targetQtd;
                } else if (targetQtd === 0 && currentQtd > 0) {
                    operacaoEstoque = "debitar";
                    absQtdEstoque = currentQtd;
                } else {
                    absQtdEstoque = 0; // No change
                }
                if (absQtdEstoque > 0) {
                    const dataEstoque = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ componente: nomeVal, quantidade: absQtdEstoque, operacao: operacaoEstoque })
                    });
                    if (!dataEstoque.sucesso) {
                        erroEl.textContent = dataEstoque.erro || "Erro ao atualizar estoque";
                        erroEl.style.display = "block";
                        return;
                    }
                    // Log para movimentação de estoque
                    logEntries.push({
                        dataHora,
                        componente: nomeVal,
                        quantidade: absQtdEstoque,
                        operacao: operacaoEstoque,
                        origem: isNew ? "Estoque inicial para novo componente" : "Atualização de quantidade de estoque",
                        user: userEmail
                    });
                }
            }
            // Registrar logs
            if (logEntries.length > 0) {
                const logData = await safeApi(`/log?game=${encodeURIComponent(currentGame)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(logEntries)
                });
                if (!logData.sucesso) {
                    console.error("Erro ao registrar log:", logData.erro);
                }
            }
            popup.remove();
            overlay.remove();
            // Atualizar listas
            await carregarEstoque(document.getElementById("buscaEstoque")?.value || "", document.getElementById("ordemEstoque")?.value || "az");
            await carregarLog(document.getElementById("buscaLogComponente")?.value || "", document.getElementById("filtroLogUser")?.value || "", document.getElementById("filtroLogData")?.value || "");
            if (document.getElementById("lista-componentes")) {
                await carregarComponentesLista(
                    document.getElementById("buscaComponentes")?.value || "",
                    document.getElementById("ordemComponentes")?.value || "az",
                    document.getElementById("filtroCategoriaComponentes")?.value || ""
                );
            }
            if (document.getElementById("listaReceitas")) {
                await carregarListaReceitas();
            }
            if (document.getElementById("listaFarmar")) {
                await carregarListaFarmar();
            }
        } catch (error) {
            erroEl.textContent = "Erro ao salvar: " + error.message;
            erroEl.style.display = "block";
        }
    });
    document.getElementById("btnCancelarComponenteEstoque").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
    // Função auxiliar para carregar categorias no datalist do estoque
    async function carregarCategoriasDatalistEstoque() {
        try {
            const categorias = await safeApi(`/categorias?game=${encodeURIComponent(currentGame)}`);
            const datalist = document.getElementById("categoriasDatalistEstoque");
            datalist.innerHTML = categorias.map(cat => `<option value="${cat}">`).join("");
        } catch (error) {
            console.error('[CATEGORIAS] Erro:', error);
        }
    }
    // Função auxiliar para adicionar row de associado no estoque
    async function adicionarAssociadoRowEstoque(nome = "", quantidade = "") {
        const container = document.getElementById("associadosContainerEstoque");
        const row = document.createElement("div");
        row.className = "associado-row";
        const rowId = Math.random().toString(36).substring(7);
        try {
            const comps = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`);
            row.innerHTML = `
                <input type="text" class="assoc-nome" list="assoc-datalist-estoque-${rowId}" value="${nome}" placeholder="Digite para buscar...">
                <datalist id="assoc-datalist-estoque-${rowId}">
                    ${comps.map(c => `<option value="${c.nome}">`).join("")}
                </datalist>
                <input class="assoc-qtd" type="number" min="0.001" step="any" value="${formatQuantity(quantidade || 0.001)}">
                <button type="button">❌</button>
            `;
        } catch (error) {
            row.innerHTML = `
                <input type="text" class="assoc-nome" list="assoc-datalist-estoque-${rowId}" value="${nome}" placeholder="Digite para buscar...">
                <datalist id="assoc-datalist-estoque-${rowId}"></datalist>
                <input class="assoc-qtd" type="number" min="0.001" step="any" value="${formatQuantity(quantidade || 0.001)}">
                <button type="button">❌</button>
            `;
        }
        row.querySelector("button").addEventListener("click", () => row.remove());
        container.appendChild(row);
    }
    // Função auxiliar para mostrar erro no popup de estoque
    function mostrarErroEstoque(msg) {
        const erroEl = document.getElementById("erroComponenteEstoque");
        if (erroEl) {
            erroEl.textContent = msg;
            erroEl.style.display = "block";
        }
    }
}
// Modificação da função editarEstoqueItem para incluir edição completa de componente
async function editarEstoqueItem(componente, quantidadeAtual) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    let categoriaAtual = ''; // Definir fora do try para evitar ReferenceError
    let qtdProdAtual = 0.001;
    let associadosAtuais = [];
    try {
        const componentes = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`);
        const comp = componentes.find(c => c.nome === componente);
        if (comp) {
            categoriaAtual = comp.categoria || '';
            qtdProdAtual = comp.quantidadeProduzida || 0.001;
            associadosAtuais = comp.associados || [];
        }
    } catch (error) {
        console.error('[EDITAR ESTOQUE] Erro ao carregar componente:', error);
        mostrarErro("Erro ao carregar dados do componente.");
        return;
    }
    // Chamar a nova função para abrir popup completo
    abrirPopupComponenteEstoque(false, componente, quantidadeAtual);
}
async function carregarEstoque(termoBusca = "", ordem = "az") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    let url = `/estoque?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
    if (termoBusca) {
        url += `&search=${encodeURIComponent(termoBusca)}`;
    } else {
        url += `&limit=10`;
    }
    try {
        const estoque = await safeApi(url);
        const listaEstoque = document.getElementById("listaEstoque");
        if (listaEstoque) {
            listaEstoque.innerHTML = estoque.map(e =>
                `<div class = "estoque-item-container"><div class="item"><strong>${e.componente || "(Sem nome)"}</strong> - ${formatQuantity(e.quantidade)}x</div> <button class="primary" onclick="editarEstoqueItem('${escapeJsString(e.componente)}', ${e.quantidade})">Editar</button> ${hasPermission('excluirComponente') ? `<button class="warn" onclick="excluirEstoqueItem('${escapeJsString(e.componente)}')">Excluir</button>` : ''}</div>`
            ).join("");
        }
    } catch (error) {
        console.error('[ESTOQUE] Erro ao carregar:', error);
        const listaEstoque = document.getElementById("listaEstoque");
        if (listaEstoque) listaEstoque.innerHTML = '<p>Erro ao carregar estoque.</p>';
    }
}
async function excluirEstoqueItem(nome) {
    if (!hasPermission('excluirComponente')) {
        alert('Você não tem permissão para excluir itens do estoque.');
        return;
    }
    if (!confirm(`Confirmar exclusão do item "${nome}" do estoque? Isso também excluirá o componente e afetará receitas e outros módulos.`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/componentes/excluir?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome })
        });
        if (data.sucesso) {
            await carregarEstoque(document.getElementById("buscaEstoque")?.value || "", document.getElementById("ordemEstoque")?.value || "az");
            if (document.getElementById("lista-componentes")) {
                await carregarComponentesLista(document.getElementById("buscaComponentes")?.value || "", document.getElementById("ordemComponentes")?.value || "az", document.getElementById("filtroCategoriaComponentes")?.value || "");
            }
            if (document.getElementById("listaReceitas")) {
                await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false);
            }
            if (document.getElementById("listaFarmar")) {
                await carregarListaFarmar(document.getElementById("buscaFarmar")?.value || "", document.getElementById("ordemFarmar")?.value || "pendente-desc", document.getElementById("filtroReceitaFarmar")?.value || "");
            }
        } else {
            mostrarErro(data.erro || "Erro ao excluir item do estoque");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir item do estoque: " + error.message);
    }
}
async function carregarLog(componenteFiltro = "", userFiltro = "", dataFiltro = "") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const logs = await safeApi(`/log?game=${encodeURIComponent(currentGame)}`);
        let logsFiltrados = logs.reverse();
        // Filtro por componente
        if (componenteFiltro) {
            logsFiltrados = logsFiltrados.filter(l => l.componente && l.componente.toLowerCase().includes(componenteFiltro.toLowerCase()));
        }
        // Filtro por usuário
        if (userFiltro) {
            logsFiltrados = logsFiltrados.filter(l => l.user && l.user.toLowerCase().includes(userFiltro.toLowerCase()));
        }
        // Filtro por data (convertendo dataFiltro de YYYY-MM-DD para DD/MM/YYYY para matching com dataHora)
        if (dataFiltro) {
            const [ano, mes, dia] = dataFiltro.split('-');
            const dataFormatada = `${dia}/${mes}/${ano}`; // Converter para formato DD/MM/YYYY
            logsFiltrados = logsFiltrados.filter(l => l.dataHora && l.dataHora.startsWith(dataFormatada));
        }
        const div = document.getElementById("logMovimentacoes");
        if (div) {
            div.innerHTML = logsFiltrados.map(l => {
                const simb = l.operacao === "debitar" ? "-" : "+";
                const qtd = l.quantidade ?? 0;
                const nome = l.componente ?? "(Sem nome)";
                const hora = l.dataHora ?? "(Sem data)";
                const user = l.user ? ` por ${l.user}` : ''; // Exibir usuário
                const origem = l.origem ? ` (Origem: ${l.origem})` : "";
                return `<div class="item"><span>[${hora}]</span> ${simb}${formatQuantity(qtd)} x ${nome}${user}${origem}</div>`;
            }).join("");
        }
    } catch (error) {
        console.error('[LOG] Erro ao carregar:', error);
        const div = document.getElementById("logMovimentacoes");
        if (div) div.innerHTML = '<p>Erro ao carregar log.</p>';
    }
}
/* ------------------ ARQUIVADOS ------------------ */
async function montarArquivados() {
    conteudo.innerHTML = `
    <h2>Arquivados</h2>
    <div id="listaArquivados" class="lista"></div>
    `;
    await carregarArquivados();
}
async function carregarArquivados() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const arquivados = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`).catch(() => []);
        const div = document.getElementById("listaArquivados");
        if (div) {
            div.innerHTML = arquivados.map(r => {
                const comps = (r.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
                const btnExcluirHtml = hasPermission('concluirReceitas') ? `<button class="warn" onclick="excluirArquivado('${escapeJsString(r.nome)}')">Excluir</button>` : '';
                return `
                <div class="item">
                  <div>
                    <strong>${r.nome}</strong>
                    ${comps ? `<div class="comps-lista">${comps}</div>` : ""}
                  </div>
                  ${btnExcluirHtml}
                </div>`;
            }).join("");
        }
    } catch (error) {
        console.error('[ARQUIVADOS] Erro ao carregar:', error);
        const div = document.getElementById("listaArquivados");
        if (div) div.innerHTML = '<p>Erro ao carregar arquivados.</p>';
    }
}
async function excluirArquivado(nome) {
    if (!hasPermission('concluirReceitas')) {
        alert('Você não tem permissão para excluir itens arquivados.');
        return;
    }
    if (!confirm(`Confirmar exclusão da receita arquivada "${nome}"?`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        let arquivados = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`).catch(() => []);
        const index = arquivados.findIndex(r => r.nome === nome);
        if (index === -1) {
            mostrarErro("Receita arquivada não encontrada.");
            return;
        }
        arquivados.splice(index, 1);
        const data = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados)
        });
        if (data.sucesso) {
            await carregarArquivados();
        } else {
            mostrarErro(data.erro || "Erro ao excluir receita arquivada");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir receita arquivada: " + error.message);
    }
}
/* ------------------ O QUE FARMAR? ------------------ */
async function montarFarmar() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const categorias = await safeApi(`/categorias?game=${encodeURIComponent(currentGame)}`);
        // Garantir que pegue todas as receitas (evita limite de produção na produção)
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}&limit=9999`);
        const receitasFavoritas = receitas.filter(r => r.favorita);
        conteudo.innerHTML = `
        <h2>O Que farmar?</h2>
        <div id="suggestedSequence">
            <h3>Sequência Sugerida</h3>
            <ol id="sequenceList"></ol>
        </div>
        <div class="filtros">
            <input type="text" id="buscaFarmar" placeholder="Buscar por matéria prima...">
            <div class="multi-select-wrapper">
                <div id="filtroReceitaFarmar" class="dropdown-checkbox">
                    <input type="text" id="searchReceitaFarmar" placeholder="Filtrar receitas...">
                    <ul id="listaReceitasFarmar"></ul>
                </div>
                <span id="selectedBadge" class="badge green">0</span>
                <span id="unselectedBadge" class="badge red">${receitasFavoritas.length}</span>
            </div>
            <select id="filtroCategoriaFarmar">
                <option value="">Todas as categorias</option>
                ${categorias.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
            </select>
            <select id="ordemFarmar">
                <option value="pendente-desc">Pendente Maior-Menor</option>
                <option value="pendente-asc">Pendente Menor-Maior</option>
                <option value="az">Alfabética A-Z</option>
                <option value="za">Alfabética Z-A</option>
            </select>
            <button id="limparFiltrosFarmar" class="secondary">Limpar Filtros</button>
        </div>
        <div id="listaFarmar" class="lista"></div>
        `;
        const buscaInput = document.getElementById("buscaFarmar");
        const filtroReceitaContainer = document.getElementById("filtroReceitaFarmar");
        const searchReceita = document.getElementById("searchReceitaFarmar");
        const listaReceitas = document.getElementById("listaReceitasFarmar");
        const selectedBadge = document.getElementById("selectedBadge");
        const unselectedBadge = document.getElementById("unselectedBadge");
        const categoriaSelect = document.getElementById("filtroCategoriaFarmar");
        const ordemSelect = document.getElementById("ordemFarmar");
        const limparFiltrosFarmar = document.getElementById("limparFiltrosFarmar");
        const savedFilters = JSON.parse(localStorage.getItem(`farmarFilters_${currentGame}`)) || {};
        buscaInput.value = savedFilters.termoBusca || "";
        ordemSelect.value = savedFilters.ordem || "pendente-desc";
        categoriaSelect.value = savedFilters.categoria || "";
        // Popular a lista de receitas com checkboxes
        receitasFavoritas.forEach(receita => {
            const li = document.createElement("li");
            li.innerHTML = `
                <label>
                    <input type="checkbox" value="${receita.nome}">
                    ${receita.nome}
                </label>
            `;
            listaReceitas.appendChild(li);
        });
        // Aplicar seleções salvas
        const savedSelected = savedFilters.selectedReceitas || [];
        Array.from(listaReceitas.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
            cb.checked = savedSelected.includes(cb.value);
        });
        const updateBadges = () => {
            const total = receitasFavoritas.length;
            const selected = listaReceitas.querySelectorAll('input[type="checkbox"]:checked').length;
            selectedBadge.textContent = selected;
            unselectedBadge.textContent = total - selected;
        };
        updateBadges();
        const saveFilters = () => {
            const selected = Array.from(listaReceitas.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            localStorage.setItem(`farmarFilters_${currentGame}`, JSON.stringify({
                termoBusca: buscaInput.value,
                ordem: ordemSelect.value,
                categoria: categoriaSelect.value,
                selectedReceitas: selected
            }));
        };
        // Toggle dropdown ao clicar no input de busca
        searchReceita.addEventListener("focus", () => {
            listaReceitas.style.display = "block";
        });
        // Fechar dropdown ao clicar fora
        document.addEventListener("click", (e) => {
            if (!filtroReceitaContainer.contains(e.target)) {
                listaReceitas.style.display = "none";
            }
        });
        // Filtrar itens ao digitar
        searchReceita.addEventListener("input", () => {
            const termo = searchReceita.value.toLowerCase();
            Array.from(listaReceitas.children).forEach(li => {
                const text = li.textContent.toLowerCase();
                li.style.display = text.includes(termo) ? "block" : "none";
            });
        });
        // Atualizar ao mudar checkboxes
        listaReceitas.addEventListener("change", async () => {
            updateBadges();
            const selected = Array.from(listaReceitas.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            await updateCategoriaFilterOptions(buscaInput.value, selected);
            await carregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
            saveFilters();
        });
        const debouncedCarregarListaFarmar = debounce(carregarListaFarmar, 300);
        buscaInput.addEventListener("input", async () => {
            const selected = Array.from(listaReceitas.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            await updateCategoriaFilterOptions(buscaInput.value, selected);
            await debouncedCarregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
            saveFilters();
        });
        categoriaSelect.addEventListener("change", async () => {
            await debouncedCarregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
            saveFilters();
        });
        ordemSelect.addEventListener("change", async () => {
            await debouncedCarregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
            saveFilters();
        });
        limparFiltrosFarmar.addEventListener("click", async () => {
            buscaInput.value = "";
            searchReceita.value = "";
            Array.from(listaReceitas.querySelectorAll('input[type="checkbox"]')).forEach(cb => cb.checked = false);
            updateBadges();
            categoriaSelect.value = "";
            ordemSelect.value = "pendente-desc";
            await updateCategoriaFilterOptions("", []);
            await carregarListaFarmar("", "pendente-desc", '', "");
            saveFilters();
        });
        // Inicializar opções de categoria
        const initialSelected = Array.from(listaReceitas.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        await updateCategoriaFilterOptions("", initialSelected);
        await carregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
    } catch (error) {
        console.error('[FARMAR] Erro ao montar:', error);
        conteudo.innerHTML = '<h2>Favoritos</h2><p>Erro ao carregar dados.</p>';
    }
}
// Nova função para atualizar opções do filtro de categoria baseado em itens filtrados por busca e receitas
async function updateCategoriaFilterOptions(termoBusca, selectedReceitas) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    const quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    try {
        // Solicitar sem paginação para garantir lista completa
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}&limit=9999`);
        const receitasFavoritas = receitas.filter(r => r.favorita);
        const componentes = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}&limit=9999`);
        const estoqueList = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}&limit=9999`);
        const receitasFiltradas = selectedReceitas.length > 0 ? receitasFavoritas.filter(r => selectedReceitas.includes(r.nome)) : receitasFavoritas;
        const bases = new Map();
        const estoqueMap = {};
        estoqueList.forEach(e => { estoqueMap[e.componente] = e.quantidade || 0; });
        for (const receita of receitasFiltradas) {
            const recipeQuantity = quantities[receita.nome] || 1;
            let req = {};
            receita.componentes.forEach(comp => {
                const qtdNec = comp.quantidade * recipeQuantity;
                mergeReq(req, calculateComponentRequirements(comp.nome, qtdNec, componentes, estoqueMap));
            });
            for (const [baseNome, baseQtd] of Object.entries(req)) {
                if (!bases.has(baseNome)) {
                    bases.set(baseNome, { nec: 0, receitas: new Set() });
                }
                bases.get(baseNome).nec += baseQtd;
                bases.get(baseNome).receitas.add(receita.nome);
            }
        }
        let listaMateriasTemp = Array.from(bases.entries()).map(([nome, data]) => {
            const disp = estoqueMap[nome] || 0;
            const pendente = Math.max(0, data.nec - disp);
            return { nome, nec: data.nec, disp, pendente, receitas: Array.from(data.receitas) };
        });
        // Aplicar filtro de busca para determinar itens relevantes
        listaMateriasTemp = filtrarItens(listaMateriasTemp, termoBusca, "nome");
        // Extrair categorias únicas dos itens relevantes
        const categoriasUnicas = [...new Set(listaMateriasTemp.map(m => {
            const comp = componentes.find(c => c.nome === m.nome);
            return comp ? comp.categoria : null;
        }).filter(cat => cat))].sort();
        // Atualizar select de categorias
        const categoriaSelect = document.getElementById("filtroCategoriaFarmar");
        if (categoriaSelect) {
            const currentValue = categoriaSelect.value;
            categoriaSelect.innerHTML = '<option value="">Todas as categorias</option>' +
                categoriasUnicas.map(cat => `<option value="${cat}">${cat}</option>`).join("");
            // Se o valor atual não está mais disponível, resetar para vazio
            if (currentValue && !categoriasUnicas.includes(currentValue)) {
                categoriaSelect.value = "";
            } else {
                categoriaSelect.value = currentValue;
            }
        }
    } catch (error) {
        console.error('[UPDATE CATEGORIA OPTIONS] Erro:', error);
    }
}
async function carregarListaFarmar(termoBusca = "", ordem = "pendente-desc", receitaFiltro = "", categoriaFiltro = "") {
    // Correção: Verificar se a seção farmar existe antes de prosseguir (evita chamadas desnecessárias de outras seções)
    if (!document.getElementById("listaFarmar")) {
        console.log("[FARMAR] Seção não encontrada, pulando atualização.");
        return;
    }
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    const quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    try {
        // Buscar as listas completas (evitar limite padrão do servidor em produção)
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}&limit=9999`);
        const receitasFavoritas = receitas.filter(r => r.favorita);
        const componentes = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}&limit=9999`);
        const estoqueList = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}&limit=9999`);
        const selectedReceitas = Array.from(document.querySelectorAll('#listaReceitasFarmar input[type="checkbox"]:checked')).map(cb => cb.value);
        const receitasFiltradas = selectedReceitas.length > 0 ? receitasFavoritas.filter(r => selectedReceitas.includes(r.nome)) : receitasFavoritas;
        const bases = new Map();
        const estoqueMap = {};
        estoqueList.forEach(e => { estoqueMap[e.componente] = e.quantidade || 0; });
        for (const receita of receitasFiltradas) {
            if (!receita.nome) continue;
            const recipeQuantity = quantities[receita.nome] || 1;
            let req = {};
            receita.componentes.forEach(comp => {
                const qtdNec = comp.quantidade * recipeQuantity;
                mergeReq(req, calculateComponentRequirements(comp.nome, qtdNec, componentes, estoqueMap));
            });
            for (const [baseNome, baseQtd] of Object.entries(req)) {
                if (!bases.has(baseNome)) {
                    bases.set(baseNome, { nec: 0, receitas: new Set() });
                }
                bases.get(baseNome).nec += baseQtd;
                bases.get(baseNome).receitas.add(receita.nome);
            }
        }
        let listaMaterias = Array.from(bases.entries()).map(([nome, data]) => {
            const disp = estoqueMap[nome] || 0;
            const pendente = Math.max(0, data.nec - disp);
            return { nome, nec: data.nec, disp, pendente, receitas: Array.from(data.receitas) };
        });
        listaMaterias = filtrarItens(listaMaterias, termoBusca, "nome");
        if (categoriaFiltro) {
            listaMaterias = listaMaterias.filter(m => {
                const comp = componentes.find(c => c.nome === m.nome);
                return comp && comp.categoria === categoriaFiltro;
            });
        }
        if (ordem === "pendente-desc") {
            listaMaterias.sort((a, b) => b.pendente - a.pendente);
        } else if (ordem === "pendente-asc") {
            listaMaterias.sort((a, b) => a.pendente - b.pendente);
        } else {
            listaMaterias = ordenarItens(listaMaterias, ordem, "nome");
        }
        const div = document.getElementById("listaFarmar");
        if (div) {
            div.innerHTML = listaMaterias.map(m => {
                const percentage = (m.disp / m.nec) * 100 || 0;
                let color = 'darkred';
                if (percentage >= 100) color = 'darkgreen';
                else if (percentage >= 50) color = 'darkgoldenrod';
                const id = `farmar-${m.nome.replace(/\s/g, '-')}`;
                const component = componentes.find(c => c.nome === m.nome);
                const hasSubs = component && component.associados && component.associados.length > 0;
                const btnFabricarHtml = hasPermission('fabricarComponentes') && hasSubs ? `<button class="btn-fabricar" data-componente="${m.nome}" data-pendente="${m.pendente}" data-qtdprod="${component.quantidadeProduzida || 1}">Fabricar Tudo</button>` : '';
                return `
                <div class="item" style="background-color: ${color}; color: white;" data-componente="${m.nome}">
                    <div class="comp-item">
                        <span class="comp-nome">${m.nome}</span>
                        <span class="comp-nec">Nec: ${formatQuantity(m.nec)}</span>
                        <span class="comp-disp">Disp: ${formatQuantity(m.disp)}</span>
                        <span class="comp-falta">Pendente: ${formatQuantity(m.pendente)}</span>
                    </div>
                    <select class="receitas-dropdown">
                        <option>Receitas (${m.receitas.length})</option>
                        ${m.receitas.sort().map(r => `<option>${r}</option>`).join("")}
                    </select>
                    ${hasSubs ? `<button class="toggle-detalhes" data-target="${id}-detalhes">▼</button>` : ''}
                    <div class="detalhes" id="${id}-detalhes" style="display:none;"></div>
                    ${btnFabricarHtml}
                </div>
            `}).join("");
            // Adicionar event listeners para toggles em farmar
            document.querySelectorAll("#listaFarmar .toggle-detalhes").forEach(btn => {
                btn.addEventListener('click', async () => {
                    const targetId = btn.dataset.target;
                    const detalhes = document.getElementById(targetId);
                    const isVisible = detalhes.style.display !== "none";
                    detalhes.style.display = isVisible ? "none" : "block";
                    btn.textContent = isVisible ? "▼" : "▲";
                    if (!isVisible) {
                        const itemElement = btn.closest(".item");
                        const componenteNome = itemElement.dataset.componente;
                        const m = listaMaterias.find(mat => mat.nome === componenteNome);
                        if (m) {
                            detalhes.innerHTML = `<ul>${getComponentChain(m.nome, m.nec, componentes, estoqueMap)}</ul>`;
                        }
                    }
                });
            });
            // Verificar botões fabricar inicialmente
            if (hasPermission('fabricarComponentes')) {
                document.querySelectorAll("#listaFarmar .item").forEach(async item => {
                    const componenteNome = item.dataset.componente;
                    const componente = componentes.find(c => c.nome === componenteNome);
                    if (componente && componente.associados && componente.associados.length > 0) {
                        let qtdProd = componente.quantidadeProduzida || 1;
                        const m = listaMaterias.find(mat => mat.nome === componenteNome);
                        let pendente = m ? m.pendente : 0;
                        let numCrafts = Math.ceil(pendente / qtdProd);
                        let canFabricate = pendente > 0;
                        if (canFabricate) {
                            for (const assoc of componente.associados) {
                                const subDisp = estoqueMap[assoc.nome] || 0;
                                if (subDisp < assoc.quantidade * numCrafts) {
                                    canFabricate = false;
                                    break;
                                }
                            }
                        }
                        const btn = item.querySelector(".btn-fabricar");
                        if (btn) btn.disabled = !canFabricate;
                    }
                });
                // Adicionar event listeners para botões fabricar
                document.querySelectorAll("#listaFarmar .btn-fabricar").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const componenteNome = btn.dataset.componente;
                        const pendente = parseFloat(btn.dataset.pendente);
                        const qtdProd = parseFloat(btn.dataset.qtdprod);
                        const numCrafts = Math.ceil(pendente / qtdProd);
                        await fabricarComponente(componenteNome, numCrafts);
                        btn.disabled = true;
                    });
                });
            }
        } else {
            console.log("[FARMAR] Skip updating farmar list as div not found.");
        }
        // Computar e exibir sequência sugerida
        let listaMateriasPendentes = listaMaterias.filter(m => m.pendente > 0);
        if (listaMateriasPendentes.length > 0) {
            const sequence = getSuggestedSequence(componentes, listaMateriasPendentes);
            renderSequence(sequence, listaMateriasPendentes, componentes);
        } else {
            document.getElementById("sequenceList").innerHTML = "<li>Nenhuma sequência sugerida disponível.</li>";
        }
    } catch (error) {
        console.error('[FARMAR LISTA] Erro ao carregar:', error);
        const div = document.getElementById("listaFarmar");
        if (div) div.innerHTML = '<p>Erro ao carregar favoritos.</p>';
    }
}
function getSuggestedSequence(componentes, listaMateriasPendentes) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedKey = `suggestedSequence_${currentGame}`;
    const saved = localStorage.getItem(savedKey);
    if (saved) {
        try {
            const savedNames = JSON.parse(saved);
            // Validate that all saved names are in current pendentes
            const validSaved = savedNames.filter(name => listaMateriasPendentes.some(m => m.nome === name));
            if (validSaved.length === listaMateriasPendentes.length) {
                return validSaved.map(name => {
                    const comp = componentes.find(c => c.nome === name);
                    return { nome: name, hasSubs: comp && comp.associados && comp.associados.length > 0 };
                });
            }
        } catch (error) {
            console.error('[SUGGESTED SEQUENCE] Erro ao carregar sequência salva:', error);
        }
    }
    // Fallback to compute
    return computeSuggestedSequence(componentes, listaMateriasPendentes);
}
function renderSequence(sequence, listaMateriasPendentes, componentes) {
    const sequenceList = document.getElementById("sequenceList");
    sequenceList.innerHTML = sequence.map((item, index) => {
        const pendente = listaMateriasPendentes.find(m => m.nome === item.nome)?.pendente || 0;
        const action = item.hasSubs ? "Fabricar" : "Coletar";
        const buttons = true ? `<button class="btn-seq-up" data-index="${index}">↑</button><button class="btn-seq-down" data-index="${index}">↓</button>` : ''; // Modificado: Sempre mostrar botões para usuários logados
        return `<li data-nome="${item.nome}" data-index="${index}">${index + 1}. ${action} ${item.nome} (Pendente: ${formatQuantity(pendente)})${buttons}</li>`;
    }).join("");
    // Adicionar event listeners para reordenação se admin
    if (true) { // Modificado: Sempre adicionar listeners para usuários logados
        sequenceList.querySelectorAll('.btn-seq-up').forEach(btn => {
            btn.addEventListener('click', () => handleSequenceReorder('up', btn, btn, sequence, listaMateriasPendentes, componentes));
        });
        sequenceList.querySelectorAll('.btn-seq-down').forEach(btn => {
            btn.addEventListener('click', () => handleSequenceReorder('down', btn, sequence, listaMateriasPendentes, componentes));
        });
    }
}
function handleSequenceReorder(direction, btn, currentSequence, listaMateriasPendentes, componentes) {
    const li = btn.closest('li');
    const index = parseInt(li.dataset.index);
    let newSequence = [...currentSequence];
    if (direction === 'up' && index > 0) {
        [newSequence[index - 1], newSequence[index]] = [newSequence[index], newSequence[index - 1]];
    } else if (direction === 'down' && index < newSequence.length - 1) {
        [newSequence[index], newSequence[index + 1]] = [newSequence[index + 1], newSequence[index]];
    } else {
        return; // Não pode mover
    }
    // Salvar nova ordem no localStorage
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedKey = `suggestedSequence_${currentGame}`;
    localStorage.setItem(savedKey, JSON.stringify(newSequence.map(s => s.nome)));
    // Re-renderizar com nova sequência
    renderSequence(newSequence, listaMateriasPendentes, componentes);
}
function computeSuggestedSequence(componentes, listaMaterias) {
    const allComponents = new Set(listaMaterias.map(m => m.nome));
    const adj = new Map(); // pré-req -> dependentes
    const indegree = new Map();
    for (let comp of componentes) {
        if (!allComponents.has(comp.nome)) continue;
        indegree.set(comp.nome, indegree.get(comp.nome) || 0);
        for (let assoc of comp.associados || []) {
            if (!allComponents.has(assoc.nome)) continue;
            if (!adj.has(assoc.nome)) adj.set(assoc.nome, []);
            adj.get(assoc.nome).push(comp.nome);
            indegree.set(comp.nome, (indegree.get(comp.nome) || 0) + 1);
        }
    }
    // Adicionar componentes sem entries
    for (let c of allComponents) {
        if (!indegree.has(c)) indegree.set(c, 0);
        if (!adj.has(c)) adj.set(c, []);
    }
    let queue = [];
    for (let [c, d] of indegree) {
        if (d === 0) queue.push(c);
    }
    let order = [];
    while (queue.length > 0) {
        let u = queue.shift();
        const comp = componentes.find(c => c.nome === u);
        const hasSubs = comp && comp.associados && comp.associados.length > 0;
        order.push({ nome: u, hasSubs });
        for (let v of adj.get(u)) {
            indegree.set(v, indegree.get(v) - 1);
            if (indegree.get(v) === 0) queue.push(v);
        }
    }
    // Se houver ciclo, order.length < allComponents.size, mas assumimos sem ciclos
    return order;
}
async function fabricarComponente(nome, numCrafts = 1) {
    if (!hasPermission('fabricarComponentes')) {
        alert('Você não tem permissão para fabricar componentes.');
        return;
    }
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/fabricar?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ componente: nome, numCrafts })
        });
        if (data.sucesso) {
            // Atualizar listas
            await carregarListaFarmar(
                document.getElementById("buscaFarmar")?.value || "",
                document.getElementById("ordemFarmar")?.value || "pendente-desc",
                document.getElementById("filtroReceitaFarmar")?.value || ""
            );
            await carregarEstoque();
            await carregarLog(document.getElementById("buscaLogComponente")?.value || "", document.getElementById("filtroLogUser")?.value || "", document.getElementById("filtroLogData")?.value || "");
        } else {
            mostrarErro(data.erro || "Erro ao fabricar componente");
        }
    } catch (error) {
        mostrarErro("Erro ao fabricar componente: " + error.message);
    }
}
/* ------------------ ROADMAP ------------------ */
async function montarRoadmap() {
    const isAdmin = isUserAdmin();
    conteudo.innerHTML = `
    <h2>Roadmap</h2>
    <div class="filtros">
        <label><input type="checkbox" id="filtroProntasRoadmap"> Visualizar somente receitas prontas</label>
    </div>
    ${hasPermission('criarRoadmap') ? '<button id="btnInserirNovaReceita" class="primary">Inserir nova receita</button>' : ''}
    <div id="listaRoadmap" class="lista" style="flex-direction: column;"></div>
    `;
    if (hasPermission('criarRoadmap')) {
        document.getElementById("btnInserirNovaReceita").addEventListener("click", mostrarPopupAdicionarReceitaRoadmap);
    }
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedFilters = JSON.parse(localStorage.getItem(`roadmapFilters_${currentGame}`)) || {};
    const filtroProntas = document.getElementById("filtroProntasRoadmap");
    filtroProntas.checked = savedFilters.onlyCompleted || false;
    const saveFilters = () => {
        localStorage.setItem(`roadmapFilters_${currentGame}`, JSON.stringify({
            onlyCompleted: filtroProntas.checked
        }));
    };
    filtroProntas.addEventListener("change", () => {
        carregarListaRoadmap(filtroProntas.checked);
        saveFilters();
    });
    await carregarListaRoadmap(filtroProntas.checked);
}
async function carregarListaRoadmap(onlyCompleted = false) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    let quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    try {
        const roadmap = await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`).catch(() => []);
        const receitas = await safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`);
        const componentes = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`);
        const estoqueList = await safeApi(`/estoque?game=${encodeURIComponent(currentGame)}`);
        const estoque = {};
        estoqueList.forEach(e => { estoque[e.componente] = e.quantidade || 0; });
        let roadmapToRender = roadmap;
        if (onlyCompleted) {
            roadmapToRender = roadmap.filter(item => item.completed);
        }
        const div = document.getElementById("listaRoadmap");
        div.innerHTML = roadmapToRender.map((item, visualIndex) => {
            if (onlyCompleted && !item.completed) return '';
            const receita = receitas.find(r => r.nome === item.name);
            if (!receita) return '';
            const index = roadmap.findIndex(r => r.name === item.name); // Usar findIndex para garantir índice correto
            const id = `roadmap-${item.name.replace(/\s/g, '-')}-${visualIndex}`;
            const comps = (receita.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
            const savedQtd = quantities[item.name] || 1;
            const checkboxHtml = hasPermission('marcarProntoRoadmap') ? `<label><input type="checkbox" class="checkbox-completed" ${item.completed ? 'checked' : ''}> Pronto</label>` : '';
            const btnUpDisabled = visualIndex === 0 ? 'disabled' : '';
            const btnDownDisabled = visualIndex === (roadmapToRender.length - 1) ? 'disabled' : '';
            const reordenacaoHtml = hasPermission('reordenarRoadmap') ? `<button class="btn-move-up" ${btnUpDisabled}>↑</button><button class="btn-move-down" ${btnDownDisabled}>↓</button>` : '';
            const btnExcluirHtml = hasPermission('excluirRoadmap') ? `<button class="btn-excluir-roadmap" >Excluir</button>` : '';
            return `
            <div class="item" style="${item.completed ? 'background-color: green;' : ''}" data-receita="${item.name}">
              <div class="receita-header">
                <div class="receita-header--container1">
                  <div style="margin-right: 15px;">
                    <strong class="receita-header--titulo">${item.name}</strong>
                    ${comps ? `<div class="comps-lista">${comps}</div>` : ""}
                    <input type="number" class="qtd-desejada" min="0.001" step="any" value="${savedQtd}" data-receita="${item.name}">
                  </div>
                  <button class="toggle-detalhes" data-target="${id}-detalhes">▼</button>
                </div>
                <div>
                  ${checkboxHtml}
                  ${reordenacaoHtml}
                  ${btnExcluirHtml}
                </div>
              </div>
              <div class="detalhes" id="${id}-detalhes" style="display:none;"></div>
            </div>`;
        }).join("");
        document.querySelectorAll("#listaRoadmap .toggle-detalhes").forEach(btn => {
            btn.addEventListener("click", async () => {
                const targetId = btn.dataset.target;
                const detalhes = document.getElementById(targetId);
                const isVisible = detalhes.style.display !== "none";
                detalhes.style.display = isVisible ? "none" : "block";
                btn.textContent = isVisible ? "▼" : "▲";
                if (!isVisible) {
                    const itemElement = btn.closest(".item");
                    const receitaNome = itemElement.dataset.receita;
                    const qtd = Math.max(Number(itemElement.querySelector(".qtd-desejada").value) || 0.001, 0.001);
                    await atualizarDetalhes(receitaNome, qtd, componentes, estoque, true, true);
                }
            });
        });
        document.querySelectorAll("#listaRoadmap .qtd-desejada").forEach(input => {
            input.addEventListener("input", async () => {
                const itemElement = input.closest(".item");
                const receitaNome = itemElement.dataset.receita;
                const qtd = Math.max(Number(input.value) || 0.001, 0.001);
                quantities[receitaNome] = qtd;
                localStorage.setItem(quantitiesKey, JSON.stringify(quantities));
                const detalhes = itemElement.querySelector(".detalhes");
                if (detalhes && detalhes.style.display !== "none") {
                    await atualizarDetalhes(receitaNome, qtd, componentes, estoque, true, true);
                }
            });
        });
        if (hasPermission('marcarProntoRoadmap')) {
            document.querySelectorAll("#listaRoadmap .checkbox-completed").forEach(cb => {
                cb.addEventListener("change", async () => {
                    const itemElement = cb.closest(".item");
                    const name = itemElement.dataset.receita;
                    const completed = cb.checked;
                    await atualizarRoadmapByName(name, { completed });
                    itemElement.style.backgroundColor = completed ? 'green' : '';
                });
            });
        }
        if (hasPermission('reordenarRoadmap')) {
            document.querySelectorAll("#listaRoadmap .btn-move-up").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const itemElement = btn.closest(".item");
                    const name = itemElement.dataset.receita;
                    const onlyCompleted = document.getElementById("filtroProntasRoadmap")?.checked || false;
                    await reordenarRoadmapVisual(name, 'up', onlyCompleted);
                });
            });
            document.querySelectorAll("#listaRoadmap .btn-move-down").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const itemElement = btn.closest(".item");
                    const name = itemElement.dataset.receita;
                    const onlyCompleted = document.getElementById("filtroProntasRoadmap")?.checked || false;
                    await reordenarRoadmapVisual(name, 'down', onlyCompleted);
                });
            });
        }
        if (hasPermission('excluirRoadmap')) {
            document.querySelectorAll("#listaRoadmap .btn-excluir-roadmap").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const itemElement = btn.closest(".item");
                    const name = itemElement.dataset.receita;
                    await excluirRoadmapItemByName(name);
                });
            });
        }
    } catch (error) {
        console.error('[ROADMAP] Erro ao carregar lista:', error);
        const div = document.getElementById("listaRoadmap");
        if (div) div.innerHTML = '<p>Erro ao carregar roadmap.</p>';
    }
}
// Nova função para reordenar visualmente no roadmap (considera filtro de completas)
async function reordenarRoadmapVisual(name, direction, onlyCompleted) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const roadmap = await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`);
        let filtered = onlyCompleted ? roadmap.filter(item => item.completed) : roadmap;
        const visualIndex = filtered.findIndex(item => item.name === name);
        if (visualIndex === -1) return;
        let swapVisualIndex;
        if (direction === 'up') {
            if (visualIndex === 0) return;
            swapVisualIndex = visualIndex - 1;
        } else {
            if (visualIndex === filtered.length - 1) return;
            swapVisualIndex = visualIndex + 1;
        }
        const name1 = filtered[visualIndex].name;
        const name2 = filtered[swapVisualIndex].name;
        const index1 = roadmap.findIndex(item => item.name === name1);
        const index2 = roadmap.findIndex(item => item.name === name2);
        if (index1 === -1 || index2 === -1) return;
        // Swap
        [roadmap[index1], roadmap[index2]] = [roadmap[index2], roadmap[index1]];
        // Save
        await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roadmap)
        });
        await carregarListaRoadmap(onlyCompleted);
    } catch (error) {
        console.error('[REORDENAR ROADMAP] Erro:', error);
        mostrarErro("Erro ao reordenar roadmap: " + error.message);
    }
}
// Nova função para atualizar item do roadmap por nome
async function atualizarRoadmapByName(name, updates) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const roadmap = await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`);
        const index = roadmap.findIndex(item => item.name === name);
        if (index !== -1) {
            Object.assign(roadmap[index], updates);
            await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(roadmap)
            });
            await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
        }
    } catch (error) {
        console.error('[ATUALIZAR ROADMAP] Erro:', error);
        mostrarErro("Erro ao atualizar roadmap: " + error.message);
    }
}
// Nova função para excluir item do roadmap por nome
async function excluirRoadmapItemByName(name) {
    if (!confirm("Confirmar exclusão da receita do Roadmap?")) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const roadmap = await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`);
        const index = roadmap.findIndex(item => item.name === name);
        if (index === -1) {
            mostrarErro("Item não encontrado no roadmap.");
            return;
        }
        roadmap.splice(index, 1);
        const data = await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roadmap)
        });
        if (data.sucesso) {
            await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
        } else {
            mostrarErro(data.erro || "Erro ao excluir do roadmap");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir do roadmap: " + error.message);
    }
}
function mostrarPopupAdicionarReceitaRoadmap() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupAdicionarRoadmap";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Adicionar Receita ao Roadmap</h2>
        <form id="formAdicionarRoadmap">
            <input type="text" id="searchReceitaRoadmap" list="receitasDatalistRoadmap" placeholder="Digite para buscar receita..." required>
            <datalist id="receitasDatalistRoadmap"></datalist>
            <select id="posicaoRoadmap">
                <option value="end">Adicionar no final</option>
                <option value="start">Adicionar no início</option>
            </select>
            <button type="submit" id="btnAdicionarRoadmap">Adicionar</button>
            <button type="button" id="btnCancelarAdicionarRoadmap">Cancelar</button>
        </form>
    `;
    document.body.appendChild(popup);
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    safeApi(`/receitas?game=${encodeURIComponent(currentGame)}`).then(receitas => {
        const datalist = document.getElementById("receitasDatalistRoadmap");
        datalist.innerHTML = receitas.map(r => `<option value="${r.nome}">`).join("");
        const input = document.getElementById("searchReceitaRoadmap");
        input.addEventListener("input", () => {
            const termo = input.value.toLowerCase();
            const filtered = receitas.filter(r => r.nome.toLowerCase().includes(termo));
            datalist.innerHTML = filtered.map(r => `<option value="${r.nome}">`).join("");
        });
    }).catch(error => {
        console.error('[ROADMAP DATALIST] Erro ao carregar receitas:', error);
    });
    document.getElementById("formAdicionarRoadmap").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = document.getElementById("searchReceitaRoadmap").value.trim();
        const posicao = document.getElementById("posicaoRoadmap").value;
        if (!nome) {
            mostrarErro("Selecione uma receita");
            return;
        }
        // Verificar duplicata
        try {
            const roadmap = await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`).catch(() => []);
            if (roadmap.some(item => item.name === nome)) {
                mostrarErro("Esta receita já existe no roadmap. Não é possível adicionar duplicatas.");
                return;
            }
            const newItem = { name: nome, completed: false };
            if (posicao === "start") {
                roadmap.unshift(newItem);
            } else {
                roadmap.push(newItem);
            }
            await safeApi(`/roadmap?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(roadmap)
            });
            popup.remove();
            overlay.remove();
            await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
        } catch (error) {
            mostrarErro("Erro ao adicionar ao roadmap: " + error.message);
        }
    });
    document.getElementById("btnCancelarAdicionarRoadmap").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}
/* ------------------ CATEGORIAS ------------------ */
async function montarCategorias() {
    conteudo.innerHTML = `
    <h2>Categorias</h2>
    <div class="filtros">
        <input type="text" id="buscaCategorias" placeholder="Buscar por nome...">
        <select id="ordemCategorias">
            <option value="az">Alfabética A-Z</option>
            <option value="za">Alfabética Z-A</option>
        </select>
        ${hasPermission('criarCategorias') ? '<button id="btnNovaCategoria" class="primary">+ Nova Categoria</button>' : ''}
    </div>
    <div id="lista-categorias" class="lista"></div>
    `;
    if (hasPermission('criarCategorias')) {
        document.getElementById("btnNovaCategoria").addEventListener("click", () => abrirPopupCategoria(null));
    }
    const buscaInput = document.getElementById("buscaCategorias");
    const ordemSelect = document.getElementById("ordemCategorias");
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedFilters = JSON.parse(localStorage.getItem(`categoriasFilters_${currentGame}`)) || {};
    buscaInput.value = savedFilters.termoBusca || "";
    ordemSelect.value = savedFilters.ordem || "az";
    const saveFilters = () => {
        localStorage.setItem(`categoriasFilters_${currentGame}`, JSON.stringify({
            termoBusca: buscaInput.value,
            ordem: ordemSelect.value
        }));
    };
    const debouncedCarregarCategoriasLista = debounce(carregarCategoriasLista, 300);
    buscaInput.addEventListener("input", () => {
        debouncedCarregarCategoriasLista(buscaInput.value, ordemSelect.value);
        saveFilters();
    });
    ordemSelect.addEventListener("change", () => {
        debouncedCarregarCategoriasLista(buscaInput.value, ordemSelect.value);
        saveFilters();
    });
    await carregarCategoriasLista(buscaInput.value, ordemSelect.value);
}
async function carregarCategoriasLista(termoBusca = "", ordem = "az") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const catRes = await safeApi(`/categorias?game=${encodeURIComponent(currentGame)}`);
        let categorias = Array.isArray(catRes) ? catRes : [];
        const compRes = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}`);
        const comps = Array.isArray(compRes) ? compRes : [];
        const counts = {};
        comps.forEach(c => {
            if (c.categoria) {
                counts[c.categoria] = (counts[c.categoria] || 0) + 1;
            }
        });
        if (termoBusca) {
            categorias = categorias.filter(c => c.toLowerCase().includes(termoBusca.toLowerCase()));
        }
        if (ordem === "az") {
            categorias.sort((a, b) => a.localeCompare(b));
        } else if (ordem === "za") {
            categorias.sort((a, b) => b.localeCompare(a));
        }
        const div = document.getElementById("lista-categorias");
        if (div) {
            div.innerHTML = categorias.map(cat => {
                const count = counts[cat] || 0;
                const btnExcluirHtml = hasPermission('excluirCategorias') && count === 0 ? `<button onclick="excluirCategoria('${escapeJsString(cat)}')" class="warn">Excluir</button>` : '';
                return `
          <div class="item">
            <div>
              <strong>${cat}</strong> (${count} componentes)
            </div>
            <div class="acoes">
              ${btnExcluirHtml}
            </div>
          </div>`;
            }).join("");
        }
    } catch (error) {
        console.error('[CATEGORIAS] Erro ao carregar dados:', error);
        const div = document.getElementById("lista-categorias");
        if (div) div.innerHTML = '<p>Erro ao carregar categorias.</p>';
    }
}
function abrirPopupCategoria() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupCategoria";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Nova Categoria</h2>
        <form id="formCategoria">
            <input type="text" id="categoriaNome" placeholder="Nome da Categoria" required pattern="[a-zA-Z0-9 ]+">
            <button type="submit" id="btnCriarCategorias">Criar</button>
            <button type="button" id="btnCancelarCategoria">Cancelar</button>
            <p id="erroCategoria" style="color: red; display: none;"></p>
        </form>
    `;
    document.body.appendChild(popup);
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    document.getElementById("formCategoria").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = document.getElementById("categoriaNome").value.trim();
        if (!nome) {
            const erroEl = document.getElementById("erroCategoria");
            if (erroEl) {
                erroEl.textContent = "Nome da categoria é obrigatório";
                erroEl.style.display = "block";
            }
            return;
        }
        try {
            const data = await safeApi(`/categorias?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome })
            });
            if (data.sucesso) {
                popup.remove();
                overlay.remove();
                await carregarCategoriasLista(
                    document.getElementById("buscaCategorias")?.value || "",
                    document.getElementById("ordemCategorias")?.value || "az"
                );
                await carregarCategoriasDatalist();
            } else {
                const erroEl = document.getElementById("erroCategoria");
                if (erroEl) {
                    erroEl.textContent = data.erro || "Erro ao criar categoria";
                    erroEl.style.display = "block";
                }
            }
        } catch (error) {
            const erroEl = document.getElementById("erroCategoria");
            if (erroEl) {
                erroEl.textContent = "Erro ao criar categoria";
                erroEl.style.display = "block";
            }
        }
    });
    document.getElementById("btnCancelarCategoria").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}
async function excluirCategoria(nome) {
    if (!hasPermission('excluirCategorias')) {
        alert('Você não tem permissão para excluir categorias.');
        return;
    }
    if (!confirm(`Confirmar exclusão da categoria "${nome}"?`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/categorias/excluir?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome })
        });
        if (data.sucesso) {
            await carregarCategoriasLista(
                document.getElementById("buscaCategorias")?.value || "",
                document.getElementById("ordemCategorias")?.value || "az"
            );
            await carregarCategoriasDatalist();
        } else {
            mostrarErro(data.erro || "Erro ao excluir categoria");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir categoria: " + error.message);
    }
}
/* ------------------ UTIL ------------------ */
function formatQuantity(quantity) {
    if (quantity == null) return '0';
    quantity = Number(quantity);
    if (isNaN(quantity)) return '0';
    return Number.isInteger(quantity) ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '');
}
function mostrarErro(msg) {
    // Remover overlay e modal existentes para evitar conflitos
    const existingOverlay = document.getElementById("overlay");
    if (existingOverlay) existingOverlay.remove();
    const existingModal = document.getElementById("modalErro");
    if (existingModal) existingModal.remove();
    const overlay = criarOverlay();
    const modalErro = document.createElement("div");
    modalErro.id = "modalErro";
    modalErro.style.position = "fixed";
    modalErro.style.top = "50%";
    modalErro.style.left = "50%";
    modalErro.style.transform = "translate(-50%, -50%)";
    modalErro.style.backgroundColor = "white";
    modalErro.style.padding = "20px";
    modalErro.style.zIndex = "1000";
    modalErro.style.borderRadius = "5px";
    modalErro.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
    // Criar o botão de fechar antes de append para garantir o listener
    const buttonClose = document.createElement("button");
    buttonClose.id = "fecharModal";
    buttonClose.style.background = "none";
    buttonClose.style.border = "none";
    buttonClose.style.fontSize = "16px";
    buttonClose.style.cursor = "pointer";
    buttonClose.innerHTML = "❌";
    modalErro.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Erro</h3>
            ${buttonClose.outerHTML}
        </div>
        <p id="mensagemErro">${msg}</p>
    `;
    // Adicionar listener imediatamente após criar o botão
    buttonClose.addEventListener("click", () => {
        modalErro.remove();
        const currentOverlay = document.getElementById("overlay");
        if (currentOverlay) currentOverlay.remove();
    });
    document.body.appendChild(modalErro);
    // Re-adicionar listener para segurança (caso haja manipulação DOM)
    const fecharModal = document.getElementById("fecharModal");
    if (fecharModal) {
        fecharModal.addEventListener("click", () => {
            modalErro.remove();
            const currentOverlay = document.getElementById("overlay");
            if (currentOverlay) currentOverlay.remove();
        });
    }
    // Fechar ao clicar no overlay
    overlay.addEventListener("click", () => {
        modalErro.remove();
        overlay.remove();
    });
}