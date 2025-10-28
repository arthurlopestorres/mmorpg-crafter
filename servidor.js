// servidor.js

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const session = require('express-session');
const axios = require('axios'); // Adicionado para verificação reCAPTCHA
require('dotenv').config();
const app = express();

app.set('trust proxy', 1);

const PORT = process.env.PORT || 10000;
const DATA_DIR = '/data';
const DEFAULT_GAME = 'Pax Dei';

// Middleware
app.use(express.json());
app.use(express.static(__dirname)); // Servir arquivos estáticos da raiz do projeto
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

// Função placeholder para sincronizarEstoque (substitua pelo código original)
async function sincronizarEstoque() {
    console.log('[sincronizarEstoque] Função placeholder executada. Substitua pelo código original.');
    // Exemplo de implementação (remova ou substitua pelo seu código):
    /*
    try {
        const estoque = await fs.readFile(estoqueFile, 'utf8').then(JSON.parse).catch(() => []);
        console.log('[sincronizarEstoque] Estoque sincronizado:', estoque);
    } catch (error) {
        console.error('[sincronizarEstoque] Erro:', error);
    }
    */
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
function getFilePath(user, game, filename) {
    const safeUser = user.replace(/[^a-zA-Z0-9@._-]/g, ''); // Sanitize email
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, ''); // Sanitize
    return path.join(DATA_DIR, safeUser, safeGame, filename);
}

// Função auxiliar para checar existência de game dir e lidar com criação seletiva
async function ensureGameDir(user, game, method) {
    const safeUser = user.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    try {
        await fs.access(gameDir);
        return true; // Existe
    } catch {
        if (method === 'GET') {
            return false; // Não existe, para GET retornar []
        } else {
            // Para POST/DELETE/etc., criar
            await fs.mkdir(gameDir, { recursive: true });
            return true;
        }
    }
}

// Endpoint para status do usuário
app.get('/user-status', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    const isFounder = effectiveUser === user;
    res.json({ isFounder, effectiveUser });
});

// Novo endpoint para obter dados do usuário logado efetivo (/me)
app.get('/me', isAuthenticated, async (req, res) => {
    const user = req.session.user;
    const effectiveUser = await getEffectiveUser(user);
    const usuariosPath = path.join(DATA_DIR, 'usuarios.json');
    try {
        let usuarios = await fs.readFile(usuariosPath, 'utf8').then(JSON.parse).catch(() => []);
        let usuario = usuarios.find(u => u.email === effectiveUser);
        if (!usuario) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        // Gerar ID se não existir
        if (!usuario.id) {
            usuario.id = await generateUniqueId();
            const index = usuarios.findIndex(u => u.email === effectiveUser);
            usuarios[index] = usuario;
            await saveUsuarios(usuarios);
        }
        // Setar nome padrão se não existir
        if (!usuario.nome || usuario.nome.trim() === '') {
            usuario.nome = "Lorem Ipsum";
            const index = usuarios.findIndex(u => u.email === effectiveUser);
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

        // Adicionar associação
        if (associations.some(a => a.secondary === user)) {
            return res.status(400).json({ sucesso: false, erro: 'Você já está em um time' });
        }
        associations.push({ primary: from, secondary: user });

        await fs.writeFile(pendenciasPath, JSON.stringify(pendencias, null, 2));
        await fs.writeFile(associationsPath, JSON.stringify(associations, null, 2));

        console.log(`[ACEITAR-CONVITE] ${user} aceitou convite de ${from}`);
        res.json({ sucesso: true });
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
        associations.push({ primary, secondary });
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
        const asPrimary = associations.filter(a => a.primary === user).map(a => ({ secondary: a.secondary, role: 'primary' }));
        const asSecondaryAssoc = associations.find(a => a.secondary === user);
        const asSecondary = asSecondaryAssoc ? [{ secondary: asSecondaryAssoc.primary, role: 'secondary' }] : [];
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
        if (!usuarios.some(u => u.email === secondary && u.aprovado)) {
            return res.status(400).json({ sucesso: false, erro: 'Secondary não aprovado' });
        }
        associations.push({ primary: user, secondary });
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
    } catch (error) {
        console.error('[BAN-USER] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao banir usuário' });
    }
});

// Novo endpoint para banir como secondary (banir o primary)
app.post('/ban-as-secondary', isAuthenticated, async (req, res) => {
    const secondary = req.session.user;
    const effectiveUser = await getEffectiveUser(secondary);
    if (effectiveUser !== secondary) {
        return res.status(403).json({ sucesso: false, erro: 'Não autorizado a banir usuários' });
    }
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

// Endpoint: Login (não protegido)
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
        if (!usuario || !usuario.aprovado || !(await bcrypt.compare(senha, usuario.senhaHash))) {
            return res.status(401).json({ sucesso: false, erro: 'Usuário ou senha não encontrados' });
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
        req.session.user = email;
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /login] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao fazer login' });
    }
});

// Endpoint: Cadastro (não protegido)
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
        const senhaHash = await bcrypt.hash(senha, 10);
        const id = await generateUniqueId();
        usuarios.push({ nome, email, senhaHash, id, aprovado: false });
        await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));

        // Enviar email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: 'arthurlttorres@gmail.com',
            subject: 'Solicitação de Acesso',
            text: `Usuário solicitou acesso:\nNome: ${nome}\nEmail: ${email}`
        });

        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /cadastro] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao cadastrar' });
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

// Endpoint para listar jogos (agora por user)
app.get('/games', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    try {
        const userDir = path.join(DATA_DIR, effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, ''));
        await fs.mkdir(userDir, { recursive: true }); // Cria dir do user se não existir
        const files = await fs.readdir(userDir, { withFileTypes: true });
        const games = files.filter(f => f.isDirectory()).map(f => f.name).sort();
        res.json(games);
    } catch (error) {
        console.error('[GET /games] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao listar jogos' });
    }
});

// Endpoint para criar novo jogo (agora por user)
app.post('/games', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    const { name } = req.body;
    if (!name || !/^[a-zA-Z0-9 ]+$/.test(name)) {
        return res.status(400).json({ sucesso: false, erro: 'Nome do jogo inválido' });
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = name.replace(/[^a-zA-Z0-9 ]/g, '');
    const userDir = path.join(DATA_DIR, safeUser);
    const gameDir = path.join(userDir, safeGame);
    try {
        await fs.access(gameDir);
        return res.status(400).json({ sucesso: false, erro: 'Jogo já existe' });
    } catch {
        await fs.mkdir(gameDir, { recursive: true });
        const files = ['receitas.json', 'componentes.json', 'estoque.json', 'arquivados.json', 'log.json', 'roadmap.json', 'categorias.json'];
        for (const file of files) {
            await fs.writeFile(path.join(gameDir, file), JSON.stringify([]));
        }
        res.json({ sucesso: true });
    }
});

// Endpoint para deletar jogo (protegido por headers, agora por user)
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

// Endpoints protegidos com suporte a user e game
app.get('/receitas', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[GET /receitas] Requisição recebida');
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    const exists = await ensureGameDir(effectiveUser, game, 'GET');
    if (!exists) {
        res.json([]);
        return;
    }
    const file = path.join(gameDir, 'receitas.json');
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
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /receitas] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'receitas.json');
    try {
        const novaReceita = req.body;
        if (Array.isArray(novaReceita)) {
            // Atualizar toda a lista de receitas (usado no arquivamento)
            await fs.writeFile(file, JSON.stringify(novaReceita, null, 2));
            console.log('[POST /receitas] Lista de receitas atualizada');
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
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar receita' });
    }
});

app.post('/receitas/editar', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /receitas/editar] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'receitas.json');
    try {
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
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas/editar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar receita' });
    }
});

app.post('/receitas/favoritar', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /receitas/favoritar] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'receitas.json');
    try {
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
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas/favoritar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar favorita' });
    }
});

app.get('/categorias', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[GET /categorias] Requisição recebida');
    const game = req.query.game || DEFAULT_GAME;
    const exists = await ensureGameDir(effectiveUser, game, 'GET');
    if (!exists) {
        res.json([]);
        return;
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    const file = path.join(gameDir, 'categorias.json');
    try {
        let data = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        res.json(data);
    } catch (err) {
        console.error('[GET /categorias] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler categorias' });
    }
});

app.post('/categorias', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /categorias] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'categorias.json');
    try {
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
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /categorias] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar categoria' });
    }
});

app.post('/categorias/excluir', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /categorias/excluir] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const { nome } = req.body;
    if (!nome) {
        console.log('[POST /categorias/excluir] Erro: Nome ausente');
        return res.status(400).json({ sucesso: false, erro: 'Nome é obrigatório' });
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const catFile = path.join(gameDir, 'categorias.json');
    const compFile = path.join(gameDir, 'componentes.json');
    try {
        let comps = await fs.readFile(compFile, 'utf8').then(JSON.parse).catch(() => []);
        if (comps.some(c => c.categoria === nome)) {
            console.log('[POST /categorias/excluir] Erro: Categoria em uso:', nome);
            return res.status(400).json({ sucesso: false, erro: 'Categoria em uso' });
        }

        let categorias = await fs.readFile(catFile, 'utf8').then(JSON.parse).catch(() => []);
        categorias = categorias.filter(c => c !== nome);
        await fs.writeFile(catFile, JSON.stringify(categorias, null, 2));
        console.log('[POST /categorias/excluir] Categoria excluída:', nome);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /categorias/excluir] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir categoria' });
    }
});

app.get('/componentes', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[GET /componentes] Requisição recebida');
    const game = req.query.game || DEFAULT_GAME;
    const exists = await ensureGameDir(effectiveUser, game, 'GET');
    if (!exists) {
        res.json([]);
        return;
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    const file = path.join(gameDir, 'componentes.json');
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
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /componentes] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'componentes.json');
    const estoqueFileGame = path.join(gameDir, 'estoque.json');
    const catFile = path.join(gameDir, 'categorias.json');
    try {
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

        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar componente' });
    }
});

app.post('/componentes/editar', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /componentes/editar] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'componentes.json');
    const estoqueFileGame = path.join(gameDir, 'estoque.json');
    const receitasFileGame = path.join(gameDir, 'receitas.json');
    const catFile = path.join(gameDir, 'categorias.json');
    try {
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

        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes/editar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar componente' });
    }
});

app.post('/componentes/excluir', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /componentes/excluir] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'componentes.json');
    const receitasFileGame = path.join(gameDir, 'receitas.json');
    const arquivadosFileGame = path.join(gameDir, 'arquivados.json');
    const estoqueFileGame = path.join(gameDir, 'estoque.json');
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
        await fs.writeFile(file, JSON.stringify(componentes, null, 2));
        console.log('[POST /componentes/excluir] Componente excluído:', nome);

        // Remover do estoque
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

        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes/excluir] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir componente' });
    }
});

app.get('/estoque', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[GET /estoque] Requisição recebida');
    const game = req.query.game || DEFAULT_GAME;
    const exists = await ensureGameDir(effectiveUser, game, 'GET');
    if (!exists) {
        res.json([]);
        return;
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    const file = path.join(gameDir, 'estoque.json');
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

app.post('/estoque', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /estoque] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'estoque.json');
    try {
        const { componente, quantidade, operacao } = req.body;
        if (!componente || !quantidade || !operacao) {
            console.log('[POST /estoque] Erro: Componente, quantidade ou operação ausentes');
            return res.status(400).json({ sucesso: false, erro: 'Componente, quantidade e operação são obrigatórios' });
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
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /estoque] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar estoque' });
    }
});

app.post('/estoque/zerar', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /estoque/zerar] Requisição recebida');
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'estoque.json');
    try {
        let estoque = [];
        try {
            estoque = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        // Zerar todas as quantidades
        estoque.forEach(e => {
            e.quantidade = 0;
        });

        await fs.writeFile(file, JSON.stringify(estoque, null, 2));
        console.log('[POST /estoque/zerar] Estoque zerado');
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /estoque/zerar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao zerar estoque' });
    }
});

app.delete('/data', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[DELETE /data] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'DELETE');
    const file = path.join(gameDir, 'estoque.json');
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
        await fs.writeFile(file, JSON.stringify(estoque, null, 2));
        console.log('[DELETE /data] Componente excluído do estoque:', componente);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /data] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir componente do estoque' });
    }
});

app.get('/arquivados', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[GET /arquivados] Requisição recebida');
    const game = req.query.game || DEFAULT_GAME;
    const exists = await ensureGameDir(effectiveUser, game, 'GET');
    if (!exists) {
        res.json([]);
        return;
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    const file = path.join(gameDir, 'arquivados.json');
    try {
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /arquivados] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler arquivados' });
    }
});

app.post('/arquivados', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /arquivados] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'arquivados.json');
    try {
        const arquivados = req.body;
        await fs.writeFile(file, JSON.stringify(arquivados, null, 2));
        console.log('[POST /arquivados] Arquivados atualizados');
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /arquivados] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar arquivados' });
    }
});

app.get('/log', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[GET /log] Requisição recebida');
    const game = req.query.game || DEFAULT_GAME;
    const exists = await ensureGameDir(effectiveUser, game, 'GET');
    if (!exists) {
        res.json([]);
        return;
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    const file = path.join(gameDir, 'log.json');
    try {
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /log] Erro:', err);
        res.status(500).json({ sucesso: false, erro: 'Erro ao ler log' });
    }
});

app.post('/log', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /log] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'log.json');
    try {
        const novosLogs = Array.isArray(req.body) ? req.body : [req.body];
        let logs = [];
        try {
            logs = JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        logs.push(...novosLogs);
        await fs.writeFile(file, JSON.stringify(logs, null, 2));
        console.log('[POST /log] Log atualizado com', novosLogs.length, 'entradas');
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /log] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar log' });
    }
});

app.post('/fabricar', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /fabricar] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const { componente, numCrafts = 1 } = req.body;
    if (!componente) {
        console.log('[POST /fabricar] Erro: Componente ausente');
        return res.status(400).json({ sucesso: false, erro: 'Componente é obrigatório' });
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const componentesFile = path.join(gameDir, 'componentes.json');
    const estoqueFile = path.join(gameDir, 'estoque.json');
    const logFile = path.join(gameDir, 'log.json');
    try {
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
        let newLogs = [];
        for (const assoc of comp.associados) {
            const eIndex = estoque.findIndex(e => e.componente === assoc.nome);
            estoque[eIndex].quantidade -= assoc.quantidade * numCrafts;
            newLogs.push({
                dataHora,
                componente: assoc.nome,
                quantidade: assoc.quantidade * numCrafts,
                operacao: "debitar",
                origem: `Fabricação de ${componente}`
            });
        }

        // Adicionar o componente produzido
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
            origem: `Fabricação de ${componente}`
        });

        await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));

        // Registrar no log
        let logs = await fs.readFile(logFile, 'utf8').then(JSON.parse).catch(() => []);
        logs.push(...newLogs);
        await fs.writeFile(logFile, JSON.stringify(logs, null, 2));

        console.log('[POST /fabricar] Componente fabricado:', componente);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /fabricar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao fabricar componente' });
    }
});

// Endpoint para roadmap
app.get('/roadmap', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    const game = req.query.game || DEFAULT_GAME;
    const exists = await ensureGameDir(effectiveUser, game, 'GET');
    if (!exists) {
        res.json([]);
        return;
    }
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    const file = path.join(gameDir, 'roadmap.json');
    try {
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler roadmap' });
    }
});

app.post('/roadmap', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    const game = req.query.game || DEFAULT_GAME;
    const safeUser = effectiveUser.replace(/[^a-zA-Z0-9@._-]/g, '');
    const safeGame = game.replace(/[^a-zA-Z0-9 ]/g, '');
    const gameDir = path.join(DATA_DIR, safeUser, safeGame);
    await ensureGameDir(effectiveUser, game, 'POST');
    const file = path.join(gameDir, 'roadmap.json');
    try {
        const roadmap = req.body;
        await fs.writeFile(file, JSON.stringify(roadmap, null, 2));
        res.json({ sucesso: true });
    } catch (error) {
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar roadmap' });
    }
});

// Endpoint para verificar status do servidor (não protegido)
app.get('/health', (req, res) => {
    console.log('[GET /health] Verificação de status do servidor');
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Iniciar o servidor
app.listen(PORT, () => {
    console.log(`[SERVER] Servidor rodando em http://localhost:${PORT}`);
    sincronizarEstoque();
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[SERVER] Erro: Porta ${PORT} já está em uso. Tente outra porta.`);
    } else {
        console.error('[SERVER] Erro ao iniciar servidor:', err);
    }
});