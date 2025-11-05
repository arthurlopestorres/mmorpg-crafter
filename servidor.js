// servidor.js
//! INICIO SERVIDOR.JS
// servidor.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const session = require('express-session');
const axios = require('axios'); // Adicionado para verificação reCAPTCHA
const multer = require('multer');
const sharp = require('sharp');
require('dotenv').config();
const moment = require('moment-timezone');
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 10000;
const DATA_DIR = '/data';
const DEFAULT_GAME = 'Pax Dei';
// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.static(__dirname)); // Servir arquivos estáticos da raiz do projeto
app.use('/data', express.static(DATA_DIR));
app.use(session({
    secret: 'secret-key-mmo-crafter', // Mude para um secret seguro
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));
// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
// Configuração do Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(DATA_DIR, req.session.user.replace(/[^a-zA-Z0-9@._-]/g, ''))); // Diretório do usuário
    },
    filename: (req, file, cb) => {
        cb(null, 'profile.jpg'); // Sempre sobrescreve com profile.jpg
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 }, // 50KB max (já comprimido no cliente)
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Apenas imagens são permitidas'));
        }
        cb(null, true);
    }
});
// Novo: Map para armazenar OTPs temporários (email => {code, expire, type, tempData})
const otps = new Map();
const OTP_EXPIRE_MINUTES = 10;
// Função placeholder para sincronizarEstoque (substitua pelo código original)
async function sincronizarEstoque() {
    console.log('[sincronizarEstoque] Função placeholder executada. Substitua pelo código original.');
}
// Função para obter usuário efetivo baseado em associações
async function getEffectiveUser(user) {
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        const associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let current = user;
        const visited = new Set(); // Para evitar loops infinitos
        while (true) {
            if (visited.has(current)) {
                console.warn('[getEffectiveUser] Loop detectado em associações para:', user);
                break;
            }
            visited.add(current);
            const assoc = associations.find(a => a.secondary === current);
            if (!assoc) break;
            current = assoc.primary;
        }
        return current;
    } catch (error) {
        console.error('[getEffectiveUser] Erro:', error);
        return user;
    }
}
// Função para checar se é admin (founder ou co-founder)
async function isUserAdmin(userEmail) {
    if (!userEmail) return false;
    const effectiveUser = await getEffectiveUser(userEmail);
    if (effectiveUser === userEmail) return true; // Founder
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        const associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        const assoc = associations.find(a => a.primary === effectiveUser && a.secondary === userEmail);
        return assoc && assoc.role === 'co-founder';
    } catch (error) {
        console.error('[isUserAdmin] Erro:', error);
        return false;
    }
}
// Novo: Função para checar permissão granular para member
async function hasPermission(userEmail, permissionKey) {
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        const associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        const assoc = associations.find(a => a.secondary === userEmail);
        if (!assoc || assoc.role !== 'member') return false;
        return assoc.permissao && assoc.permissao[permissionKey] === true; // CORRIGIDO: era 'permissoes' → agora 'permissao'
    } catch (error) {
        console.error('[hasPermission] Erro:', error);
        return false;
    }
}
// Função para verificar se o jogo é próprio do session user
async function isOwnGame(sessionUser, game) {
    const safeUser = sessionUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    try {
        await fs.access(gameDir);
        return true;
    } catch {
        return false;
    }
}
// Função para obter o gameDir correto
async function getGameDir(sessionUser, effectiveUser, game) {
    const safeOwn = sessionUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const ownDir = path.join(DATA_DIR, safeOwn, safeGame);
    try {
        await fs.access(ownDir);
        return ownDir;
    } catch {
        const safeEff = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
        return path.join(DATA_DIR, safeEff, safeGame);
    }
}
// Nova função para obter a lista de jogos acessíveis ao usuário
async function getUserGames(sessionUser) {
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isFounderLocal = effectiveUser === sessionUser;
    let games = [];
    // Listar jogos próprios
    const safeOwn = sessionUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const ownDir = path.join(DATA_DIR, safeOwn);
    try {
        const ownFiles = await fs.readdir(ownDir, { withFileTypes: true });
        games.push(...ownFiles.filter(f => f.isDirectory()).map(f => f.name));
    } catch (error) {
        console.warn('[getUserGames] No own dir:', error);
    }
    // Se não for founder, adicionar jogos compartilhados do effectiveUser
    if (!isFounderLocal) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        try {
            const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
            games.push(...shared);
        } catch (error) {
            console.warn('[getUserGames] No shared:', error);
        }
    }
    games = [...new Set(games)].sort();
    return games;
}
// Função para gerar ID único de 4-6 dígitos
async function generateUniqueId() {
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
    let id;
    do {
        const digits = Math.floor(Math.random() * 3) + 4; // 4 a 6 dígitos
        id = Math.floor(Math.random() * Math.pow(10, digits)).toString().padStart(digits, '0');
    } while (usuarios.some(u => u.id === id));
    return id;
}
// Função para salvar usuários (auxiliar para updates)
async function saveUsuarios(usuarios) {
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    usuarios = usuarios.map(u => ({ ...u, fotoPath: u.fotoPath || '' }));
    await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));
}
// Criar diretório de dados e arquivos JSON iniciais, se não existirem
async function inicializarArquivos() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('[INIT] Diretório de dados criado ou já existente:', DATA_DIR);
        // Usuarios global
        const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
        try {
            await fs.access(usuariosPath);
        } catch {
            await fs.writeFile(usuariosPath, JSON.stringify([]));
            console.log('[INIT] Criado usuarios.json na raiz');
        }
        // Associações de usuários
        const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
        try {
            await fs.access(associationsPath);
        } catch {
            await fs.writeFile(associationsPath, JSON.stringify([]));
            console.log('[INIT] Criado usuarios-associacoes.json na raiz');
        }
        // Banidos de usuários
        const banidosPath = path.join(DATA_DIR, 'usuarios-banidos.json');
        try {
            await fs.access(banidosPath);
        } catch {
            await fs.writeFile(banidosPath, JSON.stringify([]));
            console.log('[INIT] Criado usuarios-banidos.json na raiz');
        }
        // Pendências de convites
        const pendenciasPath = path.join(DATA_DIR, 'usuarios-pendencias.json');
        try {
            await fs.access(pendenciasPath);
        } catch {
            await fs.writeFile(pendenciasPath, JSON.stringify([]));
            console.log('[INIT] Criado usuarios-pendencias.json na raiz');
        }
    } catch (error) {
        console.error('[INIT] Erro ao inicializar arquivos:', error);
    }
}
// Inicializar arquivos antes de iniciar o servidor
inicializarArquivos().then(() => {
    console.log('[INIT] Arquivos de dados inicializados com sucesso');
}).catch(error => {
    console.error('[INIT] Falha ao inicializar arquivos:', error);
});
// Middleware de autenticação
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ sucesso: false, erro: 'Não autorizado' });
    }
};
// Middleware para admin (headers)
const isAdmin = (req, res, next) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    next();
};
// Função para verificar reCAPTCHA (usada em login e cadastro)
async function verificarRecaptcha(token) {
    if (!process.env.RECAPTCHA_SECRET) {
        console.error('[reCAPTCHA] Secret key não configurada no .env');
        return false;
    }
    try {
        const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
            params: {
                secret: process.env.RECAPTCHA_SECRET,
                response: token
            }
        });
        return response.data.success;
    } catch (error) {
        console.error('[reCAPTCHA] Erro na verificação:', error.message);
        return false;
    }
}
// Função auxiliar para obter caminho do arquivo baseado no user e game
function getFilePath(gameDir, filename) {
    return path.join(gameDir, filename);
}
// Novo: Função para gerar OTP de 6 dígitos
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Novo: Função para enviar OTP por email
async function sendOTP(email, otp, type) {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: type === 'login' ? 'Código de Verificação de Login' : 'Código de Verificação de Cadastro',
            text: `Seu código de verificação é: ${otp}\n\nEste código expira em ${OTP_EXPIRE_MINUTES} minutos.`
        });
        return true;
    } catch (error) {
        console.error('[sendOTP] Erro ao enviar email:', error);
        return false;
    }
}
// Endpoint: Login - Etapa 1: Enviar OTP se necessário
app.post('/login', async (req, res) => {
    const { email, senha, recaptchaToken } = req.body;
    try {
        // Verificar reCAPTCHA
        if (!await verificarRecaptcha(recaptchaToken)) {
            return res.status(400).json({ sucesso: false, erro: 'reCAPTCHA inválido' });
        }
        const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const usuario = usuarios.find(u => u.email === email);
        if (!usuario || !usuario.aprovado) {
            return res.status(401).json({ sucesso: false, erro: 'Usuário ou senha não encontrados' });
        }
        // Verificar senha
        if (!await bcrypt.compare(senha, usuario.senhaHash)) {
            return res.status(401).json({ sucesso: false, erro: 'Senha incorreta' });
        }
        // Verificar se doisFatores está ativado
        const doisFatores = usuario.doisFatores !== false; // Default true se não existir
        if (!doisFatores) {
            // Login direto sem OTP
            req.session.user = email;
            // Atribuir plano "basic" se não existir
            if (!usuario.plano) {
                usuario.plano = "basic";
                const index = usuarios.findIndex(u => u.email === email);
                usuarios[index] = usuario;
                await saveUsuarios(usuarios);
            }
            return res.json({ sucesso: true });
        }
        // Gerar OTP e enviar
        const otp = generateOTP();
        if (!await sendOTP(email, otp, 'login')) {
            return res.status(500).json({ sucesso: false, erro: 'Erro ao enviar código de verificação' });
        }
        // Armazenar OTP (sem tempData, pois senha já foi validada)
        const expire = Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000;
        otps.set(email, { code: otp, expire, type: 'login' });
        res.json({ sucesso: 'otp_sent' });
    } catch (error) {
        console.error('[POST /login] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao processar login' });
    }
});
// Novo: Endpoint para verificar OTP no login
app.post('/verify-otp-login', async (req, res) => {
    const { email, code } = req.body;
    try {
        const otpData = otps.get(email);
        if (!otpData || otpData.type !== 'login' || Date.now() > otpData.expire || otpData.code !== code.trim()) {
            return res.status(400).json({ sucesso: false, erro: 'Código inválido ou expirado' });
        }
        // Como a senha já foi validada na etapa anterior, prosseguir com o login
        req.session.user = email;
        // Limpar OTP
        otps.delete(email);
        // Proceder com ações pós-login, se necessário
        let usuarios = await fs.readFile(path.join(DATA_DIR, 'usuarios.json'), 'utf8').then(JSON.parse).catch(() => []);
        const usuario = usuarios.find(u => u.email === email);
        if (!usuario.id) {
            usuario.id = await generateUniqueId();
            const index = usuarios.findIndex(u => u.email === email);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        if (!usuario.nome || usuario.nome.trim() === '') {
            usuario.nome = "Lorem Ipsum";
            const index = usuarios.findIndex(u => u.email === email);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Atribuir plano "basic" se não existir
        if (!usuario.plano) {
            usuario.plano = "basic";
            const index = usuarios.findIndex(u => u.email === email);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /verify-otp-login] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao verificar código' });
    }
});
// Endpoint: Cadastro - Etapa 1: Enviar OTP
app.post('/cadastro', async (req, res) => {
    const { nome, email, senha, recaptchaToken } = req.body;
    try {
        // Verificar reCAPTCHA
        if (!await verificarRecaptcha(recaptchaToken)) {
            return res.status(400).json({ sucesso: false, erro: 'reCAPTCHA inválido' });
        }
        const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (usuarios.some(u => u.email === email)) {
            return res.status(400).json({ sucesso: false, erro: 'Email já cadastrado' });
        }
        // Gerar OTP e enviar
        const otp = generateOTP();
        if (!await sendOTP(email, otp, 'cadastro')) {
            return res.status(500).json({ sucesso: false, erro: 'Erro ao enviar código de verificação' });
        }
        // Armazenar OTP e dados temporários
        const expire = Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000;
        const senhaHash = await bcrypt.hash(senha, 10);
        otps.set(email, { code: otp, expire, type: 'cadastro', tempData: { nome, senhaHash } });
        res.json({ sucesso: 'otp_sent' });
    } catch (error) {
        console.error('[POST /cadastro] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao processar cadastro' });
    }
});
// Novo: Endpoint para verificar OTP no cadastro
app.post('/verify-otp-cadastro', async (req, res) => {
    const { email, code } = req.body;
    try {
        const otpData = otps.get(email);
        if (!otpData || otpData.type !== 'cadastro' || Date.now() > otpData.expire || otpData.code !== code.trim()) {
            return res.status(400).json({ sucesso: false, erro: 'Código inválido ou expirado' });
        }
        // Salvar usuário
        const { nome, senhaHash } = otpData.tempData;
        const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const id = await generateUniqueId();
        usuarios.push({ nome, email, senhaHash, id, aprovado: false, doisFatores: true, plano: "basic" }); // Novo: doisFatores true por padrão e plano "basic"
        await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));
        // Enviar email para admin
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: 'mmorpgcrafter@gmail.com',
            subject: 'Solicitação de Acesso',
            text: `Usuário solicitou acesso:\nNome: ${nome}\nEmail: ${email}`
        });
        // Limpar OTP
        otps.delete(email);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /verify-otp-cadastro] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao verificar código' });
    }
});
// Endpoint para status do usuário (agora inclui isAdmin per game)
app.get('/user-status', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const effectiveUser = await getEffectiveUser(user);
    const isFounder = effectiveUser === user;
    const isOwn = await isOwnGame(user, game);
    let isAdminLocal = isOwn ? true : await isUserAdmin(user);
    // Novo: Incluir permissões granulares se member
    let permissao = {};
    if (!isFounder && !isAdminLocal) {
        permissao = await getMemberPermissoes(user);
    }
    res.json({ isFounder, isAdmin: isAdminLocal, effectiveUser, permissao });
});
// Novo: Função auxiliar para obter permissões de member
async function getMemberPermissoes(userEmail) {
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        const associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        const assoc = associations.find(a => a.secondary === userEmail);
        return assoc ? assoc.permissao || {} : {}; // CORRIGIDO: era 'permissoes' → agora 'permissao'
    } catch (error) {
        console.error('[getMemberPermissoes] Erro:', error);
        return {};
    }
}
// Novo: Endpoint para definir permissões granulares (só founder)
app.post('/set-permissoes', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    if (effectiveUser !== user) {
        return res.status(403).json({ sucesso: false, erro: 'Apenas o fundador pode definir permissões' });
    }
    const { secondary, permissao } = req.body;
    if (!secondary || typeof permissao !== 'object') {
        return res.status(400).json({ sucesso: false, erro: 'Secondary e permissões são obrigatórios' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        const assocIndex = associations.findIndex(a => a.primary === user && a.secondary === secondary && a.role === 'member');
        if (assocIndex === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Associação de member não encontrada' });
        }
        associations[assocIndex].permissao = permissao; // CORRIGIDO: permissao
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[SET-PERMISSOES] Permissões atualizadas para ${secondary} por ${user}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[SET-PERMISSOES] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar permissões' });
    }
});
// Novo: Endpoint para obter dados do usuário logado efetivo (/me)
app.get('/me', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuario = usuarios.find(u => u.email === user);
        if (!usuario) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        // Gerar ID se não existir
        if (!usuario.id) {
            usuario.id = await generateUniqueId();
            const index = usuarios.findIndex(u => u.email === user);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Setar nome padrão se não existir
        if (!usuario.nome || usuario.nome.trim() === '') {
            usuario.nome = "Lorem Ipsum";
            const index = usuarios.findIndex(u => u.email === user);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Garantir doisFatores se ausente
        if (usuario.doisFatores === undefined) {
            usuario.doisFatores = true;
            const index = usuarios.findIndex(u => u.email === user);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Garantir fotoPath se ausente
        if (!usuario.fotoPath) {
            usuario.fotoPath = '';
            const index = usuarios.findIndex(u => u.email === user);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Não retornar senha
        const { senhaHash, ...safeUser } = usuario;
        res.json(safeUser);
    } catch (error) {
        console.error('[GET /me] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao buscar usuário' });
    }
});
// Endpoint para toggle 2FA
app.post('/toggle-2fa', isAuthenticated, async (req, res) => {
    const { enable } = req.body;
    if (enable === undefined) {
        return res.status(400).json({ sucesso: false, erro: 'Enable é obrigatório' });
    }
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === req.session.user);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        usuarios[index].doisFatores = enable;
        await saveUsuarios(usuarios);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /toggle-2fa] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar 2FA' });
    }
});
// Upload de fotos
// Novo: Endpoint para upload de foto de perfil
app.post('/upload-foto', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const safeUser = sessionUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const userDir = path.join(DATA_DIR, safeUser);
    try {
        // Criar diretório se não existir (corrige erro para novos perfis)
        await fs.mkdir(userDir, { recursive: true });
        console.log(`[UPLOAD-FOTO] Diretório criado/verificado: ${userDir}`);
        // Wrapper para tornar upload async
        await new Promise((resolve, reject) => {
            upload.single('foto')(req, res, (err) => {
                if (err instanceof multer.MulterError) {
                    console.error('[UPLOAD-FOTO] MulterError:', err);
                    reject(err);
                } else if (err) {
                    console.error('[UPLOAD-FOTO] Erro geral:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        // Processar com sharp, usando arquivo temporário para evitar erro de input/output igual
        const inputPath = path.join(userDir, 'profile.jpg');
        const tempOutputPath = path.join(userDir, 'profile-temp.jpg'); // Arquivo temporário
        try {
            await sharp(inputPath)
                .resize(100, 100, { fit: 'cover' })
                .jpeg({ quality: 80 })
                .toFile(tempOutputPath);
            // Substituir o original pelo processado
            await fs.unlink(inputPath); // Deletar o original
            await fs.rename(tempOutputPath, inputPath); // Renomear temp para original
            console.log('[UPLOAD-FOTO] Imagem processada com sucesso');
        } catch (sharpErr) {
            console.error('[UPLOAD-FOTO] Erro no processamento:', sharpErr);
            // Limpar temp se existir
            try { await fs.unlink(tempOutputPath); } catch { }
            return res.status(500).json({ sucesso: false, erro: 'Erro ao processar imagem' });
        }
        // Atualizar usuarios.json com fotoPath
        const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === sessionUser);
        if (index !== -1) {
            usuarios[index].fotoPath = `/data/${safeUser}/profile.jpg`;
            await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));
        }
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[UPLOAD-FOTO] Erro:', error);
        // Limpar temp se existir em caso de erro geral
        const tempOutputPath = path.join(userDir, 'profile-temp.jpg');
        try { await fs.unlink(tempOutputPath); } catch { }
        res.status(500).json({ sucesso: false, erro: 'Erro ao processar upload' });
    }
});
// Endpoint para atualizar o nome do usuário logado
app.post('/update-name', isAuthenticated, async (req, res) => {
    const { newName } = req.body;
    if (!newName || typeof newName !== 'string' || !/^[a-zA-Z0-9 ]+$/.test(newName) || newName.trim().length < 1 || newName.trim().length > 50) {
        return res.status(400).json({ sucesso: false, erro: 'Nome inválido: deve conter apenas letras, números e espaços, com 1 a 50 caracteres.' });
    }
    const trimmedName = newName.trim();
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === req.session.user);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        usuarios[index].nome = trimmedName;
        await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /update-name] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar nome' });
    }
});
// Endpoint para buscar dados do usuário por email
app.get('/usuarios', isAuthenticated, async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ sucesso: false, erro: 'Email é obrigatório' });
    }
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuario = usuarios.find(u => u.email === email);
        if (!usuario) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        // Gerar ID se não existir
        if (!usuario.id) {
            usuario.id = await generateUniqueId();
            const index = usuarios.findIndex(u => u.email === email);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Setar nome padrão se não existir
        if (!usuario.nome || usuario.nome.trim() === '') {
            usuario.nome = "Lorem Ipsum";
            const index = usuarios.findIndex(u => u.email === email);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Não retornar senha
        const { senhaHash, ...safeUser } = usuario;
        res.json(safeUser);
    } catch (error) {
        console.error('[GET /usuarios] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao buscar usuário' });
    }
});
// Novo: Endpoint para promover/demover co-founder (só founder)
app.post('/promote-cofounder', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    if (effectiveUser !== user) {
        return res.status(403).json({ sucesso: false, erro: 'Apenas o fundador pode promover co-fundadores' });
    }
    const { secondary, promote } = req.body;
    if (!secondary || promote === undefined) {
        return res.status(400).json({ sucesso: false, erro: 'Secondary e promote são obrigatórios' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        const assocIndex = associations.findIndex(a => a.primary === user && a.secondary === secondary);
        if (assocIndex === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Associação não encontrada' });
        }
        associations[assocIndex].role = promote ? 'co-founder' : 'member';
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[PROMOTE-COFOUNDER] ${secondary} ${promote ? 'promovido' : 'removido'} como co-founder por ${user}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[PROMOTE-COFOUNDER] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar co-founder' });
    }
});
// Endpoint para enviar convite
app.post('/enviar-convite', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    if (effectiveUser !== user) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado a enviar convites' });
    }
    const { to } = req.body;
    if (!to) {
        return res.status(400).json({ sucesso: false, erro: 'Destinatário é obrigatório' });
    }
    const pendenciasPath = path.join(DATA_DIR, 'usuarios-pendencias.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        let pendencias = await fs.readFile(pendenciasPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!usuarios.some(u => u.email === to && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Destinatário não aprovado' });
        }
        if (associations.some(a => a.primary === to || a.secondary === to)) {
            return res.status(400).json({ sucesso: false, erro: 'Destinatário já faz parte de um time' });
        }
        if (pendencias.some(p => p.from === user && p.to === to)) {
            return res.status(400).json({ sucesso: false, erro: 'Convite já pendente' });
        }
        pendencias.push({ from: user, to, date: new Date().toISOString() });
        await fs.writeFile(pendenciasPath, JSON.stringify(pendencias, null, 2));
        console.log(`[ENVIAR-CONVITE] Convite enviado de ${user} para ${to}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[ENVIAR-CONVITE] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao enviar convite' });
    }
});
// Endpoint para listar pendências do usuário
app.get('/pendencias', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const pendenciasPath = path.join(DATA_DIR, 'usuarios-pendencias.json');
    try {
        const pendencias = await fs.readFile(pendenciasPath, 'utf8').then(JSON.parse).catch(() => []);
        const minhasPendencias = pendencias.filter(p => p.to === user);
        res.json(minhasPendencias);
    } catch (error) {
        console.error('[GET /pendencias] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar pendências' });
    }
});
// Endpoint para aceitar convite
app.post('/aceitar-convite', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const { from } = req.body;
    if (!from) {
        return res.status(400).json({ sucesso: false, erro: 'Remetente é obrigatório' });
    }
    const pendenciasPath = path.join(DATA_DIR, 'usuarios-pendencias.json');
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let pendencias = await fs.readFile(pendenciasPath, 'utf8').then(JSON.parse).catch(() => []);
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        // Remover pendência
        const pendIndex = pendencias.findIndex(p => p.from === from && p.to === user);
        if (pendIndex === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Convite não encontrado' });
        }
        pendencias.splice(pendIndex, 1);
        // Adicionar associação com permissões padrão false
        if (associations.some(a => a.secondary === user)) {
            return res.status(400).json({ sucesso: false, erro: 'Você já está em um time' });
        }
        associations.push({
            primary: from, secondary: user, role: 'member', permissao: {
                criarCategorias: false,
                excluirCategorias: false,
                criarComponente: false,
                editarComponente: false,
                excluirComponente: false,
                exportarEstoque: false,
                importarEstoque: false,
                criarReceitas: false,
                favoritarReceitas: false,
                concluirReceitas: false,
                duplicarReceitas: false,
                editarReceitas: false,
                fabricarComponentes: false,
                criarRoadmap: false,
                excluirRoadmap: false,
                reordenarRoadmap: false,
                marcarProntoRoadmap: false,
                criarEvento: false,
                editarEvento: false,
                excluirEvento: false,
                associarMembrosEvento: false
            }
        });
        await fs.writeFile(pendenciasPath, JSON.stringify(pendencias, null, 2));
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[ACEITAR-CONVITE] ${user} aceitou convite de ${from}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[ACEITAR-CONVITE] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao aceitar convite' });
    }
});
// Endpoint para recusar convite
app.post('/recusar-convite', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const { from } = req.body;
    if (!from) {
        return res.status(400).json({ sucesso: false, erro: 'Remetente é obrigatório' });
    }
    const pendenciasPath = path.join(DATA_DIR, 'usuarios-pendencias.json');
    try {
        let pendencias = await fs.readFile(pendenciasPath, 'utf8').then(JSON.parse).catch(() => []);
        const pendIndex = pendencias.findIndex(p => p.from === from && p.to === user);
        if (pendIndex === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Convite não encontrado' });
        }
        pendencias.splice(pendIndex, 1);
        await fs.writeFile(pendenciasPath, JSON.stringify(pendencias, null, 2));
        console.log(`[RECUSAR-CONVITE] ${user} recusou convite de ${from}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[RECUSAR-CONVITE] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao recusar convite' });
    }
});
// Endpoint para associar usuários (protegido por headers)
app.post('/associate-users', async (req, res) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    const { primary, secondary } = req.body;
    if (!primary || !secondary) {
        return res.status(400).json({ sucesso: false, erro: 'Primary e secondary são obrigatórios' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (associations.some(a => a.secondary === secondary)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary já associado' });
        }
        if (!usuarios.some(u => u.email === primary)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não encontrado nos usuários' });
        }
        if (!usuarios.some(u => u.email === secondary)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não encontrado nos usuários' });
        }
        associations.push({
            primary, secondary, role: 'member', permissao: {
                criarCategorias: false,
                excluirCategorias: false,
                criarComponente: false,
                editarComponente: false,
                excluirComponente: false,
                exportarEstoque: false,
                importarEstoque: false,
                criarReceitas: false,
                favoritarReceitas: false,
                concluirReceitas: false,
                duplicarReceitas: false,
                editarReceitas: false,
                fabricarComponentes: false,
                criarRoadmap: false,
                excluirRoadmap: false,
                reordenarRoadmap: false,
                marcarProntoRoadmap: false,
                criarEvento: false,
                editarEvento: false,
                excluirEvento: false,
                associarMembrosEvento: false
            }
        }); // Novo: Role padrão 'member' com permissões padrão false
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[ASSOCIATE-USERS] Associado ${secondary} ao primary ${primary}`);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[ASSOCIATE-USERS] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao associar usuários' });
    }
});
// Endpoint para desvincular usuários (protegido por headers)
app.post('/dissociate-users', async (req, res) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    const { primary, secondary } = req.body;
    if (!primary || !secondary) {
        return res.status(400).json({ sucesso: false, erro: 'Primary e secondary são obrigatórios' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!usuarios.some(u => u.email === primary)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não encontrado nos usuários' });
        }
        if (!usuarios.some(u => u.email === secondary)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não encontrado nos usuários' });
        }
        const index = associations.findIndex(a => a.primary === primary && a.secondary === secondary);
        if (index === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Associação não encontrada entre primary e secondary especificados' });
        }
        associations.splice(index, 1);
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[DISSOCIATE-USERS] Desvinculado ${secondary} do primary ${primary}`);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DISSOCIATE-USERS] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao desvincular usuários' });
    }
});
// Endpoint para listar associações do usuário logado
app.get('/associacoes', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        const associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        const asPrimary = associations.filter(a => a.primary === user).map(a => ({ secondary: a.secondary, role: a.role || 'member', permissao: a.permissao || {} })); // Novo: Incluir permissões
        const asSecondaryAssoc = associations.find(a => a.secondary === user);
        const asSecondary = asSecondaryAssoc ? [{ secondary: asSecondaryAssoc.primary, role: asSecondaryAssoc.role || 'member', permissao: asSecondaryAssoc.permissao || {} }] : []; // Novo: Incluir permissões
        const allAssociados = [...asPrimary, ...asSecondary];
        res.json(allAssociados);
    } catch (error) {
        console.error('[GET /associacoes] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar associações' });
    }
});
// Endpoint para associar usuário (self)
app.post('/associate-self', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    if (effectiveUser !== user) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado a adicionar membros' });
    }
    const { secondary } = req.body;
    if (!secondary) {
        return res.status(400).json({ sucesso: false, erro: 'Secondary é obrigatório' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (associations.some(a => a.secondary === secondary)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary já associado' });
        }
        if (!usuarios.some(u => u.email === user && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não autorizado' });
        }
        if (!usuarios.some(u => u.email === secondary)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não aprovado' });
        }
        // Novo: Checar limite de membros baseado no plano do founder (user)
        const founder = usuarios.find(u => u.email === user);
        const plano = founder.plano || 'basic';
        const memberLimits = { basic: 5, standard: 25, advanced: 100, fullpass: Infinity };
        const limit = memberLimits[plano];
        const currentMembers = associations.filter(a => a.primary === user).length;
        if (currentMembers >= limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de membros atingido para o plano ${plano}` });
        }
        associations.push({
            primary: user, secondary, role: 'member', permissao: {
                criarCategorias: false,
                excluirCategorias: false,
                criarComponente: false,
                editarComponente: false,
                excluirComponente: false,
                exportarEstoque: false,
                importarEstoque: false,
                criarReceitas: false,
                favoritarReceitas: false,
                concluirReceitas: false,
                duplicarReceitas: false,
                editarReceitas: false,
                fabricarComponentes: false,
                criarRoadmap: false,
                excluirRoadmap: false,
                reordenarRoadmap: false,
                marcarProntoRoadmap: false,
                criarEvento: false,
                editarEvento: false,
                excluirEvento: false,
                associarMembrosEvento: false
            }
        }); // Novo: Role 'member' com permissões padrão false
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[ASSOCIATE-SELF] Associado ${secondary} ao primary ${user}`);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[ASSOCIATE-SELF] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao associar usuário' });
    }
});
// Endpoint para desvincular usuário (self)
app.post('/dissociate-self', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    if (effectiveUser !== user) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado a remover membros' });
    }
    const { secondary } = req.body;
    if (!secondary) {
        return res.status(400).json({ sucesso: false, erro: 'Secondary é obrigatório' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!usuarios.some(u => u.email === user && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não autorizado' });
        }
        if (!usuarios.some(u => u.email === secondary && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não encontrado' });
        }
        const index = associations.findIndex(a => a.primary === user && a.secondary === secondary);
        if (index === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Associação não encontrada' });
        }
        associations.splice(index, 1);
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[DISSOCIATE-SELF] Desvinculado ${secondary} do primary ${user}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[DISSOCIATE-SELF] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao desvincular usuário' });
    }
});
// Novo endpoint para desvincular como secondary
app.post('/dissociate-as-secondary', isAuthenticated, async (req, res) => {
    const secondary = req.session.user;
    const { primary } = req.body;
    if (!primary) {
        return res.status(400).json({ sucesso: false, erro: 'Primary é obrigatório' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!usuarios.some(u => u.email === secondary && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não autorizado' });
        }
        if (!usuarios.some(u => u.email === primary && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não encontrado' });
        }
        const index = associations.findIndex(a => a.primary === primary && a.secondary === secondary);
        if (index === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Associação não encontrada' });
        }
        associations.splice(index, 1);
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        console.log(`[DISSOCIATE-AS-SECONDARY] Desvinculado ${secondary} do primary ${primary}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(secondary);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[DISSOCIATE-AS-SECONDARY] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao desvincular usuário' });
    }
});
// Endpoint para banir usuário
app.post('/ban-user', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    if (effectiveUser !== user) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado a banir usuários' });
    }
    const { secondary } = req.body;
    if (!secondary) {
        return res.status(400).json({ sucesso: false, erro: 'Secondary é obrigatório' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const banidosPath = path.join(DATA_DIR, 'usuarios-banidos.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let banidos = await fs.readFile(banidosPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        // Primeiro, desvincular se associado
        const assocIndex = associations.findIndex(a => a.primary === user && a.secondary === secondary);
        if (assocIndex !== -1) {
            associations.splice(assocIndex, 1);
            await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        }
        if (!usuarios.some(u => u.email === user && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não autorizado' });
        }
        if (!usuarios.some(u => u.email === secondary)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não encontrado' });
        }
        if (banidos.some(b => b.primary === user && b.banned === secondary)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary já banido' });
        }
        banidos.push({ primary: user, banned: secondary, date: new Date().toISOString() });
        await fs.writeFile(banidosPath, JSON.stringify(banidos, null, 2));
        console.log(`[BAN-USER] ${secondary} banido por ${user}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[BAN-USER] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao banir usuário' });
    }
});
// Novo endpoint para banir como secondary (banir o primary)
app.post('/ban-as-secondary', isAuthenticated, async (req, res) => {
    const secondary = req.session.user;
    const { primary: banned } = req.body;
    if (!banned) {
        return res.status(400).json({ sucesso: false, erro: 'Primary a ser banido é obrigatório' });
    }
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const banidosPath = path.join(DATA_DIR, 'usuarios-banidos.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        let banidos = await fs.readFile(banidosPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        // Primeiro, desvincular se associado
        const assocIndex = associations.findIndex(a => a.primary === banned && a.secondary === secondary);
        if (assocIndex !== -1) {
            associations.splice(assocIndex, 1);
            await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        }
        if (!usuarios.some(u => u.email === secondary && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não autorizado' });
        }
        if (!usuarios.some(u => u.email === banned)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não encontrado' });
        }
        if (banidos.some(b => b.primary === secondary && b.banned === banned)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary já banido' });
        }
        banidos.push({ primary: secondary, banned, date: new Date().toISOString() });
        await fs.writeFile(banidosPath, JSON.stringify(banidos, null, 2));
        console.log(`[BAN-AS-SECONDARY] ${banned} banido por ${secondary}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(secondary);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[BAN-AS-SECONDARY] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao banir usuário' });
    }
});
// Endpoint para listar banidos do usuário logado
app.get('/banidos', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const banidosPath = path.join(DATA_DIR, 'usuarios-banidos.json');
    try {
        const banidos = await fs.readFile(banidosPath, 'utf8').then(JSON.parse).catch(() => []);
        const asBanning = banidos.filter(b => b.primary === user).map(b => ({ banned: b.banned, role: 'banning' }));
        const asBannedBy = banidos.filter(b => b.banned === user).map(b => ({ banned: b.primary, role: 'banned' }));
        const allBanidos = [...asBanning, ...asBannedBy];
        res.json(allBanidos);
    } catch (error) {
        console.error('[GET /banidos] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar banidos' });
    }
});
// Endpoint para desbanir usuário
app.post('/unban-user', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    if (effectiveUser !== user) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado a desbanir usuários' });
    }
    const { bannedEmail } = req.body;
    if (!bannedEmail) {
        return res.status(400).json({ sucesso: false, erro: 'Banned email é obrigatório' });
    }
    const banidosPath = path.join(DATA_DIR, 'usuarios-banidos.json');
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let banidos = await fs.readFile(banidosPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!usuarios.some(u => u.email === user && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Primary não autorizado' });
        }
        const index = banidos.findIndex(b => b.primary === user && b.banned === bannedEmail);
        if (index === -1) {
            return res.status(400).json({ sucesso: false, erro: 'Banimento não encontrado' });
        }
        banidos.splice(index, 1);
        await fs.writeFile(banidosPath, JSON.stringify(banidos, null, 2));
        console.log(`[UNBAN-USER] ${bannedEmail} desbanido por ${user}`);
        res.json({ sucesso: true });
        // Emissão de teamUpdate
        const effectiveUserEmit = await getEffectiveUser(user);
        await emitTeamUpdateToEffective(effectiveUserEmit, DEFAULT_GAME);
    } catch (error) {
        console.error('[UNBAN-USER] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao desbanir usuário' });
    }
});
// Novo endpoint para desbanir como banned (desbanir o baneador) - BLOQUEADO: Apenas o baneador pode desbanir
app.post('/unban-as-banned', isAuthenticated, async (req, res) => {
    return res.status(403).json({ sucesso: false, erro: 'Não autorizado a desbanir. Contate o fundador do time.' });
});
// Endpoint para listar usuários aprovados (exceto self)
app.get('/usuarios-aprovados', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        const usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const aprovados = usuarios.filter(u => u.aprovado && u.email !== effectiveUser).map(u => u.email);
        res.json(aprovados);
    } catch (error) {
        console.error('[GET /usuarios-aprovados] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar usuários aprovados' });
    }
});
// Endpoint para listar usuários disponíveis para convite (não em nenhum time)
app.get('/usuarios-disponiveis', isAuthenticated, async (req, res) => {
    const userEmail = req.session.user;
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const pendenciasPath = path.join(DATA_DIR, 'usuarios-pendencias.json');
    try {
        const usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        const pendencias = await fs.readFile(pendenciasPath, 'utf8').then(JSON.parse).catch(() => []);
        const inTeam = new Set(associations.map(a => [a.primary, a.secondary]).flat());
        const disponiveisAll = usuarios.filter(u => u.aprovado && !inTeam.has(u.email) && u.email !== userEmail);
        const disponiveis = disponiveisAll.map(u => {
            const pendingSent = pendencias.some(p => p.from === userEmail && p.to === u.email);
            const pendingReceived = pendencias.some(p => p.to === userEmail && p.from === u.email);
            return { email: u.email, pendingSent, pendingReceived };
        });
        res.json(disponiveis);
    } catch (error) {
        console.error('[GET /usuarios-disponiveis] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar usuários disponíveis' });
    }
});
// Endpoint: Servir index.html (não protegido)
app.get('/', (req, res) => {
    console.log('[GET /] Servindo index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});
// Endpoint: Aprovação manual (não protegido, pois manual via Postman)
app.put('/usuarios', async (req, res) => {
    const { email, aprovadoParaAcesso } = req.body;
    try {
        let usuarios = await fs.readFile(path.join(DATA_DIR, 'usuarios.json'), 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === email);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        usuarios[index].aprovado = aprovadoParaAcesso;
        await saveUsuarios(usuarios);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[PUT /usuarios] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao aprovar' });
    }
});
// Endpoint: Troca de senha (protegido por headers)
app.put('/usuarios', async (req, res) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    const { email, novaSenha } = req.body; // Assumindo novaSenha; ajuste se necessário
    try {
        let usuarios = await fs.readFile(path.join(DATA_DIR, 'usuarios.json'), 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === email);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        const senhaHash = await bcrypt.hash(novaSenha, 10);
        usuarios[index].senhaHash = senhaHash;
        await saveUsuarios(usuarios);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[PUT /usuarios/troca-de-senha] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao trocar senha' });
    }
});
// Novo endpoint para mudar senha (autenticado)
app.post('/change-password', isAuthenticated, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ sucesso: false, erro: 'Senhas antiga e nova são obrigatórias' });
    }
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === req.session.user);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        if (!(await bcrypt.compare(oldPassword, usuarios[index].senhaHash))) {
            return res.status(401).json({ sucesso: false, erro: 'Senha atual incorreta' });
        }
        const newHash = await bcrypt.hash(newPassword, 10);
        usuarios[index].senhaHash = newHash;
        await saveUsuarios(usuarios);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /change-password] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao mudar senha' });
    }
});
// Endpoint para listar jogos
app.get('/games', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isFounderLocal = effectiveUser === sessionUser;
    let games = [];
    // Always list own games
    const safeOwn = sessionUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const ownDir = path.join(DATA_DIR, safeOwn);
    try {
        const ownFiles = await fs.readdir(ownDir, { withFileTypes: true });
        games.push(...ownFiles.filter(f => f.isDirectory()).map(f => f.name));
    } catch (error) {
        console.warn('[GET /games] No own dir:', error);
    }
    // If not founder, add shared from effectiveUser
    if (!isFounderLocal) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        try {
            const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
            games.push(...shared);
        } catch (error) {
            console.warn('[GET /games] No shared:', error);
        }
    }
    games = [...new Set(games)].sort();
    res.json(games);
});
// Endpoint para criar novo jogo (sempre no own dir)
app.post('/games', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const { name } = req.body;
    if (!name || !/^[a-zA-Z0-9 ]+$/.test(name)) {
        return res.status(400).json({ sucesso: false, erro: 'Nome do jogo inválido' });
    }
    const safeUser = sessionUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = name.replace(/[^a-zA-Z0-9 ]/g, '');
    const userDir = path.join(DATA_DIR, safeUser);
    const gameDir = path.join(userDir, safeGame);
    try {
        // Checar limite de jogos baseado no plano
        const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const user = usuarios.find(u => u.email === sessionUser);
        const plano = user.plano || 'basic';
        const gameLimits = { basic: 3, standard: 10, advanced: 20, fullpass: Infinity };
        const limit = gameLimits[plano];
        const currentGames = await fs.readdir(userDir, { withFileTypes: true }).then(files => files.filter(f => f.isDirectory()).length);
        if (currentGames >= limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de jogos atingido para o plano ${plano}` });
        }
        await fs.access(gameDir);
        return res.status(400).json({ sucesso: false, erro: 'Jogo já existe' });
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
        const files = ['receitas.json', 'componentes.json', 'estoque.json', 'arquivados.json', 'log.json', 'roadmap.json', 'categorias.json', 'atividadesGuilda.json'];
        for (const file of files) {
            await fs.writeFile(path.join(gameDir, file), JSON.stringify([]));
        }
        res.json({ sucesso: true });
    }
});
// Endpoint para deletar jogo (protegido por headers)
app.delete('/games/:game', async (req, res) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    const game = req.params.game;
    if (!game || game === 'usuarios.json') {
        return res.status(400).json({ sucesso: false, erro: 'Nome do jogo inválido' });
    }
    const sessionUser = req.session.user || 'arthurlopestorres@gmail.com';
    const effectiveUser = await getEffectiveUser(sessionUser);
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const userGameDir = path.join(DATA_DIR, safeUser, safeGame);
    try {
        await fs.rm(userGameDir, { recursive: true, force: true });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /games] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao deletar jogo' });
    }
});
// Novo: Endpoint para jogos compartilhados (somente founder)
app.get('/shared', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isFounder = effectiveUser === sessionUser;
    if (!isFounder) {
        return res.status(403).json({ sucesso: false, erro: 'Apenas founder pode acessar shared' });
    }
    const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
    try {
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        res.json(shared);
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler shared' });
    }
});
app.post('/shared', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isFounder = effectiveUser === sessionUser;
    if (!isFounder) {
        return res.status(403).json({ sucesso: false, erro: 'Apenas founder pode alterar shared' });
    }
    const { game, share } = req.body;
    if (!game || share === undefined) {
        return res.status(400).json({ sucesso: false, erro: 'Game e share são obrigatórios' });
    }
    const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
    let shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
    if (share) {
        if (!shared.includes(game)) shared.push(game);
    } else {
        shared = shared.filter(g => g !== game);
    }
    await fs.writeFile(sharedPath, JSON.stringify(shared, null, 2));
    res.json({ sucesso: true });
    // Emissão de teamUpdate
    await emitTeamUpdateToEffective(effectiveUser, game);
});
// Endpoints protegidos com suporte a user e game
app.get('/receitas', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'receitas.json');
    try {
        let data = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const { search, order, limit, favoritas } = req.query;
        if (favoritas === 'true') {
            data = data.filter(r => r.favorita === true);
        }
        if (search) {
            data = data.filter(r => r.nome.toLowerCase().includes(search.toLowerCase()));
        }
        if (order === 'az') {
            data.sort((a, b) => a.nome.localeCompare(b.nome));
        } else if (order === 'za') {
            data.sort((a, b) => b.nome.localeCompare(a.nome));
        }
        if (limit) {
            data = data.slice(0, parseInt(limit));
        }
        res.json(data);
    } catch (err) {
        console.error('[GET /receitas] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler receitas' });
    }
});
app.post('/receitas', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasCreatePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'criarReceitas');
    if (!hasCreatePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'receitas.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser); // Ajuste para função que busca usuário
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const novaReceita = req.body;
        if (Array.isArray(novaReceita)) {
            // Atualizar toda a lista de receitas (usado no arquivamento)
            await fs.writeFile(file, JSON.stringify(novaReceita, null, 2));
            console.log('[POST /receitas] Lista de receitas atualizada');
            io.to(game).emit('update', { type: 'receitas' });
            res.json({ sucesso: true });
            return;
        }
        if (!novaReceita.nome || !novaReceita.componentes) {
            console.log('[POST /receitas] Erro: Nome ou componentes ausentes');
            return res.status(400).json({ sucesso: false, erro: 'Nome e componentes são obrigatórios' });
        }
        let receitas = [];
        try {
            receitas = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        receitas.push({ ...novaReceita, favorita: false });
        await fs.writeFile(file, JSON.stringify(receitas, null, 2));
        console.log('[POST /receitas] Receita adicionada:', novaReceita.nome);
        io.to(game).emit('update', { type: 'receitas' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar receita' });
    }
});
app.post('/receitas/editar', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasEditPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'editarReceitas');
    if (!hasEditPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'receitas.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { nomeOriginal, nome, componentes } = req.body;
        if (!nomeOriginal || !nome || !componentes) {
            console.log('[POST /receitas/editar] Erro: Nome original, nome ou componentes ausentes');
            return res.status(400).json({ sucesso: false, erro: 'Nome original, nome e componentes são obrigatórios' });
        }
        let receitas = [];
        try {
            receitas = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const index = receitas.findIndex(r => r.nome === nomeOriginal);
        if (index === -1) {
            console.log('[POST /receitas/editar] Erro: Receita original não encontrada:', nomeOriginal);
            return res.status(404).json({ sucesso: false, erro: 'Receita original não encontrada' });
        }
        if (nome !== nomeOriginal && receitas.some(r => r.nome === nome)) {
            console.log('[POST /receitas/editar] Erro: Novo nome já existe:', nome);
            return res.status(400).json({ sucesso: false, erro: 'Novo nome de receita já existe' });
        }
        receitas[index] = { ...receitas[index], nome, componentes };
        await fs.writeFile(file, JSON.stringify(receitas, null, 2));
        console.log('[POST /receitas/editar] Receita editada:', nomeOriginal, '->', nome);
        io.to(game).emit('update', { type: 'receitas' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas/editar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar receita' });
    }
});
app.post('/receitas/favoritar', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasFavoritarPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'favoritarReceitas');
    if (!hasFavoritarPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'receitas.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { nome, favorita } = req.body;
        if (!nome || favorita === undefined) {
            console.log('[POST /receitas/favoritar] Erro: Nome ou favorita ausentes');
            return res.status(400).json({ sucesso: false, erro: 'Nome e favorita são obrigatórios' });
        }
        let receitas = [];
        try {
            receitas = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const index = receitas.findIndex(r => r.nome === nome);
        if (index === -1) {
            console.log('[POST /receitas/favoritar] Erro: Receita não encontrada:', nome);
            return res.status(404).json({ sucesso: false, erro: 'Receita não encontrada' });
        }
        receitas[index].favorita = favorita;
        await fs.writeFile(file, JSON.stringify(receitas, null, 2));
        console.log('[POST /receitas/favoritar] Favorita atualizada para receita:', nome, '->', favorita);
        io.to(game).emit('update', { type: 'receitas' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas/favoritar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar favorita' });
    }
});
app.get('/categorias', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'categorias.json');
    try {
        let data = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        res.json(data);
    } catch (err) {
        console.error('[GET /categorias] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler categorias' });
    }
});
app.post('/categorias', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasCreatePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'criarCategorias');
    if (!hasCreatePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'categorias.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { nome } = req.body;
        if (!nome) {
            console.log('[POST /categorias] Erro: Nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome é obrigatório' });
        }
        let categorias = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        if (categorias.includes(nome)) {
            console.log('[POST /categorias] Erro: Categoria já existe:', nome);
            return res.status(400).json({ sucesso: false, erro: 'Categoria já existe' });
        }
        categorias.push(nome);
        categorias.sort();
        await fs.writeFile(file, JSON.stringify(categorias, null, 2));
        console.log('[POST /categorias] Categoria adicionada:', nome);
        io.to(game).emit('update', { type: 'categorias' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /categorias] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar categoria' });
    }
});
app.post('/categorias/excluir', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasDeletePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'excluirCategorias');
    if (!hasDeletePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const catFile = getFilePath(gameDir, 'categorias.json');
    const compFile = getFilePath(gameDir, 'componentes.json');
    try {
        const { nome } = req.body;
        if (!nome) {
            console.log('[POST /categorias/excluir] Erro: Nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome é obrigatório' });
        }
        let comps = await fs.readFile(compFile, 'utf8').then(JSON.parse).catch(() => []);
        if (comps.some(c => c.categoria === nome)) {
            console.log('[POST /categorias/excluir] Erro: Categoria em uso:', nome);
            return res.status(400).json({ sucesso: false, erro: 'Categoria em uso' });
        }
        let categorias = await fs.readFile(catFile, 'utf8').then(JSON.parse).catch(() => []);
        categorias = categorias.filter(c => c !== nome);
        // Novo: Checar limite de armazenamento antes de salvar (embora exclusão reduza tamanho, checar por consistência)
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(categorias, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        await fs.writeFile(catFile, JSON.stringify(categorias, null, 2));
        console.log('[POST /categorias/excluir] Categoria excluída:', nome);
        io.to(game).emit('update', { type: 'categorias' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /categorias/excluir] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir categoria' });
    }
});
app.get('/componentes', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'componentes.json');
    try {
        let data = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const { search, order, limit } = req.query;
        if (search) {
            data = data.filter(c => c.nome.toLowerCase().includes(search.toLowerCase()));
        }
        if (order === 'az') {
            data.sort((a, b) => a.nome.localeCompare(b.nome));
        } else if (order === 'za') {
            data.sort((a, b) => b.nome.localeCompare(a.nome));
        }
        if (limit) {
            data = data.slice(0, parseInt(limit));
        }
        res.json(data);
    } catch (err) {
        console.error('[GET /componentes] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler componentes' });
    }
});
app.post('/componentes', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasCreatePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'criarComponente');
    if (!hasCreatePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'componentes.json');
    const estoqueFileGame = getFilePath(gameDir, 'estoque.json');
    const catFile = getFilePath(gameDir, 'categorias.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const novoComponente = req.body;
        if (!novoComponente.nome) {
            console.log('[POST /componentes] Erro: Nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome é obrigatório' });
        }
        let componentes = [];
        try {
            componentes = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        if (componentes.some(c => c.nome === novoComponente.nome)) {
            console.log('[POST /componentes] Erro: Componente já existe:', novoComponente.nome);
            return res.status(400).json({ sucesso: false, erro: 'Componente já existe' });
        }
        componentes.push(novoComponente);
        await fs.writeFile(file, JSON.stringify(componentes, null, 2));
        console.log('[POST /componentes] Componente adicionado:', novoComponente.nome);
        // Adicionar categoria se nova
        const categoria = novoComponente.categoria;
        let cats = await fs.readFile(catFile, 'utf8').then(JSON.parse).catch(() => []);
        if (categoria && !cats.includes(categoria)) {
            cats.push(categoria);
            cats.sort();
            await fs.writeFile(catFile, JSON.stringify(cats, null, 2));
            console.log('[POST /componentes] Categoria adicionada:', categoria);
        }
        // Adicionar automaticamente ao estoque com quantidade 0 se não existir
        let estoque = [];
        try {
            estoque = JSON.parse(await fs.readFile(estoqueFileGame, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const index = estoque.findIndex(e => e.componente === novoComponente.nome);
        if (index === -1) {
            estoque.push({ componente: novoComponente.nome, quantidade: 0 });
            await fs.writeFile(estoqueFileGame, JSON.stringify(estoque, null, 2));
            console.log('[POST /componentes] Componente adicionado ao estoque com quantidade 0:', novoComponente.nome);
        }
        io.to(game).emit('update', { type: 'componentes' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar componente' });
    }
});
app.post('/componentes/editar', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasEditPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'editarComponente');
    if (!hasEditPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'componentes.json');
    const estoqueFileGame = getFilePath(gameDir, 'estoque.json');
    const receitasFileGame = getFilePath(gameDir, 'receitas.json');
    const catFile = getFilePath(gameDir, 'categorias.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { nomeOriginal, nome, categoria, associados, quantidadeProduzida } = req.body;
        if (!nomeOriginal || !nome) {
            console.log('[POST /componentes/editar] Erro: Nome original ou nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome original e nome são obrigatórios' });
        }
        let componentes = [];
        try {
            componentes = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const index = componentes.findIndex(c => c.nome === nomeOriginal);
        if (index === -1) {
            console.log('[POST /componentes/editar] Erro: Componente original não encontrado:', nomeOriginal);
            return res.status(404).json({ sucesso: false, erro: 'Componente original não encontrado' });
        }
        if (nome !== nomeOriginal && componentes.some(c => c.nome === nome)) {
            console.log('[POST /componentes/editar] Erro: Novo nome já existe:', nome);
            return res.status(400).json({ sucesso: false, erro: 'Novo nome de componente já existe' });
        }
        componentes[index] = { nome, categoria, associados, quantidadeProduzida };
        await fs.writeFile(file, JSON.stringify(componentes, null, 2));
        console.log('[POST /componentes/editar] Componente editado:', nomeOriginal, '->', nome);
        // Adicionar categoria se nova
        let cats = await fs.readFile(catFile, 'utf8').then(JSON.parse).catch(() => []);
        if (categoria && !cats.includes(categoria)) {
            cats.push(categoria);
            cats.sort();
            await fs.writeFile(catFile, JSON.stringify(cats, null, 2));
            console.log('[POST /componentes/editar] Categoria adicionada:', categoria);
        }
        // Se o nome mudou, propagar a mudança para estoque, receitas e outros componentes
        if (nome !== nomeOriginal) {
            // Atualizar estoque
            let estoque = [];
            try {
                estoque = JSON.parse(await fs.readFile(estoqueFileGame, 'utf8'));
            } catch (err) {
                if (err.code !== 'ENOENT') throw err;
            }
            const estoqueIndex = estoque.findIndex(e => e.componente === nomeOriginal);
            if (estoqueIndex !== -1) {
                estoque[estoqueIndex].componente = nome;
                await fs.writeFile(estoqueFileGame, JSON.stringify(estoque, null, 2));
                console.log('[POST /componentes/editar] Nome atualizado no estoque:', nomeOriginal, '->', nome);
            }
            // Atualizar receitas
            let receitas = [];
            try {
                receitas = JSON.parse(await fs.readFile(receitasFileGame, 'utf8'));
            } catch (err) {
                if (err.code !== 'ENOENT') throw err;
            }
            let receitasAtualizadas = false;
            receitas.forEach(receita => {
                if (receita.componentes) {
                    receita.componentes.forEach(comp => {
                        if (comp.nome === nomeOriginal) {
                            comp.nome = nome;
                            receitasAtualizadas = true;
                        }
                    });
                }
            });
            if (receitasAtualizadas) {
                await fs.writeFile(receitasFileGame, JSON.stringify(receitas, null, 2));
                console.log('[POST /componentes/editar] Nome atualizado nas receitas:', nomeOriginal, '->', nome);
            }
            // Atualizar associados em outros componentes
            let componentesAtualizados = false;
            componentes.forEach(comp => {
                if (comp.associados) {
                    comp.associados.forEach(assoc => {
                        if (assoc.nome === nomeOriginal) {
                            assoc.nome = nome;
                            componentesAtualizados = true;
                        }
                    });
                }
            });
            if (componentesAtualizados) {
                await fs.writeFile(file, JSON.stringify(componentes, null, 2));
                console.log('[POST /componentes/editar] Nome atualizado nos associados de outros componentes:', nomeOriginal, '->', nome);
            }
        }
        io.to(game).emit('update', { type: 'componentes' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes/editar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar componente' });
    }
});
app.post('/componentes/excluir', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasDeletePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'excluirComponente');
    if (!hasDeletePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'componentes.json');
    const receitasFileGame = getFilePath(gameDir, 'receitas.json');
    const arquivadosFileGame = getFilePath(gameDir, 'arquivados.json');
    const estoqueFileGame = getFilePath(gameDir, 'estoque.json');
    try {
        const { nome } = req.body;
        if (!nome) {
            console.log('[POST /componentes/excluir] Erro: Nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome é obrigatório' });
        }
        let componentes = [];
        try {
            componentes = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const index = componentes.findIndex(c => c.nome === nome);
        if (index === -1) {
            console.log('[POST /componentes/excluir] Erro: Componente não encontrado:', nome);
            return res.status(404).json({ sucesso: false, erro: 'Componente não encontrado' });
        }
        // Remover referências em receitas
        let receitas = [];
        try {
            receitas = JSON.parse(await fs.readFile(receitasFileGame, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        let receitasAtualizadas = false;
        receitas.forEach(receita => {
            if (receita.componentes) {
                const originalLength = receita.componentes.length;
                receita.componentes = receita.componentes.filter(comp => comp.nome !== nome);
                if (receita.componentes.length !== originalLength) {
                    receitasAtualizadas = true;
                }
            }
        });
        if (receitasAtualizadas) {
            await fs.writeFile(receitasFileGame, JSON.stringify(receitas, null, 2));
            console.log('[POST /componentes/excluir] Referências removidas nas receitas para:', nome);
        }
        // Remover referências em arquivados
        let arquivados = [];
        try {
            arquivados = JSON.parse(await fs.readFile(arquivadosFileGame, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        let arquivadosAtualizados = false;
        arquivados.forEach(arquivado => {
            if (arquivado.componentes) {
                const originalLength = arquivado.componentes.length;
                arquivado.componentes = arquivado.componentes.filter(comp => comp.nome !== nome);
                if (arquivado.componentes.length !== originalLength) {
                    arquivadosAtualizados = true;
                }
            }
        });
        if (arquivadosAtualizados) {
            await fs.writeFile(arquivadosFileGame, JSON.stringify(arquivados, null, 2));
            console.log('[POST /componentes/excluir] Referências removidas nos arquivados para:', nome);
        }
        // Remover referências em associados de outros componentes
        let componentesAtualizados = false;
        componentes.forEach(comp => {
            if (comp.associados) {
                const originalLength = comp.associados.length;
                comp.associados = comp.associados.filter(assoc => assoc.nome !== nome);
                if (comp.associados.length !== originalLength) {
                    componentesAtualizados = true;
                }
            }
        });
        if (componentesAtualizados) {
            await fs.writeFile(file, JSON.stringify(componentes, null, 2));
            console.log('[POST /componentes/excluir] Referências removidas nos associados de outros componentes para:', nome);
        }
        // Remover o componente
        componentes.splice(index, 1);
        // Novo: Checar limite de armazenamento antes de salvar (embora exclusão reduza, por consistência)
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(componentes, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        await fs.writeFile(file, JSON.stringify(componentes, null, 2));
        console.log('[POST /componentes/excluir] Componente excluído:', nome);
        // Removendo do estoque
        let estoque = [];
        try {
            estoque = JSON.parse(await fs.readFile(estoqueFileGame, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const estoqueIndex = estoque.findIndex(e => e.componente === nome);
        if (estoqueIndex !== -1) {
            estoque.splice(estoqueIndex, 1);
            await fs.writeFile(estoqueFileGame, JSON.stringify(estoque, null, 2));
            console.log('[POST /componentes/excluir] Componente removido do estoque:', nome);
        }
        io.to(game).emit('update', { type: 'componentes' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes/excluir] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir componente' });
    }
});
app.get('/estoque', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'estoque.json');
    try {
        let data = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const { search, order, limit } = req.query;
        if (search) {
            data = data.filter(e => e.componente.toLowerCase().includes(search.toLowerCase()));
        }
        if (order === 'az') {
            data.sort((a, b) => a.componente.localeCompare(b.componente));
        } else if (order === 'za') {
            data.sort((a, b) => b.componente.localeCompare(a.componente));
        }
        if (limit) {
            data = data.slice(0, parseInt(limit));
        }
        res.json(data);
    } catch (err) {
        console.error('[GET /estoque] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler estoque' });
    }
});
// Novo: Endpoint para importação em massa de estoque
app.post('/estoque/import', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasImportPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'importarEstoque');
    if (!hasImportPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const estoqueFile = getFilePath(gameDir, 'estoque.json');
    const logFile = getFilePath(gameDir, 'log.json');
    const componentesFile = getFilePath(gameDir, 'componentes.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        let estoque = await fs.readFile(estoqueFile, 'utf8').then(JSON.parse).catch(() => []);
        const estoqueMap = {};
        estoque.forEach(e => { estoqueMap[e.componente] = e.quantidade || 0; });
        const updates = req.body; // Array de {componente, novaQuantidade}
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ sucesso: false, erro: 'Dados inválidos para importação' });
        }
        // Novo: Verificar se todos os componentes existem em componentes.json
        let componentes = await fs.readFile(componentesFile, 'utf8').then(JSON.parse).catch(() => []);
        const compSet = new Set(componentes.map(c => c.nome));
        let missing = [];
        updates.forEach((update, i) => {
            if (!compSet.has(update.componente)) {
                missing.push(`Linha ${i + 2}: ${update.componente}`); // Assumindo linha 1 como header
            }
        });
        if (missing.length > 0) {
            return res.status(400).json({ sucesso: false, erro: `Componentes não encontrados: ${missing.join(', ')}` });
        }
        // Verificar se há débitos para membros
        const hasDebit = updates.some(update => {
            if (!update.componente || typeof update.novaQuantidade !== 'number' || update.novaQuantidade < 0) return false;
            const atual = estoqueMap[update.componente] || 0;
            return update.novaQuantidade < atual;
        });
        if (hasDebit && !isOwn && !isAdminUser) {
            return res.status(403).json({ sucesso: false, erro: 'Não autorizado a debitar itens via importação' });
        }
        let updatedCount = 0;
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = req.session.user;
        let newLogs = [];
        for (const update of updates) {
            const { componente, novaQuantidade } = update;
            if (!componente || isNaN(novaQuantidade) || novaQuantidade < 0) continue;
            const atual = estoqueMap[componente] || 0;
            const diff = novaQuantidade - atual;
            if (diff === 0) continue;
            const operacao = diff > 0 ? "adicionar" : "debitar";
            const qtd = Math.abs(diff);
            // Atualizar estoque
            let index = estoque.findIndex(e => e.componente === componente);
            if (index === -1) {
                estoque.push({ componente, quantidade: novaQuantidade });
                estoqueMap[componente] = novaQuantidade;
            } else {
                estoque[index].quantidade = novaQuantidade;
                estoqueMap[componente] = novaQuantidade;
            }
            // Log
            newLogs.push({
                dataHora,
                componente,
                quantidade: qtd,
                operacao,
                origem: "Importação de estoque",
                user: userEmail
            });
            updatedCount++;
        }
        await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));
        if (newLogs.length > 0) {
            let logs = await fs.readFile(logFile, 'utf8').then(JSON.parse).catch(() => []);
            logs.push(...newLogs);
            await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
        }
        console.log(`[POST /estoque/import] Importado: ${updatedCount} itens atualizados`);
        io.to(game).emit('update', { type: 'estoque' });
        res.json({ sucesso: true, updated: updatedCount });
    } catch (error) {
        console.error('[POST /estoque/import] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao importar estoque' });
    }
});
app.post('/estoque', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'estoque.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { componente, quantidade, operacao } = req.body;
        if (!componente || !quantidade || !operacao) {
            console.log('[POST /estoque] Erro: Componente, quantidade ou operação ausentes');
            return res.status(400).json({ sucesso: false, erro: 'Componente, quantidade e operação são obrigatórios' });
        }
        // Correção: Permitir debitar em jogos próprios (isOwn), mesmo para não-admins; em compartilhados, só admins ou com permissão
        const hasDebitPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'debitarEstoque'); // Assumindo 'debitarEstoque' como chave, ajuste se necessário
        if (operacao === 'debitar' && !hasDebitPermission) {
            return res.status(403).json({ sucesso: false, erro: 'Não autorizado a debitar estoque' });
        }
        let estoque = [];
        try {
            estoque = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const index = estoque.findIndex(e => e.componente === componente);
        if (operacao === 'adicionar') {
            if (index === -1) {
                estoque.push({ componente, quantidade });
            } else {
                estoque[index].quantidade += quantidade;
            }
        } else if (operacao === 'debitar') {
            if (index === -1 || estoque[index].quantidade < quantidade) {
                console.log('[POST /estoque] Erro: Estoque insuficiente para', componente);
                return res.status(400).json({ sucesso: false, erro: 'Estoque insuficiente' });
            }
            estoque[index].quantidade -= quantidade;
            // Removida a exclusão do item quando quantidade chega a 0
        } else {
            console.log('[POST /estoque] Erro: Operação inválida:', operacao);
            return res.status(400).json({ sucesso: false, erro: 'Operação inválida' });
        }
        await fs.writeFile(file, JSON.stringify(estoque, null, 2));
        console.log('[POST /estoque] Estoque atualizado:', componente, operacao, quantidade);
        io.to(game).emit('update', { type: 'estoque' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /estoque] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar estoque' });
    }
});
app.post('/estoque/zerar', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasZerarPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'excluirComponente'); // Usando excluirComponente como proxy
    if (!hasZerarPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'estoque.json');
    const logFile = getFilePath(gameDir, 'log.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar (embora zerar reduza, por consistência)
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = [];
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        let estoque = [];
        try {
            estoque = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        // Zerar todas as quantidades
        const originalQuantities = estoque.map(e => ({ componente: e.componente, quantidade: e.quantidade || 0 }));
        estoque.forEach(e => {
            e.quantidade = 0;
        });
        await fs.writeFile(file, JSON.stringify(estoque, null, 2));
        // Registrar no log como uma única entrada
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = req.session.user;
        const logEntry = {
            dataHora,
            componente: "TODOS",
            quantidade: 0,
            operacao: "zerar",
            origem: "Zerar todo o estoque",
            user: userEmail
        };
        let logs = await fs.readFile(logFile, 'utf8').then(JSON.parse).catch(() => []);
        logs.push(logEntry);
        await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
        console.log('[POST /estoque/zerar] Estoque zerado');
        io.to(game).emit('update', { type: 'estoque' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /estoque/zerar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao zerar estoque' });
    }
});
app.delete('/data', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasDeletePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'excluirComponente');
    if (!hasDeletePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'estoque.json');
    try {
        const { componente } = req.body;
        if (!componente) {
            console.log('[DELETE /data] Erro: Nome do componente ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome do componente é obrigatório' });
        }
        let estoque = [];
        try {
            estoque = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        const index = estoque.findIndex(e => e.componente === componente);
        if (index === -1) {
            console.log('[DELETE /data] Erro: Componente não encontrado no estoque:', componente);
            return res.status(404).json({ sucesso: false, erro: 'Componente não encontrado no estoque' });
        }
        estoque.splice(index, 1);
        // Novo: Checar limite de armazenamento antes de salvar (embora exclusão reduza, por consistência)
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(estoque, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        await fs.writeFile(file, JSON.stringify(estoque, null, 2));
        console.log('[DELETE /data] Componente excluído do estoque:', componente);
        io.to(game).emit('update', { type: 'estoque' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /data] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir componente do estoque' });
    }
});
app.get('/arquivados', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'arquivados.json');
    try {
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /arquivados] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler arquivados' });
    }
});
app.post('/arquivados', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasConcluirPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'concluirReceitas');
    if (!hasConcluirPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'arquivados.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const arquivados = req.body;
        await fs.writeFile(file, JSON.stringify(arquivados, null, 2));
        console.log('[POST /arquivados] Arquivados atualizados');
        io.to(game).emit('update', { type: 'arquivados' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /arquivados] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar arquivados' });
    }
});
app.get('/log', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'log.json');
    try {
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /log] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler log' });
    }
});
app.post('/log', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'log.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        let novosLogs = Array.isArray(req.body) ? req.body : [req.body];
        // Novo: Adicionar user a cada entry se não existir
        const userEmail = req.session.user;
        novosLogs = novosLogs.map(entry => ({
            ...entry,
            user: entry.user || userEmail // Adicionar user se ausente
        }));
        let logs = [];
        try {
            logs = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        logs.push(...novosLogs);
        await fs.writeFile(file, JSON.stringify(logs, null, 2));
        console.log('[POST /log] Log atualizado com', novosLogs.length, 'entradas');
        io.to(game).emit('update', { type: 'log' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /log] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar log' });
    }
});
app.post('/fabricar', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasFabricarPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'fabricarComponentes');
    if (!hasFabricarPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const componentesFile = getFilePath(gameDir, 'componentes.json');
    const estoqueFile = getFilePath(gameDir, 'estoque.json');
    const logFile = getFilePath(gameDir, 'log.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { componente, numCrafts = 1 } = req.body;
        if (!componente) {
            console.log('[POST /fabricar] Erro: Componente ausente');
            return res.status(400).json({ sucesso: false, erro: 'Componente é obrigatório' });
        }
        let componentes = await fs.readFile(componentesFile, 'utf8').then(JSON.parse).catch(() => []);
        const comp = componentes.find(c => c.nome === componente);
        if (!comp || !comp.associados || comp.associados.length === 0) {
            console.log('[POST /fabricar] Erro: Componente sem associados');
            return res.status(400).json({ sucesso: false, erro: 'Componente sem associados' });
        }
        let estoque = await fs.readFile(estoqueFile, 'utf8').then(JSON.parse).catch(() => []);
        // Verificar estoque dos subcomponentes diretos
        for (const assoc of comp.associados) {
            const eIndex = estoque.findIndex(e => e.componente === assoc.nome);
            if (eIndex === -1 || estoque[eIndex].quantidade < assoc.quantidade * numCrafts) {
                console.log('[POST /fabricar] Erro: Estoque insuficiente para', assoc.nome);
                return res.status(400).json({ sucesso: false, erro: `Estoque insuficiente para ${assoc.nome}` });
            }
        }
        // Debitar subcomponentes
        const dataHora = new Date().toLocaleString("pt-BR", { timeZone: 'America/Sao_Paulo' });
        const userEmail = req.session.user;
        let newLogs = [];
        for (const assoc of comp.associados) {
            const eIndex = estoque.findIndex(e => e.componente === assoc.nome);
            estoque[eIndex].quantidade -= assoc.quantidade * numCrafts;
            newLogs.push({
                dataHora,
                componente: assoc.nome,
                quantidade: assoc.quantidade * numCrafts,
                operacao: "debitar",
                origem: `Fabricação de ${componente}`,
                user: userEmail // Novo: Adicionar usuário
            });
        }
        // Adicionar o componente
        const qtdProd = comp.quantidadeProduzida || 1;
        const cIndex = estoque.findIndex(e => e.componente === componente);
        if (cIndex === -1) {
            estoque.push({ componente, quantidade: qtdProd * numCrafts });
        } else {
            estoque[cIndex].quantidade += qtdProd * numCrafts;
        }
        newLogs.push({
            dataHora,
            componente,
            quantidade: qtdProd * numCrafts,
            operacao: "adicionar",
            origem: `Fabricação de ${componente}`,
            user: userEmail // Novo: Adicionar usuário
        });
        await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));
        // Registrar no log
        let logs = await fs.readFile(logFile, 'utf8').then(JSON.parse).catch(() => []);
        logs.push(...newLogs);
        await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
        console.log('[POST /fabricar] Componente fabricado:', componente);
        io.to(game).emit('update', { type: 'estoque' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /fabricar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao fabricar componente' });
    }
});
// Endpoint para roadmap
app.get('/roadmap', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'roadmap.json');
    try {
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler roadmap' });
    }
});
app.post('/roadmap', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasCreatePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'criarRoadmap');
    if (!hasCreatePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'roadmap.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const roadmap = req.body;
        await fs.writeFile(file, JSON.stringify(roadmap, null, 2));
        io.to(game).emit('update', { type: 'roadmap' });
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar roadmap' });
    }
});
// Novo: Endpoint admin para listar usuários e associações (protegido por headers)
app.get('/admin/users', async (req, res) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        // Para cada usuário, encontrar associações
        const usersWithAssocs = usuarios.map(u => {
            const { senhaHash, ...safeU } = u;
            const primaries = associations.filter(a => a.primary === u.email).map(a => ({ secondary: a.secondary, role: a.role || 'member', permissao: a.permissao || {} })); // Incluir permissões
            const secondaries = associations.filter(a => a.secondary === u.email).map(a => ({ primary: a.primary, role: a.role || 'member', permissao: a.permissao || {} })); // Incluir permissões
            return { ...safeU, associations: { primaries, secondaries } };
        });
        res.json(usersWithAssocs);
    } catch (error) {
        console.error('[GET /admin/users] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar usuários' });
    }
});
// Novo: Endpoint admin para adicionar usuário (protegido por headers)
app.post('/admin/users', async (req, res) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    const { nome, email, senha, aprovado = false } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ sucesso: false, erro: 'Nome, email e senha são obrigatórios' });
    }
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        if (usuarios.some(u => u.email === email)) {
            return res.status(400).json({ sucesso: false, erro: 'Email já cadastrado' });
        }
        const senhaHash = await bcrypt.hash(senha, 10);
        const id = await generateUniqueId();
        const newUser = { nome, email, senhaHash, id, aprovado, doisFatores: true, plano: "basic" }; // Novo: doisFatores true por padrão e plano "basic"
        usuarios.push(newUser);
        await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));
        res.json({ sucesso: true, user: { ...newUser, senhaHash: undefined } });
    } catch (error) {
        console.error('[POST /admin/users] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao adicionar usuário' });
    }
});
// Novo: Endpoint admin para excluir usuário e dados (protegido por headers)
app.delete('/admin/users/:email', async (req, res) => {
    const key = req.headers['atboficial-mmo-crafter'];
    const token = req.headers['aisdbfaidfbhyadhiyadhadhiyfad'];
    if (key !== 'atboficial-mmo-crafter' || token !== 'aisdbfaidfbhyadhiyadhadhiyfad') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado' });
    }
    const { email } = req.params;
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    const associationsPath = path.join(DATA_DIR, 'usuarios-associacoes.json');
    const pendenciasPath = path.join(DATA_DIR, 'usuarios-pendencias.json');
    const banidosPath = path.join(DATA_DIR, 'usuarios-banidos.json');
    try {
        // Remover de usuarios
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const userIndex = usuarios.findIndex(u => u.email === email);
        if (userIndex === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        usuarios.splice(userIndex, 1);
        await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));
        // Remover associações onde primary ou secondary é email
        let associations = await fs.readFile(associationsPath, 'utf8').then(JSON.parse).catch(() => []);
        associations = associations.filter(a => a.primary !== email && a.secondary !== email);
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));
        // Remover pendências envolvendo email
        let pendencias = await fs.readFile(pendenciasPath, 'utf8').then(JSON.parse).catch(() => []);
        pendencias = pendencias.filter(p => p.from !== email && p.to !== email);
        await fs.writeFile(pendenciasPath, JSON.stringify(pendencias, null, 2));
        // Remover banidos envolvendo email
        let banidos = await fs.readFile(banidosPath, 'utf8').then(JSON.parse).catch(() => []);
        banidos = banidos.filter(b => b.primary !== email && b.banned !== email);
        await fs.writeFile(banidosPath, JSON.stringify(banidos, null, 2));
        // Deletar diretório do usuário
        const safeUser = email.replace(/[^a-zA-Z0-9@._-]/g, '');
        const userDir = path.join(DATA_DIR, safeUser);
        try {
            await fs.rm(userDir, { recursive: true, force: true });
            console.log(`[DELETE /admin/users] Diretório removido: ${userDir}`);
        } catch (dirErr) {
            console.warn(`[DELETE /admin/users] Aviso: Não foi possível remover diretório ${userDir}:`, dirErr);
        }
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /admin/users] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir usuário' });
    }
});
// Nova rota 1: Obter todos os jogos do diretório de um usuário (admin)
app.get('/admin/user-games', isAdmin, async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ sucesso: false, erro: 'Email é obrigatório' });
    }
    try {
        const safeUser = email.replace(/[^a-zA-Z0-9@._-]/g, '');
        const userDir = path.join(DATA_DIR, safeUser);
        await fs.mkdir(userDir, { recursive: true });
        const files = await fs.readdir(userDir, { withFileTypes: true });
        const games = files.filter(f => f.isDirectory()).map(f => f.name).sort();
        res.json(games);
    } catch (error) {
        console.error('[GET /admin/user-games] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar jogos do usuário' });
    }
});
// Nova rota 2: Criar jogo novo no diretório do usuário (admin)
app.post('/admin/user-games', isAdmin, async (req, res) => {
    const { email, name } = req.body;
    if (!email || !name || !/^[a-zA-Z0-9 ]+$/.test(name)) {
        return res.status(400).json({ sucesso: false, erro: 'Email e nome do jogo são obrigatórios e válidos' });
    }
    const safeUser = email.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = name.replace(/[^a-zA-Z0-9 ]/g, '');
    const userDir = path.join(DATA_DIR, safeUser);
    const gameDir = path.join(userDir, safeGame);
    try {
        await fs.access(gameDir);
        return res.status(400).json({ sucesso: false, erro: 'Jogo já existe' });
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
        const files = ['receitas.json', 'componentes.json', 'estoque.json', 'arquivados.json', 'log.json', 'roadmap.json', 'categorias.json', 'atividadesGuilda.json'];
        for (const file of files) {
            await fs.writeFile(path.join(gameDir, file), JSON.stringify([]));
        }
        console.log(`[POST /admin/user-games] Jogo criado: ${name} para ${email}`);
        res.json({ sucesso: true });
    }
});
// Nova rota 3: Deletar jogo do diretório do usuário (admin)
app.delete('/admin/user-games', isAdmin, async (req, res) => {
    const { email, game } = req.body;
    if (!email || !game) {
        return res.status(400).json({ sucesso: false, erro: 'Email e nome do jogo são obrigatórios' });
    }
    const safeUser = email.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const userGameDir = path.join(DATA_DIR, safeUser, safeGame);
    try {
        await fs.rm(userGameDir, { recursive: true, force: true });
        console.log(`[DELETE /admin/user-games] Jogo deletado: ${game} para ${email}`);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /admin/user-games] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao deletar jogo' });
    }
});
// Nova rota 4: Obter arquivos json de um jogo do usuário (admin)
app.get('/admin/game-files', isAdmin, async (req, res) => {
    const { email, game } = req.query;
    if (!email || !game) {
        return res.status(400).json({ sucesso: false, erro: 'Email e nome do jogo são obrigatórios' });
    }
    const safeUser = email.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    try {
        await fs.access(gameDir);
        const files = await fs.readdir(gameDir);
        const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
        res.json(jsonFiles);
    } catch {
        res.json([]);
    }
});
// Nova rota 5: Obter dados do arquivo json de um jogo do usuário (admin)
app.get('/admin/game-file', isAdmin, async (req, res) => {
    const { email, game, file } = req.query;
    if (!email || !game || !file) {
        return res.status(400).json({ sucesso: false, erro: 'Email, nome do jogo e nome do arquivo são obrigatórios' });
    }
    const safeUser = email.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const filePath = path.join(DATA_DIR, safeUser, safeGame, file);
    try {
        const data = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('[GET /admin/game-file] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler arquivo' });
    }
});
// Nova rota 6: Editar arquivo json de um jogo do usuário (admin)
app.put('/admin/game-file', isAdmin, async (req, res) => {
    const { email, game, file, content } = req.body;
    if (!email || !game || !file || content === undefined) {
        return res.status(400).json({ sucesso: false, erro: 'Email, nome do jogo, nome do arquivo e content são obrigatórios' });
    }
    const safeUser = email.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const filePath = path.join(DATA_DIR, safeUser, safeGame, file);
    try {
        await fs.writeFile(filePath, JSON.stringify(content, null, 2));
        console.log(`[PUT /admin/game-file] Arquivo atualizado: ${file} para ${game} de ${email}`);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[PUT /admin/game-file] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar arquivo' });
    }
});
// Endpoint para verificar status do servidor (não protegido)
app.get('/health', (req, res) => {
    console.log('[GET /health] Verificação de status do servidor');
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
// Função para emitir teamUpdate para effectiveUser
async function emitTeamUpdateToEffective(effectiveUser, game = DEFAULT_GAME) {
    io.to(effectiveUser).emit('teamUpdate', { game });
}
// Iniciar o servidor
const server = app.listen(PORT, () => {
    console.log(`[SERVER] Servidor rodando em http://localhost:${PORT}`);
    sincronizarEstoque();
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[SERVER] Erro: Porta ${PORT} já está em uso. Tente outra porta.`);
    } else {
        console.error('[SERVER] Erro ao iniciar servidor:', err);
    }
});
// Novo: Integração Socket.IO
const io = require('socket.io')(server, {
    cors: {
        origin: '*', // Ajuste para produção
        methods: ['GET', 'POST']
    }
});
// Novo: Map para armazenar effectiveUser por socket
const socketToUser = new Map(); // socket.id → { email, effectiveUser, game }
io.on('connection', (socket) => {
    console.log('[SOCKET.IO] Cliente conectado:', socket.id);
    socket.on('joinGame', (game) => {
        socket.leaveAll();
        socket.join(game);
        console.log(`[SOCKET.IO] Cliente ${socket.id} entrou na room: ${game}`);
    });
    // Novo: Registrar usuário efetivo ao conectar
    socket.on('registerUser', async ({ email, game }) => {
        const effectiveUser = await getEffectiveUser(email);
        socketToUser.set(socket.id, { email, effectiveUser, game });
        socket.join(effectiveUser); // Entrar na sala do effectiveUser
        console.log(`[SOCKET.IO] Usuário ${email} (effective: ${effectiveUser}) registrado no socket ${socket.id}`);
    });
    socket.on('disconnect', () => {
        socketToUser.delete(socket.id);
        console.log('[SOCKET.IO] Cliente desconectado:', socket.id);
    });
});
// Nova rota para atividadesGuilda: Listar eventos
app.get('/atividadesGuilda', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        res.json([]);
        return;
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        let data = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const hasAssocPerm = await hasPermission(sessionUser, 'associarMembrosEvento') || await isUserAdmin(sessionUser);
        if (!hasAssocPerm) {
            data = data.map(e => ({
                ...e,
                membros: e.membros?.includes(sessionUser) ? [sessionUser] : []
            }));
        }
        res.json(data);
    } catch (err) {
        console.error('[GET /atividadesGuilda] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler eventos' });
    }
});
// Nova rota para atividadesGuilda: Criar evento
app.post('/atividadesGuilda', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasCreatePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'criarEvento');
    if (!hasCreatePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { titulo, descricao, data, horario, timezone, avisoAntes } = req.body;
        if (!titulo || !descricao || !data || !horario || !timezone || isNaN(avisoAntes)) {
            return res.status(400).json({ sucesso: false, erro: 'Dados do evento incompletos' });
        }
        let eventos = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const id = Date.now().toString(); // Gerar ID único
        const novoEvento = { id, titulo, descricao, data, horario, timezone, avisoAntes, membros: [], presencas: [], criador: sessionUser };
        eventos.push(novoEvento);
        await fs.writeFile(file, JSON.stringify(eventos, null, 2));
        // Agendar aviso
        scheduleReminder(novoEvento, game);
        io.to(game).emit('update', { type: 'atividadesGuilda' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /atividadesGuilda] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao criar evento' });
    }
});
// Nova rota para atividadesGuilda: Obter evento por ID
app.get('/atividadesGuilda/:id', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const { id } = req.params;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    const isOwn = await isOwnGame(sessionUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        let eventos = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const evento = eventos.find(e => e.id === id);
        if (!evento) {
            return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
        }
        const hasAssocPerm = await hasPermission(sessionUser, 'associarMembrosEvento') || await isUserAdmin(sessionUser);
        if (!hasAssocPerm) {
            evento.membros = evento.membros?.includes(sessionUser) ? [sessionUser] : [];
        }
        res.json(evento);
    } catch (err) {
        console.error('[GET /atividadesGuilda/:id] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler evento' });
    }
});
// Nova rota para atividadesGuilda: Editar evento
app.put('/atividadesGuilda/:id', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const { id } = req.params;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasEditPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'editarEvento');
    if (!hasEditPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { titulo, descricao, data, horario, timezone, avisoAntes } = req.body;
        if (!titulo || !descricao || !data || !horario || !timezone || isNaN(avisoAntes)) {
            return res.status(400).json({ sucesso: false, erro: 'Dados do evento incompletos' });
        }
        let eventos = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const index = eventos.findIndex(e => e.id === id);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
        }
        const updatedEvento = { ...eventos[index], titulo, descricao, data, horario, timezone, avisoAntes };
        eventos[index] = updatedEvento;
        await fs.writeFile(file, JSON.stringify(eventos, null, 2));
        // Reagendar aviso
        scheduleReminder(updatedEvento, game);
        io.to(game).emit('update', { type: 'atividadesGuilda' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[PUT /atividadesGuilda/:id] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar evento' });
    }
});
// Nova rota para atividadesGuilda: Excluir evento
app.delete('/atividadesGuilda/:id', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const { id } = req.params;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasDeletePermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'excluirEvento');
    if (!hasDeletePermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        let eventos = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const index = eventos.findIndex(e => e.id === id);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
        }
        eventos.splice(index, 1);
        await fs.writeFile(file, JSON.stringify(eventos, null, 2));
        io.to(game).emit('update', { type: 'atividadesGuilda' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /atividadesGuilda/:id] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir evento' });
    }
});
// Nova rota para atividadesGuilda: Associar membros
app.post('/atividadesGuilda/:id/membros', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const { id } = req.params;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const hasAssociarPermission = isOwn || isAdminUser || await hasPermission(sessionUser, 'associarMembrosEvento');
    if (!hasAssociarPermission) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado' });
    }
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        // Novo: Checar limite de armazenamento antes de salvar
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        const newData = req.body;
        const newSize = currentSize + Buffer.byteLength(JSON.stringify(newData, null, 2));
        if (newSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        const { membros } = req.body;
        if (!Array.isArray(membros)) {
            return res.status(400).json({ sucesso: false, erro: 'Membros deve ser um array' });
        }
        let eventos = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const index = eventos.findIndex(e => e.id === id);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
        }
        eventos[index].membros = membros;
        await fs.writeFile(file, JSON.stringify(eventos, null, 2));
        // Reagendar aviso se necessário (membros mudaram)
        scheduleReminder(eventos[index], game);
        io.to(game).emit('update', { type: 'atividadesGuilda' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /atividadesGuilda/:id/membros] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao associar membros' });
    }
});
// Nova rota para atividadesGuilda: Marcar presença
app.post('/atividadesGuilda/:id/presenca', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const { id } = req.params;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        let eventos = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const oldFileSize = await fs.stat(file).then(stats => stats.size).catch(() => 0);
        const index = eventos.findIndex(e => e.id === id);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
        }
        const evento = eventos[index];
        const isCreator = evento.criador === sessionUser;
        const isInvited = (evento.membros || []).includes(sessionUser);
        const canMark = isInvited || isCreator || isAdminUser;
        if (!canMark) {
            return res.status(403).json({ sucesso: false, erro: 'Não autorizado a marcar presença neste evento' });
        }
        if (!evento.presencas) {
            evento.presencas = [];
        }
        if (!evento.presencas.includes(sessionUser)) {
            evento.presencas.push(sessionUser);
        }
        const newFileString = JSON.stringify(eventos, null, 2);
        const newFileSize = Buffer.byteLength(newFileString);
        const newTotalSize = currentSize - oldFileSize + newFileSize;
        if (newTotalSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        await fs.writeFile(file, newFileString);
        io.to(game).emit('update', { type: 'atividadesGuilda' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /atividadesGuilda/:id/presenca] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao marcar presença' });
    }
});
// Nova rota para atividadesGuilda: Desmarcar presença
app.delete('/atividadesGuilda/:id/presenca', isAuthenticated, async (req, res) => {
    const sessionUser = req.session.user;
    const { id } = req.params;
    const game = req.query.game || DEFAULT_GAME;
    const userGames = await getUserGames(sessionUser);
    if (!userGames.includes(game)) {
        return res.status(403).json({ sucesso: false, erro: 'Jogo não acessível' });
    }
    const effectiveUser = await getEffectiveUser(sessionUser);
    const isAdminUser = await isUserAdmin(sessionUser);
    const isOwn = await isOwnGame(sessionUser, game);
    const gameDir = await getGameDir(sessionUser, effectiveUser, game);
    if (!isOwn && effectiveUser !== sessionUser) {
        const sharedPath = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''), 'shared.json');
        const shared = await fs.readFile(sharedPath, 'utf8').then(JSON.parse).catch(() => []);
        if (!shared.includes(game)) {
            return res.status(403).json({ sucesso: false, erro: 'Jogo não compartilhado' });
        }
    }
    try {
        await fs.access(gameDir);
    } catch {
        return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
    }
    const file = getFilePath(gameDir, 'atividadesGuilda.json');
    try {
        const user = await getUserByEmail(effectiveUser);
        const plano = user.plano || 'basic';
        const storageLimits = { basic: 10 * 1024 * 1024, standard: 50 * 1024 * 1024, advanced: 150 * 1024 * 1024, fullpass: Infinity };
        const limit = storageLimits[plano];
        const currentSize = await getUserDirSize(effectiveUser);
        let eventos = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        const oldFileSize = await fs.stat(file).then(stats => stats.size).catch(() => 0);
        const index = eventos.findIndex(e => e.id === id);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Evento não encontrado' });
        }
        const evento = eventos[index];
        const isCreator = evento.criador === sessionUser;
        const isInvited = (evento.membros || []).includes(sessionUser);
        const canUnmark = isInvited || isCreator || isAdminUser;
        if (!canUnmark) {
            return res.status(403).json({ sucesso: false, erro: 'Não autorizado a desmarcar presença neste evento' });
        }
        if (!evento.presencas) {
            evento.presencas = [];
        }
        const userIndex = evento.presencas.indexOf(sessionUser);
        if (userIndex !== -1) {
            evento.presencas.splice(userIndex, 1);
        }
        const newFileString = JSON.stringify(eventos, null, 2);
        const newFileSize = Buffer.byteLength(newFileString);
        const newTotalSize = currentSize - oldFileSize + newFileSize;
        if (newTotalSize > limit) {
            return res.status(403).json({ sucesso: false, erro: `Limite de armazenamento atingido para o plano ${plano}` });
        }
        await fs.writeFile(file, newFileString);
        io.to(game).emit('update', { type: 'atividadesGuilda' });
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /atividadesGuilda/:id/presenca] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao desmarcar presença' });
    }
});
// Nova função para enviar emails de aviso
async function sendReminderEmails(membros, titulo, datetime, timezone, game) {
    for (const email of membros) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: `Aviso: Evento "${titulo}" em breve`,
                text: `O evento "${titulo}" no jogo ${game} está prestes a começar em ${datetime} (${timezone}).`
            });
            console.log(`[REMINDER] Email enviado para ${email} sobre evento ${titulo}`);
        } catch (err) {
            console.error('[REMINDER] Erro ao enviar email para', email, ':', err);
        }
    }
}
// Nova função para agendar aviso de um evento
function scheduleReminder(evento, game) {
    const { id, titulo, data, horario, timezone, avisoAntes, membros, criador } = evento;
    if (avisoAntes <= 0) return;
    const recipients = [...new Set([...membros, criador || ''])].filter(Boolean);
    if (recipients.length === 0) return;
    const eventDateTime = moment.tz(`${data} ${horario}`, timezone);
    const reminderTime = eventDateTime.clone().subtract(avisoAntes, 'minutes');
    const now = moment();
    if (reminderTime.isAfter(now)) {
        const delay = reminderTime.diff(now);
        setTimeout(() => {
            sendReminderEmails(recipients, titulo, eventDateTime.format('YYYY-MM-DD HH:mm'), timezone, game);
        }, delay);
        console.log(`[SCHEDULE] Aviso agendado para evento ${id} em ${delay}ms`);
    } else {
        console.log(`[SCHEDULE] Aviso para evento ${id} já passou, não agendado`);
    }
}
// Nova função para agendar todos os avisos ao iniciar
async function scheduleAllReminders() {
    try {
        const users = await fs.readdir(DATA_DIR, { withFileTypes: true }).then(files => files.filter(f => f.isDirectory()).map(f => f.name));
        for (const user of users) {
            const userDir = path.join(DATA_DIR, user);
            const games = await fs.readdir(userDir, { withFileTypes: true }).then(files => files.filter(f => f.isDirectory()).map(f => f.name));
            for (const game of games) {
                const gameDir = path.join(userDir, game);
                const file = path.join(gameDir, 'atividadesGuilda.json');
                try {
                    const eventos = await fs.readFile(file, 'utf8').then(JSON.parse);
                    for (const evento of eventos) {
                        scheduleReminder(evento, game);
                    }
                } catch (err) {
                    console.warn(`[SCHEDULE ALL] Erro ao ler atividades para user ${user} game ${game}:`, err);
                }
            }
        }
        console.log('[SCHEDULE ALL] Todos os avisos agendados');
    } catch (error) {
        console.error('[SCHEDULE ALL] Erro geral:', error);
    }
}
// Chamar scheduleAllReminders após inicializar
inicializarArquivos().then(() => {
    scheduleAllReminders();
});
// Novo: Função para calcular tamanho total do diretório do usuário (recursivo)
async function getUserDirSize(userEmail) {
    const safeUser = userEmail.replace(/[^a-zA-Z0-9@._-]/g, '');
    const userDir = path.join(DATA_DIR, safeUser);
    let totalSize = 0;
    try {
        const files = await fs.readdir(userDir, { recursive: true });
        for (const file of files) {
            const filePath = path.join(userDir, file);
            const stats = await fs.stat(filePath);
            if (stats.isFile()) totalSize += stats.size;
        }
    } catch (error) {
        console.warn('[getUserDirSize] Erro ao calcular tamanho:', error);
    }
    return totalSize;
}
// Novo: Função auxiliar para buscar usuário por email
async function getUserByEmail(email) {
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
    return usuarios.find(u => u.email === email) || {};
}
// Novo: Endpoint admin para atualizar plano de usuário
app.put('/admin/users/:email/plano', isAdmin, async (req, res) => {
    const { email } = req.params;
    const { plano } = req.body;
    if (!plano) {
        return res.status(400).json({ sucesso: false, erro: 'Plano é obrigatório' });
    }
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === email);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        usuarios[index].plano = plano;
        await saveUsuarios(usuarios);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[PUT /admin/users/:email/plano] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar plano' });
    }
});
//! FIM SERVIDOR.JS