import { configuration,openLedger,privateHeaders,readSmall } from '../../commerce/runtime.mjs';
import { pagarme,applyProvider } from '../../commerce/provider.mjs';
import { CommerceError,reject } from '../../commerce/domain.mjs';

export const config={rateLimit:{windowLimit:100,windowSize:60,aggregateBy:['ip','domain']}};
const orderId=value=>typeof value==='string'&&/^or_[a-z0-9]+$/i.test(value);
const chargeId=value=>typeof value==='string'&&/^ch_[a-z0-9]+$/i.test(value);

export async function webhook(request,context,dependencies={configuration,openLedger,pagarme}) {
  if(request.method!=='POST') return new Response(null,{status:405,headers:privateHeaders});
  try {
    const cfg=dependencies.configuration(request,context);
    const event=JSON.parse(await readSmall(request,256*1024));
    const isOrder=/^order\.(paid|created|create|closed|canceled|payment_failed|updated)$/.test(event?.type);
    const isCharge=/^charge\.(paid|payment_failed|pending|refunded|partial_canceled|updated|chargedback)$/.test(event?.type);
    const isDispute=event?.type==='chargeback.received';
    if(!isOrder&&!isCharge&&!isDispute) return new Response(null,{status:204});
    const identity=isOrder?event.data:event.data?.order??event.data?.charge?.order;
    const remoteId=orderId(identity?.id)?identity.id:null;
    const notifiedCharge=isDispute?event.data?.charge_id??event.data?.charge?.id:event.data?.id;
    const remoteCharge=(isCharge||isDispute)&&chargeId(notifiedCharge)?notifiedCharge:null;
    if(!remoteId&&!remoteCharge) return new Response(null,{status:204});
    const ledger=await dependencies.openLedger(cfg.mode);
    const data=await ledger.read();
    const order=(/^fm_[\w-]{26}$/.test(identity?.code??'') && data.orders[identity.code]) ||
      Object.values(data.orders).find(o=>remoteId&&o.providerId===remoteId || remoteCharge&&o.providerChargeId===remoteCharge);
    if(!order || order.state==='draft' || remoteId && order.providerId && order.providerId!==remoteId || remoteCharge && order.providerChargeId && remoteCharge!==order.providerChargeId) return new Response(null,{status:204});
    const id=order.providerId||remoteId;
    if(!id) return new Response(null,{status:204});
    const remote=await dependencies.pagarme(cfg,'orders/'+id);
    if (remote?.id!==id) reject('reconcile','A referência do pagamento precisa de conferência.',409);
    await ledger.change(state=>applyProvider(state.orders[order.id],remote));
    return new Response(null,{status:204});
  } catch(error) {
    const status=error instanceof SyntaxError?400:(error instanceof CommerceError?error.status:503);
    return new Response(null,{status,headers:privateHeaders});
  }
}
export default webhook;
