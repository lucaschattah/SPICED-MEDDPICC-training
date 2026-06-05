// ── STATE ──
let scenarioActive = false;
let isTyping = false;
let personaInitials = 'IA';
let personaName = '';
let personaRole = '';

// ── DOM REFS ──
const modal = document.getElementById('scenarioModal');
const btnStart = document.getElementById('btnStartScenario');
const btnNew = document.getElementById('btnNewScenario');
const btnAvaliar = document.getElementById('btnAvaliar');
const btnSend = document.getElementById('btnSend');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const scenarioLabel = document.getElementById('scenarioLabel');
const evalPanel = document.getElementById('evalPanel');
const evalDismiss = document.getElementById('evalDismiss');
const tabSpiced = document.getElementById('tabSpiced');
const tabMeddpicc = document.getElementById('tabMeddpicc');
const fieldsSpiced = document.getElementById('fieldsSpiced');
const fieldsMeddpicc = document.getElementById('fieldsMeddpicc');

// ── TABS ──
tabSpiced.addEventListener('click', () => {
  tabSpiced.className = 'tab active-spiced';
  tabMeddpicc.className = 'tab';
  fieldsSpiced.classList.remove('hidden');
  fieldsMeddpicc.classList.add('hidden');
});
tabMeddpicc.addEventListener('click', () => {
  tabMeddpicc.className = 'tab active-meddpicc';
  tabSpiced.className = 'tab';
  fieldsMeddpicc.classList.remove('hidden');
  fieldsSpiced.classList.add('hidden');
});

// ── FIELD FILLED INDICATOR ──
document.querySelectorAll('.field-textarea').forEach(ta => {
  ta.addEventListener('input', () => {
    ta.classList.toggle('filled', ta.value.trim().length > 0);
  });
});

// ── SCENARIO SETUP ──
btnStart.addEventListener('click', startScenario);
document.getElementById('inputContexto').addEventListener('keydown', e => {
  if (e.key === 'Enter') startScenario();
});

async function startScenario() {
  const produto = document.getElementById('inputProduto').value.trim();
  const empresa = document.getElementById('inputEmpresa').value.trim();
  const contexto = document.getElementById('inputContexto').value.trim();

  if (!produto || !empresa) {
    document.getElementById('inputProduto').focus();
    return;
  }

  btnStart.disabled = true;
  btnStart.textContent = 'Configurando...';

  const res = await fetch('/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ produto, empresa, contexto }),
  });
  const data = await res.json();

  personaName = data.persona_name;
  personaRole = data.persona_role;
  personaInitials = personaName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  scenarioLabel.innerHTML = `Produto: <b>${produto}</b> &nbsp;·&nbsp; Empresa: <b>${empresa}</b>`;
  modal.classList.add('hidden');
  chatInput.disabled = false;
  btnSend.disabled = false;
  chatInput.placeholder = `Mensagem para ${personaName}...`;
  chatInput.focus();
  scenarioActive = true;

  // clear chat
  chatMessages.innerHTML = '';
  clearEval();

  // opening message from the persona
  appendMessage('company', personaName, personaRole,
    `Olá! Pode falar. Estamos avaliando algumas soluções e tenho alguns minutos para conversar.`
  );

  btnStart.disabled = false;
  btnStart.textContent = 'Iniciar roleplay →';
}

// ── NEW SCENARIO ──
btnNew.addEventListener('click', async () => {
  await fetch('/reset', { method: 'POST' });
  document.getElementById('inputProduto').value = '';
  document.getElementById('inputEmpresa').value = '';
  document.getElementById('inputContexto').value = '';
  document.querySelectorAll('.field-textarea').forEach(ta => {
    ta.value = '';
    ta.classList.remove('filled');
  });
  chatMessages.innerHTML = '<div style="margin:auto;text-align:center;color:var(--text-muted);font-size:12px;">Configure um cenário para começar o roleplay.</div>';
  chatInput.disabled = true;
  chatInput.placeholder = 'Configure um cenário para começar...';
  btnSend.disabled = true;
  scenarioLabel.textContent = 'Nenhum cenário ativo';
  scenarioActive = false;
  clearEval();
  modal.classList.remove('hidden');
});

// ── SEND MESSAGE ──
btnSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

async function sendMessage() {
  if (isTyping || !scenarioActive) return;
  const message = chatInput.value.trim();
  if (!message) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  appendMessage('user', 'Você', '', message);

  isTyping = true;
  chatInput.disabled = true;
  btnSend.disabled = true;
  const typingEl = appendTyping();

  const res = await fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();

  typingEl.remove();
  isTyping = false;
  chatInput.disabled = false;
  btnSend.disabled = false;
  chatInput.focus();

  if (data.reply) {
    appendMessage('company', personaName, personaRole, data.reply);
  }
}

// ── HELPERS ──
function appendMessage(side, name, role, text) {
  const isUser = side === 'user';
  const div = document.createElement('div');
  div.className = `msg ${side}`;

  const initials = isUser ? 'EU' : personaInitials;
  const avatarClass = isUser ? 'avatar-user' : 'avatar-company';
  const meta = isUser ? 'Você' : `${name} · ${role}`;

  div.innerHTML = `
    <div class="msg-avatar ${avatarClass}">${initials}</div>
    <div>
      <div class="msg-meta">${meta}</div>
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>`;

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function appendTyping() {
  const div = document.createElement('div');
  div.className = 'msg company';
  div.innerHTML = `
    <div class="msg-avatar avatar-company">${personaInitials}</div>
    <div>
      <div class="msg-meta">${personaName} · ${personaRole}</div>
      <div class="msg-bubble">
        <div class="typing-indicator">
          <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>
      </div>
    </div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// ── EVALUATION ──
btnAvaliar.addEventListener('click', runEvaluation);
evalDismiss.addEventListener('click', clearEval);

async function runEvaluation() {
  if (!scenarioActive) return;

  btnAvaliar.disabled = true;
  btnAvaliar.textContent = 'Avaliando...';

  const spiced = {
    S: document.getElementById('spiced-S').value,
    P: document.getElementById('spiced-P').value,
    I: document.getElementById('spiced-I').value,
    CE: document.getElementById('spiced-CE').value,
    D: document.getElementById('spiced-D').value,
  };
  const meddpicc = {
    M: document.getElementById('meddpicc-M').value,
    E: document.getElementById('meddpicc-E').value,
    D: document.getElementById('meddpicc-D').value,
    D2: document.getElementById('meddpicc-D2').value,
    PP: document.getElementById('meddpicc-PP').value,
    IP: document.getElementById('meddpicc-IP').value,
    C: document.getElementById('meddpicc-C').value,
    C2: document.getElementById('meddpicc-C2').value,
  };

  const res = await fetch('/avaliar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spiced, meddpicc }),
  });
  const data = await res.json();

  renderEval(data);

  btnAvaliar.disabled = false;
  btnAvaliar.textContent = 'Avaliar →';
}

function renderEval(data) {
  const score = data.overall_score;
  const scoreEl = document.getElementById('evalScore');
  scoreEl.textContent = score + '%';
  scoreEl.className = 'eval-score-badge ' + (score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red');

  document.getElementById('evalTitle').textContent = 'Avaliação — Score geral';

  const SPICED_LABELS = { S: 'Situation', P: 'Pain', I: 'Impact', CE: 'Critical Event', D: 'Decision' };
  const MEDD_LABELS = { M: 'Metrics', E: 'Economic Buyer', D: 'Decision Criteria', D2: 'Decision Process', PP: 'Paper Process', IP: 'Implicate Pain', C: 'Champion', C2: 'Competition' };

  const grid = document.getElementById('evalGrid');
  grid.innerHTML = '';

  const allFields = [
    ...Object.entries(data.spiced).map(([k, v]) => ({ key: k, label: SPICED_LABELS[k] || k, ...v, color: 'blue' })),
    ...Object.entries(data.meddpicc).map(([k, v]) => ({ key: k, label: MEDD_LABELS[k] || k, ...v, color: 'amber' })),
  ];

  allFields.forEach(f => {
    const barClass = f.score >= 80 ? 'bar-green' : f.score >= 50 ? 'bar-amber' : 'bar-red';
    const accentColor = f.color === 'blue' ? 'var(--blue)' : 'var(--amber)';
    const item = document.createElement('div');
    item.className = 'eval-item';
    item.innerHTML = `
      <div class="eval-item-label">
        <span style="color:${accentColor};font-weight:700;">${f.key}</span> ${f.label}
        <span style="margin-left:auto;font-weight:700;color:${f.score>=80?'var(--green)':f.score>=50?'var(--amber)':'var(--red)'};">${f.score}%</span>
      </div>
      <div class="eval-bar-wrap"><div class="eval-bar ${barClass}" style="width:${f.score}%"></div></div>
      <div class="eval-item-feedback">${escapeHtml(f.feedback)}</div>`;
    grid.appendChild(item);
  });

  // ideal answers
  const idealContent = document.getElementById('evalIdealContent');
  idealContent.innerHTML = allFields.map(f => `
    <div style="margin-bottom:10px;">
      <div style="font-weight:700;color:var(--text);font-size:11px;margin-bottom:3px;">${f.key} — ${f.label}</div>
      <div>${escapeHtml(f.ideal)}</div>
    </div>`).join('');

  evalPanel.classList.remove('hidden');
  evalPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearEval() {
  evalPanel.classList.add('hidden');
  document.getElementById('evalGrid').innerHTML = '';
  document.getElementById('evalScore').textContent = '';
  document.getElementById('evalIdealContent').innerHTML = '';
}
