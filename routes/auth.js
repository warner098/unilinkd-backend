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
    // 1. Verificar si el usuario ya existe
    let user = await User.findOne({ correo });
    if (user) {
      return res.status(400).json({ msg: 'El correo ya está registrado' });
    }

    // 2. Crear instancia del nuevo usuario
    user = new User({
      nombre,
      correo,
      password,
      areas,
      semestre
    });

    // 3. Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // 4. Guardar en BD
    await user.save();

    // 5. Generar Token JWT
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            nombre: user.nombre,
            correo: user.correo,
            areas: user.areas,
            semestre: user.semestre
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
    // 1. Verificar si existe el usuario
    let user = await User.findOne({ correo });
    if (!user) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    // 2. Verificar la contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Credenciales inválidas' });
    }

    // 3. Generar Token JWT
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: {
            id: user.id,
            nombre: user.nombre,
            correo: user.correo,
            areas: user.areas,
            semestre: user.semestre
          }
        });
      }
    );

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error en el servidor');
  }
});

module.exports = router;