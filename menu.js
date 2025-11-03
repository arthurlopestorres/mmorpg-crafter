// menu.js - Inicialização do menu, seções, minimizar menu, manual
// Dependências: core.js, auth.js, utils.js, time.js, receitas.js, componentes.js, estoque.js, arquivados.js, farmar.js, roadmap.js, categorias.js

function initMenu() {
    const menu = document.querySelector(".menu");
    if (!menu) return;
    menu.innerHTML = ''; // Limpar menu existente para reordenar
    // Itens principais fora do dropdown
    const mainSections = [
        { section: "home", text: "Bem vindo!" }
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
    // Item "Guilda" com submenu inline
    const liGuilda = document.createElement("li");
    liGuilda.id = "menu-guilda";
    liGuilda.classList.add("menu-item-with-submenu"); // Nova classe para estilização
    const guildaToggle = document.createElement("span");
    const guildaToggleArrow = document.createElement("span");
    guildaToggle.innerHTML = "Guilda"; // Setinha inicial (fechado)
    guildaToggleArrow.classList.add('menu-guilda-SpanArrow')
    guildaToggleArrow.innerHTML = "▼"
    liGuilda.appendChild(guildaToggle);
    liGuilda.appendChild(guildaToggleArrow);
    liGuilda.addEventListener("click", toggleGuildaSubmenu); // Toggle ao clicar
    menu.appendChild(liGuilda);
    // Adicionar o submenu inline para Guilda (inicialmente escondido)
    const submenuGuildaUl = document.createElement("ul");
    submenuGuildaUl.id = "submenu-guilda-inline";
    submenuGuildaUl.className = "submenu-guilda-inline";
    submenuGuildaUl.style.display = "none"; // Inicialmente fechado
    const guildaSections = [
        { section: "time", text: "Membros" }
    ];
    submenuGuildaUl.innerHTML = guildaSections.map(sec => `
        <li onclick="carregarSecao('${sec.section}')">${sec.text}</li>
    `).join("");
    // Inserir submenu logo após o liGuilda
    liGuilda.insertAdjacentElement('afterend', submenuGuildaUl);
    // Checar localStorage para abrir submenu se salvo como aberto
    if (localStorage.getItem("guildaMenuOpen") === "true") {
        toggleGuildaSubmenu(); // Expande automaticamente
    }
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
// Nova função para toggle do submenu inline de Guilda
function toggleGuildaSubmenu() {
    const submenu = document.getElementById("submenu-guilda-inline");
    const toggleSpan = document.querySelector("#menu-guilda span");
    const toggleSpanArrow = document.querySelector('#menu-guilda .menu-guilda-SpanArrow')
    const isOpen = submenu.style.display === "block";
    if (isOpen) {
        submenu.style.display = "none";
        toggleSpan.innerHTML = "Guilda"; // Fechado
        toggleSpanArrow.innerHTML = "▼" // Fechado
        localStorage.setItem("guildaMenuOpen", "false");
    } else {
        submenu.style.display = "block";
        toggleSpan.innerHTML = "Guilda"; // Aberto
        toggleSpanArrow.innerHTML = "▲" // Aberto
        localStorage.setItem("guildaMenuOpen", "true");
    }
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