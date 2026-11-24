import assert from 'node:assert/strict';
import test from 'node:test';
import archive from '../catalogo.js';
import { restoreArchive } from '../data/acervo.mjs';
import { legacyCategoryById, legacyCategoryLabels } from '../data/categorias-legado.mjs';
import curated from '../data/curadoria.json' with { type:'json' };
import { renderSizeGuide } from '../institucional/medidas.mjs';
import { canBuy, normalizeProducts, productURL } from '../store/core.mjs';

const restored = restoreArchive(archive);

test('restaura as 235 peças e 916 variantes sem modificar sua identidade, fotos ou preços', () => {
  assert.equal(restored.length, 235);
  const curatedIDs = new Set(curated.flatMap(p => [p.id, p.slug, ...p.variants.map(v => v.id)]));
  const variantIDs = new Set();
  for (const [i, model] of restored.entries()) {
    const old = archive[i];
    assert.equal(model.id, old.id);
    assert.equal(model.name, old.name);
    assert.equal(model.slug, old.id);
    assert.ok(!curatedIDs.has(model.id));
    assert.equal(model.sku, '');
    assert.equal(model.legacy, true);
    assert.equal(model.isNew, false);
    assert.equal(model.category, legacyCategoryById[old.id]);
    assert.equal(model.categoryName, legacyCategoryLabels[model.category]);
    assert.equal(model.source.url, old.source);
    assert.equal(model.source.photoUrl, old.image);
    assert.deepEqual(model.images.map(img => img.src), ['/assets/products/acervo/' + old.id + '.webp']);
    assert.equal(model.priceCents, Math.min(...old.variants.map(v => v.price)));
    assert.equal(model.variants.length, old.variants.length);
    assert.equal(model.status, 'listed');
    assert.deepEqual(model.measurements, []);
    assert.deepEqual(model.sizeGuide, {});
    for (const [j, variant] of model.variants.entries()) {
      const source = old.variants[j];
      assert.deepEqual([variant.id, variant.label, variant.priceCents], [source.id, source.label, source.price]);
      assert.equal(variant.stock, null);
      assert.ok(variant.size && variant.color);
      assert.ok(!variantIDs.has(variant.id));
      assert.ok(!curatedIDs.has(variant.id));
      variantIDs.add(variant.id);
      assert.deepEqual(model.source.variantRecords[j], {
        id:source.id, label:source.label, priceCents:source.price, originalCents:source.original, available:source.available
      });
    }
  }
  assert.equal(variantIDs.size, 916);
});

test('a vitrine mantém a estampa com barra e a ordem de atributos da fonte', () => {
  const visible = normalizeProducts(restored);
  const printed = visible.find(p => p.id === 'calca-carrot-jacquard-zigzag-cappuccinopreto-1123');
  assert.deepEqual(printed.colors, ['ZIGZAG CAPPUCCINO/PRETO']);
  assert.deepEqual([printed.variants[0].id, printed.variants[0].size], ['1574105199', 'P']);
  assert.equal(printed.priceCents, 7990);
  assert.ok(printed.variants.every(v => !canBuy(v)));
  const reversed = visible.find(p => p.id === 'blusa-ml-shoulder-soft-marinho-4012');
  const variant = reversed.variants.find(v => v.id === '1567482172');
  assert.deepEqual([variant.color, variant.size, variant.label], ['MARINHO', 'P', 'P / MARINHO']);
  assert.equal(productURL(reversed), '/produto/blusa-ml-shoulder-soft-marinho-4012/');
  assert.ok(!('source' in reversed));
});

test('saldo próprio autorizado usa somente IDs reais e preserva os ajustes individuais', () => {
  const raw = [archive[0]];
  const chosen = raw[0].variants[0].id;
  const partial = restoreArchive(raw, { inventoryByVariant:{ [chosen]:3 } });
  assert.equal(partial[0].status, 'listed');
  assert.ok(partial[0].variants.slice(1).every(v => v.stock === null));
  const [model] = normalizeProducts(restoreArchive(raw, { openingStock:5, inventoryByVariant:{ [chosen]:0 } }));
  assert.equal(model.status, 'active');
  assert.deepEqual(model.variants.map(v => v.id), raw[0].variants.map(v => v.id));
  assert.equal(model.variants[0].stock, 0);
  assert.equal(canBuy(model.variants[0]), false);
  assert.ok(model.variants.slice(1).every(v => v.stock === 5 && canBuy(v)));
  assert.equal(restoreArchive(raw, { openingStock:5, inventoryByVariant:{ [chosen]:null } })[0].status, 'listed');
  assert.throws(() => restoreArchive(raw, { openingStock:-1 }), /saldo/);
  assert.throws(() => restoreArchive(raw, { inventoryByVariant:{ inexistente:10 } }), /ausente/);
});

test('o guia mantém só as 12 fichas com dados de origem mesmo ao receber a loja completa', () => {
  const html = renderSizeGuide([...curated, ...restored], '/atendimento/');
  assert.equal((html.match(/<table>/g) || []).length, 12);
  assert.ok(!html.includes('id="' + restored[0].slug + '"'));
  const [first] = restored;
  const enriched = { ...first, measurements:[{ name:'Comprimento', unit:'cm', values:{ P:92 } }] };
  assert.match(renderSizeGuide([enriched], '/atendimento/'), /Comprimento \(cm\)/);
});
