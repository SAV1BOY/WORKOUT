#!/usr/bin/env bash
# portoes.sh <checkout> <pasta-de-logs> <portão> [portão...]
set -eu

DIR=$1
LOGS=$(realpath -m "$2")
shift 2
cd "$DIR"
LOCK=${ULTRALOOP_LOCK:-/tmp/ultraloop-pesado.lock}
HASH=$(git rev-parse HEAD)
if [[ -n $(git status --porcelain) ]]; then
  echo "A árvore contém alterações. Os portões registram o commit que foi testado." >&2
  exit 2
fi

# Percorre a história do lote na ordem, sem atribuir uma SPEC posterior a código anterior.
BASE=${ULTRALOOP_BASE:-}
if [[ -z $BASE ]] && git rev-parse --verify -q refs/remotes/origin/main >/dev/null; then
  BASE=$(git merge-base HEAD origin/main)
fi
if [[ -n $BASE ]]; then
  git merge-base --is-ancestor "$BASE" "$HASH" || { echo "A base não é ancestral do lote." >&2; exit 2; }
  spec=0
  while read -r commit; do
    [[ -n $commit ]] || continue
    arquivos=$(git diff-tree -r --no-commit-id --name-only "$commit^1" "$commit")
    if grep -qx 'SPEC.md' <<< "$arquivos"; then spec=1; fi
    if (( ! spec )) && grep -Eq '^(app|lib|components|data|supabase)/' <<< "$arquivos"; then
      echo "O commit $commit altera o app antes da SPEC do lote." >&2
      exit 2
    fi
  done < <(git rev-list --first-parent --reverse "$BASE..$HASH")
fi

mkdir -p "$LOGS/pids"
STATUS="$LOGS/$HASH.status"
export ULTRALOOP_PID_FILE
# Cada execução possui sua própria lista. Um segundo processo à espera do lock
# jamais reutiliza os PIDs de quem está rodando.
ULTRALOOP_PID_FILE=
portao=preparo
grupo=
limpar_grupos() {
  local pid i
  while read -r pid; do
    [[ $pid =~ ^[0-9]+$ ]] || continue
    # Grupos criados por este portão; portas ocupadas por terceiros ficam intactas.
    if kill -TERM -- "-$pid" 2>/dev/null; then
      for ((i=0; i<20; i++)); do
        kill -0 -- "-$pid" 2>/dev/null || break
        sleep 0.1
      done
      kill -KILL -- "-$pid" 2>/dev/null || true
    fi
  done < "$ULTRALOOP_PID_FILE"
}
ao_sair() {
  local codigo=$?
  if [[ -n $grupo ]]; then limpar_grupos; fi
  if (( codigo != 0 )); then echo "falhou:$portao" > "$STATUS"; fi
}
trap ao_sair EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

pesado() {
  # O descritor pertence ao shell. Os serviços não herdam o lock.
  flock -w 5400 9 || return
  ULTRALOOP_PID_FILE=$(mktemp --suffix=.txt "$LOGS/pids/$HASH.XXXXXX")
  setsid "$@" 9>&- &
  grupo=$!
  echo "$grupo" >> "$ULTRALOOP_PID_FILE"
  local codigo=0
  wait "$grupo" || codigo=$?
  limpar_grupos
  grupo=
  flock -u 9
  return "$codigo"
}

echo rodando > "$STATUS"
{
  echo "checkout=$DIR head=$HASH inicio=$(date -u +%FT%TZ)"
  for portao in "$@"; do
    echo "=== $portao @ $(date -u +%T) ==="
    case $portao in
      lint) npm run lint ;;
      tsc) npx tsc --noEmit ;;
      test) pesado npm test ;;
      build) pesado npm run build
             cp .next/app-build-manifest.json "$LOGS/$HASH.manifest-prod.json" ;;
      build:e2e) pesado npm run build:e2e ;;
      e2e) pesado npm run e2e ;;
      varredura) VARREDURA=1 pesado npm run e2e -- --grep varredura ;;
      e2e-grep:*) pesado npm run e2e -- --grep "${portao#e2e-grep:}" ;;
      *) echo "Portão desconhecido: $portao"; exit 2 ;;
    esac
  done
  if [[ $(git rev-parse HEAD) != "$HASH" || -n $(git status --porcelain) ]]; then
    portao=checkout
    echo "O checkout mudou durante a verificação."
    exit 2
  fi
  echo "fim=$(date -u +%FT%TZ)"
  echo ok > "$STATUS"
} > "$LOGS/$HASH.log" 2>&1 9>"$LOCK"
