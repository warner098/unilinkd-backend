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

// 2. OBTENER TODAS LAS PETICIONES ASOCIADAS A UN USUARIO (por ID o por Nombre)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { userNombre } = req.query;

    if (!userId) return res.status(400).json({ msg: 'ID de usuario no proporcionado' });

    const query = {
      $or: [
        { autorServicioId: userId },
        { solicitanteId: userId }
      ]
    };

    if (userNombre && userNombre.trim()) {
      const cleanName = userNombre.trim();
      const regex = new RegExp(`^${cleanName}$`, 'i');
      query.$or.push({ autorServicioNombre: regex });
      query.$or.push({ solicitanteNombre: regex });
    }

    const allRequests = await HelpRequest.find(query).sort({ updatedAt: -1 });

    // Filtrar solicitudes eliminadas por cada rol individualmente
    const cleanUserId = userId.toString();
    const cleanUserName = userNombre ? userNombre.trim().toLowerCase() : '';

    const filtered = allRequests.filter(r => {
      const isAutor = (r.autorServicioId && r.autorServicioId.toString() === cleanUserId) ||
                      (cleanUserName && r.autorServicioNombre && r.autorServicioNombre.trim().toLowerCase() === cleanUserName);

      const isSolicitante = (r.solicitanteId && r.solicitanteId.toString() === cleanUserId) ||
                            (cleanUserName && r.solicitanteNombre && r.solicitanteNombre.trim().toLowerCase() === cleanUserName);

      if (isAutor && r.eliminadoPorAutor) return false;
      if (isSolicitante && r.eliminadoPorSolicitante) return false;

      return true;
    });

    res.json(filtered);
  } catch (err) {
    console.error('Error al consultar peticiones:', err);
    res.status(500).json({ msg: 'Error al consultar peticiones de ayuda' });
  }
});

// 3. ACTUALIZAR ESTADO DE LA PETICIÓN (Aceptar / Rechazar)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivoRechazo, userId, userNombre } = req.body;

    const helpReq = await HelpRequest.findById(id);
    if (!helpReq) return res.status(404).json({ msg: 'Petición de ayuda no encontrada' });

    // Verificar autorización por ID o por Nombre
    const isOwnerById = helpReq.autorServicioId && userId && helpReq.autorServicioId.toString() === userId.toString();
    const isOwnerByName = userNombre && helpReq.autorServicioNombre && helpReq.autorServicioNombre.trim().toLowerCase() === userNombre.trim().toLowerCase();

    if (!isOwnerById && !isOwnerByName && userId !== 'admin') {
      const isSolicitant = helpReq.solicitanteId && userId && helpReq.solicitanteId.toString() === userId.toString();
      if (!isSolicitant) {
        return res.status(403).json({ msg: 'No tienes autorización para cambiar el estado de esta petición' });
      }
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

    // Notificar al destinatario del nuevo mensaje
    try {
      const isEmisorAutor = (helpReq.autorServicioId && emisorId && helpReq.autorServicioId.toString() === emisorId.toString()) ||
                            (helpReq.autorServicioNombre && emisorNombre && helpReq.autorServicioNombre.trim().toLowerCase() === emisorNombre.trim().toLowerCase());

      const destinatarioId = isEmisorAutor ? helpReq.solicitanteId : helpReq.autorServicioId;
      const destinatarioNombre = isEmisorAutor ? helpReq.solicitanteNombre : helpReq.autorServicioNombre;

      const newNotif = new Notification({
        usuarioId: destinatarioId,
        usuarioNombre: destinatarioNombre,
        titulo: `💬 Nuevo mensaje de ${emisorNombre}`,
        mensaje: `${emisorNombre}: "${mensaje ? (mensaje.length > 50 ? mensaje.substring(0, 50) + '...' : mensaje) : 'Ha enviado una imagen'}"`,
        tipo: 'info',
        requestId: helpReq._id.toString()
      });
      await newNotif.save();
    } catch (msgNotifErr) {
      console.error('Error enviando notif de mensaje:', msgNotifErr.message);
    }

    res.status(201).json(helpReq);
  } catch (err) {
    console.error('Error al enviar mensaje:', err);
    res.status(500).json({ msg: 'Error en el servidor al enviar el mensaje' });
  }
});

// 5. ELIMINAR / OCULTAR UN CHAT PARA UN USUARIO
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userNombre } = req.query;

    const helpReq = await HelpRequest.findById(id);
    if (!helpReq) return res.status(404).json({ msg: 'Petición no encontrada' });

    const cleanUserId = userId ? userId.toString() : '';
    const cleanUserName = userNombre ? userNombre.trim().toLowerCase() : '';

    const isAutor = (helpReq.autorServicioId && helpReq.autorServicioId.toString() === cleanUserId) ||
                    (cleanUserName && helpReq.autorServicioNombre && helpReq.autorServicioNombre.trim().toLowerCase() === cleanUserName);

    const isSolicitante = (helpReq.solicitanteId && helpReq.solicitanteId.toString() === cleanUserId) ||
                          (cleanUserName && helpReq.solicitanteNombre && helpReq.solicitanteNombre.trim().toLowerCase() === cleanUserName);

    if (isAutor) helpReq.eliminadoPorAutor = true;
    if (isSolicitante) helpReq.eliminadoPorSolicitante = true;

    // Si ambos lo han eliminado, borrar definitivamente de MongoDB
    if (helpReq.eliminadoPorAutor && helpReq.eliminadoPorSolicitante) {
      await HelpRequest.findByIdAndDelete(id);
      return res.json({ msg: 'Chat eliminado definitivamente de ambos usuarios' });
    } else {
      await helpReq.save();
      return res.json({ msg: 'Chat eliminado de tu historial' });
    }
  } catch (err) {
    console.error('Error al eliminar chat:', err);
    res.status(500).json({ msg: 'Error al eliminar el chat' });
  }
});

module.exports = router;
