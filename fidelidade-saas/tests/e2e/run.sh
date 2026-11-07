#!/bin/bash
# Roda os testes de tela (Playwright) contra um app já no ar em http://localhost:3000 e o Postgres local `fidelidade`.
# Uso:  tests/e2e/run.sh            (todos, na ordem: o e2e.mjs cria os dados que os seguintes usam)
#       tests/e2e/run.sh e2e12 e2e31 (só alguns; precisam dos dados do e2e.mjs já criados)
# Variáveis: CHROMIUM_PATH (navegador; vazio = o do Playwright), DEV_MAIL_FILE (onde o app grava os e-mails de teste),
#   REINICIAR_APOS (segundos; o CI usa 600: o app de desenvolvimento acumula memória e se reinicia sozinho por volta de 20 minutos no ar,
#   derrubando o teste da hora; com isso o app é reiniciado de forma limpa, entre dois testes, antes de chegar lá. Vazio = nunca).
# Os prints saem em tests/e2e/out/ (ignorada pelo git).
cd "$(dirname "$0")" || exit 1
mkdir -p out && cp fixtures/* out/ && cd out || exit 1
E=..
if [ $# -gt 0 ]; then files=("$@"); else files=(e2e $(ls $E/e2e[0-9]*.mjs | xargs -n1 basename | sed 's/\.mjs$//' | sort -V)); fi
fail=0
inicio_app=$(date +%s) # o CI sobe o app logo antes de chamar este script
APP_LOG=${APP_LOG:-/tmp/app.log}
# "Identidade" do servidor de desenvolvimento: os PIDs do next-server e quantas vezes o log já registrou o reinício por memória.
app_id() { echo "$(pgrep -f next-server 2>/dev/null | sort | tr '\n' ' ')|$(grep -c 'approaching the used memory threshold' "$APP_LOG" 2>/dev/null || echo 0)"; }
# Memória livre do computador e do servidor de desenvolvimento (MB): vai para o log do CI para sabermos quando o app está perto de cair.
mem() { echo "livre=$(free -m 2>/dev/null | awk '/^Mem:/{print $7}')MB app=$(ps -o rss= -p "$(pgrep -f next-server 2>/dev/null | paste -sd, -)" 2>/dev/null | awk '{s+=$1} END{printf "%d", s/1024}')MB"; }
for n in "${files[@]}"; do
  echo "=== $n"
  echo "(memória antes: $(mem))"
  # e2e17 e e2e22 já tratam o aceite dos termos sozinhos; nos demais o preload marca a caixa "Li e concordo".
  pre=(--import "$PWD/$E/hydrate-preload.mjs")
  if [ "$n" != e2e17 ] && [ "$n" != e2e22 ]; then pre+=(--import "$PWD/$E/terms-preload.mjs"); fi
  pre+=(--import "$PWD/$E/sections-preload.mjs")
  antes=$(app_id)
  timeout 400 node "${pre[@]}" "$E/$n.mjs" > "$n.log" 2>&1
  code=$?
  # O app de desenvolvimento do CI se reinicia sozinho quando a memória sobe ("approaching the used memory threshold") e, nos segundos em que
  # isso acontece, derruba o teste que estiver rodando (ERR_CONNECTION_REFUSED, Failed to fetch, "network error", clique que não faz nada).
  # Só se a conexão caiu, ou se o servidor trocou de processo / registrou o reinício durante este teste, e uma vez só: espera o app voltar e
  # roda o teste de novo. Qualquer outra falha derruba o teste na hora.
  if [ $code -ne 0 ] && { grep -qE "ERR_CONNECTION_(REFUSED|RESET)|ECONNREFUSED|ECONNRESET|Failed to fetch" "$n.log" || [ "$antes" != "$(app_id)" ]; }; then
    echo "(o app caiu ou reiniciou durante $n; esperando o app voltar e tentando mais uma vez)"
    echo "(memória agora: $(mem))"
    echo "--- fim do registro do app:"; tail -n 25 "$APP_LOG" 2>/dev/null | cut -c1-200
    echo "--- mensagens do sistema:"; dmesg 2>/dev/null | tail -n 5 | cut -c1-200
    cp "$n.log" "$n.queda.log"
    for i in $(seq 1 60); do curl -fsS -o /dev/null --max-time 5 http://localhost:3000/entrar && break; sleep 2; done
    timeout 400 node "${pre[@]}" "$E/$n.mjs" > "$n.log" 2>&1
    code=$?
  fi
  tail -25 "$n.log"
  [ $code -eq 0 ] || { echo "FALHOU: $n (código $code)"; fail=1; }
  # Entre dois testes (nunca no meio de um): se o app já está no ar há tempo demais, reinicia de forma limpa.
  if [ -n "$REINICIAR_APOS" ] && [ $(( $(date +%s) - inicio_app )) -ge "$REINICIAR_APOS" ]; then
    echo "(app no ar há mais de $REINICIAR_APOS s: reiniciando antes do próximo teste)"
    bash "$E/../subir-app.sh" > /dev/null 2>&1
    inicio_app=$(date +%s)
  fi
done
exit $fail
