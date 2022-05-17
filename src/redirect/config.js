require('dotenv').config();

const PORT = parseInt(process.env.PORT || '3000');
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const METHODS_WITHOUT_BODY = ['OPTIONS', 'HEAD', 'GET'];

module.exports = { PORT, PUBLIC_URL, METHODS_WITHOUT_BODY };
