import os
import json
import re
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"

# ── PRODUCT KNOWLEDGE ──
PRODUCTS = {
    "docusign-esign": {
        "name": "DocuSign eSignature",
        "vendor": "DocuSign",
        "context": "Cloud e-signature platform. Pains: slow document cycles, paper-based bottlenecks, compliance risk, remote signers. Differentiators: 1.7M customers, 95% of Fortune 500, 1000+ integrations. Buyer: VP Ops, Legal/Contracts Manager, Finance Director. Objections: security/compliance concerns, integration with legacy, Adobe Sign as cheaper alternative.",
    },
    "docusign-iam": {
        "name": "DocuSign IAM",
        "vendor": "DocuSign",
        "context": "AI-powered contract lifecycle management (CLM). Pains: agreements scattered across systems, manual review causing 40-60% cycle delays, missed renewals/obligations. Differentiators: AI contract analysis cuts manual review 70%+, built on eSignature infrastructure, end-to-end agreement lifecycle. Buyer: General Counsel, Procurement Director, CFO, Legal Ops. Objections: 'We use Salesforce CPQ', legal team wants manual control, Ironclad/Lexis+ as competitors.",
    },
    "sap-erp": {
        "name": "SAP Cloud ERP (S/4HANA Cloud)",
        "vendor": "SAP",
        "context": "Cloud-native ERP across finance, supply chain, HR, ops with embedded AI. Pains: legacy ERP silos, high on-premise maintenance costs, slow scaling, poor cross-functional visibility. Differentiators: 20% fewer customizations vs legacy SAP, embedded ML/AI, auto-scaling cloud. Buyer: CFO, COO, CIO, digital transformation leaders. Objections: migration complexity, moving critical ops to cloud, Oracle/Microsoft Dynamics as competitors.",
    },
    "sap-signavio": {
        "name": "SAP Signavio",
        "vendor": "SAP",
        "context": "Process mining & intelligence platform. Pains: documented processes don't match reality, hidden bottlenecks in multi-system workflows, no data-driven prioritization for transformation. Differentiators: mines actual event logs (SAP/Oracle/Salesforce), GenAI recommends optimizations, full transformation suite. Buyer: VP Ops, Business Analyst, Transformation Officer. Objections: 'our data isn't clean', 'consultants already map processes', Celonis/UiPath as competitors.",
    },
    "sap-leanix": {
        "name": "SAP LeanIX",
        "vendor": "SAP",
        "context": "Enterprise architecture management platform. Pains: spreadsheet-based app tracking, shadow IT waste, slow IT decisions, transformation impact blind spots. Differentiators: 5x Gartner Magic Quadrant Leader, replaces 5-10+ tools, used by Volkswagen/Telekom/DHL. Buyer: CIO, Enterprise Architect, IT Portfolio Manager. Objections: 'we have our own process', data governance concerns, ServiceNow as competitor.",
    },
    "sap-walkme": {
        "name": "SAP WalkMe",
        "vendor": "SAP",
        "context": "Digital adoption platform (DAP) with AI. Pains: high support tickets post-ERP rollout, low user adoption, slow onboarding, can't measure software ROI. Differentiators: contextual AI guidance on any app, cross-app workflow orchestration, 30% support ticket reduction. Buyer: VP IT Ops, HR Director, VP Customer Support. Objections: 'does it work on legacy systems?', hard to measure value, change management resistance.",
    },
    "tricentis": {
        "name": "Tricentis",
        "vendor": "Tricentis",
        "context": "AI-powered test automation & quality engineering platform. Pains: manual testing bottlenecks, expensive test maintenance, insufficient coverage causing prod incidents, siloed QA. Differentiators: agentic AI generates tests from requirements (60-70% less maintenance), end-to-end orchestration, supports SAP/Salesforce/Oracle. Buyer: VP Engineering, QA Director, DevOps Lead. Objections: 'our team is good at manual testing', expensive vs open-source (Selenium), steep learning curve.",
    },
    "syniti": {
        "name": "Syniti",
        "vendor": "Syniti",
        "context": "Unified data management & migration platform. Pains: multiple point solutions for migration/quality/MDM/governance, data quality causing migration delays, post-migration sync issues. Differentiators: all-in-one vs 5-10 vendors, 5000+ implementations, 99.7% customer satisfaction, purpose-built for SAP S/4HANA/Oracle migrations. Buyer: CDO, VP Data Management, SAP Program Manager. Objections: 'comfortable with current vendors', consolidation risk, Informatica/Talend as competitors.",
    },
}

VENDOR_LABELS = {
    "DocuSign": "DocuSign",
    "SAP": "SAP",
    "Tricentis": "Tricentis",
    "Syniti": "Syniti",
}

def build_seller_profile(product_ids):
    vendors = set(PRODUCTS[pid]["vendor"] for pid in product_ids if pid in PRODUCTS)
    if vendors == {"SAP"}:
        return "SAP Account Executive"
    elif vendors == {"DocuSign"}:
        return "DocuSign Account Executive"
    elif vendors <= {"SAP", "DocuSign"}:
        return "SAP & DocuSign Partner Account Executive"
    else:
        names = [v for v in vendors if v not in ("SAP", "DocuSign")]
        all_v = list(vendors)
        return f"{' & '.join(all_v)} Account Executive"

def build_product_context(product_ids):
    lines = []
    for pid in product_ids:
        p = PRODUCTS.get(pid)
        if p:
            lines.append(f"- {p['name']}: {p['context']}")
    return "\n".join(lines)


ROLEPLAY_SYSTEM = """You are {name}, {role} at {company} ({sector}).
You're in a discovery meeting with a {seller_role}.
Stay in character as a realistic executive. Reveal pain points and context only when asked the right questions — do NOT volunteer info upfront. 2-3 sentences per reply. Match the language the salesperson uses.

PRODUCTS BEING SOLD (use this to react realistically when they come up):
{product_context}"""

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/reset", methods=["POST"])
def reset():
    session.clear()
    return jsonify({"ok": True})


@app.route("/products", methods=["GET"])
def get_products():
    return jsonify([
        {"id": pid, "name": p["name"], "vendor": p["vendor"]}
        for pid, p in PRODUCTS.items()
    ])


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
        seller_role=scenario["seller_role"],
        product_context=scenario["product_context"],
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages += history
    messages.append({"role": "user", "content": message})

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=256,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        return jsonify({"error": f"Erro na API Groq: {str(e)[:200]}"}), 502

    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": reply})
    session["history"] = history

    return jsonify({"reply": reply})


PERSONA_PROMPT = 'Brazilian exec persona for "{company}" ({sector}). JSON only: {{"name":"<full PT name>","role":"<PT job title>"}}'

@app.route("/setup", methods=["POST"])
def setup():
    data = request.get_json()
    produtos = data.get("produtos", [])  # list of product IDs
    empresa = data.get("empresa", "").strip()
    contexto = data.get("contexto", "").strip()

    if not produtos or not empresa:
        return jsonify({"error": "produtos and empresa are required"}), 400

    seller_role = build_seller_profile(produtos)
    product_context = build_product_context(produtos)
    product_names = [PRODUCTS[pid]["name"] for pid in produtos if pid in PRODUCTS]

    prompt = PERSONA_PROMPT.format(company=empresa, sector=contexto or "enterprise")
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
        )
        raw = response.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": f"Erro na API Groq: {str(e)[:200]}"}), 502

    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    try:
        persona = json.loads(raw)
    except json.JSONDecodeError:
        return jsonify({"error": "Falha ao gerar persona. Tente novamente."}), 500

    session.clear()
    session["scenario"] = {
        "produtos": produtos,
        "produto_names": product_names,
        "empresa": empresa,
        "contexto": contexto,
        "seller_role": seller_role,
        "product_context": product_context,
        "persona_name": persona["name"],
        "persona_role": persona["role"],
    }
    session["history"] = []

    return jsonify({
        "persona_name": persona["name"],
        "persona_role": persona["role"],
        "empresa": empresa,
        "seller_role": seller_role,
        "product_names": product_names,
    })



HINTS_SYSTEM = """You are a sales coaching assistant helping a trainee during a live discovery call.

Your job: analyze the conversation so far and suggest 3-4 specific questions the salesperson should ask next to uncover missing SPICED/MEDDPICC information.

SPICED: S=Situation (company context), P=Pain (main problem), I=Impact (financial/operational cost of pain), CE=Critical Event (deadline/trigger forcing action), D=Decision (who decides, how, criteria)
MEDDPICC: M=Metrics (quantified success), E=Economic Buyer (budget authority), D=Decision Criteria (technical/business requirements), D2=Decision Process (steps/timeline), PP=Paper Process (legal/procurement), IP=Implicate Pain (connect pain to business impact), C=Champion (internal advocate), C2=Competition (alternatives being evaluated)

PRODUCTS BEING SOLD — use these specific pains, use cases and differentiators to make questions concrete and relevant:
{product_context}

Rules:
- Look at what's ALREADY been established in the transcript — don't suggest questions for things already answered
- Anchor questions in the real pains and use cases of the products above — not generic discovery questions
- Prioritize the most impactful gaps (Pain and Impact before Paper Process)
- Suggest natural, conversational questions — not robotic or formulaic
- Each suggestion must target a specific SPICED or MEDDPICC letter
- Write suggestions in {language}
- Return ONLY valid JSON: {{"hints":[{{"label":"<LETTER: field name>","question":"<the question to ask>"}}]}}"""

@app.route("/dicas", methods=["POST"])
def dicas():
    scenario = session.get("scenario")
    if not scenario:
        return jsonify({"error": "no scenario set"}), 400

    history = session.get("history", [])
    body = request.get_json()
    language = body.get("language", "Portuguese")
    focus = body.get("focus", "all")  # 'all' | 'spiced' | 'meddpicc'

    focus_instruction = ""
    if focus == "spiced":
        focus_instruction = "\nFocus ONLY on SPICED fields (S, P, I, CE, D). Do not suggest MEDDPICC questions."
    elif focus == "meddpicc":
        focus_instruction = "\nFocus ONLY on MEDDPICC fields (M, E, D, D2, PP, IP, C, C2). Do not suggest SPICED questions."

    transcript_lines = []
    for msg in history:
        role = "Empresa" if msg["role"] == "assistant" else "Você"
        transcript_lines.append(f"{role}: {msg['content']}")
    transcript = "\n".join(transcript_lines) if transcript_lines else "(conversa ainda não iniciada)"

    product_context = scenario.get("product_context", "")
    user_content = (
        f"Selling to: {scenario.get('empresa','?')} ({scenario.get('contexto','')})\n\n"
        f"TRANSCRIPT SO FAR:\n{transcript}"
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": HINTS_SYSTEM.format(language=language, product_context=product_context) + focus_instruction},
                {"role": "user", "content": user_content},
            ],
            max_tokens=512,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content.strip()
        result = json.loads(raw)
    except Exception as e:
        return jsonify({"error": f"Erro ao gerar dicas: {str(e)[:200]}"}), 502

    return jsonify(result)


EVALUATOR_SYSTEM = """Sales coach scoring a trainee's discovery call notes. Frameworks: SPICED (S=Situation,P=Pain,I=Impact,CE=Critical Event,D=Decision) | MEDDPICC (M=Metrics,E=Economic Buyer,D=Decision Criteria,D2=Decision Process,PP=Paper Process,IP=Implicate Pain,C=Champion,C2=Competition).

Score each filled field 0-100: accuracy vs transcript + completeness + specificity. Empty=0. Provide ideal answer for every field.
Language: write all "feedback" and "ideal" text in {language}. Keep JSON keys in English.

Return ONLY valid JSON:
{{"overall_score":<int>,"spiced":{{"S":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"P":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"I":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"CE":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"D":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}}}},"meddpicc":{{"M":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"E":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"D":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"D2":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"PP":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"IP":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"C":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}},"C2":{{"score":<int>,"feedback":"<1-2 sent>","ideal":"<text>"}}}}}}"""

@app.route("/avaliar", methods=["POST"])
def avaliar():
    data = request.get_json()
    spiced = data.get("spiced", {})
    meddpicc = data.get("meddpicc", {})
    language = data.get("language", "Portuguese")
    scenario = session.get("scenario", {})
    history = session.get("history", [])

    transcript_lines = []
    for msg in history:
        role = "Empresa" if msg["role"] == "assistant" else "Você"
        transcript_lines.append(f"{role}: {msg['content']}")
    transcript = "\n".join(transcript_lines) if transcript_lines else "(sem conversa ainda)"

    spiced_notes = "\n".join(f"{k}: {v}" for k, v in spiced.items() if v)
    meddpicc_notes = "\n".join(f"{k}: {v}" for k, v in meddpicc.items() if v)

    user_content = (
        f"Scenario: {', '.join(scenario.get('produto_names', ['?']))} @ {scenario.get('empresa','?')} ({scenario.get('contexto','')})\n\n"
        f"TRANSCRIPT:\n{transcript}\n\n"
        f"SPICED NOTES:\n{spiced_notes or '(empty)'}\n\n"
        f"MEDDPICC NOTES:\n{meddpicc_notes or '(empty)'}"
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": EVALUATOR_SYSTEM.format(language=language)},
                {"role": "user", "content": user_content},
            ],
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content.strip()
    except Exception as e:
        return jsonify({"error": f"Erro na API Groq: {str(e)[:200]}"}), 502

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        app.logger.error("JSON parse error: %s\nRaw: %s", e, raw[:500])
        return jsonify({"error": "Falha ao processar avaliação. Tente novamente."}), 500

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
