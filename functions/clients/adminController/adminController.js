const { db, auth } = require("../../database/firebaseAdmin");
const { processClientData } = require('../helpers/clientHelpers')
const cache = require('../../database/cache')

const adminController = {

    loadClientsToCache: async () => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();
            const clients = {};

            clientsSnapshot.forEach(doc => {
                clients[doc.id] = doc.data();
            });

            // Armazenar todos os clientes no cache
            await cache.mset(Object.entries(clients).map(([key, value]) => ({
                key,
                val: value
            })));

            console.log('Todos os clientes foram carregados no cache com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar clientes no cache:', error);
        }
    },

    getClients: async (request, response) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();
            if (clientsSnapshot.empty) {
                return response.status(404).json({ error: "Nenhum cliente encontrado" });
            }
            const clients = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return response.status(200).json(clients);
        } catch (error) {
            console.error("Erro ao obter clientes:", error);
            return response.status(500).json({ error: 'Internal Server Error' });
        }
    },

    getClientsPaginated: async (request, response) => {
        try {
            const PAGE_SIZE = 10; 
            const lastDocId = request.query.lastDoc; 
            
            let query = db.collection('USERS').orderBy('NAME').limit(PAGE_SIZE);
    
            if (lastDocId) {
                const lastDocSnapshot = await db.collection('USERS').doc(lastDocId).get();
                if (!lastDocSnapshot.exists) {
                    return response.status(400).json({ error: "Documento não encontrado" });
                }
                query = query.startAfter(lastDocSnapshot);
            }
    
            const clientsSnapshot = await query.get();
            if (clientsSnapshot.empty) {
                return response.status(404).json({ error: "Nenhum cliente encontrado" });
            }
    
            const clients = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const processedClients = clients.map(client => processClientData(client));
    
            const nextLastDoc = clientsSnapshot.docs[clientsSnapshot.docs.length - 1];
    
            return response.status(200).json({
                clients: processedClients,
                nextLastDoc: nextLastDoc ? nextLastDoc.id : null
            });
        } catch (error) {
            console.error("Erro ao obter clientes:", error);
            return response.status(500).json({ error: 'Internal Server Error' });
        }
    },
    

    obterDepositos: async (req, res) => {
        try {
            // Obtém todos os clientes da coleção USERS
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            // Mapeia os clientes para obter os contratos de forma assíncrona
            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Função para processar contratos de um cliente
            const processarContratos = (cliente) => {
                if (!cliente.CONTRATOS || cliente.CONTRATOS.length === 0) return [];

                return cliente.CONTRATOS.map(contrato => ({
                    ...contrato,
                    CLIENT_NAME: cliente.NAME,
                    CLIENT_CPF: cliente.CPF,
                    INDICADOR: cliente.INDICADOR || null
                }));
            };

            // Processa contratos para todos os clientes em paralelo
            const todosContratos = (await Promise.all(clientes.map(cliente => processarContratos(cliente)))).flat();

            res.json(todosContratos);
        } catch (error) {
            console.error('Erro ao obter os depósitos:', error);
            res.status(500).send('Erro ao obter os depósitos.');
        }
    },


    obterDeposito: async (req, res) => {
        const { userId, contratoId } = req.body;

        if (!userId) return res.status(400).send('O userId é obrigatório.');

        try {
            const clientDoc = await db.collection('USERS').doc(userId).get();

            if (!clientDoc.exists) {
                return response.status(404).json({ error: "Cliente não encontrado" })
            }

            const cliente = processClientData(clientDoc.data());

            if (cliente) {
                if (Array.isArray(cliente.CONTRATOS)) {
                    const contratoUpdated = cliente.CONTRATOS.find(c => c.IDCOMPRA === contratoId);

                    if (contratoUpdated) {
                        res.json(contratoUpdated);
                    } else {
                        res.status(404).send('Contrato não encontrado');
                    }
                } else {
                    res.status(400).send('Contratos não encontrados para o cliente');
                }
            } else {
                res.status(404).send('Cliente não encontrado');
            }
        } catch (error) {
            console.error('Erro ao buscar o cliente:', error);
            res.status(500).send('Erro ao buscar o cliente.');
        }
    },


    getAllClientesWithPlusInfo: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }
            const clients = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            const clientsWithPlusInfo = clients.map(cliente => processClientData(cliente));
            return res.status(200).json(clientsWithPlusInfo);
        } catch (error) {
            console.error("Erro ao obter clientes com informações adicionais:", error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    obterSaques: async (req, res) => {
        try {

            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cria um array para armazenar todos os saques
            let todosSaques = [];

            // Itera sobre todos os clientes para adicionar seus saques ao array
            clientes.forEach(cliente => {
                if (cliente.SAQUES && cliente.SAQUES.length > 0) {
                    const saques = cliente.SAQUES.map(saque => ({
                        ...saque,
                        CLIENT_NAME: cliente.NAME,  // Adiciona o nome do cliente a cada saque
                        CLIENT_CPF: cliente.CPF,    // Adiciona o CPF do cliente a cada saque
                        CLIENT_USERNAME: cliente.USERNAME
                    }));

                    // Adiciona os saques ao array de todos os saques
                    todosSaques = todosSaques.concat(saques);
                }
            });

            // Retorna todos os saques
            res.json(todosSaques);
        } catch (error) {
            console.error('Erro ao obter os saques:', error);
            res.status(500).send('Erro ao obter os saques.');
        }
    },

    obterSaquesPendentes: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();
    
            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }
    
            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
    
            let todosSaques = [];
    
            clientes.forEach(cliente => {
                if (cliente.SAQUES && cliente.SAQUES.length > 0) {
                    const saques = cliente.SAQUES
                        .filter(saque => saque.STATUS === 1)
                        .map(saque => ({
                            ...saque,
                            CLIENT_NAME: cliente.NAME,  // Adiciona o nome do cliente a cada saque
                            CLIENT_CPF: cliente.CPF,    // Adiciona o CPF do cliente a cada saque
                            CLIENT_USERNAME: cliente.USERNAME
                        }));
    
                    todosSaques = todosSaques.concat(saques);
                }
            });
    
            // Retorna todos os saques pendentes (STATUS === 1)
            res.json(todosSaques);
        } catch (error) {
            console.error('Erro ao obter os saques:', error);
            res.status(500).send('Erro ao obter os saques.');
        }
    },
    


    getAdminData: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();
            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }
            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            let totalCoinsPlataforma = 0;
            clientes.forEach(cliente => {
                if (cliente.CONTRATOS) {
                    cliente.CONTRATOS.forEach(contrato => {
                        if (contrato.STATUS === 1 && contrato.COINS) {
                            totalCoinsPlataforma += parseFloat(contrato.COINS) || 0;
                        }
                    });
                }
            });
            let totalSaldoPlataforma = 0;
            clientes.forEach(cliente => {
                if (cliente.CONTRATOS) {
                    cliente.CONTRATOS.forEach(contrato => {
                        if (contrato.STATUS === 1) {
                            const totalSpent = parseFloat(contrato.TOTALSPENT) || 0;
                            const rendimentoAtual = parseFloat(contrato.RENDIMENTO_ATUAL) || 0;
                            const rendimento = (rendimentoAtual / 100) * totalSpent;
                            totalSaldoPlataforma += totalSpent + rendimento;
                        }
                    });
                }
            });
            let totalDeGanhosPlataforma = 0;
            clientes.forEach(cliente => {
                if (cliente.CONTRATOS) {
                    cliente.CONTRATOS.forEach(contrato => {
                        if (contrato.STATUS === 1 || contrato.STATUS === 2) {

                            const totalSpent = parseFloat(contrato.TOTALSPENT) || 0;
                            const rendimentoAtual = parseFloat(contrato.RENDIMENTO_ATUAL) || 0;
                            const rendimento = (rendimentoAtual / 100) * totalSpent;
                            totalDeGanhosPlataforma += rendimento;
                        }
                    });
                }
            });
            let totalDeValoresDeSaquesFeitos = 0;
            clientes.forEach(cliente => {
                if (cliente.SAQUES) {
                    cliente.SAQUES.forEach(saque => {
                        if (saque.STATUS === 2 && saque.VALORSOLICITADO) {
                            totalDeValoresDeSaquesFeitos += parseFloat(saque.VALORSOLICITADO) || 0;
                        }
                    });
                }
            });

            const saldoFinal = totalSaldoPlataforma - totalDeValoresDeSaquesFeitos;
            const totalInvestimentos = totalSaldoPlataforma;
            totalSaldoPlataforma = saldoFinal;

            res.json({
                totalCoinsPlataforma,
                totalSaldoPlataforma,
                totalDeValoresDeSaquesFeitos,
                totalInvestimentos,
                totalDeGanhosPlataforma
            });
        } catch (error) {
            console.error('Erro ao obter dados administrativos:', error);
            res.status(500).send('Erro ao obter dados administrativos.');
        }
    },


    normalizeStateName: (stateName) => {
        // Normaliza a string e transforma em maiúsculas
        return stateName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
    },



    getQttClientsByState: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const statesCount = {
                'AC': 0, 'AL': 0, 'AP': 0, 'AM': 0, 'BA': 0, 'CE': 0, 'DF': 0, 'ES': 0, 'GO': 0, 'MA': 0,
                'MG': 0, 'MS': 0, 'MT': 0, 'PA': 0, 'PB': 0, 'PE': 0, 'PI': 0, 'PR': 0, 'RJ': 0, 'RN': 0,
                'RO': 0, 'RR': 0, 'RS': 0, 'SC': 0, 'SE': 0, 'SP': 0, 'TO': 0
            };

            clientes.forEach(cliente => {
                if (cliente.STATE) {
                    // Normaliza o estado do cliente
                    const normalizedState = adminController.normalizeStateName(cliente.STATE);

                    // Verifica se o estado normalizado corresponde a uma sigla válida
                    if (statesCount.hasOwnProperty(normalizedState)) {
                        statesCount[normalizedState] += 1;
                    }
                }
            });

            // Retorna o objeto com a contagem de clientes por estado
            res.json(statesCount);
        } catch (error) {
            console.error('Erro ao obter a quantidade de clientes por estado:', error);
            res.status(500).send('Erro ao obter a quantidade de clientes por estado.');
        }
    },

    obterDatasDeCadastro: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cria um array para armazenar as datas de criação
            const datasDeCadastro = clientes.map(cliente => cliente.DATACRIACAO);

            // Retorna o array de datas de criação
            res.json(datasDeCadastro);
        } catch (error) {
            console.error('Erro ao obter datas de criação dos clientes:', error);
            res.status(500).send('Erro ao obter datas de criação dos clientes.');
        }
    },

    getMelhoresClientes: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const allClientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cria um array para armazenar os contratos filtrados
            const melhoresClientes = [];

            // Itera sobre todos os clientes
            allClientes.forEach(cliente => {
                if (cliente.CONTRATOS) {
                    // Filtra contratos com STATUS igual a 1 ou 2
                    const contratosFiltrados = cliente.CONTRATOS.filter(contrato =>
                        contrato.STATUS === 1 || contrato.STATUS === 2
                    );

                    // Mapeia os contratos para obter apenas PURCHASEDATE e TOTALSPENT
                    const contratosMapeados = contratosFiltrados.map(contrato => ({
                        PURCHASEDATE: contrato.PURCHASEDATE,
                        TOTALSPENT: contrato.TOTALSPENT
                    }));

                    // Adiciona os contratos mapeados ao array melhoresClientes
                    melhoresClientes.push(...contratosMapeados);
                }
            });

            // Retorna o array de contratos filtrados
            res.json(melhoresClientes);
        } catch (error) {
            console.error('Erro ao obter melhores clientes:', error);
            res.status(500).send('Erro ao obter melhores clientes.');
        }
    },


    getTopInvestors: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const allClientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const clientesInvestimentos = allClientes.map(cliente => {
                let totalInvestido = 0;

                if (cliente.CONTRATOS) {
                    // Soma o TOTALSPENT de contratos com STATUS 1 ou 2
                    totalInvestido = cliente.CONTRATOS.reduce((total, contrato) => {
                        if (contrato.STATUS === 1 || contrato.STATUS === 2) {
                            return total + parseFloat(contrato.TOTALSPENT || 0);
                        }
                        return total;
                    }, 0);
                }

                return { cliente, totalInvestido };
            });

            // Ordena os clientes pelo total investido em ordem decrescente
            clientesInvestimentos.sort((a, b) => b.totalInvestido - a.totalInvestido);

            // Pega os 20 primeiros clientes
            const topInvestors = clientesInvestimentos.slice(0, 20);

            // Mapeia os dados para incluir apenas as informações relevantes
            const topInvestorsData = topInvestors.map(({ cliente, totalInvestido }) => ({
                name: cliente.NAME,
                cpf: cliente.CPF,
                totalInvestido
            }));

            // Retorna os dados dos 20 clientes que mais investiram
            res.json(topInvestorsData);
        } catch (error) {
            console.error('Erro ao obter os principais investidores:', error);
            res.status(500).send('Erro ao obter os principais investidores.');
        }
    },

    //clientes sem contratos
    clientsThatDidNotBought: async (req, res) => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const allClientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            const clientesSemCompras = allClientes.filter(cliente => !cliente.CONTRATOS || cliente.CONTRATOS.length === 0);
            res.json(clientesSemCompras);
        } catch (error) {
            console.error('Erro ao obter clientes sem compras:', error);
            res.status(500).send('Erro ao obter clientes sem compras.');
        }
    },

    createContratoAdmin: async (req, res) => {
        const { docId, contratoData } = req.body;

        // Verifica se todos os parâmetros necessários estão presentes
        if (!docId || !contratoData) {
            return res.status(400).send('docId e contratoData são obrigatórios.');
        }
        console.log('Recebido:', { docId, contratoData });

        try {

            const clienteRef = db.collection('USERS').doc(docId);
            const clienteDoc = await clienteRef.get();

            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const contratos = clienteData.CONTRATOS || [];

                // Adiciona o novo contrato ao array de contratos
                const newContrato = {
                    ...contratoData,
                    PURCHASEDATE: moment().format('YYYY-MM-DD HH:mm:ss'),
                    YIELDTERM: moment().add(3, 'years').format('YYYY-MM-DD')
                };
                contratos.push(newContrato);
                await clienteRef.update({ CONTRATOS: contratos });
                clienteData.CONTRATOS = contratos;

                res.status(201).send('SOLICITAÇÃO DE COMPRA FEITA COM SUCESSO, FAÇA O PAGAMENTO E AGUARDE A CONFIRMAÇÃO.');
            } else {
                console.error('Erro ao criar o contrato:', error.message);

                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao criar o contrato:', error);
            res.status(500).send('Erro ao criar o contrato.');
        }
    },

    updateClienteValidacao: async (req, res) => {
        const { docId, DOCSENVIADOS, DOCSVERIFICADOS } = req.body;

        if (docId == null || DOCSENVIADOS == null || DOCSVERIFICADOS == null) {
            return res.status(400).send('DocId, DOCSENVIADOS e DOCSVERIFICADOS são obrigatórios.');
        }

        try {
            const clienteRef = db.collection('USERS').doc(docId);
            await clienteRef.update({ DOCSENVIADOS, DOCSVERIFICADOS });

            const clienteDoc = await clienteRef.get();
            if (clienteDoc.exists) {
                res.status(200).send('Cliente atualizado com sucesso.');
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao atualizar o cliente:', error);
            res.status(500).send('Erro ao atualizar o cliente.');
        }
    },

    createSaqueAdmin: async (req, res) => {
        const { docId, saqueData } = req.body;
        if (!docId || !saqueData) {
            return res.status(400).send('DocId e saqueData são obrigatórios.');
        }

        try {

            const clienteRef = db.collection('USERS').doc(docId);
            const clienteDoc = await clienteRef.get();

            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const saques = clienteData.SAQUES || [];

                const newSaque = {
                    ...saqueData,
                    DATASOLICITACAO: moment().format('YYYY-MM-DD HH:mm:ss')
                };

                saques.push(newSaque);

                await clienteRef.update({ SAQUES: saques });

                clienteData.SAQUES = saques;

                res.status(201).send('Saque criado com sucesso.');
            } else {
                res.status(404).send('Cliente não encontrado no Firestore.');
            }
        } catch (error) {
            console.error('Erro ao criar o saque:', error);
            res.status(500).send('Erro ao criar o saque.');
        }
    },

    atualizarTodosContratosAtivos: async (req, res) => {
        try {
            const usersSnapshot = await db.collection('USERS').get();

            if (usersSnapshot.empty) {
                return res.status(200).send('Nenhum usuário encontrado.');
            }

            let totalUpdated = 0;
            const failedUpdates = [];

            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();

                if (userData.CONTRATOS && userData.CONTRATOS.length > 0) {
                    let updateNeeded = false;

                    userData.CONTRATOS.forEach((contrato) => {
                        if (contrato.STATUS === 1 && contrato.MAXIMUMQUOTAYIELD) {
                            const maxQuotaYield = parseFloat(contrato.MAXIMUMQUOTAYIELD);
                            const rendimentoAtual = parseFloat(contrato.RENDIMENTO_ATUAL);

                            if (rendimentoAtual < maxQuotaYield) {
                                const yieldPerDay = maxQuotaYield / (36 * 30);
                                const rendimentoNovo = rendimentoAtual + yieldPerDay;
                                contrato.RENDIMENTO_ATUAL = rendimentoNovo;
                                updateNeeded = true;

                                // Imprime a mensagem de atualização para cada contrato
                                console.log(`Contrato ${contrato.IDCOMPRA} do usuário ${userData.CPF} atualizado: Rendimento atual de ${rendimentoAtual.toFixed(2)} para ${rendimentoNovo.toFixed(2)}`);
                            }
                        }
                    });


                    if (updateNeeded) {
                        try {
                            await db.collection('USERS').doc(userDoc.id).update({ CONTRATOS: userData.CONTRATOS });
                            totalUpdated++;
                        } catch (updateError) {
                            userData.CONTRATOS.forEach((contrato) => {
                                if (contrato.STATUS === 1) {
                                    failedUpdates.push({
                                        NAME: userData.NAME,
                                        CPF: userData.CPF,
                                        IDCOMPRA: contrato.IDCOMPRA
                                    });
                                }
                            });
                        }
                    }
                }
            }

            const now = new Date();
            const timestamp = now.toISOString();


            await db.collection('SYSTEM_VARIABLES').doc('RENDIMENTOS').set({
                ULTIMO_RENDIMENTO: timestamp,
                FAILED: (failedUpdates.length > 0) ? failedUpdates : null
            }, { merge: true });

            if (failedUpdates.length > 0) {
                return res.status(200).json({
                    message: `Contratos atualizados com sucesso. Total de documentos atualizados: ${totalUpdated}`,
                    failedUpdates
                });
            } else {
                return res.status(200).send(`Contratos atualizados com sucesso. Total de documentos atualizados: ${totalUpdated}`);
            }
        } catch (error) {
            console.error('Erro ao atualizar contratos ativos dos usuários:', error);
            return res.status(500).send('Erro ao atualizar contratos.');
        }
    },

}

module.exports = adminController;
