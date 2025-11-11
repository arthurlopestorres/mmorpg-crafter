// receitas.js
//! INICIO RECEITAS.JS
// receitas.js - Funções para módulo de receitas
// Dependências: core.js, utils.js
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
        <select id="modoReceitas">
            <option value="ativas">Ativas</option>
            <option value="arquivadas">Arquivadas</option>
        </select>
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
    const modoSelect = document.getElementById("modoReceitas");
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const savedFilters = JSON.parse(localStorage.getItem(`receitasFilters_${currentGame}`)) || {};
    buscaInput.value = savedFilters.termoBusca || "";
    ordemSelect.value = savedFilters.ordem || "az";
    filtroFavoritas.checked = savedFilters.onlyFavorites || false;
    modoSelect.value = savedFilters.modo || "ativas";
    const saveFilters = () => {
        localStorage.setItem(`receitasFilters_${currentGame}`, JSON.stringify({
            termoBusca: buscaInput.value,
            ordem: ordemSelect.value,
            onlyFavorites: filtroFavoritas.checked,
            modo: modoSelect.value
        }));
    };
    const debouncedCarregarListaReceitas = debounce(carregarListaReceitas, 300);
    buscaInput.addEventListener("input", () => {
        debouncedCarregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked, modoSelect.value);
        saveFilters();
    });
    ordemSelect.addEventListener("change", () => {
        debouncedCarregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked, modoSelect.value);
        saveFilters();
    });
    filtroFavoritas.addEventListener("change", () => {
        debouncedCarregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked, modoSelect.value);
        saveFilters();
    });
    modoSelect.addEventListener("change", () => {
        debouncedCarregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked, modoSelect.value);
        saveFilters();
    });
    await carregarListaReceitas(buscaInput.value, ordemSelect.value, filtroFavoritas.checked, modoSelect.value);
}
async function carregarListaReceitas(termoBusca = "", ordem = "az", onlyFavorites = false, modo = "ativas") {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const quantitiesKey = `recipeQuantities_${currentGame}`;
    let quantities = JSON.parse(localStorage.getItem(quantitiesKey)) || {};
    let url = (modo === "ativas") ? `/receitas?game=${encodeURIComponent(currentGame)}&order=${ordem}` : `/arquivados?game=${encodeURIComponent(currentGame)}&order=${ordem}`;
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
            let btnConcluirHtml = '';
            let btnEditarHtml = '';
            let btnArquivarHtml = '';
            let btnDuplicarHtml = '';
            let btnFavoritarHtml = '';
            let btnExcluirHtml = '';
            if (modo === "ativas") {
                btnConcluirHtml = hasPermission('concluirReceitas') ? `<button class="btn-concluir" data-receita="${r.nome}">Concluir</button>` : '';
                btnEditarHtml = hasPermission('editarReceitas') ? `<button class="btn-editar" data-nome="${r.nome}">Editar</button>` : '';
                btnArquivarHtml = hasPermission('concluirReceitas') ? `<button class="btn-arquivar" data-nome="${r.nome}">Arquivar</button>` : '';
                btnDuplicarHtml = hasPermission('duplicarReceitas') ? `<button class="btn-duplicar" data-nome="${r.nome}">Duplicar</button>` : '';
                btnFavoritarHtml = hasPermission('favoritarReceitas') ? `<button class="btn-favoritar ${r.favorita ? 'favorita' : ''}" data-nome="${r.nome}">${r.favorita ? 'Desfavoritar' : 'Favoritar'}</button>` : '';
            } else if (modo === "arquivadas") {
                btnExcluirHtml = hasPermission('excluirArquivados') ? `<button class="btn-excluir" data-nome="${r.nome}">Excluir Permanentemente</button>` : '';
            }
            return `
        <div class="item ${r.favorita ? 'favorita' : ''}" data-receita="${r.nome}">
          <div class="receita-header">
            <div class = "receita-header--container1"><div style="margin-right: 15px;"><strong class= "receita-header--titulo">${r.nome}</strong>
            ${comps ? `<div class="comps-lista">${comps}</div>` : ""}
            ${modo === "ativas" ? `<input type="number" class="qtd-desejada" min="0.001" step="any" value="${savedQtd}" data-receita="${r.nome}">` : ''}
            ${modo === "arquivadas" && r.arquivadoPor ? `<div class="arquivado-info">Arquivado por: ${r.arquivadoPor} em ${r.dataArquivamento}</div>` : ''}</div>
            ${modo === "ativas" ? `<button class="toggle-detalhes" data-target="${id}-detalhes">▼</button>` : ''}</div><div class="receitas-ButtonContainer">
            ${btnConcluirHtml}
            ${btnEditarHtml}
            ${btnDuplicarHtml}
            ${btnFavoritarHtml}
            ${btnArquivarHtml}
            ${btnExcluirHtml}</div>
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
        if (hasPermission('excluirArquivados')) {
            document.querySelectorAll(".btn-excluir").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const nome = btn.dataset.nome;
                    console.log(`[EXCLUIR ARQUIVADA] Botão Excluir clicado para receita arquivada: ${nome}`);
                    if (!confirm(`Confirmar exclusão permanente de "${nome}"?`)) return;
                    await excluirArquivada(nome);
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
            await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false, document.getElementById("modoReceitas")?.value || "ativas");
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
        receitaArquivada.arquivadoPor = sessionStorage.getItem('userEmail');
        receitaArquivada.dataArquivamento = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
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
        await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false, document.getElementById("modoReceitas")?.value || "ativas");
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
        const remainingStock = { ...estoque };
        let html = "<ul>";
        let counter = 1;
        for (const comp of receita.componentes) {
            const quantidadeNecessaria = comp.quantidade * qtd;
            const effectiveDisp = Math.min(remainingStock[comp.nome] || 0, quantidadeNecessaria);
            remainingStock[comp.nome] = (remainingStock[comp.nome] || 0) - effectiveDisp;
            const falta = Math.max(0, quantidadeNecessaria - effectiveDisp);
            let classeLinha = '';
            if (effectiveDisp >= quantidadeNecessaria) {
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
              ${!hidePrefix ? `<span class="prefix">${counter}-</span> ` : ''}${comp.nome} (Nec: ${formatQuantity(quantidadeNecessaria)}, Disp: ${formatQuantity(effectiveDisp)}, Falta: ${formatQuantity(falta)})
              ${falta > 0 ? getComponentChain(comp.nome, falta, componentesData, remainingStock, `${counter}.`, collapsible, hidePrefix) : ''}
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
function getComponentChain(componentName, quantityNeeded, componentesData, remainingStock, prefix = "", collapsible = false, hidePrefix = false) {
    const remainingDisp = remainingStock[componentName] || 0;
    let effectiveDisp = Math.min(remainingDisp, quantityNeeded);
    remainingStock[componentName] = (remainingStock[componentName] || 0) - effectiveDisp;
    if (effectiveDisp >= quantityNeeded) return "";
    const component = componentesData.find(c => c.nome === componentName);
    if (!component || !component.associados || component.associados.length === 0) return "";
    let ulStyle = "";
    if (collapsible) {
        ulStyle = ' style="display:none;"';
    }
    let html = `<ul${ulStyle}>`;
    const qtdProd = component.quantidadeProduzida || 1;
    const numCrafts = Math.ceil((quantityNeeded - effectiveDisp) / qtdProd);
    let subCounter = 1;
    component.associados.forEach(a => {
        const subNec = a.quantidade * numCrafts;
        let subEffectiveDisp = Math.min(remainingStock[a.nome] || 0, subNec);
        remainingStock[a.nome] = (remainingStock[a.nome] || 0) - subEffectiveDisp;
        const subFalta = Math.max(0, subNec - subEffectiveDisp);
        let classeLinha = '';
        if (subEffectiveDisp >= subNec) {
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
          ${!hidePrefix ? `<span class="prefix">${prefix}${subCounter}-</span> ` : ''}${a.nome} (Nec: ${formatQuantity(subNec)}, Disp: ${formatQuantity(subEffectiveDisp)}, Falta: ${formatQuantity(subFalta)})
          ${subFalta > 0 ? getComponentChain(a.nome, subFalta, componentesData, remainingStock, `${prefix}${subCounter}.`, collapsible, hidePrefix) : ''}
        </li>`;
        subCounter++;
    });
    html += "</ul>";
    return html;
}
function calculateComponentRequirementsWithRemaining(componentName, quantityNeeded, componentesData, remainingStock, totalNec = null, requiredBy = null, currentReceita = null) {
    if (totalNec) {
        totalNec.set(componentName, (totalNec.get(componentName) || 0) + quantityNeeded);
    }
    if (requiredBy && currentReceita) {
        if (!requiredBy.has(componentName)) requiredBy.set(componentName, new Set());
        requiredBy.get(componentName).add(currentReceita);
    }
    let req = {};
    const disp = remainingStock[componentName] || 0;
    const effectiveDisp = Math.min(disp, quantityNeeded);
    remainingStock[componentName] = disp - effectiveDisp;
    if (effectiveDisp > 0) {
        req[componentName] = effectiveDisp;
    }
    const stillNeeded = quantityNeeded - effectiveDisp;
    if (stillNeeded > 0) {
        const component = componentesData.find(c => c.nome === componentName);
        if (component && component.associados && component.associados.length > 0) {
            const qtdProd = component.quantidadeProduzida || 1;
            const numCrafts = Math.ceil(stillNeeded / qtdProd);
            component.associados.forEach(a => {
                const subNec = a.quantidade * numCrafts;
                mergeReq(req, calculateComponentRequirementsWithRemaining(a.nome, subNec, componentesData, remainingStock, totalNec, requiredBy, currentReceita));
            });
        } else {
            req[componentName] = (req[componentName] || 0) + stillNeeded;
        }
    }
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
        const remainingStock = { ...estoque };
        let requisitos = {};
        receita.componentes.forEach(comp => {
            const quantidadeNecessaria = comp.quantidade * qtd;
            const subReq = calculateComponentRequirementsWithRemaining(comp.nome, quantidadeNecessaria, componentesData, remainingStock);
            mergeReq(requisitos, subReq);
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
        const remainingStock = { ...estoque };
        let requisitos = {};
        receita.componentes.forEach(comp => {
            const quantidadeNecessaria = comp.quantidade * qtd;
            const subReq = calculateComponentRequirementsWithRemaining(comp.nome, quantidadeNecessaria, componentesData, remainingStock);
            mergeReq(requisitos, subReq);
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
        receitaArquivada.arquivadoPor = sessionStorage.getItem('userEmail');
        receitaArquivada.dataArquivamento = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
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
        await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false, document.getElementById("modoReceitas")?.value || "ativas");
        await carregarEstoque();
        await carregarLog();
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
async function excluirArquivada(nome) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        let arquivados = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`);
        const index = arquivados.findIndex(r => r.nome === nome);
        if (index === -1) {
            console.error(`[EXCLUIR ARQUIVADA] Receita "${nome}" não encontrada em arquivados.json`);
            mostrarErro("Receita não encontrada para exclusão.");
            return;
        }
        arquivados.splice(index, 1);
        const data = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados)
        });
        if (!data.sucesso) {
            console.error(`[EXCLUIR ARQUIVADA] Erro ao salvar arquivados.json:`, data.erro);
            mostrarErro("Erro ao excluir receita: " + (data.erro || "Falha desconhecida"));
            return;
        }
        // Registrar no log
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = sessionStorage.getItem('userEmail');
        const logEntry = {
            dataHora,
            componente: nome,
            quantidade: 0,
            operacao: "excluir_arquivada",
            origem: `Exclusão permanente de receita arquivada ${nome}`,
            user: userEmail
        };
        const logData = await safeApi(`/log?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify([logEntry])
        });
        if (!logData.sucesso) {
            mostrarErro("Erro ao registrar log de exclusão.");
        }
        await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false, document.getElementById("modoReceitas")?.value || "ativas");
    } catch (error) {
        console.error(`[EXCLUIR ARQUIVADA] Erro ao excluir receita "${nome}":`, error);
        mostrarErro("Erro ao excluir receita: " + error.message);
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
            await carregarListaReceitas(document.getElementById("buscaReceitas")?.value || "", document.getElementById("ordemReceitas")?.value || "az", document.getElementById("filtroFavoritas")?.checked || false, document.getElementById("modoReceitas")?.value || "ativas");
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
//! FIM RECEITAS.JS