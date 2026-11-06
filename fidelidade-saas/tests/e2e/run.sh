#!/bin/bash
# Roda os testes de tela (Playwright) contra um app já no ar em http://localhost:3000 e o Postgres local `fidelidade`.
# Uso:  tests/e2e/run.sh            (todos, na ordem: o e2e.mjs cria os dados que os seguintes usam)
#       tests/e2e/run.sh e2e12 e2e31 (só alguns; precisam dos dados do e2e.mjs já criados)
# Variáveis: CHROMIUM_PATH (navegador; vazio = o do Playwright), DEV_MAIL_FILE (onde o app grava os e-mails de teste).
# Os prints saem em tests/e2e/out/ (ignorada pelo git).
cd "$(dirname "$0")" || exit 1
mkdir -p out && cp fixtures/* out/ && cd out || exit 1
E=..
if [ $# -gt 0 ]; then files=("$@"); else files=(e2e $(ls $E/e2e[0-9]*.mjs | xargs -n1 basename | sed 's/\.mjs$//' | sort -V)); fi
fail=0
for n in "${files[@]}"; do
  echo "=== $n"
  # e2e17 e e2e22 já tratam o aceite dos termos sozinhos; nos demais o preload marca a caixa "Li e concordo".
  pre=(--import "$PWD/$E/hydrate-preload.mjs")
  if [ "$n" != e2e17 ] && [ "$n" != e2e22 ]; then pre+=(--import "$PWD/$E/terms-preload.mjs"); fi
  pre+=(--import "$PWD/$E/sections-preload.mjs")
  timeout 400 node "${pre[@]}" "$E/$n.mjs" > "$n.log" 2>&1
  code=$?
  # O app de desenvolvimento do CI às vezes cai por alguns segundos no meio de um teste (ERR_CONNECTION_REFUSED, Failed to fetch).
  # Só nesse caso, e uma vez: espera o app voltar e roda o teste de novo. Qualquer outra falha derruba o teste na hora.
  if [ $code -ne 0 ] && grep -qE "ERR_CONNECTION_(REFUSED|RESET)|ECONNREFUSED|ECONNRESET|Failed to fetch" "$n.log"; then
    echo "(perdeu a conexão com o app em $n; esperando o app voltar e tentando mais uma vez)"
    cp "$n.log" "$n.queda.log"
    for i in $(seq 1 60); do curl -fsS -o /dev/null --max-time 5 http://localhost:3000/entrar && break; sleep 2; done
    timeout 400 node "${pre[@]}" "$E/$n.mjs" > "$n.log" 2>&1
    code=$?
  fi
  tail -25 "$n.log"
  [ $code -eq 0 ] || { echo "FALHOU: $n (código $code)"; fail=1; }
done
exit $fail
