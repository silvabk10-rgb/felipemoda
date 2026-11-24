import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {adaptLegacy,buildStore,normalizeProducts,renderCard} from './build.mjs';
import {canBuy,filterProducts} from './core.mjs';

const garment={
  id:'v-1',slug:'vestido-linho',name:'Vestido de linho',sku:'V-1',category:'vestidos',
  status:'active',priceCents:16000,isNew:true,images:[{src:'/assets/vestido.webp',alt:'Vestido de linho'}],
  variants:[
    {id:'v-p',size:'p',color:'Pérola',stock:2},
    {id:'v-m',size:'M',color:'Pérola',stock:0},
    {id:'v-verde',size:'M',color:'Verde',stock:1,priceCents:17500}
  ]
};
const draft={
  id:'c-1',name:'Calça Amélia',sku:'C-1',category:'calcas',status:'draft',priceCents:13500,
  images:[{src:'https://example.invalid/photo.jpg'}],displaySizes:['P','M'],displayColors:['Marrom'],
  measurements:[{name:'Comprimento',unit:'cm',values:{P:98,M:100}}],sizeGuide:{M:'40'},
  source:{retailPriceCents:13500,privateMarker:'não publicar'},
  variants:[{id:'x',size:'M',stock:30,priceCents:13500}]
};
test('dados de fornecedores não liberam oferta, imagens externas nem estoque próprio',()=>{
  const [p]=normalizeProducts([draft]);
  assert.equal(p.priceCents,null);assert.equal(p.variants[0].stock,null);
  assert.deepEqual(p.images,[]);assert.equal(canBuy(p.variants[0]),false);
  assert.equal(p.measurements[0].values.M,100);
  assert.doesNotMatch(JSON.stringify(p),/privateMarker|13500|example\.invalid/);
  assert.match(renderCard(p),/Preço sob consulta/);
  assert.doesNotMatch(renderCard(p),/data-quick/);
  assert.deepEqual(normalizeProducts([p]),[p]);
});
test('filtros combinam cor, tamanho, saldo e preço na mesma variante',()=>{
  const ps=normalizeProducts([garment,draft]);
  const match=query=>filterProducts(ps,new URLSearchParams(query)).map(p=>p.id);
  assert.deepEqual(match('q=calca+amelia'),['c-1']);
  assert.deepEqual(match('tamanho=p&cor=perola&disponivel=1'),['v-1']);
  assert.deepEqual(match('tamanho=M&cor=perola&disponivel=1'),[]);
  assert.deepEqual(match('tamanho=M&cor=verde&min=170&max=180'),['v-1']);
  assert.deepEqual(match('min=170&max=175&cor=perola'),[]);
  assert.deepEqual(match('ordem=maior'),['v-1','c-1']);
  assert.equal(ps[0].varyingPrice,true);assert.match(renderCard(ps[0]),/data-quick/);
});
test('a migração conserva identificadores antigos e nunca reaproveita preços ou saldos externos',()=>{
  const [p]=normalizeProducts(adaptLegacy([{id:'p-antigo',name:'Calça histórica',category:'Calças',image:'https://example.invalid/img.jpg',variants:[{id:109,label:'Verde / G',price:5000,original:10000,available:true}]}]));
  assert.equal(p.id,'p-antigo');assert.equal(p.variants[0].id,'109');
  assert.equal(p.variants[0].priceCents,null);assert.equal(p.variants[0].stock,null);
  assert.deepEqual([p.variants[0].color,p.variants[0].size],['Verde','G']);
});
test('páginas diretas têm conteúdo estático, medidas e dados estruturados coerentes',async()=>{
  const outDir=await mkdtemp(join(tmpdir(),'felipe-loja-test-'));
  const layout=({head,body,title})=>'<!doctype html><title>'+title+'</title>'+head+body;
  try{
    const routes=await buildStore({outDir,products:[garment,draft],layout});
    assert.ok(routes.includes('/produto/calca-amelia/'));
    assert.ok(routes.includes('/colecao/novidades/'));
    const read=route=>readFile(join(outDir,route,'index.html'),'utf8');
    const page=await read('/produto/calca-amelia/');
    assert.match(page,/<td>100<\/td>/);assert.match(page,/Consultar disponibilidade/);assert.doesNotMatch(page,/"offers"/);
    const active=await read('/produto/vestido-linho/');
    assert.match(active,/"price":"175.00"/);assert.match(active,/schema.org\/OutOfStock/);
    assert.match(active,/Adicionar à sacola/);assert.match(active,/Calcular frete e prazo/);
    const publicData=JSON.parse(await readFile(join(outDir,'store/catalog.json'),'utf8'));
    assert.equal(publicData.couponEnabled,false);assert.doesNotMatch(JSON.stringify(publicData),/privateMarker/);
    assert.match(await read('/colecao/calcas/'),/Calça Amélia/);
    assert.match(await read('/colecao/vestidos/'),/Vestido de linho/);
  } finally {await rm(outDir,{recursive:true,force:true});}
});
