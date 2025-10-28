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

// Endpoint temporário para migração (REMOVER APÓS USO)
app.post('/migrate', async (req, res) => {
    const key = req.headers['x-migration-key'];
    const targetUser = req.headers['x-target-user'];
    if (key !== 'migrate-mmorpg-crafter-2025' || targetUser !== 'arthurlopestorres@gmail.com') {
        return res.status(403).json({ sucesso: false, erro: 'Acesso negado para migração' });
    }

    const migratedFlag = path.join(DATA_DIR, '.migrated');
    try {
        await fs.access(migratedFlag);
        return res.json({ sucesso: true, mensagem: 'Migração já realizada anteriormente.' });
    } catch { }

    try {
        const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
        const gameDirs = entries.filter(entry => entry.isDirectory() && !entry.name.includes('@') && !entry.name.includes('.')); // Filtra dirs que não parecem emails ou flags
        const migratedGames = [];

        for (const dir of gameDirs) {
            const oldGameDir = path.join(DATA_DIR, dir.name);
            const newGameDir = path.join(DATA_DIR, targetUser, dir.name);

            try {
                await fs.mkdir(path.join(DATA_DIR, targetUser), { recursive: true });
                await fs.rename(oldGameDir, newGameDir);
                migratedGames.push(dir.name);
                console.log(`[MIGRATE] Pasta ${dir.name} movida para /data/${targetUser}/${dir.name}`);
            } catch (err) {
                console.error(`[MIGRATE] Erro ao mover ${dir.name}:`, err);
            }
        }

        await fs.writeFile(migratedFlag, 'migrated-2025');
        res.json({ sucesso: true, migrados: migratedGames, total: migratedGames.length });
    } catch (error) {
        console.error('[MIGRATE] Erro geral:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro na migração: ' + error.message });
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

        const usuarios = await fs.readFile(path.join(DATA_DIR, 'usuarios.json'), 'utf8').then(JSON.parse).catch(() => []);
        const usuario = usuarios.find(u => u.email === email);
        if (!usuario || !usuario.aprovado || !(await bcrypt.compare(senha, usuario.senhaHash))) {
            return res.status(401).json({ sucesso: false, erro: 'Usuário ou senha não encontrados' });
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

        let usuarios = await fs.readFile(path.join(DATA_DIR, 'usuarios.json'), 'utf8').then(JSON.parse).catch(() => []);
        if (usuarios.some(u => u.email === email)) {
            return res.status(400).json({ sucesso: false, erro: 'Email já cadastrado' });
        }
        const senhaHash = await bcrypt.hash(senha, 10);
        usuarios.push({ nome, email, senhaHash, aprovado: false });
        await fs.writeFile(path.join(DATA_DIR, 'usuarios.json'), JSON.stringify(usuarios, null, 2));

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

// Endpoint: Aprovação manual (não protegido, pois manual via Postman)
app.put('/data/usuarios', async (req, res) => {
    const { email, aprovadoParaAcesso } = req.body;
    try {
        let usuarios = await fs.readFile(path.join(DATA_DIR, 'usuarios.json'), 'utf8').then(JSON.parse).catch(() => []);
        const index = usuarios.findIndex(u => u.email === email);
        if (index === -1) {
            return res.status(404).json({ sucesso: false, erro: 'Usuário não encontrado' });
        }
        usuarios[index].aprovado = aprovadoParaAcesso;
        await fs.writeFile(path.join(DATA_DIR, 'usuarios.json'), JSON.stringify(usuarios, null, 2));
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[PUT /data/usuarios] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao aprovar' });
    }
});

// Endpoint: Troca de senha (protegido por headers)
app.put('/data/usuarios', async (req, res) => {
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
        await fs.writeFile(path.join(DATA_DIR, 'usuarios.json'), JSON.stringify(usuarios, null, 2));
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[PUT /data/usuarios/troca-de-senha] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao trocar senha' });
    }
});

// Endpoint para listar jogos (agora por user)
app.get('/games', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    try {
        const userDir = path.join(DATA_DIR, effectiveUser);
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
    const userDir = path.join(DATA_DIR, effectiveUser);
    const gameDir = path.join(userDir, name);
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
    const userGameDir = path.join(DATA_DIR, effectiveUser, game);
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
    const file = getFilePath(effectiveUser, game, 'receitas.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true }); // Cria dirs se não existirem
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
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler receitas' });
    }
});

app.post('/receitas', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /receitas] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const file = getFilePath(effectiveUser, game, 'receitas.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'receitas.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'receitas.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'categorias.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
        let data = await fs.readFile(file, 'utf8').then(JSON.parse).catch(() => []);
        res.json(data);
    } catch (err) {
        console.error('[GET /categorias] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler categorias' });
    }
});

app.post('/categorias', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /categorias] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const file = getFilePath(effectiveUser, game, 'categorias.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const catFile = getFilePath(effectiveUser, game, 'categorias.json');
    const compFile = getFilePath(effectiveUser, game, 'componentes.json');
    try {
        await fs.mkdir(path.dirname(catFile), { recursive: true });
        await fs.mkdir(path.dirname(compFile), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'componentes.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler componentes' });
    }
});

app.post('/componentes', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /componentes] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const file = getFilePath(effectiveUser, game, 'componentes.json');
    const estoqueFileGame = getFilePath(effectiveUser, game, 'estoque.json');
    const catFile = getFilePath(effectiveUser, game, 'categorias.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'componentes.json');
    const estoqueFileGame = getFilePath(effectiveUser, game, 'estoque.json');
    const receitasFileGame = getFilePath(effectiveUser, game, 'receitas.json');
    const catFile = getFilePath(effectiveUser, game, 'categorias.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'componentes.json');
    const receitasFileGame = getFilePath(effectiveUser, game, 'receitas.json');
    const arquivadosFileGame = getFilePath(effectiveUser, game, 'arquivados.json');
    const estoqueFileGame = getFilePath(effectiveUser, game, 'estoque.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'estoque.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler estoque' });
    }
});

app.post('/estoque', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /estoque] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const file = getFilePath(effectiveUser, game, 'estoque.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'estoque.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'estoque.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'arquivados.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /arquivados] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler arquivados' });
    }
});

app.post('/arquivados', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /arquivados] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const file = getFilePath(effectiveUser, game, 'arquivados.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'log.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const data = await fs.readFile(file, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /log] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler log' });
    }
});

app.post('/log', isAuthenticated, async (req, res) => {
    const effectiveUser = await getEffectiveUser(req.session.user);
    console.log('[POST /log] Requisição recebida:', req.body);
    const game = req.query.game || DEFAULT_GAME;
    const file = getFilePath(effectiveUser, game, 'log.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const componentesFile = getFilePath(effectiveUser, game, 'componentes.json');
    const estoqueFile = getFilePath(effectiveUser, game, 'estoque.json');
    const logFile = getFilePath(effectiveUser, game, 'log.json');
    try {
        await fs.mkdir(path.dirname(componentesFile), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'roadmap.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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
    const file = getFilePath(effectiveUser, game, 'roadmap.json');
    try {
        await fs.mkdir(path.dirname(file), { recursive: true });
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