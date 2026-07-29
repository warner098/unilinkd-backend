const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');

// @route   GET /api/notifications/:usuarioId
// @desc    Obtener lista de notificaciones para un usuario (por ID o por Nombre)
router.get('/:usuarioId', async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const { autorNombre } = req.query;

    let query = {
      $or: [
        { usuarioId: usuarioId }
      ]
    };

    if (autorNombre) {
      query.$or.push({ usuarioId: autorNombre.trim().toLowerCase() });
    }

    const notifications = await Notification.find(query).sort({ fechaCreacion: -1 });
    return res.json(notifications);
  } catch (err) {
    console.error('Error al obtener notificaciones:', err);
    return res.status(500).json({ msg: 'Error interno en el servidor al obtener notificaciones' });
  }
});

// @route   PUT /api/notifications/:id/leido
// @desc    Marcar una notificación como leída
router.put('/:id/leido', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ msg: 'Notificación no encontrada' });
    }

    notification.leido = true;
    await notification.save();

    return res.json(notification);
  } catch (err) {
    console.error('Error al marcar notificación:', err);
    return res.status(500).json({ msg: 'Error interno al actualizar notificación' });
  }
});

// @route   DELETE /api/notifications/:id
// @desc    Eliminar una notificación
router.delete('/:id', async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    return res.json({ msg: 'Notificación eliminada' });
  } catch (err) {
    console.error('Error al eliminar notificación:', err);
    return res.status(500).json({ msg: 'Error al eliminar notificación' });
  }
});

module.exports = router;
