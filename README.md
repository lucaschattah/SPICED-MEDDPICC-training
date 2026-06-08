# SPICED & MEDDPICC Trainer

Sales methodology roleplay training app. Practice discovery conversations and get AI-scored feedback on your SPICED and MEDDPICC framework notes.

## Setup

1. Get a free Gemini API key at https://aistudio.google.com/apikey
2. Add your key to `.env`:
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
5. Open http://localhost:5001

## How to use

1. Fill in the scenario modal (product + target company)
2. Chat with the AI company representative — ask discovery questions
3. Fill in SPICED and MEDDPICC fields in the sidebar as you learn information
4. Click **Avaliar →** at any time to get a 0–100% score with feedback and ideal answers
5. Click **↺ Novo cenário** to start over
