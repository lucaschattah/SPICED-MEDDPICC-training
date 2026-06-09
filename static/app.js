// ── STATE ──
let scenarioActive = false;
let isTyping = false;
let personaInitials = 'IA';
let personaName = '';
let personaRole = '';
let selectModeActive = false;

// ── DOM REFS ──
const modal = document.getElementById('scenarioModal');
const btnStart = document.getElementById('btnStartScenario');
const btnNew = document.getElementById('btnNewScenario');
const btnAvaliar = document.getElementById('btnAvaliar');
const btnSelectFields = document.getElementById('btnSelectFields');
const btnAvaliarSelected = document.getElementById('btnAvaliarSelected');
const btnCheckAll = document.getElementById('btnCheckAll');
const btnUncheckAll = document.getElementById('btnUncheckAll');
const selectModeBar = document.getElementById('selectModeBar');
const btnDicas = document.getElementById('btnDicas');
const hintsBar = document.getElementById('hintsBar');
const hintsList = document.getElementById('hintsList');
const hintsActions = document.getElementById('hintsActions');
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

// ── PRODUCT SELECTION ──
let selectedProducts = [];
document.querySelectorAll('.product-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    selectedProducts = Array.from(document.querySelectorAll('.product-chip.selected'))
      .map(c => c.dataset.id);
  });
});

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

// ── FIELD FILLED + INLINE EVAL BUTTON ──
document.querySelectorAll('.framework-field').forEach(field => {
  const ta = field.querySelector('.field-textarea');
  const evalBtn = field.querySelector('.field-eval-inline');
  ta.addEventListener('input', () => {
    const filled = ta.value.trim().length > 0;
    ta.classList.toggle('filled', filled);
    if (evalBtn) evalBtn.classList.toggle('hidden', !filled);
  });
});

// ── SCENARIO SETUP ──
btnStart.addEventListener('click', startScenario);
document.getElementById('inputContexto').addEventListener('keydown', e => {
  if (e.key === 'Enter') startScenario();
});

async function startScenario() {
  const empresa = document.getElementById('inputEmpresa').value.trim();
  const contexto = document.getElementById('inputContexto').value.trim();

  if (!selectedProducts.length || !empresa) {
    if (!selectedProducts.length) document.querySelector('.product-grid').style.outline = '1px solid var(--red)';
    else document.getElementById('inputEmpresa').focus();
    return;
  }
  document.querySelector('.product-grid').style.outline = '';

  btnStart.disabled = true;
  btnStart.textContent = 'Configurando...';

  try {
    const res = await fetch('/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produtos: selectedProducts, empresa, contexto }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      alert('Erro ao configurar cenário: ' + (data.error || 'Tente novamente.'));
      return;
    }

    personaName = data.persona_name;
    personaRole = data.persona_role;
    personaInitials = personaName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    const prodLabel = data.product_names.join(' + ');
    scenarioLabel.innerHTML = `${escapeHtml(prodLabel)} &nbsp;·&nbsp; <b>${escapeHtml(empresa)}</b>`;
    modal.classList.add('hidden');
    chatInput.disabled = false;
    btnSend.disabled = false;
    btnSelectFields.style.display = '';
    chatInput.placeholder = `Mensagem para ${personaName}...`;
    chatInput.focus();
    scenarioActive = true;
    btnDicas.disabled = false;
    hintsActions.style.display = '';

    chatMessages.innerHTML = '';
    clearEval();

    appendMessage('company', personaName, personaRole,
      `Olá! Pode falar. Estamos avaliando algumas soluções e tenho alguns minutos para conversar.`
    );
  } catch (err) {
    alert('Erro de conexão. Verifique se o servidor está rodando.');
  } finally {
    btnStart.disabled = false;
    btnStart.textContent = 'Iniciar roleplay →';
  }
}

// ── NEW SCENARIO ──
btnNew.addEventListener('click', async () => {
  await fetch('/reset', { method: 'POST' });
  document.getElementById('inputEmpresa').value = '';
  document.getElementById('inputContexto').value = '';
  document.querySelectorAll('.product-chip').forEach(c => c.classList.remove('selected'));
  selectedProducts = [];
  document.querySelectorAll('.field-textarea').forEach(ta => {
    ta.value = '';
    ta.classList.remove('filled');
  });
  document.querySelectorAll('.field-eval-inline').forEach(b => b.classList.add('hidden'));
  chatMessages.innerHTML = '<div style="margin:auto;text-align:center;color:var(--text-muted);font-size:12px;">Configure um cenário para começar o roleplay.</div>';
  chatInput.disabled = true;
  chatInput.placeholder = 'Configure um cenário para começar...';
  btnSend.disabled = true;
  btnSelectFields.style.display = 'none';
  btnDicas.disabled = true;
  hintsBar.style.display = 'none';
  hintsActions.style.display = 'none';
  hintsList.innerHTML = '';
  scenarioLabel.textContent = 'Nenhum cenário ativo';
  scenarioActive = false;
  clearEval();
  exitSelectMode();
  modal.classList.remove('hidden');
});

// ── SELECT MODE ──
btnSelectFields.addEventListener('click', () => {
  selectModeActive ? exitSelectMode() : enterSelectMode();
});

function enterSelectMode() {
  selectModeActive = true;
  document.querySelector('.sidebar-body').classList.add('select-mode');
  selectModeBar.classList.remove('hidden');
  btnSelectFields.textContent = '✕ Cancelar seleção';
}

function exitSelectMode() {
  selectModeActive = false;
  document.querySelector('.sidebar-body').classList.remove('select-mode');
  selectModeBar.classList.add('hidden');
  btnSelectFields.textContent = '☰ Selecionar campos';
}

btnCheckAll.addEventListener('click', () => {
  document.querySelectorAll('.field-check').forEach(cb => cb.checked = true);
});
btnUncheckAll.addEventListener('click', () => {
  document.querySelectorAll('.field-check').forEach(cb => cb.checked = false);
});
btnAvaliarSelected.addEventListener('click', () => {
  if (!scenarioActive) return;
  const keys = [];
  document.querySelectorAll('.framework-field').forEach(field => {
    const cb = field.querySelector('.field-check');
    if (cb && cb.checked) keys.push(`${field.dataset.framework}:${field.dataset.key}`);
  });
  if (!keys.length) { alert('Nenhum campo selecionado.'); return; }
  const { spiced, meddpicc } = collectFields(keys);
  runEvaluation(spiced, meddpicc, 'Avaliação selecionada');
  exitSelectMode();
});

// ── SEND MESSAGE ──
btnSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (data.reply) appendMessage('company', personaName, personaRole, data.reply);
  } catch (err) {
    appendMessage('company', personaName, personaRole, '⚠ Erro de conexão. Tente novamente.');
  } finally {
    typingEl.remove();
    isTyping = false;
    chatInput.disabled = false;
    btnSend.disabled = false;
    chatInput.focus();
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

// ── COLLECT FIELDS ──
function collectFields(onlyKeys) {
  const spiced = {};
  const meddpicc = {};
  document.querySelectorAll('.framework-field').forEach(field => {
    const framework = field.dataset.framework;
    const key = field.dataset.key;
    const value = document.getElementById(`${framework}-${key}`)?.value || '';
    if (onlyKeys && !onlyKeys.includes(`${framework}:${key}`)) return;
    if (framework === 'spiced') spiced[key] = value;
    else meddpicc[key] = value;
  });
  return { spiced, meddpicc };
}

function detectLanguage() {
  const texts = [];
  document.querySelectorAll('.field-textarea').forEach(ta => {
    if (ta.value.trim()) texts.push(ta.value);
  });
  const combined = texts.join(' ').toLowerCase();
  const ptWords = /\b(que|com|para|uma|empresa|processo|equipe|nosso|nossa|também|está|são|mas|por|não|tem|isso|como|quando|ainda|sobre|foi|ser)\b/g;
  return (combined.match(ptWords) || []).length >= 2 ? 'Portuguese' : 'English';
}

// ── HINTS (DICAS) ──
let hintsOpen = false;
let hintsFilter = 'all'; // 'all' | 'spiced' | 'meddpicc'

const hintFilterAll = document.getElementById('hintFilterAll');
const hintFilterSpiced = document.getElementById('hintFilterSpiced');
const hintFilterMedd = document.getElementById('hintFilterMedd');

function setHintsFilter(f) {
  hintsFilter = f;
  hintFilterAll.className = 'btn-hints-filter' + (f === 'all' ? ' active' : '');
  hintFilterSpiced.className = 'btn-hints-filter' + (f === 'spiced' ? ' active spiced' : '');
  hintFilterMedd.className = 'btn-hints-filter' + (f === 'meddpicc' ? ' active meddpicc' : '');
  if (hintsOpen) fetchHints();
}

hintFilterAll.addEventListener('click', () => setHintsFilter('all'));
hintFilterSpiced.addEventListener('click', () => setHintsFilter('spiced'));
hintFilterMedd.addEventListener('click', () => setHintsFilter('meddpicc'));

btnDicas.addEventListener('click', async () => {
  if (!scenarioActive) return;

  if (hintsOpen) {
    hintsBar.style.display = 'none';
    hintsList.innerHTML = '';
    hintsOpen = false;
    btnDicas.textContent = '💡 Dicas';
    return;
  }

  hintsOpen = true;
  hintsBar.style.display = '';
  setHintsFilter('all');
  await fetchHints();
});

async function fetchHints() {
  btnDicas.disabled = true;
  hintsList.innerHTML = '<div class="hints-loading">Analisando a conversa...</div>';

  try {
    const res = await fetch('/dicas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: detectLanguage(), focus: hintsFilter }),
    });
    const data = await res.json();

    if (data.error || !data.hints) {
      hintsList.innerHTML = '<div class="hints-loading">Não foi possível gerar dicas.</div>';
      return;
    }

    hintsList.innerHTML = '';
    data.hints.forEach(hint => {
      const chip = document.createElement('button');
      chip.className = 'hint-chip';
      chip.innerHTML = `<span class="hint-label">${escapeHtml(hint.label)}</span><span>${escapeHtml(hint.question)}</span>`;
      chip.addEventListener('click', () => {
        const current = chatInput.value;
        chatInput.value = current ? current + '\n' + hint.question : hint.question;
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        chatInput.focus();
        chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
      });
      hintsList.appendChild(chip);
    });
  } catch (err) {
    hintsList.innerHTML = '<div class="hints-loading">Erro de conexão.</div>';
  } finally {
    btnDicas.disabled = false;
    btnDicas.textContent = '✕ Fechar dicas';
  }
}

// ── EVALUATION ──
btnAvaliar.addEventListener('click', () => {
  if (!scenarioActive) return;
  const { spiced, meddpicc } = collectFields(null);
  runEvaluation(spiced, meddpicc, 'Avaliação completa');
});

// Inline per-field eval buttons
document.querySelectorAll('.field-eval-inline').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!scenarioActive) return;
    const field = btn.closest('.framework-field');
    const framework = field.dataset.framework;
    const key = field.dataset.key;
    const { spiced, meddpicc } = collectFields([`${framework}:${key}`]);
    const label = field.querySelector('.field-name').textContent;
    runEvaluation(spiced, meddpicc, `Avaliação — ${key}: ${label}`);
  });
});

evalDismiss.addEventListener('click', clearEval);

async function runEvaluation(spiced, meddpicc, title) {
  if (!scenarioActive) return;
  btnAvaliar.disabled = true;
  btnAvaliar.textContent = 'Avaliando...';
  const language = detectLanguage();

  try {
    const res = await fetch('/avaliar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spiced, meddpicc, language }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      alert('Erro na avaliação: ' + (data.error || 'Tente novamente.'));
      return;
    }
    renderEval(data, title);
  } catch (err) {
    alert('Erro de conexão ao avaliar. Tente novamente.');
  } finally {
    btnAvaliar.disabled = false;
    btnAvaliar.textContent = 'Avaliar todos →';
  }
}

function renderEval(data, title) {
  const score = data.overall_score;
  const scoreEl = document.getElementById('evalScore');
  scoreEl.textContent = score + '%';
  scoreEl.className = 'eval-score-badge ' + (score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red');
  document.getElementById('evalTitle').textContent = title || 'Avaliação';

  const SPICED_LABELS = { S: 'Situation', P: 'Pain', I: 'Impact', CE: 'Critical Event', D: 'Decision' };
  const MEDD_LABELS = { M: 'Metrics', E: 'Economic Buyer', D: 'Decision Criteria', D2: 'Decision Process', PP: 'Paper Process', IP: 'Implicate Pain', C: 'Champion', C2: 'Competition' };

  const grid = document.getElementById('evalGrid');
  grid.innerHTML = '';

  const allFields = [
    ...Object.entries(data.spiced || {}).map(([k, v]) => ({ key: k, label: SPICED_LABELS[k] || k, ...v, color: 'blue' })),
    ...Object.entries(data.meddpicc || {}).map(([k, v]) => ({ key: k, label: MEDD_LABELS[k] || k, ...v, color: 'amber' })),
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
