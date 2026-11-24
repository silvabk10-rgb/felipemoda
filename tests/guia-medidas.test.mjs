import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import catalogue from '../data/curadoria.json' with { type:'json' };
import { buildInstitutional } from '../institucional/build.mjs';
import { renderSizeGuide } from '../institucional/medidas.mjs';

const contact = 'https://wa.me/5521974623058';
const html = renderSizeGuide(catalogue, contact);
function card(slug) {
  const start = html.indexOf('id="' + slug + '" data-guia-modelo');
  assert.notEqual(start, -1, slug);
  return html.slice(start, html.indexOf('</section>', start));
}

test('cada peça tem tabela acessível, âncora, categoria, fotografia e link para a rota do catálogo', () => {
  assert.equal(catalogue.length, 12);
  assert.equal((html.match(/<table>/g) || []).length, 12);
  for (const product of catalogue) {
    const model = card(product.slug);
    assert.ok(model.includes('<caption>Tabela de tamanhos · ' + product.name + '</caption>'));
    assert.ok(model.includes('<th scope="col">Tamanho</th>'));
    assert.ok(model.includes('<th scope="row">'));
    assert.ok(model.includes('href="/produto/' + product.slug + '/"'));
    assert.ok(model.includes('src="' + product.images[0].src + '"'));
    assert.ok(html.includes('href="#' + product.slug + '"'));
    assert.ok(model.includes('data-baixar-tabela'));
    for (const row of product.measurements) {
      for (const value of Object.values(row.values)) {
        assert.ok(model.includes('>' + Number(value).toLocaleString('pt-BR') + '</td>'), product.slug);
      }
    }
  }
  for (const category of ['vestidos','conjuntos','calcas']) {
    assert.ok(html.includes('data-sg-filter="' + category + '"'));
    assert.ok(html.includes('data-sg-category="' + category + '"'));
  }
});
test('as tabelas preservam medidas específicas, notas, equivalências aproximadas e numeração sem estimativa', () => {
  const lara = card('vestido-jeans-lara-escuro');
  assert.ok(lara.includes('Comprimento do busto à barra (cm)'));
  assert.match(lara, /scope="row">GG<\/th><td>44<\/td><td><span class="sg-missing">Não informado/);
  assert.ok(card('calca-wide-leg-alfaiataria-dani').includes('110,5'));
  assert.ok(card('conjunto-listrado-peplum-helena').includes('Comprimento da blusa (cm)'));
  assert.ok(card('conjunto-listrado-com-cinto-isis').includes('Comprimento da calça (cm)'));
  assert.ok(card('vestido-listras-astoria').includes('Veste, em média, até o 42'));
  const baya = card('calca-jeans-wide-leg-baya');
  assert.equal((baya.match(/<th scope="col">/g)||[]).length, 1);
  assert.match(baya, /scope="row">46<\/th>/);
  assert.ok(baya.includes('não informadas para este modelo'));
  assert.ok(!baya.includes('Equivalência BR'));
});
test('o build usa a seleção recebida, preserva o caminho público e copia os assets do guia', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'fm-guia-'));
  t.after(() => rm(outDir, {recursive:true,force:true}));
  const paths = await buildInstitutional({ outDir, products:[catalogue[0]], layout:({body,head})=>head+body });
  assert.ok(paths.includes('/guia-de-medidas/'));
  const page = await readFile(join(outDir, 'guia-de-medidas/index.html'), 'utf8');
  assert.equal((page.match(/<h1>/g)||[]).length,1);
  assert.equal((page.match(/<table>/g)||[]).length,1);
  for (const file of ['medidas.css','medidas.js','tabela-canvas.mjs']) {
    assert.ok(page.includes('/institucional/' + file));
    await access(join(outDir,'institucional',file));
  }
});

test('filtro por categoria e link direto para um modelo permanecem navegáveis', async () => {
  const { runInNewContext } = await import('node:vm');
  const groups = new Map();
  const elements = new Map();
  const filters = new Map();
  const handlers = new Map();
  for (const category of ['vestidos','conjuntos','calcas']) {
    const group = { dataset:{sgCategory:category}, hidden:false };
    group.closest = () => group;
    group.scrollIntoView = () => {};
    groups.set(category,group);
    elements.set('grupo-' + category,group);
  }
  for (const category of ['todos',...groups.keys()]) {
    const filter = {
      dataset:{sgFilter:category}, hash:category==='todos'?'#modelos':'#grupo-'+category,
      addEventListener(type,fn) { this[type] = fn; },
      setAttribute() { this.current = true; }, removeAttribute() { this.current = false; }
    };
    filters.set(category,filter);
  }
  const slug = 'calca-jeans-wide-leg-baya';
  const target = { closest:()=>groups.get('calcas'), scrollIntoView() { this.scrolled = true; } };
  elements.set(slug,target);
  const location = { hash:'#' + slug };
  const guide = {querySelectorAll:selector=>selector==='[data-sg-category]'?groups.values():filters.values(),querySelector:()=>null};
  const context = {
    document:{ querySelector:()=>guide, getElementById:id=>elements.get(id) },
    window:{addEventListener:(name,fn)=>handlers.set(name,fn)}, location,
    history:{pushState:(_state,_unused,hash)=>{location.hash=hash;}}
  };
  const script = await readFile(new URL('../institucional/medidas.js',import.meta.url),'utf8');
  runInNewContext(script,context);
  assert.equal(target.scrolled,true);
  assert.equal(filters.get('calcas').current,true);
  assert.equal(groups.get('vestidos').hidden,true);
  filters.get('conjuntos').click({button:0,preventDefault(){}});
  assert.equal(location.hash,'#grupo-conjuntos');
  assert.equal(groups.get('conjuntos').hidden,false);
  assert.equal(groups.get('calcas').hidden,true);
  location.hash='#modelos';
  handlers.get('hashchange')();
  assert.ok([...groups.values()].every(group=>!group.hidden));
});
