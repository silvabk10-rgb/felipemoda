import { begin, calculate, checkoutIdentity, CommerceError, emailValid, fingerprint, normalizeCep, normalizeEmail, normalizeRequest, reject } from '../../commerce/domain.mjs';
import { configuration, openLedger, privateHeaders, readSmall, sameOrigin } from '../../commerce/runtime.mjs';
import { getPrivateOrder, privateStatus, reconcile, reserveForCustomer, submitPayment } from '../../commerce/payment.mjs';
import { customer, pagarme } from '../../commerce/provider.mjs';
import { shippingRates } from '../../commerce/config.mjs';
import { postalAddress } from '../../commerce/address.mjs';

export const config={rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain']}};
const response=(value,status=200)=>Response.json(value,{status,headers:privateHeaders});

function parseCustomer(body,cep) {
  const form=new URLSearchParams();
  for (const [source,fields] of [[body.customer,['name','email','cpf','phone']],[body.address,['street','number','district','extra','city','uf']]]) {
    for (const field of fields) {
      const value=source?.[field];
      if (value !== undefined && typeof value!=='string') reject('address','Confira os dados de contato e entrega.');
      form.set(field,value ?? '');
    }
  }
  return customer(form,cep);
}

function checkPaymentFields(body) {
  const rootFields=new Set(['action','method','items','cep','coupon','email','shippingMethod','expectedTotalCents','idempotencyKey','customer','address','cardToken']);
  const allowed={customer:['name','email','cpf','phone'],address:['street','number','district','extra','city','uf']};
  if (Object.keys(body).some(k=>!rootFields.has(k)) || (body.method!==undefined && body.method!==body.action)) reject('card','Envie somente o token do cartão.');
  for (const [group,keys] of Object.entries(allowed)) {
    if (!body[group] || typeof body[group]!=='object' || Array.isArray(body[group]) || Object.keys(body[group]).some(k=>!keys.includes(k))) {
      reject('card','Confira os dados de contato e endereço.');
    }
  }
  if (!Array.isArray(body.items) || body.items.some(item=>!item || Object.keys(item).some(k=>!['variantId','quantity'].includes(k)))) reject('card','Confira os itens da sacola.');
  if(typeof body.cardToken!=='string' || !/^token_[a-zA-Z0-9_-]{4,160}$/.test(body.cardToken)) reject('card','O cartão precisa ser tokenizado pelo provedor.');
}

function paymentMethods(cfg) {
  const cardEnabled=cfg?.cardEnabled===true && Boolean(cfg.cardPublicKey);
  const paymentMethods=cardEnabled?['card']:[];
  return {paymentMethods,cardEnabled,cardPublicKey:cardEnabled?cfg.cardPublicKey:null,environment:cfg?.mode??'unconfigured'};
}

export async function api(request,context,dependencies={configuration,openLedger,pagarme,postalAddress}) {
  let recovery={};
  try {
    if(request.method!=='POST') reject('method','Use POST para consultar a sacola.',405);
    sameOrigin(request);
    if (!request.headers.get('content-type')?.includes('application/json')) reject('body','Formato de solicitação inválido.',415);
    let body;
    try { body=JSON.parse(await readSmall(request)); } catch (error) {
      if(error instanceof CommerceError) throw error;
      reject('body','Não foi possível ler a solicitação.');
    }
    const action=body?.action;
    if(['pix','checkout'].includes(action)) reject('method','Finalize sua compra com cartão em uma parcela.',409);
    if(!['shipping','address','methods','quote','card','payment-status'].includes(action)) reject('action','Solicitação inválida.');
    if(action==='shipping' || action==='address') {
      const cep=normalizeCep(body.cep);
      const result=action==='address'?await (dependencies.postalAddress??postalAddress)(cep):{shippingOptions:shippingRates};
      return response({ok:true,...result});
    }
    if(action==='methods') {
      try { return response({ok:true,...paymentMethods(dependencies.configuration(request,context))}); }
      catch(error) {
        if(error instanceof CommerceError && error.code==='closed') return response({ok:true,...paymentMethods(null)});
        throw error;
      }
    }
    if (action==='card') checkPaymentFields(body);
    const cfg=dependencies.configuration(request,context);
    if(action==='card' && !paymentMethods(cfg).cardEnabled) reject('method','O pagamento com cartão está indisponível.',409);
    const ledger=await dependencies.openLedger(cfg.mode);
    const provider=dependencies.pagarme??pagarme;
    if(action==='payment-status') {
      let token=body.orderToken;
      if (!token && typeof body.idempotencyKey==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.idempotencyKey)) {
        token=checkoutIdentity(body.idempotencyKey,cfg.secret).token;
      }
      const order=await getPrivateOrder(ledger,token,cfg);
      recovery={orderId:order.id,orderToken:token,orderState:order.state};
      const current=await reconcile(order,ledger,cfg,provider);
      return response({ok:true,...privateStatus(current,token)});
    }

    const input=normalizeRequest(body);
    const person=action==='card'?parseCustomer(body,input.cep):null;
    const email=person?.email??normalizeEmail(body.email);
    if (email && !emailValid(email)) reject('email','Informe um e-mail válido.');
    const emailKey=email?fingerprint(cfg.secret,'email:'+email):null;
    if(action==='quote') {
      const {lines,...totals}=calculate(input,await ledger.read(),cfg,{emailKey});
      return response({ok:true,...totals,shippingOptions:cfg.rates});
    }

    const {id,token}=checkoutIdentity(body.idempotencyKey,cfg.secret);
    const order=await ledger.change(data=>{
      const draft=begin(data,input,emailKey,id,cfg);
      if (body.expectedTotalCents!==undefined && draft.quote.totalCents!==body.expectedTotalCents) reject('changed','O total mudou. Confira a cotação antes de confirmar o pagamento.',409);
      return reserveForCustomer(data,id,person,cfg,context?.ip);
    });
    recovery={orderId:id,orderToken:token,orderState:order.state};
    const current=await submitPayment(order,person,ledger,cfg,provider,body.cardToken);
    return response({ok:true,...privateStatus(current,token)});
  } catch (error) {
    const known=error instanceof CommerceError;
    return response({ok:false,code:known?error.code:'temporarily_unavailable',message:known?error.message:'O serviço está temporariamente indisponível.',...recovery},known?error.status:503);
  }
}
export default api;
