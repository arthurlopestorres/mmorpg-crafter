//! INICIO ESTOQUE.JS
// estoque.js - Funções para módulo de estoque e log
// Dependências: core.js, utils.js, componentes.js (para editarEstoqueItem)
async function montarEstoque() {
    const isAdmin = isUserAdmin();
    conteudo.innerHTML = `
    <h2>Estoque de Componentes</h2>
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
            ${hasPermission('debitarEstoque') || isAdmin ? '<option value="debitar">Debitar</option>' : ''}
          </select>
          <input id="inputQuantidadeEstoque" type="number" min="0.001" step="any" value="0.001" />
          <button class="primary" type="submit">Confirmar</button>
        </form>
        <div class="estoque--acoes">
          ${hasPermission('exportarEstoque') ? '<button id="btnExportEstoque" class="primary">Exportar Estoque (XLS)</button>' : ''}
          ${hasPermission('importarEstoque') ? '<label id="btnImportEstoque" for="fileImportEstoque" class="primary">Importar Estoque (XLS)</label><input type="file" id="fileImportEstoque" accept=".xls,.xlsx" style="display: none;">' : ''}
          ${hasPermission('zerarEstoque') ? '<button id="btnZerarEstoque" class="warn">Zerar todo o estoque</button>' : ''}
        </div>
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
        btnZerarEstoque.disabled = !hasPermission('zerarEstoque');
        btnZerarEstoque.addEventListener("click", async () => {
            if (!hasPermission('zerarEstoque')) {
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
//! FIM ESTOQUE.JS