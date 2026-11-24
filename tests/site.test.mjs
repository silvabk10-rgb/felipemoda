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
