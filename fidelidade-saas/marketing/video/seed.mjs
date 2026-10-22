// Dados de demonstração dos vídeos: o "Café da Esquina" com prêmios, equipe e uma cliente com pontos.
// Uso: BASE=http://localhost:3001 DB=postgresql://postgres:postgres@localhost:5432/fidelidade2 node marketing/video/seed.mjs
import assert from 'node:assert/strict';
import { BASE, sql, launch, prepare } from './lib.mjs';

sql('TRUNCATE "Restaurant","Customer","RateLimit" CASCADE');
const b = await launch();
const rctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await prepare(rctx);
const r = await rctx.newPage();
await r.goto(BASE + '/');
await r.fill('#name', 'Café da Esquina');
await r.fill('#email', 'cafe@demo.com');
await r.fill('#phone', '11912345678');
await r.fill('#password', 'senha-segura-1');
await r.click('text=Ir para pagamento seguro');
await r.waitForURL('**/pagamento/simulado');
await r.click('text=Simular pagamento');
await r.waitForURL('**/dashboard/configuracoes');
await r.waitForSelector('[role=dialog]:has-text("Pagamento confirmado")');
await r.click('[role=dialog] >> text=Pular guia');
await r.waitForSelector('[role=dialog]', { state: 'detached' });

// unidade: endereço e horários (segunda a sábado, 8h às 19h)
const U = 'form:has(input[name=id])';
await r.fill(`${U} input[name=street]`, 'Rua das Flores');
await r.fill(`${U} input[name=number]`, '100');
await r.fill(`${U} input[name=district]`, 'Centro');
await r.fill(`${U} input[name=city]`, 'São Paulo');
await r.selectOption(`${U} select[name=state]`, 'SP');
await r.fill(`${U} input[id$="o-1"]`, '08:00'); await r.fill(`${U} input[id$="c-1"]`, '19:00');
await r.click(`${U} button[aria-label^="Repetir o horário de Segunda"]`);
await r.check(`${U} li:has(span:text-is("Domingo")) input[type=checkbox]`);
await r.click('button:has-text("Salvar unidade")');
await r.waitForSelector('text=Unidade salva.');

// prêmios
await r.goto(BASE + '/dashboard/configuracoes?etapa=premios');
await r.waitForSelector('[data-testid=etapa-premios]');
for (const [name, cost] of [['Café grátis', '500'], ['Pão de queijo + café', '900'], ['Fatia de bolo', '1500']]) {
  await r.fill('input[name=name][placeholder^="Ex.: Sobremesa"]', name);
  await r.fill('input[name=pointsCost]', cost);
  await r.click('text=Adicionar produto');
  await r.waitForSelector(`li:has-text("${name}")`);
  await r.waitForFunction(() => document.querySelector('input[name=name][placeholder^="Ex.: Sobremesa"]')?.value === '');
}
await r.click('text=Concluir configuração');
await r.waitForURL('**/dashboard/caixa');

// primeira compra da Marina (R$ 124,00 = 1.240 pontos) pelo QR Code
await r.fill('#amount', '124,00');
await r.click('text=Gerar QR Code');
await r.waitForSelector('text=Enviar por WhatsApp');
const token = sql('select token from "Claim" order by "createdAt" desc limit 1');
const cctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
await prepare(cctx);
const c = await cctx.newPage();
await c.goto(`${BASE}/r/${token}`);
await c.click('[role=tab]:has-text("Criar conta")');
await c.fill('#s-name', 'Marina Souza');
await c.fill('#s-cpf', '529.982.247-25');
await c.fill('#s-phone', '11999998888');
await c.fill('#s-email', 'marina@demo.com');
await c.fill('#s-password', 'senha-cliente-1');
await c.click('text=Receber meus pontos');
await c.waitForURL('**/carteira/*?credited=1');
assert.equal(sql('select balance from "Wallet"'), '1240');
await b.close();
console.log('Demo pronta: cafe@demo.com / senha-segura-1 (dono) e marina@demo.com / senha-cliente-1 (cliente), 1.240 pontos.');
