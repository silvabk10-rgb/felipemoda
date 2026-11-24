import { randomUUID } from 'node:crypto';
import { fingerprint } from '../../commerce/domain.mjs';
import { reconcile } from '../../commerce/payment.mjs';
import { pagarme } from '../../commerce/provider.mjs';
import { openLedger,scheduleConfiguration } from '../../commerce/runtime.mjs';

export const config={schedule:'*/5 * * * *'};

const minute=60000;
const day=24*60*minute;
const batchSize=5;
const inFlight=new Set(['sending','pending']);
const settled=new Set(['paid','partially_refunded']);
const isLocal=id=>typeof id==='string' && /^fm_[\w-]{26}$/.test(id);
const isProvider=id=>typeof id==='string' && /^or_[a-z0-9]+$/i.test(id);

function candidates(orders,now) {
  const pending=[];
  const reviewed=[];
  for (const [id,order] of Object.entries(orders)) {
    if (!isLocal(id) || id!==order.id || order.providerId && !isProvider(order.providerId)) continue;
    const last=Math.max(order.scheduledAt??0,order.providerCheckedAt??0);
    if (inFlight.has(order.state) && now-last>=minute*4) pending.push({id,last});
    if (settled.has(order.state) && order.providerId && now-last>=day) reviewed.push({id,last});
  }
  const oldest=(a,b)=>a.last-b.last || a.id.localeCompare(b.id);
  pending.sort(oldest);
  reviewed.sort(oldest);
  // Mesmo com fila de pagamentos em aberto, conferimos uma venda já paga por lote.
  const first=pending.splice(0,reviewed.length?batchSize-1:batchSize);
  return [...first,...reviewed,...pending].slice(0,batchSize).map(row=>row.id);
}

async function probeCredentials(cfg,get) {
  // Este código nunca é gerado pelo checkout. A consulta filtrada não enumera pedidos de outros canais.
  const code='fm-auth-'+randomUUID();
  try {
    const result=await get(cfg,'orders?size=1&code='+encodeURIComponent(code));
    return Array.isArray(result?.data) && result.data.length===0?'authenticated':'inconclusive';
  } catch(error) {
    if(error?.upstreamStatus===401) return 'unauthorized';
    if(error?.upstreamStatus===403) return 'forbidden';
    return 'unavailable';
  }
}

function readOnlyProvider(provider,deadline) {
  return async (cfg,path,options)=>{
    if (options!==undefined || !/^orders(?:\/or_[a-z0-9]+|\?size=2&code=fm_[\w-]{26}|\?size=1&code=fm-auth-[a-f0-9-]{36})$/i.test(path)) {
      throw new Error('Consulta de conciliação inválida.');
    }
    return provider(cfg,path,{signal:AbortSignal.any([deadline,AbortSignal.timeout(3500)])});
  };
}

export async function runScheduled(context,deps={configuration:scheduleConfiguration,openLedger,provider:pagarme}) {
  const cfg=deps.configuration(context);
  if (!cfg || cfg.mode!=='live') return {run:'inactive'};
  const ledger=await deps.openLedger('live');
  const now=cfg.now();
  const owner=randomUUID();
  const keyVersion=fingerprint(cfg.secret,cfg.key);
  const deploy=context.deploy.id;
  const claim=await ledger.change(state=>{
    const control=state.scheduler??={};
    if (control.lease?.until>now) return null;
    control.lease={owner,until:now+minute};
    const check=control.authentication;
    const same=check?.keyVersion===keyVersion && check?.deploy===deploy;
    const due=!same || now-check.at>=(check.result==='authenticated'?day:15*minute);
    return {due,previous:same?check.result:null};
  });
  if (!claim) return {run:'already_running'};
  const deadline=AbortSignal.timeout(21000);
  const get=readOnlyProvider(deps.provider,deadline);
  const stats={run:'complete',authentication:claim.previous??'unverified',probe:claim.due,checked:0,changed:0,errors:0};
  try {
    if (claim.due) {
      stats.authentication=await probeCredentials(cfg,get);
      await ledger.change(state=>{
        if(state.scheduler.lease?.owner===owner) state.scheduler.authentication={at:now,result:stats.authentication,deploy,keyVersion};
      });
    }
    if(stats.authentication!=='authenticated') return stats;
    const batch=await ledger.change(state=>{
      if(state.scheduler.lease?.owner!==owner) return [];
      return candidates(state.orders,now).map(id=>{
        const order=state.orders[id];
        order.scheduledAt=now;
        return order;
      });
    });
    // Duas consultas autenticadas no máximo por pedido: busca exata e leitura da referência.
    await Promise.all(batch.map(async order=>{
      try {
        const before=order.state;
        const current=await reconcile(order,ledger,cfg,get);
        stats.checked++;
        if(current.state!==before) stats.changed++;
      } catch { stats.errors++; }
    }));
    return stats;
  } finally {
    await ledger.change(state=>{
      if(state.scheduler.lease?.owner!==owner) return;
      delete state.scheduler.lease;
      state.scheduler.lastRun={at:now,...stats};
    });
  }
}

export default async function scheduled(_request,context) {
  try {
    const summary=await runScheduled(context);
    console.info('Felipe Modas · conciliação',JSON.stringify(summary));
  } catch {
    // Não registre chaves, URLs de consulta, respostas da adquirente ou dados pessoais.
    console.error('Felipe Modas · conciliação indisponível');
    throw new Error('Conciliação indisponível.');
  }
}
