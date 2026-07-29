const express = require('express');
const router = express.Router();
const Tag = require('../models/Tag');

// @route   GET /api/tags
// @desc    Obtener lista de etiquetas oficiales
router.get('/', async (req, res) => {
  try {
    const { categoria, tipo, q } = req.query;
    let query = {};

    if (categoria && categoria !== 'Todas') {
      query.categoria = categoria;
    }

    if (tipo && tipo !== 'ambos') {
      query.tipo = { $in: [tipo, 'ambos'] };
    }

    if (q) {
      query.nombre = { $regex: q, $options: 'i' };
    }

    const tags = await Tag.find(query).sort({ nombre: 1 });
    return res.json(tags);
  } catch (err) {
    console.error('Error al obtener etiquetas:', err);
    return res.status(500).json({ msg: 'Error al obtener etiquetas' });
  }
});

// @route   POST /api/tags
// @desc    Crear una nueva etiqueta oficial (Admin)
router.post('/', async (req, res) => {
  try {
    const { nombre, tipo, categoria } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ msg: 'El nombre de la etiqueta es requerido.' });
    }

    const tagExistente = await Tag.findOne({ nombre: { $regex: `^${nombre.trim()}$`, $options: 'i' } });
    if (tagExistente) {
      return res.status(400).json({ msg: 'La etiqueta ya existe en el catálogo oficial.' });
    }

    const newTag = new Tag({
      nombre: nombre.trim(),
      tipo: tipo || 'ambos',
      categoria: categoria || 'Programación / Software'
    });

    const savedTag = await newTag.save();
    return res.status(201).json(savedTag);
  } catch (err) {
    console.error('Error al guardar etiqueta:', err);
    return res.status(500).json({ msg: 'Error al guardar la etiqueta' });
  }
});

// @route   DELETE /api/tags/:id
// @desc    Eliminar una etiqueta oficial (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({ msg: 'Etiqueta no encontrada' });
    }

    await Tag.findByIdAndDelete(req.params.id);
    return res.json({ msg: 'Etiqueta eliminada con éxito' });
  } catch (err) {
    console.error('Error al eliminar etiqueta:', err);
    return res.status(500).json({ msg: 'Error al eliminar la etiqueta' });
  }
});

module.exports = router;
