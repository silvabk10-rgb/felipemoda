import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentFailure,privateStatus,submitPayment } from '../commerce/payment.mjs';
import { InvalidProviderOrder } from '../commerce/provider.mjs';

const person={name:'Comprador em teste',address:{},phones:{mobile_phone:{country_code:'55',area_code:'11',number:'999999999'}}};
const checkoutToken='only-used-by-this-fixture';
const cardToken='token_Fixture_NotARealCard';

function fixture() {
  let now=100_000;
  const order={
    id:'fm_regression_checkout_21790',
    paymentMethod:'card',state:'sending',dispatchVersion:2,submittedAt:now,
    quote:{lines:[{variantId:'leticia',name:'Vestido Letícia',quantity:1,unitCents:16990}],
      subtotalCents:16990,discountCents:0,shippingCents:4800,totalCents:21790,shippingMethod:'sedex',shippingLabel:'SEDEX'}
  };
  const data={orders:{[order.id]:structuredClone(order)}};
  const ledger={
    read:async()=>structuredClone(data),
    change:async update=>structuredClone(update(data))
  };
  const config={mode:'sandbox',now:()=>now};
  const submit=async provider=>submitPayment((await ledger.read()).orders[order.id],person,ledger,config,provider,cardToken);
  return {advance:ms=>{now+=ms},order,submit,stored:()=>data.orders[order.id]};
}

function upstreamFailure(status) {
  return Object.assign(new Error('corpo sensível da adquirente'),{upstreamStatus:status});
}

test('falhas na preparação da compra liberam a tentativa e identificam a etapa sem revelar dados do provedor',async t=>{
  const warnings=[];
  t.mock.method(console,'warn',(...message)=>warnings.push(message.join(' ')));
  for (const [path,status,failure] of [
    ['customers',422,'customer_preparation'],
    ['customers/cus_Test/cards',422,'card_preparation'],
    ['customers/cus_Test/cards',412,'card_verification']
  ]) {
    const {submit,stored}=fixture();
    const requested=[];
    const order=await submit(async (_cfg,route)=>{
      requested.push(route);
      if (route===path) throw upstreamFailure(status);
      assert.equal(route,'customers');
      return {id:'cus_Test'};
    });
    assert.equal(requested.includes('orders'),false);
    assert.equal(order.state,'canceled');
    assert.equal(order.paymentFailure,failure);
    assert.equal(stored().gatewaySentAt,undefined);
    const reply=privateStatus(order,checkoutToken);
    assert.equal(reply.paymentFailure,failure);
    assert.equal(reply.totalCents,21790);
    assert.ok(!JSON.stringify(reply).includes('cus_Test'));
    const log=warnings.at(-1);
    assert.ok(log.includes(failure) && log.includes(String(status)));
    assert.ok(!log.includes('corpo sensível') && !log.includes('cus_Test') && !log.includes(cardToken));
  }
});

test('resposta técnica após o POST mantém pedido em conferência, e validação confirmada é terminal',async t=>{
  t.mock.method(console,'warn',()=>{});
  const provider=error=>async (_cfg,path)=>{
    if (path==='customers') return {id:'cus_Test'};
    if (path.endsWith('/cards')) return {id:'card_Test',status:'active'};
    assert.equal(path,'orders');
    throw error;
  };
  const rejected=fixture();
  assert.equal(paymentFailure(await rejected.submit(provider(new InvalidProviderOrder()))),'order_validation');
  assert.equal(rejected.stored().gatewaySendCount,1);
  assert.equal(rejected.stored().providerPayloadVersion,2);
  const uncertain=fixture();
  await assert.rejects(uncertain.submit(provider(upstreamFailure(502))));
  assert.equal(uncertain.stored().state,'sending');
  assert.equal(paymentFailure(uncertain.stored()),null);
  assert.equal(uncertain.stored().gatewaySendCount,1);
});

test('reenvio iniciado na versão anterior conserva o corpo enviado com a mesma chave',async t=>{
  t.mock.method(console,'warn',()=>{});
  const {submit,stored,advance}=fixture();
  Object.assign(stored(),{dispatchedAt:100_000,gatewaySentAt:100_000,gatewaySendCount:1,providerCustomerId:'cus_Saved',providerCardId:'card_Saved'});
  advance(46_000);
  let sent;
  await assert.rejects(submit(async (_cfg,path,options)=>{
    if (path.startsWith('orders?')) return {data:[]};
    assert.equal(path,'orders');
    sent=options;
    throw upstreamFailure(502);
  }));
  assert.equal(sent.id,stored().id);
  assert.equal(Object.hasOwn(sent.body.shipping,'recipient_phone'),false);
  assert.equal(stored().providerPayloadVersion,undefined);
  assert.equal(stored().gatewaySendCount,2);
});

test('um erro de preparação de um envio antigo não cancela a tentativa que assumiu o pedido',async t=>{
  t.mock.method(console,'warn',()=>{});
  const {submit,stored,advance}=fixture();
  const blocked=Promise.withResolvers();
  const firstRequested=Promise.withResolvers();
  const latestRequested=Promise.withResolvers();
  const latestResponse=Promise.withResolvers();
  const old=submit(async ()=>{
    firstRequested.resolve();
    return await blocked.promise;
  });
  await firstRequested.promise;
  advance(46_000);
  const latest=submit(async (_cfg,path,{body})=>{
    if (path==='customers') return {id:'cus_Current'};
    if (path.endsWith('/cards')) return {id:'card_Current',status:'active'};
    assert.equal(path,'orders');
    latestRequested.resolve();
    await latestResponse.promise;
    return {id:'or_Current',code:body.code,currency:'BRL',amount:21790,closed:true,status:'pending',
      charges:[{id:'ch_Current',status:'pending',currency:'BRL',amount:21790,payment_method:'credit_card'}]};
  });
  await latestRequested.promise;
  blocked.reject(upstreamFailure(422));
  assert.equal((await old).state,'sending');
  latestResponse.resolve();
  assert.equal((await latest).state,'pending');
  assert.equal(stored().gatewaySendCount,1);
});

test('identifica o ponto seguro de parada usando a estrutura persistida por versões anteriores',()=>{
  const order={...fixture().order,state:'canceled'};
  assert.equal(paymentFailure(order),'not_dispatched');
  assert.equal(paymentFailure({...order,providerCustomerId:'cus_Example'}),'card_preparation');
  assert.equal(paymentFailure({...order,providerCustomerId:'cus_Example',providerCardId:'card_Example'}),'interrupted_before_dispatch');
  assert.equal(paymentFailure({...order,gatewaySentAt:123456,gatewaySendCount:1}),'order_validation');
  assert.equal(paymentFailure({...order,gatewaySentAt:123456,gatewaySendCount:2}),null);
  assert.equal(paymentFailure({...order,providerId:'or_Test'}),null);
  assert.equal(paymentFailure({...order,dispatchVersion:undefined}),null);
});
