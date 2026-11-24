import test from 'node:test';
import assert from 'node:assert/strict';
import { drawGuide, readGuideModel } from '../institucional/tabela-canvas.mjs';

const element = textContent => ({textContent});
const row = values => ({cells: values.map(element)});

function guideFixture({name, caption, headers, rows, notes = []}) {
  const table = {
    tHead: {rows: [row(headers)]},
    tBodies: [{rows: rows.map(row)}],
    caption: element(caption)
  };
  return {
    dataset: {modeloSlug:'peca'},
    querySelector: selector => selector === 'table' ? table : element(name),
    querySelectorAll: () => notes.map(element)
  };
}

function observedExport(model) {
  const words = [];
  const logo = {width:1800,height:296};
  let usedLogo;
  const context = {
    measureText: text => ({width:Array.from(text).length * 17}),
    fillText: (text, x, y) => words.push({text,x,y}),
    drawImage: image => {usedLogo = image;}, fillRect() {}
  };
  const canvas = drawGuide(model, logo, (width, height) => ({width,height,getContext:()=>context}));
  assert.equal(usedLogo, logo);
  assert.equal(canvas.width, 1080);
  assert.ok(words.every(entry => entry.y >= 0 && entry.y < canvas.height));
  return words.map(entry => entry.text);
}

test('a equivalência de numeração permanece sem unidade de comprimento', () => {
  const model = readGuideModel(guideFixture({
    name:'Vestido modelo', caption:'Equivalência de numeração',
    headers:['Tamanho', 'Numeração brasileira'], rows:[['P', '36–38'], ['M','40–42']]
  }));
  assert.deepEqual(model.rows, [['P','36–38'], ['M','40–42']]);
  const text = observedExport(model).join(' ');
  assert.match(text, /Numeração brasileira/u);
  assert.match(text, /36–38/u);
  assert.doesNotMatch(text, /\bcm\b/iu);
});

test('o comprimento desconhecido do GG de Lara permanece explícito', () => {
  const model = readGuideModel(guideFixture({
    name:'Vestido jeans Lara escuro', caption:'Comprimento da peça',
    headers:['Tamanho','Comprimento do busto à barra (cm)'],
    rows:[['P','130'],['M','130'],['G','133'],['GG','Não informado']],
    notes:['Compare com um vestido seu.']
  }));
  assert.deepEqual(model.rows.at(-1), ['GG','Não informado']);
  const words = observedExport(model);
  assert.equal(words.filter(word => word === '133').length, 1);
  assert.equal(words[words.indexOf('GG') + 1], 'Não informado');
  assert.ok(words.includes('Compare com um vestido seu.'));
});

test('colunas largas preservam cada valor e repetem a identificação da linha', () => {
  const model = readGuideModel(guideFixture({
    name:'Modelo', caption:'Guia do modelo',
    headers:['Tamanho','Busto','Cintura','Quadril','Comprimento'], rows:[['P','A','B','C','D']]
  }));
  const words = observedExport(model);
  assert.equal(words.filter(word => word === 'P').length, 2);
  for (const value of ['A','B','C','D']) assert.equal(words.filter(word => word === value).length, 1);
});
