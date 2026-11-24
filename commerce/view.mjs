const escape = value => String(value ?? '').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => (cents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const labels={draft:'Pedido não finalizado',sending:'Aguardando o provedor',pending:'Pagamento pendente',paid:'Pagamento aprovado',declined:'Pagamento recusado',canceled:'Pagamento cancelado',refunded:'Pagamento estornado',partially_refunded:'Estorno parcial',disputed:'Pagamento contestado'};
const css='*{box-sizing:border-box}body{margin:0;background:#faf8f1;color:#202020;font:16px/1.55 system-ui,sans-serif}main,header{margin:auto;max-width:860px;padding:24px}header{border-bottom:1px solid #d9c8b7;display:flex;align-items:center;justify-content:space-between}header a{text-decoration:none;color:inherit}header a:first-child{font:1.6rem Georgia,serif}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.15}h1{font-size:clamp(2rem,5vw,3rem)}section{background:white;padding:clamp(16px,4vw,32px);margin:20px 0}ul{padding-left:1.2em}dl>div{display:flex;justify-content:space-between;gap:16px;margin:6px 0}dt,dd{margin:0}label{display:grid;gap:4px;margin-bottom:13px}input,textarea,button{font:inherit;padding:10px 12px;border:1px solid #887d75;width:100%;border-radius:3px}button{background:#814930;color:white;cursor:pointer;border:0;min-height:48px}a{color:#754128}textarea{resize:vertical}small{display:block}.grid{display:grid;gap:0 14px;grid-template-columns:repeat(2,minmax(0,1fr))}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #955a3a;outline-offset:2px}@media(max-width:580px){.grid{grid-template-columns:1fr}}';
function summary(order) {
  const q=order.quote;
  const data=[['Subtotal',money(q.subtotalCents)],['Desconto',money(q.discountCents)],[q.shippingLabel?'Frete '+escape(q.shippingLabel):'Frete',money(q.shippingCents)],['Total',money(q.totalCents)]];
  return '<section><h2>Resumo</h2><ul>'+q.lines.map(l=>'<li>'+l.quantity+' × '+escape(l.name)+' · '+money(l.unitCents*l.quantity)+'</li>').join('')+'</ul><dl>'+data.map(([k,v])=>'<div><dt>'+k+'</dt><dd>'+v+'</dd></div>').join('')+'</dl>'+(Number.isInteger(q.deliveryDays)&&q.deliveryDays>0?'<p>Entrega estimada em '+q.deliveryDays+' dias úteis após a aprovação.</p>':'')+'</section>';
}
export function checkoutPage(order,message='',sandbox=false,location='') {
  let content=message?'<p role="alert">'+escape(message)+'</p>':'';
  if(order) {
    content+='<small>Pedido '+escape(order.id)+'</small><h1>'+labels[order.state]+'</h1>'+summary(order);
    if(order.state==='draft') content+='<p><a href="/checkout/">Ir para o checkout</a></p>';
    if(['sending','pending'].includes(order.state)) content+='<p><a href="'+escape(location)+'">Atualizar situação do pagamento</a></p>';
    if(order.state==='sending') content+='<p>O pedido está reservado enquanto consultamos a confirmação. Guarde este link.</p>';
  } else content='<h1>Consulta de pedido</h1>'+content;
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Seu pedido | Felipe Modas</title><style>'+css+'</style></head><body><header><a href="/">Felipe Modas</a><a href="/">Voltar à loja</a></header><main>'+(sandbox?'<p>Ambiente de homologação · pedidos de teste.</p>':'')+content+'<p><a href="mailto:felipemodas.atendimento.rj@gmail.com">Falar com o atendimento</a></p></main></body></html>';
}
