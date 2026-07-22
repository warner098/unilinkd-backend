const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log('🟢 Conectado a MongoDB con éxito'))
  .catch((err) => console.error('🔴 Error al conectar con MongoDB:', err.message));

// Rutas API
app.use('/api/auth', require('./routes/auth'));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de UniLinkd funcionando 🚀');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});