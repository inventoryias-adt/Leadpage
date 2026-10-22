// Vídeo 8 (avaliações): a cliente avalia o atendimento, a nota aparece no lugar, o dono responde e a resposta aparece.
// Gera out/avaliacoes-raw.mp4 e out/avaliacoes-beats.json. Rode depois de seed.mjs, seed-agenda.mjs e seed-extra.mjs.
import fs from 'node:fs';
import { BASE, sql, launchPhone, phoneContext, record, tap, scroll, wait, beats, joinParts } from './lib.mjs';
const OUT = 'marketing/video/out';
fs.mkdirSync(OUT, { recursive: true });
const rid = sql(`select id from "Restaurant" where email='leo@demo.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' limit 1`);
const corte = sql(`select id from "Service" where "restaurantId"='${rid}' and name='Corte'`);
const leo = sql(`select id from "Resource" where "restaurantId"='${rid}' and name='Léo'`);
const cid = (email) => sql(`select id from "Customer" where email='${email}'`);

// aberto o dia todo, para o vídeo não depender da hora em que é gravado
sql(`update "Unit" set "openingSchedule" = (select jsonb_agg(jsonb_build_object('day', d, 'open', '06:00', 'close', '23:59', 'closed', false)) from generate_series(0,6) d) where id='${unit}'`);
// limpa e cria o cenário: duas avaliações antigas (de outras pessoas) e um atendimento concluído da Marina, ainda sem avaliar
sql(`delete from "RateLimit"; delete from "Review"; delete from "Booking" where "restaurantId"='${rid}'; delete from "Notification" where "createdAt" > (select min("createdAt") from "Transaction" where type='EARN') + interval '5 seconds'`);
sql(`delete from "Customer" where email='fernanda@demo.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'11144477735','11966665555','Fernanda Alves','fernanda@demo.com',"passwordHash","termsAcceptedAt","termsVersion" from "Customer" where email='marina@demo.com'`);
const booking = (who, daysAgo) => sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","completedAt") values (gen_random_uuid()::text,'${rid}','${unit}','${cid(who)}','${corte}','${leo}',now() - interval '${daysAgo} days',now() - interval '${daysAgo} days' + interval '40 minutes','COMPLETED','Corte',40,5000,now() - interval '${daysAgo} days' + interval '40 minutes') returning id`).split('\n')[0];
const review = (id, who, place, staff, text, daysAgo) => sql(`insert into "Review"(id,"restaurantId","customerId","bookingId","resourceId","placeRating","staffRating",comment,"createdAt") values (gen_random_uuid()::text,'${rid}','${cid(who)}','${id}','${leo}',${place},${staff},'${text}',now() - interval '${daysAgo} days')`);
review(booking('carlos@demo.com', 6), 'carlos@demo.com', 5, 5, 'Ambiente ótimo e o Léo é nota 10.', 5);
review(booking('fernanda@demo.com', 9), 'fernanda@demo.com', 4, 4, 'Muito bom, só esperei um pouco.', 8);
const mine = booking('marina@demo.com', 0.2);
sql(`insert into "Notification"(id,"customerId","restaurantId",title,body,href,"createdAt") values (gen_random_uuid()::text,'${cid('marina@demo.com')}','${rid}','Como foi o atendimento?','Corte · Barbearia do Léo. Conte em 1 minuto: sua nota ajuda os outros clientes.','/perfil/agendamentos/${mine}/avaliar',now())`);

const b = await launchPhone();
// parte 1: a cliente avalia
const cctx = await phoneContext(b); const c = await cctx.newPage();
await c.goto(BASE + '/entrar'); await c.fill('input[name=email]', 'marina@demo.com'); await c.fill('input[name=password]', 'senha-cliente-1');
await c.click('button:has-text("Entrar") >> nth=-1'); await c.waitForURL('**/carteira'); await c.waitForLoadState('networkidle');
await c.goto(BASE + '/avisos'); await c.waitForSelector('a:has-text("Como foi o atendimento?")'); await wait(c, 1200);
const s1 = await record(c, `${OUT}/avaliacoes-p1.mp4`); const b1 = beats(s1); b1.mark('aviso');
await c.mouse.move(200, 500); await c.mouse.move(210, 520); // força um quadro novo, sem o esqueleto de carregamento
await wait(c, 2600);
await tap(c, 'a:has-text("Como foi o atendimento?")', { pause: 500 }); await c.waitForURL('**/avaliar'); await c.waitForSelector('[data-testid=review-form]'); b1.mark('form');
await wait(c, 1600);
await tap(c, '[data-testid=stars-placeRating] button[aria-label="5 estrelas"]', { pause: 1000 }); b1.mark('lugar');
await tap(c, '[data-testid=stars-staffRating] button[aria-label="5 estrelas"]', { pause: 1000 }); b1.mark('atendente');
await tap(c, '#rv-comment', { pause: 300 });
await c.keyboard.type('Corte perfeito e atendimento rápido. Voltarei!', { delay: 45 }); b1.mark('comentario');
await wait(c, 700);
await scroll(c, 200, 500);
await tap(c, 'button:has-text("Enviar avaliação")', { pause: 400 });
await c.waitForSelector('[data-testid=review-thanks]'); b1.mark('enviado');
await wait(c, 2600);
const d1 = s1.now(); await s1();

// parte 2: a nota e a avaliação aparecem na página do lugar
await c.goto(`${BASE}/lugar/${rid}`); await c.waitForLoadState('networkidle'); await wait(c, 1200);
const s2 = await record(c, `${OUT}/avaliacoes-p2.mp4`); const b2 = beats(s2); b2.mark('nota');
await wait(c, 2600);
await scroll(c, 320, 700);
const sec2 = c.locator('button[aria-controls]:has-text("Avaliações")');
if ((await sec2.getAttribute('aria-expanded')) !== 'true') await tap(c, sec2, { pause: 600 });
b2.mark('lista');
await wait(c, 800);
await scroll(c, 360, 800);
await wait(c, 2600);
const d2 = s2.now(); await s2();

// parte 3: o dono responde
const octx = await phoneContext(b); const o = await octx.newPage();
await o.goto(BASE + '/login'); await o.fill('#email', 'leo@demo.com'); await o.fill('#password', 'senha-segura-1'); await o.click('button[type=submit]'); await o.waitForURL('**/dashboard'); await o.waitForLoadState('networkidle');
await o.goto(BASE + '/dashboard/avaliacoes'); await o.waitForSelector('[data-testid=owner-review]'); await wait(o, 600);
const s3 = await record(o, `${OUT}/avaliacoes-p3.mp4`); const b3 = beats(s3); b3.mark('dono');
await wait(o, 2800);
await scroll(o, 330, 700);
const mineCard = o.locator('[data-testid=owner-review]', { hasText: 'Corte perfeito' });
await tap(o, mineCard.locator('summary:has-text("Responder")'), { pause: 500 }); b3.mark('responder');
await tap(o, mineCard.locator('textarea[name=reply]'), { pause: 300 });
await o.keyboard.type('Obrigado, Marina! Até a próxima.', { delay: 45 });
await wait(o, 500);
await tap(o, mineCard.locator('button:has-text("Publicar resposta")'), { pause: 400 });
await o.waitForSelector('[data-testid=reviews-ok]'); b3.mark('publicada');
await wait(o, 2800);
const d3 = s3.now(); await s3();

// parte 4: a resposta aparece para todos
await c.goto(`${BASE}/lugar/${rid}`); await c.waitForLoadState('networkidle'); await wait(c, 1500);
const sec = c.locator('button[aria-controls]:has-text("Avaliações")');
if ((await sec.getAttribute('aria-expanded')) !== 'true') await tap(c, sec, { pause: 500 }); // o app lembra a seção aberta neste aparelho
await c.waitForFunction(() => document.querySelector('button[aria-controls][aria-expanded="true"] ~ *, [data-testid=place-review]')); await wait(c, 600);
await scroll(c, 780, 900); await wait(c, 400);
const s4 = await record(c, `${OUT}/avaliacoes-p4.mp4`); const b4 = beats(s4); b4.mark('resposta');
await wait(c, 3400);
const d4 = s4.now(); await s4(); await b.close();

const all = joinParts([1, 2, 3, 4].map((n, i) => ({ file: `${OUT}/avaliacoes-p${n}.mp4`, beats: [b1, b2, b3, b4][i].list, dur: [d1, d2, d3, d4][i] })), `${OUT}/avaliacoes-raw.mp4`);
fs.writeFileSync(`${OUT}/avaliacoes-beats.json`, JSON.stringify(all, null, 1));
console.log(JSON.stringify(all));
