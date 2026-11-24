const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
const formatter = new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' });
export const money = value => formatter.format(value / 100);
export const fold = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
export const slugify = value => fold(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const sorted = values => [...new Set(values.filter(Boolean))].sort(collator.compare);
export const validCents = value => Number.isSafeInteger(value) && value > 0;
export const canBuy = v => !!v && validCents(v.priceCents) && Number.isSafeInteger(v.stock) && v.stock > 0;
export const categoryLabels = { vestidos:'Vestidos', conjuntos:'Conjuntos', calcas:'Calças', novidades:'Novidades', todas:'Todas as peças' };
export function localImage(url) {
  // Only self-hosted paths are admitted to the public catalog.
  return typeof url === 'string' && /^\/(?!\/)[a-z0-9_/.%+~-]+$/i.test(url) && !url.includes('..') ? url : '';
}
function cleanText(v) {
  return typeof v === 'string' ? v.trim() : '';
}
function cleanNames(values) {
  return sorted((Array.isArray(values) ? values : []).map(x => cleanText(x)).filter(Boolean));
}
function unifyCategory(label) {
  const slug = slugify(label);
  return ({vestido:'vestidos',conjunto:'conjuntos',calca:'calcas'})[slug] || slug;
}
export function adaptLegacy(raw) {
  return raw.map(p => ({
    id: String(p.id), slug: slugify(p.id), name: p.name, category: unifyCategory(p.category),
    categoryName: p.category, status:'editorial', legacy:true, images:[],
    variants:(p.variants || []).map(v => {
      const parts = String(v.label || '').split('/').map(s => s.trim());
      return { id:String(v.id), label:v.label, color:parts.length > 1 ? parts[0] : '', size:parts.length > 1 ? parts[1] : parts[0] };
    })
  }));
}
export function normalizeProducts(input) {
  const seen = new Set();
  return input.flatMap(p => {
    const id = cleanText(String(p.id || ''));
    const name = cleanText(p.name);
    const slug = slugify(p.slug || name || id);
    if (!id || !name || !slug || seen.has(slug)) return [];
    seen.add(slug);
    const category = unifyCategory(p.category);
    const activated = p.status === 'active';
    const listed = p.status === 'listed';
    const images = (p.images || []).flatMap(img => {
      const source = typeof img === 'string' ? img : img.src || img.url;
      const src = localImage(source);
      return src ? [{src, alt:cleanText(img.alt) || name, color:cleanText(img.color)}] : [];
    });
    const variants = (p.variants || []).filter(v => v.id != null && String(v.id)).map(v => ({
      id:String(v.id), label:cleanText(v.label), color:cleanText(v.color), size:cleanText(v.size).toUpperCase(),
      priceCents:activated && validCents(v.priceCents ?? p.priceCents) ? (v.priceCents ?? p.priceCents) : null,
      stock:activated && Number.isSafeInteger(v.stock) && v.stock >= 0 ? v.stock : null
    }));
    const priceList = variants.map(v => v.priceCents).filter(validCents);
    const officialPrice = (activated || listed) && validCents(p.priceCents) ? p.priceCents : null;
    const measurements = (Array.isArray(p.measurements) ? p.measurements : []).filter(row => row && typeof row.name === 'string' && row.values && typeof row.values === 'object').map(row =>
      ({name:cleanText(row.name), unit:cleanText(row.unit), values:Object.fromEntries(Object.entries(row.values).filter(([k,v])=>k.length<40 && ['string','number'].includes(typeof v)))}));
    const sizeGuide = Object.fromEntries(Object.entries(p.sizeGuide || {}).filter(([key,v])=>key.length < 40 && ['string','number'].includes(typeof v)));
    return [{
      id, slug, name, sku:cleanText(p.sku), category, categoryName:categoryLabels[category] || cleanText(p.categoryName) || cleanText(p.category),
      summary:cleanText(p.summary), description:cleanText(p.description), composition:cleanText(p.composition),
      fabric:cleanText(p.fabric), fit:cleanText(p.fit), care:cleanText(p.care),
      measurementNote:cleanText(p.measurementNote || p.measurements), measurements, sizeGuide,
      sizes:cleanNames([...variants.map(v => v.size), ...cleanNames(p.displaySizes || p.sizes).map(v=>v.toLocaleUpperCase('pt-BR'))]),
      colors:cleanNames([...variants.map(v => v.color), ...cleanNames(p.displayColors || p.colors)]),
      images, variants, priceCents:priceList.length ? Math.min(...priceList) : officialPrice,
      varyingPrice:new Set(priceList).size > 1, isNew:p.isNew === true, legacy:p.legacy === true,
      status:activated || listed ? p.status : 'editorial'
    }];
  });
}
export const productURL = p => '/produto/' + encodeURIComponent(p.slug) + '/';
export function picturePanel(p) {
  const terms = p.name.replace(/\b(com|e|de|em|a|o)\b/gi,'').trim().split(/\s+/);
  const namedModel = terms.slice(1).filter(word => /^\p{Lu}/u.test(word)).at(-1);
  const label = namedModel || terms.at(-1) || p.name;
  let shade = 0;
  for (const c of p.id) shade = (shade + c.charCodeAt(0)) % 4;
  return '<div class="st-paper st-paper-' + shade + '" aria-hidden="true"><span>FELIPE MODAS</span><i>' + esc(label) + '</i><small>' + esc(p.sku || p.categoryName) + '</small></div>';
}
export function renderMedia(p, mode = 'card') {
  if (!p.images?.length) return picturePanel(p);
  const [a,b] = p.images;
  const tag = (img,extra) => '<img class="' + extra + '" src="' + esc(img.src) + '" alt="' + esc(img.alt || p.name) + '" width="720" height="900" ' + (mode === 'pdp' ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async">';
  return tag(a,'st-photo-main') + (mode === 'card' && b ? tag(b,'st-photo-alternate') : '');
}
export const icon = name => ({
  heart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 4.9a5.4 5.4 0 0 0-7.6 0L12 6l-1.1-1.1a5.4 5.4 0 1 0-7.6 7.6L12 21l8.7-8.5a5.4 5.4 0 0 0 0-7.6Z"/></svg>',
  tune:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h8m4 0h6M3 17h2m4 0h12"/><circle cx="13" cy="7" r="2"/><circle cx="7" cy="17" r="2"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-7-7v14"/></svg>'
}[name] || '');
export function priceHTML(p) {
  if (!validCents(p.priceCents)) return '<span class="st-price-note">Preço sob consulta</span>';
  return (p.varyingPrice ? '<span class="st-price-note">A partir de </span>' : '') + esc(money(p.priceCents));
}
export function renderCard(p) {
  const url = productURL(p);
  const hasStock = p.variants.some(canBuy);
  return '<article class="st-card"><div class="st-card-frame"><a class="st-card-media" href="' + url + '" aria-label="Ver ' + esc(p.name) + '">' + renderMedia(p) + '</a>' +
    (p.isNew ? '<span class="st-new">Novo</span>' : '') +
    '<button class="st-save" type="button" data-favorite="' + esc(p.id) + '" aria-pressed="false" aria-label="Salvar ' + esc(p.name) + ' nos favoritos">' + icon('heart') + '</button>' +
    (hasStock ? '<button class="st-quick" type="button" data-quick="' + esc(p.id) + '" aria-label="Compra rápida de ' + esc(p.name) + '">' + icon('plus') + '<span>Compra rápida</span></button>' : '') +
    '</div><div class="st-card-label"><h3><a href="' + url + '">' + esc(p.name) + '</a></h3><p>' + priceHTML(p) + '</p></div></article>';
}
export function filterProducts(products, params) {
  const query = fold(params.get('q')).split(/\s+/).filter(Boolean);
  const sizes = params.getAll('tamanho').map(fold);
  const colors = params.getAll('cor').map(fold);
  const min = params.get('min'), max = params.get('max');
  const minC = min && Number.isFinite(Number(min)) ? Math.round(Number(min)*100) : null;
  const maxC = max && Number.isFinite(Number(max)) ? Math.round(Number(max)*100) : null;
  const stock = params.get('disponivel') === '1';
  const matches = products.filter(p => {
    const terms = fold([p.name,p.categoryName,p.sku,p.fabric,p.summary,...p.colors,...p.sizes].join(' '));
    if (query.some(word => !terms.includes(word))) return false;
    if (sizes.length && !p.sizes.some(s => sizes.includes(fold(s)))) return false;
    if (colors.length && !p.colors.some(c => colors.includes(fold(c)))) return false;
    if (p.status === 'listed') {
      // Model attributes describe the garment. The approved price applies to the whole model.
      if (stock) return false;
      if (minC === null && maxC === null) return true;
      return validCents(p.priceCents) && (minC === null || p.priceCents >= minC) &&
        (maxC === null || p.priceCents <= maxC);
    }
    if (minC !== null || maxC !== null || stock || (sizes.length && colors.length && p.variants.length)) {
      // Price, availability, size and color must refer to the same variant.
      return p.variants.some(v => (!sizes.length || sizes.includes(fold(v.size))) &&
        (!colors.length || colors.includes(fold(v.color))) && (!stock || canBuy(v)) &&
        (minC === null || (validCents(v.priceCents) && v.priceCents >= minC)) &&
        (maxC === null || (validCents(v.priceCents) && v.priceCents <= maxC)));
    }
    return true;
  });
  const sort = params.get('ordem');
  if (sort === 'nome') matches.sort((a,b) => collator.compare(a.name,b.name));
  if (['menor','maior'].includes(sort)) matches.sort((a,b) => {
    if (a.priceCents === null || b.priceCents === null) return Number(a.priceCents === null)-Number(b.priceCents === null);
    return sort === 'menor' ? a.priceCents-b.priceCents : b.priceCents-a.priceCents;
  });
  return matches;
}
export const inCategory = (p, slug) => slug === 'todas' || (slug === 'novidades' ? p.isNew : p.category === slug);
