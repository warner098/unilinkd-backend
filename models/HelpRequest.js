const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  emisorId: { type: String, required: true },
  emisorNombre: { type: String, required: true },
  emisorFoto: { type: String, default: '' },
  mensaje: { type: String, default: '' },
  mediaUrl: { type: String, default: '' },
  nombreArchivo: { type: String, default: '' },
  tamanoArchivo: { type: String, default: '' },
  fecha: { type: Date, default: Date.now }
});

const helpRequestSchema = new mongoose.Schema({
  servicioId: { type: String, required: true },
  servicioTitulo: { type: String, required: true },
  autorServicioId: { type: String, required: true },
  autorServicioNombre: { type: String, required: true },
  autorServicioFoto: { type: String, default: '' },

  solicitanteId: { type: String, required: true },
  solicitanteNombre: { type: String, required: true },
  solicitanteFoto: { type: String, default: '' },

  tituloPeticion: { type: String, required: true },
  descripcion: { type: String, required: true },
  mediaUrl: { type: String, default: '' },
  referencias: { type: String, default: '' },

  estado: {
    type: String,
    enum: ['pendiente', 'aceptado', 'rechazado'],
    default: 'pendiente'
  },
  motivoRechazo: { type: String, default: '' },

  eliminadoPorAutor: { type: Boolean, default: false },
  eliminadoPorSolicitante: { type: Boolean, default: false },

  mensajes: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('HelpRequest', helpRequestSchema);
