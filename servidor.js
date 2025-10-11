const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000;
const DATA_DIR = '/data';
const receitasFile = path.join(DATA_DIR, 'receitas.json');
const componentesFile = path.join(DATA_DIR, 'componentes.json');
const estoqueFile = path.join(DATA_DIR, 'estoque.json');
const arquivadosFile = path.join(DATA_DIR, 'arquivados.json');
const logFile = path.join(DATA_DIR, 'log.json');

// Middleware
app.use(express.json());
app.use(express.static(__dirname)); // Servir arquivos estáticos da raiz do projeto

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

// Criar diretório de dados e arquivos JSON iniciais, se não existirem
async function inicializarArquivos() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('[INIT] Diretório de dados criado ou já existente:', DATA_DIR);
        const arquivos = [receitasFile, componentesFile, estoqueFile, arquivadosFile, logFile];
        for (const arquivo of arquivos) {
            try {
                await fs.access(arquivo);
            } catch {
                console.log(`[INIT] Criando arquivo vazio: ${path.basename(arquivo)}`);
                await fs.writeFile(arquivo, JSON.stringify([]));
            }
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

// Endpoint: Servir index.html
app.get('/', (req, res) => {
    console.log('[GET /] Servindo index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint: Obter receitas
app.get('/receitas', async (req, res) => {
    console.log('[GET /receitas] Requisição recebida');
    try {
        const data = await fs.readFile(receitasFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /receitas] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler receitas' });
    }
});

// Endpoint: Criar ou atualizar lista de receitas
app.post('/receitas', async (req, res) => {
    console.log('[POST /receitas] Requisição recebida:', req.body);
    try {
        const novaReceita = req.body;
        if (Array.isArray(novaReceita)) {
            // Atualizar toda a lista de receitas (usado no arquivamento)
            await fs.writeFile(receitasFile, JSON.stringify(novaReceita, null, 2));
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
            const data = await fs.readFile(receitasFile, 'utf8');
            receitas = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        receitas.push(novaReceita);
        await fs.writeFile(receitasFile, JSON.stringify(receitas, null, 2));
        console.log('[POST /receitas] Receita adicionada:', novaReceita.nome);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar receita' });
    }
});

// Endpoint: Editar receita
app.post('/receitas/editar', async (req, res) => {
    console.log('[POST /receitas/editar] Requisição recebida:', req.body);
    try {
        const { nomeOriginal, nome, componentes } = req.body;
        if (!nomeOriginal || !nome || !componentes) {
            console.log('[POST /receitas/editar] Erro: Nome original, nome ou componentes ausentes');
            return res.status(400).json({ sucesso: false, erro: 'Nome original, nome e componentes são obrigatórios' });
        }

        let receitas = [];
        try {
            const data = await fs.readFile(receitasFile, 'utf8');
            receitas = JSON.parse(data);
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

        receitas[index] = { nome, componentes };
        await fs.writeFile(receitasFile, JSON.stringify(receitas, null, 2));
        console.log('[POST /receitas/editar] Receita editada:', nomeOriginal, '->', nome);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /receitas/editar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar receita' });
    }
});

// Endpoint: Obter componentes
app.get('/componentes', async (req, res) => {
    console.log('[GET /componentes] Requisição recebida');
    try {
        const data = await fs.readFile(componentesFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /componentes] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler componentes' });
    }
});

// Endpoint: Criar componente
app.post('/componentes', async (req, res) => {
    console.log('[POST /componentes] Requisição recebida:', req.body);
    try {
        const novoComponente = req.body;
        if (!novoComponente.nome) {
            console.log('[POST /componentes] Erro: Nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome é obrigatório' });
        }

        let componentes = [];
        try {
            const data = await fs.readFile(componentesFile, 'utf8');
            componentes = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        if (componentes.some(c => c.nome === novoComponente.nome)) {
            console.log('[POST /componentes] Erro: Componente já existe:', novoComponente.nome);
            return res.status(400).json({ sucesso: false, erro: 'Componente já existe' });
        }

        componentes.push(novoComponente);
        await fs.writeFile(componentesFile, JSON.stringify(componentes, null, 2));
        console.log('[POST /componentes] Componente adicionado:', novoComponente.nome);

        // Adicionar automaticamente ao estoque com quantidade 0 se não existir
        let estoque = [];
        try {
            const data = await fs.readFile(estoqueFile, 'utf8');
            estoque = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        const index = estoque.findIndex(e => e.componente === novoComponente.nome);
        if (index === -1) {
            estoque.push({ componente: novoComponente.nome, quantidade: 0 });
            await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));
            console.log('[POST /componentes] Componente adicionado ao estoque com quantidade 0:', novoComponente.nome);
        }

        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar componente' });
    }
});

// Endpoint: Editar componente
app.post('/componentes/editar', async (req, res) => {
    console.log('[POST /componentes/editar] Requisição recebida:', req.body);
    try {
        const { nomeOriginal, nome, categoria, associados, quantidadeProduzida } = req.body;
        if (!nomeOriginal || !nome) {
            console.log('[POST /componentes/editar] Erro: Nome original ou nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome original e nome são obrigatórios' });
        }

        let componentes = [];
        try {
            const data = await fs.readFile(componentesFile, 'utf8');
            componentes = JSON.parse(data);
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
        await fs.writeFile(componentesFile, JSON.stringify(componentes, null, 2));
        console.log('[POST /componentes/editar] Componente editado:', nomeOriginal, '->', nome);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes/editar] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao editar componente' });
    }
});

// Endpoint: Excluir componente
app.post('/componentes/excluir', async (req, res) => {
    console.log('[POST /componentes/excluir] Requisição recebida:', req.body);
    try {
        const { nome } = req.body;
        if (!nome) {
            console.log('[POST /componentes/excluir] Erro: Nome ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome é obrigatório' });
        }

        let componentes = [];
        try {
            const data = await fs.readFile(componentesFile, 'utf8');
            componentes = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        const index = componentes.findIndex(c => c.nome === nome);
        if (index === -1) {
            console.log('[POST /componentes/excluir] Erro: Componente não encontrado:', nome);
            return res.status(404).json({ sucesso: false, erro: 'Componente não encontrado' });
        }

        componentes.splice(index, 1);
        await fs.writeFile(componentesFile, JSON.stringify(componentes, null, 2));
        console.log('[POST /componentes/excluir] Componente excluído:', nome);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /componentes/excluir] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir componente' });
    }
});

// Endpoint: Obter estoque
app.get('/estoque', async (req, res) => {
    console.log('[GET /estoque] Requisição recebida');
    try {
        const data = await fs.readFile(estoqueFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /estoque] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler estoque' });
    }
});

// Endpoint: Atualizar estoque
app.post('/estoque', async (req, res) => {
    console.log('[POST /estoque] Requisição recebida:', req.body);
    try {
        const { componente, quantidade, operacao } = req.body;
        if (!componente || !quantidade || !operacao) {
            console.log('[POST /estoque] Erro: Componente, quantidade ou operação ausentes');
            return res.status(400).json({ sucesso: false, erro: 'Componente, quantidade e operação são obrigatórios' });
        }

        let estoque = [];
        try {
            const data = await fs.readFile(estoqueFile, 'utf8');
            estoque = JSON.parse(data);
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

        await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));
        console.log('[POST /estoque] Estoque atualizado:', componente, operacao, quantidade);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /estoque] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar estoque' });
    }
});

// Endpoint: Excluir item do estoque
app.delete('/data', async (req, res) => {
    console.log('[DELETE /data] Requisição recebida:', req.body);
    try {
        const { componente } = req.body;
        if (!componente) {
            console.log('[DELETE /data] Erro: Nome do componente ausente');
            return res.status(400).json({ sucesso: false, erro: 'Nome do componente é obrigatório' });
        }

        let estoque = [];
        try {
            const data = await fs.readFile(estoqueFile, 'utf8');
            estoque = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        const index = estoque.findIndex(e => e.componente === componente);
        if (index === -1) {
            console.log('[DELETE /data] Erro: Componente não encontrado no estoque:', componente);
            return res.status(404).json({ sucesso: false, erro: 'Componente não encontrado no estoque' });
        }

        estoque.splice(index, 1);
        await fs.writeFile(estoqueFile, JSON.stringify(estoque, null, 2));
        console.log('[DELETE /data] Componente excluído do estoque:', componente);
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[DELETE /data] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao excluir componente do estoque' });
    }
});

// Endpoint: Obter arquivados
app.get('/arquivados', async (req, res) => {
    console.log('[GET /arquivados] Requisição recebida');
    try {
        const data = await fs.readFile(arquivadosFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /arquivados] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler arquivados' });
    }
});

// Endpoint: Atualizar arquivados
app.post('/arquivados', async (req, res) => {
    console.log('[POST /arquivados] Requisição recebida:', req.body);
    try {
        const arquivados = req.body;
        await fs.writeFile(arquivadosFile, JSON.stringify(arquivados, null, 2));
        console.log('[POST /arquivados] Arquivados atualizados');
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /arquivados] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar arquivados' });
    }
});

// Endpoint: Obter log
app.get('/log', async (req, res) => {
    console.log('[GET /log] Requisição recebida');
    try {
        const data = await fs.readFile(logFile, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error('[GET /log] Erro:', err);
        if (err.code === 'ENOENT') res.json([]);
        else res.status(500).json({ sucesso: false, erro: 'Erro ao ler log' });
    }
});

// Endpoint: Adicionar ao log
app.post('/log', async (req, res) => {
    console.log('[POST /log] Requisição recebida:', req.body);
    try {
        const novosLogs = Array.isArray(req.body) ? req.body : [req.body];
        let logs = [];
        try {
            const data = await fs.readFile(logFile, 'utf8');
            logs = JSON.parse(data);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }

        logs.push(...novosLogs);
        await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
        console.log('[POST /log] Log atualizado com', novosLogs.length, 'entradas');
        res.json({ sucesso: true });
    } catch (error) {
        console.error('[POST /log] Erro:', error);
        res.status(500).json({ sucesso: false, erro: 'Erro ao salvar log' });
    }
});

// Endpoint: Verificar status do servidor
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
