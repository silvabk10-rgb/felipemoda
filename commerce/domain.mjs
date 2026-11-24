import { createHmac, timingSafeEqual } from 'node:crypto';

export class CommerceError extends Error {
  constructor(code, message, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export function reject(code, message, status) {
  throw new CommerceError(code, message, status);
}

export const fingerprint = (key, value) => createHmac('sha256', key).update(value).digest('base64url');
export const normalizeEmail = value => String(value ?? '').trim().toLowerCase();
export const emailValid = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const freshLedger = () => ({ version: 1, orders: {} });

export function normalizeCep(value) {
  const cep = String(value ?? '').trim().replace(/^(\d{5})-(\d{3})$/, '$1$2');
  if (!/^\d{8}$/.test(cep) || cep === '00000000') reject('cep', 'Informe um CEP válido com oito dígitos.');
  return cep;
}

export function normalizeRequest(input) {
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) reject('items', 'Confira os itens da sua sacola.');
  const quantities = new Map();
  for (const item of input.items) {
    if (!item || typeof item.variantId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,119}$/i.test(String(item.variantId ?? '')) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) reject('quantity', 'Confira a variante e a quantidade de cada peça.');
    const quantity = (quantities.get(item.variantId) ?? 0) + item.quantity;
    if (quantity > 99) reject('quantity', 'A quantidade máxima por variante é 99.');
    quantities.set(item.variantId, quantity);
  }
  const items = [...quantities].sort(([a],[b]) => a.localeCompare(b)).map(([variantId,quantity]) => ({variantId,quantity}));
  const cep = normalizeCep(input.cep);
  const coupon = String(input.coupon ?? '').trim().toUpperCase();
  if (coupon.length > 40) reject('coupon', 'Confira o código do cupom.');
  const shippingMethod = input.shippingMethod;
  if (shippingMethod !== undefined && !['pac','sedex'].includes(shippingMethod)) reject('shipping_method','Selecione PAC ou SEDEX.');
  return shippingMethod === undefined ? {items,cep,coupon} : {items,cep,coupon,shippingMethod};
}

export function abandonedBeforeDispatch(order,now) {
  return order.dispatchVersion===2 && order.state==='sending' && !order.gatewaySentAt && !order.providerId &&
    now-(order.dispatchedAt??order.submittedAt)>60000;
}

const committed = new Set(['sending','pending','paid','refunded','partially_refunded','disputed']);
export function calculate(input, ledger, cfg, buyer = {}, ignoreId) {
  const others = Object.values(ledger.orders).filter(order => order.id !== ignoreId && committed.has(order.state) && !abandonedBeforeDispatch(order,cfg.now()));
  const lines = input.items.map(({variantId, quantity}) => {
    const item = cfg.stock.get(variantId);
    if (!item) reject('unavailable', 'Esta variante ainda não está disponível para compra.', 409);
    const used = others.reduce((sum,order) => sum + (order.quote.lines.find(line => line.variantId === variantId)?.quantity ?? 0), 0);
    if (quantity > item.stock - used) reject('stock', 'A quantidade solicitada já não está disponível.', 409);
    return {variantId, quantity, name:item.name, unitCents:item.priceCents};
  });
  normalizeCep(input.cep);
  const rate = cfg.rates.find(row => row.id === (input.shippingMethod ?? 'pac'));
  if (!rate || !Number.isSafeInteger(rate.priceCents) || rate.priceCents < 0) {
    reject('shipping', 'A modalidade de entrega selecionada está indisponível.', 409);
  }
  const subtotalCents = lines.reduce((sum,line) => sum + line.unitCents * line.quantity, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 999999999) reject('amount', 'O valor do pedido ultrapassa o limite para esta compra.');
  let discountCents = 0;
  const camp = cfg.campaign;
  if (input.coupon) {
    if (!camp.enabled || input.coupon !== camp.code || !Number.isInteger(camp.percent) || camp.percent < 1 || camp.percent >= 100) reject('coupon', 'Cupom inválido.');
    const now = cfg.now();
    if ((camp.startsAt && now < Date.parse(camp.startsAt)) || (camp.endsAt && now >= Date.parse(camp.endsAt))) reject('coupon', 'Cupom fora do período de validade.');
    if (camp.firstPurchaseOnly && !buyer.emailKey) reject('email', 'Informe seu e-mail para verificar o cupom.');
    if (camp.firstPurchaseOnly && others.some(order =>
      (order.buyer?.emailKey === buyer.emailKey || (buyer.documentKey && buyer.documentKey === order.buyer?.documentKey))
      && (['paid','refunded','partially_refunded','disputed'].includes(order.state) || Boolean(order.input.coupon))
    )) reject('ineligible', 'O cupom não está disponível para esta compra.');
    discountCents = Math.round(subtotalCents * camp.percent / 100);
  }
  const totalCents = subtotalCents - discountCents + rate.priceCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 1 || totalCents > 999999999) reject('amount', 'Confira os valores da compra.');
  return {lines,subtotalCents,discountCents,shippingCents:rate.priceCents,totalCents,deliveryDays:null,shippingMethod:rate.id,shippingLabel:rate.label};
}

export function checkoutIdentity(key, secret) {
  if (typeof key !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(key)) reject('idempotency', 'Atualize a sacola para iniciar seu pedido.');
  const id = 'fm_' + fingerprint(secret, 'order:' + key).slice(0,26);
  return {id, token: id + '.' + fingerprint(secret, 'access:' + id)};
}

export function readToken(token, secret) {
  const match = /^(fm_[\w-]{26})\.([\w-]{43})$/.exec(token ?? '');
  if (!match || !timingSafeEqual(Buffer.from(fingerprint(secret, 'access:' + match[1])), Buffer.from(match[2]))) reject('access', 'O link deste pedido é inválido.', 404);
  return match[1];
}

export function begin(ledger, input, emailKey, id, cfg) {
  const signature = fingerprint(cfg.secret, JSON.stringify([input, emailKey]));
  const existing = ledger.orders[id];
  if (existing) {
    if (existing.signature !== signature) reject('conflict','A sacola mudou. Inicie uma nova finalização.',409);
    return existing;
  }
  for (const draft of Object.values(ledger.orders)) {
    if (abandonedBeforeDispatch(draft,cfg.now())) draft.state='canceled';
    if (draft.state === 'draft' && cfg.now() - draft.createdAt > 24*60*60*1000) delete ledger.orders[draft.id];
  }
  const quote = calculate(input, ledger, cfg, {emailKey});
  const order = {id,signature,input,quote,state:'draft',createdAt:cfg.now(),buyer:{emailKey}};
  ledger.orders[id] = order;
  return order;
}

export function reserve(ledger,id,buyer,detailsHash,cfg) {
  for(const other of Object.values(ledger.orders)) {
    if(abandonedBeforeDispatch(other,cfg.now())) other.state='canceled';
  }
  const order = ledger.orders[id];
  if (!order) reject('missing','Pedido não encontrado.',404);
  if (order.state !== 'draft') {
    if (order.detailsHash !== detailsHash) reject('conflict','O pedido já foi iniciado com outros dados.',409);
    return order;
  }
  if (cfg.now() > order.createdAt + 30*60*1000) reject('expired','O prazo desta sacola terminou. Volte à loja para atualizar os valores.',409);
  if (order.input.coupon && order.buyer.emailKey !== buyer.emailKey) reject('email','Informe o mesmo e-mail usado no cupom.');
  const oldQuote = order.quote;
  const legacy = !oldQuote.shippingMethod && !order.input.shippingMethod;
  // Pedidos abertos antes das modalidades nacionais conservam o frete cotado até o vencimento.
  const effective = legacy ? {...cfg,rates:[{id:'pac',label:'Entrega',priceCents:oldQuote.shippingCents}]} : cfg;
  const fresh = calculate(order.input, ledger, effective, buyer, id);
  const changed = ['subtotalCents','shippingCents','discountCents','totalCents'].some(key => fresh[key] !== oldQuote[key])
    || JSON.stringify(fresh.lines) !== JSON.stringify(oldQuote.lines)
    || (!legacy && fresh.shippingMethod !== oldQuote.shippingMethod);
  if (changed) reject('changed','Os valores ou as condições mudaram. Confira a sacola novamente.',409);
  const quote = legacy ? oldQuote : fresh;
  Object.assign(order,{quote,buyer,detailsHash,state:'sending',submittedAt:cfg.now()});
  return order;
}
