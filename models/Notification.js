const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  usuarioId: {
    type: String,
    required: true
  },
  usuarioNombre: {
    type: String,
    default: ''
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
    enum: [
      'aprobado',
      'rechazado',
      'info',
      'peticion_recibida',
      'peticion_aceptada',
      'peticion_rechazada',
      'publicacion_aprobada',
      'publicacion_rechazada'
    ],
    default: 'info'
  },
  requestId: {
    type: String,
    default: ''
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
