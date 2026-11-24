import { categoryLabels, esc, fold, normalizeProducts, productURL } from '../store/core.mjs';

const cm = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const missing = '<span class="sg-missing">Não informado</span>';
const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'];

function formatCell(value) {
  if (value == null || value === '') return missing;
  return typeof value === 'number' ? cm.format(value) : esc(value);
}
function dimensions(product) {
  const measures = product.measurements.filter(row => Object.keys(row.values).length);
  const guide = product.sizeGuide;
  const hasEquivalence = Object.keys(guide).length > 0;
  const keys = [...Object.keys(guide), ...measures.flatMap(row => Object.keys(row.values)), ...product.sizes];
  const sizes = [];
  for (const label of keys) {
    if (!sizes.some(existing => fold(existing) === fold(label))) sizes.push(label);
  }
  sizes.sort((a,b) => {
    const x = sizeOrder.indexOf(a.toUpperCase());
    const y = sizeOrder.indexOf(b.toUpperCase());
    if (x >= 0 && y >= 0) return x - y;
    return a.localeCompare(b, 'pt-BR', { numeric: true });
  });
  const columns = hasEquivalence ? [{ label: 'Equivalência BR', values: guide }] : [];
  for (const row of measures) columns.push({ label: row.name + (row.unit ? ' (' + row.unit + ')' : ''), values: row.values });
  const sizesForTable = sizes.length ? sizes : [''];
  const body = sizesForTable.map(size => {
    const cells = columns.map(column => {
      const match = Object.keys(column.values).find(label => fold(label) === fold(size));
      return '<td>' + formatCell(match === undefined ? null : column.values[match]) + '</td>';
    });
    return '<tr><th scope="row">' + formatCell(size) + '</th>' + cells.join('') + '</tr>';
  }).join('');
  return {
    table: '<table><caption>Tabela de tamanhos · ' + esc(product.name) + '</caption><thead><tr><th scope="col">Tamanho</th>' +
      columns.map(column => '<th scope="col">' + esc(column.label) + '</th>').join('') +
      '</tr></thead><tbody>' + body + '</tbody></table>',
    hasMeasurements: measures.length > 0,
  };
}
function modelCard(product) {
  const { table, hasMeasurements } = dimensions(product);
  const notes = [product.measurementNote];
  if (!hasMeasurements) notes.push('Medidas da peça em centímetros não informadas para este modelo.');
  const pdp = esc(productURL(product));
  const photo = product.images[0];
  return '<section class="sg-model" id="' + esc(product.slug) + '" data-guia-modelo data-modelo-slug="' + esc(product.slug) + '" aria-labelledby="nome-' + esc(product.slug) + '">' +
    '<header class="sg-model-head">' +
      (photo ? '<a class="sg-thumb" href="' + pdp + '" aria-label="Ver ' + esc(product.name) + '"><img src="' + esc(photo.src) + '" alt="" loading="lazy" width="64" height="82"></a>' : '') +
      '<div>' + (product.sku ? '<span class="sg-ref">Ref. ' + esc(product.sku) + '</span>' : '') +
      '<h4 id="nome-' + esc(product.slug) + '" data-guia-nome>' + esc(product.name) + '</h4></div></header>' +
    '<div class="sg-table-scroll" role="region" tabindex="0" aria-label="Tabela de ' + esc(product.name) + '">' + table + '</div>' +
    notes.filter(Boolean).map(note => '<p class="sg-note" data-guia-nota>' + esc(note) + '</p>').join('') +
    '<div class="sg-model-actions"><a href="' + pdp + '">Ver a peça <span aria-hidden="true">↗</span></a><button type="button" data-baixar-tabela hidden>Baixar tabela em PNG</button></div><span class="sg-status" role="status" data-guia-status></span></section>';
}
function sizesByModel(catalogue) {
  const products = normalizeProducts(catalogue.map(p => ({ ...p, displaySizes: p.displaySizes ?? p.source?.supplierSizes ?? p.sizes })))
    .filter(p => !p.legacy || p.measurements.some(row => Object.keys(row.values).length) || Object.keys(p.sizeGuide).length);
  const groups = new Map();
  for (const product of products) {
    const group = groups.get(product.category) ?? [];
    group.push(product);
    groups.set(product.category, group);
  }
  const categories = [...groups.keys()];
  const label = key => categoryLabels[key] || groups.get(key)[0].categoryName;
  const categoriesNav = '<nav class="sg-filters" aria-label="Categorias de modelos"><a data-sg-filter="todos" href="#modelos" aria-current="true">Todos</a>' +
    categories.map(key => '<a data-sg-filter="' + esc(key) + '" href="#grupo-' + esc(key) + '">' + esc(label(key)) + '</a>').join('') + '</nav>';
  const modelIndex = '<details class="sg-index"><summary>Escolher um modelo pelo nome</summary><ul>' +
    products.map(p => '<li><a href="#' + esc(p.slug) + '">' + esc(p.name) + '</a></li>').join('') + '</ul></details>';
  const sections = categories.map(key => '<section class="sg-group" id="grupo-' + esc(key) + '" data-sg-category="' + esc(key) + '"><h3>' + esc(label(key)) + '</h3><div class="sg-model-grid">' + groups.get(key).map(modelCard).join('') + '</div></section>');
  return '<section id="modelos" class="sg-models" aria-labelledby="sg-models-title"><header><h2 id="sg-models-title">Tabelas por modelo</h2><p>A equivalência BR indica a numeração sugerida para a peça. As medidas em centímetros descrevem a roupa.</p></header>' +
    (products.length ? categoriesNav + modelIndex + sections.join('') : '<p>Solicite as medidas da peça ao <a href="/atendimento/">atendimento</a>.</p>') + '</section>';
}

const technique = '<section id="como-medir" class="sg-technique" aria-labelledby="sg-technique-title"><h2 id="sg-technique-title">Como tirar as medidas</h2>' +
  '<div class="sg-method-grid"><section><h3>No corpo</h3><p>Em pé, use uma fita flexível e mantenha-a paralela ao chão, encostada ao corpo sem apertar.</p><dl>' +
    '<div><dt>Busto</dt><dd>Contorne a parte de maior volume, passando a fita sob os braços.</dd></div>' +
    '<div><dt>Cintura</dt><dd>Contorne a cintura natural, onde o tronco dobra ao inclinar o corpo de lado.</dd></div>' +
    '<div><dt>Quadril</dt><dd>Com os pés próximos, meça a parte de maior volume dos quadris e glúteos.</dd></div></dl></section>' +
  '<section><h3>Em uma peça sua</h3><p>Escolha uma roupa de caimento parecido. Estenda-a sobre uma superfície plana, alise o tecido e meça sem esticar.</p><dl>' +
    '<div><dt>Comprimento</dt><dd>Compare os mesmos pontos de início e fim. Se a ficha indicar “do busto à barra”, comece na linha do busto e termine na barra.</dd></div>' +
    '<div><dt>Conjuntos</dt><dd>Meça a blusa e a calça separadamente e confira a coluna correspondente a cada peça.</dd></div>' +
    '<div><dt>Largura e contorno</dt><dd>A largura de uma roupa plana corresponde a uma face. Confira a unidade e o método antes de comparar com o contorno do corpo.</dd></div></dl></section></div></section>';

export function renderSizeGuide(catalogue, contactUrl) {
  return '<article class="sg-page"><nav class="sg-crumb" aria-label="Caminho de navegação"><a href="/">Início</a><span aria-hidden="true">/</span><span aria-current="page">Guia de medidas</span></nav>' +
    '<header class="sg-hero"><div class="sg-hero-copy"><img class="sg-mark" src="/assets/brand/monogram.png" width="42" height="42" alt="" aria-hidden="true"><h1>Guia de medidas</h1><p>Encontre seu modelo e compare o comprimento e a numeração com uma peça que veste bem em você.</p><nav aria-label="Seções do guia"><a class="sg-primary" href="#modelos">Consultar tabelas</a><a class="sg-secondary" href="#como-medir">Como medir</a></nav></div><picture><source media="(min-width: 760px)" srcset="/assets/campaign/editorial-desktop.webp"><img src="/assets/campaign/editorial-mobile.webp" alt="" width="730" height="650" fetchpriority="high"></picture></header>' +
    '<div class="sg-inner">' + sizesByModel(catalogue) + technique +
      '<aside class="sg-help"><div><h2>Entre dois tamanhos?</h2><p>Envie o nome da peça e a medida que deseja conferir. A equipe ajuda você a comparar.</p></div><a class="sg-primary" href="' + esc(contactUrl) + '">Falar com a loja</a></aside></div></article>';
}
