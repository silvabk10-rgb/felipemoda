# Validação da prévia

A Netlify publicou o pull request 1 no projeto felipemoda. O acesso usa a configuração de proteção da equipe. Foi possível abrir a home na sessão autorizada do Safari e confirmar a campanha “Entre luz e forma”, as rotas de categorias e os contatos existentes. No Safari, o carrossel abriu a campanha de vestidos e a busca sem acento por “leticia” retornou apenas o Vestido longo floral Letícia. O acesso à ficha abriu a rota própria e a seção Medidas mostrou 119 cm de comprimento, conforme a ficha cadastrada. O rodapé exibe CNPJ 68.293.261/0001-80.

## Telas da primeira prévia

Home, coleção de vestidos e produto Vestido longo floral Letícia foram renderizados com os estilos e imagens da compilação. O Safari conferiu as larguras 360, 390, 430, 768, 1024 e 1440 px para cada uma das três páginas. As 18 combinações mantiveram a largura do conteúdo dentro da janela e carregaram as imagens verificadas. A conferência de referências locais dos 34 documentos HTML, incluindo os editores Canvas, encontrou destinos existentes.

Os dois editores ficam disponíveis na prévia. A marca e os banners são exportados em PNG. No Safari foi verificada a troca de formato no estúdio e a exportação de 750 × 1000 px.

## Peso dos arquivos

Medições da compilação de 24/11/2026, com as 12 galerias de produto integradas. Os tamanhos correspondem aos arquivos antes da compressão HTTP.

| Recurso | Meta | Medido |
| --- | ---: | ---: |
| HTML da home | até 30 KB | 22.925 bytes |
| Primeiro slide desktop | até 120 KB | 99.698 bytes |
| Primeiro slide celular | até 90 KB | 73.330 bytes |
| Dois arquivos CSS compartilhados | até 35 KB | 24.624 bytes |
| 26 WebP de campanha no pacote | até 2,5 MB | 2.024.548 bytes |

O primeiro banner usa prioridade alta. Cada dispositivo solicita o recorte correspondente. As fotos seguintes utilizam carregamento sob demanda. Tempos de carregamento em dispositivos reais e métricas de campo dependem da conexão e do tráfego.

## Catálogo com fotos autorizadas

O build de prévia criou 34 documentos HTML. Nas 12 páginas individuais, a conferência dos HTMLs renderizados encontrou o preço aprovado e cada foto prevista na galeria. Também foram conferidos o formato WebP e a presença dos 179 arquivos na distribuição. Os derivados de produto somam 21.019.708 bytes no conjunto completo. Cada ficha carrega as fotos do modelo correspondente.

Os 12 SKUs têm preço próprio aprovado, quatro por categoria, entre R$ 89,00 e R$ 339,90. Seis modelos possuem quadros de comprimento em centímetros; dez trazem equivalências de numeração. Os tons de galeria sem correspondência verificada com uma cor selecionável permanecem acessíveis pelas miniaturas. A projeção pública preserva as fontes de pesquisa no cadastro interno.

## Comércio

A execução local passou em 43 testes de catálogo, interface, arte, rotas, frete, estoque, identificação do vendedor, pagamento e conciliação. Com uma sacola isolada de R$ 100,00, o total chegou a R$ 123,00 com PAC e R$ 148,00 com SEDEX. O teste de cartão em uma parcela usou um token sintético, verificou a recuperação de uma resposta perdida e confirmou que dois cliques geraram um único pedido. O checkout com a sacola preenchida e vazia foi revisado no Safari em 390 e 1440 px, sem transbordamento horizontal nem imagens quebradas. Uma conferência adicional do lote real verificou 12 preços, 179 imagens locais e o filtro por preço. O filtro de disponibilidade retornou zero itens vendáveis, conforme os saldos próprios ainda pendentes. Os cenários de pedido do teste usam dados isolados e respostas controladas de um provedor.

As fichas em `listed` permitem consultar preço, ver o produto, abrir a galeria e salvar favoritos. A finalização de compra depende de saldos reais por variante e habilitação do cartão de crédito na conta do estabelecimento. O proprietário definiu as modalidades PAC por R$ 23,00 e SEDEX por R$ 48,00, cobradas uma vez por pedido. As fotos dos fornecedores ilustram os produtos correspondentes. As imagens das campanhas permanecem nos espaços editoriais.
