/* Life Productivity App - final script
   Features:
   - multi-user (localStorage)
   - sections: Personal, Home, School, Work
   - add / edit / delete (archive) tasks
   - due date, next-task countdown
   - progress bar and history per section
   - dark/light toggle
*/

const defaultSections = ['Personal','Home','School','Work'];
const STORAGE_KEY = 'lp_users_v1';
const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));
const uid = ()=>Date.now().toString(36) + Math.random().toString(36).slice(2,6);

let state = { users: {}, currentUser: null, currentSection: null, editingTaskId: null };

function load(){ const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); else state = { users:{}, currentUser:null, currentSection:null, editingTaskId:null }; }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const loginScreen = qs('#loginScreen');
const appRoot = qs('#appRoot');
const userArea = qs('#userArea');

function ensureUserData(username){
  if(!state.users[username]){
    state.users[username] = { password:'', sections:{} };
    defaultSections.forEach(s=> state.users[username].sections[s] = { tasks: [] });
  } else {
    defaultSections.forEach(s=>{ if(!state.users[username].sections[s]) state.users[username].sections[s] = { tasks: [] } });
  }
}

// ---------- AUTH ----------
qs('#createBtn').addEventListener('click', ()=>{
  const u = qs('#loginUser').value.trim();
  const p = qs('#loginPass').value;
  if(!u || !p){ alert('enter username and password'); return; }
  load();
  ensureUserData(u);
  state.users[u].password = p;
  state.currentUser = u;
  state.currentSection = 'Personal';
  save();
  showApp();
});

qs('#signInBtn').addEventListener('click', ()=>{
  const u = qs('#loginUser').value.trim();
  const p = qs('#loginPass').value;
  load();
  if(!state.users[u] || state.users[u].password !== p){ alert('invalid user or password (create account if new)'); return; }
  state.currentUser = u; state.currentSection = state.currentSection || 'Personal';
  save(); showApp();
});

qs('#signOutBtn').addEventListener('click', ()=>{ load(); state.currentUser=null; save(); location.reload(); });

// ---------- UI INIT ----------
function showApp(){
  loginScreen.style.display='none'; appRoot.style.display='block';
  // default theme per session to dark
  document.body.setAttribute('data-theme','dark');
  renderAccount(); renderSections(); renderHomeTiles(); renderSectionView(); startTicker();
}

function renderAccount(){
  qs('#accountName').textContent = state.currentUser;
  userArea.innerHTML = `<div class=muted>${state.currentUser}</div>`;
}

// ---------- Sections ----------
function renderSections(){
  const container = qs('#sectionList'); container.innerHTML='';
  defaultSections.forEach(s=>{
    const el = document.createElement('div'); el.className='nav-item'; el.dataset.section=s; el.innerHTML=`<div style="font-weight:700;color:var(--accent)">${s}</div>`;
    el.addEventListener('click', ()=>{ state.currentSection=s; save(); renderSectionView(); });
    container.appendChild(el);
  });
}

// Home tiles
function renderHomeTiles(){
  qsa('.tile').forEach(t=> t.addEventListener('click', ()=>{ state.currentSection = t.dataset.section; save(); renderSectionView(); }));
}

// ---------- Section view ----------
function renderSectionView(){
  if(!state.currentUser) return;
  qs('#homeTiles').style.display = 'none'; qs('#sectionView').style.display='block';
  qs('#currentSectionTitle').textContent = state.currentSection;
  renderTaskList(); renderHistoryList(); updateProgress(); updateNextTask();
}

function getTasks(){
  const u = state.currentUser; return state.users[u].sections[state.currentSection].tasks;
}

// ---------- Tasks list ----------
function renderTaskList(filterText=''){
  const list = qs('#taskList'); list.innerHTML='';
  const tasks = getTasks().filter(t=>!t.archived && (!filterText || t.title.toLowerCase().includes(filterText.toLowerCase()))).sort((a,b)=> (a.due||0) - (b.due||0));
  if(tasks.length===0) list.innerHTML = '<div class="muted">No tasks. Click + New Task to add one.</div>';
  tasks.forEach(t=>{
    const el = document.createElement('div'); el.className='task';
    const left = document.createElement('div'); left.className='left';
    const cb = document.createElement('div'); cb.className = 'checkbox' + (t.completed? ' checked':''); cb.innerHTML = t.completed? '✔':'';
    cb.addEventListener('click', ()=>{
      t.completed = !t.completed;
      if(t.completed) t.completedAt = Date.now(); else t.completedAt = null;
      save(); renderTaskList(qs('#searchInput').value); updateProgress(); updateNextTask();
    });
    const info = document.createElement('div');
    info.innerHTML = `<div class="task-title">${escapeHtml(t.title)}</div><div class="task-meta">Due: ${t.due? new Date(t.due).toLocaleString():'—'} ${t.notes? ' • '+escapeHtml(t.notes):''}</div>`;
    left.appendChild(cb); left.appendChild(info);

    const actions = document.createElement('div'); actions.className='task-actions';
    const edit = document.createElement('button'); edit.className='small-btn'; edit.textContent='Edit'; edit.addEventListener('click', ()=>openModal(t.id));
    const del = document.createElement('button'); del.className='small-btn'; del.textContent='Delete'; del.addEventListener('click', ()=>{
      if(confirm('Delete this task?')){ t.archived=true; save(); renderTaskList(qs('#searchInput').value); updateProgress(); renderHistoryList(); updateNextTask(); }
    });
    actions.appendChild(edit); actions.appendChild(del);

    el.appendChild(left); el.appendChild(actions);
    list.appendChild(el);
  });
}

// ---------- History ----------
function renderHistoryList(){
  const hist = qs('#historyList'); hist.innerHTML='';
  const tasks = state.users[state.currentUser].sections[state.currentSection].tasks.filter(t=>t.archived).sort((a,b)=> (b.completedAt||b.createdAt) - (a.completedAt||a.createdAt));
  if(tasks.length===0) hist.innerHTML='<div class="muted">No past tasks</div>';
  tasks.slice(0,12).forEach(t=>{
    const d = document.createElement('div'); d.style.padding='8px 0';
    const when = t.completed ? `Completed: ${new Date(t.completedAt).toLocaleString()}` : `Archived: ${new Date(t.createdAt).toLocaleString()}`;
    d.innerHTML = `<div style="font-weight:700;color:#fff">${escapeHtml(t.title)}</div><div class=muted style="font-size:12px">${when}</div>`;
    hist.appendChild(d);
  });
}

// ---------- Progress ----------
function updateProgress(){
  const tasks = state.users[state.currentUser].sections[state.currentSection].tasks.filter(t=>!t.archived);
  const total = tasks.length; const done = tasks.filter(t=>t.completed).length;
  const percent = total? Math.round((done/total)*100):0;
  qs('#progressBar').style.width = percent + '%';
  qs('#progressText').textContent = `${done} of ${total} tasks completed (${percent}%)`;
}

// ---------- Next task & ticker ----------
let ticker = null;
function getNextTask(){
  const tasks = state.users[state.currentUser].sections[state.currentSection].tasks.filter(t=>!t.completed && !t.archived && t.due).sort((a,b)=> a.due - b.due);
  return tasks[0] || null;
}
function updateNextTask(){
  const nt = getNextTask();
  if(!nt){ qs('#nextTaskBar').textContent = 'Next task: —'; return; }
  qs('#nextTaskBar').textContent = `Next: ${nt.title} — due ${new Date(nt.due).toLocaleString()}`;
}
function startTicker(){ if(ticker) clearInterval(ticker); ticker = setInterval(()=>{
  const nt = getNextTask(); if(!nt){ qs('#nextTaskBar').textContent = 'Next task: —'; return; }
  const rem = nt.due - Date.now(); if(rem<=0){ qs('#nextTaskBar').textContent = `Next: ${nt.title} — due now!`; return; }
  const h = Math.floor(rem/3600000); const m = Math.floor((rem%3600000)/60000); const s = Math.floor((rem%60000)/1000);
  qs('#nextTaskBar').textContent = `Next: ${nt.title} — ${h}h ${m}m ${s}s left (due ${new Date(nt.due).toLocaleString()})`;
}, 1000); }

// ---------- Modal add/edit ----------
const modal = qs('#modal');
qs('#addTaskBtn').addEventListener('click', ()=> openModal());
qs('#cancelBtn').addEventListener('click', ()=> closeModal());

function openModal(taskId){
  state.editingTaskId = taskId || null;
  if(taskId){
    const t = state.users[state.currentUser].sections[state.currentSection].tasks.find(x=>x.id===taskId);
    qs('#modalTitle').textContent = 'Edit Task'; qs('#taskTitle').value = t.title; qs('#taskNotes').value = t.notes || ''; qs('#taskDue').value = t.due? toDatetimeLocal(new Date(t.due)) : '';
  } else { qs('#modalTitle').textContent = 'New Task'; qs('#taskTitle').value=''; qs('#taskNotes').value=''; qs('#taskDue').value=''; }
  modal.classList.add('open');
}
function closeModal(){ modal.classList.remove('open'); state.editingTaskId = null; }

qs('#saveTaskBtn').addEventListener('click', ()=>{
  const title = qs('#taskTitle').value.trim(); if(!title){ alert('Enter title'); return; }
  const notes = qs('#taskNotes').value.trim(); const dueVal = qs('#taskDue').value; const due = dueVal? new Date(dueVal).getTime(): null;
  const tasks = state.users[state.currentUser].sections[state.currentSection].tasks;
  if(state.editingTaskId){
    const t = tasks.find(x=>x.id===state.editingTaskId); t.title = title; t.notes = notes; t.due = due; t.archived = false;
  } else {
    tasks.push({ id: uid(), title, notes, due, createdAt: Date.now(), completed:false, completedAt:null, archived:false });
  }
  save(); closeModal(); renderTaskList(qs('#searchInput').value); updateProgress(); updateNextTask(); renderHistoryList();
});

// ---------- Search ----------
qs('#searchInput').addEventListener('input', (e)=> renderTaskList(e.target.value));

// ---------- Theme toggle ----------
qs('#themeToggle').addEventListener('click', ()=>{
  const cur = document.body.getAttribute('data-theme'); document.body.setAttribute('data-theme', cur==='light'? 'dark':'light');
});

// ---------- Helpers ----------
function toDatetimeLocal(date){ const off = date.getTimezoneOffset(); const d = new Date(date.getTime() - off*60*1000); return d.toISOString().slice(0,16); }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>\"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":\"&#39;\" })[c]); }

// ---------- Startup ----------
load();
// auto-show app if a user was signed in previously
if(state.currentUser && state.users[state.currentUser]) showApp();

// ensure sections exist for existing users
Object.keys(state.users).forEach(u=>{ defaultSections.forEach(s=>{ if(!state.users[u].sections[s]) state.users[u].sections[s] = { tasks: [] }; }); });

// save on unload
window.addEventListener('beforeunload', ()=> save());
