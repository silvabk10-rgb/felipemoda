import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildInstitutional, company } from '../institucional/build.mjs';
import { makeLayout } from '../theme/layout.mjs';

test('identificação do vendedor no rodapé e nos termos de compra', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'fm-empresa-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const layout = makeLayout({ origin: 'https://felipemodasbr.com', indexable: false });
  await buildInstitutional({ outDir, layout });
  const terms = await readFile(join(outDir, 'termos-de-compra', 'index.html'), 'utf8');
  const legalName = '68.293.261 LUIS FILIPE CARDOSO DO AMARAL';
  assert.equal(company.legalName, legalName);
  assert.equal(company.name, 'Felipe Modas');
  const address = '10A Rua Rua Tiradentes, 23, Centro, Porto Seguro/BA, CEP 45810-000';
  assert.equal(company.address, address);
  assert.ok(terms.includes('<dt>Endereço cadastral</dt><dd>' + address + '</dd>'));
  assert.ok(terms.includes('<dt>Razão social</dt><dd>' + legalName + '</dd>'));
  const footer = terms.slice(terms.indexOf('<footer '));
  assert.ok(footer.includes('Razão social ' + legalName));
  assert.ok(footer.includes('CNPJ 68.293.261/0001-80'));
  assert.ok(footer.includes('<address>Endereço cadastral · ' + address + '</address>'));
  const contact = await readFile(join(outDir, 'atendimento', 'index.html'), 'utf8');
  assert.match(contact, /instruções de postagem ou coleta/);
});

test('políticas e FAQ exibem o frete por pedido e a situação dos pagamentos', async t => {
  const outDir = await mkdtemp(join(tmpdir(), 'fm-politicas-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const layout = ({ body }) => body;
  for (const checkoutEnabled of [false, true]) {
    await buildInstitutional({ outDir, layout, checkoutEnabled });
    for (const route of ['entregas', 'perguntas-frequentes', 'termos-de-compra']) {
      const html = await readFile(join(outDir, route, 'index.html'), 'utf8');
      assert.match(html, /PAC por R\$\s23,00 ou SEDEX por R\$\s48,00/);
      assert.match(html, /uma única vez por pedido/);
      if (route === 'entregas') continue;
      if (checkoutEnabled) {
        assert.match(html, /em uma única página/);
        assert.match(html, /cartão de crédito, quando oferecido/);
      } else {
        assert.match(html, /pagamento online está indisponível/);
      }
    }
    const privacy = await readFile(join(outDir, 'privacidade', 'index.html'), 'utf8');
    assert.match(privacy, /apenas o CEP ao ViaCEP/);
  }
});
