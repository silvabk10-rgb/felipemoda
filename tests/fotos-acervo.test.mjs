import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import archive from '../catalogo.js';
import {prepareArchiveImages, validArchiveWebp} from '../scripts/fotos-acervo.mjs';

const original = Buffer.from('UklGRjIAAABXRUJQVlA4ICYAAACQAQCdASoDAAUAAUAmJYgCdLoAA5gA/uzjL8bzea1rfIyG3MAAAA==','base64');

async function directories(t) {
  const base = await mkdtemp(join(tmpdir(), 'fm-fotos-'));
  t.after(() => rm(base, {recursive:true, force:true}));
  const outDir = join(base, 'dist');
  await mkdir(outDir);
  return {outDir, cacheDir:join(base, 'cache')};
}

test('o acervo preserva as 235 associações foto → modelo sem acessar a rede', async t => {
  const paths = await directories(t);
  const wild = '/* /404.html 404\n';
  await writeFile(join(paths.outDir, '_redirects'), wild);
  const options = {...paths, download:false, fetcher:() => assert.fail('rede em build offline')};
  assert.deepEqual(await prepareArchiveImages(archive, options), {total:235, local:0, proxied:235});
  await prepareArchiveImages(archive, options);
  const text = await readFile(join(paths.outDir, '_redirects'), 'utf8');
  const rules = text.split('\n').filter(line => line.startsWith('/assets/'));
  assert.equal(rules.length, archive.length);
  assert.deepEqual(rules, archive.map(p => '/assets/products/acervo/' + p.id + '.webp ' + p.image + ' 200'));
  assert.ok(text.endsWith(wild));
});

test('uma URL compartilhada baixa uma vez; resposta HTML mantém a regra só da peça correspondente', async t => {
  const paths = await directories(t);
  const [first,second] = archive;
  const equivalent = {...first, id:'outro-registro'};
  const calls = new Map();
  const fetcher = async url => {
    calls.set(url, (calls.get(url) || 0) + 1);
    return new Response(url === first.image ? original : '<html>produto indisponível</html>');
  };
  assert.deepEqual(await prepareArchiveImages([first,equivalent,second], {...paths,download:true,fetcher}),
    {total:3, local:2, proxied:1});
  assert.equal(calls.get(first.image), 1);
  for (const {id} of [first,equivalent]) {
    assert.deepEqual(await readFile(join(paths.outDir,'assets/products/acervo',id+'.webp')), original);
  }
  await assert.rejects(stat(join(paths.outDir,'assets/products/acervo',second.id+'.webp')), {code:'ENOENT'});
  const rewrite = await readFile(join(paths.outDir,'_redirects'),'utf8');
  assert.ok(rewrite.includes(second.image) && !rewrite.includes(first.image));
  // Se o mesmo ID passar a referenciar outra URL, a foto anterior não pode ocultar a nova.
  const changed = {...first, image:second.image};
  assert.deepEqual(await prepareArchiveImages([changed], {...paths,download:false}), {total:1,local:0,proxied:1});
  await assert.rejects(stat(join(paths.outDir,'assets/products/acervo',first.id+'.webp')), {code:'ENOENT'});
  // A imagem anteriormente validada reaparece sem rede quando a URL exata é restaurada.
  assert.deepEqual(await prepareArchiveImages([first], {...paths,download:false}), {total:1,local:1,proxied:0});
});

test('recusa ambiguidades de ID, destinos fora da loja e WebP incompleto', async t => {
  const paths = await directories(t);
  await assert.rejects(prepareArchiveImages([archive[0],{...archive[1],id:archive[0].id}],paths), /mesmo ID/);
  await assert.rejects(prepareArchiveImages([{...archive[0],image:'https://example.com/a.webp'}],paths), /fora do CDN/);
  assert.equal(validArchiveWebp(original),true);
  assert.equal(validArchiveWebp(original.subarray(0,-2)),false);
  assert.equal(validArchiveWebp(Buffer.from('bloqueado')),false);
});
