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
const listed={
  ...draft,id:'c-2',name:'Calça Baya',sku:'C-2',status:'listed',priceCents:15000,
  images:[{src:'/assets/produtos/baya.webp',alt:'Calça Baya'}],variants:[]
};
test('modelo com preço aprovado pode ser consultado sem presumir saldo por variante',()=>{
  const ps=normalizeProducts([garment,listed,draft]);
  const p=ps[1];
  assert.equal(p.priceCents,15000);
  assert.equal(p.status,'listed');
  assert.deepEqual(normalizeProducts([p]),[p]);
  assert.deepEqual(p.images.map(img=>img.src),['/assets/produtos/baya.webp']);
  assert.match(renderCard(p),/150,00/);
  assert.doesNotMatch(renderCard(p),/Preço sob consulta|data-quick/);
  const match=query=>filterProducts(ps,new URLSearchParams(query)).map(p=>p.id);
  assert.deepEqual(match('min=150&max=150&tamanho=m&cor=marrom'),['c-2']);
  assert.deepEqual(match('max=149.99'),[]);
  assert.deepEqual(match('min=150&max=150&disponivel=1'),[]);
  assert.deepEqual(match('ordem=menor'),['c-2','v-1','c-1']);
  assert.deepEqual(match('ordem=maior'),['v-1','c-2','c-1']);
  const [withReferenceVariants]=normalizeProducts([{...listed,variants:draft.variants}]);
  assert.equal(withReferenceVariants.variants[0].stock,null);
  assert.equal(withReferenceVariants.variants[0].priceCents,null);
  assert.equal(withReferenceVariants.priceCents,15000);
});
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
    const routes=await buildStore({outDir,products:[garment,draft,listed],layout});
    assert.ok(routes.includes('/produto/calca-amelia/'));
    assert.ok(routes.includes('/colecao/novidades/'));
    const read=route=>readFile(join(outDir,route,'index.html'),'utf8');
    const page=await read('/produto/calca-amelia/');
    assert.match(page,/<td>100<\/td>/);assert.match(page,/Consultar disponibilidade/);assert.doesNotMatch(page,/"offers"/);
    const active=await read('/produto/vestido-linho/');
    assert.match(active,/"price":"175.00"/);assert.match(active,/schema.org\/OutOfStock/);
    assert.match(active,/Adicionar à sacola/);assert.match(active,/Calcular frete e prazo/);
    const listedPage=await read('/produto/calca-baya/');
    const ld=JSON.parse(listedPage.match(/<script type="application\/ld\+json">(.+?)<\/script>/)[1]);
    assert.deepEqual(ld.image,['https://felipemodasbr.com/assets/produtos/baya.webp']);
    assert.equal(ld.offers,undefined);
    assert.match(listedPage,/data-pdp-price[^>]*>R\$\s*150,00/);
    assert.match(listedPage,/Consultar disponibilidade/);
    assert.doesNotMatch(listedPage,/data-buybox|Calcular frete e prazo|InStock|OutOfStock/);
    const publicData=JSON.parse(await readFile(join(outDir,'store/catalog.json'),'utf8'));
    assert.equal(publicData.couponEnabled,false);assert.doesNotMatch(JSON.stringify(publicData),/privateMarker/);
    assert.match(await read('/colecao/calcas/'),/Calça Amélia/);
    assert.match(await read('/colecao/vestidos/'),/Vestido de linho/);
  } finally {await rm(outDir,{recursive:true,force:true});}
});

test('a ficha liga cada cor somente à primeira foto identificada do tom',async()=>{
  const {productPage} = await import('./views.mjs');
  const [p] = normalizeProducts([{...listed,displayColors:['Azul','Pérola','Verde'], images:[
    {src:'/assets/produtos/a.webp',color:'perola'},
    {src:'/assets/produtos/b.webp',color:'Pérola'},
    {src:'/assets/produtos/c.webp',color:'Azul'},
    {src:'/assets/produtos/d.webp'}
  ]}]);
  const body = productPage(p,[],{measures:'/guia-de-medidas/',returns:'/trocas-e-devolucoes/'});
  assert.match(body,/data-model-color="Pérola" data-color-photo="0"[^>]+aria-pressed="true"/);
  assert.match(body,/data-model-color="Azul" data-color-photo="2"[^>]+aria-pressed="false"/);
  assert.doesNotMatch(body,/data-model-color="Verde"|data-buybox/);
  assert.match(body,/<span>Verde<\/span>/);
  assert.equal(body.match(/data-thumb="/g).length,4);
  assert.equal(body.match(/loading="lazy"/g).length,4);
});

test('checkout oferece as modalidades cadastradas e preserva edições durante a consulta do CEP',async()=>{
  const {addressAutofill,quoteInput,validCep,validQuote}=await import('./checkout-client.mjs');
  const {checkoutDocument}=await import('./checkout.mjs');
  const rates=[{id:'pac',label:'PAC',priceCents:2300},{id:'sedex',label:'SEDEX',priceCents:4800}];
  const page=checkoutDocument({shippingRates:rates});
  assert.match(page,/src="\/assets\/brand\/logo.png"/);
  assert.match(page,/PAC<\/span><strong>R\$\s*23,00/);
  assert.match(page,/SEDEX<\/span><strong>R\$\s*48,00/);
  assert.match(page,/Sua sacola está vazia/);
  assert.match(page,/<form id="co-form"/);
  assert.match(page,/data-card-entry/);
  assert.doesNotMatch(page,/name="(?:cvv|cardNumber)"|pk_live|BEMVINDA10/);
  const fields=Object.fromEntries(['cep','shippingMethod','coupon','email','street','district','city','uf','number','extra'].map(k=>[k,{value:''}]));
  const touched=new Set(),auto={};
  fields.number.value='76';fields.extra.value='Apto 4';
  addressAutofill(fields,touched,auto,{street:'Rua Um',district:'Centro',city:'Rio de Janeiro',uf:'RJ',number:'4',extra:'ignorar'});
  fields.street.value='Rua editada';touched.add('street');
  addressAutofill(fields,touched,auto,{});
  assert.equal(fields.street.value,'Rua editada');assert.equal(fields.city.value,'');
  addressAutofill(fields,touched,auto,{street:'Rua Dois',district:'Novo',city:'Salvador',uf:'BA'});
  assert.deepEqual([fields.street.value,fields.city.value,fields.uf.value,fields.number.value,fields.extra.value],['Rua editada','Salvador','BA','76','Apto 4']);
  fields.cep.value='40000-000';fields.shippingMethod.value='sedex';fields.email.value='pessoa@example.test';
  assert.ok(validCep(fields.cep.value));assert.ok(!validCep('40000abc000'));
  assert.deepEqual(quoteInput([{row:{variant:'p-1',quantity:2}}],fields),{items:[{variantId:'p-1',quantity:2}],cep:'40000000',shippingMethod:'sedex',coupon:'',email:''});
  assert.ok(validQuote({subtotalCents:15000,shippingCents:4800,discountCents:0,totalCents:19800}));
  assert.ok(!validQuote({subtotalCents:15000,shippingCents:4800,discountCents:0,totalCents:17300}));
});

test('a confirmação do próprio pedido libera recompra sem apagar uma sacola diferente',async()=>{
  const {finishPaidAttempt}=await import('./checkout-client.mjs');
  const {keys,load,save}=await import('./bag.mjs');
  const row={variant:'v-p',product:'v-1',quantity:1};
  const attempt={orderToken:'pedido-atual',key:'tentativa',items:[{variantId:'v-p',quantity:1}]};
  const products=new Map([[garment.id,normalizeProducts([garment])[0]]]);
  try{
    save(keys.checkout,attempt,true);save(keys.bag,[row]);
    finishPaidAttempt('outro-pedido',products);
    assert.deepEqual(load(keys.checkout,null,true),attempt);assert.deepEqual(load(keys.bag,null),[row]);
    finishPaidAttempt('pedido-atual',products);
    assert.equal(load(keys.checkout,null,true),null);assert.deepEqual(load(keys.bag,null),[]);
    save(keys.checkout,attempt,true);save(keys.bag,[{...row,quantity:2}]);
    finishPaidAttempt('pedido-atual',products);
    assert.equal(load(keys.checkout,null,true),null);assert.equal(load(keys.bag,null)[0].quantity,2);
  }finally{save(keys.checkout,null,true);save(keys.bag,[]);}
});
