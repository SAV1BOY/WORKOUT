#!/usr/bin/env bash
# Uso: capturas.sh <worktree> <porta-app> <porta-mock> <saida> [<base> <esperadas> <saida-diff> <tabela.md>]
# Pré: o .next do worktree foi assado por build:e2e com MOCK_SUPABASE_PORT=<porta-mock>.
# Sobe mock+app, gera as 60 capturas, (opcional) compara com a base, derruba tudo o
# que subiu — inclusive netos (next-server) — pela árvore de processos e pelo cwd.
set -u
S=/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/ultraloop
W=$1; PA=$2; PM=$3; D=$4; BASE=${5:-}; ESP=${6:-}; DIFF=${7:-}; TAB=${8:-}
mkdir -p "$D"; cd "$W" || exit 2
LOG=$D.servidores.log; : > "$LOG"
MOCK_SUPABASE_PORT=$PM nohup npx tsx scripts/mock-supabase.ts >> "$LOG" 2>&1 & M=$!
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:$PM NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon ALLOWED_EMAIL=miguelgsaviotti29@gmail.com nohup npx next start -p $PA >> "$LOG" 2>&1 & A=$!
for i in $(seq 1 120); do curl -s -o /dev/null http://127.0.0.1:$PA/login && curl -s -o /dev/null http://127.0.0.1:$PM/ && break; sleep 1; done
CSS=$(curl -s http://127.0.0.1:$PA/login | grep -o '/_next/static/css/[^"]*' | head -1)
echo "app=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PA/login) mock=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PM/) css=$CSS existe=$([ -f ".next${CSS#/_next}" ] && echo sim || echo NAO)"
CAPTURAS_APP=http://127.0.0.1:$PA CAPTURAS_MOCK=http://127.0.0.1:$PM CAPTURAS_DIR=$D flock -w 5400 $S/pesado.lock npx tsx scripts/capturas-ultraloop.ts > $D.log 2>&1
echo "capturas rc=$? pngs=$(ls $D/*.png 2>/dev/null | wc -l)"
if [ -n "$BASE" ]; then
  npx tsx scripts/comparar-capturas.ts "$BASE" "$D" --saida "$DIFF" ${ESP:+--esperadas "$ESP"} --limiar 0.5 > "$TAB" 2>&1
  echo "comparador rc=$? tabela=$TAB"
fi
matar_arvore() { local p=$1; for f in $(pgrep -P "$p" 2>/dev/null); do matar_arvore "$f"; done; kill "$p" 2>/dev/null; }
matar_arvore $M; matar_arvore $A; sleep 2
for q in $(ls /proc | grep -E '^[0-9]+$'); do
  c=$(readlink /proc/$q/cwd 2>/dev/null) || continue
  [ "$c" = "$W" ] || continue
  grep -qaE 'next-server|next start|mock-supabase' /proc/$q/cmdline 2>/dev/null || continue
  echo "órfão $q — matando"; kill -9 $q 2>/dev/null
done
sleep 1; echo "depois: $PA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:$PA/ || true) $PM=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:$PM/ || true)"
