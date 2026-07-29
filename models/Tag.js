const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  tipo: {
    type: String,
    enum: ['proyecto', 'servicio', 'ambos'],
    default: 'ambos'
  },
  categoria: {
    type: String,
    enum: [
      'Programación / Software',
      'Matemáticas',
      'Ciencias',
      'Diseño & Multimedia',
      'Derecho',
      'Otras'
    ],
    default: 'Programación / Software'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Tag', TagSchema);
