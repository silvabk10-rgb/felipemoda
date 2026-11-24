// O HTML do guia é a fonte tanto para leitura acessível como para exportação.
const WIDTH = 1080;
const EDGE = 66;
const INNER = WIDTH - EDGE * 2;
const colors = {
  paper: '#FAF8F1', ink: '#202020', muted: '#514A44', accent: '#884F32',
  border: '#D0BDAA', alternate: '#F2ECE3', white: '#FFFFFF'
};
const UI = 'Arial, sans-serif';
const DISPLAY = 'Georgia, serif';
const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const content = element => clean(element?.textContent);

export function readGuideModel(section) {
  const table = section.querySelector('table');
  if (!table || !table.tHead?.rows.length) throw new Error('Tabela sem cabeçalho.');
  const headers = Array.from(table.tHead.rows[0].cells, content);
  const rows = Array.from(table.tBodies).flatMap(body =>
    Array.from(body.rows, row => Array.from(row.cells, content)));
  const name = content(section.querySelector('[data-guia-nome]'));
  if (!name || !headers.length || !rows.length || rows.some(row => row.length !== headers.length)) {
    throw new Error('Confira a estrutura da tabela.');
  }
  return {
    name, slug: section.dataset.modeloSlug, caption: content(table.caption), headers, rows,
    notes: Array.from(section.querySelectorAll('[data-guia-nota]'), content).filter(Boolean)
  };
}

function wrap(context, value, width, font) {
  context.font = font;
  const lines = [];
  let line = '';
  for (const word of clean(value).split(' ')) {
    const joined = line ? line + ' ' + word : word;
    if (context.measureText(joined).width <= width) {
      line = joined;
      continue;
    }
    if (line) lines.push(line);
    line = '';
    for (const letter of word) {
      if (line && context.measureText(line + letter).width > width) {
        lines.push(line);
        line = '';
      }
      line += letter;
    }
  }
  lines.push(line);
  return lines;
}

// Mantém a primeira coluna como chave quando houver muitas medidas para uma linha no celular.
function blocks(headers) {
  if (headers.length <= 3) return [headers.map((_, index) => index)];
  const sections = [];
  for (let i = 1; i < headers.length; i += 2) {
    sections.push(i + 1 < headers.length ? [0, i, i + 1] : [0, i]);
  }
  return sections;
}

function render(context, model, logo, painting) {
  let y = 60;
  function rect(x, top, w, h, fill) {
    if (!painting) return;
    context.fillStyle = fill;
    context.fillRect(x, top, w, h);
  }
  function print(lines, x, top, lineHeight, font, color) {
    if (!painting) return;
    context.font = font;
    context.fillStyle = color;
    context.textBaseline = 'top';
    lines.forEach((line, index) => context.fillText(line, x, top + index * lineHeight));
  }
  function paragraph(value, font, lineHeight, color, max = INNER) {
    const lines = wrap(context, value, max, font);
    print(lines, EDGE, y, lineHeight, font, color);
    y += lines.length * lineHeight;
  }
  if (painting) {
    context.drawImage(logo, EDGE, y, 300, 300 * logo.height / logo.width);
  }
  y += 86;
  rect(EDGE, y, INNER, 2, colors.border);
  y += 42;
  paragraph('GUIA DE MEDIDAS', 'bold 30px ' + UI, 39, colors.accent);
  y += 14;
  paragraph(model.name, '62px ' + DISPLAY, 72, colors.ink);
  const repeatedCaption = model.caption === model.name || model.caption === 'Tabela de tamanhos · ' + model.name;
  if (model.caption && !repeatedCaption) {
    y += 18;
    paragraph(model.caption, '37px ' + UI, 48, colors.muted);
  }
  y += 34;
  for (const [part, columns] of blocks(model.headers).entries()) {
    if (part) y += 24;
    const ratios = columns.length === 1 ? [1] : columns.length === 2 ? [.34, .66] : [.25, .375, .375];
    const widths = ratios.map(ratio => ratio * INNER);
    function row(values, header, index) {
      const cellPad = 18;
      const lineHeight = header ? 42 : 47;
      const font = header ? 'bold 34px ' + UI : '39px ' + UI;
      const cells = columns.map((column, i) => wrap(context, values[column], widths[i] - cellPad * 2, font));
      const height = Math.max(...cells.map(cell => cell.length)) * lineHeight + cellPad * 2;
      rect(EDGE, y, INNER, height, header ? colors.ink : index % 2 ? colors.alternate : colors.white);
      let x = EDGE;
      for (const [i, cell] of cells.entries()) {
        const top = y + (height - cell.length * lineHeight) / 2;
        print(cell, x + cellPad, top, lineHeight, font, header ? colors.white : colors.ink);
        x += widths[i];
      }
      y += height;
    }
    row(model.headers, true, 0);
    model.rows.forEach((values, index) => row(values, false, index));
    rect(EDGE, y, INNER, 2, colors.border);
  }
  for (const note of model.notes) {
    y += 24;
    paragraph(note, '35px ' + UI, 46, colors.muted);
  }
  y += 38;
  rect(EDGE, y, INNER, 2, colors.border);
  y += 27;
  paragraph('felipemodasbr.com', '32px ' + UI, 40, colors.muted);
  return Math.ceil(y + 50);
}

export function drawGuide(model, logo, newCanvas) {
  const canvas = newCanvas(WIDTH, 1);
  const context = canvas.getContext('2d');
  if (!context || !logo?.width || !logo.height) throw new Error('Não foi possível montar a imagem.');
  canvas.height = render(context, model, logo, false);
  context.fillStyle = colors.paper;
  context.fillRect(0, 0, WIDTH, canvas.height);
  render(context, model, logo, true);
  return canvas;
}

function install(document) {
  let logoPending;
  const getLogo = () => {
    if (!logoPending) {
      logoPending = new Promise((resolve, reject) => {
        const logo = new Image();
        logo.onload = () => resolve(logo);
        logo.onerror = () => reject(new Error('Não foi possível abrir a marca.'));
        logo.src = '/assets/brand/logo.png';
      }).catch(error => {
        logoPending = undefined;
        throw error;
      });
    }
    return logoPending;
  };
  const newCanvas = (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
  for (const section of document.querySelectorAll('[data-guia-modelo]')) {
    const button = section.querySelector('[data-baixar-tabela]');
    const status = section.querySelector('[data-guia-status]');
    if (!button || !status || !section.querySelector('table')) continue;
    let href;
    let slug;
    button.hidden = false;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        if (!href) {
          status.textContent = 'Preparando a imagem…';
          const model = readGuideModel(section);
          slug = model.slug;
          const canvas = drawGuide(model, await getLogo(), newCanvas);
          const blob = await new Promise((resolve, reject) =>
            canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao exportar.')), 'image/png'));
          href = URL.createObjectURL(blob);
        }
        const link = document.createElement('a');
        link.href = href;
        link.download = 'Felipe-Modas-' + slug + '-medidas.png';
        status.replaceChildren(link);
        link.click();
        const view = document.createElement('a');
        view.href = href;
        view.target = '_blank';
        view.rel = 'noopener';
        view.textContent = 'Abrir a imagem';
        status.replaceChildren('PNG pronto. ', view);
      } catch {
        status.textContent = 'Não foi possível gerar a imagem. Você pode tentar novamente ou consultar a tabela acima.';
      } finally {
        button.disabled = false;
      }
    });
  }
}

if (typeof document !== 'undefined') install(document);
