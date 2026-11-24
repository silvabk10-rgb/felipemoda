import {mkdir, readFile, rename, writeFile, rm} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const PHOTO_URL = /^https:\/\/acdn-us\.mitiendanube\.com\/stores\/006\/627\/475\/products\/[a-zA-Z0-9._-]+\.webp$/;
const START = '# Fotos do acervo Felipe Modas — início';
const END = '# Fotos do acervo Felipe Modas — fim';
const MAX_BYTES = 5 * 1024 * 1024;

function photoJobs(archive) {
  const byId = new Map();
  for (const {id, image} of archive) {
    if (typeof id !== 'string' || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(id)) {
      throw new Error('ID de fotografia inválido no acervo: ' + id);
    }
    if (typeof image !== 'string' || !PHOTO_URL.test(image) || image !== new URL(image).href) {
      throw new Error('Endereço de fotografia fora do CDN desta loja: ' + id);
    }
    if (byId.has(id) && byId.get(id).image !== image) {
      throw new Error('O mesmo ID aponta para fotos diferentes: ' + id);
    }
    byId.set(id, {id, image, path: '/assets/products/acervo/' + id + '.webp'});
  }
  return [...byId.values()];
}

// O CDN pode responder com uma página HTML de bloqueio mesmo em HTTP 200.
export function validArchiveWebp(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 26 || bytes.length > MAX_BYTES ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' ||
      bytes.readUInt32LE(4) + 8 !== bytes.length) return false;
  let hasStillImage = false;
  let i = 12;
  while (i + 8 <= bytes.length) {
    const type = bytes.toString('ascii', i, i + 4);
    const length = bytes.readUInt32LE(i + 4);
    const payload = i + 8;
    i = payload + length + (length % 2);
    if (i > bytes.length) return false;
    if (type === 'VP8 ' && length >= 10) {
      hasStillImage ||= bytes.readUIntLE(payload + 3, 3) === 0x2a019d &&
        (bytes.readUInt16LE(payload + 6) & 0x3fff) > 0 &&
        (bytes.readUInt16LE(payload + 8) & 0x3fff) > 0;
    }
    if (type === 'VP8L' && length >= 5) hasStillImage ||= bytes[payload] === 0x2f;
  }
  return hasStillImage && i === bytes.length;
}

async function readPhoto(url, fetcher) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(url, {
        redirect:'error', signal:AbortSignal.timeout(6_000), headers:{Accept:'image/webp'}
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status < 500 && response.status !== 429) return null;
        throw new Error('HTTP ' + response.status);
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) {
        await response.body?.cancel();
        return null;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return validArchiveWebp(bytes) ? bytes : null;
    } catch {
      if (attempt === 0) await delay(200);
    }
  }
  return null;
}

async function replaceFile(target, bytes) {
  const temp = target + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, bytes);
    await rename(temp, target);
  } finally {
    await rm(temp, {force:true});
  }
}

async function saveRules(outDir, rules) {
  const target = join(outDir, '_redirects');
  let previous = '';
  try { previous = await readFile(target, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const match = previous.indexOf(START);
  if (match >= 0) {
    const end = previous.indexOf(END, match);
    if (end < 0) throw new Error('Bloco de fotos incompleto em _redirects.');
    previous = previous.slice(0, match) + previous.slice(end + END.length).replace(/^\r?\n/, '');
  }
  // As correspondências exatas devem vir antes de eventuais rotas curingas do site.
  const next = rules.length ? [START, ...rules, END, ''].join('\n') + previous : previous;
  if (next) await replaceFile(target, next);
  else await rm(target, {force:true});
}

export async function prepareArchiveImages(archive, {
  outDir, download = false, fetcher = fetch,
  cacheDir = join(dirname(outDir), 'node_modules', '.cache', 'felipe-modas', 'fotos-acervo'),
  budgetMs = 90_000,
}) {
  const jobs = photoJobs(archive);
  const dir = join(outDir, 'assets', 'products', 'acervo');
  await mkdir(dir, {recursive:true});
  const deadline = Date.now() + budgetMs;
  const requests = new Map();
  async function recover(url) {
    // O nome no cache deriva da URL completa, inclusive o hash usado pelo fornecedor.
    const key = createHash('sha256').update(url).digest('hex');
    const cached = join(cacheDir, key + '.webp');
    try {
      const bytes = await readFile(cached);
      if (validArchiveWebp(bytes)) return bytes;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!download || Date.now() >= deadline) return null;
    const bytes = await readPhoto(url, fetcher);
    if (bytes) {
      await mkdir(cacheDir, {recursive:true});
      await replaceFile(cached, bytes);
    }
    return bytes;
  }
  let cursor = 0;
  const missing = new Set();
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const file = join(dir, job.id + '.webp');
      if (!requests.has(job.image)) requests.set(job.image, recover(job.image));
      const bytes = await requests.get(job.image);
      if (bytes) await replaceFile(file, bytes);
      else {
        // Evita que um arquivo antigo oculte a regra para a foto atual deste ID.
        await rm(file, {force:true});
        missing.add(job.id);
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(8,jobs.length)}, worker));
  const fallback = jobs.filter(job => missing.has(job.id));
  await saveRules(outDir, fallback.map(job => job.path + ' ' + job.image + ' 200'));
  return {total:jobs.length, local:jobs.length - fallback.length, proxied:fallback.length};
}
