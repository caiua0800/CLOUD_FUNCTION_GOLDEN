// cache.js
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // Tempo de expiração padrão de 10 minutos

module.exports = cache;
