import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutPage } from '../commerce/view.mjs';
import { checkoutFailure } from '../store/order-status.mjs';

const order = {
  id:'fm_referencia_privada',
  state:'canceled',
  paymentMethod:'card',
  dispatchVersion:2,
  quote:{lines:[],subtotalCents:16990,discountCents:0,shippingCents:4800,totalCents:21790}
};

test('falhas anteriores à cobrança recebem instruções próprias no checkout e no comprovante', () => {
  const failures = [
    ['customer_preparation', /contato e endereço/],
    ['card_preparation', /preparação do cartão/],
    ['card_verification', /verificar o cartão/],
    ['order_validation', /não aceitou este pedido/],
    ['interrupted_before_dispatch', /interrompido antes da cobrança/],
    ['not_dispatched', /não chegou a ser enviada/],
  ];
  for (const [reason, expected] of failures) {
    assert.match(checkoutFailure('canceled',reason),expected);
    const page=checkoutPage({...order,paymentFailure:reason});
    assert.match(page, /<h1>Pagamento não iniciado<\/h1>/);
    assert.match(page, expected);
    assert.match(page, /href="\/sacola\/"/);
  }
  assert.match(checkoutPage(order), /não chegou a ser enviada/);
});

test('a consulta de uma cobrança incerta não indica que é seguro pagar de novo', () => {
  for (const state of ['sending','pending','paid','declined']) {
    assert.equal(checkoutFailure(state,'card_preparation'),null);
    const page=checkoutPage({...order,state,paymentFailure:'card_preparation'});
    assert.doesNotMatch(page, /Pagamento não iniciado|href="\/sacola\/"/);
  }
  assert.equal(checkoutFailure('canceled','__proto__'),null);
  assert.match(checkoutPage({...order,providerId:'or_remoto'}), /Pagamento cancelado/);
});
