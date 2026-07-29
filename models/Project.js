const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true,
    trim: true
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
  repoUrl: {
    type: String,
    default: ''
  },
  colaboradoresBuscados: {
    type: String,
    default: 'Colaboradores'
  },
  categoriaPrincipal: {
    type: String,
    required: true,
    trim: true,
    default: 'Programación / Software'
  },
  etiquetas: {
    type: [String],
    default: []
  },
  autor: {
    type: String,
    required: true
  },
  autorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aprobado', 'rechazado'],
    default: 'pendiente'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Project', ProjectSchema);
