// roadmap.js - Funções para módulo de roadmap
// Dependências: core.js, utils.js

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