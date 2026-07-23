const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST /api/auth/register
// @desc    Registrar nuevo usuario
router.post('/register', async (req, res) => {
  const { nombre, correo, password, areas, semestre } = req.body;

  try {
    let user = await User.findOne({ correo });
    if (user) {
      return res.status(400).json({ msg: 'El correo ya está registrado' });
    }

    user = new User({
      nombre,
      correo,
      password,
      areas,
      semestre
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secretotemporalkey',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            nombre: user.nombre,
            correo: user.correo,
            titulo: user.titulo,
            facultad: user.facultad,
            carrera: user.carrera,
            semestre: user.semestre,
            bio: user.bio,
            fotoUrl: user.fotoUrl,
            areas: user.areas,
            habilidades: user.habilidades
          }
        });
      }
    );

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error en el servidor');
  }
});

// @route   POST /api/auth/login
// @desc    Iniciar sesión
router.post('/login', async (req, res) => {
  const { correo, password } = req.body;

  try {
    let user = await User.findOne({ correo });
    if (!user) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secretotemporalkey',
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            nombre: user.nombre,
            correo: user.correo,
            titulo: user.titulo,
            facultad: user.facultad,
            carrera: user.carrera,
            semestre: user.semestre,
            bio: user.bio,
            fotoUrl: user.fotoUrl,
            areas: user.areas,
            habilidades: user.habilidades
          }
        });
      }
    );

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error en el servidor');
  }
});

// @route   PUT /api/auth/perfil
// @desc    Actualizar perfil de usuario en la Base de Datos
router.put('/perfil', async (req, res) => {
  const { id, correo, nombre, titulo, facultad, carrera, semestre, bio, fotoUrl, areas, habilidades } = req.body;

  try {
    // Buscar por ID o por Correo
    let user = await User.findOne({ $or: [{ _id: id }, { correo: correo }] });

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // Actualizar datos
    if (nombre) user.nombre = nombre;
    if (titulo !== undefined) user.titulo = titulo;
    if (facultad !== undefined) user.facultad = facultad;
    if (carrera !== undefined) user.carrera = carrera;
    if (semestre) user.semestre = semestre;
    if (bio !== undefined) user.bio = bio;
    if (fotoUrl !== undefined) user.fotoUrl = fotoUrl;
    if (areas) user.areas = areas;
    if (habilidades) user.habilidades = habilidades;

    await user.save();

    res.json({
      msg: 'Perfil actualizado con éxito',
      user: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        titulo: user.titulo,
        facultad: user.facultad,
        carrera: user.carrera,
        semestre: user.semestre,
        bio: user.bio,
        fotoUrl: user.fotoUrl,
        areas: user.areas,
        habilidades: user.habilidades
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al actualizar el perfil en el servidor');
  }
});

module.exports = router;