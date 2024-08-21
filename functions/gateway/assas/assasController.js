const fetch = require('node-fetch');

// Definindo a chave da API e o identificador da conta
const ASSAS_API_KEY = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDA0NzY5OTM6OiRhYWNoX2FhZGU2Zjc3LWY1YzItNDE4MC1hM2VjLWNhMzJkNGE5YmMxOA==";
const ACCOUNT_IDENTIFIER = "e79a1550-4f5a-4570-96b1-7ca6e40497b0";

// Função para gerar a chave PIX
const gerarChavePix = async () => {
    const url = 'https://sandbox.asaas.com/api/v3/pix/addressKeys';

    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Authorization': `Bearer ${ASSAS_API_KEY}` // Adiciona a chave da API no cabeçalho
        },
        body: JSON.stringify({ type: 'EVP' })
    };

    try {
        const response = await fetch(url, options);
        
        // Verificação se a resposta é bem-sucedida
        if (!response.ok) {
            const errorDetails = await response.text(); // Para obter detalhes do erro
            throw new Error(`Erro: ${response.status} - ${response.statusText}. Detalhes: ${errorDetails}`);
        }
        
        const jsonResponse = await response.json();
        return jsonResponse; // Retorna o JSON com a chave PIX gerada
    } catch (error) {
        console.error('Erro ao gerar chave PIX:', error.message);
        throw error; // Re-throw o erro para permitir tratamento posterior
    }
};

// Exportar a função
module.exports = {
    gerarChavePix
};
