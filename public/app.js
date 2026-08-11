// Application State
let currentUser = null;
let currentTab = 'polls';
let pollOptionCount = 2;

// API Config
const API_BASE = '/api';

// On Load
document.addEventListener('DOMContentLoaded', () => {
  // Check session
  const storedUser = sessionStorage.getItem('currentUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    showAppScreen();
  } else {
    showAuthScreen();
  }

  // Check URL hash for recovery token
  checkRecoveryToken();

  lucide.createIcons();
});

// Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle';
  if (type === 'error') icon = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// API Helper
async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (currentUser) {
    headers['X-User-Id'] = currentUser.id.toString();
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Algo salió mal');
  }
  return data;
}

// Screen Switchers
function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  
  // Set user header details
  document.getElementById('header-username').textContent = currentUser.username;
  document.getElementById('header-user-role').textContent = currentUser.role;
  document.getElementById('header-user-avatar').textContent = currentUser.username.substring(0, 2).toUpperCase();

  // Show admin actions
  const btnCreatePoll = document.getElementById('btn-create-poll');
  const pollsFilterBar = document.getElementById('polls-filter-bar');
  const kanbanAdminWrapper = document.getElementById('kanban-admin-board-toggle-wrapper');
  const pollAdminWrapper = document.getElementById('poll-admin-only-wrapper');
  const taskAdminWrapper = document.getElementById('task-admin-only-wrapper');
  const editPollAdminWrapper = document.getElementById('edit-poll-admin-only-wrapper');

  if (currentUser.role === 'admin' || currentUser.role === 'superuser') {
    btnCreatePoll.classList.remove('hidden');
    pollsFilterBar.classList.remove('hidden');
    kanbanAdminWrapper.classList.remove('hidden');
    pollAdminWrapper.classList.remove('hidden');
    taskAdminWrapper.classList.remove('hidden');
    editPollAdminWrapper.classList.remove('hidden');
  } else {
    btnCreatePoll.classList.add('hidden');
    pollsFilterBar.classList.add('hidden');
    kanbanAdminWrapper.classList.add('hidden');
    pollAdminWrapper.classList.add('hidden');
    taskAdminWrapper.classList.add('hidden');
    editPollAdminWrapper.classList.add('hidden');
  }

  // Show/Hide Superuser actions
  const navUsers = document.getElementById('nav-users');
  if (currentUser.role === 'superuser') {
    navUsers.classList.remove('hidden');
  } else {
    navUsers.classList.add('hidden');
  }

  // Show task action (any user can create tasks)
  document.getElementById('btn-create-task').classList.add('hidden'); // default, shown in kanban tab

  // Load appropriate tab
  switchAppTab(currentTab);
}

// Auth Handlers
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-password-form');
  const loginBtn = document.getElementById('tab-login-btn');
  const registerBtn = document.getElementById('tab-register-btn');
  const authError = document.getElementById('auth-error');
  const authSuccess = document.getElementById('auth-success');

  authError.classList.add('hidden');
  authSuccess.classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    forgotForm.classList.add('hidden');
    loginBtn.classList.add('active');
    registerBtn.classList.remove('active');
  } else if (tab === 'register') {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    forgotForm.classList.add('hidden');
    loginBtn.classList.remove('active');
    registerBtn.classList.add('active');
  }
}

function showForgotPasswordForm(event) {
  if (event) event.preventDefault();
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.remove('hidden');
  document.getElementById('tab-login-btn').classList.remove('active');
  document.getElementById('tab-register-btn').classList.remove('active');
}

function showLoginForm() {
  switchAuthTab('login');
}

async function handleLogin(event) {
  event.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorDiv = document.getElementById('auth-error');

  errorDiv.classList.add('hidden');

  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    });

    currentUser = data;
    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
    showAppScreen();
    showToast(`¡Bienvenido de nuevo, ${currentUser.username}!`);
    emailInput.value = '';
    passwordInput.value = '';
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('register-username');
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  const errorDiv = document.getElementById('auth-error');
  const successDiv = document.getElementById('auth-success');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  try {
    await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: usernameInput.value,
        email: emailInput.value,
        password: passwordInput.value
      })
    });

    successDiv.textContent = 'Registro exitoso. Revisa tu correo electrónico para confirmar tu cuenta y luego inicia sesión.';
    successDiv.classList.remove('hidden');
    switchAuthTab('login');
    usernameInput.value = '';
    emailInput.value = '';
    passwordInput.value = '';
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const emailInput = document.getElementById('forgot-email');
  const errorDiv = document.getElementById('auth-error');
  const successDiv = document.getElementById('auth-success');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  try {
    const data = await apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: emailInput.value
      })
    });

    successDiv.textContent = data.message;
    successDiv.classList.remove('hidden');
    emailInput.value = '';
  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  }
}

async function handleResetPassword(event) {
  event.preventDefault();
  const tokenInput = document.getElementById('reset-token');
  const newPasswordInput = document.getElementById('reset-new-password');

  try {
    const data = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        accessToken: tokenInput.value,
        newPassword: newPasswordInput.value
      })
    });

    showToast(data.message);
    document.getElementById('reset-password-modal').classList.add('hidden');
    document.getElementById('reset-password-form').reset();
    showLoginForm();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function checkRecoveryToken() {
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const type = params.get('type');
    
    if (accessToken && type === 'recovery') {
      window.location.hash = '';
      document.getElementById('reset-token').value = accessToken;
      document.getElementById('reset-password-modal').classList.remove('hidden');
    }
  }
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem('currentUser');
  showAuthScreen();
}

// Navigation Tabs
function switchAppTab(tab) {
  currentTab = tab;
  document.getElementById('nav-polls').classList.remove('active');
  document.getElementById('nav-kanban').classList.remove('active');
  document.getElementById('nav-users').classList.remove('active');
  document.getElementById('polls-view').classList.add('hidden');
  document.getElementById('kanban-view').classList.add('hidden');
  document.getElementById('users-view').classList.add('hidden');
  document.getElementById('btn-create-poll').classList.add('hidden');
  document.getElementById('btn-create-task').classList.add('hidden');

  if (tab === 'polls') {
    document.getElementById('nav-polls').classList.add('active');
    document.getElementById('polls-view').classList.remove('hidden');
    document.getElementById('tab-title').textContent = 'Encuestas';
    document.getElementById('tab-subtitle').textContent = 'Consulta o participa en los votos del equipo';
    if (currentUser.role === 'admin' || currentUser.role === 'superuser') {
      document.getElementById('btn-create-poll').classList.remove('hidden');
    }
    loadPolls();
  } else if (tab === 'kanban') {
    document.getElementById('nav-kanban').classList.add('active');
    document.getElementById('kanban-view').classList.remove('hidden');
    document.getElementById('tab-title').textContent = 'Tareas';
    document.getElementById('tab-subtitle').textContent = 'Gestiona, asigna y arrastra las tareas de tu equipo';
    document.getElementById('btn-create-task').classList.remove('hidden');
    loadKanban();
  } else if (tab === 'users') {
    document.getElementById('nav-users').classList.add('active');
    document.getElementById('users-view').classList.remove('hidden');
    document.getElementById('tab-title').textContent = 'Usuarios & Roles';
    document.getElementById('tab-subtitle').textContent = 'Administra los privilegios de los usuarios del sistema';
    loadUsersManagement();
  }
}

// POLLS MODULE
let allPolls = [];

async function loadPolls() {
  const grid = document.getElementById('polls-grid');
  grid.innerHTML = '<p class="text-muted">Cargando encuestas...</p>';

  try {
    allPolls = await apiFetch('/polls');
    filterPolls();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function filterPolls() {
  const scope = document.getElementById('polls-scope').value;
  let filtered = [];

  if (currentUser.role === 'admin' || currentUser.role === 'superuser') {
    if (scope === 'admin') {
      filtered = allPolls.filter(poll => poll.is_admin_only === true);
    } else {
      // General/Public
      filtered = allPolls.filter(poll => !poll.is_admin_only);
    }
  } else {
    filtered = allPolls; // Standard users only receive public ones
  }

  renderPolls(filtered);
}

function renderPolls(polls) {
  const grid = document.getElementById('polls-grid');
  grid.innerHTML = '';

  if (polls.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><p class="text-muted">No hay encuestas en esta sección.</p></div>';
    return;
  }

  polls.forEach(poll => {
    const card = document.createElement('div');
    card.className = 'poll-card';

    // Header info
    const typeBadge = poll.type === 'multiple' ? 'Voto Múltiple' : 'Voto Único';
    const adminBadge = poll.is_admin_only ? ' <span class="poll-badge" style="background:var(--danger-glow);color:var(--danger)">Admin</span>' : '';
    let headerHTML = `
      <div class="poll-card-header">
        <h4 class="poll-question">${escapeHTML(poll.question)}</h4>
        <div style="display:flex;gap:6px;">
          ${adminBadge}
          <span class="poll-badge">${typeBadge}</span>
        </div>
      </div>
      <div class="poll-options" id="options-poll-${poll.id}">
    `;

    // Options rendering
    poll.options.forEach(opt => {
      const isVoted = poll.userVotes.includes(opt.id);
      const inputType = poll.type === 'multiple' ? 'checkbox' : 'radio';
      
      headerHTML += `
        <div class="poll-option-row ${isVoted ? 'voted' : ''}" onclick="toggleOptionSelect(this, ${poll.id}, ${opt.id}, '${poll.type}')">
          <div class="poll-option-bar" style="width: ${opt.percentage}%"></div>
          <div class="poll-option-content">
            <span class="poll-option-text">
              <input type="${inputType}" name="poll-opt-${poll.id}" value="${opt.id}" ${isVoted ? 'checked' : ''} onclick="event.stopPropagation()">
              ${escapeHTML(opt.option_text)}
            </span>
            <span class="poll-option-percent">${opt.percentage}% (${opt.votesCount})</span>
          </div>
        </div>
      `;
    });

    headerHTML += `
      </div>
      <div class="poll-footer">
        <span>Votos totales: ${poll.totalVotes}</span>
        <span>${poll.userVoted ? '¡Ya has votado!' : 'No has votado aún'}</span>
      </div>
    `;

    // Submission button
    headerHTML += `
      <button class="btn btn-primary btn-block poll-vote-btn" onclick="submitPollVote(${poll.id}, '${poll.type}')">
        Enviar Voto <i data-lucide="send"></i>
      </button>
    `;

    // Action buttons for admins
    if (currentUser.role === 'admin' || currentUser.role === 'superuser') {
      headerHTML += `
        <div class="poll-admin-actions" style="display:flex; justify-content: flex-end; gap:8px; margin-top:12px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
          <button class="btn btn-outline btn-xs" onclick="openEditPollModal(${poll.id})">
            <i data-lucide="edit-3" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Editar
          </button>
          <button class="btn btn-outline btn-xs" onclick="deletePoll(${poll.id})" style="border-color:var(--danger);color:var(--danger)">
            <i data-lucide="trash-2" style="width:13px;height:13px;vertical-align:middle;margin-right:4px;"></i> Eliminar
          </button>
        </div>
      `;
    }

    card.innerHTML = headerHTML;
    grid.appendChild(card);
  });

  lucide.createIcons();
}

function toggleOptionSelect(rowEl, pollId, optionId, pollType) {
  const container = document.getElementById(`options-poll-${pollId}`);
  const input = rowEl.querySelector('input');

  if (pollType === 'single') {
    // Unselect all other rows in this container
    container.querySelectorAll('.poll-option-row').forEach(row => {
      row.classList.remove('voted');
      const rowInput = row.querySelector('input');
      if (rowInput) rowInput.checked = false;
    });
    // Select this row
    rowEl.classList.add('voted');
    input.checked = true;
  } else {
    // Multiple selection toggle
    rowEl.classList.toggle('voted');
    input.checked = !input.checked;
  }
}

async function submitPollVote(pollId, pollType) {
  const container = document.getElementById(`options-poll-${pollId}`);
  const checkedInputs = container.querySelectorAll('input:checked');

  if (checkedInputs.length === 0) {
    showToast('Selecciona al menos una opción para votar.', 'error');
    return;
  }

  const optionIds = Array.from(checkedInputs).map(input => parseInt(input.value));

  try {
    await apiFetch(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionIds })
    });
    showToast('¡Voto registrado correctamente!');
    loadPolls();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Create Poll Modals
function openCreatePollModal() {
  document.getElementById('create-poll-modal').classList.remove('hidden');
  pollOptionCount = 2;
  const container = document.getElementById('poll-options-container');
  container.innerHTML = `
    <input type="text" class="poll-option-input" placeholder="Opción 1" required>
    <input type="text" class="poll-option-input" placeholder="Opción 2" required>
  `;
}

function closeCreatePollModal() {
  document.getElementById('create-poll-modal').classList.add('hidden');
  document.getElementById('create-poll-form').reset();
}

function addPollOptionField() {
  pollOptionCount++;
  const container = document.getElementById('poll-options-container');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'poll-option-input';
  input.placeholder = `Opción ${pollOptionCount}`;
  input.required = true;
  container.appendChild(input);
}

async function handleCreatePoll(event) {
  event.preventDefault();
  const question = document.getElementById('poll-question').value;
  const type = document.getElementById('poll-type').value;
  const optionInputs = document.querySelectorAll('.poll-option-input');
  const isAdminOnly = document.getElementById('poll-is-admin-only').checked;
  
  const options = Array.from(optionInputs)
    .map(input => input.value.trim())
    .filter(val => val !== '');

  if (options.length < 2) {
    showToast('Debes añadir al menos 2 opciones.', 'error');
    return;
  }

  try {
    await apiFetch('/polls', {
      method: 'POST',
      body: JSON.stringify({ question, type, options, isAdminOnly })
    });

    showToast('Encuesta creada exitosamente.');
    closeCreatePollModal();
    loadPolls();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Edit Poll Handlers
function openEditPollModal(pollId) {
  const poll = allPolls.find(p => p.id === pollId);
  if (!poll) return;

  document.getElementById('edit-poll-modal').classList.remove('hidden');

  document.getElementById('edit-poll-id').value = poll.id;
  document.getElementById('edit-poll-question').value = poll.question;
  document.getElementById('edit-poll-type').value = poll.type;
  document.getElementById('edit-poll-is-admin-only').checked = !!poll.is_admin_only;
}

function closeEditPollModal() {
  document.getElementById('edit-poll-modal').classList.add('hidden');
  document.getElementById('edit-poll-form').reset();
}

async function handleEditPoll(event) {
  event.preventDefault();

  const pollId = document.getElementById('edit-poll-id').value;
  const question = document.getElementById('edit-poll-question').value;
  const type = document.getElementById('edit-poll-type').value;
  const isAdminOnly = document.getElementById('edit-poll-is-admin-only').checked;

  try {
    await apiFetch(`/polls/${pollId}`, {
      method: 'PUT',
      body: JSON.stringify({ question, type, isAdminOnly })
    });

    showToast('Encuesta actualizada correctamente.');
    closeEditPollModal();
    loadPolls();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deletePoll(pollId) {
  if (!confirm('¿Estás seguro de que quieres eliminar esta encuesta? Se borrarán también todos sus votos asociados.')) return;

  try {
    await apiFetch(`/polls/${pollId}`, {
      method: 'DELETE'
    });
    showToast('Encuesta eliminada correctamente.');
    loadPolls();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function toggleMaxChoices() {
  // Option to add extra criteria logic if needed
}


// KANBAN BOARD MODULE
let allTasks = [];

async function populateKanbanFilterDropdown() {
  const filterSelect = document.getElementById('kanban-filter-assigned');
  filterSelect.innerHTML = `
    <option value="all">Todos</option>
    <option value="me">Mis tareas</option>
    <option value="unassigned">Sin asignar</option>
  `;
  
  // Only add individual other users if current user is an admin
  if (currentUser.role === 'admin' || currentUser.role === 'superuser') {
    try {
      const users = await apiFetch('/users');
      users.forEach(user => {
        if (user.id !== currentUser.id) {
          const opt = document.createElement('option');
          opt.value = user.id;
          opt.textContent = user.username;
          filterSelect.appendChild(opt);
        }
      });
    } catch (error) {
      console.error('Error loading users for filter:', error);
    }
  }
}

async function loadKanban() {
  try {
    allTasks = await apiFetch('/tasks');
    await populateKanbanFilterDropdown();
    filterKanbanTasks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function filterKanbanTasks() {
  const assignedFilter = document.getElementById('kanban-filter-assigned').value;
  const scopeFilter = document.getElementById('kanban-board-scope').value;
  let filtered = allTasks;

  // 1. Filter by scope
  if (currentUser.role === 'admin' || currentUser.role === 'superuser') {
    if (scopeFilter === 'admin') {
      filtered = filtered.filter(task => task.is_admin_only === true);
    } else {
      filtered = filtered.filter(task => !task.is_admin_only);
    }
  } else {
    // Normal user only sees general anyway
    filtered = filtered.filter(task => !task.is_admin_only);
  }

  // 2. Filter by assignee
  if (assignedFilter === 'me') {
    filtered = filtered.filter(task => task.assigned_to === currentUser.id);
  } else if (assignedFilter === 'unassigned') {
    filtered = filtered.filter(task => !task.assigned_to);
  } else if (assignedFilter !== 'all') {
    filtered = filtered.filter(task => task.assigned_to === assignedFilter);
  }

  renderKanbanTasks(filtered);
}

function renderKanbanTasks(tasks) {
  // Clear columns
  const columns = {
    pending: document.getElementById('tasks-pending'),
    in_progress: document.getElementById('tasks-in_progress'),
    completed: document.getElementById('tasks-completed')
  };
  
  columns.pending.innerHTML = '';
  columns.in_progress.innerHTML = '';
  columns.completed.innerHTML = '';

  const counts = { pending: 0, in_progress: 0, completed: 0 };

  tasks.forEach(task => {
    counts[task.status]++;
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.id = `task-${task.id}`;
    card.setAttribute('ondragstart', `handleDragStart(event, ${task.id})`);
    card.setAttribute('onclick', `openEditTaskModal(${task.id})`);

    const importanceText = {
      low: 'Baja',
      medium: 'Media',
      high: 'Alta'
    }[task.importance];

    let isOverdue = false;
    if (task.due_date && task.status !== 'completed') {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      isOverdue = task.due_date <= todayStr;
    }

    card.innerHTML = `
      <div class="task-card-header">
        <span class="task-title">${escapeHTML(task.title)}</span>
        <span class="task-badge-importance importance-${task.importance}">${importanceText}</span>
      </div>
      ${task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : ''}
      <div class="task-meta">
        <div class="task-meta-left">
          ${task.due_date ? `
            <span class="${isOverdue ? 'task-overdue' : ''}">
              <i data-lucide="calendar" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>
              ${formatDate(task.due_date)}
              ${isOverdue ? ' ⚠️' : ''}
            </span>
          ` : ''}
        </div>
        <div class="task-assigned-badge">
          <i data-lucide="user" style="width:11px;height:11px;"></i>
          <span>${task.assigned_to_username ? escapeHTML(task.assigned_to_username) : 'Sin asignar'}</span>
        </div>
      </div>
      <div class="task-actions">
        <div class="task-nav-buttons">
          ${task.status !== 'pending' ? `<button class="btn-task-action" onclick="moveTaskBtn(event, ${task.id}, '${task.status}', 'prev')"><i data-lucide="arrow-left" style="width:14px;height:14px;"></i></button>` : ''}
          ${task.status !== 'completed' ? `<button class="btn-task-action" onclick="moveTaskBtn(event, ${task.id}, '${task.status}', 'next')"><i data-lucide="arrow-right" style="width:14px;height:14px;"></i></button>` : ''}
        </div>
        <button class="btn-task-action btn-task-delete" onclick="deleteTask(event, ${task.id})">
          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
        </button>
      </div>
    `;

    columns[task.status].appendChild(card);
  });

  // Update counts
  document.getElementById('count-pending').textContent = counts.pending;
  document.getElementById('count-in_progress').textContent = counts.in_progress;
  document.getElementById('count-completed').textContent = counts.completed;

  lucide.createIcons();
}

// Drag and drop mechanics
function handleDragStart(event, taskId) {
  event.dataTransfer.setData('text/plain', taskId);
}

function allowDrop(event) {
  event.preventDefault();
}

async function handleDrop(event, status) {
  event.preventDefault();
  const taskId = event.dataTransfer.getData('text/plain');
  if (!taskId) return;

  try {
    await apiFetch(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    showToast('Estado de la tarea actualizado.');
    loadKanban();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Mobile/Button change status mechanics
async function moveTaskBtn(event, taskId, currentStatus, direction) {
  event.stopPropagation(); // Avoid opening edit modal
  let newStatus = currentStatus;
  if (currentStatus === 'pending') {
    if (direction === 'next') newStatus = 'in_progress';
  } else if (currentStatus === 'in_progress') {
    newStatus = direction === 'next' ? 'completed' : 'pending';
  } else if (currentStatus === 'completed') {
    if (direction === 'prev') newStatus = 'in_progress';
  }

  try {
    await apiFetch(`/tasks/${taskId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    showToast('Estado de la tarea actualizado.');
    loadKanban();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteTask(event, taskId) {
  event.stopPropagation(); // Avoid opening edit modal
  if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;
  
  try {
    await apiFetch(`/tasks/${taskId}`, {
      method: 'DELETE'
    });
    showToast('Tarea eliminada correctamente.');
    loadKanban();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Task Modal Handlers
async function openCreateTaskModal() {
  document.getElementById('create-task-modal').classList.remove('hidden');
  
  // Populate users list
  const select = document.getElementById('task-assigned');
  select.innerHTML = '<option value="">Sin asignar</option>';
  
  try {
    const users = await apiFetch('/users');
    users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.username;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Error loading users list:', error);
  }
}

function closeCreateTaskModal() {
  document.getElementById('create-task-modal').classList.add('hidden');
  document.getElementById('create-task-form').reset();
}

async function handleCreateTask(event) {
  event.preventDefault();
  
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const dueDate = document.getElementById('task-duration').value;
  const importance = document.getElementById('task-importance').value;
  const assignedTo = document.getElementById('task-assigned').value;
  const isAdminOnly = document.getElementById('task-is-admin-only').checked;

  try {
    await apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        dueDate,
        importance,
        assignedTo: assignedTo || null,
        isAdminOnly
      })
    });

    showToast('Tarea creada correctamente.');
    closeCreateTaskModal();
    loadKanban();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Edit Task Modal Handlers
async function openEditTaskModal(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('edit-task-modal').classList.remove('hidden');

  // Fill in hidden ID
  document.getElementById('edit-task-id').value = task.id;
  document.getElementById('edit-task-title').value = task.title;
  document.getElementById('edit-task-description').value = task.description || '';
  document.getElementById('edit-task-duration').value = task.due_date || '';
  document.getElementById('edit-task-importance').value = task.importance;

  // Toggle admin wrapper display
  const adminWrapper = document.getElementById('edit-task-admin-only-wrapper');
  const checkbox = document.getElementById('edit-task-is-admin-only');
  checkbox.checked = !!task.is_admin_only;
  if (currentUser.role === 'admin' || currentUser.role === 'superuser') {
    adminWrapper.classList.remove('hidden');
  } else {
    adminWrapper.classList.add('hidden');
  }

  // Populate users list in edit modal
  const select = document.getElementById('edit-task-assigned');
  select.innerHTML = '<option value="">Sin asignar</option>';
  
  try {
    const users = await apiFetch('/users');
    users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.username;
      if (task.assigned_to === user.id) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Error loading users list:', error);
  }
}

function closeEditTaskModal() {
  document.getElementById('edit-task-modal').classList.add('hidden');
  document.getElementById('edit-task-form').reset();
}

async function handleEditTask(event) {
  event.preventDefault();
  
  const taskId = document.getElementById('edit-task-id').value;
  const title = document.getElementById('edit-task-title').value;
  const description = document.getElementById('edit-task-description').value;
  const dueDate = document.getElementById('edit-task-duration').value;
  const importance = document.getElementById('edit-task-importance').value;
  const assignedTo = document.getElementById('edit-task-assigned').value;
  const isAdminOnly = document.getElementById('edit-task-is-admin-only').checked;

  try {
    await apiFetch(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        description,
        dueDate,
        importance,
        assignedTo: assignedTo || null,
        isAdminOnly
      })
    });

    showToast('Tarea actualizada correctamente.');
    closeEditTaskModal();
    loadKanban();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Helper: Escape HTML strings to avoid XSS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Helper: Format YYYY-MM-DD date to DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// USERS MANAGEMENT (Superuser Only)
async function loadUsersManagement() {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">Cargando usuarios...</td></tr>';
  
  try {
    const users = await apiFetch('/users');
    tbody.innerHTML = '';
    
    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No se encontraron usuarios.</td></tr>';
      return;
    }
    
    users.forEach(user => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-light)';
      
      const badgeClass = user.role === 'superuser' ? 'badge-superuser' : (user.role === 'admin' ? 'badge-admin' : 'badge-user');
      const isSelf = user.id === currentUser.id;
      
      const selectHtml = `
        <select class="role-select" onchange="updateUserRole('${user.id}', this.value)" ${isSelf ? 'disabled' : ''}>
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuario (User)</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador (Admin)</option>
          <option value="superuser" ${user.role === 'superuser' ? 'selected' : ''}>Superusuario (Superuser)</option>
        </select>
      `;
      
      tr.innerHTML = `
        <td style="padding: 16px; display: flex; align-items: center; gap: 12px;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--primary-glow); display: flex; align-items: center; justify-content: center; font-weight: 600; color: white;">
            ${user.username.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <span style="font-weight: 500; color: var(--text-primary);">${escapeHTML(user.username)}</span>
            ${isSelf ? '<span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">(Tú)</span>' : ''}
          </div>
        </td>
        <td style="padding: 16px;">
          <span class="badge ${badgeClass}">${user.role}</span>
        </td>
        <td style="padding: 16px; text-align: right;">
          ${selectHtml}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function updateUserRole(userId, newRole) {
  try {
    await apiFetch(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole })
    });
    showToast('Rol de usuario actualizado con éxito');
    loadUsersManagement();
  } catch (error) {
    showToast(error.message, 'error');
    loadUsersManagement();
  }
}
