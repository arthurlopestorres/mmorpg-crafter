// componentes.js - Funções para módulo de componentes
// Dependências: core.js, utils.js

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