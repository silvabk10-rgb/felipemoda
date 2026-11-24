import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {normalizeProducts,categoryLabels,productURL,inCategory,canBuy} from './core.mjs';
import {listPage,productPage,cartPage} from './views.mjs';
export {renderCard,normalizeProducts,adaptLegacy,productURL} from './core.mjs';
const from = fileURLToPath(new URL('.',import.meta.url));
const defaults={measures:'/guia-de-medidas/',returns:'/trocas-e-devolucoes/',contact:'/atendimento/'};
export async function buildStore({outDir,products:raw,layout,banners={},links={},couponEnabled=false,legacyCatalog=[],origin='https://felipemodasbr.com'}) {
  const products=normalizeProducts(raw);
  const urls=[];
  const paths={...defaults,...links};
  async function page(route,title,desc,body,head=''){
    const dest=path.join(outDir,route,'index.html');
    await mkdir(path.dirname(dest),{recursive:true});
    await writeFile(dest,await layout({title,description:desc,canonical:origin+route,path:route,body,head}));
    urls.push(route);
  }
  await mkdir(path.join(outDir,'store'),{recursive:true});
  await Promise.all(['core.mjs','views.mjs','store.js','store.css'].map(f=>copyFile(path.join(from,f),path.join(outDir,'store',f))));
  const legacy = normalizeProducts(legacyCatalog);
  // Keep migration lookups off page payloads, fetched only when an old bag exists.
  await writeFile(path.join(outDir,'store','legacy.json'),JSON.stringify(legacy.map(p=>({id:p.id,name:p.name,variants:p.variants.map(({id,label})=>({id,label}))}))));
  await writeFile(path.join(outDir,'store','catalog.json'),JSON.stringify({products,links:paths,couponEnabled:couponEnabled===true}));
  for (const slug of new Set(['todas','vestidos','conjuntos','calcas','novidades',...products.map(p=>p.category)])){
    const items=products.filter(p=>inCategory(p,slug));
    const title=categoryLabels[slug] || items[0]?.categoryName || slug;
    await page('/colecao/'+slug+'/',title,'Conheça '+title.toLocaleLowerCase('pt-BR')+' na Felipe Modas.',listPage({slug,products:items,title,banner:banners[slug]}));
  }
  for(const p of products){
    const related=products.filter(other=>other.id!==p.id && other.category===p.category).slice(0,4);
    const structured={'@context':'https://schema.org','@type':'Product',name:p.name,url:origin+productURL(p),brand:{'@type':'Brand',name:'Felipe Modas'}};
    if(p.sku) structured.sku=p.sku;
    if(p.summary || p.description) structured.description=p.summary || p.description;
    if(p.images.length) structured.image=p.images.map(i=>origin+i.src);
    const commercial=p.variants.filter(v=>v.priceCents!==null && v.stock!==null);
    if(commercial.length) structured.offers=commercial.map(v=>({'@type':'Offer',sku:v.id,url:structured.url,priceCurrency:'BRL',price:(v.priceCents/100).toFixed(2),availability:'https://schema.org/'+(canBuy(v)?'InStock':'OutOfStock')}));
    const ld='<script type="application/ld+json">'+JSON.stringify(structured).replace(/</g,'\\u003c')+'</script>';
    await page(productURL(p),p.name,p.summary || p.description || 'Confira os detalhes de '+p.name+' na Felipe Modas.',productPage(p,related,paths),ld);
  }
  await page('/busca/','Busca','Busque roupas por modelo, categoria, tamanho e cor na Felipe Modas.',listPage({products,title:'Busca',search:true}));
  await page('/favoritos/','Favoritos','Acesse as peças que você guardou na Felipe Modas.',listPage({products,title:'Seus favoritos',favorites:true}));
  await page('/sacola/','Sacola','Confira os itens e as quantidades da sua sacola.',cartPage());
  return urls;
}
