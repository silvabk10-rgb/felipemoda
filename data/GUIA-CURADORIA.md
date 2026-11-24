# Curadoria da Felipe Modas

`curadoria.json` reúne doze modelos conferidos em 24 de novembro de 2026. São quatro vestidos, quatro conjuntos e quatro calças. Cada ficha tem um SKU da Felipe Modas e uma URL permanente de origem. Os nomes e as descrições comerciais foram redigidos para a loja. As tabelas se referem exclusivamente ao modelo em que aparecem.

## Preços de venda aprovados

Em 24 de novembro de 2026, a Felipe Modas adotou o preço regular das fichas autorizadas. Os valores abaixo são os preços da vitrine. Nos seis modelos Via Luxo, o preço condicionado ao Pix da referência fica apenas na pesquisa interna. A loja usa `priceCents` para exibir o preço aprovado em reais.

| SKU | Peça | Referência | Preço aprovado |
|---|---|---|---:|
| FM-V01 | Vestido longo floral Letícia | Via Luxo Store | R$ 169,90 |
| FM-V02 | Vestido jeans Lara escuro | Via Luxo Store | R$ 169,90 |
| FM-V03 | Vestido listrado Astoria | DaLuz | R$ 109,00 |
| FM-V04 | Vestido de um ombro Amara | DaLuz | R$ 99,00 |
| FM-CJ01 | Conjunto listrado Helena | Via Luxo Store | R$ 339,90 |
| FM-CJ02 | Conjunto listrado com cinto Ísis | Via Luxo Store | R$ 259,90 |
| FM-CJ03 | Conjunto de microsarja Orsay | DaLuz | R$ 149,00 |
| FM-CJ04 | Conjunto de três peças Reeve | DaLuz | R$ 189,00 |
| FM-C01 | Calça de alfaiataria Dani | Via Luxo Store | R$ 139,90 |
| FM-C02 | Calça jeans wide leg Mariana | Via Luxo Store | R$ 188,90 |
| FM-C03 | Calça de alfaiataria Maelis | DaLuz | R$ 139,00 |
| FM-C04 | Calça jeans estonada Baya | DaLuz | R$ 89,00 |

## Da vitrine à venda por variante

| Campo | Preenchimento |
|---|---|
| `priceCents` | Preço de venda definido pela Felipe Modas, em centavos inteiros. |
| `variants` | Uma entrada por combinação em estoque próprio. Use `id` e `sku` exclusivos por variante, `color`, `size` e `stock` inteiro. Mantenha o ID estável depois da primeira venda. O serviço comercial desconta do saldo físico as unidades comprometidas em seus registros. |
| `images` | Galeria ordenada com caminhos locais em `src`, descrição real em `alt` e `color` quando a imagem retratar uma cor específica. Indique a permissão e a origem do arquivo no registro de ativos. O primeiro arquivo é a capa. |
| `shipping` | Complete peso e dimensões embalados, com as respectivas unidades, caso a modalidade de frete contratada os exija. |
| `status` | As 12 fichas estão em `listed`, com fotos e preços públicos. `draft` identifica cadastros em preparação, e `active` habilita a compra quando há saldos próprios e checkout configurado. |

A coleta guarda `supplierSizes` e `supplierColors` dentro de `source` para conferência. As combinações e os saldos efetivos devem vir da contagem da Felipe Modas. `sizeGuide` traz equivalências aproximadas na numeração brasileira. `measurements` descreve dimensões reais da peça em centímetros. Campos desconhecidos permanecem vazios até conferência da etiqueta, do lote ou do material técnico.

## Fotografias

O proprietário da Felipe Modas autorizou o uso comercial das galerias de Via Luxo e DaLuz em 24/11/2026. As 179 fotos dos 12 modelos estão em WebP em `assets/products/`. As galerias têm 83 fotos da Via Luxo e 96 da DaLuz. Cada item em `images` contém o caminho local, texto alternativo e dimensões do derivado. A URL da foto original ocupa a mesma posição em `source.galleryUrls`. A origem da ficha, a autorização e a data ficam em `source`.

A capa é sempre o primeiro arquivo de `images`. O atributo opcional `color` associa a foto a um tom identificado do modelo. Uma foto de grupo, uma tonalidade ambígua ou uma imagem do mesmo modelo em cor ausente da grade verificada permanece acessível na galeria geral. Na Via Luxo, `source.photoColors` registra os tons visualmente conferidos. Na DaLuz, `source.supplierVariantPairs` preserva as combinações publicadas na página de referência. Esses atributos apoiam a navegação e a conferência física. Para habilitar a compra, a loja precisa registrar a contagem de suas próprias variantes.

Seis fichas da Via Luxo possuem medidas da peça em centímetros. Dez das doze fichas têm equivalências de numeração. A calça Mariana usa medida por tamanho numérico, e a calça Baya traz sua grade numérica. Para o vestido Lara, o GG equivale ao 44; o comprimento desse tamanho permanece sem medida publicada.

## Nova coleta ou atualização

Prepare o lote em JSON com a mesma estrutura de ficha. A importação usa a URL de origem e valida a unicidade de ID, SKU e slug antes da escrita. Fichas já existentes recebem os dados editoriais e técnicos revisados. Preços aprovados, propostas editadas, variantes, fotos e estado de publicação existentes são preservados. Itens novos entram como rascunho. Itens antigos ausentes do lote permanecem no cadastro.

```sh
python3 scripts/importar-curadoria.py caminho/lote-revisado.json
```

Para conferir o resultado em uma cópia, adicione `--destino caminho/copia.json`. O importador exige Python 3.9 ou superior. Trate o catálogo anterior de Stella Basic como fonte histórica independente. A integração com SKU de loja ou variante de checkout exige correspondência física confirmada.
