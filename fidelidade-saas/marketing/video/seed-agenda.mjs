// Dados do vídeo da agenda: a "Barbearia do Léo" com dois profissionais e dois serviços (não apaga o resto da demonstração).
// Uso: BASE=... DB=... node marketing/video/seed-agenda.mjs
import { BASE, sql, launch, prepare } from './lib.mjs';

const b = await launch();
const rctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await prepare(rctx);
const r = await rctx.newPage();
await r.goto(BASE + '/');
await r.fill('#name', 'Barbearia do Léo');
await r.fill('#email', 'leo@demo.com');
await r.fill('#phone', '11987654321');
await r.fill('#password', 'senha-segura-1');
await r.click('text=Ir para pagamento seguro');
await r.waitForURL('**/pagamento/simulado');
await r.click('text=Simular pagamento');
await r.waitForURL('**/dashboard/configuracoes');
await r.waitForSelector('[role=dialog]:has-text("Pagamento confirmado")');
await r.click('[role=dialog] >> text=Pular guia');
await r.waitForSelector('[role=dialog]', { state: 'detached' });
const U = 'form:has(input[name=id])';
await r.fill(`${U} input[name=street]`, 'Rua do Comércio');
await r.fill(`${U} input[name=number]`, '45');
await r.fill(`${U} input[name=district]`, 'Vila Nova');
await r.fill(`${U} input[name=city]`, 'São Paulo');
await r.selectOption(`${U} select[name=state]`, 'SP');
await r.fill(`${U} input[id$="o-1"]`, '09:00'); await r.fill(`${U} input[id$="c-1"]`, '19:00');
await r.click(`${U} button[aria-label^="Repetir o horário de Segunda"]`);
await r.check(`${U} li:has(span:text-is("Domingo")) input[type=checkbox]`);
await r.click('button:has-text("Salvar unidade")');
await r.waitForSelector('text=Unidade salva.');
await r.goto(BASE + '/dashboard/configuracoes?etapa=premios');
await r.waitForSelector('[data-testid=etapa-premios]');
await r.fill('input[name=name][placeholder^="Ex.: Sobremesa"]', 'Corte grátis');
await r.fill('input[name=pointsCost]', '3000');
await r.click('text=Adicionar produto');
await r.waitForSelector('li:has-text("Corte grátis")');
await r.click('text=Concluir configuração');
await r.waitForURL('**/dashboard/caixa');
await b.close();

// serviços e profissionais (tempo de cada um e dias de trabalho já seguem o horário da unidade)
const rid = sql(`select id from "Restaurant" where email='leo@demo.com'`);
const uid = sql(`select id from "Unit" where "restaurantId"='${rid}' limit 1`);
sql(`update "Unit" set "openingSchedule" = (select jsonb_agg(jsonb_build_object('day', d, 'open', '09:00', 'close', '19:00', 'closed', d = 0)) from generate_series(0,6) d) where id='${uid}'`);
sql(`insert into "Service"(id,"restaurantId",name,"durationMin","priceCents") values (gen_random_uuid(),'${rid}','Corte',40,5000),(gen_random_uuid(),'${rid}','Barba',30,3500)`);
const mk = (name, phone) => sql(`insert into "Resource"(id,"restaurantId","unitId",name,phone,capacity) values (gen_random_uuid(),'${rid}','${uid}','${name}','${phone}',1) returning id`).split('\n')[0];
mk('Léo', '11987654321'); mk('Rafa', '11976543210');
console.log('Agenda pronta: leo@demo.com / senha-segura-1');
