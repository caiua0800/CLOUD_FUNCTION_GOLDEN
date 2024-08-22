const functions = require("firebase-functions");
const clientController = require("./clients/clientController/clientController");
const adminController = require("./clients/adminController/adminController");
const mpController = require("./gateway/mp/mpController");
const assasControler = require("./gateway/assas/assasController");
const express = require("express");
const cors = require("cors");
const app = express();
const cache = require('./database/cache');
require('dotenv').config();

// Configuração do CORS
const corsOptions = {
  origin: '*', // Permite todas as origens
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// Inicializa o cache
adminController.loadClientsToCache().then(() => {
  console.log('Cache inicializado.');
}).catch(error => {
  console.error('Erro ao inicializar o cache:', error);
});

// Middleware para verificação e carregamento do cache
app.use(async (req, res, next) => {
  try {
    const cachedClients = await cache.get('clients');
    if (!cachedClients) {
      await adminController.loadClientsToCache();
    }
    next();
  } catch (error) {
    console.error('Erro ao verificar ou carregar o cache:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas Client
app.post('/getClient', clientController.getClient);
app.post('/updateClient', clientController.updateCliente);
app.post('/updateClientMoreThanOneInfo', clientController.updateClientMoreThanOneInfo);
app.post('/updateContrato', clientController.updateContrato);
app.post('/updateSaque', clientController.updateSaque);
app.post('/createCliente', clientController.createCliente);
app.post('/createClienteIndicacao', clientController.createClienteIndicacao);
app.post('/criptografarString', clientController.criptografarString);
app.post('/updateContratoComIndicacao', clientController.updateContratoComIndicacao);
app.post('/createContrato', clientController.createContrato);
app.post('/createSaque', clientController.createSaque);
app.post('/adicionarSaldoAoIndicador', clientController.adicionarSaldoAoIndicador);
app.post('/returnEmailLogin', clientController.returnEmailLogin);
app.get('/getAllNews', clientController.getAllNews);
app.post('/emailExists', clientController.returnEmailExists);

// Rotas Admin
app.get('/getClients', adminController.getClients);
app.get('/obterDepositos', adminController.obterDepositos);
app.post('/obterDeposito', adminController.obterDeposito);
app.get('/getAllClientesWithPlusInfo', adminController.getAllClientesWithPlusInfo);
app.get('/obterSaques', adminController.obterSaques);
app.get('/obterSaquesPendentes', adminController.obterSaquesPendentes);
app.get('/getAdminData', adminController.getAdminData);
app.get('/getQttClientsByState', adminController.getQttClientsByState);
app.get('/obterDatasDeCadastro', adminController.obterDatasDeCadastro);
app.get('/getMelhoresClientes', adminController.getMelhoresClientes);
app.get('/getTopInvestors', adminController.getTopInvestors);
app.get('/clientsThatDidNotBought', adminController.clientsThatDidNotBought);
app.post('/createContratoAdmin', adminController.createContratoAdmin);
app.post('/updateClienteValidacao', adminController.updateClienteValidacao);
app.post('/createSaqueAdmin', adminController.createSaqueAdmin);
app.get('/atualizarTodosContratosAtivos', adminController.atualizarTodosContratosAtivos);
app.get('/testCache', adminController.testCache);
app.post('/adicionarIndicacao', adminController.adicionarIndicacao);
app.post('/cancelarContrato', adminController.cancelarContrato);
app.post('/adicionarSaldoParaSaque', adminController.adicionarSaldoParaSaque);


//EXTRAÇÃO DE ARQUIVOS
app.get('/getDatabase', adminController.getExtractDatabase);


//Gateway Mercado Pago
app.post('/pix-mp', mpController.criarPix);
app.post('/boleto-mp', mpController.criarBoleto);

//Gateway ASSAS
app.get('/pix-assas', assasControler.gerarPIX);




// Função Firebase com configuração de memória e timeout
exports.api = functions.region('southamerica-east1').runWith({
  memory: '2GB',
  timeoutSeconds: 300,
}).https.onRequest(app);

// Schedule the function to run every day at 18:30 Brasília time
exports.scheduledUpdateContracts = functions.region('southamerica-east1').pubsub.schedule('0 2 * * *')
  .timeZone('America/Sao_Paulo') // Set the time zone to Brasília
  .onRun(async (context) => {
    try {
      await adminController.atualizarTodosContratosAtivos();
      console.log('Contratos ativos atualizados com sucesso.');
    } catch (error) {
      console.error('Erro ao atualizar os contratos ativos:', error);
    }
  });
