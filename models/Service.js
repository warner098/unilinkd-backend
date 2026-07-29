const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  nombreEstudiante: {
    type: String,
    required: true,
    trim: true
  },
  areaEspecialidad: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    required: true
  },
  semestre: {
    type: String,
    default: 'Semestre no especificado'
  },
  etiquetas: {
    type: [String],
    default: []
  },
  disponible: {
    type: Boolean,
    default: true
  },
  fotoUrl: {
    type: String,
    default: ''
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

module.exports = mongoose.model('Service', ServiceSchema);
