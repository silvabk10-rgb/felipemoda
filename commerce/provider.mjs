import { CommerceError, emailValid, normalizeEmail, reject } from './domain.mjs';

function field(form,key,min,max) {
  const value=String(form.get(key) ?? '').trim();
  if (value.length < min || value.length > max || /[\u0000-\u001f]/.test(value)) reject('address','Confira os dados de contato e entrega.');
  return value;
}
function validCPF(value) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (const length of [9,10]) {
    const sum=[...value.slice(0,length)].reduce((total,digit,i) => total + Number(digit)*(length+1-i),0);
    if (((sum*10)%11)%10 !== Number(value[length])) return false;
  }
  return true;
}
export function customer(form, cep) {
  const name=field(form,'name',3,64);
  const document=field(form,'cpf',11,14).replace(/[.\-]/g,'');
  const email=normalizeEmail(field(form,'email',3,64));
  const phone=field(form,'phone',10,17).replace(/[()\s-]/g,'');
  const state=field(form,'uf',2,2).toUpperCase();
  if (!validCPF(document)) reject('cpf','Confira os onze dígitos do CPF.');
  if (!emailValid(email)) reject('email','Informe um e-mail válido.');
  if (!/^[1-9]\d{9,10}$/.test(phone)) reject('phone','Informe o telefone com DDD.');
  if (!'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(state)) reject('uf','Confira a sigla do estado.');
  const address={country:'BR', state,city:field(form,'city',2,64),zip_code:cep,
    line_1:[field(form,'number',1,10),field(form,'street',2,100),field(form,'district',2,60)].join(', '),
    line_2:field(form,'extra',0,64)};
  return {name, email, document, document_type:'CPF',type:'individual',address,phones:{mobile_phone:{country_code:'55',area_code:phone.slice(0,2),number:phone.slice(2)}}};
}

// Distribui centavos remanescentes entre unidades e mantém a soma exata.
export function providerItems(quote) {
  let seen=0;
  const output=[];
  const grossTotal=BigInt(quote.subtotalCents);
  const discountThrough = cumulative => Number((2n*BigInt(cumulative)*BigInt(quote.discountCents)+grossTotal)/(2n*grossTotal));
  for (const line of quote.lines) {
    const gross=line.quantity*line.unitCents;
    const end=discountThrough(seen+gross);
    const start=discountThrough(seen);
    const net=gross-(end-start);
    const unit=Math.floor(net/line.quantity);
    const remainder=net%line.quantity;
    for (const [amount,quantity] of [[unit,line.quantity-remainder],[unit+1,remainder]]) {
      if (amount>0 && quantity>0) output.push({code:line.variantId,description:line.name,amount,quantity});
    }
    seen+=gross;
  }
  return output;
}

export function providerPayload(order, person) {
  const card=order.paymentMethod==='card';
  const buyer=card ? {customer_id:order.providerCustomerId} : {customer:person};
  const payment=card ? {payment_method:'credit_card',credit_card:{card_id:order.providerCardId,operation_type:'auth_and_capture',installments:1,auto_recovery:false}}
    : {payment_method:'pix',pix:{expires_in:1800}};
  return {code:order.id,closed:true,currency:'BRL',...buyer,items:providerItems(order.quote),
    shipping:{amount:order.quote.shippingCents,description:order.quote.shippingLabel || 'Entrega',recipient_name:person.name,address:person.address},
    payments:[{...payment,amount:order.quote.totalCents}]};
}

export class InvalidProviderOrder extends CommerceError {
  constructor() { super('provider_validation','O provedor não aceitou os dados do pedido.',422); }
}

export async function pagarme(cfg,path,options={}) {
  let response;
  try {
    response = await fetch('https://api.pagar.me/core/v5/'+path, {
      method:options.body?'POST':'GET', redirect:'error',signal:AbortSignal.timeout(9000),
      headers:{'Authorization':'Basic '+Buffer.from(cfg.key+':').toString('base64'),'Content-Type':'application/json',
        ...(options.id?{'Idempotency-Key':options.id}:{})},
      body:options.body?JSON.stringify(options.body):undefined
    });
  } catch {
    reject('pending_check','Não foi possível consultar o pagamento agora. Guarde o link do pedido e consulte novamente.',503);
  }
  if (!response.ok) {
    if (path==='orders' && options.body && response.status===422) {
      const failure=await response.json().catch(()=>null);
      if (failure?.errors && typeof failure.errors==='object' && Object.keys(failure.errors).length) throw new InvalidProviderOrder();
    }
    // Timeout, 409 e falhas técnicas são resultados indeterminados.
    reject('provider','O provedor não confirmou a solicitação. Consulte o pedido novamente ou fale com o atendimento.',503);
  }
  return await response.json();
}

export function applyProvider(order,remote) {
  if (!order || !/^or_[a-z0-9]+$/i.test(remote.id) || (order.providerId && order.providerId!==remote.id)
    || remote.code!==order.id || remote.currency!=='BRL' || remote.amount!==order.quote.totalCents || remote.closed!==true) {
    reject('mismatch','O pagamento precisa de conferência pelo atendimento.',409);
  }
  if (!['sending','pending','paid','refunded','partially_refunded','disputed','declined','canceled'].includes(order.state)) reject('state','Pedido não iniciou um pagamento.',409);
  const charge=remote.charges?.length===1 ? remote.charges[0] : null;
  const expectedMethod=order.paymentMethod==='card'?'credit_card':'pix';
  if (!charge || charge.currency!=='BRL' || charge.amount!==order.quote.totalCents || String(charge.payment_method).toLowerCase()!==expectedMethod || (order.providerChargeId && charge.id!==order.providerChargeId)) reject('charge','A cobrança precisa de conferência.',409);
  let state='pending';
  const financialStates=[charge.status,charge.last_transaction?.status];
  const previouslyPaid=['paid','partially_refunded'].includes(order.state) || Boolean(charge.paid_at) || charge.paid_amount>0;
  // canceled_amount também pode ser uma autorização desfeita antes da captura.
  const refunded=charge.refunded_amount ?? (previouslyPaid?charge.canceled_amount:null);
  if (financialStates.includes('chargedback')) state='disputed';
  else if (financialStates.includes('refunded') || refunded===order.quote.totalCents) state='refunded';
  else if (financialStates.includes('partial_refunded') || Number.isInteger(refunded) && refunded>0 && refunded<order.quote.totalCents) state='partially_refunded';
  else if (remote.status==='paid' && charge.status==='paid' && charge.paid_amount===order.quote.totalCents) state='paid';
  else if (remote.status==='failed' && charge.status==='failed') state='declined';
  else if (remote.status==='canceled' && ['failed','canceled'].includes(charge.status)) state='canceled';

  // Respostas fora de ordem não podem desfazer estados já confirmados.
  const reversals=['refunded','partially_refunded','disputed'];
  if (['disputed','refunded'].includes(order.state)) return;
  if (order.state==='partially_refunded' && !['refunded','disputed'].includes(state)) return;
  if (order.state==='paid' && !reversals.includes(state)) return;
  if (['declined','canceled'].includes(order.state) && ['pending','declined','canceled'].includes(state)) return;
  order.providerId=remote.id;
  if (/^ch_[a-z0-9]+$/i.test(charge.id??'')) order.providerChargeId=charge.id;
  order.state=state;
  order.pix=expectedMethod==='pix' && state==='pending' ? String(charge.last_transaction?.qr_code ?? '').slice(0,1500) : '';
  order.pixExpires=charge.last_transaction?.expires_at ?? null;
  order.pixQrUrl=expectedMethod==='pix' && state==='pending'?safeQrUrl(charge.last_transaction?.qr_code_url):null;
}

export function safeQrUrl(value) {
  if (typeof value !== 'string' || value.length>2048) return null;
  try {
    const uri=new URL(value);
    const permitted=/(^|\.)(pagar\.me|stone\.com\.br)$/.test(uri.hostname);
    return permitted && uri.protocol==='https:' && !uri.username && !uri.password && !uri.port ? uri.href : null;
  } catch { return null; }
}
