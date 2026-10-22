// Vídeo 7 (lista de espera): o dia está lotado, a cliente entra na fila, alguém cancela e ela marca o horário que abriu.
// Gera out/espera-raw.mp4 e out/espera-beats.json. O cancelamento do Carlos é feito de verdade no app, entre as duas partes.
import fs from 'node:fs';
import { BASE, sql, resetAgenda, launchPhone, phoneContext, record, tap, scroll, wait, beats, joinParts } from './lib.mjs';
const OUT = 'marketing/video/out';
fs.mkdirSync(OUT, { recursive: true });
resetAgenda();
// avisos de outros vídeos não podem aparecer no feed: fica só o da primeira compra
sql(`delete from "Notification" where "createdAt" > (select min("createdAt") from "Transaction" where type='EARN') + interval '5 seconds'`);
const rid = sql(`select id from "Restaurant" where email='leo@demo.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${rid}' limit 1`);
const corte = sql(`select id from "Service" where "restaurantId"='${rid}' and name='Corte'`);
const [leo, rafa] = ['Léo', 'Rafa'].map((n) => sql(`select id from "Resource" where "restaurantId"='${rid}' and name='${n}'`));
const carlos = sql(`select id from "Customer" where email='carlos@demo.com'`);
// amanhã (Brasília); domingo a barbearia fecha, então pula
const d = new Date(Date.now() - 3 * 3600e3 + 86400e3); if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
const day = d.toISOString().slice(0, 10);

// dia lotado: blocos de 40 minutos das 9h às 19h para o Léo e para o Rafa; o das 13:00 com o Léo é do Carlos
for (const [res, who] of [[leo, 'leo'], [rafa, 'rafa']]) {
  for (let i = 0; i < 15; i++) {
    const mine = who === 'leo' && i === 6;
    sql(`insert into "Booking"(id,"restaurantId","unitId","customerId","guestName","createdBy","serviceId","resourceId","startsAt","endsAt",status,"serviceName","durationMin","priceCents","createdAt") values (gen_random_uuid()::text,'${rid}','${unit}',${mine ? `'${carlos}'` : 'null'},${mine ? 'null' : "'Reservado'"},${mine ? 'null' : "'OWNER'"},'${corte}','${res}',('${day} 09:00:00-03')::timestamptz + make_interval(mins => ${i * 40}),('${day} 09:40:00-03')::timestamptz + make_interval(mins => ${i * 40}),'CONFIRMED','Corte',40,5000,now())`);
  }
}
const agendar = `${BASE}/lugar/${rid}/agendar?servico=${corte}&data=${day}`;
const login = async (page, email) => { await page.goto(BASE + '/entrar'); await page.fill('input[name=email]', email); await page.fill('input[name=password]', 'senha-cliente-1'); await page.click('button:has-text("Entrar") >> nth=-1'); await page.waitForURL('**/carteira'); await page.waitForLoadState('networkidle'); };

const b = await launchPhone();
const mctx = await phoneContext(b); const m = await mctx.newPage(); await login(m, 'marina@demo.com');
const kctx = await phoneContext(b); const k = await kctx.newPage(); await login(k, 'carlos@demo.com');
await m.goto(agendar); await m.waitForSelector('[data-testid=waitlist-offer]'); await wait(m, 500);

// parte 1: dia lotado e entrada na fila
const s1 = await record(m, `${OUT}/espera-p1.mp4`); const b1 = beats(s1); b1.mark('lotado');
await wait(m, 2800);
await scroll(m, 300, 700); await wait(m, 700);
b1.mark('faixa');
await m.selectOption('#wait-period', 'AFTERNOON'); await wait(m, 1400);
await tap(m, '[data-testid=waitlist-join]', { pause: 500 }); await m.waitForSelector('[data-testid=waitlist-on]'); b1.mark('nafila');
await wait(m, 3200);
const d1 = s1.now(); await s1();

// alguém cancela (de verdade, pelo app do Carlos)
await k.goto(BASE + '/perfil/agendamentos'); await k.waitForSelector('button:has-text("Cancelar agendamento")');
await k.click('button:has-text("Cancelar agendamento")'); await k.waitForURL('**cancelado=1**');
for (let i = 0; i < 40 && sql(`select count(*) from "Notification" where title like 'Abriu um horário%'`) === '0'; i++) await wait(m, 300);

// parte 2: o aviso e o horário reservado
await m.goto(BASE + '/avisos'); await m.waitForLoadState('networkidle'); await wait(m, 500);
const s2 = await record(m, `${OUT}/espera-p2.mp4`); const b2 = beats(s2); b2.mark('aviso');
await wait(m, 3000);
await tap(m, 'a:has-text("Abriu um horário"), a:has-text("Abrir horário"), a:has-text("Ver horário")', { pause: 600 }); await m.waitForSelector('[data-testid=hold-active]'); b2.mark('reservado');
await wait(m, 2200);
await scroll(m, 1100, 1100); await wait(m, 800);
await tap(m, 'button:has-text("Confirmar agendamento")', { pause: 400 });
await m.waitForURL('**/perfil/agendamentos**'); await m.waitForLoadState('networkidle'); b2.mark('agendado');
await wait(m, 3000);
const d2 = s2.now(); await s2(); await b.close();

const all = joinParts([{ file: `${OUT}/espera-p1.mp4`, beats: b1.list, dur: d1 }, { file: `${OUT}/espera-p2.mp4`, beats: b2.list, dur: d2 }], `${OUT}/espera-raw.mp4`);
fs.writeFileSync(`${OUT}/espera-beats.json`, JSON.stringify(all, null, 1));
console.log(JSON.stringify(all));
