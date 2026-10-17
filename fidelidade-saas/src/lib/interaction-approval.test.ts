import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agoText, isApproval, releaseText } from './interaction-approval';

test('só os três modos de aprovação valem', () => {
  assert.equal(isApproval('AUTO'), true);
  assert.equal(isApproval('MANUAL'), true);
  assert.equal(isApproval('COUNTER'), true);
  assert.equal(isApproval('qualquer'), false);
});

test('textos de tempo', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  assert.equal(agoText(new Date('2026-10-17T11:55:00Z'), now), 'há 5 min');
  assert.equal(agoText(new Date('2026-10-17T09:00:00Z'), now), 'há 3 h');
  assert.equal(agoText(new Date('2026-10-15T12:00:00Z'), now), 'há 2 dias');
  assert.equal(releaseText(new Date('2026-10-17T17:00:00Z'), now), 'libera em 5 h');
  assert.equal(releaseText(new Date('2026-10-17T12:40:00Z'), now), 'libera em 40 min');
});
