import assert from 'node:assert/strict';
import { test } from 'node:test';
import { goalText, pointsTitle } from './notify-text';

const rewards = [
  { name: 'Combo', pointsCost: 1200 },
  { name: 'Sobremesa', pointsCost: 500 },
];

test('avisa quanto falta para o próximo prêmio', () => {
  assert.equal(goalText(100, 450, rewards), 'Faltam 50 pontos para Sobremesa.');
  assert.equal(goalText(0, 499, rewards), 'Faltam 1 ponto para Sobremesa.');
});

test('avisa quando um prêmio acabou de ser liberado', () => {
  assert.equal(goalText(400, 520, rewards), 'Agora você já pode resgatar Sobremesa!');
  assert.equal(goalText(400, 1300, rewards), 'Agora você já pode resgatar Combo!');
});

test('sem aviso de meta quando já alcançou tudo ou não há prêmios', () => {
  assert.equal(goalText(1300, 1400, rewards), null);
  assert.equal(goalText(0, 10, []), null);
});

test('título dos pontos', () => {
  assert.equal(pointsTitle(1, 'Zé'), '+1 ponto · Zé');
  assert.equal(pointsTitle(1500, 'Zé'), '+1.500 pontos · Zé');
});
