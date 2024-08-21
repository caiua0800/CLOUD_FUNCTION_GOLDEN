const { db, auth } = require("../../database/firebaseAdmin");
const { processClientData } = require('../helpers/clientHelpers')
const cache = require('../../database/cache')
const moment = require('moment');
const { initializeApp } = require("firebase-admin");
const archiver = require('archiver');

const adminController = {

    loadClientsToCache: async () => {
        try {
            const clientsSnapshot = await db.collection('USERS').get();
            const clients = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            await cache.set('clients', clients);

            console.log('Todos os clientes foram atualizados no cache com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar clientes no cache:', error);
        }
    },

    getClients: async (req, res) => {
        try {
            // Recupera todos os clientes do cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                return res.status(200).json(cachedClients);
            }

            // Se não estiver no cache, busca no Firebase e atualiza o cache
            const clientsSnapshot = await db.collection('USERS').get();
            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }
            const clients = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Atualiza o cache com os clientes
            await cache.set('clients', clients);

            return res.status(200).json(clients);
        } catch (error) {
            console.error("Erro ao obter clientes:", error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    convertToCSV: (data, fields) => {
        // Gera cabeçalho CSV
        const header = fields.join(',') + '\n';
        const rows = data.map(row => fields.map(field => row[field]).join(',')).join('\n');
        return header + rows;
    },
    



    getExtractDatabase: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
    
            // Verifique se há clientes no cache
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).send('Nenhum cliente encontrado no cache.');
            }
    
            // Criar um arquivo ZIP na memória
            const zipFileName = 'clientes_data.zip';
            const archive = archiver('zip', { zlib: { level: 9 } });
    
            res.attachment(zipFileName); // Define o nome do arquivo para download
            archive.pipe(res); // Faz o pipe do conteúdo diretamente na resposta
    
            // Cria a tabela de CLIENTES
            const clientsFields = ['ID', 'NOME', 'EMAIL', 'CELULAR', 'ENDERECO', 'CIDADE', 'ESTADO', 'PAIS'];
            const clientsData = cachedClients.map(client => ({
                ID: client.CPF,
                NOME: client.NAME,
                EMAIL: client.EMAIL,
                CELULAR: client.CONTACT,
                ENDERECO: client.ADRESS,
                CIDADE: client.CITY,
                ESTADO: client.STATE,
                PAIS: client.COUNTRY,
            }));
    
            const clientsCsv = convertToCSV(clientsData, clientsFields);
            archive.append(clientsCsv, { name: 'clientes.csv' });
    
            // Cria a tabela de SAQUES
            const saquesFields = ['CLIENT_ID', 'STATUS', 'DATASOLICITACAO', 'VALORSOLICITADO'];
            const saquesData = cachedClients.flatMap(client => {
                return client.SAQUES ? client.SAQUES.map(saque => ({
                    CLIENT_ID: client.CPF,
                    STATUS: saque.STATUS,
                    DATASOLICITACAO: saque.DATASOLICITACAO,
                    VALORSOLICITADO: saque.VALORSOLICITADO,
                })) : [];
            });
    
            if (saquesData.length > 0) {
                const saquesCsv = convertToCSV(saquesData, saquesFields);
                archive.append(saquesCsv, { name: 'saques.csv' });
            }
    
            // Cria a tabela de INDICAÇÃO
            const indicacaoFields = ['CLIENT_ID', 'NAME', 'CPF'];
            const indicacaoData = cachedClients.flatMap(client => {
                return client.INDICACAO ? client.INDICACAO.map(indicacao => ({
                    CLIENT_ID: client.CPF,
                    NAME: indicacao.NAME,
                    CPF: indicacao.CPF,
                })) : [];
            });
    
            if (indicacaoData.length > 0) {
                const indicacaoCsv = convertToCSV(indicacaoData, indicacaoFields);
                archive.append(indicacaoCsv, { name: 'indicacao.csv' });
            }
    
            // Cria a tabela de CONTRATOS
            const contratosFields = ['CLIENT_ID', 'COINVALUE', 'CURRENTINCOME', 'STATUS', 'PURCHASEDATE', 'IDCOMPRA', 'TOTALSPENT', 'RENDIMENTO_ATUAL'];
            const contratosData = cachedClients.flatMap(client => {
                return client.CONTRATOS ? client.CONTRATOS.map(contrato => ({
                    CLIENT_ID: client.CPF,
                    COINVALUE: contrato.COINVALUE,
                    CURRENTINCOME: contrato.CURRENTINCOME,
                    STATUS: contrato.STATUS,
                    PURCHASEDATE: contrato.PURCHASEDATE,
                    IDCOMPRA: contrato.IDCOMPRA,
                    TOTALSPENT: contrato.TOTALSPENT, // Campo adicionado
                    RENDIMENTO_ATUAL: contrato.RENDIMENTO_ATUAL // Campo adicionado
                })) : [];
            });
    
            if (contratosData.length > 0) {
                const contratosCsv = convertToCSV(contratosData, contratosFields);
                archive.append(contratosCsv, { name: 'contratos.csv' });
            }
    
            await archive.finalize(); // Finaliza o arquivo ZIP e envia
    
        } catch (error) {
            console.error('Erro ao extrair dados do banco:', error);
            return res.status(500).send('Erro ao extrair dados do banco.');
        }
    },


    obterDepositos: async (req, res) => {
        try {
            // Recupera todos os clientes do cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                const todosContratos = cachedClients
                    .filter(cliente => cliente.CONTRATOS && cliente.CONTRATOS.length > 0)
                    .flatMap(cliente => cliente.CONTRATOS.map(contrato => ({
                        ...contrato,
                        CLIENT_NAME: cliente.NAME,
                        CLIENT_CPF: cliente.CPF,
                        INDICADOR: cliente.INDICADOR || null
                    })));

                return res.json(todosContratos);
            }

            // Se não estiver no cache, busca no Firebase e atualiza o cache
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const todosContratos = clientes
                .filter(cliente => cliente.CONTRATOS && cliente.CONTRATOS.length > 0)
                .flatMap(cliente => cliente.CONTRATOS.map(contrato => ({
                    ...contrato,
                    CLIENT_NAME: cliente.NAME,
                    CLIENT_CPF: cliente.CPF,
                    INDICADOR: cliente.INDICADOR || null
                })));

            // Atualiza o cache com os clientes
            await cache.set('clients', clientes);

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
            // Recupera todos os clientes do cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                const cliente = cachedClients.find(c => c.id === userId);

                if (cliente) {
                    const contratoUpdated = cliente.CONTRATOS?.find(c => c.IDCOMPRA === contratoId);

                    if (contratoUpdated) {
                        res.json(contratoUpdated);
                    } else {
                        res.status(404).send('Contrato não encontrado');
                    }
                } else {
                    res.status(404).send('Cliente não encontrado');
                }
            } else {
                // Se não estiver no cache, busca no Firebase e atualiza o cache
                const clientDoc = await db.collection('USERS').doc(userId).get();

                if (!clientDoc.exists) {
                    return res.status(404).json({ error: "Cliente não encontrado" });
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
            }
        } catch (error) {
            console.error('Erro ao buscar o cliente:', error);
            res.status(500).send('Erro ao buscar o cliente.');
        }
    },

    getAllClientesWithPlusInfo: async (req, res) => {
        try {
            // Recupera todos os clientes do cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                // Usa a função xizinho para processar cada cliente do cache
                const clientesComInfo = await Promise.all(
                    cachedClients.map(async (cliente) => {
                        const clienteComInfo = await processClientData(cliente);
                        return {
                            ...clienteComInfo,
                            CLIENT_NAME: clienteComInfo.NAME,
                            CLIENT_CPF: clienteComInfo.CPF,
                            CLIENT_USERNAME: clienteComInfo.USERNAME,
                            INFO_ADICIONAL: clienteComInfo.INFO_ADICIONAL || {}
                        };
                    })
                );

                return res.json(clientesComInfo);
            }

            // Se não estiver no cache, busca no Firebase e atualiza o cache
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Usa a função xizinho para processar cada cliente do Firebase
            const clientesComInfo = await Promise.all(
                clientes.map(async (cliente) => {
                    const clienteComInfo = await processClientData(cliente);
                    return {
                        ...clienteComInfo,
                        CLIENT_NAME: clienteComInfo.NAME,
                        CLIENT_CPF: clienteComInfo.CPF,
                        CLIENT_USERNAME: clienteComInfo.USERNAME,
                        INFO_ADICIONAL: clienteComInfo.INFO_ADICIONAL || {}
                    };
                })
            );

            // Atualiza o cache com os clientes
            await cache.set('clients', clientes);

            return res.json(clientesComInfo);
        } catch (error) {
            console.error('Erro ao obter todos os clientes com informações adicionais:', error);
            res.status(500).send('Erro ao obter todos os clientes com informações adicionais.');
        }
    },

    obterSaques: async (req, res) => {
        try {
            // Recupera todos os clientes do cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                const todosSaques = cachedClients
                    .filter(cliente => cliente.SAQUES && cliente.SAQUES.length > 0)
                    .flatMap(cliente => cliente.SAQUES.map(saque => ({
                        ...saque,
                        CLIENT_NAME: cliente.NAME,
                        CLIENT_CPF: cliente.CPF,
                        CLIENT_USERNAME: cliente.USERNAME,
                        CLIENT_AGENCY: cliente.AGENCY || null,
                        CLIENT_ACCOUNT: cliente.ACCOUNT || null,
                        CLIENT_KEYPIX: cliente.KEYPIX || null,
                        CLIENT_ACCOUNTTYPE: cliente.ACCOUNTTYPE || null
                    })));

                return res.json(todosSaques);
            }

            // Se não estiver no cache, busca no Firebase e atualiza o cache
            const clientsSnapshot = await db.collection('USERS').get();

            if (clientsSnapshot.empty) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientes = clientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const todosSaques = clientes
                .filter(cliente => cliente.SAQUES && cliente.SAQUES.length > 0)
                .flatMap(cliente => cliente.SAQUES.map(saque => ({
                    ...saque,
                    CLIENT_NAME: cliente.NAME,
                    CLIENT_CPF: cliente.CPF,
                    CLIENT_USERNAME: cliente.USERNAME
                })));

            // Atualiza o cache com os clientes
            await cache.set('clients', clientes);

            res.json(todosSaques);
        } catch (error) {
            console.error('Erro ao obter os saques:', error);
            res.status(500).send('Erro ao obter os saques.');
        }
    },

    obterSaquesPendentes: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            let todosSaques = [];

            cachedClients.forEach(cliente => {
                if (cliente.SAQUES && cliente.SAQUES.length > 0) {
                    const saques = cliente.SAQUES
                        .filter(saque => saque.STATUS === 1)
                        .map(saque => ({
                            ...saque,
                            CLIENT_NAME: cliente.NAME,
                            CLIENT_CPF: cliente.CPF,
                            CLIENT_USERNAME: cliente.USERNAME
                        }));

                    todosSaques = todosSaques.concat(saques);
                }
            });

            res.json(todosSaques);
        } catch (error) {
            console.error('Erro ao obter os saques:', error);
            res.status(500).send('Erro ao obter os saques.');
        }
    },



    getAdminData: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            let totalCoinsPlataforma = 0;
            cachedClients.forEach(cliente => {
                if (cliente.CONTRATOS) {
                    cliente.CONTRATOS.forEach(contrato => {
                        if (contrato.STATUS === 1 && contrato.COINS) {
                            totalCoinsPlataforma += parseFloat(contrato.COINS) || 0;
                        }
                    });
                }
            });

            let totalSaldoPlataforma = 0;
            cachedClients.forEach(cliente => {
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

            let totalSaldoGolden = 0;
            cachedClients.forEach(cliente => {
                if (cliente.CONTRATOS) {
                    cliente.CONTRATOS.forEach(contrato => {
                        if (contrato.STATUS === 1) {
                            const totalSpent = parseFloat(contrato.TOTALSPENT) || 0;
                            totalSaldoGolden += totalSpent;
                        }
                    });
                }
            });

            let totalDeGanhosPlataforma = 0;
            cachedClients.forEach(cliente => {
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
            cachedClients.forEach(cliente => {
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
            totalSaldoGolden = totalSaldoGolden - totalDeValoresDeSaquesFeitos;

            res.json({
                totalCoinsPlataforma,
                totalSaldoPlataforma,
                totalDeValoresDeSaquesFeitos,
                totalInvestimentos,
                totalDeGanhosPlataforma,
                totalSaldoGolden
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
            const cachedClients = await cache.get('clients');
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const statesCount = {
                'AC': 0, 'AL': 0, 'AP': 0, 'AM': 0, 'BA': 0, 'CE': 0, 'DF': 0, 'ES': 0, 'GO': 0, 'MA': 0,
                'MG': 0, 'MS': 0, 'MT': 0, 'PA': 0, 'PB': 0, 'PE': 0, 'PI': 0, 'PR': 0, 'RJ': 0, 'RN': 0,
                'RO': 0, 'RR': 0, 'RS': 0, 'SC': 0, 'SE': 0, 'SP': 0, 'TO': 0
            };

            cachedClients.forEach(cliente => {
                if (cliente.STATE) {
                    const normalizedState = adminController.normalizeStateName(cliente.STATE);
                    if (statesCount.hasOwnProperty(normalizedState)) {
                        statesCount[normalizedState] += 1;
                    }
                }
            });

            res.json(statesCount);
        } catch (error) {
            console.error('Erro ao obter a quantidade de clientes por estado:', error);
            res.status(500).send('Erro ao obter a quantidade de clientes por estado.');
        }
    },

    obterDatasDeCadastro: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const datasDeCadastro = cachedClients.map(cliente => cliente.DATACRIACAO);
            res.json(datasDeCadastro);
        } catch (error) {
            console.error('Erro ao obter datas de criação dos clientes:', error);
            res.status(500).send('Erro ao obter datas de criação dos clientes.');
        }
    },

    getMelhoresClientes: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const melhoresClientes = [];

            cachedClients.forEach(cliente => {
                if (cliente.CONTRATOS) {
                    const contratosFiltrados = cliente.CONTRATOS.filter(contrato =>
                        contrato.STATUS === 1 || contrato.STATUS === 2
                    );

                    const contratosMapeados = contratosFiltrados.map(contrato => ({
                        PURCHASEDATE: contrato.PURCHASEDATE,
                        TOTALSPENT: contrato.TOTALSPENT
                    }));

                    melhoresClientes.push(...contratosMapeados);
                }
            });

            res.json(melhoresClientes);
        } catch (error) {
            console.error('Erro ao obter melhores clientes:', error);
            res.status(500).send('Erro ao obter melhores clientes.');
        }
    },


    getTopInvestors: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientesInvestimentos = cachedClients.map(cliente => {
                let totalInvestido = 0;

                if (cliente.CONTRATOS) {
                    totalInvestido = cliente.CONTRATOS.reduce((total, contrato) => {
                        if (contrato.STATUS === 1 || contrato.STATUS === 2) {
                            return total + parseFloat(contrato.TOTALSPENT || 0);
                        }
                        return total;
                    }, 0);
                }

                return { cliente, totalInvestido };
            });

            clientesInvestimentos.sort((a, b) => b.totalInvestido - a.totalInvestido);

            const topInvestors = clientesInvestimentos.slice(0, 20);

            const topInvestorsData = topInvestors.map(({ cliente, totalInvestido }) => ({
                name: cliente.NAME,
                cpf: cliente.CPF,
                totalInvestido
            }));

            res.json(topInvestorsData);
        } catch (error) {
            console.error('Erro ao obter os principais investidores:', error);
            res.status(500).send('Erro ao obter os principais investidores.');
        }
    },

    //clientes sem contratos
    clientsThatDidNotBought: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
            if (!cachedClients || cachedClients.length === 0) {
                return res.status(404).json({ error: "Nenhum cliente encontrado" });
            }

            const clientesSemCompra = cachedClients.filter(cliente => {
                return !(cliente.CONTRATOS && cliente.CONTRATOS.some(contrato => contrato.STATUS === 1 || contrato.STATUS === 2));
            });

            res.json(clientesSemCompra.map(cliente => ({ name: cliente.NAME, cpf: cliente.CPF })));
        } catch (error) {
            console.error('Erro ao obter clientes que não fizeram compras:', error);
            res.status(500).send('Erro ao obter clientes que não fizeram compras.');
        }
    },

    updateClienteValidacao: async (req, res) => {
        const { docId, DOCSENVIADOS, DOCSVERIFICADOS } = req.body;

        if (!docId || DOCSENVIADOS == null || DOCSVERIFICADOS == null) {
            return res.status(400).send('DocId, DOCSENVIADOS e DOCSVERIFICADOS são obrigatórios.');
        }

        try {
            // Obtém os clientes do cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                const clienteIndex = cachedClients.findIndex(cliente => cliente.CPF === docId);

                if (clienteIndex !== -1) {
                    // Atualiza os campos no cache
                    cachedClients[clienteIndex].DOCSENVIADOS = DOCSENVIADOS;
                    cachedClients[clienteIndex].DOCSVERIFICADOS = DOCSVERIFICADOS;

                    // Atualiza o cliente no Firestore
                    const clienteRef = db.collection('USERS').doc(docId);
                    await clienteRef.update({ DOCSENVIADOS, DOCSVERIFICADOS });

                    // Atualiza o cliente no cache
                    await cache.set('clients', cachedClients);

                    return res.status(200).send('Cliente atualizado com sucesso no cache e no Firestore.');
                } else {
                    // Se o cliente não estiver no cache, apenas atualize no Firestore
                    const clienteRef = db.collection('USERS').doc(docId);
                    await clienteRef.update({ DOCSENVIADOS, DOCSVERIFICADOS });

                    // Opcionalmente, você pode adicionar o cliente atualizado ao cache, se necessário
                    // Aqui você pode fazer o fetch do cliente e adicionar ao cache, se desejado.

                    return res.status(200).send('Cliente atualizado no Firestore, mas não encontrado no cache.');
                }
            } else {
                // Se o cache estiver vazio, apenas atualize no Firestore
                const clienteRef = db.collection('USERS').doc(docId);
                await clienteRef.update({ DOCSENVIADOS, DOCSVERIFICADOS });

                return res.status(200).send('Cliente atualizado no Firestore e o cache está vazio.');
            }
        } catch (error) {
            console.error('Erro ao atualizar o cliente:', error);
            return res.status(500).send('Erro ao atualizar o cliente.');
        }
    },


    //tenho um erro aqui pra criar contrato pelo admin, importar moment
    createContratoAdmin: async (req, res) => {
        const { docId, contratoData } = req.body;

        // Verifica se todos os parâmetros necessários estão presentes
        if (!docId || !contratoData) {
            return res.status(400).send('docId e contratoData são obrigatórios.');
        }
        console.log('Recebido:', { docId, contratoData });

        try {
            // Atualiza o cliente no cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                const clienteIndex = cachedClients.findIndex(cliente => cliente.CPF === docId);

                if (clienteIndex !== -1) {
                    // Cliente encontrado no cache
                    const clienteData = cachedClients[clienteIndex];
                    const contratos = clienteData.CONTRATOS || [];

                    // Adiciona o novo contrato ao array de contratos
                    const newContrato = {
                        ...contratoData,
                        PURCHASEDATE: moment().format('YYYY-MM-DD HH:mm:ss'),
                        YIELDTERM: moment().add(3, 'years').format('YYYY-MM-DD')
                    };
                    contratos.push(newContrato);

                    // Atualiza o cliente no cache
                    cachedClients[clienteIndex].CONTRATOS = contratos;
                    await cache.set('clients', cachedClients);

                    // Atualiza o cliente no Firestore
                    const clienteRef = db.collection('USERS').doc(docId);
                    await clienteRef.update({ CONTRATOS: contratos });
                    await adminController.loadClientsToCache();
                    return res.status(201).send('SOLICITAÇÃO DE COMPRA FEITA COM SUCESSO, FAÇA O PAGAMENTO E AGUARDE A CONFIRMAÇÃO.');
                } else {
                    // Cliente não encontrado no cache, busca no Firestore
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

                        // Atualiza o cliente no Firestore
                        await clienteRef.update({ CONTRATOS: contratos });

                        // Atualiza o cache com os dados mais recentes
                        const clientsSnapshot = await db.collection('USERS').get();
                        const updatedClients = clientsSnapshot.docs.map(doc => ({
                            CPF: doc.id,
                            ...doc.data()
                        }));
                        await cache.set('clients', updatedClients);
                        await adminController.loadClientsToCache();

                        return res.status(201).send('SOLICITAÇÃO DE COMPRA FEITA COM SUCESSO, FAÇA O PAGAMENTO E AGUARDE A CONFIRMAÇÃO.');
                    } else {
                        return res.status(404).send('Cliente não encontrado no Firestore.');
                    }
                }
            } else {
                // Se o cache estiver vazio, busca no Firestore
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

                    // Atualiza o cliente no Firestore
                    await clienteRef.update({ CONTRATOS: contratos });

                    // Atualiza o cache com os dados mais recentes
                    const clientsSnapshot = await db.collection('USERS').get();
                    const updatedClients = clientsSnapshot.docs.map(doc => ({
                        CPF: doc.id,
                        ...doc.data()
                    }));
                    await cache.set('clients', updatedClients);
                    await adminController.loadClientsToCache();

                    return res.status(201).send('SOLICITAÇÃO DE COMPRA FEITA COM SUCESSO, FAÇA O PAGAMENTO E AGUARDE A CONFIRMAÇÃO.');
                } else {
                    return res.status(404).send('Cliente não encontrado no Firestore.');
                }
            }
        } catch (error) {
            console.error('Erro ao criar o contrato:', error);
            return res.status(500).send('Erro ao criar o contrato.');
        }
    },


    createSaqueAdmin: async (req, res) => {
        const { docId, saqueData } = req.body;

        if (!docId || !saqueData) {
            return res.status(400).send('DocId e saqueData são obrigatórios.');
        }

        try {
            // Atualiza o cliente no cache
            const cachedClients = await cache.get('clients');

            if (cachedClients) {
                const clienteIndex = cachedClients.findIndex(cliente => cliente.CPF === docId);

                if (clienteIndex !== -1) {
                    // Cliente encontrado no cache
                    const clienteData = cachedClients[clienteIndex];
                    const saques = clienteData.SAQUES || [];

                    const newSaque = {
                        ...saqueData,
                        DATASOLICITACAO: moment().format('YYYY-MM-DD HH:mm:ss')
                    };

                    saques.push(newSaque);

                    // Atualiza o cliente no cache
                    cachedClients[clienteIndex].SAQUES = saques;
                    await cache.set('clients', cachedClients);

                    // Atualiza o cliente no Firestore
                    const clienteRef = db.collection('USERS').doc(docId);
                    await clienteRef.update({ SAQUES: saques });


                    const returnedSaque = {
                        ...newSaque,
                        CLIENT_NAME: cachedClients[clienteIndex].NAME,
                        CLIENT_CPF: cachedClients[clienteIndex].CPF,
                        CLIENT_USERNAME: cachedClients[clienteIndex].USERNAME,
                    }
                    await adminController.loadClientsToCache();

                    return res.json({ resposta: returnedSaque, status: 201 });
                } else {
                    // Cliente não encontrado no cache, busca no Firestore
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

                        // Atualiza o cliente no Firestore
                        await clienteRef.update({ SAQUES: saques });

                        // Atualiza o cache com os dados mais recentes
                        const clientsSnapshot = await db.collection('USERS').get();
                        const updatedClients = clientsSnapshot.docs.map(doc => ({
                            CPF: doc.id,
                            ...doc.data()
                        }));
                        await cache.set('clients', updatedClients);
                        await adminController.loadClientsToCache();

                        return res.status(201).send('Saque criado com sucesso e cache sincronizado.');
                    } else {
                        return res.status(404).send('Cliente não encontrado no Firestore.');
                    }
                }
            } else {
                // Se o cache estiver vazio, busca no Firestore
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

                    // Atualiza o cliente no Firestore
                    await clienteRef.update({ SAQUES: saques });

                    // Atualiza o cache com os dados mais recentes
                    const clientsSnapshot = await db.collection('USERS').get();
                    const updatedClients = clientsSnapshot.docs.map(doc => ({
                        CPF: doc.id,
                        ...doc.data()
                    }));
                    await cache.set('clients', updatedClients);
                    await adminController.loadClientsToCache();

                    return res.status(201).send('Saque criado com sucesso e cache sincronizado.');
                } else {
                    return res.status(404).send('Cliente não encontrado no Firestore.');
                }
            }
        } catch (error) {
            console.error('Erro ao criar o saque:', error);
            return res.status(500).send('Erro ao criar o saque.');
        }
    },

    atualizarTodosContratosAtivos: async (req, res) => {
        try {
            console.log('vou atualizar')
            let totalUpdated = 0;
            const failedUpdates = [];

            // Buscar todos os documentos da coleção USERS
            const usersSnapshot = await db.collection('USERS').get();

            if (usersSnapshot.empty) {
                return res.status(200).send('Nenhum usuário encontrado.');
            }

            let users = [];

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
                                console.log(`Contrato ${contrato.IDCOMPRA} do usuário ${userData.NAME} (CPF: ${userData.CPF}) atualizado: Rendimento atual de ${rendimentoAtual.toFixed(2)} para ${rendimentoNovo.toFixed(2)}`);
                            }
                        }
                    });

                    if (updateNeeded) {
                        try {
                            // Atualiza o cliente no Firestore
                            await db.collection('USERS').doc(userDoc.id).update({ CONTRATOS: userData.CONTRATOS });

                            totalUpdated++;

                            // Adiciona o usuário atualizado à lista
                            users.push({
                                CPF: userDoc.id,
                                ...userData,
                                CONTRATOS: userData.CONTRATOS
                            });

                            // Imprime o nome do cliente ao atualizar
                            console.log(`Cliente ${userData.NAME} (CPF: ${userData.CPF}) atualizado com sucesso.`);
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

            // Atualiza o cache com os dados mais recentes
            await adminController.loadClientsToCache();

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

    testCache: async (req, res) => {
        try {
            const cachedClients = await cache.get('clients');
            res.status(200).json(cachedClients || { message: 'Cache vazio' });
        } catch (error) {
            console.error('Erro ao acessar o cache:', error);
            res.status(500).json({ error: 'Erro ao acessar o cache' });
        }
    },

    adicionarIndicacao: async (req, res) => {
        const { userId, indicationQtt } = req.body;

        if (!userId || !indicationQtt) {
            return res.status(400).json({ data: "userId ou indicationQtt não enviados" });
        }

        try {
            const clienteRef = db.collection('USERS').doc(userId);
            const clienteDoc = await clienteRef.get();

            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const indicacoes = clienteData.INDICACAO || [];

                const newIndication = {
                    CPF: clienteData.CPF,
                    TIMESTAMP: moment().format('YYYY-MM-DD HH:mm:ss'),
                    NAME: "ADICIONADO PELA GOLDEN",
                    VALOR: parseFloat(indicationQtt)
                };

                indicacoes.push(newIndication);

                // Aqui você deve corrigir "saques" para "indicacoes"
                await clienteRef.update({ INDICACAO: indicacoes });

                // Atualiza o cache com os dados mais recentes
                const clientsSnapshot = await db.collection('USERS').get();
                const updatedClients = clientsSnapshot.docs.map(doc => ({
                    CPF: doc.id,
                    ...doc.data()
                }));

                await adminController.loadClientsToCache();

                return res.status(200).json({ data: 'Indicação adicionada com sucesso', status: 200 });
            } else {
                return res.status(404).json({ data: 'Cliente não encontrado no Firestore.', status: 404 });
            }

        } catch (error) {
            console.error("Erro ao adicionar indicação:", error); // Adiciona log no console
            return res.status(500).json({ data: 'Erro no servidor.', status: 500, error: error.message }); // Retorna a mensagem do erro
        }
    },


    cancelarContrato: async (req, res) => {
        const { userId, contractId } = req.body;

        if (!userId || !contractId) {
            return res.status(400).json({ data: "userId ou contractId não enviados" });
        }

        try {
            const clienteRef = db.collection('USERS').doc(userId);
            const clienteDoc = await clienteRef.get();

            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const contratos = clienteData.CONTRATOS || [];

                // Identifica o contrato que você quer editar
                const contratoIndex = contratos.findIndex(contract => contract.IDCOMPRA === contractId);

                // Verifica se o contrato foi encontrado
                if (contratoIndex !== -1) {
                    // Atualizando os campos necessários
                    contratos[contratoIndex].MAXIMUMQUOTAYIELD = "0"; // Ou o valor que você deseja definir
                    contratos[contratoIndex].RENDIMENTO_ATUAL = 0; // Ou o valor que você deseja definir
                    contratos[contratoIndex].STATUS = 3; // Ou outro valor de status desejado

                    // Atualiza a coleção de contratos do cliente
                    await clienteRef.update({ CONTRATOS: contratos });

                    // Carrega os clientes atualizados em cache se necessário
                    await adminController.loadClientsToCache();

                    return res.status(200).json({ data: 'Contrato cancelado!', status: 200 });
                } else {
                    return res.status(404).json({ data: 'Contrato não encontrado.', status: 404 });
                }
            } else {
                return res.status(404).json({ data: 'Cliente não encontrado no Firestore.', status: 404 });
            }

        } catch (error) {
            console.error("Erro ao cancelar o contrato:", error);
            return res.status(500).json({ data: 'Erro no servidor.', status: 500 });
        }
    },

    adicionarSaldoParaSaque: async (req, res) => {
        const { userId, contractId, increasement } = req.body;

        if (!userId || !contractId, !increasement) {
            return res.status(400).json({ data: "userId, increasement ou contractId não enviados" });
        }

        try {
            const clienteRef = db.collection('USERS').doc(userId);
            const clienteDoc = await clienteRef.get();

            if (clienteDoc.exists) {
                const clienteData = clienteDoc.data();
                const contratos = clienteData.CONTRATOS || [];

                // Identifica o contrato que você quer editar
                const contratoIndex = contratos.findIndex(contract => contract.IDCOMPRA === contractId);

                // Verifica se o contrato foi encontrado
                if (contratoIndex !== -1) {

                    const rendimentoAtual = contratos[contratoIndex].RENDIMENTO_ATUAL;
                    const valorInvestido = contratos[contratoIndex].TOTALSPENT;

                    //vou dividir a multiplicacao por isso
                    const valorLucroAtualDoContrato = (parseFloat(valorInvestido)) * (parseFloat(rendimentoAtual) / 100);

                    //multiplicacao = rendimentoAtual * o valor
                    const multiplicacao = parseFloat(increasement) * parseFloat(rendimentoAtual)

                    const novoRendimento = (multiplicacao) / valorLucroAtualDoContrato;

                    contratos[contratoIndex].RENDIMENTO_ATUAL = ((novoRendimento) + rendimentoAtual);

                    await clienteRef.update({ CONTRATOS: contratos });

                    // Carrega os clientes atualizados em cache se necessário
                    await adminController.loadClientsToCache();

                    return res.status(200).json({ data: 'Lucro antecipado com sucesso!', status: 200 });
                } else {
                    return res.status(404).json({ data: 'Contrato não encontrado.', status: 404 });
                }
            } else {
                return res.status(404).json({ data: 'Cliente não encontrado no Firestore.', status: 404 });
            }

        } catch (error) {
            console.error("Erro ao cancelar o contrato:", error);
            return res.status(500).json({ data: 'Erro no servidor.', status: 500 });
        }
    }


}

module.exports = adminController;
