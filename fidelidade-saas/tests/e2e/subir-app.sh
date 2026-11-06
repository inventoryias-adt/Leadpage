#!/bin/bash
# Sobe (ou sobe de novo) o app em modo desenvolvimento na porta 3000 e aquece as rotas principais. Usado pelo CI.
# O servidor de desenvolvimento acumula memória e, perto do limite, se reinicia sozinho ("approaching the used memory threshold"),
# derrubando a conexão no meio de um teste. O CI roda os testes em duas metades e chama este script entre elas.
# O estado dos testes fica no Postgres, então reiniciar o servidor é seguro.
cd "$(dirname "$0")/../.." || exit 1
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 2
NODE_OPTIONS=--max-old-space-size=6144 nohup npx next dev -p 3000 >> /tmp/app.log 2>&1 &
for i in $(seq 1 60); do curl -fsS -o /dev/null http://localhost:3000/entrar && break; sleep 2; done
# aquece as rotas principais para a primeira visita de cada teste não estourar o tempo (o modo dev compila na hora)
for p in / /login /entrar /lugares /termos /privacidade /admin/entrar /dashboard /carteira /perfil; do curl -sS -o /dev/null --max-time 120 "http://localhost:3000$p" || true; done
