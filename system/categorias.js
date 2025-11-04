// categorias.js - Funções para módulo de categorias
// Dependências: core.js, utils.js

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