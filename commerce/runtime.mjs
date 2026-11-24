import { campaign, inventory, shippingRates } from './config.mjs';
import { freshLedger, reject } from './domain.mjs';

export function configuration(request,context) {
  const mode=process.env.FM_COMMERCE_MODE;
  const secret=process.env.FM_COMMERCE_SECRET;
  const key=mode==='sandbox'?process.env.PAGARME_TEST_SECRET_KEY:process.env.PAGARME_SECRET_KEY;
  const enabled=mode==='sandbox' ? /^sk_test_[\w-]+$/.test(key??'')
    : mode==='live' && context?.deploy?.published === true && new URL(request.url).hostname==='felipemodasbr.com' && /^sk_(?!test_)[\w-]+$/.test(key??'');
  if (!enabled || !secret || secret.length<32) reject('closed','A finalização da compra está indisponível no momento.',503);
  return {mode,key,secret,stock:inventory(),rates:shippingRates,campaign,now:Date.now};
}
export async function openLedger(mode) {
  const {getStore}=await import('@netlify/blobs');
  const store=getStore({name:'fm-orders-'+mode,consistency:'strong'});
  return ledgerFromStore(store);
}

export function ledgerFromStore(store) {
  const read=() => store.getWithMetadata('ledger-v1',{type:'json',consistency:'strong'});
  return {
    async read() { return (await read())?.data ?? freshLedger(); },
    async change(update) {
      for(let attempt=0;attempt<8;attempt++) {
        const saved=await read();
        const ledger=saved?.data??freshLedger();
        const before=JSON.stringify(ledger);
        const result=update(ledger);
        const after=JSON.stringify(ledger);
        if (before===after) return result;
        const written=await store.set('ledger-v1',after,saved?{onlyIfMatch:saved.etag}:{onlyIfNew:true});
        if (written.modified) return result;
      }
      reject('busy','O pedido está sendo atualizado. Aguarde um instante e tente novamente.',409);
    }
  };
}

export const privateHeaders={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};

export async function readSmall(request, max=16384) {
  if (Number(request.headers.get('content-length') ?? 0)>max) reject('size','Solicitação muito grande.',413);
  const reader=request.body?.getReader();
  if (!reader) reject('body','Confira os dados enviados.');
  const chunks=[];
  let size=0;
  for(;;) {
    const {value,done}=await reader.read();
    if(done) break;
    size+=value.byteLength;
    if(size>max) { await reader.cancel(); reject('size','Solicitação muito grande.',413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
export function sameOrigin(request) {
  const origin=request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) reject('origin','Solicitação inválida.',403);
}
