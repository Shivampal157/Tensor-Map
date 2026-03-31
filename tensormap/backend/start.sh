#!/usr/bin/env bash
# Start TensorMap API without relying on "conda activate" + inline comments in zsh.
set -euo pipefail
cd "$(dirname "$0")"

ENV_NAME="${CONDA_ENV_NAME:-tensormap}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

if command -v conda >/dev/null 2>&1 && conda run -n "$ENV_NAME" python -V >/dev/null 2>&1; then
  echo "Using conda env: $ENV_NAME"
  conda run --no-capture-output -n "$ENV_NAME" python -m pip install -q -r requirements-core.txt -r requirements-ml.txt
  echo "Starting API + Socket.IO at http://${HOST}:${PORT}/ (stop with Ctrl+C)"
  exec conda run --no-capture-output -n "$ENV_NAME" python -m uvicorn main:socket_app --host "$HOST" --port "$PORT"
fi

if [[ -x .venv/bin/python ]]; then
  echo "Using .venv"
  .venv/bin/python -m pip install -r requirements-core.txt -r requirements-ml.txt
  exec .venv/bin/python -m uvicorn main:socket_app --host "$HOST" --port "$PORT"
fi

echo "No conda env '$ENV_NAME' and no .venv found."
echo "Create the env:  conda create -n $ENV_NAME python=3.12 -y"
echo "Then re-run:      bash start.sh"
exit 1
