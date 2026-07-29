const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Tag = require('./models/Tag');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Conexión a MongoDB y Seeding Inicial
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('🟢 Conectado a MongoDB con éxito');
    await initDatabaseSeed();
  })
  .catch((err) => console.error('🔴 Error al conectar con MongoDB:', err.message));

// Función para inicializar cuenta de Administrador y Catálogo de Etiquetas Oficiales
async function initDatabaseSeed() {
  try {
    // 1. Crear usuario Administrador si no existe
    const adminEmail = 'admin@unilinkd.com';
    let adminUser = await User.findOne({ correo: adminEmail });
    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin09123', salt);

      adminUser = new User({
        nombre: 'Administrador UniLinkd',
        correo: adminEmail,
        password: hashedPassword,
        rol: 'admin',
        semestre: 'Admin',
        titulo: 'Administrador General',
        bio: 'Cuenta oficial de administración de UniLinkd.'
      });
      await adminUser.save();
      console.log('👑 Cuenta de Administrador inicializada (admin@unilinkd.com)');
    }

    // 2. Poblar etiquetas oficiales si la colección está vacía
    const countTags = await Tag.countDocuments();
    if (countTags === 0) {
      const defaultOfficialTags = [
        // Programación / Software
        { nombre: 'React', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'Node.js', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'JavaScript', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'TypeScript', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'Python', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'C++', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'MongoDB', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'SQL / Bases de Datos', categoria: 'Programación / Software', tipo: 'ambos' },
        { nombre: 'WebSockets', categoria: 'Programación / Software', tipo: 'proyecto' },
        { nombre: 'HTML / CSS', categoria: 'Programación / Software', tipo: 'ambos' },
        // Matemáticas
        { nombre: 'Cálculo I/II', categoria: 'Matemáticas', tipo: 'ambos' },
        { nombre: 'Álgebra Lineal', categoria: 'Matemáticas', tipo: 'ambos' },
        { nombre: 'Estadística & Probabilidad', categoria: 'Matemáticas', tipo: 'ambos' },
        { nombre: 'Ecuaciones Diferenciales', categoria: 'Matemáticas', tipo: 'ambos' },
        // Ciencias
        { nombre: 'Física I/II', categoria: 'Ciencias', tipo: 'ambos' },
        { nombre: 'Química General', categoria: 'Ciencias', tipo: 'ambos' },
        { nombre: 'Biología / Neurociencia', categoria: 'Ciencias', tipo: 'ambos' },
        { nombre: 'Metodología de Investigación', categoria: 'Ciencias', tipo: 'ambos' },
        // Diseño & Multimedia
        { nombre: 'Figma', categoria: 'Diseño & Multimedia', tipo: 'ambos' },
        { nombre: 'Diseño UI/UX', categoria: 'Diseño & Multimedia', tipo: 'ambos' },
        { nombre: 'Canva', categoria: 'Diseño & Multimedia', tipo: 'ambos' },
        { nombre: 'Photoshop', categoria: 'Diseño & Multimedia', tipo: 'ambos' },
        { nombre: 'Ilustración & Vectorización', categoria: 'Diseño & Multimedia', tipo: 'servicio' },
        { nombre: 'Diseño de Diapositivas', categoria: 'Diseño & Multimedia', tipo: 'servicio' },
        // Derecho & Sociales
        { nombre: 'Normas APA 7ma Edición', categoria: 'Derecho', tipo: 'ambos' },
        { nombre: 'Redacción Académica', categoria: 'Derecho', tipo: 'ambos' },
        { nombre: 'Derecho Penal / Civil', categoria: 'Derecho', tipo: 'ambos' },
        { nombre: 'Revisión de Ensayos', categoria: 'Derecho', tipo: 'servicio' },
        // Otras
        { nombre: 'Inglés Técnico', categoria: 'Otras', tipo: 'ambos' },
        { nombre: 'Excel Avanzado', categoria: 'Otras', tipo: 'ambos' },
        { nombre: 'Gestión de Proyectos', categoria: 'Otras', tipo: 'ambos' }
      ];

      await Tag.insertMany(defaultOfficialTags);
      console.log('🏷️ Catálogo de etiquetas oficiales inicializado con éxito');
    }
  } catch (err) {
    console.error('Error al inicializar seed:', err.message);
  }
}

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/services', require('./routes/services'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/notifications', require('./routes/notifications'));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API de UniLinkd funcionando 🚀');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});