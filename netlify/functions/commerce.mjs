import { begin, calculate, checkoutIdentity, CommerceError, emailValid, fingerprint, normalizeEmail, normalizeRequest, reject } from '../../commerce/domain.mjs';
import { configuration, openLedger, privateHeaders, readSmall, sameOrigin } from '../../commerce/runtime.mjs';

export const config={rateLimit:{windowLimit:40,windowSize:60,aggregateBy:['ip','domain']}};
export async function api(request,context,dependencies={configuration,openLedger}) {
  try {
    if(request.method!=='POST') reject('method','Use POST para consultar a sacola.',405);
    sameOrigin(request);
    if (!request.headers.get('content-type')?.includes('application/json')) reject('body','Formato de solicitação inválido.',415);
    let body;
    try { body=JSON.parse(await readSmall(request)); } catch (error) {
      if(error instanceof CommerceError) throw error;
      reject('body','Não foi possível ler a sacola.');
    }
    if (!['quote','checkout'].includes(body?.action)) reject('action','Solicitação inválida.');
    const input=normalizeRequest(body);
    const cfg=dependencies.configuration(request,context);
    const email=normalizeEmail(body.email);
    if (email && !emailValid(email)) reject('email','Informe um e-mail válido.');
    const emailKey=email?fingerprint(cfg.secret,'email:'+email):null;
    const ledger=await dependencies.openLedger(cfg.mode);
    let value;
    if(body.action==='quote') {
      const {lines,...totals}=calculate(input,await ledger.read(),cfg,{emailKey});
      value=totals;
    } else {
      const {id,token}=checkoutIdentity(body.idempotencyKey,cfg.secret);
      const order=await ledger.change(data=>begin(data,input,emailKey,id,cfg));
      const expired=order.state==='draft' && cfg.now()-order.createdAt>30*60*1000;
      value={orderId:id,orderState:expired?'expired':order.state,checkoutUrl:'/.netlify/functions/pagamento?t='+encodeURIComponent(token)};
    }
    return Response.json({ok:true,...value},{headers:privateHeaders});
  } catch (error) {
    const known=error instanceof CommerceError;
    return Response.json({ok:false,code:known?error.code:'temporarily_unavailable',message:known?error.message:'O serviço está temporariamente indisponível.'},{status:known?error.status:503,headers:privateHeaders});
  }
}
export default api;
