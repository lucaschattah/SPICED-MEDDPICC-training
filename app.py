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


@app.route("/reset", methods=["POST"])
def reset():
    session.clear()
    return jsonify({"ok": True})


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
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    try:
        persona = json.loads(raw)
    except json.JSONDecodeError:
        return jsonify({"error": "Falha ao gerar persona. Tente novamente."}), 500

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
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        return jsonify({"error": "Falha ao processar avaliação. Tente novamente."}), 500

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
