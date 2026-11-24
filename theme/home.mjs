import {artworks} from './campaigns.mjs';
import {icon} from './layout.mjs';
import {renderCard,esc} from '../store/core.mjs';
const art = key => artworks.find(a => a.key===key);
export function picture(a,{priority=false,decorative=false}={}) {
  const base='/assets/campaign/'+a.key;
  return '<picture><source media="(max-width: 680px)" srcset="'+base+'-mobile.webp"><img src="'+base+'-desktop.webp" alt="'+(decorative?'':esc(a.alt))+'" '+(priority?'fetchpriority="high"':'loading="lazy"')+' decoding="async"></picture>';
}
function hero(items) {
  const descriptions=['Alfaiataria leve, tons de terra e silhuetas que acompanham o corpo.','Caimentos leves e linhas que se revelam a cada passo.','Peças que conversam entre si e abrem espaço para novas combinações.'];
  const panels=items.map((item,i)=>'<article class="fm-slide" data-slide '+(i?'hidden':'')+'>'+picture(item,{priority:!i})+'<div class="fm-hero-copy"><p class="fm-overline">'+esc(item.overline)+'</p><'+(i?'h2':'h1')+'>'+esc(item.title)+'</'+(i?'h2':'h1')+'><p class="fm-hero-desc">'+esc(descriptions[i])+'</p><a class="fm-cta" href="'+item.href+'">'+esc(item.cta)+icon('arrow')+'</a></div></article>').join('');
  return '<section class="fm-hero" data-hero aria-label="Campanhas da Felipe Modas" aria-roledescription="carrossel">'+panels+'<div class="fm-carousel-nav"><button data-prev aria-label="Campanha anterior">'+icon('back')+'</button><div class="fm-dots">'+items.map((_,i)=>'<button data-goto="'+i+'" aria-label="Mostrar campanha '+(i+1)+'" aria-pressed="'+(!i)+'"><span></span></button>').join('')+'</div><button data-next aria-label="Próxima campanha">'+icon('arrow')+'</button></div><span class="fm-sr" aria-live="polite" data-slide-status></span></section>';
}
function shelf(title,products,href){
  return '<section class="fm-wrap fm-section fm-shelf"><div class="fm-section-heading"><h2>'+title+'</h2><a class="fm-more" href="'+href+'">Ver todas '+icon('arrow')+'</a></div><div class="st-grid">'+products.map(renderCard).join('')+'</div></section>';
}
export function home(products,offer){
  const heroes=artworks.slice(0,3);
  if(offer) heroes[2]={...heroes[2],title:'Sua primeira escolha',overline:'Primeira compra',cta:'Usar '+offer.code,href:'/colecao/todas/'};
  const categories=artworks.slice(3,7).map(a=>'<a class="fm-cat" href="'+a.href+'">'+picture(a,{decorative:true})+'<div><h3>'+esc(a.title)+'</h3>'+icon('arrow')+'</div></a>').join('');
  const minis=artworks.slice(7,9).map(a=>'<a class="fm-mini" href="'+a.href+'">'+picture(a,{decorative:true})+'<div><p class="fm-overline">'+esc(a.overline)+'</p><h3>'+esc(a.title)+'</h3><span>'+esc(a.cta)+' '+icon('arrow')+'</span></div></a>').join('');
  const editorial=art('editorial');
  const featured=[products[0],products[4],products[8],products[3]].filter(Boolean);
  const secondary=[products[5],products[9],products[1],products[7]].filter(Boolean);
  return hero(heroes)+'<nav class="fm-utility" aria-label="Serviços">'+
  [['package','/entregas/','Entregas e frete'],['measure','/guia-de-medidas/','Guia de medidas'],['talk','/atendimento/','Fale com a loja']].map(([i,url,txt])=>'<a href="'+url+'">'+icon(i)+txt+'</a>').join('')+'</nav><section class="fm-wrap fm-section"><div class="fm-section-heading"><div><p class="fm-overline fm-accent">O guarda-roupa</p><h2>Explore as categorias</h2></div><a class="fm-more" href="/colecao/todas/">Ver coleção '+icon('arrow')+'</a></div><div class="fm-cat-grid">'+categories+'</div></section>'+shelf('Novidades',featured,'/colecao/novidades/')+'<div class="fm-minis fm-wrap">'+minis+'</div>'+shelf('Seleção Felipe Modas',secondary,'/colecao/todas/')+'<section class="fm-editorial">'+picture(editorial)+'<div><p class="fm-overline fm-accent">'+editorial.overline+'</p><h2>'+editorial.title+'</h2><p>Um vestido que resolve o dia. Um conjunto que ganha outra cara quando usado separado. É assim que escolhemos as peças da Felipe Modas.</p><a class="fm-more" href="/sobre/">'+editorial.cta+' '+icon('arrow')+'</a></div></section>';
}
