require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
    const user = await db.getUserById(userId);
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
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (usuario, email y contraseña).' });
  }

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

    // First user is admin, otherwise user
    const role = users.length === 0 ? 'admin' : 'user';

    const { data, error } = await db.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          role
        }
      }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const newUser = await db.getUserById(data.user.id);
    res.status(201).json(newUser || { id: data.user.id, username, role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos.' });
  }

  try {
    const { data, error } = await db.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: 'Credenciales incorrectas: ' + error.message });
    }

    const user = await db.getUserById(data.user.id);
    if (!user) {
      return res.status(400).json({ error: 'Perfil de usuario no encontrado en la base de datos.' });
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

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
  }

  try {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.get('host');
    const redirectUrl = `${proto}://${host}/`;

    const { error } = await db.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Correo de recuperación enviado correctamente.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { accessToken, newPassword } = req.body;
  if (!accessToken || !newPassword) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  try {
    const { error: sessionError } = await db.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: ''
    });

    if (sessionError) {
      return res.status(400).json({ error: 'Token inválido o expirado.' });
    }

    const { error: updateError } = await db.supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      return res.status(400).json({ error: 'No se pudo actualizar la contraseña: ' + updateError.message });
    }

    await db.supabase.auth.signOut();

    res.json({ message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
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
    const polls = await db.getPollsWithResults(req.user.id, req.user.role);
    res.json(polls);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/polls', authenticate, requireAdmin, async (req, res) => {
  const { question, type, options, isAdminOnly } = req.body;
  if (!question || !type || !options || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'Datos de la encuesta inválidos. Debe tener pregunta y al menos 2 opciones.' });
  }

  try {
    const pollId = await db.createPoll(question, type, options, !!isAdminOnly);
    res.status(201).json({ message: 'Encuesta creada correctamente', pollId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/polls/:id', authenticate, requireAdmin, async (req, res) => {
  const pollId = parseInt(req.params.id);
  const { question, type, isAdminOnly } = req.body;

  if (!question || !type) {
    return res.status(400).json({ error: 'La pregunta y el tipo son obligatorios.' });
  }

  try {
    await db.updatePoll(pollId, question, type, !!isAdminOnly);
    res.json({ message: 'Encuesta actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/polls/:id', authenticate, requireAdmin, async (req, res) => {
  const pollId = parseInt(req.params.id);
  try {
    await db.deletePoll(pollId);
    res.json({ message: 'Encuesta eliminada correctamente' });
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
    const tasks = await db.getTasks(req.user.role);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', authenticate, async (req, res) => {
  const { title, description, dueDate, importance, assignedTo, isAdminOnly } = req.body;
  if (!title || !importance) {
    return res.status(400).json({ error: 'El título y la importancia son obligatorios.' });
  }

  // Double check: Only admins can create admin-only tasks
  const enforceAdminOnly = req.user.role === 'admin' ? !!isAdminOnly : false;

  try {
    const result = await db.createTask(title, description, dueDate, importance, assignedTo, req.user.id, enforceAdminOnly);
    res.status(201).json({ message: 'Tarea creada correctamente', taskId: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = parseInt(req.params.id);
  const { title, description, dueDate, importance, assignedTo, isAdminOnly } = req.body;

  if (!title || !importance) {
    return res.status(400).json({ error: 'El título y la importancia son obligatorios.' });
  }

  // Only admins can make a task admin-only
  const enforceAdminOnly = req.user.role === 'admin' ? !!isAdminOnly : false;

  try {
    await db.updateTask(taskId, title, description, dueDate, importance, assignedTo, enforceAdminOnly);
    res.json({ message: 'Tarea actualizada correctamente' });
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
