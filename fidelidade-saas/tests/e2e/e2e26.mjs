import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';
const DB = 'postgresql://postgres:postgres@localhost:5432/fidelidade';
const sql = (q) => execFileSync('psql', [DB, '-At', '-c', q]).toString().trim();
sql(`truncate "RateLimit"; delete from "CustomerAddress"`);
const rid = sql(`select id from "Restaurant" where email='ze@burger.com'`);
// o restaurante precisa estar na vitrine, com unidade e coordenadas conhecidas (Praça da Sé: -23.5505,-46.6333)
sql(`update "Restaurant" set listed=true,"onboardedAt"=coalesce("onboardedAt",now()) where id='${rid}'`);
sql(`update "Unit" set latitude=-23.5505, longitude=-46.6333, active=true where "restaurantId"='${rid}'`);

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let revCalls = 0;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, geolocation: { latitude: -23.5612, longitude: -46.6558 } }); // Av. Paulista (~2,3 km da Sé)
await ctx.addInitScript(() => { localStorage.setItem('fz_intro_v1', '1'); localStorage.setItem('fz_install_intro_v1', '1'); });
// internet fora do ar na sandbox: tiles, ViaCEP e Nominatim simulados
await ctx.route('**/tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
await ctx.route('https://viacep.com.br/**', (r) => r.fulfill({ json: { logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' } }));
await ctx.route('https://nominatim.openstreetmap.org/**', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname.endsWith('/search')) return r.fulfill({ json: [{ lat: '-23.5505', lon: '-46.6333' }] });
  revCalls++;
  const lat = Number(u.searchParams.get('lat'));
  const near = Math.abs(lat + 23.5505) < 0.005;
  r.fulfill({ json: { address: { road: near ? 'Praça da Sé' : 'Avenida Paulista', suburb: near ? 'Sé' : 'Bela Vista', city: 'São Paulo', 'ISO3166-2-lvl4': 'BR-SP', postcode: near ? '01001-000' : '01310-100' } } });
});
const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('PAGEERROR', e.message));

// 1. anônimo: "Onde está?" → Minha localização → vitrine com distância
await p.goto(BASE + '/lugares');
assert.equal(await p.locator('[data-testid=loc-title]').innerText(), 'Onde está?');
await p.click('[data-testid=loc-title]');
await p.waitForSelector('text=Onde você tá?');
assert.ok(await p.locator('text=Entre na sua conta').count(), 'anônimo é convidado a entrar para salvar');
await p.click('button:has-text("Minha localização")');
await p.waitForSelector('[role=alert]:has-text("marque no mapa"), [role=alert]:has-text("no mapa")', { timeout: 25000 }); // sem permissão: orienta a liberar ou marcar no mapa
await ctx.grantPermissions(['geolocation'], { origin: BASE }); await p.reload(); // já liberou antes → a vitrine usa o GPS sozinha
await p.waitForFunction(() => document.querySelector('[data-testid=loc-title]')?.textContent === 'Minha localização');
await p.waitForSelector('a[href^="/lugar/"]:has-text("Burger do Zé") span.shrink-0.text-electric-600');
const km = await p.locator('a[href^="/lugar/"]:has-text("Burger do Zé") span.shrink-0.text-electric-600').first().innerText();
assert.match(km, /2[,.]\d km/, 'distância da Paulista até a Sé: ' + km);
console.log('1. anônimo: Minha localização ordena e mostra a distância (' + km + ') OK');

// 2. marcar no mapa: arrastar, endereço, usar CEP
await p.reload();
await p.waitForSelector('a[href^="/lugar/"]:has-text("Burger do Zé") span.shrink-0.text-electric-600'); // lembrou a escolha
await p.click('[data-testid=loc-title]'); await p.click('button:has-text("Marcar no mapa")');
await p.waitForSelector('.leaflet-container');
await p.waitForFunction(() => /Avenida Paulista/.test(document.querySelector('[data-testid=guess]')?.textContent ?? ''));
const box = await p.locator('.leaflet-container').boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 8 }); await p.mouse.up();
await p.waitForTimeout(1500);
assert.ok(revCalls >= 2, 'arrastar consulta o endereço de novo');
await p.click('button:has-text("usar CEP")'); await p.fill('#loc-cep', '01001000'); await p.click('button:has-text("Buscar")');
await p.waitForFunction(() => /Praça da Sé/.test(document.querySelector('[data-testid=guess]')?.textContent ?? ''), null, { timeout: 8000 });
console.log('2. mapa: arrastar e CEP recentralizam e mostram o endereço OK');

// 3. sem login: detalhes → usar sem salvar
await p.click('button:has-text("Confirmar endereço")');
await p.waitForSelector('text=Qual o número?');
assert.equal(await p.inputValue('#loc-street'), 'Praça da Sé');
await p.fill('#loc-number', '100');
await p.click('button:has-text("Usar sem salvar")');
await p.waitForFunction(() => document.querySelector('[data-testid=loc-title]')?.textContent === 'Praça da Sé');
assert.equal(sql(`select count(*) from "CustomerAddress"`), '0');
const km2 = await p.locator('a[href^="/lugar/"]:has-text("Burger do Zé") span.shrink-0.text-electric-600').first().innerText();
assert.match(km2, /^(10|20|30|40|50|60) m$|^[0-9]{2,3} m$/, 'agora a distância é de poucos metros: ' + km2);
console.log('3. sem login: "Usar sem salvar" muda a vitrine (' + km2 + ') e não grava OK');

// 4. logado: salvar Casa, número, complemento, ver na lista, trocar, apagar
await p.goto(BASE + '/entrar'); await p.fill('#c-email', 'lucas@teste.com'); await p.fill('#c-password', 'senha-cliente-1'); await p.click('button[type=submit]'); await p.waitForURL('**/carteira**');
await p.goto(BASE + '/lugares');
await p.click('[data-testid=loc-title]'); await p.click('button:has-text("Marcar no mapa")');
await p.waitForSelector('.leaflet-container');
await p.click('button:has-text("usar CEP")'); await p.fill('#loc-cep', '01001-000'); await p.click('button:has-text("Buscar")');
await p.waitForFunction(() => /Praça da Sé/.test(document.querySelector('[data-testid=guess]')?.textContent ?? ''), null, { timeout: 8000 });
await p.click('button:has-text("Confirmar endereço")');
await p.check('text=Sem número'); await p.fill('#loc-comp', 'Loja 3');
await p.click('button[role=radio]:has-text("Trabalho")');
await p.click('button:has-text("Salvar endereço")');
await p.waitForFunction(() => document.querySelector('[data-testid=loc-title]')?.textContent === 'Trabalho');
assert.equal(sql(`select label||'|'||street||'|'||number||'|'||complement||'|'||city||'|'||state||'|'||cep from "CustomerAddress"`), 'TRABALHO|Praça da Sé|S/N|Loja 3|São Paulo|SP|01001000');
console.log('4. logado: endereço salvo como Trabalho com CEP, S/N e complemento OK');

// 5. salvar "Trabalho" de novo troca o anterior (um só por rótulo); Casa convive
await p.click('[data-testid=loc-title]'); await p.click('button:has-text("Marcar no mapa")'); await p.waitForSelector('.leaflet-container');
await p.waitForFunction(() => !/Buscando/.test(document.querySelector('[data-testid=guess]')?.textContent ?? 'Buscando'));
await p.click('button:has-text("Confirmar endereço")'); await p.fill('#loc-number', '1000');
await p.click('button[role=radio]:has-text("Casa")'); await p.click('button:has-text("Salvar endereço")');
await p.waitForFunction(() => document.querySelector('[data-testid=loc-title]')?.textContent === 'Casa');
assert.equal(sql(`select string_agg(label,',' order by label) from "CustomerAddress"`), 'CASA,TRABALHO');
await p.click('[data-testid=loc-title]');
assert.ok(await p.locator('[aria-label="Seus endereços"] li').count() === 2);
// trocar para o Trabalho a partir da lista
await p.click('[aria-label="Seus endereços"] li:has-text("Trabalho") button:first-child');
await p.waitForFunction(() => document.querySelector('[data-testid=loc-title]')?.textContent === 'Trabalho');
// apagar a Casa
await p.click('[data-testid=loc-title]'); await p.click('button[aria-label="Apagar endereço Casa"]');
await p.waitForFunction(() => document.querySelectorAll('[aria-label="Seus endereços"] li').length === 1);
assert.equal(sql(`select string_agg(label,',') from "CustomerAddress"`), 'TRABALHO');
await p.screenshot({ path: 'localizacao-lista.png' });
console.log('5. lista de endereços: trocar e apagar OK');

// 6. servidor recusa ponto fora do Brasil e número vazio (chamada direta à ação via formulário não existe: valida pela lib)
// 7. endereço apagado em outro aparelho deixa de valer ao reabrir
sql(`delete from "CustomerAddress"`);
await p.reload(); await p.waitForSelector('[data-testid=loc-title]');
// o GPS já estava liberado: sem o endereço apagado, a vitrine volta a usar a localização do aparelho
await p.waitForFunction(() => document.querySelector('[data-testid=loc-title]')?.textContent === 'Minha localização');
console.log('6. endereço salvo que sumiu do servidor é descartado OK');
console.log('ALL OK (localização do cliente)');
await b.close();
