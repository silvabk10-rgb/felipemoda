import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {api} from '../netlify/functions/commerce.mjs';
import {payment} from '../netlify/functions/pagamento.mjs';
import {webhook} from '../netlify/functions/payment-events.mjs';
import {calculate,checkoutIdentity,freshLedger,normalizeRequest,begin,reserve,readToken} from '../commerce/domain.mjs';
import {applyProvider,providerItems} from '../commerce/provider.mjs';
import {inventory} from '../commerce/config.mjs';
import {ledgerFromStore} from '../commerce/runtime.mjs';

const url='https://example.test';
const input={items:[{variantId:'dress-p',quantity:2}],cep:'22222-222',coupon:'BEMVINDA10'};
const initial={stock:new Map([['dress-p',{name:'Vestido · P',stock:2,priceCents:12999}]]),
  rates:[{start:'20000000',end:'29999999',priceCents:1870,deliveryDays:5}],
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
  assert.deepEqual([q.subtotalCents,q.discountCents,q.shippingCents,q.totalCents,q.deliveryDays],[25998,2600,1870,25268,5]);
  assert.equal(providerItems(q).reduce((sum,line)=>sum+line.amount*line.quantity,0),23398);
  assert.throws(()=>calculate({...data,cep:'00000000'},ledger,cfg,buyer),/entrega/);
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
  assert.equal(quote.totalCents,25268);
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
  assert.equal(f.sends[0].body.payments[0].amount,25268);
  const notification=()=>new Request(url+'/events',{method:'POST',body:JSON.stringify({type:'order.paid',data:{id:'or_Test',code:first.orderId,status:'paid'}})});
  await webhook(notification(),{},f.deps);
  assert.equal(f.ledger.orders[first.orderId].state,'pending');
  const remote=f.remote();
  remote.status='paid';
  Object.assign(remote.charges[0],{status:'paid',paid_amount:25268});
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
