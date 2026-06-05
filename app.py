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

if __name__ == "__main__":
    app.run(debug=True, port=5000)
