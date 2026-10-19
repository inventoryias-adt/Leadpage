// Buscadores: robots.txt libera só as páginas públicas e o sitemap lista a página de venda e os termos.
import assert from 'node:assert/strict';
const BASE = 'http://localhost:3000';

const robots = await (await fetch(BASE + '/robots.txt')).text();
assert.match(robots, /User-Agent: \*/i);
assert.match(robots, /Allow: \//);
for (const p of ['/dashboard', '/admin', '/api/', '/r/', '/pagamento']) assert.ok(robots.includes(`Disallow: ${p}`), `robots deve bloquear ${p}`);
assert.match(robots, /Sitemap: https?:\/\/.+\/sitemap\.xml/);
console.log('1. robots.txt bloqueia painel/admin/api e aponta o sitemap OK');

const res = await fetch(BASE + '/sitemap.xml');
assert.equal(res.status, 200);
const xml = await res.text();
for (const p of ['/quero-o-fidelize', '/termos', '/privacidade']) assert.ok(xml.includes(p), `sitemap deve listar ${p}`);
assert.ok(!xml.includes('/dashboard'), 'sitemap não lista o painel');
console.log('2. sitemap.xml lista as páginas públicas OK');
console.log('ALL OK (robots e sitemap)');
