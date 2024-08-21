const fetch = require('node-fetch');
const axios = require('axios')
// Definindo a chave da API e o identificador da conta
const ASSAS_API_KEY = "$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDA0NzY5OTM6OiRhYWNoX2NkMjkxYzcyLWM5M2YtNGQ2MC1iOTkyLTg2MDI2MzllN2U4YQ==";
const ACCOUNT_IDENTIFIER = "e79a1550-4f5a-4570-96b1-7ca6e40497b0";

// Função para gerar a chave PIX
const gerarPIX = async (req, res) => {
    const url = 'https://sandbox.asaas.com/api/v3/pix/addressKeys';

    const options = {
        method: 'GET',
        url: 'https://sandbox.asaas.com/api/v3/payments',
        headers: {
          accept: 'application/json',
          access_token: 'Bearer $aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDA0NzY5OTM6OiRhYWNoX2NkMjkxYzcyLWM5M2YtNGQ2MC1iOTkyLTg2MDI2MzllN2U4YQ==',
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json'
        }
      };

      axios
      .request(options)
      .then(function (response) {
        const data =response.data
        console.log(data);
        return res.status(response.status).json({data});
      })
      .catch(function (error) {
        console.error(error);
        return res.status(error).json({error});

      });
};

// Exportar a função
module.exports = {
    gerarPIX
};
