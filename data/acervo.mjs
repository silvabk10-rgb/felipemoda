import { legacyCategoryById, legacyCategoryLabels } from './categorias-legado.mjs';

const garmentSize = /^(?:PP|P|M|G|GG|EG|U|ÚNICO|[0-9]+)$/iu;
const localArchivePhoto = product => '/assets/products/acervo/' + product.id + '.webp';

function splitAttributes(label) {
  // The source uses spaces around the attribute separator. A slash inside a print name is literal.
  const parts = label.split(/\s+\/\s+/u).map(value => value.trim());
  if (parts.length === 2 && garmentSize.test(parts[0]) !== garmentSize.test(parts[1])) {
    const [size, color] = garmentSize.test(parts[0]) ? parts : [parts[1], parts[0]];
    return { color, size };
  }
  // Keep a previously unseen label intact for selection by its original ID.
  return { color:'', size:'' };
}

function approvedStock(value) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Informe um saldo próprio inteiro e não negativo.');
  return value;
}

/**
 * Restores the historical storefront without interpreting supplier availability as local stock.
 * inventoryByVariant has ORIGINAL variant IDs as keys. An explicit null leaves a variant unconfirmed.
 * openingStock, when supplied, applies to actual source variants only.
 */
export function restoreArchive(raw, { inventoryByVariant = {}, openingStock = null, imageFor = localArchivePhoto } = {}) {
  const opening = approvedStock(openingStock);
  const variantIds = new Set();
  const productIds = new Set();
  const restored = raw.map(product => {
    const category = legacyCategoryById[product.id];
    if (!category || productIds.has(product.id)) throw new Error('Confira a classificação e a identificação do produto do acervo: ' + product.id);
    productIds.add(product.id);
    if (!product.variants.length) throw new Error('Produto do acervo sem variantes: ' + product.id);
    const variants = product.variants.map(option => {
      const id = String(option.id ?? '').trim();
      if (!id || variantIds.has(id)) throw new Error('Identificador de variante inválido ou repetido: ' + id);
      variantIds.add(id);
      if (!Number.isSafeInteger(option.price) || option.price < 1) throw new Error('Preço inválido na variante ' + id);
      const stock = Object.hasOwn(inventoryByVariant, id) ? approvedStock(inventoryByVariant[id]) : opening;
      return {
        id, label:option.label, ...splitAttributes(option.label), priceCents:option.price, stock,
        ...(option.sku ? {sku:option.sku} : {})
      };
    });
    const displayColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
    const displaySizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
    const sourceRecords = product.variants.map(v => ({
      id:String(v.id), label:v.label, priceCents:v.price, originalCents:v.original, available:v.available
    }));
    return {
      id:product.id, slug:product.id, name:product.name, sku:product.sku ?? '',
      category, categoryName:legacyCategoryLabels[category], legacy:true, isNew:false,
      status:variants.every(v => v.stock !== null) ? 'active' : 'listed',
      priceCents:Math.min(...variants.map(v => v.priceCents)),
      displayColors, displaySizes, variants, measurements:[], sizeGuide:{},
      images:[{ src:imageFor(product), alt:product.name, color:displayColors.length === 1 ? displayColors[0] : '' }],
      source:{
        supplier:'Stella Basic', collectedAt:'2026-11-23', url:product.source, photoUrl:product.image,
        category:product.category, supplierColors:displayColors, supplierSizes:displaySizes, variantRecords:sourceRecords
      }
    };
  });
  for (const id of Object.keys(inventoryByVariant)) {
    if (!variantIds.has(id)) throw new Error('O saldo informado corresponde a uma variante ausente do acervo: ' + id);
  }
  return restored;
}
