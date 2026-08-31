const mongoose = require('mongoose');

const PortfolioProjectSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  titulo: {
    type: String,
    required: true,
    trim: true
  },
  categoria: {
    type: String,
    required: true
  },
  repoUrl: {
    type: String,
    default: ''
  },
  descripcion: {
    type: String,
    required: true
  },
  mediaUrl: {
    type: String,
    default: ''
  },
  referencias: {
    type: String,
    default: ''
  },
  etiquetas: {
    type: [String],
    default: []
  },
  fecha: {
    type: Date,
    default: Date.now
  }
});

const UserSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  correo: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  rol: {
    type: String,
    enum: ['estudiante', 'admin'],
    default: 'estudiante'
  },
  // --- Campos para el Perfil Personal ---
  titulo: {
    type: String,
    default: ''
  },
  facultad: {
    type: String,
    default: ''
  },
  carrera: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  fotoUrl: {
    type: String,
    default: ''
  },
  habilidades: {
    type: [String],
    default: []
  },
  // --- Portafolio Personal del Usuario ---
  portafolio: {
    type: [PortfolioProjectSchema],
    default: []
  },
  // ---------------------------------------------
  areas: {
    type: [String],
    default: []
  },
  semestre: {
    type: String,
    required: true
  },
  fechaRegistro: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);