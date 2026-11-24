import {draw,getDefaults} from './render.mjs';
import {artworks} from '../theme/campaigns.mjs';

const $ = id => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const fields = ['overline','title','cta','font','color','size','align','x','y','width','shade','shadeColor','focusX','focusY','zoom','logo','corner'];
const numeric = ['size','x','y','width','shade','focusX','focusY','zoom'];
const labels = {hero:'Carrossel',cat:'Acesso à categoria',mini:'Mini banner',head:'Cabeçalho da categoria',editorial:'Editorial'};
const sections = {colecao:'Coleção',vestidos:'Vestidos',conjuntos:'Conjuntos',calcas:'Calças',novidades:'Novidades',looks:'Looks'};
const bitmaps = new Map();
const drafts = new Map();
let sizes, current, artwork, format = 'desktop', loadVersion = 0, paintVersion = 0, gesture;

function notice(message, error = false) {
  $('notice').textContent = message;
  $('notice').toggleAttribute('data-error', error);
}
function humanName(key) {
  const [type, subject] = key.split('-');
  return subject ? labels[type] + ' · ' + sections[subject] : labels[type];
}
// Save each format independently, including an optional local file, without a server.
const dbRequest = new Promise(resolve => {
  try {
    const request = indexedDB.open('felipe-modas-estudio-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('rascunhos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () => resolve(null);
  } catch { resolve(null); }
});
async function stored(key) {
  const db = await dbRequest;
  if (!db) return null;
  return new Promise(resolve => {
    const req = db.transaction('rascunhos').objectStore('rascunhos').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
function bitmap(url) {
  if (!bitmaps.has(url)) {
    bitmaps.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {bitmaps.delete(url);reject(new Error('Falha ao abrir imagem.'));};
      img.src = url;
    }));
  }
  return bitmaps.get(url);
}
function localPhoto(draft) {
  if (!draft.photo) return null;
  if (!draft.objectURL) draft.objectURL = URL.createObjectURL(draft.photo);
  return draft.objectURL;
}
function removeLocalPhoto(draft) {
  if (draft.objectURL) {
    bitmaps.delete(draft.objectURL);
    URL.revokeObjectURL(draft.objectURL);
    delete draft.objectURL;
  }
  draft.photo = null;
}
function sync() {
  for (const name of fields) $(name).value = current[name];
  for (const name of numeric) $(name+'-out').value = current[name]+'%';
  document.querySelectorAll('[data-format]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.format === format));
  });
  $('piece').value = artwork.key;
  $('photo-reset').disabled = !current.photo;
}
async function selectPiece(key, mode) {
  const request = ++loadVersion;
  ++paintVersion;
  const next = artworks.find(a => a.key === key);
  const storageKey = key+'-'+mode;
  $('export').disabled = $('save').disabled = $('edit').disabled = true;
  let draft = drafts.get(storageKey);
  if (!draft) {
    const saved = await stored(storageKey);
    draft = {...getDefaults(next,mode), ...saved};
    drafts.set(storageKey,draft);
  }
  if (request !== loadVersion) return;
  artwork = next; format = mode; current = draft;
  $('piece-name').textContent = humanName(key);
  $('upload').value = '';
  $('edit').disabled = false;
  sync();
  await paint();
}
async function paint() {
  const token = ++paintVersion;
  const row = sizes.get(artwork.key+'-'+format+'.webp');
  const path = localPhoto(current) || '/assets/campaign/'+row.target;
  const logoName = {light:'logo-light',dark:'logo',mono:'logo-mono'}[current.logo];
  $('export').disabled = true;
  try {
    const [img,logo] = await Promise.all([bitmap(path),logoName ? bitmap('/assets/brand/'+logoName+'.png') : null]);
    if (token !== paintVersion) return;
    draw(ctx,img,logo,current,row.width,row.height);
    $('resolution').textContent = row.width+' × '+row.height+' px';
    $('export').disabled = $('save').disabled = false;
    notice('Arraste o texto na prévia para reposicioná-lo.');
    canvas.dataset.ready = artwork.key+'-'+format;
    canvas.dispatchEvent(new Event('studio-ready'));
  } catch {
    if (token === paintVersion) notice('A imagem desta composição não abriu. Selecione outra fotografia ou tente novamente.',true);
  }
}
for (const name of fields) {
  $(name).addEventListener('input', () => {
    current[name] = numeric.includes(name) ? Number($(name).value) : $(name).value;
    if (numeric.includes(name)) $(name+'-out').value=current[name]+'%';
    paint();
  });
}
$('controls').addEventListener('submit',e => e.preventDefault());
$('piece').addEventListener('change',e => selectPiece(e.target.value,format));
document.querySelectorAll('[data-format]').forEach(button => {
  button.addEventListener('click',() => selectPiece(artwork.key,button.dataset.format));
});
canvas.addEventListener('pointerdown',e => {
  if (!current || e.button !== 0) return;
  canvas.setPointerCapture(e.pointerId);
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,left:current.x,top:current.y};
});
canvas.addEventListener('pointermove',e => {
  if (!gesture || gesture.id !== e.pointerId) return;
  const box=canvas.getBoundingClientRect();
  current.x=Math.min(96,Math.max(4,Math.round(gesture.left+(e.clientX-gesture.x)/box.width*100)));
  current.y=Math.min(96,Math.max(4,Math.round(gesture.top+(e.clientY-gesture.y)/box.height*100)));
  sync(); paint();
});
canvas.addEventListener('lostpointercapture',() => {gesture=null;});
$('upload').addEventListener('change',async () => {
  const draft=current, file=$('upload').files[0];
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) {
    notice('Escolha uma foto JPEG, PNG, WebP ou AVIF.',true);return;
  }
  const url=URL.createObjectURL(file);
  try {
    await bitmap(url);
    removeLocalPhoto(draft); draft.photo=file; draft.objectURL=url;
    if (current===draft) {sync();await paint();}
  } catch {
    URL.revokeObjectURL(url);
    notice('Não foi possível ler essa fotografia. Escolha outro arquivo.',true);
  }
});
$('photo-reset').addEventListener('click',() => {
  removeLocalPhoto(current); $('upload').value=''; sync(); paint();
});
$('save').addEventListener('click',async () => {
  const key=artwork.key+'-'+format;
  const value={...current};delete value.objectURL;
  const db=await dbRequest;
  try {
    if (!db) throw new Error();
    await new Promise((resolve,reject) => {
      const tx=db.transaction('rascunhos','readwrite');
      tx.oncomplete=resolve;tx.onerror=tx.onabort=reject;
      tx.objectStore('rascunhos').put(value,key);
    });
    notice('Rascunho salvo neste navegador.');
  } catch {notice('O rascunho não foi salvo. Você ainda pode exportar o PNG.',true);}
});
$('export').addEventListener('click',() => {
  const filename='felipe-modas-'+artwork.key+'-'+format+'.png';
  canvas.toBlob(blob => {
    if (!blob) {notice('Não foi possível exportar esta composição.',true);return;}
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a'); anchor.href=url;anchor.download=filename;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url),30000);
    notice('PNG pronto para download.');
  },'image/png');
});
async function start() {
  const response=await fetch('/assets/campaign/composicoes.json');
  if (!response.ok) throw new Error();
  sizes = new Map((await response.json()).map(row=>[row.target,row]));
  for (const a of artworks) {
    const option=document.createElement('option');
    option.value=a.key;option.textContent=humanName(a.key);$('piece').append(option);
  }
  await selectPiece(artworks[0].key,'desktop');
}
start().catch(() => notice('As peças do estúdio não carregaram. Recarregue a página para tentar novamente.',true));
