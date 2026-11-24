import {readFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {shippingRates} from '../commerce/config.mjs';

const origin = 'https://felipemodasbr.com';
const exporter = '/institucional/tabela-canvas.mjs';
const checkoutClient = '/store/checkout-client.mjs';
const commerce = '/.netlify/functions/commerce';
function check(ok, message) {
  if (!ok) throw new Error(message);
}

export async function waitForStore({commit, guideSlugs, fetcher=fetch, timeoutMs=300_000, retryMs=10_000}) {
  check(/^[0-9a-f]{40}$/.test(commit ?? ''), 'Informe o SHA completo do push.');
  check(guideSlugs.length > 0 && new Set(guideSlugs).size === guideSlugs.length &&
    guideSlugs.every(s=>typeof s==='string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)), 'Grade de URLs inválida no catálogo.');
  const deadline = Date.now() + timeoutMs;
  const samples = [...new Set([guideSlugs[0],guideSlugs.at(-1)])];
  async function read(path, mime, body) {
    check(!body || path===commerce && ['methods','quote'].includes(body.action), 'Operação de conferência inválida.');
    const response = await fetcher(origin + path, {
      method:body ? 'POST' : 'GET', credentials:'omit', redirect:'error', cache:'no-store',
      ...(body ? {headers:{'Content-Type':'application/json', Origin:origin}, body:JSON.stringify(body)} : {}),
      signal:AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline-Date.now())))
    });
    check(response.ok, path.split('?')[0] + ' retornou HTTP ' + response.status);
    check(mime.test(response.headers.get('content-type') || ''), 'Tipo de conteúdo incorreto em ' + path.split('?')[0]);
    return response.text();
  }
  async function json(path,body) {
    const text=await read(path,/application\/json/i,body);
    try { return JSON.parse(text); } catch { throw new Error('Resposta JSON inválida em '+path); }
  }
  async function release() {
    const published = await read('/versao.txt?verificar=' + Date.now(), /text\/plain/i);
    check(published.trim() === commit, 'Aguardando o commit do push em /versao.txt');
  }
  async function quotations(live) {
    const methods=await json(commerce,{action:'methods'});
    check(methods.ok && methods.environment==='live' && methods.cardEnabled===true &&
      Array.isArray(methods.paymentMethods) && methods.paymentMethods.length===1 && methods.paymentMethods[0]==='card',
      'Cartão de crédito indisponível em produção.');
    const variant=live.filter(p=>p.status==='active').flatMap(p=>p.variants).find(v=>v?.stock>0 && Number.isSafeInteger(v.priceCents) && v.priceCents>0);
    check(variant, 'Catálogo público sem variante para conferir a cotação.');
    await Promise.all(shippingRates.map(async rate=>{
      const quote=await json(commerce,{action:'quote',items:[{variantId:variant.id,quantity:1}],cep:'01001000',shippingMethod:rate.id});
      check(quote.ok && quote.shippingMethod===rate.id && quote.subtotalCents===variant.priceCents &&
        quote.discountCents===0 && quote.shippingCents===rate.priceCents && quote.totalCents===variant.priceCents+rate.priceCents,
        'Cotação divergente para '+rate.label);
    }));
  }
  async function pages() {
    const [home,catalog,guide,js,checkout,client,...pdps] = await Promise.all([
      read('/',/text\/html/i), json('/store/catalog.json'),
      read('/guia-de-medidas/',/text\/html/i), read(exporter,/javascript|ecmascript/i),
      read('/checkout/',/text\/html/i), read(checkoutClient,/javascript|ecmascript/i),
      ...samples.map(slug=>read('/produto/'+slug+'/',/text\/html/i))
    ]);
    check(home.includes('data-hero') && home.includes('href="/guia-de-medidas/"'), 'Home sem vitrine ou link ao guia.');
    const live = catalog.products;
    const liveSlugs = new Set(Array.isArray(live) ? live.map(p=>p.slug) : []);
    check(Array.isArray(live) && live.length === liveSlugs.size && guideSlugs.every(s=>liveSlugs.has(s)), 'Catálogo público incompleto ou com modelos duplicados.');
    const sections = guide.match(/<section\b[^>]*\bdata-guia-modelo\b[^>]*>[\s\S]*?<\/section>/g) || [];
    check(sections.length === guideSlugs.length, 'Quantidade incorreta de tabelas no guia.');
    const models = new Map(sections.map(section=>[section.match(/\bdata-modelo-slug="([^"]+)"/)?.[1],section]));
    for (const slug of guideSlugs) {
      const model = models.get(slug) || '';
      check(model.includes('id="'+slug+'"') && model.includes('href="/produto/'+slug+'/"') &&
        model.match(/<table\b/g)?.length===1 && model.includes('data-baixar-tabela'), 'Tabela ou âncora ausente para ' + slug);
    }
    for (const [i,slug] of samples.entries()) {
      check(pdps[i].includes('data-pdp=') && pdps[i].includes('href="/guia-de-medidas/#'+slug+'"'), 'Ficha sem link para o modelo ' + slug);
    }
    check(guide.includes('src="'+exporter+'"') && js.includes('export function drawGuide'), 'Exportador PNG ausente no guia.');
    check(checkout.includes('data-zip-preview') && checkout.includes('data-preview-payment') &&
      checkout.includes('src="'+checkoutClient+'"') && ['PAC','SEDEX'].every(s=>checkout.includes('<dt>'+s+'</dt>')) &&
      client.includes('Cartão de crédito em 1 parcela'), 'Checkout público incompleto.');
    await quotations(live);
    return live.length;
  }
  let lastError;
  do {
    try {
      await release();
      const productCount=await pages();
      await release();
      console.log('Produção conferida em '+commit.slice(0,12)+': home, '+productCount+' produtos, '+guideSlugs.length+' tabelas, exportador PNG, fichas, cartão e cotações PAC/SEDEX.');
      return;
    } catch (error) {
      if (error.message !== lastError) console.log(error.message);
      lastError=error.message;
      await sleep(Math.max(0, Math.min(retryMs, deadline-Date.now())));
    }
  } while (Date.now() < deadline);
  throw new Error('A conferência da loja expirou. Último resultado: ' + lastError);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalogue = JSON.parse(await readFile(new URL('../data/curadoria.json',import.meta.url),'utf8'));
  const guideSlugs = catalogue.filter(p=>(p.status==='active' || p.status==='listed') &&
    (p.measurements?.length || Object.keys(p.sizeGuide ?? {}).length || p.measurementNote?.trim())).map(p=>p.slug);
  await waitForStore({commit:process.env.GITHUB_SHA,guideSlugs});
}
