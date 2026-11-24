import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {api} from '../netlify/functions/commerce.mjs';
import {payment} from '../netlify/functions/pagamento.mjs';
import {webhook} from '../netlify/functions/payment-events.mjs';
import {calculate,checkoutIdentity,freshLedger,normalizeRequest,begin,reserve,readToken} from '../commerce/domain.mjs';
import {applyProvider,providerItems} from '../commerce/provider.mjs';
import {inventory,shippingRates} from '../commerce/config.mjs';
import {ledgerFromStore} from '../commerce/runtime.mjs';

const url='https://example.test';
const input={items:[{variantId:'dress-p',quantity:2}],cep:'22222-222',coupon:'BEMVINDA10'};
const initial={stock:new Map([['dress-p',{name:'Vestido · P',stock:2,priceCents:12999}]]),
  rates:shippingRates,
  campaign:{enabled:true,code:'BEMVINDA10',percent:10,firstPurchaseOnly:true},
  secret:'a-long-test-only-unit-test-key-123456',mode:'sandbox',now:()=>1_800_000_000_000};
function post(data) {
  return new Request(url+'/.netlify/functions/commerce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
}
function fixture() {
  const ledger=freshLedger();
  const db={read:async()=>structuredClone(ledger),change:async fn=>fn(ledger)};
  let remote=null;
  const sends=[];
  const deps={configuration:()=>initial,openLedger:async()=>db,pagarme:async (_cfg,path,request)=>{
    if (request) {
      sends.push(request);
      const {code,payments:[{amount}]}=request.body;
      remote??={id:'or_Test',code,amount,currency:'BRL',closed:true,status:'pending',
        charges:[{currency:'BRL',status:'pending',amount,payment_method:'pix',last_transaction:{qr_code:'PIX-TESTE'}}]};
    }
    return path.startsWith('orders?')?{data:remote?[remote]:[]}:structuredClone(remote);
  }};
  return {ledger,deps,sends,remote:()=>remote};
}
const person={name:'Cliente de Teste',email:'cliente@example.test',cpf:'52998224725',phone:'21999999999',street:'Rua do Teste',number:'1',district:'Centro',city:'Rio de Janeiro',uf:'RJ'};
function formRequest(path) {
  return new Request(url+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(person).toString()});
}

test('catálogo em rascunho não habilita variante ou preço de referência',()=>{
  const product={name:'Peça',status:'draft',priceCents:null,source:{retailPriceCents:19900},variants:[{id:'draft',stock:3}]};
  assert.equal(inventory([product]).size,0);
  assert.equal(inventory([{...product,status:'active'}]).size,0);
  assert.equal(inventory([{...product,status:'active',variants:[{id:'p',stock:5,priceCents:12400}]}]).get('p').priceCents,12400);
});
test('cupom, frete e centavos vêm do servidor',()=>{
  const cfg={...initial}, ledger=freshLedger(), buyer={emailKey:'x'};
  const data=normalizeRequest({...input,price:1,totalCents:1,shippingCents:0});
  const q=calculate(data,ledger,cfg,buyer);
  assert.deepEqual([q.subtotalCents,q.discountCents,q.shippingCents,q.totalCents,q.deliveryDays],[25998,2600,2300,25698,null]);
  assert.equal(providerItems(q).reduce((sum,line)=>sum+line.amount*line.quantity,0),23398);
  assert.throws(()=>calculate({...data,cep:'00000000'},ledger,cfg,buyer),/CEP/);
  assert.throws(()=>calculate({...data,coupon:'FALSO'},ledger,cfg,buyer),/inválido/);
  assert.throws(()=>calculate(data,ledger,{...cfg,campaign:{...cfg.campaign,endsAt:'2020-01-01'}},buyer),/validade/);
  assert.throws(()=>calculate(data,ledger,{...cfg,campaign:{...cfg.campaign,enabled:false}},buyer),/inválido/);
  assert.throws(()=>calculate(data,ledger,cfg),/e-mail/);
});
test('último saldo, validade da cotação, concorrência e primeira compra por documento',()=>{
  const ledger=freshLedger(), data=normalizeRequest({...input,items:[{variantId:'dress-p',quantity:1}]}), buyer={emailKey:'cliente',documentKey:'cpf'};
  begin(ledger,data,'cliente','A',initial);
  begin(ledger,data,'cliente2','B',initial);
  reserve(ledger,'A',buyer,'pessoa',initial);
  assert.throws(()=>reserve(ledger,'B',{emailKey:'cliente2',documentKey:'cpf'},'outra',initial),/cupom/);
  ledger.orders.A.state='paid';
  assert.throws(()=>calculate(data,ledger,initial,buyer),/cupom/);
  assert.throws(()=>calculate(normalizeRequest({...input,coupon:''}),ledger,initial),/quantidade/);
  ledger.orders.A.state='declined';
  assert.doesNotThrow(()=>calculate(normalizeRequest({...input,coupon:''}),ledger,initial));
  assert.throws(()=>reserve(ledger,'B',{emailKey:'cliente2'},'pessoa',{...initial,now:()=>initial.now()+2000000}),/prazo/);
  assert.throws(()=>reserve(ledger,'B',{emailKey:'cliente2'},'pessoa',{...initial,rates:[{...initial.rates[0],priceCents:1900}]}),/mudaram/);
});
test('fluxo HTTP com provedor controlado, repetição e status confirmado',async()=>{
  const f=fixture(),data={...input,email:person.email,idempotencyKey:randomUUID()};
  const quote=await (await api(post({...data,action:'quote'}),{},f.deps)).json();
  assert.equal(quote.totalCents,25698);
  const start=()=>api(post({...data,action:'checkout'}),{},f.deps).then(r=>r.json());
  const first=await start();
  assert.equal(first.checkoutUrl,(await start()).checkoutUrl);
  assert.equal(Object.keys(f.ledger.orders).length,1);
  const changed=await api(post({...data,items:[{variantId:'dress-p',quantity:1}],action:'checkout'}),{},f.deps);
  assert.equal(changed.status,409);
  assert.match(await (await payment(new Request(url+first.checkoutUrl),{},f.deps)).text(),/Revise sua compra/);
  assert.equal((await payment(formRequest(first.checkoutUrl),{},f.deps)).status,303);
  const confirmation=await payment(new Request(url+first.checkoutUrl),{},f.deps);
  assert.match(await confirmation.text(),/Pagamento pendente/);
  await payment(formRequest(first.checkoutUrl),{},f.deps);
  assert.equal(f.sends.length,1);
  assert.equal(f.sends[0].body.shipping.address.zip_code,'22222222');
  assert.equal(f.sends[0].body.payments[0].amount,25698);
  const notification=()=>new Request(url+'/events',{method:'POST',body:JSON.stringify({type:'order.paid',data:{id:'or_Test',code:first.orderId,status:'paid'}})});
  await webhook(notification(),{},f.deps);
  assert.equal(f.ledger.orders[first.orderId].state,'pending');
  const remote=f.remote();
  remote.status='paid';
  Object.assign(remote.charges[0],{status:'paid',paid_amount:25698});
  for (let i=0;i<2;i++) assert.equal((await webhook(notification(),{},f.deps)).status,204);
  assert.match(await (await payment(new Request(url+first.checkoutUrl),{},f.deps)).text(),/Pagamento aprovado/);
  assert.equal(f.ledger.orders[first.orderId].state,'paid');
});
test('identificação privada, tentativas em valores diferentes e estados finais',()=>{
  const {id,token}=checkoutIdentity(randomUUID(),initial.secret);
  assert.equal(readToken(token,initial.secret),id);
  assert.throws(()=>readToken(token.slice(0,-1)+'!',initial.secret));
  const makeOrder=()=>({id,quote:{totalCents:1000},state:'sending'});
  const payload={id:'or_A',code:id,amount:1000,currency:'BRL',closed:true,status:'canceled',charges:[{status:'canceled',currency:'BRL',amount:1000,payment_method:'pix'}]};
  const canceled=makeOrder(); applyProvider(canceled,payload); assert.equal(canceled.state,'canceled');
  const refused=makeOrder(); applyProvider(refused,{...payload,status:'failed',charges:[{...payload.charges[0],status:'failed'}]});assert.equal(refused.state,'declined');
  assert.throws(()=>applyProvider(makeOrder(),{...payload,amount:1}),/conferência/);
  assert.throws(()=>applyProvider(makeOrder(),{...payload,code:'wrong'}),/conferência/);
  assert.throws(()=>applyProvider(makeOrder(),{...payload,charges:[]}),/cobrança/);
});
test('configuração desativada, origem externa e JSON inválido',async()=>{
  const response=await api(post({...input,action:'quote'}),{});
  assert.equal(response.status,503);
  const foreign=post({...input,action:'checkout'});
  foreign.headers.set('origin','https://outro.example');
  assert.equal((await api(foreign,{})).status,403);
  assert.equal((await api(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{x'}),{})).status,422);
});

test('escrita condicional resolve disputa simultânea pela última unidade',async()=>{
  let saved=null, version=0, clashes=0;
  const store={
    getWithMetadata:async()=>saved?{data:JSON.parse(saved),etag:String(version)}:null,
    set:async(_key,value,opts)=>{
      await new Promise(resolve=>setImmediate(resolve));
      if (opts.onlyIfNew && saved!==null || opts.onlyIfMatch && opts.onlyIfMatch!==String(version)) {clashes++; return {modified:false};}
      version++; saved=value; return {modified:true};
    }
  };
  const cfg={...initial,stock:new Map([['dress-p',{name:'Vestido · P',stock:1,priceCents:12999}]])};
  const data=normalizeRequest({...input,coupon:'',items:[{variantId:'dress-p',quantity:1}]});
  const ledger=ledgerFromStore(store);
  await Promise.all(['A','B'].map(id=>ledger.change(state=>begin(state,data,null,id,cfg))));
  const results=await Promise.allSettled(['A','B'].map(id=>ledger.change(state=>reserve(state,id,{emailKey:id,documentKey:id},id,cfg))));
  assert.ok(clashes>0);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.match(results.find(result=>result.status==='rejected').reason.message,/quantidade/);
  assert.equal(Object.values((await ledger.read()).orders).filter(o=>o.state==='sending').length,1);
});
test('resposta perdida do provedor se recupera pelo código sem criar outra cobrança',async()=>{
  const f=fixture(),data={...input,email:person.email,idempotencyKey:randomUUID(),action:'checkout'};
  const first=await (await api(post(data),{},f.deps)).json();
  const requestProvider=f.deps.pagarme;
  f.deps.pagarme=async(cfg,path,body)=>{
    const response=await requestProvider(cfg,path,body);
    if(body) throw Error('Perda controlada da resposta HTTP');
    return response;
  };
  assert.equal((await payment(formRequest(first.checkoutUrl),{},f.deps)).status,503);
  assert.equal(f.ledger.orders[first.orderId].state,'sending');
  const recovered=await payment(new Request(url+first.checkoutUrl),{},f.deps);
  assert.equal(recovered.status,200);
  assert.match(await recovered.text(),/Pagamento pendente/);
  assert.equal(f.sends.length,1);
});

test('PAC e SEDEX têm os mesmos preços em CEPs brasileiros, inclusive sem credenciais',async()=>{
  for(const cep of ['01001-000','69900000','98950-000']) {
    const result=await (await api(post({action:'shipping',cep}),{})).json();
    assert.deepEqual(result,{ok:true,shippingOptions:shippingRates});
  }
  assert.equal((await api(post({action:'shipping',cep:'00000000'}),{})).status,422);
  for(const [method,price,label] of [['pac',2300,'PAC'],['sedex',4800,'SEDEX']]){
    const quote=calculate(normalizeRequest({...input,coupon:'',shippingMethod:method,shippingCents:1}),freshLedger(),initial);
    assert.equal(quote.shippingCents,price);assert.equal(quote.shippingLabel,label);assert.equal(quote.deliveryDays,null);
  }
  assert.throws(()=>normalizeRequest({...input,shippingMethod:'gratis'}),/PAC ou SEDEX/);
});
test('busca postal retorna endereço editável e preserva entrada manual em erro',async()=>{
  const {postalAddress}=await import('../commerce/address.mjs');
  const result=await postalAddress('01001000',async url=>{
    assert.equal(url,'https://viacep.com.br/ws/01001000/json/');
    return Response.json({cep:'01001-000',logradouro:'Praça da Sé',bairro:'Sé',localidade:'São Paulo',uf:'SP',extra:'unused'});
  });
  assert.deepEqual(result,{found:true,address:{street:'Praça da Sé',district:'Sé',city:'São Paulo',uf:'SP'}});
  assert.deepEqual(await postalAddress('01001000',async()=>Response.json({erro:'true'})),{found:false,reason:'not_found'});
  assert.deepEqual(await postalAddress('01001000',async()=>{throw Error('offline');}),{found:false,reason:'unavailable'});
});
const directBody=(action,props={})=>({...input,coupon:'',cep:'01001000',action,shippingMethod:'sedex',
  idempotencyKey:randomUUID(),customer:{name:person.name,cpf:person.cpf,email:person.email,phone:person.phone},
  address:{street:person.street,number:person.number,district:person.district,extra:'',city:'São Paulo',uf:'SP'},...props});
const requestJson=(body,deps)=>api(post(body),{},deps).then(async res=>({status:res.status,...await res.json()}));
test('Pix em uma etapa vincula pessoa, método e total e protege a consulta do pedido',async()=>{
  const f=fixture(),body=directBody('pix',{expectedTotalCents:30798});
  const payment=await requestJson(body,f.deps);
  assert.equal(payment.status,200);assert.equal(payment.orderState,'pending');assert.equal(payment.paymentMethod,'pix');
  assert.equal(payment.pixCode,'PIX-TESTE');assert.ok(payment.orderToken);assert.equal(payment.totalCents,30798);
  assert.equal(f.sends[0].body.shipping.description,'SEDEX');assert.equal(f.sends[0].body.shipping.amount,4800);
  assert.equal((await requestJson(body,f.deps)).orderId,payment.orderId);assert.equal(f.sends.length,1);
  assert.equal((await requestJson({action:'payment-status',orderToken:'outro'},f.deps)).status,404);
  assert.equal((await requestJson({action:'payment-status',orderToken:payment.orderToken},f.deps)).orderState,'pending');
  const fresh=fixture();
  assert.equal((await requestJson({...body,expectedTotalCents:1},fresh.deps)).status,409);assert.equal(fresh.sends.length,0);
});
test('pedido legado mantém cotação e histórico anteriores às modalidades',()=>{
  const cfg={...initial},data=normalizeRequest({...input,coupon:''}),ledger=freshLedger();
  const order=begin(ledger,data,null,'old',cfg);
  delete order.quote.shippingLabel;delete order.quote.shippingMethod;
  order.quote.shippingCents=1870;order.quote.totalCents=order.quote.subtotalCents+1870;order.quote.deliveryDays=5;
  const signature=order.signature;
  const saved=reserve(ledger,'old',{emailKey:'x'},'person',cfg);
  assert.equal(saved.quote.shippingCents,1870);assert.equal(saved.quote.deliveryDays,5);
  assert.equal(saved.signature,signature);assert.equal(begin(ledger,data,null,'old',cfg).id,'old');
});
function cardFixture() {
  const f=fixture();let remote=null;const calls=[];
  f.deps.configuration=()=>({...initial,cardEnabled:true,cardPublicKey:'pk_test_apenasTeste',pixEnabled:false});
  f.deps.pagarme=async(_cfg,path,opts)=>{
    calls.push({path,opts});
    if(path==='customers') return {id:'cus_Example'};
    if(path==='customers/cus_Example/cards') return {id:'card_Example',status:'active'};
    if(path==='orders'&&opts) {
      const {code,payments:[{amount}]}=opts.body;
      remote={id:'or_Card',code,amount,currency:'BRL',closed:true,status:'pending',
        charges:[{id:'ch_Card',status:'pending',amount,currency:'BRL',payment_method:'credit_card'}]};
    }
    if(path.startsWith('orders?')) return {data:remote?[remote]:[]};
    return structuredClone(remote);
  };
  return {...f,calls,remote:()=>remote};
}
test('checkout PSP somente cartão usa token, customer e card_id sem Pix nem dados brutos',async()=>{
  const f=cardFixture(),body=directBody('card',{cardToken:'token_TestHolder',expectedTotalCents:30798});
  const methods=await requestJson({action:'methods'},f.deps);
  assert.deepEqual(methods.paymentMethods,['card']);assert.equal(methods.cardPublicKey,'pk_test_apenasTeste');
  assert.equal((await requestJson(directBody('pix'),f.deps)).status,409);
  assert.equal((await requestJson({...body,card:{cvv:'000'}},f.deps)).status,422);
  assert.equal((await requestJson({...body,cardToken:'card_Other'},f.deps)).status,422);
  const paid=await requestJson(body,f.deps);
  assert.equal(paid.status,200);assert.equal(paid.orderState,'pending');assert.equal(paid.paymentMethod,'card');assert.equal(paid.pixCode,null);
  assert.deepEqual(f.calls.map(c=>c.path),['customers','customers/cus_Example/cards','orders']);
  const [client,card,order]=f.calls;
  assert.equal(client.opts.body.document,person.cpf);
  assert.deepEqual(Object.keys(card.opts.body).sort(),['billing_address','token']);
  assert.equal(order.opts.body.customer_id,'cus_Example');
  assert.equal(order.opts.body.payments[0].credit_card.card_id,'card_Example');
  assert.equal(order.opts.body.payments[0].credit_card.installments,1);
  assert.equal(JSON.stringify(f.ledger).includes('token_TestHolder'),false);
  assert.equal(JSON.stringify(paid).includes('card_Example'),false);
  await requestJson(body,f.deps);assert.equal(f.calls.filter(c=>c.path==='orders').length,1);
  const remote=f.remote();
  const notify=()=>new Request(url+'/events',{method:'POST',body:JSON.stringify({type:'charge.paid',data:{id:'ch_Card',status:'paid'}})});
  assert.equal((await webhook(notify(),{},f.deps)).status,204);
  assert.equal(f.ledger.orders[paid.orderId].state,'pending');
  remote.status='paid';Object.assign(remote.charges[0],{status:'paid',paid_amount:0});
  await webhook(notify(),{},f.deps);assert.equal(f.ledger.orders[paid.orderId].state,'pending');
  remote.charges[0].paid_amount=30798;
  await webhook(notify(),{},f.deps);await webhook(notify(),{},f.deps);
  assert.equal((await requestJson({action:'payment-status',orderToken:paid.orderToken},f.deps)).orderState,'paid');
  remote.charges[0].refunded_amount=100;
  await webhook(notify(),{},f.deps);assert.equal(f.ledger.orders[paid.orderId].state,'partially_refunded');
  remote.charges[0].refunded_amount=30798;
  await webhook(notify(),{},f.deps);assert.equal(f.ledger.orders[paid.orderId].state,'refunded');
});
test('erro no registro do cartão encerra tentativa sem cobrança ou retenção da última peça',async()=>{
  const f=cardFixture(),body=directBody('card',{cardToken:'token_refused'});
  const base=f.deps.pagarme;
  f.deps.pagarme=(cfg,path,opts)=>path.endsWith('/cards')?Promise.reject(Error('Token rejeitado em teste')):base(cfg,path,opts);
  const result=await requestJson(body,f.deps);
  assert.equal(result.orderState,'canceled');assert.ok(result.orderToken);
  assert.equal(f.calls.filter(c=>c.path==='orders').length,0);
  assert.equal(calculate(normalizeRequest({...input,coupon:''}),f.ledger,initial).lines[0].quantity,2);
});
test('produção somente cartão requer deploy principal e nunca devolve credencial privada',async()=>{
  const {configuration}=await import('../commerce/runtime.mjs');
  const env={FM_COMMERCE_MODE:'live',FM_COMMERCE_SECRET:'x'.repeat(36),FM_PIX_ENABLED:'false',FM_CARD_ENABLED:'true',
    PAGARME_SECRET_KEY:['sk','fixture'].join('_'),PAGARME_PUBLIC_KEY:['pk','fixture'].join('_')};
  const merchant='https://felipemodasbr.com';
  const request=new Request(merchant+'/.netlify/functions/commerce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'methods'})});
  const context={deploy:{published:true}};
  const deps={configuration:(req,ctx)=>configuration(req,ctx,env)};
  const result=await (await api(request,context,deps)).json();
  assert.deepEqual(result,{ok:true,paymentMethods:['card'],cardEnabled:true,cardPublicKey:env.PAGARME_PUBLIC_KEY,environment:'live'});
  assert.equal(JSON.stringify(result).includes(env.PAGARME_SECRET_KEY),false);
  assert.throws(()=>configuration(new Request(merchant),{deploy:{published:false}},env),/indisponível/);
  assert.throws(()=>configuration(new Request('https://test.example'),context,env),/indisponível/);
  assert.equal(configuration(new Request(merchant),context,{...env,PAGARME_PUBLIC_KEY:'pk_test_fixture'}).cardEnabled,false);
});
test('interrupção antes da cobrança libera a reserva sem cancelar pedido enviado ou legado',async()=>{
  const {abandonedBeforeDispatch}=await import('../commerce/domain.mjs');
  const {reconcile}=await import('../commerce/payment.mjs');
  const f=fixture(),expired={id:'lost',dispatchVersion:2,state:'sending',submittedAt:initial.now()-65000};
  f.ledger.orders.lost=expired;
  assert.equal(abandonedBeforeDispatch(expired,initial.now()),true);
  assert.equal(abandonedBeforeDispatch({...expired,dispatchVersion:undefined},initial.now()),false);
  assert.equal(abandonedBeforeDispatch({...expired,gatewaySentAt:initial.now()-62000},initial.now()),false);
  const order=await reconcile(expired,await f.deps.openLedger(),initial,()=>{throw Error('Nenhum pedido enviado');});
  assert.equal(order.state,'canceled');
});
test('422 validado do primeiro envio libera estoque; falha técnica conserva reserva',async t=>{
  const {pagarme}=await import('../commerce/provider.mjs');
  let status=422;
  t.mock.method(globalThis,'fetch',async()=>Response.json({message:'The request is invalid.',errors:{'order.customer.name':['invalid']}},{status}));
  for(const [http,expected] of [[422,'canceled'],[500,'sending'],[409,'sending']]) {
    status=http;
    const f=fixture();
    f.deps.pagarme=pagarme;
    const result=await requestJson(directBody('pix'),f.deps);
    assert.equal(result.orderState,expected);assert.ok(result.orderToken);
    if(http===422) assert.equal(calculate(normalizeRequest({...input,coupon:''}),f.ledger,initial).lines[0].quantity,2);
    else assert.throws(()=>calculate(normalizeRequest({...input,coupon:''}),f.ledger,initial),/quantidade/);
  }
});
test('notificação partial_canceled e consulta tardia verificam estorno com a API, sem depender do texto recebido',async()=>{
  const f=cardFixture(),body=directBody('card',{cardToken:'token_RefundTest'});
  const created=await requestJson(body,f.deps),remote=f.remote(),charge=remote.charges[0];
  const notice=(type,data)=>new Request(url+'/events',{method:'POST',body:JSON.stringify({type,data})});
  const partial=()=>notice('charge.partial_canceled',{id:charge.id,status:'refunded'});
  remote.status='paid';Object.assign(charge,{status:'paid',paid_amount:30798});
  await webhook(partial(),{},f.deps);
  assert.equal(f.ledger.orders[created.orderId].state,'paid');
  Object.assign(charge,{last_transaction:{status:'partial_refunded'},canceled_amount:200});
  await webhook(partial(),{},f.deps);
  assert.equal(f.ledger.orders[created.orderId].state,'partially_refunded');
  charge.last_transaction.status='refunded';charge.canceled_amount=30798;
  const cfg=f.deps.configuration();
  f.deps.configuration=()=>({...cfg,now:()=>initial.now()+61000});
  const recovered=await requestJson({action:'payment-status',idempotencyKey:body.idempotencyKey},f.deps);
  assert.equal(recovered.orderState,'refunded');assert.equal(recovered.orderToken,created.orderToken);
  assert.equal((await requestJson({action:'payment-status',idempotencyKey:randomUUID()},f.deps)).status,404);
});
