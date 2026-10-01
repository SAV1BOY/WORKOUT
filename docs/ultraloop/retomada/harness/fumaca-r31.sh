#!/bin/bash
B=https://treino-terraco.vercel.app
SHA=${SHA:?}
D=/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/ultraloop/r31/deploy/fumaca/$RUN
mkdir -p $D
ok(){ echo "OK   | $1"; }
no(){ echo "FALHOU | $1"; }
chk(){ if [ "$2" = "1" ]; then ok "$1"; else no "$1"; fi; }

curl -s --max-time 25 "$B/login" -o $D/login.html -w "%{http_code}" > $D/login.code
LC=$(cat $D/login.code)
chk "/login 200 (recebido $LC)" $([ "$LC" = "200" ] && echo 1 || echo 0)
grep -q 'Treino do Terraço' $D/login.html && chk "/login contem 'Treino do Terraço'" 1 || chk "/login contem 'Treino do Terraço'" 0
grep -q 'Entrar' $D/login.html && chk "/login contem 'Entrar'" 1 || chk "/login contem 'Entrar'" 0
grep -q 'Configure NEXT_PUBLIC_SUPABASE_URL' $D/login.html && chk "/login SEM 'Configure NEXT_PUBLIC_SUPABASE_URL'" 0 || chk "/login SEM 'Configure NEXT_PUBLIC_SUPABASE_URL'" 1
grep -q 'é secreta' $D/login.html && chk "/login SEM 'é secreta'" 0 || chk "/login SEM 'é secreta'" 1

RC=$(curl -s --max-time 25 -o $D/raiz.txt -w "%{http_code}" "$B/")
LOC=$(curl -s --max-time 25 -o /dev/null -D - "$B/" | grep -i '^location:' | tr -d '\r' | head -1)
chk "/ -> 307 (recebido $RC) $LOC" $([ "$RC" = "307" ] && echo 1 || echo 0)
echo "$LOC" | grep -qi '/login' && chk "/ redireciona para /login" 1 || chk "/ redireciona para /login" 0

V=$(curl -s --max-time 25 "$B/versao")
echo "$V" | grep -q "$SHA" && chk "/versao == sha do merge" 1 || chk "/versao == sha do merge ($V)" 0

SC=$(curl -s --max-time 30 "$B/sw.js" -o $D/sw.js -w "%{http_code}")
chk "/sw.js 200 (recebido $SC)" $([ "$SC" = "200" ] && echo 1 || echo 0)
grep -q '/~offline' $D/sw.js && chk "/sw.js contem '/~offline'" 1 || chk "/sw.js contem '/~offline'" 0
grep -q 'figuras/' $D/sw.js && chk "/sw.js contem 'figuras/'" 1 || chk "/sw.js contem 'figuras/'" 0

CSSH=$(grep -o '/_next/static/css/[a-f0-9]*\.css' $D/login.html | sort -u | head -1)
echo "CSS do HTML de /login: $CSSH"
grep -qF "$CSSH" $D/sw.js && chk "/sw.js lista o MESMO css do /login ($CSSH)" 1 || chk "/sw.js lista o MESMO css do /login ($CSSH)" 0

MC=$(curl -s --max-time 25 "$B/manifest.webmanifest" -o $D/manifest.json -w "%{http_code}")
chk "/manifest.webmanifest 200 (recebido $MC)" $([ "$MC" = "200" ] && echo 1 || echo 0)
grep -q 'Treino do Terra' $D/manifest.json && chk "/manifest.webmanifest contem 'Treino do Terraço'" 1 || chk "/manifest.webmanifest contem 'Treino do Terraço'" 0

OC=$(curl -s --max-time 25 "$B/~offline" -o $D/offline.html -w "%{http_code}")
chk "/~offline 200 (recebido $OC)" $([ "$OC" = "200" ] && echo 1 || echo 0)

# scripts de /login
grep -o '/_next/static/[^"]*\.js' $D/login.html | sed 's/\\u0026.*//' | sort -u > $D/scripts.txt
N=$(wc -l < $D/scripts.txt); BAD=0
while read -r s; do
  c=$(curl -s --max-time 25 -o /dev/null -w "%{http_code}" "$B$s")
  [ "$c" = "200" ] || { BAD=$((BAD+1)); echo "  script ruim: $s -> $c"; }
done < $D/scripts.txt
chk "os $N scripts /_next/static de /login 200 (ruins: $BAD)" $([ "$BAD" = "0" ] && echo 1 || echo 0)

# marcadores do L33 (chunks do catálogo e da ficha)
grep -o "static/chunks/[^'\"]*\.js" $D/sw.js | sort -u > $D/todos-chunks.txt
mkdir -p $D/c
while read -r c; do f=$D/c/$(echo "$c" | sed 's#static/chunks/##; s#[/()]#_#g; s#%5B#[#g; s#%5D#]#g'); curl -s --max-time 25 "$B/_next/$c" -o "$f"; done < $D/todos-chunks.txt
N=$(ls $D/c | wc -l); echo "chunks baixados do sw.js: $N"
G=/tmp/claude-0/-home-user-WORKOUT/19b8c32e-5647-551a-b360-eec4ee383d9c/scratchpad/ultraloop/grafo-chunks.py
PC=$(ls $D/c/ | grep '^app__app__exercicios_page-' | head -1)
[ -n "$PC" ] && chk "chunk app/(app)/exercicios/page-* listado no sw.js ($PC)" 1 || chk "chunk app/(app)/exercicios/page-* listado no sw.js" 0
grep -q 'camadaModal:ultimaEntrada' "$D/c/$PC" && chk "marcador L33 'camadaModal:ultimaEntrada' no chunk $PC" 1 || { python3 $G $D/c "$D/c/$PC" 'camadaModal:ultimaEntrada' && chk "marcador L33 'camadaModal:ultimaEntrada' no grafo do catálogo $PC" 1 || chk "marcador L33 'camadaModal:ultimaEntrada' no catálogo" 0; }
grep -q '(principal)' "$D/c/$PC" && chk "marcador L33 '(principal)' no chunk $PC" 1 || { python3 $G $D/c "$D/c/$PC" '(principal)' && chk "marcador L33 '(principal)' no grafo do catálogo $PC" 1 || chk "marcador L33 '(principal)' no catálogo" 0; }
PF=$(ls $D/c/ | grep '^app__app__exercicios_\[id\]_page-' | head -1)
[ -n "$PF" ] && chk "chunk app/(app)/exercicios/[id]/page-* listado no sw.js ($PF)" 1 || chk "chunk app/(app)/exercicios/[id]/page-* listado no sw.js" 0
grep -q 'camadaModal:ultimaEntrada' "$D/c/$PF" && chk "marcador L33 'camadaModal:ultimaEntrada' no chunk $PF" 1 || { python3 $G $D/c "$D/c/$PF" 'camadaModal:ultimaEntrada' && chk "marcador L33 'camadaModal:ultimaEntrada' no grafo da ficha $PF" 1 || chk "marcador L33 'camadaModal:ultimaEntrada' na ficha" 0; }
