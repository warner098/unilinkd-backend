const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Notification = require('../models/Notification');

// @route   POST /api/projects
// @desc    Crear un nuevo proyecto / convocatoria
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
// @desc    Obtener lista de proyectos
router.get('/', async (req, res) => {
  try {
    const { categoria, etiqueta, estado, autorId, autorNombre } = req.query;
    let query = {};

    // Si se consulta por autor específico (para la pestaña "Mis Publicaciones"), entregar todas sus publicaciones sin importar estado
    if (autorId || autorNombre) {
      const orConditions = [];
      if (autorId && mongoose.Types.ObjectId.isValid(autorId)) {
        orConditions.push({ autorId: autorId });
      }
      if (autorNombre) {
        orConditions.push({ autor: new RegExp(`^${autorNombre.trim()}$`, 'i') });
      }
      if (orConditions.length > 0) {
        query.$or = orConditions;
      }
    } else {
      // De lo contrario, aplicar filtro de estado
      if (estado === 'pendiente') {
        query.estado = 'pendiente';
      } else if (estado === 'rechazado') {
        query.estado = 'rechazado';
      } else if (estado !== 'todos') {
        query.estado = 'aprobado';
      }
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

// @route   PUT /api/projects/:id
// @desc    Editar un proyecto existente
router.put('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ msg: 'Proyecto no encontrado' });
    }

    const {
      titulo,
      descripcion,
      mediaUrl,
      repoUrl,
      categoriaPrincipal,
      colaboradoresBuscados,
      etiquetas,
      userRol,
      userId
    } = req.body;

    // Verificar permisos
    const isAdmin = userRol === 'admin';
    const isOwner = (userId && project.autorId && project.autorId.toString() === userId.toString());

    if (!isAdmin && project.autorId && !isOwner) {
      return res.status(403).json({ msg: 'No tienes permisos para editar este proyecto.' });
    }

    if (titulo) project.titulo = titulo;
    if (descripcion) project.descripcion = descripcion;
    if (mediaUrl !== undefined) project.mediaUrl = mediaUrl;
    if (repoUrl !== undefined) project.repoUrl = repoUrl;
    if (categoriaPrincipal) project.categoriaPrincipal = categoriaPrincipal;
    if (colaboradoresBuscados) project.colaboradoresBuscados = colaboradoresBuscados;
    if (Array.isArray(etiquetas)) project.etiquetas = etiquetas;

    // Si un usuario edita un proyecto rechazado o pendiente, vuelve a revisión
    if (!isAdmin && project.estado === 'rechazado') {
      project.estado = 'pendiente';
    }

    const updatedProject = await project.save();
    return res.json(updatedProject);
  } catch (err) {
    console.error('Error al editar proyecto:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al editar proyecto' });
  }
});

// @route   PUT /api/projects/:id/estado
// @desc    Actualizar el estado de revisión de un proyecto y notificar al usuario
router.put('/:id/estado', async (req, res) => {
  try {
    const { estado, motivoRechazo } = req.body;
    if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) {
      return res.status(400).json({ msg: 'Estado de revisión no válido' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ msg: 'Proyecto no encontrado' });
    }

    project.estado = estado;
    await project.save();

    // GENERAR NOTIFICACIÓN PARA EL AUTOR DEL PROYECTO
    const recipientId = project.autorId ? project.autorId.toString() : (project.autor || '').trim().toLowerCase();

    if (recipientId) {
      let notifTitle = '';
      let notifMessage = '';

      if (estado === 'aprobado') {
        notifTitle = '🎉 ¡Tu Proyecto ha sido Aprobado!';
        notifMessage = `Tu proyecto "${project.titulo}" fue revisado y APROBADO por el Administrador. Ya se encuentra disponible para toda la comunidad UniLinkd.`;
      } else if (estado === 'rechazado') {
        notifTitle = '⚠️ Tu Proyecto requiere corrección / Rechazado';
        notifMessage = `Tu proyecto "${project.titulo}" no ha sido aprobado por la siguiente razón: ${motivoRechazo || 'Información o contenido inadecuado'}. Puedes editarlo en "Mis Publicaciones" y enviarlo nuevamente.`;
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

    return res.json({ msg: `Proyecto marcado como ${estado} con éxito`, project });
  } catch (err) {
    console.error('Error al actualizar estado del proyecto:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al actualizar estado' });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Eliminar un proyecto por ID
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
