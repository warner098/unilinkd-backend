const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

// Helper para formatear objeto de usuario devuelto al cliente
const formatUserResponse = (user) => ({
  id: user.id || user._id,
  googleId: user.googleId || '',
  nombre: user.nombre,
  correo: user.correo,
  rol: user.rol,
  titulo: user.titulo,
  facultad: user.facultad,
  carrera: user.carrera,
  semestre: user.semestre,
  bio: user.bio,
  fotoUrl: user.fotoUrl,
  areas: user.areas,
  habilidades: user.habilidades,
  portafolio: user.portafolio || []
});

// Helper seguro para buscar usuarios por ID, googleId o Correo sin errores de CastError en Mongoose
const findUserByIdOrEmail = async (id, correo) => {
  let user = null;

  if (id && mongoose.Types.ObjectId.isValid(id) && id.toString().length === 24) {
    user = await User.findById(id);
  }

  if (!user && correo) {
    user = await User.findOne({ correo: correo.toLowerCase() });
  }

  if (!user && id) {
    user = await User.findOne({ googleId: id.toString() });
  }

  return user;
};

// @route   GET /api/auth/usuario/:identifier
// @desc    Obtener el perfil público de un usuario por su ID, googleId, Nombre o Correo
router.get('/usuario/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let user;

    const decoded = decodeURIComponent(identifier).trim();

    // 1. Si es un ObjectId válido de Mongoose (24 caracteres hex)
    if (mongoose.Types.ObjectId.isValid(decoded) && decoded.length === 24) {
      user = await User.findById(decoded);
    }

    // 2. Buscar por googleId, correo o coincidencia de nombre
    if (!user) {
      const escaped = decoded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      user = await User.findOne({
        $or: [
          { googleId: decoded },
          { correo: decoded.toLowerCase() },
          { nombre: new RegExp(`^${escaped}$`, 'i') },
          { nombre: new RegExp(escaped, 'i') }
        ]
      });
    }

    // 3. Búsqueda por la primera palabra del nombre si no es un ID de google
    if (!user && !decoded.toLowerCase().startsWith('google')) {
      const firstName = decoded.split(' ')[0];
      if (firstName && firstName.length > 2) {
        const escapedFirst = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        user = await User.findOne({ nombre: new RegExp(escapedFirst, 'i') });
      }
    }

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    res.json(formatUserResponse(user));
  } catch (err) {
    console.error('Error al obtener usuario por identificador:', err);
    res.status(500).send('Error al obtener perfil del usuario');
  }
});

// @route   POST /api/auth/google-sync
// @desc    Sincronizar o crear usuario de Google de forma única en MongoDB
router.post('/google-sync', async (req, res) => {
  const { googleId, id, nombre, correo, fotoUrl, semestre, areas, titulo, facultad, carrera } = req.body;

  try {
    if (!correo) {
      return res.status(400).json({ msg: 'El correo electrónico es requerido' });
    }

    const targetGoogleId = googleId || id || '';
    const userEmail = correo.toLowerCase();

    let user = await User.findOne({
      $or: [
        { correo: userEmail },
        ...(targetGoogleId ? [{ googleId: targetGoogleId }] : [])
      ]
    });

    if (!user) {
      // Registrar nuevo usuario de Google en MongoDB
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(randomPassword, salt);

      user = new User({
        googleId: targetGoogleId,
        nombre: nombre || 'Estudiante Google',
        correo: userEmail,
        password: hashedPassword,
        rol: (userEmail === 'admin@unilinkd.com') ? 'admin' : 'estudiante',
        fotoUrl: fotoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        semestre: semestre || '5to Semestre',
        areas: areas || ['Tecnologías de la Información / Software'],
        titulo: titulo || 'Estudiante Universitario',
        facultad: facultad || 'Facultad de Ciencias Informáticas',
        carrera: carrera || 'Tecnologías de la Información',
        portafolio: []
      });

      await user.save();
    } else {
      // Si el usuario ya existe pero no tenía asociado googleId, vincularlo
      if (targetGoogleId && !user.googleId) {
        user.googleId = targetGoogleId;
        await user.save();
      }
    }

    res.json({
      msg: 'Usuario de Google sincronizado con éxito',
      user: formatUserResponse(user)
    });
  } catch (err) {
    console.error('Error al sincronizar usuario de Google:', err);
    res.status(500).send('Error en el servidor al sincronizar usuario');
  }
});

// @route   POST /api/auth/register
// @desc    Registrar nuevo usuario
router.post('/register', async (req, res) => {
  const { nombre, correo, password, areas, semestre } = req.body;

  try {
    let user = await User.findOne({ correo: correo.toLowerCase() });
    if (user) {
      return res.status(400).json({ msg: 'El correo ya está registrado' });
    }

    // Asignar rol de admin automáticamente si es admin@unilinkd.com
    const rol = (correo.toLowerCase() === 'admin@unilinkd.com') ? 'admin' : 'estudiante';

    user = new User({
      nombre,
      correo: correo.toLowerCase(),
      password,
      rol,
      areas,
      semestre,
      portafolio: []
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const payload = {
      user: {
        id: user.id,
        rol: user.rol
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
          user: formatUserResponse(user)
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
    let user = await User.findOne({ correo: correo.toLowerCase() });
    if (!user) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    // Asegurar que admin@unilinkd.com tenga rol de admin si no lo tenía previamente
    if (user.correo === 'admin@unilinkd.com' && user.rol !== 'admin') {
      user.rol = 'admin';
      await user.save();
    }

    const payload = {
      user: {
        id: user.id,
        rol: user.rol
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
          user: formatUserResponse(user)
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
    let user = await findUserByIdOrEmail(id, correo);

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

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
      user: formatUserResponse(user)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error al actualizar el perfil en el servidor');
  }
});

// @route   POST /api/auth/portafolio
// @desc    Agregar un proyecto al portafolio del usuario
router.post('/portafolio', async (req, res) => {
  const { userId, correo, titulo, categoria, repoUrl, descripcion, mediaUrl, referencias, etiquetas } = req.body;

  try {
    let user = await findUserByIdOrEmail(userId, correo);

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    const nuevoProyecto = {
      id: 'port_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      titulo,
      categoria,
      repoUrl: repoUrl || '',
      descripcion,
      mediaUrl: mediaUrl || '',
      referencias: referencias || '',
      etiquetas: etiquetas || [],
      fecha: new Date()
    };

    if (!user.portafolio) user.portafolio = [];
    user.portafolio.unshift(nuevoProyecto);

    await user.save();

    res.json({
      msg: 'Proyecto agregado al portafolio con éxito',
      user: formatUserResponse(user),
      proyecto: nuevoProyecto
    });
  } catch (err) {
    console.error('Error al agregar proyecto al portafolio:', err);
    res.status(500).send('Error al guardar el proyecto en el portafolio');
  }
});

// @route   DELETE /api/auth/portafolio/:projectId
// @desc    Eliminar un proyecto del portafolio del usuario
router.delete('/portafolio/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { userId, correo } = req.body;

  try {
    let user = await findUserByIdOrEmail(userId, correo);

    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    user.portafolio = (user.portafolio || []).filter(
      (p) => (p.id || p._id?.toString()) !== projectId
    );

    await user.save();

    res.json({
      msg: 'Proyecto eliminado del portafolio con éxito',
      user: formatUserResponse(user)
    });
  } catch (err) {
    console.error('Error al eliminar proyecto del portafolio:', err);
    res.status(500).send('Error al eliminar el proyecto del portafolio');
  }
});

module.exports = router;