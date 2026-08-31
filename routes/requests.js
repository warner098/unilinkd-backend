const express = require('express');
const router = express.Router();
const HelpRequest = require('../models/HelpRequest');
const Notification = require('../models/Notification');
const Project = require('../models/Project');

// 1. CREAR UNA NUEVA PETICIÓN DE AYUDA O SOLICITUD DE COLABORACIÓN EN PROYECTO
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
      referencias,
      tipoPeticion
    } = req.body;

    if (!servicioId || !autorServicioId || !solicitanteId || !tituloPeticion || !descripcion) {
      return res.status(400).json({ msg: 'Por favor completa los campos obligatorios de la petición' });
    }

    const newRequest = new HelpRequest({
      servicioId,
      servicioTitulo: servicioTitulo || 'Servicio o Proyecto Universitario',
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
      tipoPeticion: tipoPeticion || 'servicio',
      estado: 'pendiente',
      mensajes: []
    });

    await newRequest.save();

    // Notificar al dueño del servicio o proyecto en tiempo real
    try {
      const isProyecto = (tipoPeticion === 'proyecto');
      const newNotification = new Notification({
        usuarioId: autorServicioId,
        usuarioNombre: autorServicioNombre || 'Estudiante',
        titulo: isProyecto ? '🚀 Nueva propuesta de colaboración recibida' : '📩 Nueva petición de ayuda recibida',
        mensaje: isProyecto
          ? `${solicitanteNombre || 'Un estudiante'} desea unirse a tu proyecto "${servicioTitulo}". Propuesta: "${tituloPeticion}".`
          : `${solicitanteNombre || 'Un estudiante'} te ha enviado una propuesta de ayuda para tu servicio "${servicioTitulo}": "${tituloPeticion}".`,
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
    res.status(500).json({ msg: 'Error en el servidor al enviar la petición: ' + err.message });
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
    if (!helpReq) return res.status(404).json({ msg: 'Petición no encontrada' });

    // Verificar autorización por ID o por Nombre
    const isOwnerById = helpReq.autorServicioId && userId && helpReq.autorServicioId.toString() === userId.toString();
    const isOwnerByName = userNombre && helpReq.autorServicioNombre && helpReq.autorServicioNombre.trim().toLowerCase() === userNombre.trim().toLowerCase();

    if (!isOwnerById && !isOwnerByName && userId !== 'admin') {
      const isSolicitant = helpReq.solicitanteId && userId && helpReq.solicitanteId.toString() === userId.toString();
      if (!isSolicitant) {
        return res.status(403).json({ msg: 'No tienes autorización para cambiar el estado de esta petición' });
      }
    }

    const prevEstado = helpReq.estado;
    helpReq.estado = estado;
    if (motivoRechazo) helpReq.motivoRechazo = motivoRechazo;
    helpReq.updatedAt = Date.now();

    await helpReq.save();

    // Si es una petición de proyecto y recién se acepta, incrementar colaboradoresUnidos del proyecto en MongoDB
    if (estado === 'aceptado' && prevEstado !== 'aceptado' && helpReq.tipoPeticion === 'proyecto' && helpReq.servicioId) {
      try {
        await Project.findByIdAndUpdate(helpReq.servicioId, { $inc: { colaboradoresUnidos: 1 } });
      } catch (pErr) {
        console.error('Error al incrementar colaboradores del proyecto:', pErr.message);
      }
    }

    // Notificar al solicitante
    try {
      const isProyecto = (helpReq.tipoPeticion === 'proyecto');
      const notifMsg = estado === 'aceptado'
        ? (isProyecto 
            ? `🎉 ¡Felicidades! Tu solicitud para unirte al proyecto "${helpReq.servicioTitulo}" fue ACEPTADA por ${helpReq.autorServicioNombre}. ¡El chat del proyecto está activo!`
            : `🎉 Tu propuesta "${helpReq.tituloPeticion}" para "${helpReq.servicioTitulo}" fue ACEPTADA por ${helpReq.autorServicioNombre}. ¡El chat en vivo está listo!`)
        : `⚠️ Tu propuesta "${helpReq.tituloPeticion}" fue rechazada. Motivo: ${motivoRechazo || 'Información no adecuada'}`;

      const newNotification = new Notification({
        usuarioId: helpReq.solicitanteId,
        usuarioNombre: helpReq.solicitanteNombre,
        titulo: estado === 'aceptado' ? (isProyecto ? '🎉 Solicitud de Proyecto Aceptada' : '✅ Petición Aceptada - Chat Activo') : '❌ Petición Rechazada',
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
    const { emisorId, emisorNombre, emisorFoto, mensaje, mediaUrl, nombreArchivo, tamanoArchivo } = req.body;

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
      nombreArchivo: nombreArchivo || '',
      tamanoArchivo: tamanoArchivo || '',
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

      const notifPreviewText = mensaje 
        ? (mensaje.length > 50 ? mensaje.substring(0, 50) + '...' : mensaje)
        : (nombreArchivo ? `Ha enviado un archivo: ${nombreArchivo}` : 'Ha enviado un archivo adjunto');

      const newNotif = new Notification({
        usuarioId: destinatarioId,
        usuarioNombre: destinatarioNombre,
        titulo: `💬 Nuevo mensaje de ${emisorNombre}`,
        mensaje: `${emisorNombre}: "${notifPreviewText}"`,
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
