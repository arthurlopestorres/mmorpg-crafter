// farmar.js - Funções para módulo "O que farmar?"
// Dependências: core.js, utils.js
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
function calculateComponentRequirements(componentName, quantityNeeded, componentesData) {
    let req = {};
    const component = componentesData.find(c => c.nome === componentName);
    if (component && component.associados && component.associados.length > 0) {
        const qtdProd = component.quantidadeProduzida || 1;
        const numCrafts = Math.ceil(quantityNeeded / qtdProd);
        for (const a of component.associados) {
            const subNec = a.quantidade * numCrafts;
            const subReq = calculateComponentRequirements(a.nome, subNec, componentesData);
            mergeReq(req, subReq);
        }
    } else {
        req[componentName] = (req[componentName] || 0) + quantityNeeded;
    }
    return req;
}
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
        const categoriasSet = new Set();
        for (const receita of receitasFiltradas) {
            receita.componentes.forEach(comp => {
                collectCategories(comp.nome, componentes, categoriasSet);
            });
        }
        const categoriasUnicas = [...categoriasSet].filter(cat => cat).sort();
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
        const estoqueMap = {};
        estoqueList.forEach(e => { estoqueMap[e.componente] = e.quantidade || 0; });
        const remainingStock = { ...estoqueMap };
        const totalNec = new Map();
        const requiredBy = new Map();
        for (const receita of receitasFiltradas) {
            if (!receita.nome) continue;
            const recipeQuantity = quantities[receita.nome] || 1;
            receita.componentes.forEach(comp => {
                const qtdNec = comp.quantidade * recipeQuantity;
                calculateComponentRequirementsWithRemaining(comp.nome, qtdNec, componentes, remainingStock, totalNec, requiredBy, receita.nome);
            });
        }
        let listaMaterias = Array.from(totalNec.keys()).map(nome => {
            const nec = totalNec.get(nome);
            const disp = estoqueMap[nome] || 0;
            const pendente = Math.max(0, nec - disp);
            return { nome, nec, disp, pendente, receitas: Array.from(requiredBy.get(nome) || []) };
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
                            const remainingStock = { ...estoqueMap };
                            detalhes.innerHTML = `<ul>${getComponentChain(m.nome, m.nec, componentes, remainingStock)}</ul>`;
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
            btn.addEventListener('click', () => handleSequenceReorder('up', btn, sequence, listaMateriasPendentes, componentes));
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
function collectCategories(name, componentesData, set) {
    const component = componentesData.find(c => c.nome === name);
    if (component && component.categoria) {
        set.add(component.categoria);
    }
    if (component && component.associados && component.associados.length > 0) {
        for (const a of component.associados) {
            collectCategories(a.nome, componentesData, set);
        }
    }
}