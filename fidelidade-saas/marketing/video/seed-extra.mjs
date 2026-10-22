// Dados extras dos vídeos de check-in, aniversário, pedido com retirada e lista de espera.
// Rode depois de seed.mjs (Café da Esquina + Marina) e seed-agenda.mjs (Barbearia do Léo).
// Uso: BASE=... DB=... node marketing/video/seed-extra.mjs
import { sql } from './lib.mjs';

// Café da Esquina: check-in, presente de aniversário e pedidos com retirada ligados, no endereço onde o vídeo "está"
const cafe = sql(`select id from "Restaurant" where email='cafe@demo.com'`);
sql(`update "Restaurant" set "checkInPoints"=20, "birthdayPoints"=100, "ordersEnabled"=true, "orderPrepMin"=15, listed=true where id='${cafe}'`);
sql(`update "Unit" set latitude=-23.5505, longitude=-46.6333 where "restaurantId"='${cafe}'`);
sql(`delete from "MenuItem" where "restaurantId"='${cafe}'`);
const item = (name, desc, price, cat, { promo = null, featured = false } = {}) =>
  sql(`insert into "MenuItem"(id,"restaurantId",name,description,"priceCents","promoCents",category,featured,active) values (gen_random_uuid(),'${cafe}','${name}','${desc}',${price},${promo ?? 'null'},'${cat}',${featured},true)`);
item('Combo café da manhã', 'Pão de queijo, café coado e suco de laranja', 2800, 'Combos', { promo: 2190, featured: true });
item('Pão de queijo (4 un.)', 'Quentinho, saindo do forno', 1400, 'Salgados');
item('Café coado', 'Grão da casa, 200 ml', 800, 'Bebidas');
item('Capuccino', 'Com canela e chantilly', 1500, 'Bebidas');
item('Fatia de bolo de cenoura', 'Com cobertura de chocolate', 1600, 'Doces');

// Barbearia do Léo: amanhã lotado (nenhum horário livre), e o Carlos tem o horário das 13:00 com o Léo
const leo = sql(`select id from "Restaurant" where email='leo@demo.com'`);
const unit = sql(`select id from "Unit" where "restaurantId"='${leo}' limit 1`);
const corte = sql(`select id from "Service" where "restaurantId"='${leo}' and name='Corte'`);
sql(`delete from "Customer" where email='carlos@demo.com'`);
sql(`insert into "Customer"(id,cpf,phone,name,email,"passwordHash","termsAcceptedAt","termsVersion") select gen_random_uuid()::text,'39053344705','11977776666','Carlos Lima','carlos@demo.com',"passwordHash","termsAcceptedAt","termsVersion" from "Customer" where email='marina@demo.com'`);
console.log('Extras prontos (Café: check-in/aniversário/pedidos; Barbearia: serviço', corte, 'unidade', unit, ')');
