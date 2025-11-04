// arquivados.js - Funções para módulo de arquivados
// Dependências: core.js, utils.js

async function montarArquivados() {
    conteudo.innerHTML = `
    <h2>Arquivados</h2>
    <div id="listaArquivados" class="lista"></div>
    `;
    await carregarArquivados();
}
async function carregarArquivados() {
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        const arquivados = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`).catch(() => []);
        const div = document.getElementById("listaArquivados");
        if (div) {
            div.innerHTML = arquivados.map(r => {
                const comps = (r.componentes || []).map(c => `${formatQuantity(c.quantidade)} x ${c.nome}`).join(", ");
                const btnExcluirHtml = hasPermission('concluirReceitas') ? `<button class="warn" onclick="excluirArquivado('${escapeJsString(r.nome)}')">Excluir</button>` : '';
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
    } catch (error) {
        console.error('[ARQUIVADOS] Erro ao carregar:', error);
        const div = document.getElementById("listaArquivados");
        if (div) div.innerHTML = '<p>Erro ao carregar arquivados.</p>';
    }
}
async function excluirArquivado(nome) {
    if (!hasPermission('concluirReceitas')) {
        alert('Você não tem permissão para excluir itens arquivados.');
        return;
    }
    if (!confirm(`Confirmar exclusão da receita arquivada "${nome}"?`)) return;
    const currentGame = localStorage.getItem("currentGame") || "Pax Dei";
    try {
        let arquivados = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`).catch(() => []);
        const index = arquivados.findIndex(r => r.nome === nome);
        if (index === -1) {
            mostrarErro("Receita arquivada não encontrada.");
            return;
        }
        arquivados.splice(index, 1);
        const data = await safeApi(`/arquivados?game=${encodeURIComponent(currentGame)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(arquivados)
        });
        if (data.sucesso) {
            await carregarArquivados();
        } else {
            mostrarErro(data.erro || "Erro ao excluir receita arquivada");
        }
    } catch (error) {
        mostrarErro("Erro ao excluir receita arquivada: " + error.message);
    }
}