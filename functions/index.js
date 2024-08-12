const functions = require("firebase-functions");
const clientController = require("./clients/clientController/clientController");
const adminController = require("./clients/adminController/adminController");
const express = require("express");
const cors = require("cors");
const app = express();
require('dotenv').config();

// Configuração do CORS
const corsOptions = {
  origin: true, // Permite todas as origens
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};


app.use(cors(corsOptions));

adminController.loadClientsToCache().then(() => {
  console.log('Cache inicializado.');
}).catch(error => {
  console.error('Erro ao inicializar o cache:', error);
});


//client
app.post('/getClient', clientController.getClient);
app.post('/updateClient', clientController.updateCliente);
app.post('/updateClientMoreThanOneInfo', clientController.updateClientMoreThanOneInfo);
app.post('/updateContrato', clientController.updateContrato);
app.post('/updateSaque', clientController.updateSaque);
app.post('/createCliente', clientController.createCliente);
app.post('/createClienteIndicacao', clientController.createClienteIndicacao);
app.post('/criptografarString', clientController.criptografarString);
app.post('/createContrato', clientController.createContrato);
app.post('/createSaque', clientController.createSaque);
app.post('/adicionarSaldoAoIndicador', clientController.adicionarSaldoAoIndicador);
app.post('/returnEmailLogin', clientController.returnEmailLogin);
app.get('/getAllNews', clientController.getAllNews);
app.post('/emailExists', clientController.returnEmailExists);

//admin
app.get('/getClients', adminController.getClients);
app.get('/getClientsPaginated', adminController.getClientsPaginated);
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

exports.api = functions.https.onRequest(app);
