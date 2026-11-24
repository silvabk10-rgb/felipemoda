import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,rm,readFile,writeFile,cp,copyFile,readdir,access,realpath,open} from 'node:fs/promises';
import {buildStore,adaptLegacy,normalizeProducts} from './store/build.mjs';
import {buildInstitutional,company} from './institucional/build.mjs';
import {makeLayout} from './theme/layout.mjs';
import {artworks} from './theme/campaigns.mjs';
import {home} from './theme/home.mjs';
import {campaign,shippingRates} from './commerce/config.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));

const priceApproved=value=>Number.isSafeInteger(value)&&value>0;

function photoFormat(bytes) {
  if (bytes.subarray(0,3).equals(Buffer.from([255,216,255]))) return 'jpeg';
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR') return 'png';
  if (bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' && ['VP8 ','VP8L','VP8X'].includes(bytes.toString('ascii',12,16))) return 'webp';
  if (['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) return 'gif';
  if (bytes.toString('ascii',4,8)==='ftyp') {
    const end=Math.min(bytes.readUInt32BE(0),bytes.length);
    for(let i=8;i+4<=end;i+=4) {
      if (i!==12 && ['avif','avis'].includes(bytes.toString('ascii',i,i+4))) return 'avif';
    }
  }
  return '';
}

async function validatePhoto(siteRoot,photo,sku) {
  const src=typeof photo==='string'?photo:photo?.src;
  const prefix='/assets/products/';
  const fail=()=>new Error('Confira a foto local de '+sku+': '+String(src));
  if(typeof src!=='string' || !src.startsWith(prefix)) throw fail();
  const parts=src.slice(prefix.length).split('/');
  if(parts.some(part=>!/^[-a-z0-9_+.~]+$/i.test(part)||part==='.'||part==='..')) throw fail();
  const base=path.join(await realpath(siteRoot),'assets','products');
  const resolved=await realpath(path.join(base,...parts));
  if(!resolved.startsWith(base+path.sep)) throw fail();
  const file=await open(resolved,'r');
  try {
    const stat=await file.stat();
    if(!stat.isFile()||stat.size<16) throw fail();
    const header=Buffer.alloc(128);
    const {bytesRead}=await file.read(header,0,header.length,0);
    const format=photoFormat(header.subarray(0,bytesRead));
    const extension=path.extname(src).slice(1).toLowerCase();
    const expected=({jpg:'jpeg',jpe:'jpeg',jpeg:'jpeg',png:'png',webp:'webp',avif:'avif',gif:'gif'})[extension];
    if(!format || (expected && expected!==format)) throw fail();
  } finally {
    await file.close();
  }
}

export async function prepareCatalogue(catalogue,{siteRoot,production,company,shippingRates,mode}) {
  const published=catalogue.filter(p=>p.status==='active'||p.status==='listed');
  for(const p of published) {
    if(!Array.isArray(p.images)||!p.images.length) throw new Error('Confira a galeria própria de '+p.sku);
    await Promise.all(p.images.map(img=>validatePhoto(siteRoot,img,p.sku)));
    if(p.status==='listed') {
      if(!priceApproved(p.priceCents)) throw new Error('Confira o preço próprio de '+p.sku);
    } else {
      if(!p.variants?.length || !p.variants.every(v=>Number.isSafeInteger(v.stock)&&v.stock>=0&&priceApproved(v.priceCents??p.priceCents))) throw new Error('Confira as variantes de '+p.sku);
    }
  }
  if(production && (!company.legalName||!company.address||!published.length)) {
    throw new Error('Publicação da vitrine pendente. Confira o cadastro da empresa e os produtos com fotos e preços aprovados.');
  }
  const selected=production?published:catalogue;
  const products=selected.map(({source,pricingProposal,...p})=>({
    ...p,isNew:p.isNew??true,
    variants:p.status==='active'?p.variants:(p.variants??[]).map(v=>({...v,stock:null})),
    displaySizes:p.status==='active'?[]:source?.supplierSizes,
    displayColors:p.status==='active'?[]:source?.supplierColors
  }));
  const expectedMode=production?'live':'sandbox';
  const checkoutEnabled=mode===expectedMode && shippingRates.length>0;
  return {products,checkoutEnabled};
}

async function build() {
  const outDir=path.join(root,'dist');
  const production=process.env.CONTEXT==='production';
  const origin=production?'https://felipemodasbr.com':process.env.DEPLOY_PRIME_URL || 'https://felipemodasbr.com';
  const catalogue=JSON.parse(await readFile(path.join(root,'data/curadoria.json'),'utf8'));
  const {products,checkoutEnabled}=await prepareCatalogue(catalogue,{siteRoot:root,production,company,shippingRates,mode:process.env.FM_COMMERCE_MODE});
  const old=await readFile(path.join(root,'catalogo.js'),'utf8');
  const archive=JSON.parse(old.replace(/^\s*const\s+catalogo\s*=\s*/,'').replace(/;\s*$/,''));
  await rm(outDir,{force:true,recursive:true});
  await mkdir(outDir,{recursive:true});
  if (/^[a-f0-9]{40}$/i.test(process.env.COMMIT_REF ?? '')) {
    await writeFile(path.join(outDir,'versao.txt'),process.env.COMMIT_REF.toLowerCase()+'\n');
  }
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
    buildStore({outDir,products,layout,banners:headers,legacyCatalog:adaptLegacy(archive),shippingRates,checkoutEnabled,couponEnabled:campaignActive,origin:'https://felipemodasbr.com'}),
    buildInstitutional({outDir,layout,checkoutEnabled,shippingRates,remotePhotos:false,products})
  ]);
  await writeFile(path.join(outDir,'index.html'),layout({title:'Felipe Modas',path:'/',description:'Conheça a seleção de vestidos, conjuntos e calças femininas da Felipe Modas.',body:home(normalizeProducts(products),campaignActive?campaign:null)}));
  await writeFile(path.join(outDir,'404.html'),layout({title:'Página não encontrada',path:'/404.html',description:'Volte à coleção da Felipe Modas.',body:'<section class="fm-notfound"><h1>Página não encontrada</h1><p>Explore a coleção ou procure a peça pelo nome.</p><a class="fm-cta" href="/busca/">Buscar uma peça</a></section>'}));
  const sitemap=['/',...store,...info].filter(p=>!['/busca/','/favoritos/','/sacola/','/checkout/','/politicas.html'].includes(p));
  await writeFile(path.join(outDir,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+sitemap.map(p=>'<url><loc>https://felipemodasbr.com'+p+'</loc></url>').join('')+'</urlset>');
  await writeFile(path.join(outDir,'robots.txt'),production?'User-agent: *\nDisallow: /sacola/\nDisallow: /checkout/\nDisallow: /favoritos/\nDisallow: /.netlify/\nSitemap: https://felipemodasbr.com/sitemap.xml\n':'User-agent: *\nDisallow: /\n');
  console.log('Felipe Modas — '+(production?'produção':'prévia')+', '+products.length+' fichas, '+archive.length+' referências anteriores, '+(store.length+info.length+2)+' páginas.');
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) await build();
