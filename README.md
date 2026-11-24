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
| `commerce/config.mjs` | Campanha e modalidades de frete com preço fixo por pedido |
| `/checkout/` | Finalização em uma página, escolha de frete, cartão de crédito em uma parcela e acompanhamento do pedido |
| `institucional/build.mjs` | Cadastro da empresa, contato e políticas |
| `docs/identidade.md`, `docs/fotografia.md` | Paleta, aplicação da marca, direção de arte e origem dos ativos |
| `docs/operacao.md`, `docs/comercio.md` | Atendimento, homologação, pagamentos e publicação |

## Catálogo e prévias

O preço de cada uma das 12 fichas corresponde ao preço principal de varejo conferido no respectivo fornecedor. A loja aprovou esses valores em 24/11/2026. O preço da vitrine segue o valor regular aprovado pela Felipe Modas. As medidas e equivalências são específicas de cada modelo.

As galerias usam fotografias de produto dos fornecedores, com uso autorizado pelo lojista. Os arquivos WebP são servidos pelo próprio site. Cada entrada da galeria conserva a origem para auditoria. As imagens editoriais de campanha têm uso e origem descritos separadamente em `docs/fotografia.md`.

Os 12 modelos possuem variantes ativas. Em 24/11/2026, a loja informou o saldo inicial de 10.000 unidades por combinação de cor e tamanho da grade documentada. As vendas e as reservas são descontadas pelo serviço de pedidos. O guia em `/guia-de-medidas/` reúne as tabelas da coleção e permite baixar cada uma em PNG. O frete é fixo por pedido, com PAC a R$ 23,00 ou SEDEX a R$ 48,00. As 235 referências históricas da Stella Basic permanecem em `catalogo.js` para migrar a seleção do carrinho anterior.

As prévias de pull requests seguem a configuração de acesso da equipe na Netlify. Confira o cadastro empresarial e os requisitos operacionais em `docs/operacao.md` e `docs/comercio.md` antes da abertura comercial.

A proposta de cupom BEMVINDA10 permanece desativada. O cliente informa contato e endereço, escolhe a entrega e paga exclusivamente por cartão de crédito em uma parcela na mesma página. A Pagar.me (Stone) precisa habilitar o cartão no estabelecimento e confirmar a transação. Os testes automatizados usam um provedor controlado e não iniciam cobranças reais.
