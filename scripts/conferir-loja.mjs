import {readFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {shippingRates} from '../commerce/config.mjs';
import archive from '../catalogo.js';
import {archiveProducts} from '../data/acervo-loja.mjs';
import {legacyCategoryLabels} from '../data/categorias-legado.mjs';
import {esc} from '../store/core.mjs';

const origin = 'https://felipemodasbr.com';
const exporter = '/institucional/tabela-canvas.mjs';
const checkoutClient = '/store/checkout-client.mjs';
const commerce = '/.netlify/functions/commerce';
const archiveById = new Map(archiveProducts.map(p=>[p.id,p]));
function check(ok, message) {
  if (!ok) throw new Error(message);
}

function checkArchive(liveBySlug) {
  const groups = new Map();
  for (const original of archive) {
    const approved=archiveById.get(original.id), p=liveBySlug.get(original.id);
    check(approved && p?.id===original.id && p.category===approved.category && p.status===approved.status,
      'Estado ou categoria incorreta no acervo: '+original.id);
    check(p.variants.length===original.variants.length && p.priceCents===Math.min(...original.variants.map(v=>v.price)),
      'Grade ou preço incorreto no acervo: '+p.slug);
    const variants=new Map(p.variants.map(v=>[v.id,v]));
    for (const [i,entry] of original.variants.entries()) {
      const v=variants.get(String(entry.id)), expected=approved.variants[i];
      check(v && v.label===entry.label && v.color===expected.color && v.size===expected.size &&
        v.stock===expected.stock && v.priceCents===(p.status==='active'?entry.price:null),
        'Variante histórica divergente: '+entry.id);
    }
    check(p.images?.[0]?.src==='/assets/products/acervo/'+p.slug+'.webp', 'Foto incorreta no catálogo: '+p.slug);
    if (!groups.has(p.category)) groups.set(p.category,[]);
    groups.get(p.category).push(p);
  }
  check(Object.keys(legacyCategoryLabels).every(c=>groups.has(c)), 'Categoria histórica ausente do catálogo.');
  return groups;
}

export async function waitForStore({commit, guideSlugs, catalogueSlugs=guideSlugs, fetcher=fetch, timeoutMs=300_000, retryMs=10_000}) {
  check(/^[0-9a-f]{40}$/.test(commit ?? ''), 'Informe o SHA completo do push.');
  check(guideSlugs.length > 0 && new Set(guideSlugs).size === guideSlugs.length &&
    guideSlugs.every(s=>typeof s==='string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)), 'Grade de URLs inválida no catálogo.');
  const deadline = Date.now() + timeoutMs;
  const samples = [...new Set([guideSlugs[0],guideSlugs.at(-1)])];
  const expectedSlugs = new Set([...catalogueSlugs,...archive.map(p=>p.id)]);
  const verifiedPhotos = new Set();
  async function responseFor(path, mime, body, headers) {
    check(!body || path===commerce && ['methods','quote'].includes(body.action), 'Operação de conferência inválida.');
    const response = await fetcher(origin + path, {
      method:body ? 'POST' : 'GET', credentials:'omit', redirect:'error', cache:'no-store',headers,
      ...(body ? {headers:{'Content-Type':'application/json', Origin:origin}, body:JSON.stringify(body)} : {}),
      signal:AbortSignal.timeout(Math.max(1, Math.min(10_000, deadline-Date.now())))
    });
    const route = path.split('?')[0];
    const validType = mime.test(response.headers.get('content-type') || '');
    if (!response.ok || !validType) {
      await response.body?.cancel();
      check(response.ok, route + ' retornou HTTP ' + response.status);
      check(validType, 'Tipo de conteúdo incorreto em ' + route);
    }
    return response;
  }
  async function read(path,mime,body) {
    return (await responseFor(path,mime,body)).text();
  }
  async function json(path,body) {
    const text=await read(path,/application\/json/i,body);
    try { return JSON.parse(text); } catch { throw new Error('Resposta JSON inválida em '+path); }
  }
  async function release() {
    const published = await read('/versao.txt?verificar=' + Date.now(), /text\/plain/i);
    check(published.trim() === commit, 'Aguardando o commit do push em /versao.txt');
  }
  async function quoteVariant(variant,rate) {
    const quote=await json(commerce,{action:'quote',items:[{variantId:variant.id,quantity:1}],cep:'01001000',shippingMethod:rate.id});
    check(quote.ok && quote.shippingMethod===rate.id && quote.subtotalCents===variant.priceCents &&
      quote.discountCents===0 && quote.shippingCents===rate.priceCents && quote.totalCents===variant.priceCents+rate.priceCents,
      'Cotação divergente para '+rate.label+' na variante '+variant.id);
  }
  async function archivePhoto(path) {
    if (verifiedPhotos.has(path)) return;
    const response=await responseFor(path,/^image\/webp\b/i,null,{Range:'bytes=0-15'});
    const reader=response.body.getReader(), prefix=Buffer.alloc(16);
    let length=0;
    try {
      while (length<prefix.length) {
        const {value,done}=await reader.read();
        if (done) break;
        const chunk=value.subarray(0,prefix.length-length);
        prefix.set(chunk,length);
        length+=chunk.length;
      }
    } finally { await reader.cancel(); }
    check(length===16 && prefix.toString('ascii',0,4)==='RIFF' && prefix.toString('ascii',8,12)==='WEBP' &&
      ['VP8 ','VP8L','VP8X'].includes(prefix.toString('ascii',12,16)), 'Assinatura WebP inválida em '+path);
    verifiedPhotos.add(path);
  }
  async function archiveCategory(category,products) {
    const list=await read('/colecao/'+category+'/',/text\/html/i);
    const product=products.find(p=>list.includes('href="/produto/'+p.slug+'/"'));
    check(list.includes('data-list="'+category+'"') && product,'Vitrine do acervo ausente em '+category);
    const page=await read('/produto/'+product.slug+'/',/text\/html/i);
    const photo=product.images[0].src;
    check(page.includes('data-pdp="'+product.id+'"') && page.includes('src="'+photo+'"'), 'Ficha ou foto incorreta: '+product.slug);
    const variant=product.variants.find(v=>v.stock>0);
    if (variant) {
      check(page.includes('data-buybox="'+product.id+'"') && page.includes('name="color" value="'+esc(variant.color)+'"') &&
        page.includes('name="size" value="'+esc(variant.size)+'"'), 'Seleção de cor ou tamanho ausente: '+product.slug);
      await quoteVariant(variant,shippingRates.find(r=>r.id==='pac'));
    } else {
      check(!page.includes('data-buybox=') && page.includes('class="st-model"'), 'Grade informativa incorreta: '+product.slug);
    }
  }
  async function archivePhotos(paths) {
    const pending = paths.filter(path=>!verifiedPhotos.has(path));
    let cursor = 0;
    const errors = [];
    await Promise.all(Array.from({length:Math.min(8,pending.length)}, async ()=>{
      while (cursor<pending.length && Date.now()<deadline) {
        const path=pending[cursor++];
        try { await archivePhoto(path); }
        catch (error) { errors.push(error.message); }
      }
    }));
    check(verifiedPhotos.size===paths.length, 'Fotos do acervo verificadas: '+verifiedPhotos.size+
      '/'+paths.length+(errors.length?' | '+errors.slice(0,4).join(' | '):''));
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
    const liveBySlug = new Map(Array.isArray(live) ? live.map(p=>[p.slug,p]) : []);
    check(live?.length===liveBySlug.size && liveBySlug.size===expectedSlugs.size &&
      [...expectedSlugs].every(s=>liveBySlug.has(s)), 'Catálogo público incompleto ou com modelos duplicados.');
    const groups=checkArchive(liveBySlug);
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
    const methods=await json(commerce,{action:'methods'});
    check(methods.ok && methods.environment==='live' && methods.cardEnabled===true &&
      Array.isArray(methods.paymentMethods) && methods.paymentMethods.length===1 && methods.paymentMethods[0]==='card',
      'Cartão de crédito indisponível em produção.');
    const curatedVariant=guideSlugs.map(s=>liveBySlug.get(s)).filter(p=>p.status==='active').flatMap(p=>p.variants).find(v=>v.stock>0);
    check(curatedVariant, 'Curadoria sem variante para conferir a cotação.');
    await Promise.all(shippingRates.map(rate=>quoteVariant(curatedVariant,rate)));
    await Promise.all([...groups].map(([category,products])=>archiveCategory(category,products)));
    return {productCount:live.length,photoPaths:archive.map(p=>liveBySlug.get(p.id).images[0].src)};
  }
  let lastError, verifiedPages;
  do {
    try {
      await release();
      verifiedPages ??= await pages();
      await archivePhotos(verifiedPages.photoPaths);
      await release();
      console.log('Produção conferida em '+commit.slice(0,12)+': '+verifiedPages.productCount+' produtos, '+guideSlugs.length+' tabelas, '+verifiedPhotos.size+' fotos do acervo, fichas, cartão e cotações PAC/SEDEX.');
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
  const published=catalogue.filter(p=>p.status==='active' || p.status==='listed');
  const guideSlugs=published.filter(p=>p.measurements?.length || Object.keys(p.sizeGuide ?? {}).length || p.measurementNote?.trim()).map(p=>p.slug);
  await waitForStore({commit:process.env.GITHUB_SHA,guideSlugs,catalogueSlugs:published.map(p=>p.slug)});
}
