import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,rm,readFile,writeFile,cp,copyFile,readdir,access} from 'node:fs/promises';
import {buildStore,adaptLegacy,normalizeProducts} from './store/build.mjs';
import {buildInstitutional,company} from './institucional/build.mjs';
import {makeLayout} from './theme/layout.mjs';
import {artworks} from './theme/campaigns.mjs';
import {home} from './theme/home.mjs';
import {campaign,shippingRates} from './commerce/config.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
const outDir=path.join(root,'dist');
const production=process.env.CONTEXT==='production';
const origin=production?'https://felipemodasbr.com':process.env.DEPLOY_PRIME_URL || 'https://felipemodasbr.com';
const catalogue=JSON.parse(await readFile(path.join(root,'data/curadoria.json'),'utf8'));
const active=catalogue.filter(p=>p.status==='active');
const checkoutEnabled=['sandbox','live'].includes(process.env.FM_COMMERCE_MODE) && active.length>0;
if(production && (!company.legalName||!company.address||!active.length||!shippingRates.length||process.env.FM_COMMERCE_MODE!=='live')){
  throw new Error('Publicação comercial pendente. Confira o cadastro da empresa, catálogo ativo, frete e homologação em docs/operacao.md e docs/comercio.md. Deploy Previews estão disponíveis.');
}
const selected=production?active:catalogue;
const products=selected.map(p=>({...p,isNew:p.isNew??true, displaySizes:p.status==='active'?[]:p.source?.supplierSizes,displayColors:p.status==='active'?[]:p.source?.supplierColors}));
for(const p of active){
  if(!p.images?.length||!p.variants?.length||!p.variants.every(v=>Number.isInteger(v.stock)&&v.stock>=0&&Number.isSafeInteger(v.priceCents??p.priceCents)&&(v.priceCents??p.priceCents)>0))throw new Error('Confira imagens locais e as variantes de '+p.sku);
  for(const i of p.images){if(!/^\/assets\/products\/[a-zA-Z0-9_./-]+$/.test(i.src)||i.src.includes('..'))throw new Error('Foto inválida em '+p.sku);await access(path.join(root,i.src));}
}
const old=await readFile(path.join(root,'catalogo.js'),'utf8');
const archive=JSON.parse(old.replace(/^\s*const\s+catalogo\s*=\s*/,'').replace(/;\s*$/,''));
await rm(outDir,{force:true,recursive:true});
await mkdir(outDir,{recursive:true});
async function copyFlat(folder,match){
  const dst=path.join(outDir,folder);await mkdir(dst,{recursive:true});
  for(const entry of await readdir(path.join(root,folder),{withFileTypes:true})){
    if(entry.isFile()&&match.test(entry.name))await copyFile(path.join(root,folder,entry.name),path.join(dst,entry.name));
  }
}
await Promise.all([copyFlat('assets/brand',/\.png$/),copyFlat('assets/campaign',/\.(webp|json)$/),copyFlat('theme',/^(site.css|site.js|campaigns.mjs)$/)]);
try{await access(path.join(root,'assets/products'));await cp(path.join(root,'assets/products'),path.join(outDir,'assets/products'),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
if(!production){
  await cp(path.join(root,'arte'),path.join(outDir,'arte'),{recursive:true,filter:file=>!file.endsWith('.md')});
  await copyFile(path.join(root,'assets/brand/atelier-canvas.html'),path.join(outDir,'arte/marca.html'));
}
const layout=makeLayout({origin,indexable:production});
const banner=a=>({desktop:'/assets/campaign/'+a.key+'-desktop.webp',mobile:'/assets/campaign/'+a.key+'-mobile.webp',alt:a.alt});
const headers=Object.fromEntries(artworks.filter(a=>a.key.startsWith('head-')).map(a=>[a.key.slice(5),banner(a)]));
headers.novidades=banner(artworks[0]);
const campaignActive=checkoutEnabled&&campaign.enabled&&(!campaign.startsAt||Date.now()>=Date.parse(campaign.startsAt))&&(!campaign.endsAt||Date.now()<=Date.parse(campaign.endsAt));
const [store,info]=await Promise.all([
  buildStore({outDir,products,layout,banners:headers,legacyCatalog:adaptLegacy(archive),couponEnabled:campaignActive,origin:'https://felipemodasbr.com'}),
  buildInstitutional({outDir,layout,checkoutEnabled,remotePhotos:false})
]);
await writeFile(path.join(outDir,'index.html'),layout({title:'Felipe Modas',path:'/',description:'Conheça a seleção de vestidos, conjuntos e calças femininas da Felipe Modas.',body:home(normalizeProducts(products),campaignActive?campaign:null)}));
await writeFile(path.join(outDir,'404.html'),layout({title:'Página não encontrada',path:'/404.html',description:'Volte à coleção da Felipe Modas.',body:'<section class="fm-notfound"><h1>Página não encontrada</h1><p>Explore a coleção ou procure a peça pelo nome.</p><a class="fm-cta" href="/busca/">Buscar uma peça</a></section>'}));
const sitemap=['/',...store,...info].filter(p=>!['/busca/','/favoritos/','/sacola/','/politicas.html'].includes(p));
await writeFile(path.join(outDir,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+sitemap.map(p=>'<url><loc>https://felipemodasbr.com'+p+'</loc></url>').join('')+'</urlset>');
await writeFile(path.join(outDir,'robots.txt'),production?'User-agent: *\nDisallow: /sacola/\nDisallow: /favoritos/\nDisallow: /.netlify/\nSitemap: https://felipemodasbr.com/sitemap.xml\n':'User-agent: *\nDisallow: /\n');
console.log('Felipe Modas — '+(production?'produção':'prévia')+', '+products.length+' fichas, '+archive.length+' referências anteriores, '+(store.length+info.length+2)+' páginas.');
