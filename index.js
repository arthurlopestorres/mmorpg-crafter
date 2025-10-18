// index.js
//rodar node servidor.js (no terminal)

const API = "https://mmorpg-crafter.onrender.com";
// const API = "http://localhost:10000";
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
        initMenu();
        await initGames();
        const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
        carregarSecao(ultimaSecao);
    } else {
        mostrarPopupLogin();
    }
});

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
        { section: "home", text: "Home" },
        { section: "componentes", text: "Componentes" },
        { section: "estoque", text: "Estoque de componentes" },
        { section: "receitas", text: "Receitas" },
        { section: "farmar", text: "Favoritos" },
        { section: "arquivados", text: "Arquivados" },
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
                popup.remove();
                overlay.remove();
                initMenu();
                await initGames();
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
    conteudo.innerHTML = `
    <h2>Receitas</h2>
    <div class="filtros">
        <input type="text" id="buscaReceitas" placeholder="Buscar por nome...">
        <select id="ordemReceitas">
            <option value="az">Alfabética A-Z</option>
            <option value="za">Alfabética Z-A</option>
        </select>
        <label><input type="checkbox" id="filtroFavoritas"> Somente Favoritas</label>
        <button id="btnNovaReceita" class="primary">+ Nova Receita</button>
    </div>
    <div id="listaReceitas" class="lista"></div>
    `;
    document.getElementById("btnNovaReceita").addEventListener("click", () => abrirPopupReceita(null));
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
    div.innerHTML = receitas.filter(r => r.nome).map(r => {
        const id = `receita-${r.nome.replace(/\s/g, '-')}`;
        const comps = (r.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
        return `
        <div class="item ${r.favorita ? 'favorita' : ''}" data-receita="${r.nome}">
          <div class="receita-header">
            <div class = "receita-header--container1"><div style="margin-right: 15px;"><strong class= "receita-header--titulo">${r.nome}</strong>
            ${comps ? `<div class="comps-lista">${comps}</div>` : ""}
            <input type="number" class="qtd-desejada" min="0.001" step="any" value="1" data-receita="${r.nome}"></div>
            <button class="toggle-detalhes" data-target="${id}-detalhes">▼</button></div><div>
            <button class="btn-concluir" data-receita="${r.nome}" disabled>Concluir</button>
            <button class="btn-editar" data-nome="${r.nome}">Editar</button>
            <button class="btn-arquivar" data-nome="${r.nome}">Arquivar</button>
            <button class="btn-duplicar" data-nome="${r.nome}">Duplicar</button>
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
                await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
            }
        });
    });

    document.querySelectorAll(".qtd-desejada").forEach(input => {
        input.addEventListener("input", async () => {
            const receitaElement = input.closest(".item");
            const receitaNome = receitaElement.dataset.receita;
            const qtd = Math.max(Number(input.value) || 0.001, 0.001);
            const detalhes = receitaElement.querySelector(".detalhes");
            if (detalhes && detalhes.style.display !== "none") {
                await atualizarDetalhes(receitaNome, qtd, componentes, estoque);
                await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
            }
        });
    });

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

    document.querySelectorAll(".btn-favoritar").forEach(btn => {
        btn.addEventListener("click", async () => {
            const nome = btn.dataset.nome;
            const isFavorita = btn.classList.contains('favorita');
            await toggleFavorita(nome, !isFavorita);
        });
    });

    // Verificar botões inicialmente
    document.querySelectorAll(".item").forEach(async item => {
        const receitaNome = item.dataset.receita;
        const qtd = Math.max(Number(item.querySelector(".qtd-desejada").value) || 0.001, 0.001);
        await atualizarBotaoConcluir(receitaNome, qtd, componentes, estoque);
    });
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

async function atualizarDetalhes(receitaNome, qtd, componentesData, estoque) {
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

        html += `
        <li class="${classeLinha}">
          ${comp.nome} (Nec: ${formatQuantity(quantidadeNecessaria)}, Disp: ${formatQuantity(disp)}, Falta: ${formatQuantity(falta)})
          ${getComponentChain(comp.nome, quantidadeNecessaria, componentesData, estoque)}
        </li>`;
    }
    html += "</ul>";
    detalhes.innerHTML = html;
}

function getComponentChain(componentName, quantityNeeded, componentesData, estoque) {
    const component = componentesData.find(c => c.nome === componentName);
    const disp = estoque[componentName] !== undefined ? estoque[componentName] : 0;

    // Se o componente tem estoque suficiente, não exibir subcomponentes
    if (disp >= quantityNeeded) return "";

    if (!component || !component.associados || component.associados.length === 0) return "";

    let html = "<ul>";
    const qtdProd = component.quantidadeProduzida || 1;
    const numCrafts = Math.ceil((quantityNeeded - disp) / qtdProd);
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

        html += `
        <li class="${classeLinha}">
          ${a.nome} (Nec: ${formatQuantity(subNec)}, Disp: ${formatQuantity(subDisp)}, Falta: ${formatQuantity(subFalta)})
          ${getComponentChain(a.nome, subNec, componentesData, estoque)}
        </li>`;
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
        const logEntries = Object.entries(requisitos).map(([componente, quantidade]) => ({
            dataHora,
            componente,
            quantidade,
            operacao: "debitar",
            origem: `Conclusão de ${receitaNome}`
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
    conteudo.innerHTML = `
    <h2>Componentes</h2>
    <div class="filtros">
        <input type="text" id="buscaComponentes" placeholder="Buscar por nome...">
        <select id="ordemComponentes">
            <option value="az">Alfabética A-Z</option>
            <option value="za">Alfabética Z-A</option>
        </select>
        <button id="btnNovoComponente" class="primary">+ Novo Componente</button>
    </div>
    <div id="lista-componentes" class="lista"></div>
    `;
    document.getElementById("btnNovoComponente").addEventListener("click", () => abrirPopupComponente());
    const buscaInput = document.getElementById("buscaComponentes");
    const ordemSelect = document.getElementById("ordemComponentes");

    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedFilters = JSON.parse(localStorage.getItem(`componentesFilters_${currentGame}`)) || {};
    buscaInput.value = savedFilters.termoBusca || "";
    ordemSelect.value = savedFilters.ordem || "az";

    const saveFilters = () => {
        localStorage.setItem(`componentesFilters_${currentGame}`, JSON.stringify({
            termoBusca: buscaInput.value,
            ordem: ordemSelect.value
        }));
    };

    const debouncedCarregarComponentesLista = debounce(carregarComponentesLista, 300);

    buscaInput.addEventListener("input", () => {
        debouncedCarregarComponentesLista(buscaInput.value, ordemSelect.value);
        saveFilters();
    });
    ordemSelect.addEventListener("change", () => {
        debouncedCarregarComponentesLista(buscaInput.value, ordemSelect.value);
        saveFilters();
    });
    await carregarComponentesLista(buscaInput.value, ordemSelect.value);
    await carregarCategoriasDatalist();
}

async function carregarComponentesLista(termoBusca = "", ordem = "az") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    let url = `${API}/componentes?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
    if (termoBusca) {
        url += `&search=${encodeURIComponent(termoBusca)}`;
    } else {
        url += `&limit=10`;
    }
    const comps = await fetch(url, { credentials: 'include' }).then(r => r.json());

    const div = document.getElementById("lista-componentes");
    div.innerHTML = comps.map(c => {
        const assoc = (c.associados || []).map(a => `${formatQuantity(a.quantidade)} x ${a.nome}`).join(", ");
        return `
      <div class="item">
        <div>
          <strong>${c.nome}</strong> <span class="categoria">(${c.categoria || "—"})</span>
          <div class="comps-lista">
            Produz: ${formatQuantity(c.quantidadeProduzida)}${assoc ? ` • Materiais: ${assoc}` : ""}
          </div>
        </div>
        <div class="acoes">
          <button onclick="abrirPopupComponente('${escapeJsString(c.nome)}')" class="primary">Editar</button>
          <button onclick="excluirComponente('${escapeJsString(c.nome)}')" class="warn">Excluir</button>
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
    const comps = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const categorias = [...new Set(comps.map(c => c.categoria).filter(Boolean))];
    const datalist = document.getElementById("categoriasDatalist");
    if (datalist) datalist.innerHTML = categorias.map(x => `<option value="${x}">`).join("");
}

/* ------------------ ESTOQUE ------------------ */
async function montarEstoque() {
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
          <input type="text" id="selectComponenteEstoque" list="componentesDatalist" placeholder="Digite para buscar..." required>
          <datalist id="componentesDatalist"></datalist>
          <select id="selectOperacao">
            <option value="adicionar">Adicionar</option>
            <option value="debitar">Debitar</option>
          </select>
          <input id="inputQuantidadeEstoque" type="number" min="0.001" step="any" value="0.001" />
          <button class="primary" type="submit">Confirmar</button>
        </form>
        <div id="listaEstoque" class="lista"></div>
      </div>
      <div style="flex:1">
        <h3 class="estoque--log-de-movimentacoes">Log de Movimentações</h3>
        <div class="filtros">
            <input type="text" id="buscaLogComponente" list="logComponentesDatalist" placeholder="Digite componente para buscar...">
            <datalist id="logComponentesDatalist"></datalist>
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
    const filtroLogData = document.getElementById("filtroLogData");
    const limparFiltrosLog = document.getElementById("limparFiltrosLog");

    const savedFilters = JSON.parse(localStorage.getItem(`estoqueFilters_${currentGame}`)) || {};
    buscaEstoque.value = savedFilters.termoBuscaEstoque || "";
    ordemEstoque.value = savedFilters.ordemEstoque || "az";
    buscaLogComponente.value = savedFilters.termoBuscaLog || "";
    filtroLogData.value = savedFilters.dataLog || "";

    const saveFilters = () => {
        localStorage.setItem(`estoqueFilters_${currentGame}`, JSON.stringify({
            termoBuscaEstoque: buscaEstoque.value,
            ordemEstoque: ordemEstoque.value,
            termoBuscaLog: buscaLogComponente.value,
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

    // Atualizar datalist dinamicamente enquanto digita no log
    buscaLogComponente.addEventListener("input", () => {
        const termo = buscaLogComponente.value.toLowerCase();
        const filteredOptions = componentesUnicos.filter(c => c.toLowerCase().includes(termo))
            .map(c => `<option value="${c}">`);
        logDatalist.innerHTML = filteredOptions.join("");
        debouncedCarregarLog(buscaLogComponente.value, filtroLogData.value);
        saveFilters();
    });

    filtroLogData.addEventListener("change", () => {
        debouncedCarregarLog(buscaLogComponente.value, filtroLogData.value);
        saveFilters();
    });

    // Limpar filtros
    limparFiltrosLog.addEventListener("click", () => {
        buscaLogComponente.value = "";
        filtroLogData.value = "";
        carregarLog("", "");
        saveFilters();
    });

    document.getElementById("formEstoque").onsubmit = async e => {
        e.preventDefault();
        const componente = document.getElementById("selectComponenteEstoque").value;
        const quantidade = Math.max(Number(document.getElementById("inputQuantidadeEstoque").value) || 0.001, 0.001);
        const operacao = document.getElementById("selectOperacao").value;
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });

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
            origem: "Movimentação manual"
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
        await carregarLog(buscaLogComponente.value, filtroLogData.value);
    };

    await carregarEstoque(buscaEstoque.value, ordemEstoque.value);
    await carregarLog(buscaLogComponente.value, filtroLogData.value);
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

    const listaEstoque = document.getElementById("listaEstoque");
    if (listaEstoque) {
        listaEstoque.innerHTML = estoque.map(e =>
            `<div class = "estoque-item-container"><div class="item"><strong>${e.componente || "(Sem nome)"}</strong> - ${formatQuantity(e.quantidade)}x</div> <button class="primary" onclick="editarEstoqueItem('${escapeJsString(e.componente)}', ${e.quantidade})">Editar</button> <button class="warn" onclick="excluirEstoqueItem('${escapeJsString(e.componente)}')">Excluir</button></div>`
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
            const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
            const logEntry = {
                dataHora,
                componente,
                quantidade: qtd,
                operacao,
                origem: "Edição manual"
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
            await carregarLog(document.getElementById("buscaLogComponente")?.value || "", document.getElementById("filtroLogData")?.value || "");
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

async function carregarLog(componenteFiltro = "", dataFiltro = "") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const logs = await fetch(`${API}/log?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    let logsFiltrados = logs.reverse();

    // Filtro por componente
    if (componenteFiltro) {
        logsFiltrados = logsFiltrados.filter(l => l.componente && l.componente.toLowerCase().includes(componenteFiltro.toLowerCase()));
    }

    // Filtro por data
    if (dataFiltro) {
        logsFiltrados = logsFiltrados.filter(l => l.dataHora && l.dataHora.startsWith(dataFiltro));
    }

    const div = document.getElementById("logMovimentacoes");
    if (div) {
        div.innerHTML = logsFiltrados.map(l => {
            const simb = l.operacao === "debitar" ? "-" : "+";
            const qtd = l.quantidade ?? 0;
            const nome = l.componente ?? "(Sem nome)";
            const hora = l.dataHora ?? "(Sem data)";
            const origem = l.origem ? ` (Origem: ${l.origem})` : "";
            return `<div class="item"><span>[${hora}]</span> ${simb}${formatQuantity(qtd)} x ${nome}${origem}</div>`;
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
    const div = document.getElementById("listaArquivados");
    if (div) {
        div.innerHTML = arquivados.map(r => {
            const comps = (r.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
            return `
            <div class="item">
              <div>
                <strong>${r.nome}</strong>
                ${comps ? `<div class="comps-lista">${comps}</div>` : ""}
              </div>
              <button class="warn" onclick="excluirArquivado('${escapeJsString(r.nome)}')">Excluir</button>
            </div>`;
        }).join("");
    }
}

async function excluirArquivado(nome) {
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
    const componentes = await fetch(`${API}/componentes?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const receitas = await fetch(`${API}/receitas?game=${encodeURIComponent(currentGame)}`, { credentials: 'include' }).then(r => r.json());
    const receitasFavoritas = receitas.filter(r => r.favorita);
    const categorias = [...new Set(componentes.map(c => c.categoria).filter(Boolean))].sort();

    conteudo.innerHTML = `
    <h2>Favoritos</h2>
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
        let req = {};
        receita.componentes.forEach(comp => {
            const qtdNec = comp.quantidade * 1; // Assumindo qtd desejada = 1 por receita
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
                ${hasSubs ? `<button class="btn-fabricar" data-componente="${m.nome}" data-pendente="${m.pendente}" data-qtdprod="${component.quantidadeProduzida || 1}" disabled>Fabricar Tudo</button>` : ''}
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
        document.querySelectorAll("#listaFarmar .item").forEach(async item => {
            const componenteNome = item.dataset.componente;
            const m = listaMaterias.find(mat => mat.nome === componenteNome);
            const component = componentes.find(c => c.nome === componenteNome);
            if (component && component.associados && component.associados.length > 0) {
                let qtdProd = component.quantidadeProduzida || 1;
                let pendente = m.pendente;
                let numCrafts = Math.ceil(pendente / qtdProd);
                let canFabricate = pendente > 0;
                if (canFabricate) {
                    for (const assoc of component.associados) {
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
    } else {
        console.log("[FARMAR] Skip updating farmar list as div not found.");
    }
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
            await carregarLog();
        } else {
            mostrarErro(data.erro || "Erro ao fabricar componente");
        }
    } catch (error) {
        mostrarErro("Erro ao fabricar componente: " + error.message);
    }
}

/* ------------------ UTIL ------------------ */
function formatQuantity(quantity) {
    return Number.isInteger(quantity) ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '');
}

function mostrarErro(msg) {
    const overlay = document.getElementById("overlay") || criarOverlay();
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
    modalErro.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Erro</h3>
            <button id="fecharModal" style="background: none; border: none; font-size: 16px; cursor: pointer;">❌</button>
        </div>
        <p id="mensagemErro">${msg}</p>
    `;
    document.body.appendChild(modalErro);

    const fecharModal = document.getElementById("fecharModal");
    fecharModal.addEventListener("click", () => {
        modalErro.remove();
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.remove();
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