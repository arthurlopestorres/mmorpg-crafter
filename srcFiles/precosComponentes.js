// precosComponentes.js - Funções para módulo de preços de componentes
// Dependências: core.js, utils.js
async function montarPrecosComponentes() {
    conteudo.innerHTML = `
        <h2>Preços de Componentes</h2>
        <div class="filtros">
            <label>Filtrar por Nome: <input type="text" id="filtroNome" placeholder="Nome do componente"></label>
            <label>Filtrar por Categoria: <select id="filtroCategoria"><option value="">Todas</option></select></label>
            <label>Mostrar Tabelas:
                <div class="dropdown" style="position: relative; display: inline-block;">
                    <button id="btnFiltroTabela" class="dropdown-btn" style="padding: 5px 10px; border: 1px solid #ccc; background-color: #f9f9f9; cursor: pointer;">Selecionar Tabelas</button>
                    <div id="dropdownTabela" class="dropdown-content" style="display: none; position: absolute; background-color: white; border: 1px solid #ccc; padding: 10px; z-index: 1; min-width: 150px; max-height: 200px; overflow-y: auto;"></div>
                </div>
            </label>
        </div>
        <div id="tabelaPrecos" class="tabela-precos"></div>
    `;
    // Carregar status do usuário para permissões
    const status = await safeApi(`/user-status`);
    const isAdmin = status.isAdmin;
    const permissao = status.permissao || {};
    const podeCadastrarNovaTabela = isAdmin || permissao.cadastrarNovaTabelaPrecos;
    const podeEditarNomeTabela = isAdmin || permissao.editarNomeTabelaPrecos;
    const podeExcluirTabela = isAdmin || permissao.excluirTabelaPrecos;
    const podeAlterarPrecoUnitario = isAdmin || permissao.alterarPrecoUnitario;
    // Armazenar permissões para uso em chamadas subsequentes
    window.precosPermissions = { podeEditarNomeTabela, podeExcluirTabela, podeAlterarPrecoUnitario };
    // Adicionar botão de nova tabela apenas se permitido
    if (podeCadastrarNovaTabela) {
        const btnNova = document.createElement("button");
        btnNova.id = "btnNovaTabelaPrecos";
        btnNova.className = "primary";
        btnNova.textContent = "Cadastrar Nova Tabela de Preços";
        btnNova.addEventListener("click", abrirPopupNovaTabela);
        conteudo.insertBefore(btnNova, document.getElementById("tabelaPrecos"));
    }
    // Restaurar filtros do localStorage
    const filtroNomeInput = document.getElementById("filtroNome");
    filtroNomeInput.value = localStorage.getItem('precosFiltroNome') || '';
    filtroNomeInput.addEventListener("input", debounce(carregarTabelaPrecos, 300));
    const filtroCategoriaSelect = document.getElementById("filtroCategoria");
    filtroCategoriaSelect.addEventListener("change", carregarTabelaPrecos);
    document.getElementById("btnFiltroTabela").addEventListener("click", () => {
        const dd = document.getElementById("dropdownTabela");
        dd.style.display = dd.style.display === "none" ? "block" : "none";
    });
    // Adicionar listener para fechar dropdown ao clicar fora
    document.addEventListener("click", (event) => {
        const dd = document.getElementById("dropdownTabela");
        const btn = document.getElementById("btnFiltroTabela");
        if (!dd.contains(event.target) && !btn.contains(event.target)) {
            dd.style.display = "none";
        }
    });
    await carregarTabelaPrecos({ podeEditarNomeTabela, podeExcluirTabela, podeAlterarPrecoUnitario });
    // Restaurar filtroCategoria após popular opções
    filtroCategoriaSelect.value = localStorage.getItem('precosFiltroCategoria') || '';
}
async function carregarTabelaPrecos(options = {}) {
    const { podeEditarNomeTabela = window.precosPermissions?.podeEditarNomeTabela ?? false, podeExcluirTabela = window.precosPermissions?.podeExcluirTabela ?? false, podeAlterarPrecoUnitario = window.precosPermissions?.podeAlterarPrecoUnitario ?? false } = options;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    const filtroNome = document.getElementById("filtroNome")?.value.toLowerCase() || "";
    const filtroCategoria = document.getElementById("filtroCategoria")?.value || "";
    const filtroTabelas = Array.from(document.querySelectorAll('#dropdownTabela input[type="checkbox"]:checked') || []).map(inp => inp.value);
    // Salvar filtros no localStorage
    localStorage.setItem('precosFiltroNome', filtroNome);
    localStorage.setItem('precosFiltroCategoria', filtroCategoria);
    localStorage.setItem('precosFiltroTabelas', JSON.stringify(filtroTabelas));
    try {
        let componentes = await safeApi(`/componentes?game=${encodeURIComponent(currentGame)}&order=az`);
        if (componentes.length === 0) {
            document.getElementById("tabelaPrecos").innerHTML = '<p>Nenhum componente encontrado.</p>';
            return;
        }
        // Calcular todas as categorias a partir de todos os componentes
        const categorias = [...new Set(componentes.map(c => c.categoria).filter(Boolean))];
        window.allComponentes = componentes;
        // Determinar as tabelas de preços (usando o primeiro componente como referência)
        const todasTabelas = Object.keys(componentes[0]?.precos || { "Principal": {} });
        window.tabelas = todasTabelas;
        // Popular select de categorias (único)
        const selectCategoria = document.getElementById("filtroCategoria");
        if (selectCategoria && selectCategoria.options.length === 1) {
            categorias.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = cat;
                selectCategoria.appendChild(opt);
            });
        }
        // Popular dropdown de tabelas com checkboxes
        const dropdownTabela = document.getElementById("dropdownTabela");
        if (dropdownTabela && dropdownTabela.children.length === 0) {
            todasTabelas.forEach(tab => {
                const label = document.createElement("label");
                label.style.display = "block";
                const inp = document.createElement("input");
                inp.type = "checkbox";
                inp.value = tab;
                inp.checked = true;
                inp.addEventListener("change", carregarTabelaPrecos);
                label.appendChild(inp);
                label.appendChild(document.createTextNode(` ${tab}`));
                dropdownTabela.appendChild(label);
            });
            // Restaurar checkboxes do localStorage
            const savedTabelas = JSON.parse(localStorage.getItem('precosFiltroTabelas') || '[]');
            if (savedTabelas.length > 0) {
                Array.from(dropdownTabela.querySelectorAll('input[type="checkbox"]')).forEach(inp => {
                    inp.checked = savedTabelas.includes(inp.value);
                });
            }
        }
        // Filtrar por nome e categoria
        componentes = componentes.filter(c =>
            c.nome.toLowerCase().includes(filtroNome) &&
            (!filtroCategoria || c.categoria === filtroCategoria)
        );
        // Limitar a 10 se não há filtros
        const noFilters = !filtroNome && !filtroCategoria;
        if (noFilters) {
            componentes = componentes.slice(0, 10);
        }
        // Filtrar tabelas a mostrar
        const tabelasMostrar = filtroTabelas.length > 0 ? filtroTabelas : todasTabelas;
        // Cabeçalho da tabela
        let html = '<table class="modern-table"><thead><tr><th>Componente</th>';
        tabelasMostrar.forEach(tabela => {
            let editBtn = '';
            let deleteBtn = '';
            if (podeEditarNomeTabela) {
                editBtn = `<button onclick="renomearTabela('${tabela}')">✏️</button>`;
            }
            if (podeExcluirTabela && tabela !== 'Principal' && todasTabelas.length > 1) {
                deleteBtn = `<button class="warn" onclick="excluirTabela('${tabela}')">🗑️</button>`;
            }
            html += `<th>${tabela} ${editBtn} ${deleteBtn}</th>`;
        });
        html += '</tr></thead><tbody>';
        // Linhas dos componentes
        componentes.forEach(c => {
            // Calcular lucros por tabela para encontrar a tabela com maior lucro
            let lucros = {};
            tabelasMostrar.forEach(t => {
                const custo = calcularCustoProducao(c, window.allComponentes, t);
                const preco = c.precos?.[t]?.precoUnitario || 0;
                let lucroAdj = preco - custo;
                if (custo === 0) {
                    lucroAdj = 0;
                }
                lucros[t] = lucroAdj;
            });
            const maxLucro = Math.max(...Object.values(lucros));
            const tabelaMax = Object.keys(lucros).find(k => lucros[k] === maxLucro) || 'N/A';
            // Determinar classe da linha com base no maxLucro
            let rowClass = '';
            if (maxLucro > 0) {
                rowClass = 'row-positive';
            } else if (maxLucro < 0) {
                rowClass = 'row-negative';
            }
            // Listar subcomponentes
            let subsHtml = '';
            if (c.associados && c.associados.length > 0) {
                subsHtml = '<br>Subcomponentes:<br>' + c.associados.map(a => {
                    const subComp = window.allComponentes.find(sc => sc.nome === a.nome);
                    const precoSub = subComp ? (subComp.precos?.[tabelasMostrar[0]]?.precoUnitario || 0) : 0;
                    return `${a.nome} (qtd: ${a.quantidade}, unit: ${precoSub.toFixed(2)})`;
                }).join('<br>');
            }
            html += `<tr class="${rowClass}"><td>${c.nome} (${c.categoria || '—'}) <label>Quantidade:</label> <input type="number" min="1" value="1" onchange="atualizarQuantidade('${c.nome}', this.value)" />${subsHtml}<br>Maior Lucro: ${tabelaMax}</td>`;
            tabelasMostrar.forEach(tabela => {
                const preco = c.precos?.[tabela]?.precoUnitario || 0;
                const custo = calcularCustoProducao(c, window.allComponentes, tabela);
                let custoDisplay = custo;
                let lucro = preco - custo;
                if (custo === 0) {
                    custoDisplay = preco;
                    lucro = 0;
                }
                const safeNome = safeId(c.nome);
                const safeTabela = safeId(tabela);
                let precoHtml = '';
                if (podeAlterarPrecoUnitario) {
                    precoHtml = `<input type="number" value="${preco}" onchange="atualizarPreco('${c.nome}', '${tabela}', this.value)" />`;
                } else {
                    precoHtml = `<span>${preco}</span>`;
                }
                html += `<td>
                    Preço Unit: ${precoHtml}
                    Custo de produção: <span id="custo_${safeNome}_${safeTabela}">${custoDisplay.toFixed(2)}</span>
                    Lucro: <span id="lucro_${safeNome}_${safeTabela}">${lucro.toFixed(2)}</span>
                </td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById("tabelaPrecos").innerHTML = html;
    } catch (error) {
        console.error('[PRECOS COMPONENTES] Erro ao carregar:', error);
        document.getElementById("tabelaPrecos").innerHTML = '<p>Erro ao carregar preços.</p>';
    }
}
function safeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
}
function calcularCustoProducao(comp, todosComps, tabela = "Principal", memo = {}) {
    const key = `${comp.nome}_${tabela}`;
    if (memo[key] !== undefined) return memo[key];
    if (!comp.associados || comp.associados.length === 0) {
        memo[key] = 0;
        return memo[key];
    }
    let custoTotal = 0;
    comp.associados.forEach(a => {
        const subComp = todosComps.find(c => c.nome === a.nome);
        if (subComp) {
            const subCusto = subComp.precos?.[tabela]?.precoUnitario || 0;
            custoTotal += subCusto * a.quantidade;
        }
    });
    const quantidadeProduzida = comp.quantidadeProduzida || 1;
    memo[key] = custoTotal / quantidadeProduzida;
    return memo[key];
}
async function atualizarPreco(nome, tabela, novoPreco) {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const payload = { nome, tabela, precoUnitario: parseFloat(novoPreco) || 0 };
        const data = await safeApi(`/componentes/update-preco?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (data.sucesso) {
            await carregarTabelaPrecos();
        } else {
            mostrarErro("Erro ao atualizar preço");
        }
    } catch (error) {
        mostrarErro("Erro ao atualizar preço: " + error.message);
    }
}
function atualizarQuantidade(nome, q) {
    q = Math.max(1, parseFloat(q) || 1);
    const comp = window.allComponentes.find(c => c.nome === nome);
    if (!comp) return;
    window.tabelas.forEach(tabela => {
        const preco = comp.precos?.[tabela]?.precoUnitario || 0;
        const custoBase = calcularCustoProducao(comp, window.allComponentes, tabela);
        const custo = custoBase * q;
        let custoDisplay = custo;
        let lucro = (preco * q) - custo;
        if (custoBase === 0) {
            custoDisplay = preco * q;
            lucro = 0;
        }
        const safeNome = safeId(nome);
        const safeTabela = safeId(tabela);
        const custoSpan = document.getElementById(`custo_${safeNome}_${safeTabela}`);
        if (custoSpan) custoSpan.textContent = custoDisplay.toFixed(2);
        const lucroSpan = document.getElementById(`lucro_${safeNome}_${safeTabela}`);
        if (lucroSpan) lucroSpan.textContent = lucro.toFixed(2);
    });
}
function abrirPopupNovaTabela() {
    const popup = document.createElement("div");
    popup.id = "popupNovaTabela";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h3>Nova Tabela de Preços</h3>
        <input type="text" id="nomeNovaTabela" placeholder="Nome da tabela">
        <button onclick="criarNovaTabela()">Confirmar</button>
        <button onclick="document.getElementById('popupNovaTabela').remove()">Cancelar</button>
    `;
    document.body.appendChild(popup);
}
async function criarNovaTabela() {
    const nome = document.getElementById("nomeNovaTabela").value.trim();
    if (!nome) return mostrarErro("Nome da tabela obrigatório");
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/componentes/add-tabela?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nomeTabela: nome })
        });
        if (data.sucesso) {
            document.getElementById("popupNovaTabela").remove();
            await carregarTabelaPrecos();
        } else {
            mostrarErro("Erro ao criar tabela");
        }
    } catch (error) {
        mostrarErro("Erro ao criar tabela: " + error.message);
    }
}
async function renomearTabela(oldName) {
    const newName = prompt("Novo nome para a tabela:", oldName);
    if (!newName || newName === oldName) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/componentes/rename-tabela?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ oldName, newName })
        });
        if (data.sucesso) {
            await carregarTabelaPrecos();
        } else {
            mostrarErro("Erro ao renomear tabela");
        }
    } catch (error) {
        mostrarErro("Erro ao renomear tabela: " + error.message);
    }
}
async function excluirTabela(tabela) {
    if (!confirm(`Tem certeza que deseja excluir a tabela "${tabela}"?`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const data = await safeApi(`/componentes/delete-tabela?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nomeTabela: tabela })
        });
        if (data.sucesso) {
            await carregarTabelaPrecos();
        } else {
            mostrarErro("Erro ao excluir tabela");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir tabela: " + error.message);
    }
}