import {mountCardPayment} from './checkout-card.mjs';
import {esc,money} from './core.mjs';
import {keys,load,save,cartLines,migrateBag} from './bag.mjs';
import {commerceRequest as request} from './commerce-client.mjs';
import {shippingChoices} from './checkout.mjs';

export const normalizeCep = value => String(value??'').trim().replace(/^(\d{5})-(\d{3})$/,'$1$2');
export const validCep = value => /^\d{8}$/.test(normalizeCep(value));
const addressKeys=['street','district','city','uf'];
export function addressAutofill(fields,touched,automatic,address) {
  for(const key of addressKeys) {
    const el=fields[key],value=String(address?.[key]||'').trim();
    if(!el || touched.has(key) || el.value && el.value!==automatic[key])continue;
    el.value=value;automatic[key]=value;
  }
}
export function quoteInput(rows,fields) {
  return {items:rows.map(({row})=>({variantId:row.variant,quantity:row.quantity})).sort((a,b)=>a.variantId.localeCompare(b.variantId)),
    cep:normalizeCep(fields.cep.value),shippingMethod:fields.shippingMethod?.value||'',
    coupon:fields.coupon?.value.trim()||'',email:fields.coupon?.value.trim()?fields.email.value.trim():''};
}
export function validQuote(q) {
  return q && ['subtotalCents','shippingCents','discountCents','totalCents'].every(k=>Number.isSafeInteger(q[k])&&q[k]>=0)
    && q.totalCents>0 && q.subtotalCents+q.shippingCents-q.discountCents===q.totalCents;
}
export function checkoutCardMethod(data,checkoutEnabled) {
  const key=data?.cardPublicKey;
  if(checkoutEnabled && data?.cardEnabled===true && Array.isArray(data.paymentMethods) &&
     data.paymentMethods.includes('card') && typeof key==='string' && /^pk_[a-zA-Z0-9_-]+$/.test(key)){
    const sandbox=data.environment==='sandbox';
    return {publicKey:key,note:sandbox?'Ambiente de homologação.':'',
      summary:'Cartão de crédito em 1 parcela'+(sandbox?' · Homologação':'')};
  }
  const note=data?'O pagamento com cartão está indisponível no momento.':
    'Não foi possível consultar a forma de pagamento. Atualize a página para tentar novamente.';
  return {publicKey:null,note,summary:note};
}
const orderTokenValid=t=>typeof t==='string'&&/^fm_[A-Za-z0-9_-]{26}\.[A-Za-z0-9_-]{43}$/.test(t);
const activeStates=new Set(['pending','sending']);
const states={draft:'Confira seu pedido',sending:'Verificando seu pagamento',pending:'Pagamento pendente',paid:'Pagamento aprovado',
  declined:'Pagamento recusado',canceled:'Pagamento cancelado',refunded:'Pagamento estornado',partially_refunded:'Estorno parcial',disputed:'Pagamento contestado'};
const stateText={sending:'Seu pedido foi enviado. A confirmação será consultada automaticamente.',paid:'Recebemos a confirmação do pagamento do seu pedido.',
  declined:'O pagamento foi recusado. Você pode voltar à sacola e tentar novamente.',canceled:'O pagamento deste pedido foi cancelado.',
  refunded:'O pagamento deste pedido foi estornado.',partially_refunded:'Parte do valor deste pedido foi estornada.',disputed:'A contestação deste pagamento está em análise.'};
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');
function linesMarkup(rows) {
  return rows.map(({row,p,v})=>{
    const photo=p?.images.find(i=>i.color&&i.color===v?.color)||p?.images[0];
    const title=p?.name||row.name||row.product;
    const detail=v?.label||[v?.color,v?.size].filter(Boolean).join(' · ')||row.label;
    return '<div class="co-line">'+(photo?'<img src="'+esc(photo.src)+'" alt="'+esc(photo.alt||title)+'" width="57" height="74">':'<span></span>')+
    '<div><strong>'+esc(title)+'</strong><small>'+esc(detail||'')+' · Qtd. '+row.quantity+'</small></div><strong>'+(v?.priceCents?esc(money(v.priceCents*row.quantity)):'A confirmar')+'</strong></div>';
  }).join('');
}
export function finishPaidAttempt(activeToken,products){
  const attempt=load(keys.checkout,null,true);
  if(attempt?.orderToken!==activeToken || !Array.isArray(attempt?.items))return;
  const now=cartLines(products).map(({row})=>({variantId:row.variant,quantity:row.quantity})).sort((a,b)=>a.variantId.localeCompare(b.variantId));
  if(now.length && JSON.stringify(now)===JSON.stringify(attempt.items))save(keys.bag,[]);
  // A second purchase of the same items receives a fresh identity.
  save(keys.checkout,null,true);
}

export function initCheckout(doc=document,{mountCard=mountCardPayment}={}) {
  const $=s=>doc.querySelector(s), form=$('#co-form'), fields=form.elements;
  const empty=$('[data-empty]'),purchase=$('[data-purchase]'),orderPanel=$('[data-order]'),loading=$('[data-loading]');
  const submit=$('[data-pay]'),error=$('[data-error]'),quoteNote=$('[data-quote-note]');
  let products=new Map(),rows=[],checkoutEnabled=false,card=null,cardPublicKey=null;
  let quote=null,quoteKey='',timer,version=0,busy=false,lastCep='',addressSerial=0;
  let activeToken=null,order=null,poll,statusBusy=false,disposed=false,statusSerial=0,displayedStatus='';
  const touched=new Set(),automatic={};
  function mode(state){
    loading.hidden=state!=='loading';empty.hidden=state!=='empty';purchase.hidden=state!=='purchase';orderPanel.hidden=state!=='order';
  }
  function notice(msg){error.textContent=msg||'';}
  function clearPoll(){clearTimeout(poll);poll=null;}
  function usable(){return rows.length>0&&rows.every(row=>row.ok);}
  function controls(){
    if(rows.length && cardPublicKey && !card)card=mountCard($('[data-card-entry]'),{publicKey:cardPublicKey});
    submit.disabled=busy||!usable()||!checkoutEnabled||!validQuote(quote)||!card;
    submit.textContent=busy?'Enviando pedido…':'Pagar com cartão';
  }
  function resetQuote(){
    quote=null;quoteKey='';quoteNote.textContent='';$('[data-total]').textContent='—';
    $('[data-shipping]').textContent=validCep(fields.cep.value)?'A calcular':'Informe o CEP';$('[data-discount-row]').hidden=true;
    $('[data-requote]').hidden=true;controls();
  }
  function updateBag(){
    rows=cartLines(products);$('[data-lines]').innerHTML=linesMarkup(rows);
    $('[data-subtotal]').textContent=rows.length&&rows.every(r=>r.v?.priceCents)?money(rows.reduce((n,r)=>n+r.row.quantity*r.v.priceCents,0)):'A confirmar';
    if(!activeToken){
      mode(rows.length?'purchase':'empty');form.querySelector('.co-form-root').disabled=!usable()||busy;
      if(rows.length&&!usable())notice('Há uma peça sem disponibilidade confirmada. Revise a sacola para continuar.');
    }
    controls();
  }
  function scheduleQuote(){
    clearTimeout(timer);const current=++version;resetQuote();if(!usable()||!checkoutEnabled||!validCep(fields.cep.value)||!fields.shippingMethod?.value)return;
    timer=setTimeout(()=>refreshQuote(current),250);
  }
  async function refreshQuote(current){
    if(current!==version||busy||activeToken)return;
    const payload=quoteInput(rows,fields);
    if(payload.coupon&&!fields.email.validity.valid){quoteNote.textContent='Informe seu e-mail para verificar o cupom.';return;}
    quoteNote.textContent='Conferindo seu total…';
    try {
      const result=await request({action:'quote',...payload});
      if(current!==version||activeToken)return;
      if(!validQuote(result)||result.shippingMethod!==payload.shippingMethod)throw Error('Os valores da entrega precisam ser conferidos.');
      quote=result;quoteKey=JSON.stringify(payload);
      $('[data-subtotal]').textContent=money(result.subtotalCents);$('[data-shipping]').textContent=money(result.shippingCents);
      $('[data-discount-row]').hidden=!result.discountCents;$('[data-discount]').textContent='− '+money(result.discountCents);
      $('[data-total]').textContent=money(result.totalCents);quoteNote.textContent='';$('[data-requote]').hidden=true;
    } catch(e){if(current===version){quoteNote.textContent=e.message;$('[data-requote]').hidden=false;}}
    finally{controls();}
  }
  async function updateCep(){
    const cep=normalizeCep(fields.cep.value);
    if(cep===lastCep)return;
    lastCep=cep;const current=++addressSerial;
    addressAutofill(fields,touched,automatic,{});
    const note=$('[data-address-note]'),shippingNote=$('[data-shipping-note]');
    note.textContent='';shippingNote.textContent='';
    scheduleQuote();if(!validCep(cep))return;
    note.textContent='Consultando endereço…';
    const valid=()=>current===addressSerial&&normalizeCep(fields.cep.value)===cep;
    const [a,b]=await Promise.allSettled([request({action:'address',cep}),request({action:'shipping',cep})]);
    if(!valid()||activeToken)return;
    if(a.status==='fulfilled'&&a.value.found){
      addressAutofill(fields,touched,automatic,a.value.address);
      note.textContent='Confira o endereço e complete os campos.';
    }else note.textContent='Preencha seu endereço manualmente.';
    if(b.status==='fulfilled'&&Array.isArray(b.value.shippingOptions)){
      const options=b.value.shippingOptions.filter(o=>['pac','sedex'].includes(o.id)&&Number.isSafeInteger(o.priceCents));
      const previous=fields.shippingMethod?.value;
      const selected=options.some(o=>o.id===previous)?previous:options[0]?.id;
      $('[data-options]').innerHTML='<legend class="co-sr">Escolha a modalidade de envio</legend>'+shippingChoices(options,selected);
      if(!selected)shippingNote.textContent='Nenhuma modalidade disponível para este CEP.';
      if(previous!==selected)scheduleQuote();
    }else shippingNote.textContent='A disponibilidade será conferida ao calcular o total.';
  }
  async function configureCard(){
    const data=await request({action:'methods'}).catch(()=>null);
    const method=checkoutCardMethod(data,checkoutEnabled);
    cardPublicKey=method.publicKey;
    $('[data-method-note]').textContent=method.note;
    $('[data-preview-payment]').textContent=method.summary;
    controls();
  }
  function statusUrl(t){
    const url=new URL(location.href);url.search='';url.hash='pedido='+t;history.replaceState(null,'',url.href);
  }
  function persistToken(t){
    activeToken=t;statusUrl(t);mode('order');clearTimeout(timer);++version;
    const attempt=load(keys.checkout,null,true);
    if(attempt?.key)save(keys.checkout,{...attempt,orderToken:t},true);
  }
  async function recoverUncertain(){
    const attempt=load(keys.checkout,null,true),button=$('[data-recover]');
    if(!attempt?.sent||attempt.orderToken||activeToken)return false;
    button.hidden=false;button.disabled=true;
    try{
      const saved=await request({action:'payment-status',idempotencyKey:attempt.key});
      if(!orderTokenValid(saved.orderToken))throw Error('A tentativa anterior ainda não pôde ser identificada.');
      persistToken(saved.orderToken);displayOrder(saved);return true;
    }catch(e){
      notice(e.status===404?'Ainda não encontramos o pedido. Confira seus dados antes de tentar o pagamento novamente.':'Não foi possível confirmar a tentativa anterior. Consulte novamente antes de pagar.');
      return false;
    }finally{button.disabled=false;}
  }
  async function submitOrder(event){
    event.preventDefault();
    if(busy || activeToken || !form.reportValidity())return;
    rows=cartLines(products);
    if(!usable()||!checkoutEnabled){updateBag();notice('Confira a disponibilidade da sua sacola antes de pagar.');return;}
    const payload=quoteInput(rows,fields);
    if(!quote||quoteKey!==JSON.stringify(payload)){scheduleQuote();notice('Confira o total atualizado antes de pagar.');return;}
    if(!card){notice('O pagamento com cartão está indisponível no momento.');return;}
    const confirmed=quote.totalCents;
    const customer=Object.fromEntries(['name','email','cpf','phone'].map(k=>[k,fields[k].value.trim()]));
    const address=Object.fromEntries([...addressKeys,'number','extra'].map(k=>[k,fields[k].value.trim()]));
    busy=true;notice('');controls();
    try{
      // An interrupted submit reuses its key. Only the digest and opaque identifiers are retained.
      const marker=await digest(JSON.stringify([payload,'card',confirmed]));
      let attempt=load(keys.checkout,null,true);
      if(orderTokenValid(attempt?.orderToken) && (attempt.digest===marker || JSON.stringify(attempt.items)===JSON.stringify(payload.items))){
        persistToken(attempt.orderToken);await status();return;
      }
      if(attempt?.sent && !attempt.orderToken){
        // A lost response may hide an existing charge. Look it up before reading a card again.
        try{
          const old=await request({action:'payment-status',idempotencyKey:attempt.key});
          if(!orderTokenValid(old.orderToken))throw Error('Não foi possível identificar a tentativa anterior.');
          persistToken(old.orderToken);displayOrder(old);return;
        }catch(recoveryError){
          if(recoveryError.status!==404)throw recoveryError;
        }
      }
      if(attempt?.digest!==marker){
        // Reuse an unresolved UUID even if the first POST is still arriving.
        attempt={digest:marker,key:attempt?.sent&&!attempt.orderToken?attempt.key:crypto.randomUUID(),items:payload.items};
        save(keys.checkout,attempt,true);
      }
      const {cardToken}=await card.getPayment();
      form.querySelector('.co-form-root').disabled=true;
      const currentItems=cartLines(products).map(({row})=>({variantId:row.variant,quantity:row.quantity})).sort((a,b)=>a.variantId.localeCompare(b.variantId));
      const detailsChanged=Object.entries({...customer,...address}).some(([key,value])=>fields[key].value.trim()!==value);
      if(detailsChanged||quoteKey!==JSON.stringify(quoteInput(rows,fields))||JSON.stringify(currentItems)!==JSON.stringify(payload.items))throw Error('Os dados mudaram. Confira a sacola e o total antes de pagar.');
      save(keys.checkout,{...attempt,sent:true},true);
      const result=await request({action:'card',...payload,idempotencyKey:attempt.key,expectedTotalCents:confirmed,customer,address,cardToken});
      if(!orderTokenValid(result.orderToken))throw Error('Não foi possível identificar o pedido. Tente novamente com a mesma sacola.');
      persistToken(result.orderToken);displayOrder(result);
    }catch(e){
      if(e.order&&orderTokenValid(e.order.orderToken)&&e.order.orderState!=='draft'){
        persistToken(e.order.orderToken);displayOrder(e.order);await status();return;
      }
      if(e.status>=400 && e.status<500 && e.status!==429 && !e.order && ['changed','amount_changed','total_changed','quote_changed','stock','shipping','coupon','ineligible','address','cpf','email','phone','uf'].includes(e.code)){
        save(keys.checkout,null,true);scheduleQuote();
      }
      notice(e.message||'Não foi possível iniciar o pagamento. Sua sacola está salva.');
      if(!e.order && (e.status==null||e.status>=500||e.code==='conflict'))await recoverUncertain();
    }finally{busy=false;form.querySelector('.co-form-root').disabled=!usable();controls();}
  }
  function displayOrder(data){
    order=data;const state=data.orderState;
    if(data.paymentMethod && data.paymentMethod!=='card'){
      // Previously issued receipts remain private and are rendered separately.
      location.replace('/.netlify/functions/pagamento?t='+encodeURIComponent(activeToken));
      return;
    }
    const viewState=JSON.stringify([data.orderId,state,data.totalCents,data.shippingCents]);
    clearPoll();
    if(activeStates.has(state)&&!doc.hidden)poll=setTimeout(status,15000);
    if(viewState===displayedStatus)return;
    displayedStatus=viewState;
    const waitText=state==='pending'?'A operadora está analisando o pagamento. A confirmação será consultada automaticamente.':(stateText[state]||'Consulte a situação do pedido.');
    orderPanel.innerHTML='<p data-order-ref>Pedido '+esc(data.orderId||'')+'</p><h2>'+esc(states[state]||'Situação do pedido')+'</h2><p>'+esc(waitText)+'</p>'+
      (validQuote(data)?'<dl><div><dt>Entrega'+(data.shippingLabel?' · '+esc(data.shippingLabel):'')+'</dt><dd>'+money(data.shippingCents)+'</dd></div><div class="co-grand"><dt>Total</dt><dd>'+money(data.totalCents)+'</dd></div></dl>':'')+
      '<nav>'+
      (activeStates.has(state)||state==='draft'?'<button class="co-secondary" type="button" data-refresh>Atualizar pagamento</button>':'')+
      (['declined','canceled','refunded'].includes(state)?'<button class="co-secondary" type="button" data-retry>Voltar à sacola</button>':'')+
      '<a class="co-text-link" href="/atendimento/">Atendimento</a></nav><p data-order-notice role="status"></p>';
    if(state==='paid')finishPaidAttempt(activeToken,products);
  }
  async function status(){
    if(!activeToken||statusBusy||disposed)return;
    const current=++statusSerial;const token=activeToken;
    statusBusy=true;
    if(!order)orderPanel.innerHTML='<h2>Consultando pedido</h2><p role="status">Aguarde a atualização do pagamento.</p>';
    try{
      const data=await request({action:'payment-status',orderToken:token});
      if(current===statusSerial&&token===activeToken)displayOrder(data);
    }catch(e){
      if(current!==statusSerial)return;
      if(!order)orderPanel.innerHTML='<h2>Acompanhar pedido</h2><p data-order-notice role="status"></p><button class="co-secondary" data-refresh type="button">Consultar novamente</button>';
      const notice=$('[data-order-notice]');if(notice)notice.textContent=e.message;
      clearPoll();if(!doc.hidden && (!order||activeStates.has(order.orderState)) && e.status!==404)poll=setTimeout(status,30000);
    } finally {statusBusy=false;}
  }
  orderPanel.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-refresh'))return status();
    if(b.hasAttribute('data-retry')){save(keys.checkout,null,true);location.replace('/sacola/');return;}

  });
  form.addEventListener('input',e=>{
    const k=e.target.name;if(addressKeys.includes(k))touched.add(k);
    if(k==='cep'){updateCep();return;}
    if(k==='coupon' || k==='email'&&fields.coupon?.value)scheduleQuote();
  });
  form.addEventListener('change',e=>{
    if(e.target.name==='shippingMethod')scheduleQuote();
    if(e.target.name==='cep')updateCep();
  });
  form.addEventListener('submit',submitOrder);
  $('[data-requote]').addEventListener('click',scheduleQuote);
  $('[data-recover]').addEventListener('click',recoverUncertain);
  $('[data-zip-preview]').addEventListener('submit',async e=>{
    e.preventDefault();const zipForm=e.target;if(!zipForm.reportValidity())return;
    const cep=normalizeCep(zipForm.elements.cep.value),btn=zipForm.querySelector('button'),out=$('[data-preview-note]');
    btn.disabled=true;out.textContent='Consultando…';
    try{const [a,s]=await Promise.allSettled([request({action:'address',cep}),request({action:'shipping',cep})]);
      if(normalizeCep(zipForm.elements.cep.value)!==cep){out.textContent='Consulte o novo CEP.';return;}
      const address=a.status==='fulfilled'&&a.value.found?[a.value.address.street,a.value.address.city,a.value.address.uf].filter(Boolean).join(' · '):'';
      const options=s.status==='fulfilled'?(s.value.shippingOptions||[]).map(o=>o.label+' '+money(o.priceCents)).join(' · '):'';
      out.textContent=[address,options].filter(Boolean).join(' — ')||'Não foi possível consultar o CEP no momento.';
    }finally{btn.disabled=false;}
  });
  doc.addEventListener('visibilitychange',()=>{clearPoll();if(!doc.hidden&&activeToken&&(!order||activeStates.has(order.orderState)))status();});
  addEventListener('pagehide',()=>{disposed=true;clearPoll();clearTimeout(timer);});
  addEventListener('pageshow',e=>{if(e.persisted){disposed=false;if(activeToken)status();else{updateBag();scheduleQuote();}}});
  addEventListener('storage',e=>{if(!activeToken&&(!e.key||e.key===keys.bag)){updateBag();scheduleQuote();}});
  async function start(){
    const t=new URLSearchParams(location.hash.slice(1)).get('pedido');
    if(t){mode('order');if(!orderTokenValid(t)){orderPanel.innerHTML='<h2>Link de pedido inválido</h2><p><a href="/atendimento/">Falar com o atendimento</a></p>';return;}activeToken=t;status();}
    try{
      const r=await fetch('/store/catalog.json');if(!r.ok)throw Error();
      const config=await r.json();products=new Map(config.products.map(p=>[p.id,p]));checkoutEnabled=config.checkoutEnabled===true;
      await migrateBag(products);if(activeToken){if(order?.orderState==='paid')finishPaidAttempt(activeToken,products);return;}
      updateBag();
      if(rows.length && await recoverUncertain())return;
      await configureCard();
      if(rows.length){if(!checkoutEnabled)notice('A finalização online está indisponível no momento. Sua sacola está salva.');if(fields.cep.value)await updateCep();}
    }catch{if(!activeToken){mode('loading');loading.textContent='Não foi possível carregar sua sacola. Atualize a página para tentar novamente.';}}
  }
  return start();
}
if(typeof document!=='undefined')initCheckout();
