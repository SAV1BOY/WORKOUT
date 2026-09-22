#!/usr/bin/env bash
# Portões do ultraloop — uso: portoes.sh <checkout> <pasta-de-logs> <portões...>
#   portões: lint tsc test build build:e2e e2e varredura e2e-grep:<padrão>
# Os pesados (test, build, build:e2e, e2e, varredura) rodam sob um lock único:
# nunca dois builds/e2e ao mesmo tempo nesta máquina de 4 CPUs.
# Escreve <hash>.log, <hash>.status (rodando | ok | falhou:<portão>) e, no build
# de produção, <hash>.manifest-prod.json (nomes dos chunks para a fumaça).
set -u
DIR=$1; LOGS=$2; shift 2
LOCK=${ULTRALOOP_LOCK:-/tmp/ultraloop-pesado.lock}
cd "$DIR" || exit 2
HASH=$(git rev-parse --short HEAD); mkdir -p "$LOGS"
echo rodando > "$LOGS/$HASH.status"
{
  echo "checkout=$DIR head=$HASH inicio=$(date -u +%H:%M:%S) E2E_PORT=${E2E_PORT:-3100} MOCK_SUPABASE_PORT=${MOCK_SUPABASE_PORT:-54321}"
  for p in "$@"; do
    echo "=== $p @ $(date -u +%H:%M:%S) ==="
    case $p in
      lint)  npm run lint ;;
      tsc)   npx tsc --noEmit ;;
      test)  flock -w 5400 "$LOCK" npm test ;;
      build) flock -w 5400 "$LOCK" npm run build && cp .next/app-build-manifest.json "$LOGS/$HASH.manifest-prod.json" ;;
      build:e2e) flock -w 5400 "$LOCK" npm run build:e2e ;;
      e2e)   flock -w 5400 "$LOCK" npm run e2e ;;
      varredura) VARREDURA=1 flock -w 5400 "$LOCK" npm run e2e -- --grep varredura ;;
      e2e-grep:*) flock -w 5400 "$LOCK" npm run e2e -- --grep "${p#e2e-grep:}" ;;
      *) echo "portão desconhecido: $p"; false ;;
    esac || { echo "FALHOU: $p @ $(date -u +%H:%M:%S)"; echo "falhou:$p" > "$LOGS/$HASH.status"; exit 1; }
  done
  echo "fim=$(date -u +%H:%M:%S)"
  echo ok > "$LOGS/$HASH.status"
} > "$LOGS/$HASH.log" 2>&1
