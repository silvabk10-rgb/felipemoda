import test from 'node:test';
import assert from 'node:assert/strict';
import {bagRows,cartLines,keys,migrateBag,save} from '../store/bag.mjs';
import archive from '../catalogo.js';
import {archiveProducts} from '../data/acervo-loja.mjs';
import catalog from '../data/curadoria.json' with {type:'json'};
import {inventory} from '../commerce/config.mjs';

test('o estoque do checkout respeita o saldo de cada variante configurada da coleção e do acervo',()=>{
  const local=inventory();
  let expected=0;
  for(const product of [...catalog,...archiveProducts]){
    for(const variant of product.variants){
      const entry=local.get(variant.id);
      if(product.status==='active' && Number.isSafeInteger(variant.stock) && variant.stock>=0){
        assert.equal(entry?.stock,variant.stock,variant.id);
        assert.equal(entry?.priceCents,variant.priceCents??product.priceCents,variant.id);
        expected++;
      }else assert.equal(entry,undefined,variant.id);
    }
  }
  assert.equal(local.size,expected);
});

test('sacola anterior preserva a combinação exata e só compra quando a mesma variante é habilitada',async t=>{
  const [first,other]=archive;
  const chosen=first.variants[0],different=other.variants[0],overLimit=first.variants[1];
  const listed={id:first.id,name:first.name,variants:[]};
  const catalog=new Map([[first.id,listed]]);
  const rows=[
    {product:first.id,variant:chosen.id,quantity:2},
    {product:first.id,variant:chosen.id,quantity:1},
    {product:first.id,variant:different.id,quantity:1},
    {product:first.id,variant:overLimit.id,quantity:10000}
  ];
  const serialized=archive.map(p=>({id:p.id,name:p.name,variants:p.variants.map(({id,label})=>({id,label}))}));
  t.mock.method(globalThis,'fetch',async url=>{assert.equal(url,'/store/legacy.json');return Response.json(serialized);});
  save(keys.bag,null);save(keys.old,rows);
  await Promise.all([migrateBag(catalog),migrateBag(catalog)]);
  assert.deepEqual(bagRows().map(({variant,quantity,label})=>[variant,quantity,label]),[
    [chosen.id,3,chosen.label],[different.id,1,different.id],[overLimit.id,10000,overLimit.label]
  ]);
  assert.deepEqual(cartLines(catalog).map(line=>line.ok),[false,false,false]);
  catalog.set(other.id,{id:other.id,variants:[{id:different.id,stock:10,priceCents:7000}]});
  catalog.set(first.id,{...listed,variants:[{id:chosen.id,stock:3,priceCents:8000},{id:overLimit.id,stock:15000,priceCents:8000}]});
  const current=cartLines(catalog);
  assert.deepEqual(current.map(line=>line.ok),[true,false,false]);
  assert.equal(current[0].v.priceCents,8000);
  save(keys.bag,[]);
  await migrateBag(catalog);assert.deepEqual(bagRows(),[]);
});
