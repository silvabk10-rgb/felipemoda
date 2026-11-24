import { configuration,openLedger,privateHeaders,readSmall } from '../../commerce/runtime.mjs';
import { pagarme,applyProvider } from '../../commerce/provider.mjs';
import { CommerceError } from '../../commerce/domain.mjs';

// Eventos notificam. Somente a resposta consultada com a credencial do lojista altera o saldo.
export const config={rateLimit:{windowLimit:100,windowSize:60,aggregateBy:['ip','domain']}};
export async function webhook(request,context,dependencies={configuration,openLedger,pagarme}) {
  if(request.method!=='POST') return new Response(null,{status:405,headers:privateHeaders});
  try {
    const cfg=dependencies.configuration(request,context);
    const event=JSON.parse(await readSmall(request,256*1024));
    if (!/^order\.(paid|created|create|closed|canceled|payment_failed|updated)$/.test(event?.type) && !/^charge\.(paid|payment_failed|pending|refunded|updated)$/.test(event?.type)) return new Response(null,{status:204});
    const data=event.type.startsWith('order.')?event.data:event.data?.order;
    if (!/^or_[a-z0-9]+$/i.test(data?.id) || !/^fm_[\w-]{26}$/.test(data?.code)) return new Response(null,{status:204});
    const ledger=await dependencies.openLedger(cfg.mode);
    const order=(await ledger.read()).orders[data.code];
    if(!order || order.state==='draft' || order.providerId && order.providerId!==data.id) return new Response(null,{status:204});
    const remote=await dependencies.pagarme(cfg,'orders/'+data.id);
    await ledger.change(state=>applyProvider(state.orders[data.code],remote));
    return new Response(null,{status:204});
  } catch(error) {
    const status=error instanceof SyntaxError?400:(error instanceof CommerceError?error.status:503);
    return new Response(null,{status,headers:privateHeaders});
  }
}
export default webhook;
