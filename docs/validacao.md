# Validação da prévia

A Netlify publicou o pull request 1 no projeto felipemoda. O acesso usa a configuração de proteção da equipe. Foi possível abrir a home na sessão autorizada do Safari e confirmar a campanha “Entre luz e forma”, as rotas de categorias e os contatos existentes. No Safari, o carrossel abriu a campanha de vestidos e a busca sem acento por “leticia” retornou apenas o Vestido longo floral Letícia. O acesso à ficha abriu a rota própria e a seção Medidas mostrou 119 cm de comprimento, conforme a ficha cadastrada. O rodapé exibe CNPJ 68.293.261/0001-80.

## Telas

Home, coleção de vestidos e produto Vestido longo floral Letícia foram renderizados com os estilos e imagens da compilação. O Safari conferiu as larguras 360, 390, 430, 768, 1024 e 1440 px para cada uma das três páginas. As 18 combinações mantiveram a largura do conteúdo dentro da janela e carregaram as imagens verificadas. A conferência de referências locais dos 34 documentos HTML, incluindo os editores Canvas, encontrou destinos existentes.

Os dois editores ficam disponíveis na prévia. A marca e os banners são exportados em PNG. No Safari foi verificada a troca de formato no estúdio e a exportação de 750 × 1000 px.

## Peso dos arquivos

Medições do build, antes de compressão HTTP.

| Recurso | Meta | Medido |
| --- | ---: | ---: |
| HTML da home | até 30 KB | 20.846 bytes |
| Primeiro slide desktop | até 120 KB | 99.698 bytes |
| Primeiro slide celular | até 90 KB | 73.330 bytes |
| Dois arquivos CSS compartilhados | até 35 KB | 24.307 bytes |
| 26 WebP de campanha no pacote | até 2,5 MB | 2.024.548 bytes |

O primeiro banner usa prioridade alta. Cada dispositivo solicita o recorte correspondente. As fotos seguintes utilizam carregamento sob demanda. Tempos de carregamento em dispositivos reais e métricas de campo dependem da conexão e do tráfego.

## Comércio

O teste automatizado local cobre 14 casos de catálogo, arte, rotas, cupom, frete, estoque e pagamento. Os cenários de pedido usam dados isolados e respostas controladas de um provedor. A integração de Pix depende de homologação na conta Pagar.me, de frete e de saldos e preços aprovados. A vitrine em prévia permite consultar fichas, salvar favoritos e navegar pelas categorias. As imagens de campanha são editoriais. As fichas conservam apresentação tipográfica até haver fotos autorizadas do produto.
