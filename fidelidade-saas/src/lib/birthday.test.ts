import assert from 'node:assert/strict';
import { test } from 'node:test';
import { birthdayText, birthdaysFor, isLeapYear, validBirthday } from './birthday';

test('aniversário: valida dia e mês', () => {
  assert.equal(validBirthday(12, 3), true);
  assert.equal(validBirthday(31, 12), true);
  assert.equal(validBirthday(29, 2), true); // nasceu em 29/02
  assert.equal(validBirthday(30, 2), false);
  assert.equal(validBirthday(31, 4), false);
  assert.equal(validBirthday(0, 5), false);
  assert.equal(validBirthday(5, 13), false);
  assert.equal(validBirthday(1.5, 5), false);
  assert.equal(validBirthday(Number.NaN, 5), false);
});

test('aniversário: texto em português', () => {
  assert.equal(birthdayText(12, 3), '12 de março');
  assert.equal(birthdayText(1, 1), '1 de janeiro');
});

test('aniversário: quem faz 29/02 recebe em 28/02 nos anos não bissextos', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(2100), false);
  assert.deepEqual(birthdaysFor(28, 2, 2026), [{ day: 28, month: 2 }, { day: 29, month: 2 }]);
  assert.deepEqual(birthdaysFor(28, 2, 2028), [{ day: 28, month: 2 }]);
  assert.deepEqual(birthdaysFor(10, 5, 2026), [{ day: 10, month: 5 }]);
});
