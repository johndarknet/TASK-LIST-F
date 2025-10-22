/* Robust Life Productivity script
   - Defensively parses localStorage (try/catch)
   - Attaches event listeners only after safe initialization
   - Logs helpful errors to the console
*/

const defaultSections = ['Personal','Home','School','Work'];
const STORAGE_KEY = 'lp_users_v1';
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));
const uid = ()=>Date.now().toString(36) + Math.random().toString(36).slice(2,6);

let state = { users: {}, currentUser: null, currentSection: null, editingTaskId: null };

// Safe load: try/catch and fallback to empty state
function load(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) { state = { users:{}, currentUser:null, currentSection:null, editingTaskId:null }; return; }
    state = JSON.parse(raw);
    // minimal validation
    if(typeof state !== 'object' || !state.users) {
      console.warn('storage shape unexpected, resetting state');
      state = { users:{}, currentUser:null, currentSection:null, editingTaskId:null };
    }
  } catch (e) {
    console.error('Failed to parse storage for', STORAGE_KEY, e);
    // clear corrupted key (do not silently lose it - but attempt recovery)
    try { localStorage.removeItem(STORAGE_KEY); console.info('Removed corrupted storage key:', STORAGE_KEY); } catch(err){}
    state = { users:{}, currentUser:null, currentSection:null, editingTaskId:null };
  }
}

function save(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){ console.error('Failed saving state', e); } }

function ensureUserData(username){
  if(!username) return;
  if(!state.users[username]){
    state.users[username] = { password:'', sections:{} };
    defaultSections.forEach(s=> state.users[username].sections[s] = { tasks: [] });
  } else {
    defaultSections.forEach(s=>{ if(!state.users[username].sections[s]) state.users[username].sections[s] = { tasks: [] } });
  }
}

// Utility: safe query selectors exist before binding
function initUI(){
  const signBtn = qs('#signInBtn');
  const createBtn = qs('#createBtn');
  const themeBtn = qs('#themeToggle');
  const signOutBtn = qs('#signOutBtn');

  if(createBtn) createBtn.addEventListener('click', handleCreateAccount);
  if(signBtn) signBtn.addEventListener('click', handleSignIn);
  if(themeBtn) themeBtn.addEventListener('click', ()=> {
    const cur = document.body.getAttribute('data-theme') || 'dark';
    document.body.setAttribute('data-theme', cur==='light' ? 'dark' : 'light');
  });
  if(signOutBtn) signOutBtn.addEventListener('click', ()=> { load(); state.currentUser=null; save(); location.reload(); });
}

// Auth handlers
function handleCreateAccount(){
  const u = qs('#loginUser')?.value?.trim();
  const p = qs('#loginPass')?.value || '';
  if(!u || !p){ alert('Enter username and password'); return; }
  load(); ensureUserData(u);
  state.users[u].password = p;
  state.currentUser = u;
  state.currentSection = 'Personal';
  save(); showApp();
}

function handleSignIn(){
  const u = qs('#loginUser')?.value?.trim();
  const p = qs('#loginPass')?.value || '';
  load();
  if(!u || !state.users[u] || state.users[u].password !== p){
    alert('Invalid user or password (create account if new)');
    return;
  }
  state.currentUser = u; state.currentSection = state.currentSection || 'Personal';
  save(); showApp();
}

// High-level show app after init
function showApp(){
  try {
    load();
    ensureUserData(state.currentUser);
    qs('#loginScreen').style.display='none';
    qs('#appRoot').style.display='block';
    // default theme
    if(!document.body.getAttribute('data-theme')) document.body.setAttribute('data-theme','dark');
    renderAccount(); renderSections(); renderHomeTiles(); renderSectionView(); startTicker();
  } catch(e){
    console.error('showApp error', e);
  }
}

function renderAccount(){
  if(!state.currentUser) return;
  qs('#accountName').textContent = state.currentUser;
  qs('#userArea').innerHTML = `<div class=muted>${state.currentUser}</div>`;
}

function renderSections(){
  const container = qs('#sectionList'); if(!container) return;
  container.innerHTML = '';
  defaultSections.forEach(s=>{
    const el = document.createElement('div'); el.className='nav-item'; el.dataset.section=s; el.innerHTML=`<div style="font-weight:700;color:var(--accent)">${s}</div>`;
    el.addEventListener('click', ()=>{ state.currentSection=s; save(); renderSectionView(); });
    container.appendChild(el);
  });
}

function renderHomeTiles(){
  qsa('.tile').forEach(t=> t.addEventListener('click', ()=>{ state.currentSection = t.dataset.section; save(); renderSectionView(); }));
}

function renderSectionView(){
  if(!state.currentUser) return;
  qs('#homeTiles').style.display = 'none'; qs('#sectionView').style.display='block';
  qs('#currentSectionTitle').textContent = state.currentSection;
  renderTaskList(); renderHistoryList(); updateProgress(); updateNextTask();
}

function getTasks(){
  const u = state.currentUser; return (state.users[u] && state.users[u].sections[state.currentSection] && state.users[u].sections[state.currentSection].tasks) || [];
}

function renderTaskList(filterText=''){
  const list = qs('#taskList'); if(!list) return;
  list.innerHTML='';
  const tasks = getTasks().filter(t=>!t.archived && (!filterText || t.title.toLowerCase().includes(filterText.toLowerCase()))).sort((a,b)=> (a.due||0) - (b.due||0));
  if(tasks.length===0) { list.innerHTML = '<div class="muted">No tasks. Click + New Task to add one.</div>'; return; }
  tasks.forEach(t=>{
    const el = document.createElement('div'); el.className='task';
    const left = document.createElement('div'); left.className='left';
    const cb = document.createElement('div'); cb.className = 'checkbox' + (t.completed? ' checked':''); cb.innerHTML = t.completed? '✔':'';
    cb.addEventListener('click', ()=>{
      t.completed = !t.completed;
      if(t.completed) t.completedAt = Date.now(); else t.completedAt = null;
      save(); renderTaskList(qs('#searchInput')?.value || ''); updateProgress(); updateNextTask();
    });
    const info = document.createElement('div');
    info.innerHTML = `<div class="task-title">${escapeHtml(t.title)}</div><div class="task-meta">Due: ${t.due? new Date(t.due).toLocaleString():'—'} ${t.notes? ' • '+escapeHtml(t.notes):''}</div>`;
    left.appendChild(cb); left.appendChild(info);
    const actions = document.createElement('div'); actions.className='task-actions';
    const edit = document.createElement('button'); edit.className='small-btn'; edit.text
