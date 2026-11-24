import {keys,load,save,readArray,bagRows,migrateBag,cartLines} from './bag.mjs';
import {commerceRequest as api} from './commerce-client.mjs';
import {esc,money,canBuy,renderCard,renderMedia,priceHTML,productURL,inCategory,filterProducts,fold} from './core.mjs';
import {buyBox,emptyState} from './views.mjs';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
let list=[],products,links,selectionLimit=32;
let parameters=new URLSearchParams(location.search);
const mainPage=$('[data-pdp]'), listing=$('[data-list]'), cartPage=$('[data-cart-page]');
function updateCount(){
  const bag=load(keys.bag,null);
  const count=(Array.isArray(bag)?bag:readArray(keys.old)).reduce((n,r)=>n+(Number.isSafeInteger(r?.quantity)&&r.quantity>0?r.quantity:0),0);
  $$('[data-cart-count]').forEach(el=>{el.textContent=String(count);});
}
function updateFavorites(){
  const fav=readArray(keys.favorites);
  $$('[data-favorite]').forEach(button=>{
    const state=fav.includes(button.dataset.favorite);
    const name=products?.get(button.dataset.favorite)?.name||'peça';
    button.setAttribute('aria-pressed',String(state));
    button.setAttribute('aria-label',state?'Remover '+name+' dos favoritos':'Salvar '+name+' nos favoritos');
  });
}
function changeFavorite(id){
  const old=readArray(keys.favorites);
  save(keys.favorites,old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  if(listing?.dataset.list==='favoritos') renderList();
  updateFavorites();
}
function storeBag(rows){save(keys.bag,rows);updateCount();}
function setDialog(dialog){
  const opener=document.activeElement;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>opener?.isConnected&&opener.focus({preventScroll:true}),{once:true});
  dialog.showModal();
}
function tempDialog(title,body,cls=''){
  const dialog=document.createElement('dialog');
  dialog.className='st-dialog '+cls;
  dialog.setAttribute('aria-label',title);
  dialog.innerHTML='<div class="st-dialog-head"><h2>'+esc(title)+'</h2><button type="button" data-close aria-label="Fechar">×</button></div>'+body;
  document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  setDialog(dialog);
  return dialog;
}
function selectedVariant(form,p){
  const data=new FormData(form);
  if(form.elements.variant)return p.variants.find(v=>v.id===data.get('variant'));
  if(form.elements.color && !data.get('color') || form.elements.size && !data.get('size'))return;
  return p.variants.find(v=>(!form.elements.color||v.color===data.get('color')) && (!form.elements.size||v.size===data.get('size')));
}
function refreshVariant(form,p){
  const v=selectedVariant(form,p);
  const color=form.elements.color?.value;
  for(const radio of $$('input[name="size"]',form)){
    const possible=p.variants.some(v=>(!color||v.color===color)&&v.size===radio.value&&canBuy(v));
    radio.parentElement.classList.toggle('st-choice-unavailable',!possible);
  }
  const ok=canBuy(v);
  const button=$('button[type="submit"]',form);
  button.disabled=!ok;
  form.elements.quantity.max=String(ok?Math.min(99,v.stock):99);
  if(ok && Number(form.elements.quantity.value)>v.stock)form.elements.quantity.value=String(Math.min(99,v.stock));
  const status=$('[data-selection]',form);
  status.textContent=ok?'Disponível para compra':v?'Esta combinação está indisponível.':'Selecione a variação para adicionar à sacola.';
  if(mainPage?.contains(form)){
    $('[data-pdp-price]',mainPage).innerHTML=v?.priceCents?esc(money(v.priceCents)):priceHTML(p);
    const index=p.images.findIndex(img=>img.color && color && fold(img.color)===fold(color));
    if(index>=0)selectPhoto(index);
    if($('[data-ship-message]'))$('[data-ship-message]').textContent='';
  }
}
function addItem(form){
  if(!form.reportValidity())return;
  const p=products.get(form.dataset.buybox),v=selectedVariant(form,p);
  if(!canBuy(v))return;
  const quantity=Number(form.elements.quantity.value);
  const rows=bagRows();
  const existing=rows.find(r=>r.product===p.id&&r.variant===v.id);
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity+(existing?.quantity||0)>Math.min(99,v.stock)){
    $('[data-buy-message]',form).textContent='A quantidade total da sacola supera o limite desta variação.';return;
  }
  if(existing)existing.quantity+=quantity;
  else rows.push({product:p.id,variant:v.id,quantity,name:p.name,label:v.label||[v.color,v.size].filter(Boolean).join(' / ')});
  storeBag(rows);
  form.closest('dialog')?.close();
  tempDialog('Adicionado à sacola','<p>'+esc(p.name)+' · '+esc(v.label||[v.color,v.size].filter(Boolean).join(' / '))+'</p><div class="st-dialog-actions"><a class="st-action" href="/sacola/">Ver sacola</a><button type="button" class="st-under" data-close>Continuar escolhendo</button></div>');
}
let photoIndex=0;
function selectPhoto(index){
  const p=products.get(mainPage?.dataset.pdp);
  if(!p?.images[index])return;
  photoIndex=index;
  const img=$('.st-main-media img');
  img.src=p.images[index].src;img.alt=p.images[index].alt;
  $$('[data-thumb]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.thumb)===index)));
  const color=fold(p.images[index].color);
  $$('[data-model-color]',mainPage).forEach(b=>b.setAttribute('aria-pressed',String(Boolean(color)&&fold(b.dataset.modelColor)===color)));
}
function initGallery(){
  if(!mainPage)return;
  const p=products.get(mainPage.dataset.pdp);
  if(!p)return;
  const history=readArray(keys.recent).filter(id=>id!==p.id && products.has(id));
  const section=$('[data-recent]',mainPage);
  if(history.length){section.hidden=false;$('.st-grid',section).innerHTML=history.slice(0,4).map(id=>renderCard(products.get(id))).join('');}
  save(keys.recent,[p.id,...history].slice(0,16));
  if(p.images.length<2)return;
  const frame=$('.st-main-media',mainPage);
  let startX=null,startY=null;
  frame.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;startY=e.touches[0].clientY;},{passive:true});
  frame.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-startX,dy=e.changedTouches[0].clientY-startY;
    if(startX!==null && Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy))selectPhoto((photoIndex+(dx<0?1:-1)+p.images.length)%p.images.length);
    startX=null;
  },{passive:true});
}
function updateParams(next){
  parameters=next;selectionLimit=32;const query=next.toString();
  history.pushState(null,'',location.pathname+(query?'?'+query:''));
  renderList();
}
const filterNames=['cor','tamanho','disponivel','min','max'];
function renderList(){
  if(!listing)return;
  const name=listing.dataset.list;
  const search=name==='busca',fav=name==='favoritos';
  const q=(parameters.get('q')||'').trim();
  const base=fav?list.filter(p=>readArray(keys.favorites).includes(p.id)):search?list:list.filter(p=>inCategory(p,name));
  const matches=search&&!q?[]:filterProducts(base,parameters);
  $('[data-grid]',listing).innerHTML=matches.slice(0,selectionLimit).map(renderCard).join('');
  $('[data-results]',listing).textContent=search&&!q?'':matches.length+(matches.length===1?' peça':' peças');
  $('[data-more]',listing).hidden=selectionLimit>=matches.length;
  const empty=$('[data-empty]',listing);
  if(matches.length)empty.replaceChildren();
  else if(fav&&!base.length)empty.innerHTML=emptyState('Seus favoritos ficam aqui','Toque no coração de uma peça para guardá-la nesta seleção.','/colecao/todas/','Explorar a coleção');
  else if(search&&!q)empty.innerHTML=emptyState('Busque uma peça','Experimente o nome de um modelo, uma cor ou uma categoria.');
  else if(!base.length&&!search)empty.innerHTML=emptyState('Explore a coleção','Conheça outras peças da curadoria.','/colecao/todas/','Ver todas as peças');
  else empty.innerHTML=emptyState('Nenhuma peça encontrada',search?'Experimente outro nome de modelo ou categoria.':'Experimente outros filtros.')+(filterNames.some(k=>parameters.has(k))?'<button type="button" data-reset class="st-under">Limpar filtros</button>':'');
  const sort=$('select[name="ordem"]',listing);if(sort)sort.value=parameters.get('ordem')||'';
  const input=$('#st-query',listing);if(input)input.value=q;
  $$('[data-size]',listing).forEach(b=>b.setAttribute('aria-pressed',String(parameters.getAll('tamanho').includes(b.dataset.size))));
  const chipLabel={cor:'Cor',tamanho:'Tamanho',min:'A partir de R$',max:'Até R$',disponivel:'Disponível'};
  $('[data-applied]',listing).innerHTML=Array.from(parameters).filter(([k])=>filterNames.includes(k)).map(([k,v])=>'<button type="button" class="st-chip" data-remove-filter="'+esc(k)+'" data-value="'+esc(v)+'">'+esc(chipLabel[k]+(k==='disponivel'?'':' '+v))+' <span aria-hidden="true">×</span></button>').join('');
  updateFavorites();
}
function filterForm(){
  const f=$('[data-filters]',listing);
  for(const field of Array.from(f.elements)){
    if(!field.name)continue;
    if(field.type==='checkbox')field.checked=parameters.getAll(field.name).includes(field.value);
    else field.value=parameters.get(field.name)||'';
  }
  return f;
}
function quoteText(data){
  const days=Number.isSafeInteger(data.deliveryDays)?' · até '+data.deliveryDays+' dias úteis':'';
  return (data.shippingCents===0?'Frete grátis':'Frete '+money(data.shippingCents))+days;
}
function freightForm(form){
  const p=products.get(mainPage.dataset.pdp),buy=$('[data-buybox]',mainPage);
  const v=selectedVariant(buy,p),out=$('[data-ship-message]',mainPage);
  if(!canBuy(v)){out.textContent='Selecione uma variação disponível para calcular o frete.';return;}
  const btn=$('button',form);btn.disabled=true;out.textContent='Calculando…';
  const cep=form.elements.cep.value.replace(/\D/g,''),qty=Number(buy.elements.quantity.value);
  api({action:'quote',items:[{variantId:v.id,quantity:qty}],cep}).then(data=>{
    if(selectedVariant(buy,p)?.id===v.id && form.elements.cep.value.replace(/\D/g,'')===cep)out.textContent=quoteText(data);
  }).catch(e=>{out.textContent=e.message;}).finally(()=>btn.disabled=false);
}
function cartRow({row,p,v,ok},index){
  const name=p?.name||row.name||row.product;
  const label=v?.label||[v?.color,v?.size].filter(Boolean).join(' / ')||row.label||row.variant;
  const img=p?renderMedia({...p,images:p.images.slice(0,1)}):'';
  const qty='<div class="st-quantity"><button type="button" aria-label="Diminuir quantidade de '+esc(name)+'" data-delta="-1" data-row="'+index+'"'+(row.quantity<=1?' disabled':'')+'>−</button><span>'+row.quantity+'</span><button type="button" aria-label="Aumentar quantidade de '+esc(name)+'" data-delta="1" data-row="'+index+'"'+(!v||!canBuy(v)||row.quantity>=Math.min(99,v.stock)?' disabled':'')+'>+</button></div>';
  return '<article class="st-cart-line"><div class="st-cart-photo">'+img+'</div><div><h2>'+(p?'<a href="'+productURL(p)+'">'+esc(name)+'</a>':esc(name))+'</h2><p>'+esc(label)+'</p>'+(!ok?'<p class="st-stock-note">'+(v?.stock>0?'Ajuste a quantidade ao saldo disponível.':'Disponibilidade a confirmar.')+'</p>':'')+qty+'<button type="button" class="st-under" data-remove-row="'+index+'">Remover</button></div><strong>'+(v?.priceCents?money(v.priceCents*row.quantity):'Sob consulta')+'</strong></article>';
}
function renderCart(){
  if(!cartPage)return;
  const content=$('[data-cart-content]',cartPage),rows=cartLines(products);
  if(!rows.length){content.innerHTML=emptyState('Sua sacola está vazia','Comece explorando os modelos da nossa coleção.','/colecao/todas/','Explorar a coleção');return;}
  const ok=rows.every(r=>r.ok);
  const subtotal=rows.every(r=>r.v?.priceCents)?money(rows.reduce((sum,r)=>sum+r.v.priceCents*r.row.quantity,0)):'A confirmar';
  content.innerHTML='<div class="st-cart-layout"><div>'+rows.map(cartRow).join('')+'<a class="st-under" href="/colecao/todas/">Continuar comprando</a></div><aside class="st-order"><h2>Resumo da sacola</h2><dl><div><dt>Subtotal</dt><dd>'+subtotal+'</dd></div></dl>'+(ok?'<p>Escolha o frete e confira o total na finalização.</p><a class="st-action st-wide" href="/checkout/">Finalizar compra</a>':'<p>Para finalizar, remova as peças que precisam de confirmação.</p>')+'</aside></div>';
}
function changeRow(index,delta,remove){
  const rows=bagRows(),row=rows[index];if(!row)return;
  if(remove)rows.splice(index,1);
  else {
    const v=products.get(row.product)?.variants.find(v=>v.id===row.variant);
    const next=row.quantity+delta;
    if(next<1||(delta>0&&(!canBuy(v)||next>Math.min(v.stock,99))))return;
    row.quantity=next;
  }
  storeBag(rows);renderCart();
  const target=$('[data-remove-row="'+Math.min(index,Math.max(0,rows.length-1))+'"]')||$('[data-cart-content] a');
  target?.focus({preventScroll:true});
}
function initEvents(){
  document.addEventListener('click',event=>{
    const btn=event.target.closest('button');if(!btn)return;
    if(btn.hasAttribute('data-close'))btn.closest('dialog')?.close();
    else if(btn.hasAttribute('data-favorite'))changeFavorite(btn.dataset.favorite);
    else if(btn.hasAttribute('data-quick')){
      const p=products.get(btn.dataset.quick);if(p)tempDialog(p.name,buyBox(p,links,'quick'));
    }else if(btn.hasAttribute('data-open-filters')){filterForm();setDialog($('[data-filter-dialog]',listing));}
    else if(btn.hasAttribute('data-clear-filters')){const f=$('[data-filters]',listing);f.reset();f.querySelector('input')?.focus();}
    else if(btn.hasAttribute('data-reset')){const q=new URLSearchParams(parameters);filterNames.forEach(k=>q.delete(k));updateParams(q);}
    else if(btn.hasAttribute('data-size')){const q=new URLSearchParams(parameters);const val=btn.dataset.size;q.getAll('tamanho').includes(val)?q.delete('tamanho',val):q.append('tamanho',val);updateParams(q);}
    else if(btn.hasAttribute('data-remove-filter')){const q=new URLSearchParams(parameters);q.delete(btn.dataset.removeFilter,btn.dataset.value);updateParams(q);}
    else if(btn.hasAttribute('data-more')){selectionLimit+=32;renderList();}
    else if(btn.hasAttribute('data-thumb'))selectPhoto(Number(btn.dataset.thumb));
    else if(btn.hasAttribute('data-color-photo'))selectPhoto(Number(btn.dataset.colorPhoto));
    else if(btn.hasAttribute('data-zoom')){const p=products.get(mainPage.dataset.pdp),img=p.images[photoIndex];tempDialog(p.name,'<img class="st-enlarged" src="'+esc(img.src)+'" alt="'+esc(img.alt)+'">','st-image-dialog');}
    else if(btn.hasAttribute('data-delta'))changeRow(Number(btn.dataset.row),Number(btn.dataset.delta),false);
    else if(btn.hasAttribute('data-remove-row'))changeRow(Number(btn.dataset.removeRow),0,true);
  });
  document.addEventListener('submit',e=>{
    const f=e.target;
    if(f.matches('[data-buybox]')){e.preventDefault();addItem(f);}
    else if(f.matches('[data-filters]')){
      e.preventDefault();
      if(f.elements.min?.value && f.elements.max?.value && Number(f.elements.min.value)>Number(f.elements.max.value)){
        f.elements.max.setCustomValidity('O valor máximo deve ser igual ou superior ao mínimo.');f.elements.max.reportValidity();f.elements.max.setCustomValidity('');return;}
      const params=new URLSearchParams(parameters);filterNames.forEach(k=>params.delete(k));for(const [k,v] of new FormData(f))if(v)params.append(k,v);
      f.closest('dialog').close();updateParams(params);
    }else if(f.matches('[data-ship]')){e.preventDefault();freightForm(f);}
  });
  document.addEventListener('change',e=>{
    const form=e.target.closest('[data-buybox]');
    if(form){refreshVariant(form,products.get(form.dataset.buybox));return;}
    if(e.target.matches('select[name="ordem"]')){const q=new URLSearchParams(parameters);e.target.value?q.set('ordem',e.target.value):q.delete('ordem');updateParams(q);}
  });
  addEventListener('popstate',()=>{parameters=new URLSearchParams(location.search);selectionLimit=32;renderList();});
  addEventListener('storage',e=>{if(!e.key || e.key===keys.favorites){if(listing?.dataset.list==='favoritos')renderList();updateFavorites();}
    if(!e.key||e.key===keys.bag){updateCount();renderCart();}});
  addEventListener('pageshow',e=>{if(e.persisted){updateCount();updateFavorites();renderCart();}});
}
updateCount();
async function start(){
  try{
    const response=await fetch('/store/catalog.json');
    if(!response.ok)throw Error();
    const data=await response.json();
    list=data.products;products=new Map(list.map(p=>[p.id,p]));links=data.links;
    await migrateBag(products);updateCount();initGallery();renderList();renderCart();updateFavorites();initEvents();
  } catch {
    if(listing||cartPage||mainPage){const n=document.createElement('p');n.className='st-load-error';n.setAttribute('role','alert');n.textContent='Não foi possível carregar os recursos da loja. Recarregue a página para tentar novamente.';(listing||cartPage||mainPage).prepend(n);}
  }
}
start();
