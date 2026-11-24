import assert from 'node:assert/strict';
import test from 'node:test';
import {config,runScheduled} from '../netlify/functions/reconcile-orders.mjs';
import {scheduleConfiguration} from '../commerce/runtime.mjs';

const context={deploy:{context:'production',published:true,id:'deploy-fixture'}};
const rootId=n=>'fm_'+String(n).padStart(26,'0');
function localOrder(n,state='pending') {
  return {id:rootId(n),providerId:'or_'+n,state,paymentMethod:'card',quote:{totalCents:1000,lines:[]},submittedAt:100,providerCheckedAt:100};
}
function rig(orders) {
  const state={version:1,orders:Object.fromEntries(orders.map(x=>[x.id,x]))};
  const db={read:async()=>structuredClone(state),change:async fn=>fn(state)};
  let now=1800000000000;
  const cfg={mode:'live',key:'fixture-auth-reference',secret:'irrelevant-test-HMAC',now:()=>now};
  const calls=[];
  const deps={configuration:()=>cfg,openLedger:async mode=>{assert.equal(mode,'live');return db;},provider:async(_cfg,path,options)=>{
    calls.push(path);
    assert.deepEqual(Object.keys(options),['signal']);
    if(path.startsWith('orders?size=1&code=fm-auth-')) return {data:[]};
    const num=Number(path.split('_').pop());
    return {id:'or_'+num,code:rootId(num),closed:true,currency:'BRL',amount:1000,status:'paid',
      charges:[{id:'ch_'+num,currency:'BRL',amount:1000,paid_amount:1000,status:'paid',payment_method:'credit_card'}]};
  }};
  return {deps,state,calls,cfg,advance:ms=>{now+=ms;}};
}

test('somente o deploy principal faz consultas sem criação/alteração de pedidos na adquirente',async()=>{
  assert.equal(config.schedule,'*/5 * * * *');
  const env={FM_COMMERCE_MODE:'live',FM_COMMERCE_SECRET:'x'.repeat(32),PAGARME_SECRET_KEY:['sk','fixture'].join('_')};
  assert.equal(scheduleConfiguration(context,env).mode,'live');
  assert.equal(scheduleConfiguration({...context,deploy:{...context.deploy,context:'branch-deploy'}},env),null);
  assert.equal(scheduleConfiguration({...context,deploy:{...context.deploy,published:false}},env),null);
  assert.equal(scheduleConfiguration(context,{...env,FM_COMMERCE_MODE:'sandbox'}),null);
  const result=await runScheduled({}, {configuration:()=>null,openLedger:()=>{throw Error('inativo');}});
  assert.deepEqual(result,{run:'inactive'});
});
test('sondagem sem cobrança e lote justo conciliam somente identificadores de pedidos locais',async()=>{
  const pending=[1,2,3,4,5,6].map(n=>localOrder(n));
  const other={...localOrder(99),id:'pedido-de-outra-loja'};
  const f=rig([...pending,localOrder(7,'paid'),localOrder(8,'draft'),other]);
  const first=await runScheduled(context,f.deps);
  assert.equal(first.authentication,'authenticated');assert.equal(first.checked,5);assert.equal(first.changed,4);
  assert.equal(f.calls.length,6);
  assert.match(f.calls[0],/^orders\?size=1&code=fm-auth-/);
  assert.ok(f.calls.includes('orders/or_7'));
  assert.ok(!f.calls.includes('orders/or_8') && !f.calls.includes('orders/or_99'));
  f.advance(300000);
  const second=await runScheduled(context,f.deps);
  assert.equal(second.checked,2);assert.equal(second.probe,false);assert.equal(second.changed,2);
  assert.equal(f.calls.filter(p=>p.includes('size=1')).length,1);
  assert.ok(!JSON.stringify(f.state.scheduler).includes(f.cfg.key));
});
test('duas execuções sobrepostas dividem a trava, e uma falha ambígua mantém a reserva',async()=>{
  const f=rig([localOrder(4)]);
  let release,started;
  const gate=new Promise(r=>{release=r;});
  const running=new Promise(r=>{started=r;});
  const base=f.deps.provider;
  f.deps.provider=async(cfg,path,options)=>{
    if(path.startsWith('orders?size=1')) {started();await gate;return base(cfg,path,options);}
    throw Error('timeout controlado');
  };
  const first=runScheduled(context,f.deps);
  await running;
  assert.deepEqual(await runScheduled(context,f.deps),{run:'already_running'});
  release();
  const result=await first;
  assert.equal(result.errors,1);
  assert.equal(f.state.orders[rootId(4)].state,'pending');
  assert.equal(f.state.scheduler.lease,undefined);
});
test('a sondagem negativa informa apenas estado e reduz frequência de novas verificações',async()=>{
  const f=rig([localOrder(4)]);
  let probes=0;
  f.deps.provider=async()=>{probes++;throw Object.assign(Error('fixture'),{upstreamStatus:401});};
  assert.equal((await runScheduled(context,f.deps)).authentication,'unauthorized');
  f.advance(5*60000);
  assert.equal((await runScheduled(context,f.deps)).probe,false);
  assert.equal(probes,1);
  f.cfg.key='fixture-after-rotation';
  f.deps.provider=async()=>({data:[{code:'outro-pedido',customer:{name:'Fixture não persistida'}}]});
  assert.equal((await runScheduled(context,f.deps)).authentication,'inconclusive');
  assert.equal(JSON.stringify(f.state).includes('Fixture não persistida'),false);
  assert.equal(f.state.orders[rootId(4)].state,'pending');
});
test('envio sem resposta é consultado pelo código filtrado sem novo POST',async()=>{
  const order={...localOrder(3,'sending'),gatewaySentAt:200,dispatchVersion:2};
  delete order.providerId;
  const f=rig([order]),base=f.deps.provider;
  f.deps.provider=async(cfg,path,opts)=>{
    if(path.startsWith('orders?size=2')) {
      f.calls.push(path);
      assert.equal(path,'orders?size=2&code='+order.id);
      return {data:[{id:'or_3',code:order.id}]};
    }
    return base(cfg,path,opts);
  };
  const result=await runScheduled(context,f.deps);
  assert.equal(result.changed,1);
  assert.equal(f.state.orders[order.id].state,'paid');
  assert.equal(f.calls.length,3);
});
