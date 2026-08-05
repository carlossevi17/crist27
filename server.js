require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to authenticate user via headers
async function authenticate(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'No autorizado. Falta el encabezado X-User-Id.' });
  }

  try {
    const user = await db.getUserById(parseInt(userId));
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado o no válido.' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error de autenticación: ' + error.message });
  }
}

// Middleware to restrict access to admin only
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
}

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (usuario y contraseña).' });
  }

  const role = 'user'; // Por defecto es usuario estándar. Rol admin se asigna manualmente en la base de datos.

  try {
    // Check if user limit is reached
    const users = await db.getAllUsers();
    if (users.length >= 30) {
      return res.status(400).json({ error: 'Límite máximo de 30 usuarios alcanzado.' });
    }

    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe.' });
    }

    const result = await db.createUser(username, password, role);
    const newUser = await db.getUserById(result.id);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(400).json({ error: 'Credenciales incorrectas.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Credenciales incorrectas.' });
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Users List (for assignment)
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Polls Endpoints
app.get('/api/polls', authenticate, async (req, res) => {
  try {
    const polls = await db.getPollsWithResults(req.user.id);
    res.json(polls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/polls', authenticate, requireAdmin, async (req, res) => {
  const { question, type, options } = req.body;
  if (!question || !type || !options || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Datos de la encuesta inválidos. Debe tener pregunta y al menos 2 opciones.' });
  }

  try {
    const pollId = await db.createPoll(question, type, options);
    res.status(201).json({ message: 'Encuesta creada correctamente', pollId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/polls/:id/vote', authenticate, async (req, res) => {
  const pollId = parseInt(req.params.id);
  const { optionIds } = req.body; // Array of selected option IDs

  if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
    return res.status(400).json({ error: 'Debe seleccionar al menos una opción.' });
  }

  try {
    await db.submitVotes(pollId, req.user.id, optionIds);
    res.json({ message: 'Voto registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kanban Endpoints
app.get('/api/tasks', authenticate, async (req, res) => {
  try {
    const tasks = await db.getTasks();
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const { title, description, duration, importance, assignedTo } = req.body;
  if (!title || !importance) {
    return res.status(400).json({ error: 'El título y la importancia son obligatorios.' });
  }

  try {
    const result = await db.createTask(title, description, duration, importance, assignedTo, req.user.id);
    res.status(201).json({ message: 'Tarea creada correctamente', taskId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id/status', authenticate, async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { status } = req.body;

  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Estado de tarea no válido.' });
  }

  try {
    await db.updateTaskStatus(taskId, status);
    res.json({ message: 'Estado de la tarea actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = parseInt(req.params.id);
  try {
    await db.deleteTask(taskId);
    res.json({ message: 'Tarea eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route to serve Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize DB and start server
db.initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
