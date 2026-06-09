#!/bin/bash
cd "$(dirname "$0")"

# ── Check Python ──
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3 não encontrado. Instale em https://python.org e tente novamente."
  read -p "Pressione Enter para fechar..."
  exit 1
fi

# ── Check .env ──
if [ ! -f ".env" ]; then
  echo "❌ Arquivo .env não encontrado."
  echo ""
  echo "Crie um arquivo chamado .env nesta pasta com o seguinte conteúdo:"
  echo ""
  echo "  GROQ_API_KEY=sua_chave_aqui"
  echo ""
  echo "Obtenha sua chave gratuita em: https://console.groq.com/keys"
  read -p "Pressione Enter para fechar..."
  exit 1
fi

# ── Create venv if needed ──
if [ ! -d ".venv" ]; then
  echo "Criando ambiente virtual..."
  python3 -m venv .venv
fi

# ── Install dependencies ──
echo "Instalando dependências..."
.venv/bin/pip install -q -r requirements.txt

# ── Open browser ──
echo ""
echo "Iniciando SPICED & MEDDPICC Trainer..."
sleep 1
open http://localhost:5001

# ── Start server ──
.venv/bin/python app.py
