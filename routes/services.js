const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Service = require('../models/Service');

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
      autorId
    } = req.body;

    if (!nombreEstudiante || !areaEspecialidad || !descripcion) {
      return res.status(400).json({ msg: 'Por favor completa el nombre, especialidad y descripción del servicio.' });
    }

    const serviceFields = {
      nombreEstudiante,
      areaEspecialidad,
      descripcion,
      semestre: semestre || '1er Semestre',
      etiquetas: Array.isArray(etiquetas) ? etiquetas : [],
      fotoUrl: fotoUrl || ''
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
    const { etiqueta, busqueda } = req.query;
    let query = { disponible: true };

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

// @route   DELETE /api/services/:id
// @desc    Eliminar un servicio por ID (Permitido al creador o al Administrador)
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
