# SPICED & MEDDPICC Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a locally-hosted Flask app where a user does a sales roleplay with a Gemini-powered AI company representative, fills in SPICED/MEDDPICC framework fields, and gets an AI-scored evaluation on demand.

**Architecture:** Python Flask serves a single-page HTML/CSS/JS frontend. Two Gemini API calls: one for the roleplay chat (stateful, history maintained in Flask session), one for evaluation (stateless, scores framework notes against the transcript). API key lives in `.env`, never reaches the browser.

**Tech Stack:** Python 3.10+, Flask, google-generativeai, python-dotenv, vanilla HTML/CSS/JS

---

## File Map

| File | Role |
|---|---|
| `app.py` | Flask app — all routes, Gemini calls, session |
| `.env` | `GEMINI_API_KEY=...` |
| `.gitignore` | Ignore `.env`, `__pycache__`, `.venv` |
| `requirements.txt` | `flask`, `google-generativeai`, `python-dotenv` |
| `templates/index.html` | Full UI — topbar, sidebar, chat, eval panel, scenario modal |
| `static/style.css` | SAP dark theme — all styles |
| `static/app.js` | Frontend logic — chat, tabs, sidebar fields, eval rendering |

---

## Task 1: Project scaffold + dependencies

**Files:**
- Create: `requirements.txt`
- Create: `.env`
- Create: `.gitignore`
- Create: `app.py` (skeleton only)
- Create: `templates/index.html` (skeleton only)
- Create: `static/style.css` (empty)
- Create: `static/app.js` (empty)

- [ ] **Step 1: Create requirements.txt**

```
flask==3.0.3
google-generativeai==0.8.3
python-dotenv==1.0.1
```

- [ ] **Step 2: Create .gitignore**

```
.env
__pycache__/
*.pyc
.venv/
venv/
```

- [ ] **Step 3: Create .env with placeholder**

```
GEMINI_API_KEY=your_key_here
```

- [ ] **Step 4: Create app.py skeleton**

```python
import os
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
```

- [ ] **Step 5: Create templates/index.html skeleton**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SPICED & MEDDPICC Trainer</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <p>scaffold ok</p>
  <script src="/static/app.js"></script>
</body>
</html>
```

- [ ] **Step 6: Create static/style.css and static/app.js as empty files**

Both files can be empty at this stage.

- [ ] **Step 7: Install dependencies**

```bash
cd "C:/Users/I768906/Desktop/Projects/SPICED & MEDDPICC training"
python -m venv .venv
source .venv/Scripts/activate   # Windows Git Bash
pip install -r requirements.txt
```

- [ ] **Step 8: Verify server starts**

```bash
python app.py
```

Expected output: `* Running on http://127.0.0.1:5000`. Open browser at `http://localhost:5000` — should show "scaffold ok".

- [ ] **Step 9: Commit**

```bash
git init
git add requirements.txt .gitignore app.py templates/index.html static/style.css static/app.js
git commit -m "feat: project scaffold and dependencies"
```

---

## Task 2: Flask routes — /chat and /reset

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Add /reset route**

Add to `app.py` after the index route:

```python
@app.route("/reset", methods=["POST"])
def reset():
    session.clear()
    return jsonify({"ok": True})
```

- [ ] **Step 2: Add /chat route**

Add to `app.py`:

```python
ROLEPLAY_SYSTEM = """You are {name}, {role} at {company}, a {sector} company. \
You are in a meeting with a SAP account executive exploring your business challenges. \
Stay in character as a real executive. Share pain points and context organically — only \
when the salesperson asks the right questions. Do not volunteer everything upfront. \
Respond concisely (2-4 sentences per turn). \
Always reply in the same language the salesperson uses (Portuguese or English)."""

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "empty message"}), 400

    scenario = session.get("scenario")
    if not scenario:
        return jsonify({"error": "no scenario set"}), 400

    history = session.get("history", [])

    system_prompt = ROLEPLAY_SYSTEM.format(
        name=scenario["persona_name"],
        role=scenario["persona_role"],
        company=scenario["empresa"],
        sector=scenario["contexto"] or "enterprise",
    )

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system_prompt,
    )
    chat_session = model.start_chat(history=history)
    response = chat_session.send_message(message)
    reply = response.text

    history.append({"role": "user", "parts": [message]})
    history.append({"role": "model", "parts": [reply]})
    session["history"] = history

    return jsonify({"reply": reply})
```

- [ ] **Step 3: Manually test /chat via curl**

First set a dummy scenario in session by temporarily adding to index route:
```python
@app.route("/")
def index():
    if not session.get("scenario"):
        session["scenario"] = {
            "produto": "SAP Signavio",
            "empresa": "Ambev",
            "contexto": "Manufatura",
            "persona_name": "Carlos Mendes",
            "persona_role": "Diretor de Operações",
        }
        session["history"] = []
    return render_template("index.html")
```

Run the server and test:
```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Bom dia Carlos, como estão os processos hoje?"}'
```

Expected: JSON with `{"reply": "..."}` — a response in Portuguese from the persona.

- [ ] **Step 4: Remove the temporary session setup from index route**

Revert `index()` back to just `return render_template("index.html")`.

- [ ] **Step 5: Commit**

```bash
git add app.py
git commit -m "feat: add /chat and /reset routes with Gemini roleplay"
```

---

## Task 3: Flask route — /setup and /avaliar

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Add /setup route**

This route initialises the scenario. It calls Gemini once to generate a realistic persona name + role for the company.

Add to `app.py`:

```python
PERSONA_PROMPT = """Generate a realistic Brazilian executive persona for a company called "{company}" \
in the {sector} sector. Return ONLY valid JSON with keys: "name" (full name, Portuguese), \
"role" (job title in Portuguese, e.g. "Diretor de Operações"). No extra text."""

@app.route("/setup", methods=["POST"])
def setup():
    data = request.get_json()
    produto = data.get("produto", "").strip()
    empresa = data.get("empresa", "").strip()
    contexto = data.get("contexto", "").strip()

    if not produto or not empresa:
        return jsonify({"error": "produto and empresa are required"}), 400

    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = PERSONA_PROMPT.format(company=empresa, sector=contexto or "enterprise")
    response = model.generate_content(prompt)

    import json, re
    raw = response.text.strip()
    # strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    persona = json.loads(raw)

    session.clear()
    session["scenario"] = {
        "produto": produto,
        "empresa": empresa,
        "contexto": contexto,
        "persona_name": persona["name"],
        "persona_role": persona["role"],
    }
    session["history"] = []

    return jsonify({
        "persona_name": persona["name"],
        "persona_role": persona["role"],
        "empresa": empresa,
        "produto": produto,
    })
```

- [ ] **Step 2: Add /avaliar route**

Add to `app.py`:

```python
EVALUATOR_SYSTEM = """You are a senior sales methodology coach evaluating a trainee's discovery call notes.

SPICED framework: S=Situation, P=Pain, I=Impact, CE=Critical Event, D=Decision Criteria/Process.
MEDDPICC framework: M=Metrics, E=Economic Buyer, D=Decision Criteria, D2=Decision Process, P=Paper Process, I=Implicate the Pain, C=Champion, C2=Competition.

The trainee filled in some fields after a discovery call. Evaluate each filled field (0-100) based on:
- Accuracy: does it reflect what was said in the transcript?
- Completeness: does it capture the key insight for that field?
- Quality: is it specific and actionable, not vague?

Empty fields score 0. Also provide the "ideal" answer for every field based on the transcript.

Return ONLY valid JSON in this exact shape:
{
  "overall_score": <integer 0-100>,
  "spiced": {
    "S": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "P": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "I": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "CE": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "D": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"}
  },
  "meddpicc": {
    "M": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "E": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "D": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "D2": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "PP": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "IP": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "C": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"},
    "C2": {"score": <int>, "feedback": "<1-2 sentences>", "ideal": "<ideal answer>"}
  }
}"""

@app.route("/avaliar", methods=["POST"])
def avaliar():
    data = request.get_json()
    spiced = data.get("spiced", {})
    meddpicc = data.get("meddpicc", {})
    scenario = session.get("scenario", {})
    history = session.get("history", [])

    transcript_lines = []
    for msg in history:
        role = "Empresa" if msg["role"] == "model" else "Você"
        transcript_lines.append(f"{role}: {msg['parts'][0]}")
    transcript = "\n".join(transcript_lines) if transcript_lines else "(sem conversa ainda)"

    user_content = f"""Scenario: {scenario.get('produto','?')} for {scenario.get('empresa','?')} ({scenario.get('contexto','')})

TRANSCRIPT:
{transcript}

TRAINEE NOTES — SPICED:
S (Situation): {spiced.get('S', '')}
P (Pain): {spiced.get('P', '')}
I (Impact): {spiced.get('I', '')}
CE (Critical Event): {spiced.get('CE', '')}
D (Decision): {spiced.get('D', '')}

TRAINEE NOTES — MEDDPICC:
M (Metrics): {meddpicc.get('M', '')}
E (Economic Buyer): {meddpicc.get('E', '')}
D (Decision Criteria): {meddpicc.get('D', '')}
D2 (Decision Process): {meddpicc.get('D2', '')}
PP (Paper Process): {meddpicc.get('PP', '')}
IP (Implicate Pain): {meddpicc.get('IP', '')}
C (Champion): {meddpicc.get('C', '')}
C2 (Competition): {meddpicc.get('C2', '')}"""

    import json, re
    model = genai.GenerativeModel(
        "gemini-2.0-flash",
        system_instruction=EVALUATOR_SYSTEM,
    )
    response = model.generate_content(user_content)
    raw = response.text.strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    result = json.loads(raw)

    return jsonify(result)
```

- [ ] **Step 3: Commit**

```bash
git add app.py
git commit -m "feat: add /setup and /avaliar routes"
```

---

## Task 4: CSS — SAP dark theme

**Files:**
- Modify: `static/style.css`

- [ ] **Step 1: Write full stylesheet**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0d1117;
  --surface: #161b22;
  --surface2: #1c2128;
  --border: #30363d;
  --border2: #21262d;
  --text: #cdd9e5;
  --text-muted: #8b949e;
  --blue: #0070f3;
  --amber: #e8a000;
  --green: #238636;
  --red: #da3633;
  --font: '72', 'Inter', system-ui, sans-serif;
}

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 13px;
}

/* ── MODAL ── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal-overlay.hidden { display: none; }
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 28px 32px;
  width: 440px;
  display: flex; flex-direction: column; gap: 16px;
}
.modal h2 { font-size: 16px; font-weight: 700; color: var(--text); }
.modal p { font-size: 12px; color: var(--text-muted); margin-top: -8px; }
.field-group { display: flex; flex-direction: column; gap: 5px; }
.field-group label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.field-group input {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 13px;
  padding: 8px 12px;
  font-family: var(--font);
}
.field-group input:focus { outline: none; border-color: var(--blue); }

/* ── BUTTONS ── */
.btn {
  border: none; border-radius: 6px;
  padding: 7px 14px;
  font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: var(--font);
  transition: opacity .15s;
}
.btn:hover { opacity: .85; }
.btn-ghost { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
.btn-primary { background: var(--blue); color: #fff; }
.btn-eval { background: var(--amber); color: #0d1117; }
.btn-full { width: 100%; padding: 10px; font-size: 13px; }

/* ── TOPBAR ── */
.topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 10px 16px;
  display: flex; align-items: center; gap: 10px;
  flex-shrink: 0;
}
.topbar-logo { color: var(--blue); font-weight: 700; font-size: 14px; letter-spacing: -.3px; white-space: nowrap; }
.topbar-sep { color: var(--border); }
.topbar-scenario { color: var(--text-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.topbar-scenario b { color: var(--text); }
.topbar-actions { margin-left: auto; display: flex; gap: 8px; flex-shrink: 0; }

/* ── MAIN LAYOUT ── */
.main { display: flex; flex: 1; overflow: hidden; }

/* ── SIDEBAR ── */
.sidebar {
  width: 280px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  flex-shrink: 0;
}
.sidebar-tabs { display: flex; border-bottom: 1px solid var(--border); }
.tab {
  flex: 1; padding: 10px;
  text-align: center; font-size: 12px; font-weight: 700;
  cursor: pointer; letter-spacing: .5px;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  transition: color .15s, border-color .15s;
  user-select: none;
}
.tab.active-spiced { color: var(--blue); border-bottom-color: var(--blue); background: var(--bg); }
.tab.active-meddpicc { color: var(--amber); border-bottom-color: var(--amber); background: var(--bg); }

.sidebar-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.framework-fields { display: flex; flex-direction: column; gap: 8px; }
.framework-fields.hidden { display: none; }

.framework-field {
  background: var(--bg);
  border: 1px solid var(--border2);
  border-radius: 6px;
  padding: 8px 10px;
}
.field-label { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
.field-letter {
  color: #fff; font-weight: 700; font-size: 11px;
  border-radius: 3px; width: 20px; height: 20px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.letter-blue { background: var(--blue); }
.letter-amber { background: var(--amber); color: #0d1117; }
.field-name { font-size: 11px; color: var(--text-muted); font-weight: 500; }
.field-textarea {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 4px;
  color: var(--text);
  font-size: 11px;
  padding: 5px 7px;
  resize: vertical;
  min-height: 48px;
  font-family: var(--font);
  line-height: 1.5;
  transition: border-color .15s;
}
.field-textarea:focus { outline: none; border-color: var(--blue); }
.field-textarea.filled { border-color: var(--green); }

.sidebar-hint { font-size: 10px; color: var(--text-muted); text-align: center; opacity: .6; padding: 4px; }

/* ── CHAT AREA ── */
.chat-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

.msg { display: flex; gap: 10px; max-width: 82%; }
.msg.company { align-self: flex-start; }
.msg.user { align-self: flex-end; flex-direction: row-reverse; }
.msg-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; flex-shrink: 0; margin-top: 2px;
}
.avatar-company { background: #1f3a5f; color: #7eb3d8; }
.avatar-user { background: #1a3a2a; color: #7bc47b; }
.msg-meta { font-size: 10px; color: var(--text-muted); margin-bottom: 3px; }
.msg.user .msg-meta { text-align: right; }
.msg-bubble {
  padding: 9px 13px; border-radius: 10px;
  font-size: 12px; line-height: 1.6;
}
.msg.company .msg-bubble {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-top-left-radius: 3px;
}
.msg.user .msg-bubble {
  background: #0d2136;
  border: 1px solid #1f4a7a;
  border-top-right-radius: 3px;
}

.typing-indicator { display: flex; gap: 5px; align-items: center; padding: 4px 0; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); animation: bounce 1.2s infinite; }
.dot:nth-child(2) { animation-delay: .2s; }
.dot:nth-child(3) { animation-delay: .4s; }
@keyframes bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }

/* ── EVAL PANEL ── */
.eval-panel {
  background: var(--bg);
  border-top: 1px solid var(--border);
  padding: 12px 16px;
  flex-shrink: 0;
  max-height: 260px;
  overflow-y: auto;
}
.eval-panel.hidden { display: none; }
.eval-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.eval-title { font-size: 12px; font-weight: 700; }
.eval-score-badge { font-size: 26px; font-weight: 800; }
.eval-score-badge.green { color: var(--green); }
.eval-score-badge.amber { color: var(--amber); }
.eval-score-badge.red { color: var(--red); }
.eval-score-badge span { font-size: 13px; font-weight: 400; color: var(--text-muted); }
.eval-dismiss { font-size: 11px; color: var(--text-muted); cursor: pointer; padding: 2px 6px; }
.eval-dismiss:hover { color: var(--text); }

.eval-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; margin-bottom: 10px; }
.eval-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 7px 9px;
}
.eval-item-label { font-size: 10px; color: var(--text-muted); margin-bottom: 4px; font-weight: 600; }
.eval-bar-wrap { background: var(--border2); border-radius: 3px; height: 4px; margin-bottom: 4px; }
.eval-bar { height: 4px; border-radius: 3px; transition: width .4s ease; }
.bar-green { background: var(--green); }
.bar-amber { background: var(--amber); }
.bar-red { background: var(--red); }
.eval-item-feedback { font-size: 10px; color: var(--text-muted); line-height: 1.4; }

.eval-ideal-block {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  margin-top: 6px;
}
.eval-ideal-block summary { font-size: 11px; font-weight: 600; cursor: pointer; color: var(--text-muted); }
.eval-ideal-block summary:hover { color: var(--text); }
.eval-ideal-content { font-size: 11px; color: var(--text-muted); margin-top: 6px; line-height: 1.5; }

/* ── CHAT INPUT ── */
.chat-input-area {
  padding: 10px 14px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  display: flex; gap: 8px; align-items: flex-end;
  flex-shrink: 0;
}
.chat-input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 13px;
  padding: 9px 12px;
  resize: none;
  min-height: 42px;
  max-height: 120px;
  font-family: var(--font);
  line-height: 1.5;
}
.chat-input:focus { outline: none; border-color: var(--blue); }
.chat-input:disabled { opacity: .5; }
```

- [ ] **Step 2: Commit**

```bash
git add static/style.css
git commit -m "feat: add SAP dark theme CSS"
```

---

## Task 5: HTML template — full UI structure

**Files:**
- Modify: `templates/index.html`

- [ ] **Step 1: Replace index.html with full UI**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SPICED & MEDDPICC Trainer</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>

<!-- SCENARIO MODAL -->
<div class="modal-overlay" id="scenarioModal">
  <div class="modal">
    <h2>Configurar cenário de roleplay</h2>
    <p>Defina o produto e a empresa antes de começar a conversa.</p>
    <div class="field-group">
      <label>Produto SAP *</label>
      <input type="text" id="inputProduto" placeholder="Ex: SAP Signavio">
    </div>
    <div class="field-group">
      <label>Empresa alvo *</label>
      <input type="text" id="inputEmpresa" placeholder="Ex: Ambev">
    </div>
    <div class="field-group">
      <label>Setor / contexto (opcional)</label>
      <input type="text" id="inputContexto" placeholder="Ex: Manufatura, 15k funcionários">
    </div>
    <button class="btn btn-primary btn-full" id="btnStartScenario">Iniciar roleplay →</button>
  </div>
</div>

<!-- TOPBAR -->
<div class="topbar">
  <div class="topbar-logo">SPICED & MEDDPICC Trainer</div>
  <div class="topbar-sep">|</div>
  <div class="topbar-scenario" id="scenarioLabel">Nenhum cenário ativo</div>
  <div class="topbar-actions">
    <button class="btn btn-ghost" id="btnNewScenario">↺ Novo cenário</button>
    <button class="btn btn-eval" id="btnAvaliar">Avaliar →</button>
  </div>
</div>

<!-- MAIN -->
<div class="main">

  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="sidebar-tabs">
      <div class="tab active-spiced" id="tabSpiced" data-tab="spiced">SPICED</div>
      <div class="tab" id="tabMeddpicc" data-tab="meddpicc">MEDDPICC</div>
    </div>
    <div class="sidebar-body">

      <!-- SPICED fields -->
      <div class="framework-fields" id="fieldsSpiced">
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-blue">S</div>
            <div class="field-name">Situation</div>
          </div>
          <textarea class="field-textarea" id="spiced-S" placeholder="Contexto e situação atual da empresa..."></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-blue">P</div>
            <div class="field-name">Pain</div>
          </div>
          <textarea class="field-textarea" id="spiced-P" placeholder="Qual é a dor principal?"></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-blue">I</div>
            <div class="field-name">Impact</div>
          </div>
          <textarea class="field-textarea" id="spiced-I" placeholder="Impacto financeiro ou operacional da dor..."></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-blue">CE</div>
            <div class="field-name">Critical Event</div>
          </div>
          <textarea class="field-textarea" id="spiced-CE" placeholder="Existe um prazo ou evento crítico?"></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-blue">D</div>
            <div class="field-name">Decision</div>
          </div>
          <textarea class="field-textarea" id="spiced-D" placeholder="Como e quem decide? Critérios de decisão..."></textarea>
        </div>
      </div>

      <!-- MEDDPICC fields -->
      <div class="framework-fields hidden" id="fieldsMeddpicc">
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">M</div>
            <div class="field-name">Metrics</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-M" placeholder="Métricas de sucesso quantificáveis..."></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">E</div>
            <div class="field-name">Economic Buyer</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-E" placeholder="Quem tem autoridade de aprovação de budget?"></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">D</div>
            <div class="field-name">Decision Criteria</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-D" placeholder="Critérios técnicos e de negócio para decidir..."></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">D</div>
            <div class="field-name">Decision Process</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-D2" placeholder="Etapas e timeline do processo de decisão..."></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">P</div>
            <div class="field-name">Paper Process</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-PP" placeholder="Processo de aprovação legal/compras..."></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">I</div>
            <div class="field-name">Implicate the Pain</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-IP" placeholder="Como a dor foi implicada e conectada ao impacto?"></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">C</div>
            <div class="field-name">Champion</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-C" placeholder="Quem defende internamente a solução?"></textarea>
        </div>
        <div class="framework-field">
          <div class="field-label">
            <div class="field-letter letter-amber">C</div>
            <div class="field-name">Competition</div>
          </div>
          <textarea class="field-textarea" id="meddpicc-C2" placeholder="Concorrentes em avaliação, status..."></textarea>
        </div>
      </div>

      <div class="sidebar-hint">Preencha os campos conforme descobre informações no chat. Clique em "Avaliar →" quando quiser feedback.</div>
    </div>
  </div>

  <!-- CHAT AREA -->
  <div class="chat-area">
    <div class="chat-messages" id="chatMessages">
      <div style="margin:auto;text-align:center;color:var(--text-muted);font-size:12px;">
        Configure um cenário para começar o roleplay.
      </div>
    </div>

    <!-- EVAL PANEL (hidden by default) -->
    <div class="eval-panel hidden" id="evalPanel">
      <div class="eval-header">
        <div class="eval-title" id="evalTitle">Avaliação</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="eval-score-badge" id="evalScore"></div>
          <span class="eval-dismiss" id="evalDismiss">✕ fechar</span>
        </div>
      </div>
      <div class="eval-grid" id="evalGrid"></div>
      <details class="eval-ideal-block" id="evalIdealBlock">
        <summary>Ver respostas ideais por campo</summary>
        <div class="eval-ideal-content" id="evalIdealContent"></div>
      </details>
    </div>

    <!-- INPUT -->
    <div class="chat-input-area">
      <textarea class="chat-input" id="chatInput" placeholder="Configure um cenário para começar..." disabled rows="1"></textarea>
      <button class="btn btn-primary" id="btnSend" disabled>Enviar ↵</button>
    </div>
  </div>

</div>

<script src="/static/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify structure renders**

Run `python app.py`, open `http://localhost:5000`. Should see:
- Modal overlay on top asking for scenario inputs
- Topbar, sidebar with SPICED/MEDDPICC tabs, empty chat area, disabled input
- No JS errors in browser console

- [ ] **Step 3: Commit**

```bash
git add templates/index.html
git commit -m "feat: add full HTML UI structure"
```

---

## Task 6: JavaScript — scenario setup + chat

**Files:**
- Modify: `static/app.js`

- [ ] **Step 1: Write app.js — scenario setup and chat logic**

```javascript
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
```

- [ ] **Step 2: Verify end-to-end chat**

Run the server. Open `http://localhost:5000`. Fill in the scenario modal. The persona should introduce themselves and you should be able to send messages and receive replies.

- [ ] **Step 3: Commit**

```bash
git add static/app.js
git commit -m "feat: scenario setup and chat frontend"
```

---

## Task 7: JavaScript — evaluation panel

**Files:**
- Modify: `static/app.js`

- [ ] **Step 1: Add evaluation logic — append to app.js**

```javascript
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

  document.getElementById('evalTitle').textContent =
    `Avaliação — Score geral`;

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
```

- [ ] **Step 2: End-to-end test**

1. Start a scenario (ex: SAP Signavio / Ambev / Manufatura)
2. Exchange 3-4 messages in the chat
3. Fill in at least 2 SPICED fields
4. Click "Avaliar →"
5. Verify: eval panel appears with scores, bars, feedback, and ideal answers expandable

- [ ] **Step 3: Commit**

```bash
git add static/app.js
git commit -m "feat: evaluation panel frontend"
```

---

## Task 8: Add README and get API key

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# SPICED & MEDDPICC Trainer

Sales methodology roleplay training app. Practice discovery conversations and get AI-scored feedback on your SPICED and MEDDPICC framework notes.

## Setup

1. Get a free Gemini API key at https://aistudio.google.com/apikey
2. Copy `.env` and add your key:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/Scripts/activate   # Windows Git Bash
   # or: .venv\Scripts\activate    # Windows CMD
   pip install -r requirements.txt
   ```
4. Run:
   ```bash
   python app.py
   ```
5. Open http://localhost:5000

## How to use

1. Fill in the scenario modal (product + target company)
2. Chat with the AI company representative — ask discovery questions
3. Fill in SPICED and MEDDPICC fields in the sidebar as you learn information
4. Click **Avaliar →** at any time to get a 0–100% score with feedback and ideal answers
5. Click **↺ Novo cenário** to start over
```

- [ ] **Step 2: Get your Gemini API key**

Go to https://aistudio.google.com/apikey, create a key, and paste it into `.env`:
```
GEMINI_API_KEY=AIza...your_key_here
```

- [ ] **Step 3: Final end-to-end test**

1. Run `python app.py`
2. Open `http://localhost:5000`
3. Set scenario: SAP Signavio / Ambev / Manufatura
4. Have a full 5-message conversation
5. Fill in 3+ SPICED fields and 2+ MEDDPICC fields
6. Click Avaliar — verify all scores load correctly
7. Click "Novo cenário" — verify everything resets

- [ ] **Step 4: Final commit**

```bash
git add README.md .env app.py static/ templates/
git commit -m "feat: complete SPICED & MEDDPICC trainer app"
```

---

## Self-Review

**Spec coverage:**
- ✅ Feature 1 (Scenario Setup) — Task 2 /setup route + Task 6 modal
- ✅ Feature 2 (Roleplay Chat) — Task 2 /chat + Task 6 chat JS
- ✅ Feature 3 (Framework Sidebar) — Task 5 HTML + Task 6 tab/field JS
- ✅ Feature 4 (Evaluation Panel) — Task 3 /avaliar + Task 7 eval JS
- ✅ SAP dark theme — Task 4 CSS
- ✅ API key in .env — Task 1 + Task 8
- ✅ /reset route — Task 2

**Type consistency:** All field IDs in HTML (`spiced-S`, `meddpicc-D2`, etc.) match the JS selectors and the Python keys sent to Gemini. MEDDPICC second D uses `D2`, second C uses `C2`, Paper Process uses `PP`, Implicate Pain uses `IP` — consistent throughout Tasks 3, 5, 6, 7.

**No placeholders found.**
