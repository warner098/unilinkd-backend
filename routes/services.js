const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Service = require('../models/Service');
const Notification = require('../models/Notification');

// @route   POST /api/services
// @desc    Crear una nueva oferta de servicio de estudiante
router.post('/', async (req, res) => {
  try {
    const {
      nombreEstudiante,
      areaEspecialidad,
      descripcion,
      semestre,
      etiquetas,
      fotoUrl,
      autorId,
      userRol
    } = req.body;

    if (!nombreEstudiante || !areaEspecialidad || !descripcion) {
      return res.status(400).json({ msg: 'Por favor completa el nombre, especialidad y descripción del servicio.' });
    }

    const estadoInicial = (userRol === 'admin') ? 'aprobado' : 'pendiente';

    const serviceFields = {
      nombreEstudiante,
      areaEspecialidad,
      descripcion,
      semestre: semestre || '1er Semestre',
      etiquetas: Array.isArray(etiquetas) ? etiquetas : [],
      fotoUrl: fotoUrl || '',
      estado: estadoInicial
    };

    if (autorId && mongoose.Types.ObjectId.isValid(autorId)) {
      serviceFields.autorId = autorId;
    }

    const newService = new Service(serviceFields);
    const savedService = await newService.save();

    return res.status(201).json(savedService);
  } catch (err) {
    console.error('Error detallado al guardar servicio:', err);
    return res.status(500).json({ msg: err.message || 'Error interno en el servidor al publicar servicio' });
  }
});

// @route   GET /api/services
// @desc    Obtener lista de servicios disponibles
router.get('/', async (req, res) => {
  try {
    const { etiqueta, busqueda, estado, autorId, autorNombre } = req.query;
    let query = { disponible: true };

    // Si se consulta por autor específico (para la pestaña "Mis Publicaciones"), entregar todas sus publicaciones sin importar estado
    if (autorId || autorNombre) {
      const orConditions = [];
      if (autorId && mongoose.Types.ObjectId.isValid(autorId)) {
        orConditions.push({ autorId: autorId });
      }
      if (autorNombre) {
        orConditions.push({ nombreEstudiante: new RegExp(`^${autorNombre.trim()}$`, 'i') });
      }
      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    } else {
      if (estado === 'pendiente') {
        query.estado = 'pendiente';
      } else if (estado === 'rechazado') {
        query.estado = 'rechazado';
      } else if (estado !== 'todos') {
        query.estado = 'aprobado';
      }
    }

    if (etiqueta) {
      query.etiquetas = { $in: [etiqueta] };
    }

    if (busqueda) {
      query.$or = [
        { areaEspecialidad: { $regex: busqueda, $options: 'i' } },
        { descripcion: { $regex: busqueda, $options: 'i' } },
        { nombreEstudiante: { $regex: busqueda, $options: 'i' } }
      ];
    }

    const services = await Service.find(query).sort({ fechaCreacion: -1 });
    return res.json(services);
  } catch (err) {
    console.error('Error detallado al obtener servicios:', err);
    return res.status(500).json({ msg: err.message || 'Error interno en el servidor al obtener servicios' });
  }
});

// @route   PUT /api/services/:id
// @desc    Editar un servicio existente
router.put('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ msg: 'Servicio no encontrado' });
    }

    const {
      areaEspecialidad,
      descripcion,
      semestre,
      fotoUrl,
      etiquetas,
      userRol,
      userId
    } = req.body;

    const isAdmin = userRol === 'admin';
    const isOwner = (userId && service.autorId && service.autorId.toString() === userId.toString());

    if (!isAdmin && service.autorId && !isOwner) {
      return res.status(403).json({ msg: 'No tienes permisos para editar este servicio.' });
    }

    if (areaEspecialidad) service.areaEspecialidad = areaEspecialidad;
    if (descripcion) service.descripcion = descripcion;
    if (semestre) service.semestre = semestre;
    if (fotoUrl !== undefined) service.fotoUrl = fotoUrl;
    if (Array.isArray(etiquetas)) service.etiquetas = etiquetas;

    // Si un usuario edita un servicio rechazado, vuelve a estado 'pendiente'
    if (!isAdmin && service.estado === 'rechazado') {
      service.estado = 'pendiente';
    }

    const updatedService = await service.save();
    return res.json(updatedService);
  } catch (err) {
    console.error('Error al editar servicio:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al editar servicio' });
  }
});

// @route   PUT /api/services/:id/estado
// @desc    Actualizar el estado de revisión de un servicio y notificar al usuario
router.put('/:id/estado', async (req, res) => {
  try {
    const { estado, motivoRechazo } = req.body;
    if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) {
      return res.status(400).json({ msg: 'Estado de revisión no válido' });
    }

    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ msg: 'Servicio no encontrado' });
    }

    service.estado = estado;
    await service.save();

    // GENERAR NOTIFICACIÓN PARA EL AUTOR DEL SERVICIO
    const recipientId = service.autorId ? service.autorId.toString() : (service.nombreEstudiante || '').trim().toLowerCase();

    if (recipientId) {
      let notifTitle = '';
      let notifMessage = '';

      if (estado === 'aprobado') {
        notifTitle = '🎉 ¡Tu Servicio ha sido Aprobado!';
        notifMessage = `Tu servicio "${service.areaEspecialidad}" fue revisado y APROBADO por el Administrador. Ya es visible públicamente en UniLinkd.`;
      } else if (estado === 'rechazado') {
        notifTitle = '⚠️ Tu Servicio requiere corrección / Rechazado';
        notifMessage = `Tu servicio "${service.areaEspecialidad}" no fue aprobado por la siguiente razón: ${motivoRechazo || 'Información o contenido no adecuado'}. Puedes editarlo en "Mis Publicaciones" y solicitar revisión.`;
      }

      if (notifTitle) {
        const newNotif = new Notification({
          usuarioId: recipientId,
          titulo: notifTitle,
          mensaje: notifMessage,
          tipo: estado,
          motivo: motivoRechazo || ''
        });
        await newNotif.save();
      }
    }

    return res.json({ msg: `Servicio marcado como ${estado} con éxito`, service });
  } catch (err) {
    console.error('Error al actualizar estado del servicio:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al actualizar estado' });
  }
});

// @route   DELETE /api/services/:id
// @desc    Eliminar un servicio por ID
router.delete('/:id', async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ msg: 'Servicio no encontrado' });
    }

    const { userId, autorNombre, userRol } = req.body || {};

    const isAdmin = userRol === 'admin';
    const matchesId = userId && service.autorId && service.autorId.toString() === userId.toString();
    const matchesNombre = autorNombre && service.nombreEstudiante && service.nombreEstudiante.toLowerCase() === autorNombre.toLowerCase();

    if (!isAdmin && service.autorId && !matchesId && !matchesNombre) {
      return res.status(403).json({ msg: 'No tienes permisos para eliminar este servicio.' });
    }

    await Service.findByIdAndDelete(req.params.id);
    return res.json({ msg: 'Servicio eliminado con éxito' });
  } catch (err) {
    console.error('Error al eliminar servicio:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al eliminar servicio' });
  }
});

module.exports = router;
