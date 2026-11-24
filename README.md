# Felipe Modas

Loja em português do Brasil, construída em HTML estático com JavaScript para a sacola, busca, filtros e editores de arte. O catálogo editável alimenta tanto as páginas de produto como as funções de comércio.

## Rodar e revisar

Requer Node.js 22.11 ou posterior. Execute `npm ci`, `npm test` e `npm run build`. Sirva `dist/` com um servidor HTTP estático para navegar nas páginas. Use `netlify dev` para testar as funções e sua configuração de homologação. O site publicado usa o projeto Netlify **felipemoda**.

| Arquivo / rota | Finalidade |
| --- | --- |
| `theme/campaigns.mjs` | Chamadas, destinos e textos alternativos das 13 peças editoriais |
| `assets/campaign/` | 26 fotografias WebP e manifesto de composição |
| `assets/brand/` | Assinaturas PNG, estudos e matriz HTML Canvas da marca |
| `/arte/` na prévia | Estúdio Canvas de campanhas, edição das camadas e exportação PNG |
| `/arte/marca.html` na prévia | Ateliê Canvas do logotipo |
| `data/curadoria.json` e `data/GUIA-CURADORIA.md` | Doze fichas, dados de referência e instruções de importação e ativação |
| `commerce/config.mjs` | Campanha e tabela de frete por CEP |
| `institucional/build.mjs` | Cadastro da empresa, contato e políticas |
| `docs/identidade.md`, `docs/fotografia.md` | Paleta, aplicação da marca, direção de arte e origem dos ativos |
| `docs/operacao.md`, `docs/comercio.md` | Atendimento, homologação, pagamentos e publicação |

## Catálogo e prévias

As 12 fichas foram conferidas nas páginas dos fornecedores. Os preços de referência, as propostas e os saldos de terceiros ficam fora do conteúdo servido ao navegador. As medidas aparecem apenas nas fichas para as quais a fonte forneceu esses dados. As campanhas exibem fotografia editorial original. Insira fotografias autorizadas da peça em `assets/products/` para habilitar sua galeria. As matrizes PNG de fotografia são entregues no kit original.

O arquivo histórico `catalogo.js` conserva as 235 referências da Stella Basic. Seus preços e saldos vieram de uma coleta de terceiros. O build usa seus identificadores para recuperar a seleção do carrinho anterior. Produtos com preço, saldo, grade e fotos próprios podem ser cadastrados na coleção ativa.

Pull requests da branch de trabalho geram uma prévia conforme a configuração da Netlify. Na prévia os modelos em curadoria são consultáveis por categoria e nome, com fichas tipográficas quando não há foto autorizada. O build comercial exige os dados empresariais e comerciais descritos na documentação. Configure a razão social, o endereço, preços, saldos, fotos e frete antes de habilitar o pagamento. O CNPJ, e-mail e WhatsApp reproduzem o cadastro existente da loja.

A proposta de cupom BEMVINDA10 permanece desativada. O checkout preparado usa Pix pela Pagar.me mediante homologação. Os testes automatizados usam um provedor controlado e não iniciam cobranças reais.
