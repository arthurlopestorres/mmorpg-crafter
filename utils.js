// utils.js - Funções utilitárias como formatQuantity, mostrarErro, mostrarSucesso, ordenarItens, etc.
// Dependências: core.js (para safeApi, etc.)

function formatQuantity(quantity) {
    if (quantity == null) return '0';
    quantity = Number(quantity);
    if (isNaN(quantity)) return '0';
    return Number.isInteger(quantity) ? quantity : quantity.toFixed(3).replace(/\.?0+$/, '');
}
function mostrarErro(msg) {
    // Remover overlay e modal existentes para evitar conflitos
    const existingOverlay = document.getElementById("overlay");
    if (existingOverlay) existingOverlay.remove();
    const existingModal = document.getElementById("modalErro");
    if (existingModal) existingModal.remove();
    const overlay = criarOverlay();
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
    // Criar o botão de fechar antes de append para garantir o listener
    const buttonClose = document.createElement("button");
    buttonClose.id = "fecharModal";
    buttonClose.style.background = "none";
    buttonClose.style.border = "none";
    buttonClose.style.fontSize = "16px";
    buttonClose.style.cursor = "pointer";
    buttonClose.innerHTML = "❌";
    modalErro.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Erro</h3>
            ${buttonClose.outerHTML}
        </div>
        <p id="mensagemErro">${msg}</p>
    `;
    // Adicionar listener imediatamente após criar o botão
    buttonClose.addEventListener("click", () => {
        modalErro.remove();
        const currentOverlay = document.getElementById("overlay");
        if (currentOverlay) currentOverlay.remove();
    });
    document.body.appendChild(modalErro);
    // Re-adicionar listener para segurança (caso haja manipulação DOM)
    const fecharModal = document.getElementById("fecharModal");
    if (fecharModal) {
        fecharModal.addEventListener("click", () => {
            modalErro.remove();
            const currentOverlay = document.getElementById("overlay");
            if (currentOverlay) currentOverlay.remove();
        });
    }
    // Fechar ao clicar no overlay
    overlay.addEventListener("click", () => {
        modalErro.remove();
        overlay.remove();
    });
}
// Nova função para mostrar popup de sucesso temporário
function mostrarSucesso(msg) {
    // Remover overlay e modal existentes para evitar conflitos
    const existingOverlay = document.getElementById("overlaySucesso");
    if (existingOverlay) existingOverlay.remove();
    const existingModal = document.getElementById("modalSucesso");
    if (existingModal) existingModal.remove();
    const overlay = criarOverlay();
    overlay.id = "overlaySucesso";
    const modalSucesso = document.createElement("div");
    modalSucesso.id = "modalSucesso";
    modalSucesso.style.position = "fixed";
    modalSucesso.style.top = "50%";
    modalSucesso.style.left = "50%";
    modalSucesso.style.transform = "translate(-50%, -50%)";
    modalSucesso.style.backgroundColor = "white";
    modalSucesso.style.padding = "20px";
    modalSucesso.style.zIndex = "1000";
    modalSucesso.style.borderRadius = "5px";
    modalSucesso.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
    // Criar o botão de fechar antes de append para garantir o listener
    const buttonClose = document.createElement("button");
    buttonClose.id = "fecharModalSucesso";
    buttonClose.style.background = "none";
    buttonClose.style.border = "none";
    buttonClose.style.fontSize = "16px";
    buttonClose.style.cursor = "pointer";
    buttonClose.innerHTML = "❌";
    modalSucesso.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Sucesso</h3>
            ${buttonClose.outerHTML}
        </div>
        <p id="mensagemSucesso" style="color: green;">${msg}</p>
    `;
    // Adicionar listener imediatamente após criar o botão
    buttonClose.addEventListener("click", () => {
        modalSucesso.remove();
        const currentOverlay = document.getElementById("overlaySucesso");
        if (currentOverlay) currentOverlay.remove();
    });
    document.body.appendChild(modalSucesso);
    // Re-adicionar listener para segurança (caso haja manipulação DOM)
    const fecharModal = document.getElementById("fecharModalSucesso");
    if (fecharModal) {
        fecharModal.addEventListener("click", () => {
            modalSucesso.remove();
            const currentOverlay = document.getElementById("overlaySucesso");
            if (currentOverlay) currentOverlay.remove();
        });
    }
    // Fechar ao clicar no overlay
    overlay.addEventListener("click", () => {
        modalSucesso.remove();
        overlay.remove();
    });
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
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}