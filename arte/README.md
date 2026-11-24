# Estúdio de artes Felipe Modas

Abra `/arte/` no site de prévia servido por HTTP. As 13 peças incluem três campanhas principais, quatro entradas de categoria, dois mini banners, três cabeçalhos de coleção e um editorial. Cada uma tem seu próprio recorte para desktop e celular. O editor desenha a arte em Canvas 2D e usa os PNGs transparentes da marca.

1. Selecione uma peça e o formato. A resolução ao lado do título é o tamanho final do PNG.
2. Edite a chamada, o título e a linha de apoio. Apague um campo para ocultá-lo. Ajuste a fonte, a cor e o tamanho do título.
3. Arraste o texto na imagem ou utilize os controles de posição. Em “Posição e contraste”, você também pode alterar a largura dos parágrafos e a intensidade do degradê.
4. Em “Fotografia e marca”, carregue uma foto local, ajuste o recorte e selecione a versão e a posição da assinatura. O arquivo permanece no navegador.
5. “Salvar rascunho” guarda a versão desta peça e deste formato no navegador atual. “Exportar PNG” baixa a composição na resolução indicada. Editar ou exportar uma peça no estúdio não altera automaticamente as imagens publicadas pela loja.

## Manutenção

O arquivo `theme/campaigns.mjs` define os textos iniciais e as chaves das peças. O manifesto `assets/campaign/composicoes.json` associa os formatos aos arquivos WebP e às dimensões. As fontes de imagem e a autorização de uso estão em `docs/fotografia.md`. O desenho usado na prévia e nas exportações é mantido em `arte/render.mjs`. A interface só necessita de um servidor de arquivos estáticos.

## Conferência

Abra uma peça em cada formato e confira a resolução. Edite uma chamada, arraste o texto e baixe o PNG. Verifique suas dimensões nas propriedades do arquivo. Salve uma foto própria como rascunho e recarregue a página para conferir sua restauração. Ao testar com fotos da campanha, “Usar foto da campanha” recupera a matriz correspondente.
