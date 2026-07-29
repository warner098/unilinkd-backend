const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');

// @route   POST /api/projects
// @desc    Crear un nuevo proyecto / convocatoria (Va a estado 'pendiente' a menos que sea Admin)
router.post('/', async (req, res) => {
  try {
    const {
      titulo,
      descripcion,
      mediaUrl,
      referencias,
      repoUrl,
      colaboradoresBuscados,
      categoriaPrincipal,
      etiquetas,
      autor,
      autorId,
      userRol
    } = req.body;

    if (!titulo || !descripcion || !categoriaPrincipal) {
      return res.status(400).json({ msg: 'Por favor completa el título, descripción y categoría principal.' });
    }

    // Si es admin, se aprueba automáticamente; si no, queda 'pendiente' de revisión
    const estadoInicial = (userRol === 'admin') ? 'aprobado' : 'pendiente';

    const projectFields = {
      titulo,
      descripcion,
      mediaUrl: mediaUrl || '',
      referencias: referencias || '',
      repoUrl: repoUrl || '',
      colaboradoresBuscados: colaboradoresBuscados || 'Colaboradores',
      categoriaPrincipal,
      etiquetas: Array.isArray(etiquetas) ? etiquetas : [],
      autor: autor || 'Estudiante UniLinkd',
      estado: estadoInicial
    };

    if (autorId && mongoose.Types.ObjectId.isValid(autorId)) {
      projectFields.autorId = autorId;
    }

    const newProject = new Project(projectFields);
    const savedProject = await newProject.save();

    return res.status(201).json(savedProject);
  } catch (err) {
    console.error('Error detallado al guardar proyecto:', err);
    return res.status(500).json({ msg: err.message || 'Error interno en el servidor al publicar proyecto' });
  }
});

// @route   GET /api/projects
// @desc    Obtener lista de proyectos (Por defecto devuelve únicamente los 'aprobados')
router.get('/', async (req, res) => {
  try {
    const { categoria, etiqueta, estado } = req.query;
    let query = {};

    // Si no se especifica estado o se solicita 'aprobado', filtrar por 'aprobado'
    if (estado === 'pendiente') {
      query.estado = 'pendiente';
    } else if (estado === 'rechazado') {
      query.estado = 'rechazado';
    } else if (estado !== 'todos') {
      query.estado = 'aprobado';
    }

    if (categoria && categoria !== 'Todas') {
      query.categoriaPrincipal = categoria;
    }

    if (etiqueta) {
      query.etiquetas = { $in: [etiqueta] };
    }

    const projects = await Project.find(query).sort({ fechaCreacion: -1 });
    return res.json(projects);
  } catch (err) {
    console.error('Error detallado al obtener proyectos:', err);
    return res.status(500).json({ msg: err.message || 'Error interno en el servidor al obtener proyectos' });
  }
});

// @route   PUT /api/projects/:id/estado
// @desc    Actualizar el estado de revisión de un proyecto (Aprobar / Rechazar)
router.put('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) {
      return res.status(400).json({ msg: 'Estado de revisión no válido' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ msg: 'Proyecto no encontrado' });
    }

    project.estado = estado;
    await project.save();

    return res.json({ msg: `Proyecto marcado como ${estado} con éxito`, project });
  } catch (err) {
    console.error('Error al actualizar estado del proyecto:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al actualizar estado' });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Eliminar un proyecto por ID (Permitido al creador o al Administrador)
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ msg: 'Proyecto no encontrado' });
    }

    const { userId, autorNombre, userRol } = req.body || {};

    const isAdmin = userRol === 'admin';
    const matchesId = userId && project.autorId && project.autorId.toString() === userId.toString();
    const matchesNombre = autorNombre && project.autor && project.autor.toLowerCase() === autorNombre.toLowerCase();

    if (!isAdmin && project.autorId && !matchesId && !matchesNombre) {
      return res.status(403).json({ msg: 'No tienes permisos para eliminar este proyecto.' });
    }

    await Project.findByIdAndDelete(req.params.id);
    return res.json({ msg: 'Proyecto eliminado con éxito' });
  } catch (err) {
    console.error('Error al eliminar proyecto:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al eliminar proyecto' });
  }
});

module.exports = router;
