import catalog from '../data/curadoria.json' with { type: 'json' };

// Preencha somente faixas homologadas pela loja. Preços estão em centavos.
export const shippingRates = [];
export const campaign = {
  enabled: false,
  code: 'BEMVINDA10',
  percent: 10,
  firstPurchaseOnly: true,
  startsAt: null,
  endsAt: null,
  stackable: false
};

export function inventory(products = catalog) {
  const stock = new Map();
  for (const product of products) {
    if (product.status !== 'active') continue;
    for (const variant of product.variants ?? []) {
      const priceCents = variant.priceCents ?? product.priceCents;
      if (!Number.isSafeInteger(priceCents) || priceCents < 1) continue;
      if (!Number.isSafeInteger(variant.stock) || variant.stock < 0 || !variant.id) continue;
      if (stock.has(variant.id)) throw new Error('Variante duplicada no catálogo.');
      stock.set(variant.id, {
        name: [product.name, variant.color, variant.size].filter(Boolean).join(' · '),
        stock: variant.stock, priceCents
      });
    }
  }
  return stock;
}
