// index.js
//rodar node servidor.js (no terminal)

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API = isLocal ? "http://localhost:10000" : "https://mmorpg-crafter.onrender.com";
const RECAPTCHA_SITE_KEY = "6LeLG-krAAAAAFhUEHtBb3UOQefm93Oz8k5DTpx_"; // SUBSTITUA PELA SITE KEY OBTIDA NO GOOGLE

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
    updateToggleButtonText(savedMode);

    if (sessionStorage.getItem("loggedIn")) {
        mostrarBotaoMinhaConta(); // Movido para antes do await para garantir visibilidade imediata
        initMenu();
        await initGames();
        await carregarUserStatus(); // Novo: Carregar status do usuário incluindo isAdmin
        const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
        carregarSecao(ultimaSecao);
    } else {
        mostrarPopupLogin();
    }
});

// Novo: Função para carregar status do usuário (inclui isAdmin)
async function carregarUserStatus() {
    try {
        const response = await fetch(`${API}/user-status`, { credentials: 'include' });
        const status = await response.json();
        sessionStorage.setItem('isFounder', status.isFounder.toString());
        sessionStorage.setItem('isAdmin', status.isAdmin.toString()); // Novo: Salvar isAdmin
        sessionStorage.setItem('effectiveUser', status.effectiveUser);
    } catch (error) {
        console.error('[USER STATUS] Erro ao carregar status:', error);
        sessionStorage.setItem('isFounder', 'false');
        sessionStorage.setItem('isAdmin', 'false');
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

// Novo: Função para mostrar botão "Minha Conta"
function mostrarBotaoMinhaConta() {
    const botaoMinhaConta = document.createElement("button");
    botaoMinhaConta.id = "botaoMinhaConta";
    botaoMinhaConta.textContent = "Minha Conta";
    botaoMinhaConta.style.position = "fixed";
    botaoMinhaConta.style.top = "20px";
    botaoMinhaConta.style.right = "20px";
    botaoMinhaConta.style.padding = "12px 20px";
    botaoMinhaConta.style.background = "var(--primary-gradient)";
    botaoMinhaConta.style.color = "white";
    botaoMinhaConta.style.borderRadius = "var(--border-radius-lg)";
    botaoMinhaConta.style.cursor = "pointer";
    botaoMinhaConta.style.zIndex = "1000";
    botaoMinhaConta.style.fontWeight = "600";
    botaoMinhaConta.style.boxShadow = "var(--shadow-lg)";
    botaoMinhaConta.style.transition = "all var(--transition-base)";
    botaoMinhaConta.addEventListener("mouseover", () => {
        botaoMinhaConta.style.background = "var(--primary-gradient-hover)";
        botaoMinhaConta.style.transform = "translateY(-2px)";
    });
    botaoMinhaConta.addEventListener("mouseout", () => {
        botaoMinhaConta.style.background = "var(--primary-gradient)";
        botaoMinhaConta.style.transform = "translateY(0)";
    });
    botaoMinhaConta.addEventListener("click", mostrarPopupMinhaConta);
    document.body.appendChild(botaoMinhaConta);
}

// Novo: Popup para "Minha Conta"
async function mostrarPopupMinhaConta() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupMinhaConta";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.minWidth = "300px";

    // Buscar dados do usuário do servidor via endpoint /me
    try {
        const response = await fetch(`${API}/me`, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const usuario = await response.json();

        popup.innerHTML = `
            <h2>Minha Conta</h2>
            <p><strong>Nome:</strong> #${usuario.id}${usuario.nome}</p>
            <p><strong>Email:</strong> ${usuario.email}</p>
            <button id="btnMudarSenha">Mudar Senha</button>
            <button id="btnLogout">Logout</button>
            <button type="button" id="btnFecharMinhaConta">Fechar</button>
        `;
    } catch (error) {
        console.error('[MINHA CONTA] Erro ao carregar dados:', error);
        popup.innerHTML = `
            <h2>Minha Conta</h2>
            <p>Erro ao carregar dados: ${error.message}</p>
            <button type="button" id="btnFecharMinhaConta">Fechar</button>
        `;
    }

    document.body.appendChild(popup);

    // Adicionar event listeners após appendChild para garantir que os elementos estejam no DOM
    const btnMudarSenha = document.getElementById("btnMudarSenha");
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener("click", () => {
            popup.remove();
            overlay.remove();
            mostrarPopupMudarSenha();
        });
    }

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            sessionStorage.removeItem("loggedIn");
            sessionStorage.removeItem("userEmail");
            popup.remove();
            overlay.remove();
            window.location.reload(); // Recarrega para mostrar popup login
        });
    }

    const btnFecharMinhaConta = document.getElementById("btnFecharMinhaConta");
    if (btnFecharMinhaConta) {
        btnFecharMinhaConta.addEventListener("click", () => {
            popup.remove();
            overlay.remove();
        });
    }
}

// Novo: Popup para Mudar Senha
function mostrarPopupMudarSenha() {
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
            const response = await fetch(`${API}/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldPassword: senhaAtual, newPassword: novaSenha }),
                credentials: 'include'
            });
            const data = await response.json();
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
    let currentGame = localStorage.getItem("currentGame");
    if (!currentGame) {
        currentGame = "Pax Dei";
        localStorage.setItem("currentGame", currentGame);
    }
    await carregarGamesSelector();
}

async function carregarGamesSelector() {
    const games = await fetch(`${API}/games`, { credentials: 'include' }).then(r => r.json());
    const menu = document.querySelector(".menu");
    if (!menu) return;

    // Remove existing selector and new game if any
    const existingSelector = document.getElementById("gameSelectorLi");
    if (existingSelector) existingSelector.remove();
    const existingNewGame = document.getElementById("newGameLi");
    if (existingNewGame) existingNewGame.remove();

    // Adicionar seletor de jogos
    const gameSelectorLi = document.createElement("li");
    gameSelectorLi.id = "gameSelectorLi";
    gameSelectorLi.innerHTML = `
        <select id="gameSelector">
            ${games.map(g => `<option value="${g}" ${g === localStorage.getItem("currentGame") ? 'selected' : ''}>${g}</option>`).join("")}
        </select>
    `;
    menu.prepend(gameSelectorLi);

    document.getElementById("gameSelector").addEventListener("change", async (e) => {
        const newGame = e.target.value;
        localStorage.setItem("currentGame", newGame);
        const currentSecao = localStorage.getItem("ultimaSecao") || "receitas";
        await carregarSecao(currentSecao);
    });

    // Adicionar botão Novo Jogo
    const newGameLi = document.createElement("li");
    newGameLi.id = "newGameLi";
    newGameLi.textContent = "Novo Jogo";
    newGameLi.addEventListener("click", mostrarPopupNovoJogo);
    menu.prepend(newGameLi);
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
            const response = await fetch(`${API}/games`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: nome }),
                credentials: 'include'
            });
            const data = await response.json();
            if (data.sucesso) {
                localStorage.setItem("currentGame", nome);
                popup.remove();
                overlay.remove();
                await carregarGamesSelector();
                const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
                carregarSecao(ultimaSecao);
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
    const sections = [
        { section: "home", text: "Bem vindo!" },
        { section: "categorias", text: "Categorias" },
        { section: "componentes", text: "Componentes" },
        { section: "estoque", text: "Estoque de componentes" },
        { section: "receitas", text: "Receitas" },
        { section: "farmar", text: "Favoritos" },
        { section: "roadmap", text: "Roadmap" },
        { section: "arquivados", text: "Arquivados" },
        { section: "time", text: "Time" },
    ];
    sections.forEach(sec => {
        const li = document.createElement("li");
        li.dataset.section = sec.section;
        li.textContent = sec.text;
        li.addEventListener("click", () => carregarSecao(sec.section));
        menu.appendChild(li);
    });
}

const botaoDeMinimizar = document.querySelector('#botaoDeMinimizarMenu')

function minimizarOmenu() {
    const menuLateral = document.querySelector('aside')
    const itensDoMenu = document.querySelectorAll('.menu li')
    let listaDeClasseDoMenu = menuLateral.classList;
    if (listaDeClasseDoMenu.length < 1) {
        menuLateral.classList.add('menulateralMinimizado')
        botaoDeMinimizar.style = 'left: 56px!important;'
        botaoDeMinimizar.innerHTML = 'Maximizar Menu'
        itensDoMenu.forEach(item => item.style = "display: none!important")
    } else {
        menuLateral.classList.remove('menulateralMinimizado')
        botaoDeMinimizar.style = 'left: 316px!important;'
        botaoDeMinimizar.innerHTML = 'Minimizar Menu'
        itensDoMenu.forEach(item => item.style = "display: block")
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
            const response = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha, recaptchaToken: token }),
                credentials: 'include'
            });
            const data = await response.json();
            if (data.sucesso) {
                sessionStorage.setItem("loggedIn", "true");
                sessionStorage.setItem("userEmail", email);
                popup.remove();
                overlay.remove();
                mostrarBotaoMinhaConta(); // Garantir que o botão apareça após login
                initMenu();
                await initGames();
                await carregarUserStatus(); // Novo: Carregar status após login
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
            const response = await fetch(`${API}/cadastro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email, senha, recaptchaToken: token }),
                credentials: 'include'
            });
            const data = await response.json();
            if (data.sucesso) {
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
    if (secao === "home") return montarManual(); // Novo: Manual de uso
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

// Novo: Função para montar o manual de uso
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
                "Todas as ações são salvas por jogo (você pode alternar entre jogos no menu superior).",
                "A autenticação é obrigatória para acessar as funcionalidades. Após login, você tem acesso total às ferramentas."
            ]
        },
        {
            titulo: "Sistema de Time e Permissões",
            itens: [
                "O sistema de time permite colaborar com outros jogadores. Há três papéis: Fundador (dono do time), Co-fundador (pode editar tudo como o fundador) e Membro (pode visualizar e usar, mas não editar).",
                "Para adicionar alguém ao time: Vá na aba 'Time', na seção 'Convidar Novo Membro', digite o email e clique 'Convidar'. O convidado recebe uma pendência e pode aceitar/recusar.",
                "Aceitar convite: Na aba 'Time', na seção 'Pendências de Convite', clique 'Aceitar' para entrar no time do fundador.",
                "Promover a co-fundador: Na aba 'Time', na lista de associados, clique 'Promover a Co-Fundador' (apenas fundadores podem fazer isso).",
                "Desvincular/Banir: Na aba 'Time', use os botões 'Desvincular' ou 'Banir' para remover alguém. Banidos não podem se juntar novamente sem desbanimento.",
                "Sair do time: Na aba 'Time', clique 'Sair do Time' (apenas membros podem sair; fundadores desvinculam outros)."
            ]
        },
        {
            titulo: "Gerenciando Jogos",
            itens: [
                "Para criar um novo jogo: Clique em 'Novo Jogo' no menu superior, digite o nome e confirme. Um novo conjunto de arquivos (receitas, estoque etc.) é criado.",
                "Alternar jogo: Use o seletor de jogos no menu superior para mudar entre jogos salvos. As configurações (filtros, quantidades) são salvas por jogo."
            ]
        },
        {
            titulo: "Gerenciando Receitas",
            itens: [
                "Para criar uma nova receita: Na aba 'Receitas', clique '+ Nova Receita'. Digite o nome e adicione componentes com quantidades.",
                "Editar/Duplicar: Clique 'Editar' para modificar ou 'Duplicar' para criar uma cópia (útil para variações).",
                "Favoritar: Clique 'Favoritar' para marcar como favorita (aparece em 'Favoritos').",
                "Concluir: Insira a quantidade desejada e clique 'Concluir' (debitará do estoque automaticamente; apenas fundadores/co-fundadores).",
                "Arquivar: Clique 'Arquivar' para mover para 'Arquivados' (remove de receitas ativas; apenas fundadores/co-fundadores).",
                "Visualizar detalhes: Clique na seta ▼ ao lado da receita para ver requisitos de componentes e subcomponentes."
            ]
        },
        {
            titulo: "Gerenciando Componentes",
            itens: [
                "Para criar um novo componente: Na aba 'Componentes', clique '+ Novo Componente'. Defina nome, categoria, quantidade produzida e materiais associados.",
                "Editar: Clique 'Editar' para alterar (propaga mudanças para receitas e estoque automaticamente).",
                "Excluir: Clique 'Excluir' (remove referências em receitas/arquivados; apenas fundadores/co-fundadores).",
                "Categorias: Na aba 'Categorias', crie ou exclua categorias para organizar componentes."
            ]
        },
        {
            titulo: "Gerenciando Estoque e Log",
            itens: [
                "Adicionar/Debitar: Na aba 'Estoque', use o formulário para adicionar ou debitar itens manualmente. O log registra todas as movimentações.",
                "Editar item: Clique 'Editar' em um item do estoque para ajustar a quantidade.",
                "Excluir item: Clique 'Excluir' (remove do estoque e componente; afeta receitas).",
                "Zerar estoque: Clique 'Zerar todo o estoque' (apenas fundadores/co-fundadores).",
                "Filtrar log: Na seção 'Log de Movimentações', busque por componente ou data."
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
                "Adicionar: Clique 'Inserir nova receita' e selecione uma receita para adicionar ao plano.",
                "Reordenar: Use ↑/↓ para mover itens no roadmap.",
                "Marcar como pronto: Marque o checkbox 'Pronto' para indicar conclusão (filtro para ver só prontas).",
                "Excluir: Clique 'Excluir' (apenas fundadores/co-fundadores)."
            ]
        },
        {
            titulo: "Minha Conta",
            itens: [
                "Clique no botão 'Minha Conta' (canto superior direito) para ver seus dados, mudar senha ou fazer logout.",
                "Mudar senha: Digite a atual e a nova (confirmação obrigatória)."
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
        const response = await fetch(`${API}/user-status`, { credentials: 'include' });
        const status = await response.json();
        isFounder = status.isFounder;
        effectiveUser = status.effectiveUser;
        sessionStorage.setItem('isFounder', status.isFounder.toString());
        sessionStorage.setItem('effectiveUser', effectiveUser);
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
            const [associadosRes, banidosRes, disponiveisRes] = await Promise.all([
                fetch(`${API}/associacoes`, { credentials: 'include' }),
                fetch(`${API}/banidos`, { credentials: 'include' }),
                fetch(`${API}/usuarios-disponiveis`, { credentials: 'include' })
            ]);
            const associados = await associadosRes.json();
            const banidosComRole = await banidosRes.json();
            const disponiveisAll = await disponiveisRes.json();

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
                return `
                            <li class="time-item">
                                ${a.secondary}
                                ${isCoFounder ? '<span style="color: green;"> (Co-Fundador)</span>' : ''}
                                <button class="btn-promote-cofounder" onclick="toggleCoFounder('${a.secondary}', ${isCoFounder})">${isCoFounder ? 'Remover Co-Fundador' : 'Promover a Co-Fundador'}</button>
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
        } catch (error) {
            console.error('[TIME] Erro ao carregar lista:', error);
            html += '<p>Erro ao carregar dados do time.</p>';
        }
    }

    div.innerHTML = html;
    await carregarPendencias();

    // Novo: Event listener para toggle co-founder (apenas se founder)
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
}

// Nova: Função para toggle co-founder
async function toggleCoFounder(secondary, isCoFounder) {
    if (!confirm(`Confirmar ${isCoFounder ? 'remoção de co-fundador' : 'promoção a co-fundador'} para ${secondary}?`)) return;
    try {
        const response = await fetch(`${API}/promote-cofounder`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secondary, promote: !isCoFounder }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarUserStatus(); // Recarregar status para atualizar isAdmin global
            await carregarListaTime(); // Recarregar lista
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
        const pendenciasRes = await fetch(`${API}/pendencias`, { credentials: 'include' });
        const pendencias = await pendenciasRes.json();
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

async function enviarConvidar(email, btn = null, feedbackDiv = null, input = null) {
    if (!confirm(`Enviar convite para ${email}?`)) return;
    if (btn) btn.disabled = true;
    if (input) input.disabled = true;
    if (feedbackDiv) feedbackDiv.style.display = "none";
    try {
        const response = await fetch(`${API}/enviar-convite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: email }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            mostrarSucesso("Convite enviado ✅");
            if (input) input.value = "";
            await carregarListaTime();
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
    const overlay = criarOverlay();
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
    modalSucesso.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="color: #48bb78; margin: 0;">Sucesso</h3>
            <button id="fecharModalSucesso" style="background: none; border: none; font-size: 16px; cursor: pointer;">❌</button>
        </div>
        <p id="mensagemSucesso" style="color: #48bb78; margin: 0;">${msg}</p>
    `;
    document.body.appendChild(modalSucesso);

    const fecharModalSucesso = document.getElementById("fecharModalSucesso");
    fecharModalSucesso.addEventListener("click", () => {
        modalSucesso.remove();
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.remove();
    });

    // Auto-remove após 1 segundo
    setTimeout(() => {
        modalSucesso.remove();
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.remove();
    }, 1000);
}

async function aceitarConvidar(from) {
    if (!confirm(`Aceitar convite de ${from}?`)) return;
    try {
        const response = await fetch(`${API}/aceitar-convite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarListaTime();
            window.location.reload(); // Refresh automático para atualizar games e estado
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
        const response = await fetch(`${API}/recusar-convite`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ from }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarPendencias();
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
        const response = await fetch(`${API}/dissociate-as-secondary`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ primary }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            localStorage.removeItem("currentGame");
            await carregarListaTime();
            window.location.reload(); // Refresh automático para atualizar games e estado
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
        const response = await fetch(`${API}/associate-self`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secondary: email }),
            credentials: 'include'
        });
        const data = await response.json();
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
        const response = await fetch(`${API}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarListaTime();
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
        const response = await fetch(`${API}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarListaTime();
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
        const response = await fetch(`${API}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarListaTime();
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
        ${isAdmin ? '<button id="btnNovaReceita" class="primary">+ Nova Receita</button>' : ''}
    </div>
    <div id="listaReceitas" class="lista"></div>
    `;
    if (isAdmin) {
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
    let url = `${API}/receitas?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
    if (termoBusca) {
        url += `&search=${encodeURIComponent(termoBusca)}`;
    }
    if (onlyFavorites) {
        url += `&favoritas=true`;
    }
    if (!termoBusca && !onlyFavorites) {
        url += `&limit=10`;
    }
    let receitas = await fetch(url, { credentials: 'include' }).then(r => r.json());
    const componentes = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const estoqueList = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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
        const btnConcluirHtml = isAdmin ? `<button class="btn-concluir" data-receita="${r.nome}">Concluir</button>` : '';
        const btnEditarHtml = isAdmin ? `<button class="btn-editar" data-nome="${r.nome}">Editar</button>` : '';
        const btnArquivarHtml = isAdmin ? `<button class="btn-arquivar" data-nome="${r.nome}">Arquivar</button>` : '';
        const btnDuplicarHtml = isAdmin ? `<button class="btn-duplicar" data-nome="${r.nome}">Duplicar</button>` : '';
        return `
        <div class="item ${r.favorita ? 'favorita' : ''}" data-receita="${r.nome}">
          <div class="receita-header">
            <div class = "receita-header--container1"><div style="margin-right: 15px;"><strong class= "receita-header--titulo">${r.nome}</strong>
            ${comps ? `<div class="comps-lista">${comps}</div>` : ""}
            <input type="number" class="qtd-desejada" min="0.001" step="any" value="${savedQtd}" data-receita="${r.nome}"></div>
            <button class="toggle-detalhes" data-target="${id}-detalhes">▼</button></div><div>
            ${btnConcluirHtml}
            ${btnEditarHtml}
            ${btnArquivarHtml}
            ${btnDuplicarHtml}
            <button class="btn-favoritar ${r.favorita ? 'favorita' : ''}" data-nome="${r.nome}">${r.favorita ? 'Desfavoritar' : 'Favoritar'}</button></div>
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
                if (isAdmin) await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
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
                if (isAdmin) await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
            }
        });
    });

    if (isAdmin) {
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

        document.querySelectorAll(".btn-editar").forEach(btn => {
            btn.addEventListener("click", () => {
                const nome = btn.dataset.nome;
                console.log(`[EDITAR] Botão Editar clicado para receita: ${nome}`);
                editarReceita(nome);
            });
        });

        document.querySelectorAll(".btn-duplicar").forEach(btn => {
            btn.addEventListener("click", () => {
                const nome = btn.dataset.nome;
                console.log(`[DUPLICAR] Botão Duplicar clicado para receita: ${nome}`);
                duplicarReceita(nome);
            });
        });
    }

    document.querySelectorAll(".btn-favoritar").forEach(btn => {
        btn.addEventListener("click", async () => {
            const nome = btn.dataset.nome;
            const isFavorita = btn.classList.contains('favorita');
            await toggleFavorita(nome, !isFavorita);
        });
    });

    // Verificar botões inicialmente
    if (isAdmin) {
        document.querySelectorAll(".item").forEach(async item => {
            const receitaNome = item.dataset.receita;
            const qtd = Math.max(Number(item.querySelector(".qtd-desejada").value) || 0.001, 0.001);
            await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
        });
    }
}

async function toggleFavorita(nome, favorita) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const response = await fetch(`${API}/receitas/favoritar?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome, favorita }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az");
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
        // Carregar receitas atuais
        const receitasAtuais = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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
        const receitasResponse = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(receitasAtuais),
            credentials: 'include'
        });
        const receitasData = await receitasResponse.json();
        console.log(`[ARQUIVAR] Resposta do servidor (receitas):`, receitasData);
        if (!receitasData.sucesso) {
            console.error(`[ARQUIVAR] Erro ao salvar receitas.json:`, receitasData.erro);
            mostrarErro("Erro ao remover receita: " + (receitasData.erro || "Falha desconhecida"));
            return;
        }

        // Adicionar receita a arquivados.json
        const arquivados = await fetch(`${API}/arquivados?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
        console.log(`[ARQUIVAR] Arquivados atuais:`, arquivados);
        arquivados.push(receitaArquivada);
        console.log(`[ARQUIVAR] Adicionando receita "${receitaNome}" a arquivados.json`);
        const arquivadosResponse = await fetch(`${API}/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados),
            credentials: 'include'
        });
        const arquivadosData = await arquivadosResponse.json();
        console.log(`[ARQUIVAR] Resposta do servidor (arquivados):`, arquivadosData);
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
        await carregarListaFarmar(
            document.getElementById("buscaFarmar")?.value || "",
            document.getElementById("ordemFarmar")?.value || "pendente-desc",
            document.getElementById("filtroReceitaFarmar")?.value || ""
        );
        console.log(`[ARQUIVAR] Receita "${receitaNome}" arquivada com sucesso.`);
    } catch (error) {
        console.error(`[ARQUIVAR] Erro ao arquivar receita "${receitaNome}":`, error);
        mostrarErro("Erro ao arquivar receita: " + error.message);
    }
}

async function atualizarDetalhes(receitaNome, qtd, componentesData, estoque, collapsible = false, hidePrefix = false) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const receita = receitas.find(r => r.nome === receitaNome);
    if (!receita) {
        console.error(`[DETALHES] Receita "${receitaNome}" não encontrada`);
        return;
    }

    const detalhes = document.querySelector(`[data-receita="${receitaNome}"] .detalhes`);
    if (!detalhes) {
        console.error(`[DETALHES] Elemento detalhes para receita "${receitaNome}" não encontrado`);
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
    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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

    const estoqueAtualizado = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const estoqueMap = {};
    estoqueAtualizado.forEach(e => { estoqueMap[e.componente] = e.quantidade || 0; });

    const podeConcluir = Object.entries(requisitos).every(([nome, nec]) => {
        const disp = estoqueMap[nome] !== undefined ? estoqueMap[nome] : 0;
        return disp >= nec;
    });

    btn.disabled = !podeConcluir;
}

async function concluirReceita(receitaNome, qtd, componentesData, estoque) {
    console.log(`[CONCLUIR] Iniciando conclusão da receita: ${receitaNome}, quantidade: ${qtd}`);

    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    let quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};

    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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

    try {
        // Debitar do estoque
        for (const [componente, quantidade] of Object.entries(requisitos)) {
            console.log(`[CONCLUIR] Debitando ${quantidade} de ${componente} do estoque`);
            const response = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ componente, quantidade, operacao: "debitar" }),
                credentials: 'include'
            });
            const data = await response.json();
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
            user: userEmail  // Novo: Adicionar usuário
        }));
        console.log("[CONCLUIR] Registrando no log:", logEntries);
        const logResponse = await fetch(`${API}/log?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(logEntries),
            credentials: 'include'
        });
        const logData = await logResponse.json();
        if (!logData.sucesso) {
            mostrarErro("Erro ao registrar log.");
            return;
        }

        // Arquivar a receita e remover de receitas
        const receitasAtuais = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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
        const receitasResponse = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(receitasAtuais),
            credentials: 'include'
        });
        const receitasData = await receitasResponse.json();
        console.log("[CONCLUIR] Resposta do servidor (receitas):", receitasData);
        if (!receitasData.sucesso) {
            console.error(`[CONCLUIR] Erro ao salvar receitas.json:`, receitasData.erro);
            mostrarErro("Erro ao remover receita: " + (receitasData.erro || "Falha desconhecida"));
            return;
        }

        const arquivados = await fetch(`${API}/arquivados?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
        arquivados.push(receitaArquivada);
        console.log(`[CONCLUIR] Adicionando receita "${receitaNome}" a arquivados.json`);
        const arquivadosResponse = await fetch(`${API}/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados),
            credentials: 'include'
        });
        const arquivadosData = await arquivadosResponse.json();
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
        const estoqueList = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
        estoqueList.forEach(e => { estoque[e.componente] = e.quantidade || 0; });
        await carregarListaReceitas();
        await carregarEstoque();
        await carregarLog();
        await carregarArquivados();
        await carregarListaFarmar(
            document.getElementById("buscaFarmar")?.value || "",
            document.getElementById("ordemFarmar")?.value || "pendente-desc",
            document.getElementById("filtroReceitaFarmar")?.value || ""
        );
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
    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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
}

function abrirPopupReceita(nome, duplicar = false, nomeSugerido = null) {
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
        if (!isUserAdmin()) {
            alert('Apenas fundadores ou co-fundadores podem editar receitas.');
            return;
        }
    }

    if (nome) {
        titulo.textContent = duplicar ? "Duplicar Receita" : "Editar Receita";
        fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).then(list => {
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

        let endpoint = `${API}/receitas?game=${encodeURIComponent(currentGame)}`;
        try {
            if (inputNomeOriginal.value && !duplicar) {
                const response = await fetch(`${API}/receitas/editar?game=${encodeURIComponent(currentGame)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nomeOriginal: inputNomeOriginal.value, ...payload }),
                    credentials: 'include'
                });
                const data = await response.json();
                console.log("[FORM] Resposta do servidor (edição):", data);
                if (!data.sucesso) {
                    mostrarErro(data.erro || "Erro ao editar receita");
                    return;
                }
            } else {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    credentials: 'include'
                });
                const data = await response.json();
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
    const comps = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    row.innerHTML = `
      <input type="text" class="assoc-nome" list="assoc-datalist-${rowId}" value="${dados.nome || ''}" placeholder="Digite para buscar..." />
      <datalist id="assoc-datalist-${rowId}">
        ${comps.map(c => `<option value="${c.nome}">`).join("")}
      </datalist>
      <input type="number" class="assoc-qtd" min="0.001" step="any" placeholder="Qtd" value="${formatQuantity(dados.quantidade || 0.001)}" />
      <button type="button">❌</button>
    `;
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
        ${isAdmin ? '<button id="btnNovoComponente" class="primary">+ Novo Componente</button>' : ''}
    </div>
    <div id="lista-componentes" class="lista"></div>
    `;
    if (isAdmin) {
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
    const categorias = await fetch(`${API}/categorias?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const select = document.getElementById("filtroCategoriaComponentes");
    if (select) {
        select.innerHTML = '<option value="">Todas as categorias</option>' + categorias.map(cat => `<option value="${cat}">${cat}</option>`).join("");
    }
}

async function carregarComponentesLista(termoBusca = "", ordem = "az", categoria = "") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    let url = `${API}/componentes?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
    if (termoBusca) {
        url += `&search=${encodeURIComponent(termoBusca)}`;
    } else {
        url += `&limit=10`;
    }
    let comps = await fetch(url, { credentials: 'include' }).then(r => r.json());

    if (categoria) {
        comps = comps.filter(c => c.categoria === categoria);
    }

    const isAdmin = isUserAdmin();
    const btnEditarDisabled = !isAdmin ? 'disabled' : '';
    const btnExcluirDisabled = !isAdmin ? 'disabled' : '';

    const div = document.getElementById("lista-componentes");
    div.innerHTML = comps.map(c => {
        const assoc = (c.associados || []).map(a => `${formatQuantity(a.quantidade)} x ${a.nome}`).join(", ");
        const btnEditarHtml = isAdmin ? `<button onclick="abrirPopupComponente('${escapeJsString(c.nome)}')" class="primary" ${btnEditarDisabled}>Editar</button>` : '';
        const btnExcluirHtml = isAdmin ? `<button onclick="excluirComponente('${escapeJsString(c.nome)}')" class="warn" ${btnExcluirDisabled}>Excluir</button>` : '';
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
    if (nome && !isUserAdmin()) {
        alert('Apenas fundadores ou co-fundadores podem editar componentes.');
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
        fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).then(list => {
            const comp = list.find(c => c.nome === nome);
            if (!comp) return;
            titulo.textContent = "Editar Componente";
            inputNome.value = comp.nome;
            inputCategoria.value = comp.categoria || "";
            inputQuantidadeProduzida.value = formatQuantity(comp.quantidadeProduzida || 0.001);
            inputNomeOriginal.value = comp.nome;
            (comp.associados || []).forEach(a => adicionarAssociadoRow(a.nome, a.quantidade));
            carregarCategoriasDatalist();
        });
    } else {
        titulo.textContent = "Novo Componente";
        carregarCategoriasDatalist();
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
        let endpoint = `${API}/componentes?game=${encodeURIComponent(currentGame)}`;
        if (inputNomeOriginal.value) {
            payload.nomeOriginal = inputNomeOriginal.value;
            endpoint = `${API}/componentes/editar?game=${encodeURIComponent(currentGame)}`;
        }

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: 'include'
        });
        const data = await res.json();
        if (!data.sucesso) return mostrarErro(data.erro || "Erro ao salvar componente");

        popup.style.display = "none";
        await carregarComponentesLista(document.getElementById("buscaComponentes")?.value || "", document.getElementById("ordemComponentes")?.value || "az");
        await carregarCategoriasDatalist();
    };

    document.getElementById("btnCancelarComponente").onclick = () => popup.style.display = "none";
    popup.style.display = "flex";
}

function adicionarAssociadoRow(nome = "", quantidade = "") {
    const container = document.getElementById("associadosContainer");
    const row = document.createElement("div");
    row.className = "associado-row";
    const rowId = Math.random().toString(36).substring(7); // ID único para o datalist
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).then(comps => {
        row.innerHTML = `
      <input type="text" class="assoc-nome" list="assoc-datalist-${rowId}" value="${nome}" placeholder="Digite para buscar..." />
      <datalist id="assoc-datalist-${rowId}">
        ${comps.map(c => `<option value="${c.nome}">`).join("")}
      </datalist>
      <input class="assoc-qtd" type="number" min="0.001" step="any" value="${formatQuantity(quantidade || 0.001)}" />
      <button type="button">❌</button>
    `;
        row.querySelector("button").addEventListener("click", () => row.remove());
        container.appendChild(row);
    });
}

async function excluirComponente(nome) {
    if (!isUserAdmin()) {
        alert('Apenas fundadores ou co-fundadores podem excluir componentes.');
        return;
    }
    if (!confirm(`Confirmar exclusão de "${nome}"?`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const res = await fetch(`${API}/componentes/excluir?game=${encodeURIComponent(currentGame)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
        credentials: 'include'
    });
    const data = await res.json();
    if (!data.sucesso) return mostrarErro(data.erro || "Erro ao excluir");
    await carregarComponentesLista(document.getElementById("buscaComponentes")?.value || "", document.getElementById("ordemComponentes")?.value || "az");
    await carregarCategoriasDatalist();
}

async function carregarCategoriasDatalist() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const categorias = await fetch(`${API}/categorias?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const datalist = document.getElementById("categoriasDatalist");
    if (datalist) datalist.innerHTML = categorias.map(x => `<option value="${x}">`).join("");
}

/* ------------------ ESTOQUE ------------------ */
async function montarEstoque() {
    const isAdmin = isUserAdmin();
    conteudo.innerHTML = `
    <h2>Estoque</h2>
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
        ${isAdmin ? `
        <div style="display: flex; gap: 12px; margin-bottom: 24px;">
          <button id="btnExportEstoque" class="primary">Exportar Estoque (XLS)</button>
          <label id="btnImportEstoque" for="fileImportEstoque" class="primary" style="cursor: pointer; padding: 12px 24px; border-radius: var(--border-radius-sm); background: var(--primary-gradient); color: white; text-decoration: none; font-weight: 500; transition: all var(--transition-fast);">Importar Estoque (XLS)</label>
          <input type="file" id="fileImportEstoque" accept=".xls,.xlsx" style="display: none;">
        </div>
        ` : ''}
        ${isAdmin ? '<button id="btnZerarEstoque" class="warn">Zerar todo o estoque</button>' : ''}
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
    const comps = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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
    const logs = await fetch(`${API}/log?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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

        const res = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ componente, quantidade, operacao }),
            credentials: 'include'
        });
        const data = await res.json();
        if (!data.sucesso) return mostrarErro(data.erro || "Erro ao movimentar estoque");

        const logEntry = {
            dataHora,
            componente,
            quantidade,
            operacao,
            origem: "Movimentação manual",
            user: userEmail  // Novo: Adicionar usuário
        };
        const logResponse = await fetch(`${API}/log?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([logEntry]),
            credentials: 'include'
        });
        const logData = await logResponse.json();
        if (!logData.sucesso) return mostrarErro("Erro ao registrar log.");

        await carregarEstoque(buscaEstoque.value, ordemEstoque.value);
        await carregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
    };

    // Novo: Exportar Estoque
    if (isAdmin) {
        const btnExportEstoque = document.getElementById("btnExportEstoque");
        btnExportEstoque.addEventListener("click", async () => {
            const estoqueList = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
            const data = [['Componente', 'Quantidade'], ...estoqueList.map(e => [e.componente, e.quantidade])];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Estoque');
            XLSX.writeFile(wb, `estoque_${currentGame}_${new Date().toISOString().split('T')[0]}.xlsx`);
        });

        // Novo: Importar Estoque
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
                    const response = await fetch(`${API}/estoque/import?game=${encodeURIComponent(currentGame)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(updates),
                        credentials: 'include'
                    });
                    const data = await response.json();
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
        btnZerarEstoque.disabled = !isAdmin;
        btnZerarEstoque.addEventListener("click", async () => {
            if (!isAdmin) {
                alert('Apenas fundadores ou co-fundadores podem zerar o estoque.');
                return;
            }
            if (confirm("Tem certeza que deseja zerar todo o estoque? Essa ação não pode ser desfeita.")) {
                try {
                    const response = await fetch(`${API}/estoque/zerar?game=${encodeURIComponent(currentGame)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: 'include'
                    });
                    const data = await response.json();
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

    await carregarEstoque(buscaEstoque.value, ordemEstoque.value);
    await carregarLog(buscaLogComponente.value, filtroLogUser.value, filtroLogData.value);
}

async function carregarEstoque(termoBusca = "", ordem = "az") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    let url = `${API}/estoque?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
    if (termoBusca) {
        url += `&search=${encodeURIComponent(termoBusca)}`;
    } else {
        url += `&limit=10`;
    }
    const estoque = await fetch(url, { credentials: 'include' }).then(r => r.json());

    const isAdmin = isUserAdmin();
    const listaEstoque = document.getElementById("listaEstoque");
    if (listaEstoque) {
        listaEstoque.innerHTML = estoque.map(e =>
            `<div class = "estoque-item-container"><div class="item"><strong>${e.componente || "(Sem nome)"}</strong> - ${formatQuantity(e.quantidade)}x</div> <button class="primary" onclick="editarEstoqueItem('${escapeJsString(e.componente)}', ${e.quantidade})">Editar</button> ${isAdmin ? `<button class="warn" onclick="excluirEstoqueItem('${escapeJsString(e.componente)}')">Excluir</button>` : ''}</div>`
        ).join("");
    }
}

async function editarEstoqueItem(componente, quantidadeAtual) {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupEditarEstoque";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Editar Estoque: ${componente}</h2>
        <form id="formEditarEstoque">
            <input type="number" id="novaQuantidade" min="0" step="any" value="${formatQuantity(quantidadeAtual)}" required>
            <button type="submit">Salvar</button>
            <button type="button" id="btnCancelarEditar">Cancelar</button>
        </form>
    `;
    document.body.appendChild(popup);

    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";

    document.getElementById("formEditarEstoque").addEventListener("submit", async (e) => {
        e.preventDefault();
        const novaQtd = Number(document.getElementById("novaQuantidade").value);
        if (isNaN(novaQtd) || novaQtd < 0) {
            mostrarErro("Quantidade inválida");
            return;
        }
        const diff = novaQtd - quantidadeAtual;
        if (diff === 0) {
            popup.remove();
            overlay.remove();
            return;
        }
        const operacao = diff > 0 ? "adicionar" : "debitar";
        const qtd = Math.abs(diff);
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = sessionStorage.getItem('userEmail');
        try {
            const response = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ componente, quantidade: qtd, operacao }),
                credentials: 'include'
            });
            const data = await response.json();
            if (!data.sucesso) {
                mostrarErro(data.erro || "Erro ao atualizar estoque");
                return;
            }
            // Registrar no log
            const logEntry = {
                dataHora,
                componente,
                quantidade: qtd,
                operacao,
                origem: "Edição manual",
                user: userEmail  // Novo: Adicionar usuário
            };
            const logResponse = await fetch(`${API}/log?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([logEntry]),
                credentials: 'include'
            });
            const logData = await logResponse.json();
            if (!logData.sucesso) {
                mostrarErro("Erro ao registrar log.");
                return;
            }
            popup.remove();
            overlay.remove();
            // Atualizar listas
            await carregarEstoque(document.getElementById("buscaEstoque")?.value || "", document.getElementById("ordemEstoque")?.value || "az");
            await carregarLog(document.getElementById("buscaLogComponente")?.value || "", document.getElementById("filtroLogUser")?.value || "", document.getElementById("filtroLogData")?.value || "");
        } catch (error) {
            mostrarErro("Erro ao atualizar estoque: " + error.message);
        }
    });

    document.getElementById("btnCancelarEditar").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}

async function excluirEstoqueItem(nome) {
    if (!confirm(`Confirmar exclusão do item "${nome}" do estoque? Isso também excluirá o componente e afetará receitas e outros módulos.`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const res = await fetch(`${API}/componentes/excluir?game=${encodeURIComponent(currentGame)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
        credentials: 'include'
    });
    const data = await res.json();
    if (!data.sucesso) return mostrarErro(data.erro || "Erro ao excluir item do estoque");
    await carregarEstoque(document.getElementById("buscaEstoque")?.value || "", document.getElementById("ordemEstoque")?.value || "az");
    await carregarComponentesLista();
    await carregarListaReceitas();
    await carregarListaFarmar();
}

async function carregarLog(componenteFiltro = "", userFiltro = "", dataFiltro = "") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const logs = await fetch(`${API}/log?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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
        const dataFormatada = `${dia}/${mes}/${ano}`;  // Novo: Converter para formato DD/MM/YYYY
        logsFiltrados = logsFiltrados.filter(l => l.dataHora && l.dataHora.startsWith(dataFormatada));
    }

    const div = document.getElementById("logMovimentacoes");
    if (div) {
        div.innerHTML = logsFiltrados.map(l => {
            const simb = l.operacao === "debitar" ? "-" : "+";
            const qtd = l.quantidade ?? 0;
            const nome = l.componente ?? "(Sem nome)";
            const hora = l.dataHora ?? "(Sem data)";
            const user = l.user ? ` por ${l.user}` : '';  // Novo: Exibir usuário
            const origem = l.origem ? ` (Origem: ${l.origem})` : "";
            return `<div class="item"><span>[${hora}]</span> ${simb}${formatQuantity(qtd)} x ${nome}${user}${origem}</div>`;
        }).join("");
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
    const arquivados = await fetch(`${API}/arquivados?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
    const isAdmin = isUserAdmin();
    const btnExcluirDisabled = !isAdmin ? 'disabled' : '';
    const div = document.getElementById("listaArquivados");
    if (div) {
        div.innerHTML = arquivados.map(r => {
            const comps = (r.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
            const btnExcluirHtml = isAdmin ? `<button class="warn" onclick="excluirArquivado('${escapeJsString(r.nome)}')" ${btnExcluirDisabled}>Excluir</button>` : '';
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
}

async function excluirArquivado(nome) {
    if (!isUserAdmin()) {
        alert('Apenas fundadores ou co-fundadores podem excluir itens arquivados.');
        return;
    }
    if (!confirm(`Confirmar exclusão da receita arquivada "${nome}"?`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const arquivados = await fetch(`${API}/arquivados?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
        const index = arquivados.findIndex(r => r.nome === nome);
        if (index === -1) {
            mostrarErro("Receita arquivada não encontrada.");
            return;
        }
        arquivados.splice(index, 1);
        const res = await fetch(`${API}/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados),
            credentials: 'include'
        });
        const data = await res.json();
        if (!data.sucesso) {
            mostrarErro(data.erro || "Erro ao excluir receita arquivada");
            return;
        }
        await carregarArquivados();
    } catch (error) {
        mostrarErro("Erro ao excluir receita arquivada: " + error.message);
    }
}

/* ------------------ O QUE FARMAR? ------------------ */
async function montarFarmar() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const categorias = await fetch(`${API}/categorias?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const receitasFavoritas = receitas.filter(r => r.favorita);

    conteudo.innerHTML = `
    <h2>Favoritos</h2>
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
    listaReceitas.addEventListener("change", () => {
        updateBadges();
        carregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
        saveFilters();
    });

    const debouncedCarregarListaFarmar = debounce(carregarListaFarmar, 300);

    buscaInput.addEventListener("input", () => {
        debouncedCarregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
        saveFilters();
    });
    categoriaSelect.addEventListener("change", () => {
        debouncedCarregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
        saveFilters();
    });
    ordemSelect.addEventListener("change", () => {
        debouncedCarregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
        saveFilters();
    });

    limparFiltrosFarmar.addEventListener("click", () => {
        buscaInput.value = "";
        searchReceita.value = "";
        Array.from(listaReceitas.querySelectorAll('input[type="checkbox"]')).forEach(cb => cb.checked = false);
        updateBadges();
        categoriaSelect.value = "";
        ordemSelect.value = "pendente-desc";
        carregarListaFarmar("", "pendente-desc", '', "");
        saveFilters();
    });

    await carregarListaFarmar(buscaInput.value, ordemSelect.value, '', categoriaSelect.value);
}

async function carregarListaFarmar(termoBusca = "", ordem = "pendente-desc", receitaFiltro = "", categoriaFiltro = "") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    const quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const receitasFavoritas = receitas.filter(r => r.favorita);
    const componentes = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const estoqueList = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());

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

    const isAdmin = isUserAdmin();
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
            const btnFabricarHtml = isAdmin && hasSubs ? `<button class="btn-fabricar" data-componente="${m.nome}" data-pendente="${m.pendente}" data-qtdprod="${component.quantidadeProduzida || 1}">Fabricar Tudo</button>` : '';
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
            btn.addEventListener("click", async () => {
                const targetId = btn.dataset.target;
                const detalhes = document.getElementById(targetId);
                if (!detalhes) return;
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
        if (isAdmin) {
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
        const sequence = computeSuggestedSequence(componentes, listaMateriasPendentes);
        const sequenceList = document.getElementById("sequenceList");
        sequenceList.innerHTML = sequence.map((item, index) => {
            const pendente = listaMateriasPendentes.find(m => m.nome === item.nome)?.pendente || 0;
            const action = item.hasSubs ? "Fabricar" : "Coletar";
            return `<li>${index + 1}. ${action} ${item.nome} (Pendente: ${formatQuantity(pendente)})</li>`;
        }).join("");
    } else {
        document.getElementById("sequenceList").innerHTML = "<li>Nenhuma sequência sugerida disponível.</li>";
    }
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
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const response = await fetch(`${API}/fabricar?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ componente: nome, numCrafts }),
            credentials: 'include'
        });
        const data = await response.json();
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
    ${isAdmin ? '<button id="btnInserirNovaReceita" class="primary">Inserir nova receita</button>' : ''}
    <div id="listaRoadmap" class="lista" style="flex-direction: column;"></div>
    `;
    if (isAdmin) {
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
    const roadmap = await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const componentes = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const estoqueList = await fetch(`${API}/estoque?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const estoque = {};
    estoqueList.forEach(e => { estoque[e.componente] = e.quantidade || 0; });

    const isAdmin = isUserAdmin();
    const btnExcluirDisabled = !isAdmin ? 'disabled' : '';

    const div = document.getElementById("listaRoadmap");
    div.innerHTML = roadmap.map((item, index) => {
        if (onlyCompleted && !item.completed) return '';
        const receita = receitas.find(r => r.nome === item.name);
        if (!receita) return '';
        const id = `roadmap-${item.name.replace(/\s/g, '-')}-${index}`;
        const comps = (receita.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
        const savedQtd = quantities[item.name] || 1;
        const checkboxHtml = isAdmin ? `<label><input type="checkbox" class="checkbox-completed" ${item.completed ? 'checked' : ''}> Pronto</label>` : '';
        const reordenacaoHtml = isAdmin ? `<button class="btn-move-up">↑</button><button class="btn-move-down">↓</button>` : '';
        const btnExcluirHtml = isAdmin ? `<button class="btn-excluir-roadmap" ${btnExcluirDisabled}>Excluir</button>` : '';
        return `
        <div class="item" style="${item.completed ? 'background-color: green;' : ''}" data-receita="${item.name}" data-index="${index}">
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

    if (isAdmin) {
        document.querySelectorAll("#listaRoadmap .checkbox-completed").forEach(cb => {
            cb.addEventListener("change", async () => {
                const itemElement = cb.closest(".item");
                const index = parseInt(itemElement.dataset.index);
                const completed = cb.checked;
                await atualizarRoadmapItem(index, { completed });
                itemElement.style.backgroundColor = completed ? 'green' : '';
            });
        });

        document.querySelectorAll("#listaRoadmap .btn-move-up").forEach(btn => {
            btn.addEventListener("click", async () => {
                const itemElement = btn.closest(".item");
                const index = parseInt(itemElement.dataset.index);
                if (index > 0) {
                    await reordenarRoadmap(index, index - 1);
                }
            });
        });

        document.querySelectorAll("#listaRoadmap .btn-move-down").forEach(btn => {
            btn.addEventListener("click", async () => {
                const itemElement = btn.closest(".item");
                const index = parseInt(itemElement.dataset.index);
                if (index < roadmap.length - 1) {
                    await reordenarRoadmap(index, index + 1);
                }
            });
        });

        document.querySelectorAll("#listaRoadmap .btn-excluir-roadmap").forEach(btn => {
            btn.addEventListener("click", async () => {
                const itemElement = btn.closest(".item");
                const index = parseInt(itemElement.dataset.index);
                await excluirRoadmapItem(index);
            });
        });
    }
}

async function excluirRoadmapItem(index) {
    if (!confirm("Confirmar exclusão da receita do Roadmap?")) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const roadmap = await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
        roadmap.splice(index, 1);
        const response = await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roadmap),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
        } else {
            mostrarErro(data.erro || "Erro ao excluir do roadmap");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir do roadmap: " + error.message);
    }
}

async function atualizarRoadmapItem(index, updates) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const roadmap = await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    if (roadmap[index]) {
        Object.assign(roadmap[index], updates);
        await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roadmap),
            credentials: 'include'
        });
        await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
    }
}

async function reordenarRoadmap(fromIndex, toIndex) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const roadmap = await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    if (toIndex >= 0 && toIndex < roadmap.length) {
        const [moved] = roadmap.splice(fromIndex, 1);
        roadmap.splice(toIndex, 0, moved);
        await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roadmap),
            credentials: 'include'
        });
        await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
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
    fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).then(receitas => {
        const datalist = document.getElementById("receitasDatalistRoadmap");
        datalist.innerHTML = receitas.map(r => `<option value="${r.nome}">`).join("");

        const input = document.getElementById("searchReceitaRoadmap");
        input.addEventListener("input", () => {
            const termo = input.value.toLowerCase();
            const filtered = receitas.filter(r => r.nome.toLowerCase().includes(termo));
            datalist.innerHTML = filtered.map(r => `<option value="${r.nome}">`).join("");
        });
    });

    document.getElementById("formAdicionarRoadmap").addEventListener("submit", async (e) => {
        e.preventDefault();
        const nome = document.getElementById("searchReceitaRoadmap").value.trim();
        const posicao = document.getElementById("posicaoRoadmap").value;
        if (!nome) {
            mostrarErro("Selecione uma receita");
            return;
        }
        const roadmap = await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json()).catch(() => []);
        const newItem = { name: nome, completed: false };
        if (posicao === "start") {
            roadmap.unshift(newItem);
        } else {
            roadmap.push(newItem);
        }
        await fetch(`${API}/roadmap?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(roadmap),
            credentials: 'include'
        });
        popup.remove();
        overlay.remove();
        await carregarListaRoadmap(document.getElementById("filtroProntasRoadmap")?.checked || false);
    });

    document.getElementById("btnCancelarAdicionarRoadmap").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}

/* ------------------ CATEGORIAS ------------------ */
async function montarCategorias() {
    const isAdmin = isUserAdmin();
    conteudo.innerHTML = `
    <h2>Categorias</h2>
    <div class="filtros">
        <input type="text" id="buscaCategorias" placeholder="Buscar por nome...">
        <select id="ordemCategorias">
            <option value="az">Alfabética A-Z</option>
            <option value="za">Alfabética Z-A</option>
        </select>
        ${isAdmin ? '<button id="btnNovaCategoria" class="primary">+ Nova Categoria</button>' : ''}
    </div>
    <div id="lista-categorias" class="lista"></div>
    `;
    if (isAdmin) {
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
    let categorias = await fetch(`${API}/categorias?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const comps = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
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

    const isAdmin = isUserAdmin();
    const div = document.getElementById("lista-categorias");
    div.innerHTML = categorias.map(cat => {
        const count = counts[cat] || 0;
        const btnExcluirHtml = isAdmin && count === 0 ? `<button onclick="excluirCategoria('${escapeJsString(cat)}')" class="warn">Excluir</button>` : '';
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
            document.getElementById("erroCategoria").textContent = "Nome da categoria é obrigatório";
            document.getElementById("erroCategoria").style.display = "block";
            return;
        }
        try {
            const response = await fetch(`${API}/categorias?game=${encodeURIComponent(currentGame)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome }),
                credentials: 'include'
            });
            const data = await response.json();
            if (data.sucesso) {
                popup.remove();
                overlay.remove();
                await carregarCategoriasLista(document.getElementById("buscaCategorias")?.value || "", document.getElementById("ordemCategorias")?.value || "az");
                await carregarCategoriasDatalist();
            } else {
                document.getElementById("erroCategoria").textContent = data.erro || "Erro ao criar categoria";
                document.getElementById("erroCategoria").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroCategoria").textContent = "Erro ao criar categoria";
            document.getElementById("erroCategoria").style.display = "block";
        }
    });

    document.getElementById("btnCancelarCategoria").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}

async function excluirCategoria(nome) {
    if (!confirm(`Confirmar exclusão da categoria "${nome}"?`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const response = await fetch(`${API}/categorias/excluir?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome }),
            credentials: 'include'
        });
        const data = await response.json();
        if (data.sucesso) {
            await carregarCategoriasLista(document.getElementById("buscaCategorias")?.value || "", document.getElementById("ordemCategorias")?.value || "az");
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

// Função para atualizar o texto do botão de toggle
function updateToggleButtonText(mode) {
    const toggleButton = document.getElementById("themeToggle");
    if (toggleButton) {
        toggleButton.textContent = mode === "bright" ? "Mudar para Dark Mode" : "Mudar para Bright Mode";
    }
}

// Event listener para o botão de toggle (adicionado após DOMContentLoaded)
document.addEventListener("DOMContentLoaded", () => {
    const toggleButton = document.getElementById("themeToggle");
    toggleButton.addEventListener("click", () => {
        const currentMode = document.body.classList.contains("bright-mode") ? "bright" : "dark";
        const newMode = currentMode === "bright" ? "dark" : "bright";

        document.body.classList.remove(currentMode + "-mode");
        document.body.classList.add(newMode + "-mode");
        localStorage.setItem("themeMode", newMode);
        updateToggleButtonText(newMode);
    });
});