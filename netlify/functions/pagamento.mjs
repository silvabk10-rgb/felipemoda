import { CommerceError,fingerprint,readToken,reject,reserve } from '../../commerce/domain.mjs';
import { applyProvider, customer, pagarme, providerPayload } from '../../commerce/provider.mjs';
import { configuration,openLedger,privateHeaders,readSmall,sameOrigin } from '../../commerce/runtime.mjs';
import { checkoutPage } from '../../commerce/view.mjs';

export const config={rateLimit:{windowLimit:20,windowSize:60,aggregateBy:['ip','domain']}};
const html=(order,message,sandbox,status=200,location='')=>new Response(checkoutPage(order,message,sandbox,location),{status,headers:{...privateHeaders,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
export async function payment(request,context,dependencies={configuration,openLedger,pagarme}) {
  let order,sandbox=false;
  const url=new URL(request.url);
  const location=url.pathname+url.search;
  try {
    if(!['POST','GET'].includes(request.method)) reject('method','Método indisponível.',405);
    sameOrigin(request);
    const cfg=dependencies.configuration(request,context);
    sandbox=cfg.mode==='sandbox';
    const id=readToken(url.searchParams.get('t'),cfg.secret);
    const ledger=await dependencies.openLedger(cfg.mode);
    order=(await ledger.read()).orders[id];
    if(!order) reject('missing','Pedido não encontrado.',404);
    let remote;
    if(request.method==='POST') {
      if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) reject('body','Formato de dados inválido.',415);
      const person=customer(new URLSearchParams(await readSmall(request)),order.input.cep);
      const buyer={emailKey:fingerprint(cfg.secret,'email:'+person.email),documentKey:fingerprint(cfg.secret,'cpf:'+person.document)};
      order=await ledger.change(data=>reserve(data,id,buyer,fingerprint(cfg.secret,JSON.stringify(person)),cfg));
      if(order.state==='sending' && !order.providerId) {
        const window=sandbox?4*60*1000:23*60*60*1000;
        if(cfg.now()-order.submittedAt >= window) reject('reconcile','O pagamento está em conferência. O atendimento pode consultar pelo número do pedido.',409);
        remote=await dependencies.pagarme(cfg,'orders',{id,body:providerPayload(order,person)});
      }
    }
    if (!remote && order.state==='sending' && !order.providerId) {
      const found=await dependencies.pagarme(cfg,'orders?size=2&code='+encodeURIComponent(id));
      if (!Array.isArray(found?.data) || found.data.length>1) reject('reconcile','O pedido precisa de conferência pelo atendimento.',409);
      const match=found.data[0];
      if (match && match.code===id && /^or_[a-z0-9]+$/i.test(match.id)) remote=await dependencies.pagarme(cfg,'orders/'+match.id);
    }
    if(!remote && order.providerId && ['pending','sending'].includes(order.state)) {
      remote=await dependencies.pagarme(cfg,'orders/'+encodeURIComponent(order.providerId));
    }
    if(remote) order=await ledger.change(data=>{applyProvider(data.orders[id],remote);return data.orders[id];});
    if(request.method==='POST') return new Response(null,{status:303,headers:{...privateHeaders,Location:url.pathname+url.search}});
    return html(order,'',sandbox,200,location);
  } catch(error) {
    const known=error instanceof CommerceError;
    return html(order,known?error.message:'Não foi possível atualizar o pedido. Consulte novamente em instantes.',sandbox,known?error.status:503,location);
  }
}
export default payment;
