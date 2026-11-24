export function getDefaults(a, mode) {
  const mobile = mode === 'mobile';
  const category = a.key.startsWith('cat-');
  const header = a.key.startsWith('head-');
  const editorial = a.key === 'editorial';
  const onLight = !mobile && (a.key.startsWith('hero-') || ['head-conjuntos','head-calcas','mini-looks'].includes(a.key));
  const right = editorial && !mobile;
  return {
    overline:a.overline || '', title:a.title || '', cta:a.cta || '', font:'serif',
    color:onLight ? '#211d19' : '#ffffff', shadeColor:onLight ? '#fffaf0' : '#201913',
    align:right ? 'right' : 'left', x:right ? 93 : 7, y:category || mobile ? 77 : 58,
    width:mobile || category ? 85 : 48, size:header && !mobile ? 15 : category ? 9 : 9.5,
    shade:mobile || category ? 70 : onLight ? 43 : 72,
    focusX:50, focusY:50, zoom:100, logo:onLight ? 'dark' : 'light', corner:right ? 'tr' : 'tl',
    photo:null
  };
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.trim().split(/\n/)) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const candidate = line ? line+' '+word : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}
const serif = 'Georgia, "Times New Roman", serif';
const sans = 'Arial, Helvetica, sans-serif';
function typography(ctx, s, unit, maxWidth) {
  const display = (s.font === 'italic' ? 'italic ' : '') + '400 '+unit+'px '+(s.font === 'sans' ? sans : serif);
  const small = Math.max(12, Math.min(ctx.canvas.width, ctx.canvas.height) * .024);
  const under = Math.max(15, Math.min(ctx.canvas.width, ctx.canvas.height) * .031);
  ctx.font = display;
  const main = s.title.trim() ? wrap(ctx, s.title,maxWidth) : [];
  ctx.font = '600 '+small+'px '+sans;
  const label = s.overline.trim() ? wrap(ctx, s.overline.toLocaleUpperCase('pt-BR'),maxWidth) : [];
  ctx.font = '500 '+under+'px '+sans;
  const cta = s.cta.trim() ? wrap(ctx, s.cta,maxWidth) : [];
  const labelH = label.length ? label.length*small*1.25 + small*.72 : 0;
  const mainH = main.length*unit*1.12;
  const callH = cta.length ? under*.62 + cta.length*under*1.35 + under*.3 : 0;
  return {display,unit,small,under,label,main,cta,labelH,mainH,callH,height:labelH+mainH+callH};
}
export function draw(ctx, photo, logo, s, w, h) {
  const canvas = ctx.canvas;
  if (canvas.width !== w || canvas.height !== h) {canvas.width=w;canvas.height=h;}
  ctx.save();
  ctx.clearRect(0,0,w,h);
  const scale = Math.max(w/photo.naturalWidth,h/photo.naturalHeight)*(s.zoom/100);
  const dw = photo.naturalWidth*scale, dh = photo.naturalHeight*scale;
  ctx.drawImage(photo,(w-dw)*s.focusX/100,(h-dh)*s.focusY/100,dw,dh);
  const portrait = h >= w;
  const onRight = s.align === 'right' || (s.align === 'center' && s.x > 50);
  const gradient = portrait
    ? ctx.createLinearGradient(0,s.y > 50 ? h : 0,0,s.y > 50 ? 0 : h)
    : ctx.createLinearGradient(onRight ? w : 0,0,onRight ? 0 : w,0);
  const rgb = s.shadeColor;
  gradient.addColorStop(0,rgb);
  gradient.addColorStop(.43,rgb+'cc');
  gradient.addColorStop(1,rgb+'00');
  ctx.globalAlpha=s.shade/100;
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=1;
  const short = Math.min(w,h);
  const margin = short * .043;
  const maxWidth = Math.min(w*s.width/100,w-2*margin);
  const leftOffset = s.align === 'center' ? maxWidth/2 : s.align === 'right' ? maxWidth : 0;
  const x = Math.min(w-margin-maxWidth+leftOffset,Math.max(margin+leftOffset,w*s.x/100));
  let design = typography(ctx,s,short*s.size/100,maxWidth);
  for (let count=0; design.height > h-2*margin && count<15; count++)
    design=typography(ctx,s,design.unit*.90,maxWidth);
  let top = Math.max(margin,Math.min(h-margin-design.height,h*s.y/100-design.height/2));
  ctx.fillStyle=s.color; ctx.textAlign=s.align; ctx.textBaseline='top';
  ctx.font='600 '+design.small+'px '+sans;
  design.label.forEach((line,i) => ctx.fillText(line,x,top+i*design.small*1.25));
  top+=design.labelH;
  ctx.font=design.display;
  design.main.forEach((line,i) => ctx.fillText(line,x,top+i*design.unit*1.12));
  top+=design.mainH + design.under*.62;
  ctx.font='500 '+design.under+'px '+sans;
  design.cta.forEach((line,i) => {
    const offset = ctx.measureText(line).width;
    const start = s.align === 'left' ? x : s.align === 'right' ? x-offset : x-offset/2;
    const y = top+i*design.under*1.35;
    ctx.fillText(line,x,y);
    ctx.fillRect(start,y+design.under*1.23,offset,Math.max(1,short*.0016));
  });
  if (logo) {
    const lw = Math.min(w*(portrait ? .27 : .16),short*.36), lh=lw*logo.naturalHeight/logo.naturalWidth;
    const inset = Math.max(margin,w*.055);
    ctx.drawImage(logo,s.corner.endsWith('r') ? w-inset-lw : inset,s.corner.startsWith('b') ? h-margin-lh : margin,lw,lh);
  }
  ctx.restore();
}
