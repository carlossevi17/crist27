require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('ADVERTENCIA: SUPABASE_URL o SUPABASE_KEY no están definidas en el archivo .env.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Database (Resolve immediately since Supabase handles its own schema)
async function initDb() {
  console.log('Conectado a la base de datos de Supabase.');
}

module.exports = {
  initDb,
  // Auth Functions
  async createUser(username, password, role) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password: hashedPassword, role }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getUserByUsername(username) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getUserById(id) {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getAllUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role');

    if (error) throw error;
    return data;
  },

  async createPoll(question, type, options, isAdminOnly = false) {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ question, type, is_admin_only: isAdminOnly }])
      .select()
      .single();

    if (pollError) throw pollError;
    const pollId = poll.id;

    const optionsToInsert = options.map(opt => ({
      poll_id: pollId,
      option_text: opt
    }));

    const { error: optError } = await supabase
      .from('poll_options')
      .insert(optionsToInsert);

    if (optError) throw optError;
    return pollId;
  },

  async getPollsWithResults(userId, userRole) {
    let query = supabase.from('polls').select('*').order('created_at', { ascending: false });

    if (userRole !== 'admin') {
      query = query.or('is_admin_only.eq.false,is_admin_only.is.null');
    }

    const { data: polls, error: pollsError } = await query;
    const pollsWithDetails = [];

    for (const poll of polls) {
      const { data: options, error: optError } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', poll.id);
      
      if (optError) throw optError;

      const { data: votes, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('poll_id', poll.id);

      if (votesError) throw votesError;
      
      const totalVotes = votes.length;
      const optionsWithVotes = options.map(opt => {
        const optVotes = votes.filter(v => v.option_id === opt.id).length;
        return {
          ...opt,
          votesCount: optVotes,
          percentage: totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0
        };
      });

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
    const { error: deleteError } = await supabase
      .from('votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;
    
    // Insert new votes
    const votesToInsert = optionIds.map(optionId => ({
      poll_id: pollId,
      user_id: userId,
      option_id: optionId
    }));

    const { error: insertError } = await supabase
      .from('votes')
      .insert(votesToInsert);

    if (insertError) throw insertError;
  },

  async createTask(title, description, duration, importance, assignedTo, createdBy, isAdminOnly = false) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        title,
        description,
        duration,
        importance,
        status: 'pending',
        assigned_to: assignedTo || null,
        created_by: createdBy,
        is_admin_only: isAdminOnly
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getTasks(userRole) {
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

    if (userRole !== 'admin') {
      query = query.or('is_admin_only.eq.false,is_admin_only.is.null');
    }

    const { data: tasks, error: tasksError } = await query;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username');

    if (usersError) throw usersError;

    const userMap = {};
    users.forEach(u => {
      userMap[u.id] = u.username;
    });

    return tasks.map(task => ({
      ...task,
      assigned_to_username: task.assigned_to ? userMap[task.assigned_to] : null,
      created_by_username: task.created_by ? userMap[task.created_by] : null
    }));
  },

  async updateTask(taskId, title, description, duration, importance, assignedTo, isAdminOnly) {
    const { error } = await supabase
      .from('tasks')
      .update({
        title,
        description,
        duration,
        importance,
        assigned_to: assignedTo || null,
        is_admin_only: isAdminOnly
      })
      .eq('id', taskId);

    if (error) throw error;
  },

  async updateTaskStatus(taskId, status) {
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId);

    if (error) throw error;
  },

  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  }
};
