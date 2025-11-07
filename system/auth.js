//! INICIO auth.js
// auth.js - Funções de autenticação, login, cadastro, minha conta, foto, senha, etc.
// Dependências: core.js (safeApi, mostrarErro, etc.), utils.js (criarOverlay, etc.)

async function previewFotoPerfil(event) {
    const file = event.target.files[0]; // Correção: 'e' → 'event'
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const preview = document.getElementById("previewFotoPerfil");
        if (preview) {
            preview.src = ev.target.result;
        }
        // Compressão básica com canvas para preparar o blob (opcional, mas ajuda em consistência)
        const img = new Image();
        img.src = ev.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 100; // Tamanho fixo para perfil
            canvas.height = 100;
            ctx.drawImage(img, 0, 0, 100, 100);
            canvas.toBlob((blob) => {
                processedFotoBlob = blob; // Armazena o blob processado para upload
            }, 'image/jpeg', 0.8); // Qualidade 80%
        };
    };
    reader.readAsDataURL(file);
}

// Função para upload da foto
async function uploadFotoPerfil() {
    if (!processedFotoBlob && !document.getElementById('inputFotoPerfil').files[0]) {
        mostrarErro('Selecione uma imagem primeiro');
        return;
    }
    const formData = new FormData();
    const fileToUpload = processedFotoBlob || document.getElementById('inputFotoPerfil').files[0];
    formData.append('foto', fileToUpload);
    try {
        const data = await safeApi('/upload-foto', {
            method: 'POST',
            body: formData
        });
        if (data.sucesso) {
            // Atualizar preview com cache busting
            const preview = document.getElementById("previewFotoPerfil");
            if (preview) {
                const timestamp = new Date().getTime();
                preview.src = `/data/${encodeURIComponent(sessionStorage.getItem('userEmail') || 'default')}/profile.jpg?${timestamp}`;
            }
            processedFotoBlob = null; // Limpar após upload
            mostrarSucesso('Foto atualizada com sucesso!'); // Use mostrarErro ou crie um mostrarSucesso se preferir
        } else {
            mostrarErro(data.erro || 'Erro ao fazer upload');
        }
    } catch (error) {
        console.error('Erro no upload:', error);
        mostrarErro('Erro ao fazer upload: ' + error.message);
        if (error.message.includes('404')) {
            // Caso específico de 404: fallback para default
            const preview = document.getElementById("previewFotoPerfil");
            if (preview) preview.src = '/imagens/default-profile.jpg';
        }
    }
}

// Dropdown para "Minha Conta"
async function mostrarPopupMinhaConta() {
    // Remover dropdown existente se houver
    const existingPopup = document.getElementById("popupMinhaConta");
    if (existingPopup) existingPopup.remove();
    const menuItem = document.getElementById("menu-minha-conta");
    const rect = menuItem.getBoundingClientRect();
    const popup = document.createElement("div");
    popup.id = "popupMinhaConta";
    popup.style.position = "fixed";
    popup.style.top = "auto";
    popup.style.bottom = "24px";
    popup.style.left = `${rect.right + 8}px`;
    popup.style.right = "auto";
    popup.style.transform = "none";
    popup.style.backgroundColor = "white";
    popup.style.padding = "0";
    popup.style.zIndex = "1001";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.minWidth = "300px";
    popup.style.maxWidth = "400px";
    popup.style.overflow = "hidden";
    // Buscar dados do usuário do servidor via endpoint /me
    try {
        const usuario = await safeApi(`/me`);
        sessionStorage.setItem('userEmail', usuario.email); // Armazena o email do usuário logado para uso consistente
        const games = await safeApi(`/games`);
        const isDark = document.body.classList.contains('dark-mode');
        // Foto de perfil com lápis de edição
        const fotoPath = usuario.fotoPath ? `${API}${usuario.fotoPath}?${Date.now()}` : null;
        const temFoto = !!fotoPath;
        popup.innerHTML = `
            <div class="minhaContaResumo"style="padding: 20px; border-bottom: 1px solid #e2e8f0;">
                <div class="minhaContaResumo-tituloEimg">
                    <h3 style="margin: 0 0 12px 0; font-size: 1.1rem;">Minha Conta</h3>
                    <div style="width: 50px; display: flex; flex-direction: column; align-items: center; margin-bottom: 12px; position: relative;">
                        <div id="fotoPerfilContainer" style="position: relative; width: 150px; height: 150px; border-radius: 50%; overflow: hidden; border: 2px solid #e2e8f0; margin-bottom: 12px;">
                            <img id="fotoPerfilImg" src="${fotoPath || ''}" alt="Foto de Perfil" style="width: 100%; height: 100%; object-fit: cover; display: ${temFoto ? 'block' : 'none'};">
                            <div id="editPencilOverlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); display: ${temFoto ? 'none' : 'none'}; justify-content: center; align-items: center; opacity: 0; transition: opacity 0.3s; cursor: pointer; border-radius: 50%;">
                                <span style="color: white; font-size: 10px;">Edit</span>
                            </div>
                        </div>
                        <div id="uploadFotoContainer" style="width: 100%; text-align: center; display: ${temFoto ? 'none' : 'block'};">
                            <input type="file" id="inputFotoPerfil" accept="image/*" style="margin-bottom: 8px;">
                            <img id="previewFotoPerfil" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; display: none; margin: 8px 0;">
                            <button id="btnUploadFoto" style="padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Salvar Foto</button>
                            <p style="display: none; font-size: 0.8rem; color: #666; margin-top: 4px;">Máx 150x150px, 50KB</p>
                        </div>
                    </div>
                </div>
                <div class="minhaConta-nomeWrapper" style="margin: 0 0 8px 0; font-size: 0.9rem;">
                    <strong>Nome:</strong>
                    <input type="text" id="editNome" value="#${usuario.id}${usuario.nome}">
                    <span class="lapisEditarNome"></span>
                    <button id="btnSalvarNome" style="margin-left: 8px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Salvar</button>
                </div>
                <p style="margin: 0 0 16px 0; font-size: 0.9rem;"><strong>Email:</strong> ${usuario.email}</p>
            </div>
            <div style="padding: 16px 20px;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; font-size: 0.9rem;">Jogo Atual</label>
                    <select id="gameSelectorDropdown">
                        ${games.map(g => `<option value="${g}" ${g === localStorage.getItem("currentGame") ? 'selected' : ''}>${g}</option>`).join("")}
                    </select>
                </div>
                <button id="btnNovoJogoDropdown" style="width: 100%; margin-bottom: 12px; padding: 10px; background: var(--primary-gradient); color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Novo Jogo</button>
                <button id="btnMudarSenha" style="width: 100%; margin-bottom: 12px; padding: 10px; background: #e2e8f0; color: #2d3748; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Mudar Senha</button>
                <label style="display: flex; align-items: center; margin-bottom: 12px;">
                    <input type="checkbox" id="toggle2FA" ${usuario.doisFatores ? 'checked' : ''} style="margin-right: 8px;">
                    Ativar Autenticação de Dois Fatores
                </label>
            </div>
            <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0;">
                <h4 style="margin: 0 0 12px 0; font-size: 1rem;">Aparência</h4>
                <button id="themeToggleDropdown" style="width: 100%; padding: 10px; background: ${isDark ? '#e2e8f0' : 'var(--primary-gradient)'}; color: ${isDark ? '#2d3748' : 'white'}; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500; transition: all var(--transition-fast);">${isDark ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}</button>
            </div>
            <div style="padding: 16px 20px; border-top: 1px solid #e2e8f0;">
                <button id="btnLogout" style="width: 100%; margin-bottom: 12px; padding: 10px; background: #f56565; color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Logout</button>
            </div>
        `;
    } catch (error) {
        console.error('[MINHA CONTA] Erro ao carregar dados:', error);
        popup.innerHTML = `
            <div style="padding: 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 1.1rem;">Minha Conta</h3>
                <p style="margin: 0; color: #f56565;">Erro ao carregar dados: ${error.message}</p>
                <button id="btnLogout" style="width: 100%; margin-top: 16px; padding: 10px; background: #f56565; color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer; font-weight: 500;">Logout</button>
            </div>
        `;
    }
    document.body.appendChild(popup);
    // === Eventos de Foto ===
    const inputFoto = document.getElementById("inputFotoPerfil");
    const btnUploadFoto = document.getElementById("btnUploadFoto");
    if (inputFoto && btnUploadFoto) {
        inputFoto.addEventListener("change", previewFotoPerfil);
        btnUploadFoto.addEventListener("click", uploadFotoPerfil);
    }
    // Hover no lápis
    const container = document.getElementById("fotoPerfilContainer");
    const pencil = document.getElementById("editPencilOverlay");
    if (container && pencil) {
        container.addEventListener("mouseenter", () => {
            pencil.style.opacity = "1";
            pencil.style.display = "flex";
        });
        container.addEventListener("mouseleave", () => {
            pencil.style.opacity = "0";
        });
        pencil.addEventListener("click", (e) => {
            e.stopPropagation();
            abrirPopupTrocarFoto();
        });
    }
    // Fechar dropdown ao clicar fora
    const fecharDropdown = (e) => {
        if (!popup.contains(e.target) && e.target.id !== 'menu-minha-conta') {
            popup.remove();
            document.removeEventListener('click', fecharDropdown);
        }
    };
    document.addEventListener('click', fecharDropdown);
    // === Eventos existentes (mantidos 100%) ===
    const btnMudarSenha = document.getElementById("btnMudarSenha");
    if (btnMudarSenha) {
        btnMudarSenha.addEventListener("click", () => {
            popup.remove();
            mostrarPopupMudarSenha();
        });
    }
    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            sessionStorage.removeItem("loggedIn");
            sessionStorage.removeItem("userEmail");
            popup.remove();
            window.location.reload();
        });
    }
    const gameSelector = document.getElementById("gameSelectorDropdown");
    if (gameSelector) {
        gameSelector.addEventListener("change", async (e) => {
            const newGame = e.target.value;
            localStorage.setItem("currentGame", newGame);
            await carregarUserStatus();
            const currentSecao = localStorage.getItem("ultimaSecao") || "receitas";
            await carregarSecao(currentSecao);
            const games = await safeApi(`/games`);
            gameSelector.innerHTML = games.map(g => `<option value="${g}" ${g === newGame ? 'selected' : ''}>${g}</option>`).join("");
            socket.emit('joinGame', newGame);
        });
    }
    const btnNovoJogo = document.getElementById("btnNovoJogoDropdown");
    if (btnNovoJogo) {
        btnNovoJogo.addEventListener("click", () => {
            popup.remove();
            mostrarPopupNovoJogo();
        });
    }
    const themeToggle = document.getElementById("themeToggleDropdown");
    if (themeToggle) {
        themeToggle.addEventListener("click", (e) => {
            const currentMode = document.body.classList.contains('dark-mode') ? "dark" : "bright";
            const newMode = currentMode === "dark" ? "bright" : "dark";
            document.body.classList.remove("bright-mode", "dark-mode");
            document.body.classList.add(newMode + "-mode");
            localStorage.setItem("themeMode", newMode);
            popup.remove();
            document.removeEventListener("click", fecharDropdown);
        });
    }
    const toggle2FA = document.getElementById("toggle2FA");
    if (toggle2FA) {
        toggle2FA.addEventListener("change", async () => {
            const enable = toggle2FA.checked;
            try {
                const data = await safeApi('/toggle-2fa', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ enable })
                });
                if (!data.sucesso) {
                    alert(data.erro || 'Erro ao atualizar 2FA');
                    toggle2FA.checked = !enable;
                }
            } catch (error) {
                alert('Erro ao atualizar 2FA: ' + error.message);
                toggle2FA.checked = !enable;
            }
        });
    }
    const btnSalvarNome = document.getElementById("btnSalvarNome");
    if (btnSalvarNome) {
        btnSalvarNome.addEventListener("click", async () => {
            const editNomeInput = document.getElementById("editNome");
            const newName = editNomeInput.value.trim().replace(/^#\d+/, '');
            if (!newName || !/^[a-zA-Z0-9 ]+$/.test(newName) || newName.length > 50) {
                mostrarErro('Nome inválido: deve conter apenas letras, números e espaços, com até 50 caracteres.');
                return;
            }
            try {
                const data = await safeApi('/update-name', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newName })
                });
                if (data.sucesso) {
                    const updatedUser = await safeApi(`/me`);
                    editNomeInput.value = `#${updatedUser.id}${updatedUser.nome}`;
                    alert('Nome atualizado com sucesso!');
                } else {
                    mostrarErro(data.erro || 'Erro ao atualizar nome');
                }
            } catch (error) {
                mostrarErro('Erro ao atualizar nome: ' + error.message);
            }
        });
    }
}

function loadProfilePhotoWithFallback() {
    const preview = document.getElementById("previewFotoPerfil");
    if (!preview) return;
    const userEmail = sessionStorage.getItem('userEmail') || 'default'; // Ajuste se o email estiver em outro lugar
    const timestamp = new Date().getTime();
    const imgUrl = `/data/${encodeURIComponent(userEmail)}/profile.jpg?${timestamp}`;
    preview.src = imgUrl;
    preview.onerror = () => {
        preview.src = '/imagens/default-profile.jpg'; // Fallback se 404
    };
}

// Função para pré-visualizar a imagem selecionada
function previewImage(event, previewElementId) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById(previewElementId);
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

function abrirPopupEditarFoto() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupEditarFoto";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Editar Foto de Perfil</h2>
        <form id="formEditarFoto">
            <input type="file" id="inputFotoEditar" accept="image/*" style="margin-bottom: 10px;">
            <img id="previewFotoEditar" style="max-width: 100px; max-height: 100px; border-radius: 50%; display: none; margin-bottom: 10px;">
            <button type="submit" id="btnUploadFotoEditar">Salvar Foto</button>
            <button type="button" id="btnCancelarEditarFoto">Cancelar</button>
            <p id="erroEditarFoto" style="color: red; display: none;"></p>
        </form>
    `;
    document.body.appendChild(popup);
    loadProfilePhotoWithFallback();
    // Evento para pré-visualização no popup de edição
    document.getElementById("inputFotoEditar").addEventListener("change", (e) => previewImage(e, "previewFotoEditar"));
    // Evento de submit para upload (reutiliza a lógica de handleUploadFoto, mas atualiza o popup principal após sucesso)
    document.getElementById("formEditarFoto").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("inputFotoEditar");
        if (!fileInput.files[0]) {
            const erroEl = document.getElementById("erroEditarFoto");
            if (erroEl) {
                erroEl.textContent = "Selecione uma imagem";
                erroEl.style.display = "block";
            }
            return;
        }
        const formData = new FormData();
        formData.append('foto', fileInput.files[0]);
        try {
            const response = await fetch(`${API}/upload-foto`, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await response.json();
            if (data.sucesso) {
                // Fechar popup de edição
                popup.remove();
                overlay.remove();
                // Atualizar a foto no popup principal "Minha Conta" (se aberto)
                const profilePic = document.getElementById("profilePic");
                if (profilePic) {
                    profilePic.src = `${API}/data/${encodeURIComponent(sessionStorage.getItem('effectiveUser') || sessionStorage.getItem('user'))}/profile.jpg?${new Date().getTime()}`;
                    profilePic.style.display = 'block';
                }
                // Atualizar visibilidade no popup principal
                const uploadContainer = document.getElementById("uploadFotoContainer");
                if (uploadContainer) uploadContainer.style.display = 'none';
                const editPencil = document.getElementById("editPencil");
                if (editPencil) editPencil.style.display = 'block';
            } else {
                const erroEl = document.getElementById("erroEditarFoto");
                if (erroEl) {
                    erroEl.textContent = data.erro || "Erro ao fazer upload";
                    erroEl.style.display = "block";
                }
            }
        } catch (error) {
            const erroEl = document.getElementById("erroEditarFoto");
            if (erroEl) {
                erroEl.textContent = "Erro ao fazer upload";
                erroEl.style.display = "block";
            }
        }
    });
    document.getElementById("btnCancelarEditarFoto").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}

// Função para comprimir e redimensionar imagem (cliente-side)
async function compressAndResizeImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 150;
            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            // Comprimir para JPEG com qualidade inicial 0.7, ajustando se necessário para <50KB
            canvas.toBlob((blob) => {
                if (blob.size > 50 * 1024) {
                    // Se maior que 50KB, reduzir qualidade
                    canvas.toBlob((reducedBlob) => {
                        resolve(reducedBlob);
                    }, 'image/jpeg', 0.5); // Qualidade reduzida
                } else {
                    resolve(blob);
                }
            }, 'image/jpeg', 0.7); // Qualidade inicial
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// Popup para Mudar Senha
async function mostrarPopupMudarSenha() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupMudarSenha";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Mudar Senha</h2>
        <form id="formMudarSenha">
            <input type="password" id="senhaAtual" placeholder="Senha Atual" required>
            <p id="erroSenhaAtual" style="color: red; display: none;">Senha atual incorreta</p>
            <input type="password" id="novaSenha" placeholder="Nova Senha" required>
            <p id="erroNovaSenha" style="color: red; display: none;">Nova senha é obrigatória</p>
            <input type="password" id="confirmaNovaSenha" placeholder="Confirmar Nova Senha" required>
            <p id="erroConfirmaSenha" style="color: red; display: none;">Senhas não coincidem</p>
            <button type="submit">Salvar</button>
            <button type="button" id="btnCancelarMudarSenha">Cancelar</button>
        </form>
    `;
    document.body.appendChild(popup);
    document.getElementById("formMudarSenha").addEventListener("submit", async (e) => {
        e.preventDefault();
        const senhaAtual = document.getElementById("senhaAtual").value;
        const novaSenha = document.getElementById("novaSenha").value;
        const confirmaNovaSenha = document.getElementById("confirmaNovaSenha").value;
        // Resetar erros e bordas
        document.querySelectorAll("#formMudarSenha input").forEach(input => input.style.border = "1px solid #ccc");
        document.querySelectorAll("#formMudarSenha p").forEach(p => p.style.display = "none");
        let hasError = false;
        if (!senhaAtual) {
            document.getElementById("erroSenhaAtual").textContent = "Senha atual é obrigatória";
            document.getElementById("erroSenhaAtual").style.display = "block";
            document.getElementById("senhaAtual").style.border = "1px solid red";
            hasError = true;
        }
        if (!novaSenha) {
            document.getElementById("erroNovaSenha").textContent = "Nova senha é obrigatória";
            document.getElementById("erroNovaSenha").style.display = "block";
            document.getElementById("novaSenha").style.border = "1px solid red";
            hasError = true;
        }
        if (novaSenha !== confirmaNovaSenha) {
            document.getElementById("erroConfirmaSenha").textContent = "Senhas não coincidem";
            document.getElementById("erroConfirmaSenha").style.display = "block";
            document.getElementById("novaSenha").style.border = "1px solid red";
            document.getElementById("confirmaNovaSenha").style.border = "1px solid red";
            hasError = true;
        }
        if (hasError) return;
        try {
            const data = await safeApi(`/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ oldPassword: senhaAtual, newPassword: novaSenha })
            });
            if (data.sucesso) {
                alert("Senha alterada com sucesso!");
                popup.remove();
                overlay.remove();
            } else {
                document.getElementById("erroSenhaAtual").textContent = data.erro || "Erro ao mudar senha";
                document.getElementById("erroSenhaAtual").style.display = "block";
                document.getElementById("senhaAtual").style.border = "1px solid red";
            }
        } catch (error) {
            document.getElementById("erroSenhaAtual").textContent = "Erro ao mudar senha";
            document.getElementById("erroSenhaAtual").style.display = "block";
            document.getElementById("senhaAtual").style.border = "1px solid red";
        }
    });
    document.getElementById("btnCancelarMudarSenha").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
}

function abrirPopupTrocarFoto() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupTrocarFoto";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.borderRadius = "var(--border-radius-xl)";
    popup.style.boxShadow = "var(--shadow-xl)";
    popup.style.zIndex = "1001";
    popup.style.maxWidth = "400px";
    popup.style.width = "90%";
    popup.innerHTML = `
        <h3 style="margin: 0 0 16px; font-size: 1.1rem;">Trocar Foto de Perfil</h3>
        <div style="text-align: center; margin-bottom: 16px;">
            <img id="previewTrocarFoto" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; display: none; margin-bottom: 12px;">
            <input type="file" id="inputTrocarFoto" accept="image/*" style="margin-bottom: 12px;">
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="btnCancelarTrocar" style="padding: 8px 16px; background: #e2e8f0; color: #2d3748; border: none; border-radius: var(--border-radius-sm); cursor: pointer;">Cancelar</button>
            <button id="btnConfirmarTrocar" style="padding: 8px 16px; background: var(--primary-gradient); color: white; border: none; border-radius: var(--border-radius-sm); cursor: pointer;">Confirmar</button>
        </div>
        <p id="erroTrocarFoto" style="color: red; font-size: 0.85rem; margin-top: 8px; display: none;"></p>
    `;
    document.body.appendChild(popup);
    const inputTrocar = document.getElementById("inputTrocarFoto");
    const previewTrocar = document.getElementById("previewTrocarFoto");
    let processedFotoBlob = null; // Local para este popup, para evitar global
    inputTrocar.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                previewTrocar.src = ev.target.result;
                previewTrocar.style.display = "block";
                // Compressão para garantir tamanho < 50KB
                const img = new Image();
                img.src = ev.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 100;
                    canvas.height = 100;
                    ctx.drawImage(img, 0, 0, 100, 100);
                    canvas.toBlob((blob) => {
                        processedFotoBlob = blob;
                    }, 'image/jpeg', 0.8);
                };
            };
            reader.readAsDataURL(file);
        }
    });
    document.getElementById("btnCancelarTrocar").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
    });
    document.getElementById("btnConfirmarTrocar").addEventListener("click", async () => {
        const file = inputTrocar.files[0];
        if (!file) {
            document.getElementById("erroTrocarFoto").textContent = "Selecione uma imagem";
            document.getElementById("erroTrocarFoto").style.display = "block";
            return;
        }
        const formData = new FormData();
        const fileToUpload = processedFotoBlob || file;
        formData.append("foto", fileToUpload, 'profile.jpg'); // Adiciona filename para blobs
        try {
            const response = await fetch(`${API}/upload-foto`, {
                method: "POST",
                body: formData,
                credentials: "include"
            });
            const data = await response.json();
            if (data.sucesso) {
                // Atualizar foto no popup principal
                const imgPerfil = document.querySelector("#fotoPerfilImg");
                if (imgPerfil) {
                    imgPerfil.src = `${API}/data/${encodeURIComponent(sessionStorage.getItem('userEmail'))}/profile.jpg?${Date.now()}`;
                }
                popup.remove();
                overlay.remove();
            } else {
                document.getElementById("erroTrocarFoto").textContent = data.erro || 'Erro ao fazer upload';
                document.getElementById("erroTrocarFoto").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroTrocarFoto").textContent = 'Erro ao fazer upload: ' + error.message;
            document.getElementById("erroTrocarFoto").style.display = "block";
        }
    });
}

/* ------------------ Funções de Login e Cadastro ------------------ */
function criarOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.zIndex = "999";
    document.body.appendChild(overlay);
    return overlay;
}

function mostrarPopupLogin() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupLogin";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Login</h2>
        <form id="formLogin">
            <input type="email" id="emailLogin" placeholder="Email" required>
            <input type="password" id="senhaLogin" placeholder="Senha" required>
            <div id="recaptcha-login" class="g-recaptcha"></div>
            <button type="submit">Entrar</button>
            <button type="button" id="btnCadastrar">Cadastrar-se</button>
            <p id="erroLogin" style="color: red; display: none;">Usuário ou senha não encontrados</p>
        </form>
        <div id="otpSectionLogin" style="display: none;">
            <p>Código de verificação enviado para o seu email.</p>
            <input type="text" id="otpLogin" placeholder="Código de 6 dígitos" required maxlength="6">
            <button id="btnVerifyOtpLogin">Confirmar</button>
            <p id="erroOtpLogin" style="color: red; display: none;">Código inválido</p>
        </div>
    `;
    document.body.appendChild(popup);

    // Load reCAPTCHA with onload callback for better reliability
    if (!window.grecaptcha || !window.recaptchaLoadedLogin) {
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js?onload=recaptchaLoadedLogin&render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } else {
        recaptchaLoadedLogin();
    }

    // Define the onload function
    window.recaptchaLoadedLogin = () => {
        if (window.grecaptcha && document.getElementById('recaptcha-login')) {
            window.recaptchaWidgetLogin = grecaptcha.render('recaptcha-login', {
                'sitekey': RECAPTCHA_SITE_KEY
            });
        }
    };

    document.getElementById("formLogin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = grecaptcha.getResponse(window.recaptchaWidgetLogin);
        if (!token) {
            document.getElementById("erroLogin").textContent = "Por favor, valide o reCAPTCHA.";
            document.getElementById("erroLogin").style.display = "block";
            return;
        }
        const email = document.getElementById("emailLogin").value;
        const senha = document.getElementById("senhaLogin").value;
        try {
            const data = await safeApi(`/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha, recaptchaToken: token })
            });
            if (data.sucesso === 'otp_sent') {
                // Mostrar seção OTP
                document.getElementById("formLogin").style.display = "none";
                document.getElementById("otpSectionLogin").style.display = "block";
                // Limpar erros
                document.getElementById("erroLogin").style.display = "none";
            } else if (data.sucesso) {
                sessionStorage.setItem("loggedIn", "true");
                sessionStorage.setItem("userEmail", email);
                popup.remove();
                overlay.remove();
                initMenu();
                await initGames();
                await carregarUserStatus(); // Carregar status após login
                const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
                carregarSecao(ultimaSecao);
            } else {
                document.getElementById("erroLogin").textContent = data.erro || "Usuário ou senha não encontrados";
                document.getElementById("erroLogin").style.display = "block";
                document.getElementById("emailLogin").style.border = "1px solid red";
                document.getElementById("senhaLogin").style.border = "1px solid red";
                grecaptcha.reset(window.recaptchaWidgetLogin); // Reset reCAPTCHA em caso de erro
            }
        } catch (error) {
            document.getElementById("erroLogin").textContent = "Erro ao fazer login";
            document.getElementById("erroLogin").style.display = "block";
            document.getElementById("emailLogin").style.border = "1px solid red";
            document.getElementById("senhaLogin").style.border = "1px solid red";
            grecaptcha.reset(window.recaptchaWidgetLogin);
        }
    });
    // Listener para verificar OTP
    document.getElementById("btnVerifyOtpLogin").addEventListener("click", async () => {
        const email = document.getElementById("emailLogin").value;
        const code = document.getElementById("otpLogin").value.trim();
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            document.getElementById("erroOtpLogin").textContent = "Código deve ser 6 dígitos numéricos";
            document.getElementById("erroOtpLogin").style.display = "block";
            return;
        }
        try {
            const data = await safeApi(`/verify-otp-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code })
            });
            if (data.sucesso) {
                sessionStorage.setItem("loggedIn", "true");
                sessionStorage.setItem("userEmail", email);
                popup.remove();
                overlay.remove();
                initMenu();
                await initGames();
                await carregarUserStatus(); // Carregar status após login
                const ultimaSecao = localStorage.getItem("ultimaSecao") || "receitas";
                carregarSecao(ultimaSecao);
            } else {
                document.getElementById("erroOtpLogin").textContent = data.erro || "Código inválido";
                document.getElementById("erroOtpLogin").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroOtpLogin").textContent = "Erro ao verificar código";
            document.getElementById("erroOtpLogin").style.display = "block";
        }
    });
    document.getElementById("btnCadastrar").addEventListener("click", () => {
        popup.remove();
        overlay.remove();
        mostrarPopupCadastro();
    });
}

function mostrarPopupCadastro() {
    const overlay = criarOverlay();
    const popup = document.createElement("div");
    popup.id = "popupCadastro";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.zIndex = "1000";
    popup.innerHTML = `
        <h2>Cadastro</h2>
        <form id="formCadastro">
            <input type="text" id="nomeCadastro" placeholder="Nome" required>
            <input type="email" id="emailCadastro" placeholder="Email" required>
            <input type="password" id="senhaCadastro" placeholder="Senha" required>
            <input type="password" id="confirmaSenha" placeholder="Confirme sua senha" required>
            <div id="recaptcha-cadastro" class="g-recaptcha"></div>
            <button type="submit">Enviar solicitação de acesso</button>
            <button type="button" id="btnVoltarLogin">Voltar para Login</button>
            <p id="erroCadastro" style="color: red; display: none;"></p>
            <p id="mensagemCadastro" style="display: none;">Solicitação enviada</p>
            <div id="voltarConfirmacao" style="display: none;">
                <button type="button" id="btnVoltarLoginConfirmacao">Voltar para Login</button>
            </div>
        </form>
        <div id="otpSectionCadastro" style="display: none;">
            <p>Código de verificação enviado para o seu email.</p>
            <input type="text" id="otpCadastro" placeholder="Código de 6 dígitos" required maxlength="6">
            <button id="btnVerifyOtpCadastro">Confirmar</button>
            <p id="erroOtpCadastro" style="color: red; display: none;">Código inválido</p>
        </div>
    `;
    document.body.appendChild(popup);

    // Load reCAPTCHA with onload callback for better reliability
    if (!window.grecaptcha || !window.recaptchaLoadedCadastro) {
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js?onload=recaptchaLoadedCadastro&render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } else {
        recaptchaLoadedCadastro();
    }

    // Define the onload function
    window.recaptchaLoadedCadastro = () => {
        if (window.grecaptcha && document.getElementById('recaptcha-cadastro')) {
            window.recaptchaWidgetCadastro = grecaptcha.render('recaptcha-cadastro', {
                'sitekey': RECAPTCHA_SITE_KEY
            });
        }
    };

    document.getElementById("formCadastro").addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = grecaptcha.getResponse(window.recaptchaWidgetCadastro);
        if (!token) {
            document.getElementById("erroCadastro").textContent = "Por favor, valide o reCAPTCHA.";
            document.getElementById("erroCadastro").style.display = "block";
            return;
        }
        const nome = document.getElementById("nomeCadastro").value;
        const email = document.getElementById("emailCadastro").value;
        const senha = document.getElementById("senhaCadastro").value;
        const confirma = document.getElementById("confirmaSenha").value;
        if (senha !== confirma) {
            document.getElementById("erroCadastro").textContent = "Senhas não coincidem";
            document.getElementById("erroCadastro").style.display = "block";
            document.getElementById("senhaCadastro").style.border = "1px solid red";
            document.getElementById("confirmaSenha").style.border = "1px solid red";
            grecaptcha.reset(window.recaptchaWidgetCadastro);
            return;
        }
        try {
            const data = await safeApi(`/cadastro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email, senha, recaptchaToken: token })
            });
            if (data.sucesso === 'otp_sent') {
                // Mostrar seção OTP
                document.getElementById("formCadastro").style.display = "none";
                document.getElementById("otpSectionCadastro").style.display = "block";
                // Limpar erros
                document.getElementById("erroCadastro").style.display = "none";
            } else if (data.sucesso) {
                document.getElementById("formCadastro").querySelectorAll("input, button").forEach(el => el.style.display = "none");
                document.getElementById("mensagemCadastro").style.display = "block";
                document.getElementById("voltarConfirmacao").style.display = "block";
                setTimeout(() => {
                    popup.remove();
                    overlay.remove();
                    mostrarPopupLogin();
                }, 2000);
            } else {
                document.getElementById("erroCadastro").textContent = data.erro || "Erro ao cadastrar";
                document.getElementById("erroCadastro").style.display = "block";
                document.getElementById("emailCadastro").style.border = "1px solid red";
                grecaptcha.reset(window.recaptchaWidgetCadastro);
            }
        } catch (error) {
            document.getElementById("erroCadastro").textContent = "Erro ao cadastrar";
            document.getElementById("erroCadastro").style.display = "block";
            document.getElementById("emailCadastro").style.border = "1px solid red";
            grecaptcha.reset(window.recaptchaWidgetCadastro);
        }
    });
    // Listener para verificar OTP
    document.getElementById("btnVerifyOtpCadastro").addEventListener("click", async () => {
        const email = document.getElementById("emailCadastro").value;
        const code = document.getElementById("otpCadastro").value.trim();
        if (code.length !== 6 || !/^\d{6}$/.test(code)) {
            document.getElementById("erroOtpCadastro").textContent = "Código deve ser 6 dígitos numéricos";
            document.getElementById("erroOtpCadastro").style.display = "block";
            return;
        }
        try {
            const data = await safeApi(`/verify-otp-cadastro`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code })
            });
            if (data.sucesso) {
                document.getElementById("otpSectionCadastro").style.display = "none";
                document.getElementById("mensagemCadastro").style.display = "block";
                document.getElementById("voltarConfirmacao").style.display = "block";
                setTimeout(() => {
                    popup.remove();
                    overlay.remove();
                    mostrarPopupLogin();
                }, 2000);
            } else {
                document.getElementById("erroOtpCadastro").textContent = data.erro || "Código inválido";
                document.getElementById("erroOtpCadastro").style.display = "block";
            }
        } catch (error) {
            document.getElementById("erroOtpCadastro").textContent = "Erro ao verificar código";
            document.getElementById("erroOtpCadastro").style.display = "block";
        }
    });
    document.getElementById("btnVoltarLogin").addEventListener("click", () => {
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.remove();
        popup.remove();
        mostrarPopupLogin();
    });
    document.getElementById("btnVoltarLoginConfirmacao").addEventListener("click", () => {
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.remove();
        popup.remove();
        mostrarPopupLogin();
    });
}

//! FIM auth.js