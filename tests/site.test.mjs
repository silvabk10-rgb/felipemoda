import test from 'node:test';
import assert from 'node:assert/strict';
import {artworks} from '../theme/campaigns.mjs';
import {home} from '../theme/home.mjs';
import {access,readFile} from 'node:fs/promises';

test('as treze artes da coleção usam imagens locais para desktop e celular',async()=>{
  assert.equal(artworks.length,13);
  assert.equal(new Set(artworks.map(a=>a.key)).size,13);
  for(const art of artworks){
    assert.match(art.href,/^\/(colecao\/[\w-]+|sobre)\/$/);
    for(const format of ['desktop','mobile']){
      const file=new URL('../assets/campaign/'+art.key+'-'+format+'.webp',import.meta.url);
      await access(file);
      assert.equal((await readFile(file)).subarray(8,12).toString(),'WEBP');
    }
  }
});
test('campanha inativa mantém navegação editorial e um único título principal',()=>{
  const page=home([],null);
  assert.equal((page.match(/<h1>/g)||[]).length,1);
  assert.equal((page.match(/data-slide /g)||[]).length,3);
  assert.doesNotMatch(page,/BEMVINDA10|10%/);
});

import {prepareCatalogue} from '../build.mjs';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

async function productFixture(t) {
  const siteRoot=await mkdtemp(path.join(tmpdir(),'fm-catalogue-test-'));
  t.after(()=>rm(siteRoot,{recursive:true,force:true}));
  const photoDir=path.join(siteRoot,'assets','products');
  await mkdir(photoDir,{recursive:true});
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4ncAAAAASUVORK5CYII=','base64');
  await writeFile(path.join(photoDir,'piece.png'),png);
  const common={id:'a',sku:'FM-A',name:'Peça A',priceCents:15000,images:[{src:'/assets/products/piece.png',alt:'Peça'}],
    variants:[{id:'a-m',stock:2}],source:{retailPriceCents:9000,promotion:true,supplierStock:10},pricingProposal:{approved:false}};
  const active={...common,status:'active'};
  const listed={...common,id:'b',sku:'FM-B',name:'Peça B',status:'listed',variants:[{id:'b-m',stock:30}]};
  const draft={...common,id:'c',sku:'FM-C',name:'Peça C',status:'draft',priceCents:null,images:[],variants:[]};
  const options={siteRoot,production:true,company:{legalName:'Fixture',address:'Fixture'},shippingRates:[{}],mode:'live'};
  return {photoDir,png,listed,active,draft,options};
}

test('prévia inclui ficha com preço aprovado e foto sem habilitar a venda',async t=>{
  const {listed,draft,options}=await productFixture(t);
  const result=await prepareCatalogue([listed,draft],{...options,production:false});
  assert.equal(result.checkoutEnabled,false);
  assert.equal(result.products.length,2);
  const [p]=result.products;
  assert.equal(p.status,'listed');
  assert.equal(p.priceCents,15000);
  assert.equal(p.variants[0].stock,null);
  assert.equal(p.source,undefined);
  assert.equal(p.pricingProposal,undefined);
  await assert.rejects(prepareCatalogue([listed],options),/Publicação comercial pendente/);
});

test('produção inclui listados com um item vendável e conserva os demais critérios de publicação',async t=>{
  const {listed,active,draft,options}=await productFixture(t);
  const result=await prepareCatalogue([listed,active,draft],options);
  assert.deepEqual(result.products.map(p=>p.status),['listed','active']);
  assert.equal(result.checkoutEnabled,true);
  for(const invalid of [{mode:'sandbox'},{company:{address:'Fixture'}},{company:{legalName:'Fixture'}},{shippingRates:[]}]) {
    await assert.rejects(prepareCatalogue([listed,active],{...options,...invalid}),/Publicação comercial pendente/);
  }
  const soldOut={...active,variants:[{id:'a-m',stock:0}]};
  const emptyStock=await prepareCatalogue([listed,soldOut],options);
  assert.equal(emptyStock.products[1].variants[0].stock,0);
});

test('valida fotos locais, formato e preço nas fichas de catálogo',async t=>{
  const {listed,active,options,photoDir,png}=await productFixture(t);
  const preview={...options,production:false};
  await writeFile(path.join(photoDir,'other.webp'),png);
  await writeFile(path.join(photoDir,'text.png'),'arquivo de texto com extensão de imagem');
  const outside=path.join(options.siteRoot,'outside.png');
  await writeFile(outside,png);
  await symlink(outside,path.join(photoDir,'outside.png'));
  for(const product of [listed,active]){
    for(const src of ['/assets/products/missing.webp','https://exemplo.com/produto.png','/assets/products/../outside.png','/assets/products/outside.png','/assets/products/text.png','/assets/products/other.webp']){
      await assert.rejects(prepareCatalogue([{...product,images:[{src}]}],preview));
    }
    await assert.rejects(prepareCatalogue([{...product,images:[]}],preview),/galeria/);
  }
  await assert.rejects(prepareCatalogue([{...listed,priceCents:null}],preview),/preço próprio/);
});
