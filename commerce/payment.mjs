import {abandonedBeforeDispatch,fingerprint,readToken,reject,reserve} from './domain.mjs';
import {applyProvider,InvalidProviderOrder,providerPayload} from './provider.mjs';

export function reserveForCustomer(state,id,person,cfg,ip='') {
  const buyer={
    emailKey:fingerprint(cfg.secret,'email:'+person.email),
    documentKey:fingerprint(cfg.secret,'cpf:'+person.document)
  };
  const order=state.orders[id];
  if (order.state!=='draft' && order.paymentMethod!=='card') reject('conflict','O meio de pagamento já foi definido para este pedido.',409);
  if (order.state==='draft') {
    const ipKey=ip?fingerprint(cfg.secret,'ip:'+ip):null;
    const recent=Object.values(state.orders).filter(other=>other.id!==id && other.paymentMethod==='card' && other.submittedAt>cfg.now()-10*60*1000 &&
      (other.buyer?.documentKey===buyer.documentKey || other.buyer?.emailKey===buyer.emailKey || (ipKey && other.buyer?.ipKey===ipKey)));
    if(recent.length>=6) reject('wait','Aguarde alguns minutos antes de tentar outro pagamento.',429);
    if(ipKey) buyer.ipKey=ipKey;
  }
  const newAttempt=order.state==='draft';
  const reserved=reserve(state,id,buyer,fingerprint(cfg.secret,JSON.stringify(person)),cfg);
  if(newAttempt) reserved.dispatchVersion=2;
  reserved.paymentMethod='card';
  return reserved;
}

export async function getPrivateOrder(ledger,token,cfg) {
  const id=readToken(token,cfg.secret);
  const order=(await ledger.read()).orders[id];
  if (!order) reject('missing','Pedido não encontrado.',404);
  return order;
}

async function saveRemote(order,remote,ledger,checkedAt) {
  return ledger.change(state=>{
    const current=state.orders[order.id];
    applyProvider(current,remote);
    current.providerCheckedAt=checkedAt;
    return current;
  });
}

export async function reconcile(order,ledger,cfg,provider) {
  const settled=['paid','partially_refunded'].includes(order.state);
  if (settled && (!order.providerId || order.providerCheckedAt && cfg.now()-order.providerCheckedAt<60000)) return order;
  if (!settled && !['sending','pending'].includes(order.state)) return order;
  if(order.dispatchVersion===2 && !order.gatewaySentAt && !order.providerId) {
    if(!abandonedBeforeDispatch(order,cfg.now())) return order;
    return ledger.change(state=>{
      const current=state.orders[order.id];
      if(abandonedBeforeDispatch(current,cfg.now())) current.state='canceled';
      return current;
    });
  }
  let providerId=order.providerId;
  if (!providerId) {
    const found=await provider(cfg,'orders?size=2&code='+encodeURIComponent(order.id));
    if (!Array.isArray(found?.data) || found.data.length>1) reject('reconcile','O pedido precisa de conferência pelo atendimento.',409);
    if (!found.data.length) return order;
    const match=found.data[0];
    if (match.code!==order.id || !/^or_[a-z0-9]+$/i.test(match.id)) reject('reconcile','O provedor não confirmou a referência do pedido.',409);
    providerId=match.id;
  }
  const remote=await provider(cfg,'orders/'+encodeURIComponent(providerId));
  if (remote?.id!==providerId) reject('reconcile','A referência do pagamento precisa de conferência.',409);
  return saveRemote(order,remote,ledger,cfg.now());
}

async function prepareCard(order,person,token,ledger,cfg,provider) {
  const update=patch=>ledger.change(state=>{
    Object.assign(state.orders[order.id],patch);
    return state.orders[order.id];
  });
  if (!order.providerCustomerId) {
    const record=await provider(cfg,'customers',{id:order.id+'-customer',body:person});
    if (!/^cus_[a-z0-9]+$/i.test(record?.id)) reject('provider','Não foi possível validar o cadastro do comprador.',503);
    order=await update({providerCustomerId:record.id});
  }
  if (!order.providerCardId) {
    const record=await provider(cfg,'customers/'+order.providerCustomerId+'/cards',{id:order.id+'-card',
      body:{token,billing_address:person.address}});
    if (!/^card_[a-z0-9]+$/i.test(record?.id) || (record.status && record.status!=='active')) {
      reject('card','O provedor não disponibilizou o cartão para esta compra.',422);
    }
    order=await update({providerCardId:record.id});
  }
  return order;
}

export async function submitPayment(order,person,ledger,cfg,provider,cardToken) {
  if (order.paymentMethod!=='card') reject('method','Este pedido está disponível somente para consulta.',409);
  if (order.state!=='sending' || order.providerId) return reconcile(order,ledger,cfg,provider);
  if (order.gatewaySentAt) {
    order=await reconcile(order,ledger,cfg,provider);
    if (order.state!=='sending' || order.providerId) return order;
  }
  const claim=await ledger.change(state=>{
    const current=state.orders[order.id];
    if (current.state!=='sending' || current.providerId) return {send:false,order:current};
    const now=cfg.now();
    if (current.dispatchedAt && now-current.dispatchedAt < 45000) return {send:false,order:current};
    const safeWindow=cfg.mode==='sandbox'?4*60*1000:23*60*60*1000;
    if (now-current.submittedAt>=safeWindow) reject('reconcile','O pagamento está em conferência. O atendimento pode consultar pelo número do pedido.',409);
    current.dispatchedAt=now;
    return {send:true,order:current};
  });
  if (!claim.send) return claim.order;
  order=claim.order;
  try {
    order=await prepareCard(order,person,cardToken,ledger,cfg,provider);
  } catch(error) {
    // Preparar um cartão na carteira não cria um pedido. Libere a reserva se nenhum envio de cobrança ocorreu.
    const current=await ledger.change(data=>{
      const saved=data.orders[order.id];
      if(saved.state==='sending' && !saved.gatewaySentAt) saved.state='canceled';
      return saved;
    });
    if(current.state==='canceled') return current;
    throw error;
  }
  const dispatch=await ledger.change(data=>{
    const current=data.orders[order.id];
    if (current.state!=='sending') return {send:false,order:current};
    const firstSend=!current.gatewaySentAt && current.dispatchVersion===2;
    current.gatewaySentAt??=cfg.now();
    current.gatewaySendCount=(current.gatewaySendCount??0)+1;
    return {send:true,firstSend,order:current};
  });
  if (!dispatch.send) return dispatch.order;
  try {
    const remote=await provider(cfg,'orders',{id:order.id,body:providerPayload(dispatch.order,person)});
    return await saveRemote(claim.order,remote,ledger,cfg.now());
  } catch(error) {
    if (!(error instanceof InvalidProviderOrder) || !dispatch.firstSend) throw error;
    return ledger.change(data=>{
      const current=data.orders[order.id];
      if (current.state==='sending' && !current.providerId && current.gatewaySendCount===1) current.state='canceled';
      return current;
    });
  }
}

export function privateStatus(order,token) {
  const quote=order.quote;
  return {
    orderId:order.id,orderToken:token,orderState:order.state,paymentMethod:order.paymentMethod??'pix',
    subtotalCents:quote.subtotalCents,discountCents:quote.discountCents,
    shippingCents:quote.shippingCents,totalCents:quote.totalCents,
    shippingMethod:quote.shippingMethod ?? null,shippingLabel:quote.shippingLabel ?? 'Entrega'
  };
}
