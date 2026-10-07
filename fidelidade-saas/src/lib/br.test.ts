import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCpf, normalizePhone, formatCpf, maskCpf } from './br';
import { calculatePoints, parseMoneyToCents, startOfMonthBR } from './points';

test('CPF: valida dígitos verificadores', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('52998224725'), true);
  assert.equal(isValidCpf('529.982.247-24'), false);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCpf('123'), false);
});

test('CPF: formatação e máscara', () => {
  assert.equal(formatCpf('52998224725'), '529.982.247-25');
  assert.equal(maskCpf('52998224725'), '***.982.247-**');
});

test('telefone: normaliza para DDD+número', () => {
  assert.equal(normalizePhone('+55 (11) 91234-5678'), '11912345678');
  assert.equal(normalizePhone('(11) 3123-4567'), '1131234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('01912345678'), null);
});

test('dinheiro: interpreta formatos brasileiros e americanos', () => {
  assert.equal(parseMoneyToCents('150'), 15000);
  assert.equal(parseMoneyToCents('150,5'), 15050);
  assert.equal(parseMoneyToCents('150.50'), 15050);
  assert.equal(parseMoneyToCents('R$ 1.250,90'), 125090);
  assert.equal(parseMoneyToCents('1.250'), 125000);
  assert.equal(parseMoneyToCents('0,99'), 99);
  assert.equal(parseMoneyToCents('abc'), null);
  assert.equal(parseMoneyToCents('1,234'), 123400); // 3 casas depois do único separador = milhar
  assert.equal(parseMoneyToCents('10,999'), 1099900);
  assert.equal(parseMoneyToCents('10,9999'), null);
});

test('pontos: R$ 150 × 10 + interações', () => {
  assert.equal(calculatePoints(15000, 10), 1500);
  assert.equal(calculatePoints(15000, 10, [{ points: 100 }, { points: 50 }]), 1650);
  assert.equal(calculatePoints(1999, 10), 199); // arredonda para baixo
  assert.equal(calculatePoints(0, 10, [{ points: 50 }]), 50);
});

test('início do mês em Brasília', () => {
  // 01/03 01:00 UTC ainda é 28/02 22:00 em Brasília → mês de fevereiro
  assert.equal(startOfMonthBR(new Date('2026-03-01T01:00:00Z')).toISOString(), '2026-02-01T03:00:00.000Z');
  assert.equal(startOfMonthBR(new Date('2026-03-15T12:00:00Z')).toISOString(), '2026-03-01T03:00:00.000Z');
});
