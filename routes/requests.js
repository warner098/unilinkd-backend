const express = require('express');
const router = express.Router();
const HelpRequest = require('../models/HelpRequest');
const Notification = require('../models/Notification');

// 1. CREAR UNA NUEVA PETICIÓN DE AYUDA
router.post('/', async (req, res) => {
  try {
    const {
      servicioId,
      servicioTitulo,
      autorServicioId,
      autorServicioNombre,
      autorServicioFoto,
      solicitanteId,
      solicitanteNombre,
      solicitanteFoto,
      tituloPeticion,
      descripcion,
      mediaUrl,
      referencias
    } = req.body;

    if (!servicioId || !autorServicioId || !solicitanteId || !tituloPeticion || !descripcion) {
      return res.status(400).json({ msg: 'Por favor completa los campos obligatorios de la petición' });
    }

    const newRequest = new HelpRequest({
      servicioId,
      servicioTitulo: servicioTitulo || 'Servicio Universitario',
      autorServicioId,
      autorServicioNombre: autorServicioNombre || 'Estudiante',
      autorServicioFoto: autorServicioFoto || '',
      solicitanteId,
      solicitanteNombre: solicitanteNombre || 'Estudiante',
      solicitanteFoto: solicitanteFoto || '',
      tituloPeticion,
      descripcion,
      mediaUrl: mediaUrl || '',
      referencias: referencias || '',
      estado: 'pendiente',
      mensajes: []
    });

    await newRequest.save();

    // Notificar al dueño del servicio en tiempo real
    try {
      const newNotification = new Notification({
        usuarioId: autorServicioId,
        usuarioNombre: autorServicioNombre || 'Estudiante',
        titulo: '📩 Nueva petición de ayuda recibida',
        mensaje: `${solicitanteNombre || 'Un estudiante'} te ha enviado una propuesta de ayuda para tu servicio "${servicioTitulo}": "${tituloPeticion}".`,
        tipo: 'peticion_recibida',
        requestId: newRequest._id.toString()
      });
      await newNotification.save();
    } catch (notifErr) {
      console.error('Error al guardar notificación de petición:', notifErr.message);
    }

    res.status(201).json(newRequest);
  } catch (err) {
    console.error('Error al crear petición de ayuda:', err);
    res.status(500).json({ msg: 'Error en el servidor al enviar la petición de ayuda: ' + err.message });
  }
});

// 2. OBTENER TODAS LAS PETICIONES ASOCIADAS A UN USUARIO (Como proveedor del servicio o como solicitante)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ msg: 'ID de usuario no proporcionado' });

    const requests = await HelpRequest.find({
      $or: [
        { autorServicioId: userId },
        { solicitanteId: userId }
      ]
    }).sort({ updatedAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error('Error al consultar peticiones:', err);
    res.status(500).json({ msg: 'Error al consultar peticiones de ayuda' });
  }
});

// 3. ACTUALIZAR ESTADO DE LA PETICIÓN (Aceptar / Rechazar)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivoRechazo, userId } = req.body;

    const helpReq = await HelpRequest.findById(id);
    if (!helpReq) return res.status(404).json({ msg: 'Petición de ayuda no encontrada' });

    // Verificar que el usuario sea el dueño del servicio
    if (helpReq.autorServicioId.toString() !== userId.toString()) {
      return res.status(403).json({ msg: 'No tienes autorización para cambiar el estado de esta petición' });
    }

    helpReq.estado = estado;
    if (motivoRechazo) helpReq.motivoRechazo = motivoRechazo;
    helpReq.updatedAt = Date.now();

    await helpReq.save();

    // Notificar al solicitante
    try {
      const notifMsg = estado === 'aceptado'
        ? `🎉 Tu propuesta "${helpReq.tituloPeticion}" para "${helpReq.servicioTitulo}" fue ACEPTADA por ${helpReq.autorServicioNombre}. ¡El chat en vivo está listo!`
        : `⚠️ Tu propuesta "${helpReq.tituloPeticion}" fue rechazada. Motivo: ${motivoRechazo || 'Información no adecuada'}`;

      const newNotification = new Notification({
        usuarioId: helpReq.solicitanteId,
        usuarioNombre: helpReq.solicitanteNombre,
        titulo: estado === 'aceptado' ? '✅ Petición Aceptada - Chat Activo' : '❌ Petición Rechazada',
        mensaje: notifMsg,
        tipo: estado === 'aceptado' ? 'peticion_aceptada' : 'peticion_rechazada',
        requestId: helpReq._id.toString()
      });
      await newNotification.save();
    } catch (notifErr) {
      console.error('Error al enviar notificación al solicitante:', notifErr.message);
    }

    res.json(helpReq);
  } catch (err) {
    console.error('Error al actualizar estado de la petición:', err);
    res.status(500).json({ msg: 'Error en el servidor al actualizar la petición' });
  }
});

// 4. ENVIAR UN MENSAJE DE CHAT EN UNA PETICIÓN
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { emisorId, emisorNombre, emisorFoto, mensaje, mediaUrl } = req.body;

    const helpReq = await HelpRequest.findById(id);
    if (!helpReq) return res.status(404).json({ msg: 'Petición no encontrada' });

    if (helpReq.estado !== 'aceptado') {
      return res.status(400).json({ msg: 'El chat sólo está disponible cuando la petición ha sido aceptada.' });
    }

    const nuevoMensaje = {
      emisorId,
      emisorNombre,
      emisorFoto: emisorFoto || '',
      mensaje: mensaje || '',
      mediaUrl: mediaUrl || '',
      fecha: new Date()
    };

    helpReq.mensajes.push(nuevoMensaje);
    helpReq.updatedAt = Date.now();
    await helpReq.save();

    res.status(201).json(helpReq);
  } catch (err) {
    console.error('Error al enviar mensaje:', err);
    res.status(500).json({ msg: 'Error en el servidor al enviar el mensaje' });
  }
});

module.exports = router;
