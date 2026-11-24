import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCardPayment, tokenizeCard} from '../store/checkout-card.mjs';

const publicKey = 'pk_test_checkout_fixture';
const referenceToken = 'token_simulado01';
const futureYear = new Date().getFullYear() + 3;

// This minimal DOM exercises the same mounted fields and submit action used by checkout.
function makeHost() {
  const ownerDocument = {defaultView: new EventTarget()};
  class Element extends EventTarget {
    constructor(tag) {
      super();
      this.tag = tag;
      this.children = [];
      this.value = '';
      this.ownerDocument = ownerDocument;
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    remove() { this.removed = true; }
    setCustomValidity(message) { this.message = message; }
    reportValidity() { return !this.message; }
    focus() { this.focused = true; }
  }
  ownerDocument.createElement = tag => new Element(tag);
  return new Element('div');
}

function fixture(transport) {
  const host = makeHost();
  const entry = mountCardPayment(host, {
    publicKey,
    tokenize: (key, card, options) => tokenizeCard(key, card, {...options, transport})
  });
  const fields = Object.fromEntries(host.children[0].children.map(label => {
    const input = label.children[1];
    assert.equal(input.name, undefined);
    return [input.autocomplete, input];
  }));
  fields['cc-number'].value = '4000 0000 0000 0010';
  fields['cc-name'].value = 'CLIENTE TESTE';
  fields['cc-exp'].value = '12/' + futureYear;
  fields['cc-csc'].value = '123';
  return {entry, fields, host};
}

test('tokeniza somente no processador e entrega ao checkout apenas o token', async () => {
  const requests = [];
  const {entry, fields} = fixture(async (url, options) => {
    requests.push([url, options]);
    return Response.json({id:referenceToken, type:'card', card:{last_four_digits:'0010'}});
  });
  assert.equal(requests.length, 0);
  const payment = await entry.getPayment();
  assert.deepEqual(payment, {method:'card', cardToken:referenceToken});
  assert.equal(requests.length, 1);
  const [[url, options]] = requests;
  assert.equal(url.href, 'https://api.pagar.me/core/v5/tokens?appId=pk_test_checkout_fixture');
  assert.deepEqual(options.headers, {'Content-Type':'application/json'});
  assert.equal(options.credentials, 'omit');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.deepEqual(JSON.parse(options.body), {type:'card',card:{
    number:'4000000000000010',holder_name:'CLIENTE TESTE',exp_month:12,exp_year:futureYear,cvv:'123'
  }});
  assert.ok(Object.values(fields).every(input => input.value === ''));
  entry.destroy();
});

test('validação local não envia cartão vencido e chave secreta não monta campos', async () => {
  const {entry, fields} = fixture(() => assert.fail('Não deve enviar'));
  fields['cc-exp'].value = '12/2000';
  await assert.rejects(entry.getPayment(), /validade vigente/);
  assert.equal(fields['cc-exp'].focused, true);
  assert.throws(() => mountCardPayment(makeHost(), {publicKey:'sk_test_proibida'}), /indisponível/);
  entry.destroy();
});

test('desmontar durante tokenização aborta a requisição e invalida sua resposta', async () => {
  let resolveRequest;
  let requestSignal;
  const {entry, fields} = fixture((_url, {signal}) => new Promise(resolve => {
    resolveRequest = resolve;
    requestSignal = signal;
  }));
  const pending = entry.getPayment();
  await assert.rejects(entry.getPayment(), /Aguarde/);
  entry.destroy();
  assert.equal(requestSignal.aborted, true);
  assert.ok(Object.values(fields).every(input => !input.value));
  resolveRequest(Response.json({id:referenceToken}));
  await assert.rejects(pending, /indisponível/);
});

test('falhas do processador não expõem dados recebidos e saídas da página limpam os campos', async () => {
  const {entry, fields, host} = fixture(() => Response.json({message:'4000000000000010'}, {status:422}));
  await assert.rejects(entry.getPayment(), error => {
    assert.equal(error.message, 'Confira os dados impressos no cartão e tente novamente.');
    return true;
  });
  host.ownerDocument.defaultView.dispatchEvent(new Event('pagehide'));
  assert.ok(Object.values(fields).every(input => !input.value));
  entry.destroy();
});
