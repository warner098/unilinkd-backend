const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  usuarioId: {
    type: String,
    required: true
  },
  titulo: {
    type: String,
    required: true
  },
  mensaje: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['aprobado', 'rechazado', 'info'],
    default: 'info'
  },
  motivo: {
    type: String,
    default: ''
  },
  leido: {
    type: Boolean,
    default: false
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);
