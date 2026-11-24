import {esc, fold, renderCard, picturePanel, renderMedia, priceHTML, money, canBuy, categoryLabels, productURL, icon, sorted, localImage} from './core.mjs';
const plural = n => n + (n === 1 ? ' peça' : ' peças');
export const crumbs = (label, middle) => '<nav class="st-crumbs" aria-label="Caminho de navegação"><a href="/">Início</a><span aria-hidden="true">/</span>' + (middle ? '<a href="' + esc(middle.url) + '">' + esc(middle.name) + '</a><span aria-hidden="true">/</span>' : '') + '<span aria-current="page">' + esc(label) + '</span></nav>';
export const grid = cards => '<div class="st-grid" data-grid>' + cards.map(renderCard).join('') + '</div>';
export function emptyState(title, body, href, link) {
  return '<div class="st-empty"><h2>' + esc(title) + '</h2><p>' + esc(body) + '</p>' + (href ? '<a class="st-action" href="' + esc(href) + '">' + esc(link) + '</a>' : '') + '</div>';
}
const intros = {
  vestidos:'Dos cortes soltos à cintura marcada, descubra diferentes formas de vestir uma peça só.',
  calcas:'Linhas de alfaiataria e volumes de jeans para compor o seu dia.',
  conjuntos:'Peças que dialogam entre si e ganham novas combinações no seu guarda-roupa.',
  novidades:'As peças que acabam de entrar na nossa curadoria.',
  todas:'Explore a curadoria da Felipe Modas.'
};
function options(name, values) {
  return values.map((value,i) => '<label class="st-check"><input type="checkbox" name="' + name + '" value="' + esc(value) + '"><span>' + esc(value) + '</span></label>').join('');
}
function fieldset(name, content) {
  return '<fieldset><legend>' + esc(name) + '</legend><div class="st-options">' + content + '</div></fieldset>';
}
export function listPage({slug, products, title, banner, search, favorites}) {
  const sizes = sorted(products.flatMap(p=>p.sizes));
  const colors = sorted(products.flatMap(p=>p.colors));
  const priced = products.some(p=>p.priceCents !== null);
  const stockKnown = products.some(p=>p.variants.some(v=>Number.isFinite(v.stock)));
  const filters = (sizes.length ? fieldset('Tamanho do modelo',options('tamanho',sizes)) : '') +
    (colors.length ? fieldset('Cor',options('cor',colors)) : '') +
    (priced ? fieldset('Preço (R$)','<label>De<input class="st-input" type="number" name="min" min="0" step="0.01"></label><label>Até<input class="st-input" type="number" name="max" min="0" step="0.01"></label>') : '') +
    (stockKnown ? fieldset('Disponibilidade','<label class="st-check"><input type="checkbox" name="disponivel" value="1"><span>Disponível para compra</span></label>') : '');
  const controls = '<div class="st-tools"><p data-results aria-live="polite">' + (search || favorites ? '' : plural(products.length)) + '</p><div>' +
    (filters ? '<button type="button" class="st-tool" data-open-filters>' + icon('tune') + 'Filtrar</button>' : '') +
    '<label class="st-sort"><span>Ordenar por</span><select name="ordem" aria-label="Ordenar peças"><option value="">Seleção da loja</option><option value="nome">Nome de A a Z</option>' + (priced ? '<option value="menor">Menor preço</option><option value="maior">Maior preço</option>' : '') + '</select></label></div></div>';
  const filterDialog = '<dialog class="st-dialog st-filter-dialog" data-filter-dialog aria-labelledby="st-filter-heading"><div class="st-dialog-head"><h2 id="st-filter-heading">Filtros</h2><button type="button" data-close aria-label="Fechar filtros">×</button></div><form data-filters>' + filters + '<div class="st-dialog-actions"><button class="st-action" type="submit">Aplicar filtros</button><button class="st-under" data-clear-filters type="button">Limpar filtros</button></div></form></dialog>';
  const heroImg = localImage(banner?.desktop);
  const media = heroImg ? '<picture><source media="(max-width: 680px)" srcset="' + esc(localImage(banner.mobile) || heroImg) + '"><img src="' + esc(heroImg) + '" alt="' + esc(banner.alt || '') + '" width="1920" height="500" fetchpriority="high"></picture>' : '';
  const heading = '<header class="st-collection' + (media ? ' st-banner' : '') + '">' + media + '<div><h1>' + esc(title) + '</h1>' +
    (intros[slug] ? '<p>' + esc(intros[slug]) + '</p>' : '') + '</div></header>';
  const form = '<form action="/busca/" role="search" class="st-search-form"><label for="st-query">Qual peça você procura?</label><div><input class="st-input" type="search" id="st-query" name="q" maxlength="160" placeholder="Vestido, jeans, conjunto…" required><button class="st-action" type="submit">Buscar</button></div></form>';
  const shortcuts = !search && !favorites && sizes.length && sizes.length < 12 ? '<div class="st-shortcuts" aria-label="Atalhos por tamanho"><span>Tamanho do modelo</span>' + sizes.map(s=>'<button type="button" data-size="' + esc(s) + '" aria-pressed="false">' + esc(s) + '</button>').join('') + '</div>' : '';
  const first = search || favorites ? [] : products.slice(0,32);
  return '<div class="st-shell" data-list="' + esc(search ? 'busca' : favorites ? 'favoritos' : slug) + '">' + crumbs(title) + heading + (search ? form : '') + shortcuts + controls + '<div class="st-chips" data-applied></div>' + grid(first) +
    '<div data-empty>' + (search ? emptyState('Busque uma peça','Experimente o nome de um modelo, uma cor ou uma categoria.') : favorites ? emptyState('Seus favoritos ficam aqui','Toque no coração de uma peça para guardá-la nesta seleção.','/colecao/todas/','Explorar a coleção') : (!products.length ? emptyState('Explore a coleção','Conheça outras peças da curadoria.','/colecao/todas/','Ver todas as peças') : '')) + '</div><div class="st-more"><button class="st-action st-outline" type="button" data-more' + (first.length < products.length && !search && !favorites ? '' : ' hidden') + '>Ver mais peças</button></div>' + filterDialog + '</div>';
}
const measureNumber = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:20});
const modelGuideURL = (p,links) => esc(links.measures + '#' + encodeURIComponent(p.slug));
function tables(p, links) {
  const columns = [];
  const sizes = new Map();
  function addColumn(label, entries) {
    const values = new Map();
    for (const [size,value] of Object.entries(entries)) {
      const key = fold(size);
      if (!key || value == null || value === '') continue;
      sizes.set(key,size);
      values.set(key,value);
    }
    if (values.size) columns.push({label,values});
  }
  addColumn('Equivalência BR',p.sizeGuide || {});
  for (const measure of p.measurements || []) {
    addColumn(measure.name + (measure.unit ? ' (' + measure.unit + ')' : ''),measure.values);
  }
  for (const size of p.sizes || []) {
    if (!sizes.has(fold(size))) sizes.set(fold(size),size);
  }
  const caption = '<caption><span class="st-size-brand">Felipe Modas</span>' + esc(p.name) + '</caption>';
  const header = '<thead><tr><th scope="col">Tamanho</th>' + columns.map(c=>'<th scope="col">' + esc(c.label) + '</th>').join('') + '</tr></thead>';
  const cell = value => value == null ? '<td class="st-size-unknown">Não informado</td>' :
    '<td>' + esc(typeof value === 'number' ? measureNumber.format(value) : value) + '</td>';
  const rows = [...sizes].map(([key,label])=>'<tr><th scope="row">' + esc(label) + '</th>' +
    columns.map(c=>cell(c.values.get(key))).join('') + '</tr>').join('');
  const grid = columns.length ? header + '<tbody>' + rows + '</tbody>' :
    '<tbody><tr><th scope="row">Tamanhos do modelo</th><td>' + [...sizes.values()].map(esc).join(', ') + '</td></tr></tbody>';
  const table = sizes.size ? '<div class="st-table"><table>' + caption + grid + '</table></div>' : '';
  return table + (p.measurementNote ? '<p class="st-measure-note">' + esc(p.measurementNote) + '</p>' : '') +
    '<a class="st-under" href="' + modelGuideURL(p,links) + '">Ver este modelo no guia de medidas</a>';
}
export function buyBox(p, links, prefix='pdp') {
  const potential = p.variants.some(canBuy);
  if (!potential) {
    const stockKnown = p.variants.length > 0 && p.variants.every(v=>v.stock === 0);
    const attr = (label,values,render) => values.length ? '<dl class="st-model"><dt>'+label+'</dt><dd>'+values.map(render).join('')+'</dd></dl>' : '';
    const chip = value => '<span>'+esc(value)+'</span>';
    const colorChip = color => {
      const photo = p.status === 'listed' ? p.images.findIndex(img=>img.color && fold(img.color)===fold(color)) : -1;
      if(photo < 0) return chip(color);
      return '<button type="button" data-model-color="'+esc(color)+'" data-color-photo="'+photo+'" aria-label="Ver a peça na cor '+esc(color)+'" aria-pressed="'+(photo === 0)+'">'+esc(color)+'</button>';
    };
    const attributes = attr(p.colors.length===1?'Cor do modelo':'Cores do modelo',p.colors,colorChip) +
      attr(p.sizes.length===1?'Tamanho do modelo':'Tamanhos do modelo',p.sizes,chip);
    const request = p.priceCents ? 'a disponibilidade de ' : 'o preço e a disponibilidade de ';
    const wa = 'https://wa.me/5521974623058?text=' + encodeURIComponent('Olá, gostaria de consultar '+request+p.name+(p.sku ? ' ('+p.sku+')' : '')+'.');
    const actionStyle = p.status === 'listed' ? 'st-action st-outline st-wide' : 'st-action st-wide';
    return '<div class="st-buybox">' + attributes + '<a class="' + actionStyle + '" href="' + esc(wa) + '">' + (stockKnown ? 'Consultar reposição' : 'Consultar disponibilidade') + '</a><a href="' + modelGuideURL(p,links) + '" class="st-under">Guia de medidas deste modelo</a></div>';
  }
  const group = (label,key,values) => values.length ? fieldset(label,values.map((v,i)=>'<label class="st-choice"><input type="radio" name="' + key + '" value="' + esc(v) + '" required><span>' + esc(v) + '</span></label>').join('')) : '';
  const colors = sorted(p.variants.map(v=>v.color)); const sizes = sorted(p.variants.map(v=>v.size));
  const select = !colors.length && !sizes.length ? '<label>Variação<select class="st-input" name="variant" required><option value="">Selecione</option>' + p.variants.map(v=>'<option value="' + esc(v.id) + '"' + (!canBuy(v)?' disabled':'') + '>' + esc(v.label||p.name) + '</option>').join('') + '</select></label>' : '';
  return '<form class="st-buybox" data-buybox="' + esc(p.id) + '">' + group('Cor','color',colors) + group('Tamanho','size',sizes) + select +
    '<a class="st-under" href="'+modelGuideURL(p,links)+'">Guia de medidas deste modelo</a><p class="st-selection" data-selection aria-live="polite">Selecione a variação para adicionar à sacola.</p><div class="st-buy-actions"><label>Quantidade<input name="quantity" class="st-input" type="number" min="1" max="99" step="1" value="1" required></label><button type="submit" class="st-action" disabled>Adicionar à sacola</button></div><p data-buy-message role="status"></p></form>';
}
export function productPage(p, related, links) {
  const info = [['Tecido',p.fabric],['Composição',p.composition],['Modelagem',p.fit],['Cuidados',p.care]].filter(([,v])=>v);
  const gallery = '<div class="st-gallery" data-gallery><div class="st-main-media">' + (p.images.length ? '<button type="button" class="st-zoom" data-zoom aria-label="Ampliar foto de ' + esc(p.name) + '">' + renderMedia(p,'pdp') + '</button>' : picturePanel(p)) + '</div>' + (p.images.length > 1 ? '<div class="st-thumbs">' + p.images.map((img,i)=>'<button type="button" data-thumb="' + i + '" aria-label="Ver foto ' + (i+1) + '" aria-pressed="' + (!i) + '"><img src="' + esc(img.src) + '" alt="" loading="lazy" width="80" height="100"></button>').join('') + '</div>' : '') + '</div>';
  const details = (title,body,open='') => '<details '+open+'><summary>' + title + '</summary><div>' + body + '</div></details>';
  return '<div class="st-shell" data-pdp="' + esc(p.id) + '">' + crumbs(p.name,{name:p.categoryName,url:'/colecao/'+p.category+'/'}) + '<div class="st-product">' + gallery +
    '<div class="st-product-panel"><div class="st-pdp-head"><a class="st-kicker" href="/colecao/' + p.category + '/">' + esc(p.categoryName) + '</a><button type="button" class="st-save st-save-inline" data-favorite="' + esc(p.id) + '" aria-pressed="false" aria-label="Salvar ' + esc(p.name) + ' nos favoritos">' + icon('heart') + '</button></div><h1>' + esc(p.name) + '</h1>' + (p.sku ? '<p class="st-ref">Ref. ' + esc(p.sku) + '</p>' : '') + '<p class="st-pdp-price" data-pdp-price>' + priceHTML(p) + '</p>' + (p.summary ? '<p class="st-lead">' + esc(p.summary) + '</p>' : '')+ buyBox(p,links) +
    (p.variants.some(canBuy) ? '<details class="st-freight"><summary>Calcular frete e prazo</summary><form data-ship><label>CEP<input class="st-input" type="text" name="cep" inputmode="numeric" autocomplete="postal-code" pattern="[0-9]{5}-?[0-9]{3}" maxlength="9" required placeholder="00000-000"></label><button class="st-action st-outline">Calcular</button></form><p data-ship-message role="status"></p></details>' : '') +
    '<div class="st-details">' + (p.description?details('Sobre a peça','<p>' + esc(p.description) + '</p>','open'):'') +
    (info.length?details('Tecido e detalhes','<dl class="st-facts">' + info.map(([k,v])=>'<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>'):'') +
    details('Tamanhos e medidas',tables(p,links),'open') + details('Trocas e devoluções','<p>Nas compras online, você pode exercer o direito de arrependimento em até sete dias a partir do recebimento.</p><a class="st-under" href="' + links.returns + '">Ver política de trocas e devoluções</a>') +
    '</div></div></div>' + (related.length ? '<section class="st-related"><h2>Na mesma coleção</h2>' + grid(related) + '</section>' : '') + '<section class="st-related" data-recent hidden><h2>Vistas recentemente</h2><div class="st-grid"></div></section></div>';
}
export function cartPage() {
  return '<div class="st-shell" data-cart-page>' + crumbs('Sacola') + '<header class="st-collection"><div><h1>Sua sacola</h1></div></header><div data-cart-content>' + emptyState('Sua sacola está vazia','Comece explorando os modelos da nossa coleção.','/colecao/todas/','Explorar a coleção') + '</div></div>';
}
