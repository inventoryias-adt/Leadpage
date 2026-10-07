import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvCell, toCsv } from './csv';

test('escapa aspas, separador e quebras de linha', () => {
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('diz "oi"'), '"diz ""oi"""');
  assert.equal(csvCell('linha1\nlinha2'), '"linha1\nlinha2"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(12), '12');
});

test('protege contra fórmulas de planilha', () => {
  assert.equal(csvCell('=SOMA(A1)'), "'=SOMA(A1)");
  assert.equal(csvCell('+55 11 99999'), "'+55 11 99999");
  assert.equal(csvCell('-1'), "'-1");
});

test('monta o arquivo com BOM e linhas CRLF', () => {
  const out = toCsv(['Nome', 'Saldo'], [['Ana', 10], ['Beto', 5]]);
  assert.ok(out.startsWith('﻿Nome;Saldo\r\n'));
  assert.ok(out.endsWith('Beto;5\r\n'));
});
