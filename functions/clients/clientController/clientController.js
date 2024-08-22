const { db, auth } = require("../../database/firebaseAdmin");
const moment = require('moment');
const { getCurrentTimestamp, processClientData, encrypt, decrypt } = require('../helpers/clientHelpers')
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const cache = require("../../database/cache");
const adminController = require("../adminController/adminController");

const clientController = {

    getClient: async (request, response) => {
        try {
            const clientId = request.body.clientId;

            // Verificar no cache
            // let clientData = cache.get(clientId);
            // if (clientData) {
            //     return response.status(200).json(clientData);
            // }

            // Buscar no Firestore
            const clientDoc = await db.collection('USERS').doc(clientId).get();

            if (!clientDoc.exists) {
                return response.status(404).json({ error: "Cliente não encontrado" });
            }

            const clientDocNewData = processClientData(clientDoc.data());

            // Armazenar no cache
            cache.set(clientId, clientDocNewData);

            // Verificar se `clientDocNewData` contém `NAME`
            if (clientDocNewData && clientDocNewData.NAME) {
                console.log(clientDocNewData.NAME);
            } else {
                console.warn('clientDocNewData does not contain NAME');
            }

            return response.status(200).json(clientDocNewData);
        } catch (error) {
            console.error("Error obtendo cliente:", error.message || error);
            return response.status(500).json({ error: 'Internal Server Error' });
        }
    },


    returnEmailLogin: async (request, response) => {
        const userName = request.body.USERNAME;

        if (!userName)
            return response.status(404).json({ error: "Necessário enviar o username", status: 404 });

        const clientDoc = await db.collection('DisplayNames').doc(userName).get();

        if (clientDoc.exists) {
            return response.status(202).json({ EMAIL: clientDoc.data().EMAIL, CPF: clientDoc.data().CPF, status: 202 })
        } else {
            return response.status(400).json({ error: "Cliente não encontrado", status: 400 });
        }
    },

    returnEmailExists: async (request, response) => {
        const EMAIL = request.body.EMAIL;

        if (!EMAIL) {
            return response.status(401).json({ error: "Necessário enviar o EMAIL", status: 401 });
        }

        try {

            const snapshot = await db.collection('DisplayNames')
                .where('EMAIL', '==', EMAIL)
                .get();

            if (snapshot.empty) {
                return response.status(400).json({ error: "Cliente não encontrado", status: 400 });
            }

            // Assumindo que você só espera um resultado, mas pode ter múltiplos, então retornamos o primeiro
            const clientData = snapshot.docs[0].data();
            return response.status(200).json({ EMAIL: clientData.EMAIL, CPF: clientData.CPF, status: 200 });
        } catch (error) {
            console.error("Erro ao buscar cliente por EMAIL:", error);
            return response.status(500).json({ error: 'Internal Server Error' });
        }
    },

    getProfilePhotoURL: async (req, res) => {
        const { docId } = req.body;

        if(!docId){
            return res.status(404).json({status: 404, data: "DOC ID OBRIGATÓRIO"})
        }

        const clienteRef = db.collection('USERS').doc(docId);
        const clienteDoc = await clienteRef.get();
        const data = clienteDoc.data();
    },


    updateCliente: async (req, res) => {
        const { docId, field, newValue } = req.body;
        if (!docId || !field || newValue === undefined) {
            return res.status(400).send('DocId, campo e novo valor são obrigatórios.');
        }

        try {
            // Atualiza o cliente no cache
            let clienteCache = cache.get(docId);
            if (clienteCache) {
                clienteCache[field] = newValue;
                cache.set(docId, clienteCache);
            }

            // Atualiza o cliente no Firestore
            const clienteRef = db.collection('USERS').doc(docId);
            await clienteRef.update({ [field]: newValue });

            // Obtém o cliente atualizado do Firestore
            const clienteDoc = await clienteRef.get();
            if (clienteDoc.exists) {
                const updatedCliente = clienteDoc.data();

                // Atualiza o cache novamente para garantir que o cache esteja em sincronia
                cache.set(docId, updatedCliente);

                res.status(202).json({ updatedCliente });
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao atualizar o cliente:', error);
            res.status(500).send('Erro ao atualizar o cliente.');
        }
    },

    updateClientMoreThanOneInfo: async (req, res) => {
        const { docId, updates } = req.body;
        if (!docId || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).send('DocId e atualizações são obrigatórios.');
        }

        console.log("SOLICITAÇÃO DE EDITAR DADOS DO CLIENTE");

        try {
            // Construir o objeto de atualização para o Firestore
            const updateFields = {};
            updates.forEach(({ field, fieldNewValue }) => {
                if (field && fieldNewValue !== undefined) {
                    updateFields[field] = fieldNewValue;
                }
            });

            // Atualiza o cliente no Firestore
            const clienteRef = db.collection('USERS').doc(docId);
            await clienteRef.update(updateFields);

            // Obtém o cliente atualizado do Firestore
            const clienteDoc = await clienteRef.get();
            if (clienteDoc.exists) {
                const updatedCliente = clienteDoc.data();

                // Atualiza o cache e aguarda a conclusão
                await adminController.loadClientsToCache();

                res.status(200).json({ updatedCliente });
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao atualizar o cliente:', error);
            res.status(500).send('Erro ao atualizar o cliente.');
        }
    },



    updateContrato: async (req, res) => {
        const { docId, IDCONTRATO, fieldName, fieldNewValue } = req.body;
        if (!docId || !IDCONTRATO || !fieldName || fieldNewValue === undefined) {
            return res.status(400).send('DocId, IDCONTRATO, fieldName e fieldNewValue são obrigatórios.');
        }

        try {
            // Obtém o cliente do cache
            let clienteCache = cache.get(docId);
            if (clienteCache) {
                const contratos = clienteCache.CONTRATOS || [];
                const contratoIndex = contratos.findIndex(contrato => contrato.IDCOMPRA === IDCONTRATO);

                if (contratoIndex !== -1) {
                    contratos[contratoIndex][fieldName] = fieldNewValue;
                    clienteCache.CONTRATOS = contratos;
                    cache.set(docId, clienteCache);
                } else {
                    return res.status(404).send('Contrato não encontrado no cache.');
                }
            }

            // Atualiza o contrato no Firestore
            const clienteRef = db.collection('USERS').doc(docId);
            const clienteDoc = await clienteRef.get();
            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const contratos = clienteData.CONTRATOS || [];
                const contratoIndex = contratos.findIndex(contrato => contrato.IDCOMPRA === IDCONTRATO);

                if (contratoIndex !== -1) {
                    contratos[contratoIndex][fieldName] = fieldNewValue;
                    await clienteRef.update({ CONTRATOS: contratos });

                    clienteData.CONTRATOS = contratos;
                    await adminController.loadClientsToCache();
                    res.status(200).json({ clienteData });
                } else {
                    res.status(404).send('Contrato não encontrado no Firestore.');
                }
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao atualizar o contrato:', error);
            res.status(500).send('Erro ao atualizar o contrato.');
        }
    },

    updateContratoComIndicacao: async (req, res) => {
        const { docId, IDCONTRATO, fieldName, fieldNewValue } = req.body;
    
        if (!docId || !IDCONTRATO || !fieldName || fieldNewValue === undefined) {
            return res.status(400).send('DocId, IDCONTRATO, fieldName e fieldNewValue são obrigatórios.');
        }
    
        try {
            // Atualiza o contrato no Firestore
            const clienteRef = db.collection('USERS').doc(docId);
            const clienteDoc = await clienteRef.get();
            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const contratos = clienteData.CONTRATOS || [];
                const contratoIndex = contratos.findIndex(contrato => contrato.IDCOMPRA === IDCONTRATO);
    
                if (contratoIndex !== -1) {
                    contratos[contratoIndex][fieldName] = fieldNewValue;
                    const SAQUE_DE_INDICACAO = clienteData.SAQUE_DE_INDICACAO || 0;
    
                    // Atualiza o valor de SAQUE_DE_INDICACAO com o valor de TOTALSPENT do contrato
                    const novoSaqueDeIndicacao = SAQUE_DE_INDICACAO + parseFloat(contratos[contratoIndex]["TOTALSPENT"]);
    
                    // Atualiza o documento no Firestore
                    await clienteRef.update({ SAQUE_DE_INDICACAO: novoSaqueDeIndicacao, CONTRATOS: contratos });
    
                    // Carrega os clientes atualizados no cache
                    await adminController.loadClientsToCache();
    
                    // Obtém o cliente atualizado do Firestore
                    const clienteDocAtualizado = await clienteRef.get();
                    const clienteDataAtualizado = clienteDocAtualizado.data();
    
                    // Retorna os dados atualizados
                    res.status(200).json({ clienteData: clienteDataAtualizado });
                } else {
                    res.status(404).send('Contrato não encontrado no Firestore.');
                }
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao atualizar o contrato:', error);
            res.status(500).send('Erro ao atualizar o contrato.');
        }
    },


    updateSaque: async (req, res) => {
        const { docId, DATASOLICITACAO, fieldName, fieldNewValue } = req.body;
        if (!docId || !DATASOLICITACAO || !fieldName || fieldNewValue === undefined) {
            return res.status(400).send('DocId, DATASOLICITACAO do saque, fieldName e fieldNewValue são obrigatórios.');
        }

        try {
            // Obtém o cliente do cache
            let clienteCache = cache.get(docId);
            if (clienteCache) {
                const saques = clienteCache.SAQUES || [];
                const saqueIndex = saques.findIndex(saque => saque.DATASOLICITACAO === DATASOLICITACAO);

                if (saqueIndex !== -1) {
                    saques[saqueIndex][fieldName] = fieldNewValue;
                    clienteCache.SAQUES = saques;
                    cache.set(docId, clienteCache);
                } else {
                    return res.status(404).send('Saque não encontrado no cache.');
                }
            }

            // Atualiza o saque no Firestore
            const clienteRef = db.collection('USERS').doc(docId);
            const clienteDoc = await clienteRef.get();
            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const saques = clienteData.SAQUES || [];
                const saqueIndex = saques.findIndex(saque => saque.DATASOLICITACAO === DATASOLICITACAO);

                if (saqueIndex !== -1) {
                    saques[saqueIndex][fieldName] = fieldNewValue;
                    await clienteRef.update({ SAQUES: saques });
                    clienteData.SAQUES = saques;
                    await adminController.loadClientsToCache();

                    res.status(200).json({ status: 200, clienteData: clienteData, saque: { ...saques[saqueIndex], CLIENT_NAME: clienteData.NAME, CLIENT_CPF: clienteData.CPF, USERNAME: clienteData.USERNAME } });
                } else {
                    res.status(404).send('Saque não encontrado no Firestore.');
                }
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao atualizar o saque:', error);
            res.status(500).send('Erro ao atualizar o saque.');
        }
    },


    createCliente: async (req, res) => {
        const clientData = req.body;

        if (!clientData.CPF) {
            return res.status(400).send('O CPF é obrigatório.');
        }

        if (!clientData.PASSWORD) {
            return res.status(400).send('A senha é obrigatória.');
        }

        try {
            const displayNamesDoc = await db.collection('DisplayNames').doc(clientData.USERNAME).get();

            if (displayNamesDoc.exists) {
                return res.status(400).json({ error: `Usuário ${clientData.USERNAME} já existe.` });
            }

            const userCredential = await auth.createUser({
                email: clientData.EMAIL,
                password: clientData.PASSWORD
            });

            await db.collection('DisplayNames').doc(clientData.USERNAME).set({
                EMAIL: clientData.EMAIL,
                CPF: clientData.CPF
            });

            await db.collection('USERS').doc(clientData.CPF).set(clientData);

            // Adiciona o cliente ao cache
            cache.set(clientData.CPF, clientData);
            await adminController.loadClientsToCache();

            return res.status(201).json({ message: 'Usuário criado com sucesso!', uid: userCredential.uid });
        } catch (error) {
            console.error("Erro ao criar cliente:", error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },


    createClienteIndicacao: async (req, res) => {
        const { clientData } = req.body;

        if (!clientData.CPF) {
            
            return res.status(400).json({ error: 'O CPF é obrigatório.' });
        }

        if (!clientData.PASSWORD) {
            return res.status(400).send({ error: 'A senha é obrigatória.' });
        }

        try {
            if (clientData.INDICADOR) {
                const decryptedIndicator = decrypt(clientData.INDICADOR);
                console.log('data recebida');
                console.log(clientData)
                // Verifica se o usuário já existe
                const existingDoc = await db.collection('USERS').doc(clientData.CPF).get();
                if (existingDoc.exists) {
                    return res.status(400).json({ error: 'Usuário com este CPF já existe.' });
                }

                const displayNamesDoc = await db.collection('DisplayNames').doc(clientData.USERNAME).get();
                if (displayNamesDoc.exists) {
                    return res.status(400).json({ error: `Usuário ${clientData.USERNAME} já existe.` });
                }

                // Cria o usuário no Firebase Authentication
                await auth.createUser({
                    email: clientData.EMAIL,
                    password: clientData.PASSWORD
                });

                // Adiciona o nome de usuário no Firestore
                await db.collection('DisplayNames').doc(clientData.USERNAME).set({
                    EMAIL: clientData.EMAIL,
                    CPF: clientData.CPF
                });

                // Atualiza o cliente com o INDICADOR descriptografado
                const updatedClientData = {
                    ...clientData,
                    INDICADOR: decryptedIndicator
                };

                // Cria o cliente no Firestore
                await db.collection('USERS').doc(clientData.CPF).set(updatedClientData);

                // Atualiza o indicador com o novo cliente
                await db.collection('USERS').doc(decryptedIndicator).set({
                    INDICADOS: FieldValue.arrayUnion({
                        NAME: clientData.NAME,
                        CPF: clientData.CPF
                    })
                }, { merge: true });


                await adminController.loadClientsToCache();

                return res.status(200).send("Usuário criado com sucesso");
            }

            return res.status(400).send("Não encontrado");
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            return res.status(500).send('Erro ao criar cliente.');
        }
    },



    criptografarString: async (req, res) => {
        const string = req.body.string;

        if (!string)
            return res.status(404).json({ INDICADOR: "String Obrigatória" })


        return res.status(202).json({ INDICADOR: encrypt(string) })

    },



    createContrato: async (req, res) => {
        const { USERNAME, CPF, contratoData } = req.body;

        if (!USERNAME || !CPF || !contratoData) {
            return res.status(400).send('USERNAME, CPF e contratoData são obrigatórios.');
        }

        try {
            const clienteRef = db.collection('USERS').doc(CPF);
            const clienteDoc = await clienteRef.get();

            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const contratos = clienteData.CONTRATOS || [];

                const newContrato = {
                    ...contratoData,
                    PURCHASEDATE: moment().format('YYYY-MM-DD HH:mm:ss'),
                    YIELDTERM: moment().add(3, 'years').format('YYYY-MM-DD')
                };
                contratos.push(newContrato);

                // Atualiza o cliente no Firestore
                await clienteRef.update({ CONTRATOS: contratos });

                // Atualiza o cliente no cache
                clienteData.CONTRATOS = contratos;
                cache.set(CPF, clienteData);
                await adminController.loadClientsToCache();

                res.status(201).send('SOLICITAÇÃO DE COMPRA FEITA COM SUCESSO, FAÇA O PAGAMENTO E AGUARDE A CONFIRMAÇÃO.');
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao criar o contrato:', error);
            res.status(500).send('Erro ao criar o contrato.');
        }
    },


    createSaque: async (req, res) => {
        const { USERNAME, CPF, saqueData } = req.body;
        if (!CPF || !saqueData || !USERNAME) {
            return res.status(400).send('CPF, saqueData, USERNAME são obrigatórios.');
        }

        try {
            const clienteRef = db.collection('USERS').doc(CPF);
            const clienteDoc = await clienteRef.get();

            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const saques = clienteData.SAQUES || [];

                const newSaque = {
                    ...saqueData,
                    DATASOLICITACAO: moment().format('YYYY-MM-DD HH:mm:ss')
                };
                saques.push(newSaque);

                // Atualiza o cliente no Firestore
                await clienteRef.update({ SAQUES: saques });

                // Atualiza o cliente no cache
                clienteData.SAQUES = saques;
                cache.set(CPF, clienteData);

                const returnSaque = {
                    ...newSaque,
                    "CLIENT_NAME": clienteData.NAME,
                    "CLIENT_CPF": clienteData.CPF,
                    "USERNAME": clienteData.USERNAME
                }
                await adminController.loadClientsToCache();
                res.status(201).json({ resposta: returnSaque, status: 201 });
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao criar o saque:', error);
            res.status(500).send('Erro ao criar o saque.');
        }
    },


    getAllNews: async (req, res) => {
        try {

            const newsSnapshot = await db.collection('NEWS').get();
            const newsArray = [];

            newsSnapshot.forEach(doc => {
                newsArray.push({ id: doc.id, ...doc.data() });
            });

            res.status(200).json(newsArray);
        } catch (error) {
            console.error('Erro ao buscar as notícias:', error);
            res.status(500).send('Erro ao buscar as notícias.');
        }
    },

    adicionarSaldoAoIndicador: async (req, res) => {
        const { CPF_INDICADOR, CPF_INDICADO, NAME_INDICADO, VALOR_INTEIRO } = req.body;

        if (!CPF_INDICADOR || !CPF_INDICADO || !NAME_INDICADO || VALOR_INTEIRO === undefined) {
            return res.status(400).send('CPF_INDICADOR, CPF_INDICADO, NAME_INDICADO e VALOR_INTEIRO são obrigatórios.');
        }

        try {
            // Adiciona saldo ao indicador
            const indicadorRef = db.collection('USERS').doc(CPF_INDICADOR);
            const indicadorDoc = await indicadorRef.get();

            if (!indicadorDoc.exists) {
                return res.status(404).send('Indicador não encontrado no Firestore.');
            }

            const timestamp = getCurrentTimestamp();
            const indicacaoArray = indicadorDoc.data().INDICACAO || [];
            indicacaoArray.push({
                VALOR: VALOR_INTEIRO * 0.1,
                NAME: NAME_INDICADO,
                CPF: CPF_INDICADO,
                TIMESTAMP: timestamp
            });

            // Atualiza o indicador no Firestore
            await indicadorRef.update({ INDICACAO: indicacaoArray });

            // Atualiza o indicador no cache
            const updatedIndicadorData = { ...indicadorDoc.data(), INDICACAO: indicacaoArray };
            cache.set(CPF_INDICADOR, updatedIndicadorData);

            console.log("Saldo adicionado ao indicador");

            // Remove o indicador do indicado
            const indicadoRef = db.collection('USERS').doc(CPF_INDICADO);
            const indicadoDoc = await indicadoRef.get();

            if (!indicadoDoc.exists) {
                return res.status(404).send('Indicado não encontrado no Firestore.');
            }

            await indicadoRef.update({ INDICADOR: null });

            // Atualiza o indicado no cache
            const updatedIndicadoData = { ...indicadoDoc.data(), INDICADOR: null };
            cache.set(CPF_INDICADO, updatedIndicadoData);

            console.log("Indicador removido do indicado");

            res.send('Saldo adicionado ao indicador e indicador removido do indicado com sucesso.');
        } catch (error) {
            console.error('Erro ao adicionar saldo ao indicador:', error);
            res.status(500).send('Erro ao adicionar saldo ao indicador.');
        }
    },



}

module.exports = clientController;