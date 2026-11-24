import { CommerceError,reject } from '../../commerce/domain.mjs';
import { customer,pagarme } from '../../commerce/provider.mjs';
import { getPrivateOrder,reconcile,reserveForCustomer,submitPayment } from '../../commerce/payment.mjs';
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
    const ledger=await dependencies.openLedger(cfg.mode);
    order=await getPrivateOrder(ledger,url.searchParams.get('t'),cfg);
    if(request.method==='POST') {
      if((order.paymentMethod??'pix')!=='pix' || cfg.pixEnabled===false) reject('method','Esta forma de pagamento está indisponível.',409);
      if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) reject('body','Formato de dados inválido.',415);
      const person=customer(new URLSearchParams(await readSmall(request)),order.input.cep);
      order=await ledger.change(data=>reserveForCustomer(data,order.id,person,cfg));
      order=await submitPayment(order,person,ledger,cfg,dependencies.pagarme);
      return new Response(null,{status:303,headers:{...privateHeaders,Location:location}});
    }
    order=await reconcile(order,ledger,cfg,dependencies.pagarme);
    return html(order,'',sandbox,200,location);
  } catch(error) {
    const known=error instanceof CommerceError;
    return html(order,known?error.message:'Não foi possível atualizar o pedido. Consulte novamente em instantes.',sandbox,known?error.status:503,location);
  }
}
export default payment;
