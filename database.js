require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, process.env.DB_PATH || 'database.db');
const db = new sqlite3.Database(dbPath);

// Helper function to run query
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// Helper function to get single row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper function to get multiple rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize Database
async function initDb() {
  // Create tables
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user'))
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('single', 'multiple')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      FOREIGN KEY (poll_id) REFERENCES polls (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES poll_options (id) ON DELETE CASCADE,
      UNIQUE(poll_id, user_id, option_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      duration TEXT,
      importance TEXT NOT NULL CHECK(importance IN ('low', 'medium', 'high')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed')),
      assigned_to INTEGER,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Insert default users if table is empty
  const usersCount = await get(`SELECT COUNT(*) as count FROM users`);
  if (usersCount.count === 0) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    await run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ['admin', adminPassword, 'admin']);
    await run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ['user', userPassword, 'user']);
    console.log('Database initialized with default users: admin/admin123 and user/user123');
  }
}

module.exports = {
  initDb,
  run,
  get,
  all,
  // Auth Functions
  async createUser(username, password, role) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hashedPassword, role]);
  },
  async getUserByUsername(username) {
    return get(`SELECT * FROM users WHERE username = ?`, [username]);
  },
  async getUserById(id) {
    return get(`SELECT id, username, role FROM users WHERE id = ?`, [id]);
  },
  async getAllUsers() {
    return all(`SELECT id, username, role FROM users`);
  },
  // Polls Functions
  async createPoll(question, type, options) {
    const result = await run(`INSERT INTO polls (question, type) VALUES (?, ?)`, [question, type]);
    const pollId = result.id;
    for (const option of options) {
      await run(`INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)`, [pollId, option]);
    }
    return pollId;
  },
  async getPollsWithResults(userId) {
    const polls = await all(`SELECT * FROM polls ORDER BY created_at DESC`);
    const pollsWithDetails = [];

    for (const poll of polls) {
      const options = await all(`SELECT * FROM poll_options WHERE poll_id = ?`, [poll.id]);
      const votes = await all(`SELECT * FROM votes WHERE poll_id = ?`, [poll.id]);

      // Calculate results
      const totalVotes = votes.length;
      const optionsWithVotes = options.map(opt => {
        const optVotes = votes.filter(v => v.option_id === opt.id).length;
        return {
          ...opt,
          votesCount: optVotes,
          percentage: totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0
        };
      });

      // Find user votes
      const userVotes = votes.filter(v => v.user_id === userId).map(v => v.option_id);

      pollsWithDetails.push({
        id: poll.id,
        question: poll.question,
        type: poll.type,
        options: optionsWithVotes,
        totalVotes,
        userVoted: userVotes.length > 0,
        userVotes
      });
    }

    return pollsWithDetails;
  },
  async submitVotes(pollId, userId, optionIds) {
    // Delete existing votes for this poll by this user
    await run(`DELETE FROM votes WHERE poll_id = ? AND user_id = ?`, [pollId, userId]);

    // Insert new votes
    for (const optionId of optionIds) {
      await run(`INSERT INTO votes (poll_id, user_id, option_id) VALUES (?, ?, ?)`, [pollId, userId, optionId]);
    }
  },
  // Tasks Functions
  async createTask(title, description, duration, importance, assignedTo, createdBy) {
    return run(
      `INSERT INTO tasks (title, description, duration, importance, status, assigned_to, created_by) 
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [title, description, duration, importance, assignedTo || null, createdBy]
    );
  },
  async getTasks() {
    return all(`
      SELECT t.*, u.username as assigned_to_username, creator.username as created_by_username
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      ORDER BY t.created_at DESC
    `);
  },
  async updateTaskStatus(taskId, status) {
    return run(`UPDATE tasks SET status = ? WHERE id = ?`, [status, taskId]);
  },
  async deleteTask(taskId) {
    return run(`DELETE FROM tasks WHERE id = ?`, [taskId]);
  }
};
