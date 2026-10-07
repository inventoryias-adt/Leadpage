import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cepDigits, composeAddress, maskCep, parseViaCep } from './address';

test('máscara e dígitos do CEP', () => {
  assert.equal(maskCep('04204000'), '04204-000');
  assert.equal(maskCep('04204'), '04204');
  assert.equal(maskCep('04.204-0001234'), '04204-000');
  assert.equal(cepDigits('04204-000'), '04204000');
});

test('monta o endereço a partir das partes', () => {
  assert.equal(
    composeAddress({ street: 'Rua Costa Aguiar', number: '100', complement: 'Apto 2', district: 'Ipiranga', city: 'São Paulo', state: 'SP' }),
    'Rua Costa Aguiar, 100 - Apto 2, Ipiranga, São Paulo - SP',
  );
  assert.equal(composeAddress({ street: 'Av. Brasil', number: 'S/N', city: 'Santos', state: 'SP' }), 'Av. Brasil, S/N, Santos - SP');
});

test('lê a resposta do ViaCEP', () => {
  assert.deepEqual(parseViaCep({ logradouro: 'Rua X', bairro: 'Centro', localidade: 'Recife', uf: 'PE' }), { street: 'Rua X', district: 'Centro', city: 'Recife', state: 'PE' });
  assert.equal(parseViaCep({ erro: true }), null);
  assert.equal(parseViaCep({ erro: 'true' }), null);
});
