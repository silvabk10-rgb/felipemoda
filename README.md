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
| `data/curadoria.json` e `data/GUIA-CURADORIA.md` | Fichas, preços e tabelas dos 12 modelos da curadoria |
| `catalogo.js` e `data/acervo-loja.mjs` | 235 produtos da vitrine anterior, com 916 variantes originais e estoque próprio |
| `commerce/config.mjs` | Campanha e modalidades de frete com preço fixo por pedido |
| `/checkout/` | Finalização em uma página, escolha de frete, cartão de crédito em uma parcela e acompanhamento do pedido |
| `institucional/build.mjs` | Cadastro da empresa, contato e políticas |
| `docs/identidade.md`, `docs/fotografia.md` | Paleta, aplicação da marca, direção de arte e origem dos ativos |
| `docs/operacao.md`, `docs/comercio.md` | Atendimento, homologação, pagamentos e publicação |

## Catálogo e prévias

O preço de cada uma das 12 fichas corresponde ao preço principal de varejo conferido no respectivo fornecedor. A loja aprovou esses valores em 24/11/2026. O preço da vitrine segue o valor regular aprovado pela Felipe Modas. As medidas e equivalências são específicas de cada modelo.

As galerias usam fotografias de produto dos fornecedores, com uso autorizado pelo lojista. Os arquivos WebP são servidos pelo próprio site. Cada entrada da galeria conserva a origem para auditoria. As imagens editoriais de campanha têm uso e origem descritos separadamente em `docs/fotografia.md`.

Em 24/11/2026, a loja confirmou o saldo inicial de 10.000 unidades para cada uma das 70 variantes da curadoria e das 916 variantes restauradas do acervo. As vendas e as reservas são descontadas pelo serviço de pedidos. O guia em `/guia-de-medidas/` reúne as tabelas dos 12 modelos com dados de medidas e permite baixar cada uma em PNG. As fichas do acervo apresentam a grade de tamanhos original. O frete é fixo por pedido, com PAC a R$ 23,00 ou SEDEX a R$ 48,00.

Os produtos do acervo conservam os IDs, os preços das variantes, as fotografias e as categorias da vitrine anterior. A migração da sacola usa os IDs originais de produto e variante. O build baixa as fotos do acervo, valida o WebP e utiliza um endereço local para cada foto. Se o arquivo estiver indisponível durante o build, a Netlify encaminha esse endereço à foto original registrada para o produto.

As prévias de pull requests seguem a configuração de acesso da equipe na Netlify. Confira o cadastro empresarial e os requisitos operacionais em `docs/operacao.md` e `docs/comercio.md` antes da abertura comercial.

A proposta de cupom BEMVINDA10 permanece desativada. O cliente informa contato e endereço, escolhe a entrega e paga exclusivamente por cartão de crédito em uma parcela na mesma página. A Pagar.me (Stone) precisa habilitar o cartão no estabelecimento e confirmar a transação. Os testes automatizados usam um provedor controlado e não iniciam cobranças reais.
