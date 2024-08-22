const CryptoJS = require('crypto-js');
const SECRET_KEY = 'GoldenBrasil';


function encrypt(text) {
    try {
        return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    } catch (error) {
        console.error('Erro ao criptografar:', error);
        return null;
    }
}

// Função para descriptografar uma string
function decrypt(ciphertext) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (originalText) {
            return originalText;
        } else {
            throw new Error('Texto descriptografado vazio');
        }
    } catch (error) {
        console.error('Erro ao descriptografar:', error);
        return null;
    }
}


function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Mês começa em 0
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


const processClientData = (cliente) => {
    // Inicializa os valores que serão calculados
    const totals = (cliente.CONTRATOS || []).reduce((acc, contrato) => {
        // Adiciona verificação para ignorar contratos com STATUS 3 ou 4
        if (contrato.STATUS === 3 || contrato.STATUS === 4) {
            return acc;
        }

        // Calcula o rendimento atual
        const rendimentoContrato = contrato.RENDIMENTO_ATUAL && typeof contrato.RENDIMENTO_ATUAL === 'number'
            ? contrato.RENDIMENTO_ATUAL / 100
            : 0;

        // Inicializa lucroTotal para este contrato
        let lucroTotal = 0;

        if (contrato.TOTALSPENT) {
            const amountSpent = parseFloat(contrato.TOTALSPENT.replace(',', '.'));
            lucroTotal = amountSpent * rendimentoContrato;
            acc.LUCRO_CONTRATOS += lucroTotal;
            acc.TOTAL_SPENT += amountSpent;
        }

        let valorAReceber = 0;
        if (contrato.MAXIMUMQUOTAYIELD && contrato.TOTALSPENT) {
            valorAReceber = parseFloat(contrato.TOTALSPENT.replace(',', '.')) * (parseFloat(contrato.MAXIMUMQUOTAYIELD)/100);
        }

        if ((contrato.STATUS) == 1) {
            const coins = parseFloat(contrato.COINS);
            !isNaN(coins) && (acc.TOTAL_COINS += coins);
            acc.DISPONIVEL_SAQUE += lucroTotal;
        } else {
            acc.DISPONIVEL_SAQUE += lucroTotal + parseFloat(contrato.TOTALSPENT.replace(',', '.'));
        }

        acc.VALOR_A_RECEBER += valorAReceber;
        return acc;
    }, { TOTAL_SPENT: 0, DISPONIVEL_SAQUE: 0, TOTAL_COINS: 0, LUCRO_CONTRATOS: 0, VALOR_A_RECEBER: 0 });

    // Adiciona os valores calculados ao objeto do cliente
    cliente.TOTAL_SPENT = totals.TOTAL_SPENT;
    // cliente.DISPONIVEL_SAQUE = totals.DISPONIVEL_SAQUE;
    cliente.TOTAL_COINS = totals.TOTAL_COINS;
    cliente.LUCRO_CONTRATOS = totals.LUCRO_CONTRATOS;

    // Adiciona o valor total de indicações (se aplicável)
    const indicacaoArray = cliente.INDICACAO || [];
    const totalIndicacaoValue = indicacaoArray.reduce((sum, indicacao) => {
        if (indicacao.VALOR) {
            const value = parseFloat(indicacao.VALOR);
            !isNaN(value) && (sum += value);
        }
        return sum;
    }, 0);

    cliente.TOTAL_INDICACAO = totalIndicacaoValue - parseFloat(cliente.SAQUE_DE_INDICACAO ? cliente.SAQUE_DE_INDICACAO : 0);

    // Calcula o TOTAL_PLATAFORMA
    cliente.TOTAL_PLATAFORMA = cliente.LUCRO_CONTRATOS + cliente.TOTAL_SPENT + cliente.TOTAL_INDICACAO;

    // Calcula o VALOR_SACADO
    const saquesArray = cliente.SAQUES || [];
    const valorSacado = saquesArray
        .filter(saque => saque.STATUS === 2)
        .reduce((sum, saque) => {
            if (saque.VALORSOLICITADO) {
                // const value = parseFloat(saque.VALORSOLICITADO.replace(',', '.'));
                const value = parseFloat(saque.VALORSOLICITADO);

                !isNaN(value) && (sum += value);
            }
            return sum;
        }, 0);

    cliente.VALOR_SACADO = valorSacado;
    cliente.VALOR_A_RECEBER = (totals.VALOR_A_RECEBER - valorSacado);
    cliente.DISPONIVEL_SAQUE = totals.DISPONIVEL_SAQUE - valorSacado;

    return cliente;
};

module.exports = { getCurrentTimestamp, processClientData, encrypt, decrypt };