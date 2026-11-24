import {company, footerGroups} from '../institucional/build.mjs';
import {esc} from '../store/core.mjs';
import {legacyCategoryLabels} from '../data/categorias-legado.mjs';

const iconPaths = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bag:'<path d="M4.5 7.5h15l1 13h-17z M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/>',
  heart:'<path d="M20.5 5.3a5.3 5.3 0 0 0-7.5 0L12 6.4l-1.1-1.1a5.3 5.3 0 0 0-7.4 7.5L12 21l8.5-8.2a5.3 5.3 0 0 0 0-7.5z"/>',
  menu:'<path d="M3 7h18M3 12h12M3 17h18"/>',
  close:'<path d="m5 5 14 14M19 5 5 19"/>',
  arrow:'<path d="M3 12h17m-7-7 7 7-7 7"/>',
  back:'<path d="M21 12H4m7-7-7 7 7 7"/>',
  package:'<path d="m3 7 9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4m-9 4v10m-5-16 9 4"/>',
  measure:'<path d="m3 15 12-12 6 6L9 21z M13 5l3 3 M10 8l2 2 M7 11l3 3"/>',
  talk:'<path d="M21 11.5a9 9 0 0 1-13.5 7.8L3 21l1.3-4.5a9 9 0 1 1 16.7-5z"/>'
};
export const icon = name => '<svg class="fm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+iconPaths[name]+'</svg>';
function navLink(url,label,route) {
  return '<a href="'+esc(url)+'"'+(route===url?' aria-current="page"':'')+'>'+esc(label)+'</a>';
}
const collectionLink = (slug,label,route) => navLink('/colecao/'+slug+'/',label,route);
function navLinks(route,mobile=false) {
  const categories = Object.entries(legacyCategoryLabels)
    .sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
  const all = collectionLink('todas','Todas as peças',route);
  const group = '<details class="fm-collections"'+(mobile && route.startsWith('/colecao/')?' open':'')+'><summary>Categorias</summary><div class="fm-collection-links">'+
    all+categories.map(([slug,label])=>collectionLink(slug,label,route)).join('')+'</div></details>';
  const featured=mobile?'':['vestidos','conjuntos','calcas'].map(slug=>collectionLink(slug,legacyCategoryLabels[slug],route)).join('');
  return collectionLink('novidades','Novidades',route)+group+featured+navLink('/sobre/','A marca',route);
}
const routeLink=(url,label,glyph,extra='')=>'<a class="fm-tool" href="'+url+'" aria-label="'+label+'">'+icon(glyph)+extra+'</a>';
export function makeLayout({origin,indexable}){
  return ({title,description,path,body,head='',shareImage='/assets/campaign/hero-colecao-desktop.webp'}) => {
    const canonical='https://felipemodasbr.com'+path;
    const documentTitle=path==='/'?'Felipe Modas | Moda feminina':title+' | Felipe Modas';
    const footer=footerGroups.map(group=>'<section><h2>'+esc(group.title)+'</h2>'+group.links.map(l=>'<a href="'+l.href+'">'+esc(l.label)+'</a>').join('')+'</section>').join('');
    const personal=['/busca/','/sacola/','/favoritos/','/404.html'].includes(path);
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#faf8f1"><title>'+esc(documentTitle)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+canonical+'"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:title" content="'+esc(documentTitle)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+canonical+'"><meta property="og:image" content="'+esc(origin+shareImage)+'">'+(!indexable||personal?'<meta name="robots" content="noindex, nofollow">':'')+'<link rel="icon" href="/assets/brand/favicon.png"><link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png"><link rel="stylesheet" href="/theme/site.css"><link rel="stylesheet" href="/store/store.css"><script type="module" src="/theme/site.js"></script><script type="module" src="/store/store.js"></script>'+head+'</head><body><a class="fm-skip" href="#conteudo">Pular para o conteúdo</a><div class="fm-announcement">Estoque próprio <span aria-hidden="true">·</span> Peças à pronta entrega</div><header class="fm-header"><div class="fm-head-inner"><button class="fm-tool fm-menu" data-open-menu aria-label="Abrir menu" aria-haspopup="dialog">'+icon('menu')+'</button><a class="fm-logo" href="/" aria-label="Felipe Modas, início"><img src="/assets/brand/logo.png" alt="" width="200" height="48"></a><nav class="fm-nav" aria-label="Navegação principal">'+navLinks(path)+'</nav><div class="fm-tools">'+routeLink('/busca/','Buscar peças','search')+routeLink('/favoritos/','Meus favoritos','heart')+routeLink('/sacola/','Minha sacola','bag','<span data-cart-count>0</span>')+'</div></div></header><dialog id="menu-fm" aria-label="Menu da loja"><div class="fm-dialog-top"><img src="/assets/brand/logo.png" alt="Felipe Modas" width="156"><button class="fm-tool" data-close-menu aria-label="Fechar menu">'+icon('close')+'</button></div><nav aria-label="Menu principal">'+navLinks(path,true)+'<a href="/favoritos/">Meus favoritos</a><a href="/atendimento/">Atendimento</a></nav></dialog><main id="conteudo" tabindex="-1">'+body+'</main><footer class="fm-footer"><div class="fm-footer-inner"><div class="fm-footer-brand"><img src="/assets/brand/logo-light.png" alt="Felipe Modas" width="208" height="54"><p>Moda feminina · Brasil</p><a href="'+company.whatsAppUrl+'">'+company.whatsApp+'</a><a href="mailto:'+company.email+'">'+company.email+'</a></div>'+footer+'</div><div class="fm-bottom"><span>© '+esc(company.name)+'</span><div class="fm-seller"><span>Razão social '+esc(company.legalName)+' · CNPJ '+esc(company.cnpj)+'</span><address>Endereço cadastral · '+esc(company.address)+'</address></div></div></footer></body></html>';
  };
}
