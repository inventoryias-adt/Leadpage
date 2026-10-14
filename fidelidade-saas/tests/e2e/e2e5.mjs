import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE='http://localhost:3000';
const sql=(q)=>execSync(`psql postgresql://postgres:postgres@localhost:5432/fidelidade -At -c ${JSON.stringify(q)}`).toString().trim();
sql('TRUNCATE "RateLimit"');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:1280,height:900} });
// O ambiente de teste não alcança ViaCEP/OpenStreetMap: respostas simuladas no formato real dessas APIs.
await ctx.route('https://viacep.com.br/ws/**', (route) => {
  const cep = route.request().url().match(/ws\/(\d+)/)[1];
  route.fulfill({ contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body: cep==='04204000'
    ? JSON.stringify({cep:'04204-000',logradouro:'Rua Costa Aguiar',complemento:'',bairro:'Ipiranga',localidade:'São Paulo',uf:'SP'})
    : JSON.stringify({erro:'true'}) });
});
await ctx.route('https://nominatim.openstreetmap.org/**', (route) => {
  route.fulfill({ contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body: JSON.stringify([{lat:'-23.5934',lon:'-46.6105'}]) });
});
const o = await ctx.newPage();
o.on('pageerror',e=>console.log('PAGEERROR',e.message));
await o.goto(BASE+'/login'); await o.waitForTimeout(2500);
await o.fill('#email','ze@burger.com'); await o.fill('#password','senha-segura-1');
await o.click('button:has-text("Entrar")'); await o.waitForURL('**/dashboard');
await o.goto(BASE + '/dashboard/configuracoes?abrir=tudo'); await o.waitForTimeout(2500);
sql(`delete from "Unit" where name='Loja CEP'`);
await o.click('summary:has-text("Adicionar outra unidade")');
const F='form:has(#unew-name)';
await o.fill('#unew-name','Loja CEP');
// CEP inexistente
await o.fill('#unew-cep','99999999');
await o.waitForSelector('text=CEP não encontrado');
console.log('1. CEP inexistente avisa OK');
// CEP válido preenche rua/bairro/cidade/UF
await o.fill('#unew-cep','04204000');
await o.waitForSelector('text=Endereço preenchido pelo CEP');
assert.equal(await o.inputValue('#unew-cep'),'04204-000');
assert.equal(await o.inputValue('#unew-street'),'Rua Costa Aguiar');
assert.equal(await o.inputValue('#unew-district'),'Ipiranga');
assert.equal(await o.inputValue('#unew-city'),'São Paulo');
assert.equal(await o.inputValue('#unew-state'),'SP');
console.log('2. CEP preenche rua, bairro, cidade e UF OK');
await o.fill('#unew-number','123');
await o.fill('#unew-complement','Loja 4');
await o.click(`${F} >> text=Achar pelo endereço`);
await o.waitForSelector(`${F} >> text=Arraste o mapa`);
await o.waitForSelector(`${F} .leaflet-container`);
console.log('3. localizar pelo endereço OK');
await o.fill('#unew-o-1','10:00'); await o.fill('#unew-c-1','22:00');
await o.click(`${F} button[aria-label^="Repetir o horário de Segunda"]`);
await o.screenshot({path:'cep-form.png', fullPage:true});
await o.click(`${F} button[type=submit]`);
await o.waitForSelector('text=Unidade adicionada.');
const row = sql(`select cep||'|'||street||'|'||number||'|'||complement||'|'||district||'|'||city||'|'||state||'|'||address||'|'||(latitude is not null) from "Unit" where name='Loja CEP'`);
console.log(row);
assert.equal(row,'04204000|Rua Costa Aguiar|123|Loja 4|Ipiranga|São Paulo|SP|Rua Costa Aguiar, 123 - Loja 4, Ipiranga, São Paulo - SP|true');
console.log('4. unidade salva com CEP, número, complemento e localização OK');
// validação: número obrigatório
await o.reload(); await o.waitForTimeout(2500);
await o.click('summary:has-text("Adicionar outra unidade")');
await o.fill('#unew-name','Sem numero'); await o.fill('#unew-street','Rua Teste'); await o.fill('#unew-city','Recife'); await o.selectOption('#unew-state','PE');
await o.fill('#unew-cep','1234');
await o.fill('#unew-o-1','10:00'); await o.fill('#unew-c-1','22:00');
await o.click(`${F} button[aria-label^="Repetir o horário de Segunda"]`);
await o.click(`${F} button[type=submit]`);
await o.waitForTimeout(800);
assert.equal(sql(`select count(*) from "Unit" where name='Sem numero'`),'0');
console.log('5. número obrigatório (formulário não envia sem ele) OK');
sql(`delete from "Unit" where name in ('Loja CEP','Sem numero')`);
await browser.close(); console.log('ALL OK (endereço/CEP)');
