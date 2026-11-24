# Curadoria da Felipe Modas

`curadoria.json` reúne doze modelos conferidos em 24 de novembro de 2026. São quatro vestidos, quatro conjuntos e quatro calças. Cada ficha tem um SKU da Felipe Modas e uma URL permanente de origem. Os nomes e as descrições comerciais foram redigidos para a loja. As tabelas se referem exclusivamente ao modelo em que aparecem.

## Decisão de preço

Os valores abaixo servem como ponto de partida editável. A proposta inicial de cada peça é igual ao preço de varejo observado na ficha de referência, antes de condições como Pix. Verifique custo de aquisição, impostos, frete subsidiado e margem da Felipe Modas para aprovar ou substituir cada proposta. A edição de uma proposta, por si só, não altera a oferta da loja.

| SKU | Peça | Referência | Proposta inicial |
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

## Campos para ativação por SKU

| Campo | Preenchimento |
|---|---|
| `priceCents` | Preço de venda definido pela Felipe Modas, em centavos inteiros. |
| `variants` | Uma entrada por combinação em estoque próprio. Use `id` e `sku` exclusivos por variante, `color`, `size` e `stock` inteiro. Mantenha o ID estável depois da primeira venda. O serviço comercial desconta do saldo físico as unidades comprometidas em seus registros. |
| `images` | Galeria ordenada com caminhos locais em `src`, descrição real em `alt` e `color` quando a imagem retratar uma cor específica. Indique a permissão e a origem do arquivo no registro de ativos. O primeiro arquivo é a capa. |
| `shipping` | Complete peso e dimensões embalados, com as respectivas unidades, caso a modalidade de frete contratada os exija. |
| `status` | Mantenha `draft` até aprovar preço, fotos e estoque. Use `active` quando a ficha estiver apta para a vitrine e o checkout estiver configurado para o SKU. |

A coleta guarda `supplierSizes` e `supplierColors` dentro de `source` para conferência. As combinações e os saldos efetivos devem vir da contagem da Felipe Modas. `sizeGuide` traz equivalências aproximadas na numeração brasileira. `measurements` descreve dimensões reais da peça em centímetros. Campos desconhecidos permanecem vazios até conferência da etiqueta, do lote ou do material técnico.

## Fotografias

Cada ficha guarda, em `source.referenceImage`, uma imagem de pesquisa com correspondência ao modelo. A galeria pública deve receber as fotografias próprias ou os arquivos licenciados fornecidos para revenda. O fato de a loja possuir a peça não estabelece as condições de uso das fotografias das lojas pesquisadas. A DaLuz informa que atua no varejo e relata uso indevido de suas imagens por terceiros [em seu FAQ](https://www.daluzloja.com.br/duvidasfrequentes). As páginas da Via Luxo identificam as imagens como fotografias da própria referência. A pesquisa não localizou um pacote com autorização pública de republicação.

Ao receber os arquivos, registre quem autorizou, data, usos cobertos e referência do comprovante. Mantenha os originais e exporte derivados em WebP/AVIF sem retirar sinais de autoria. Confira a correspondência de cor em cada arquivo antes de associá-lo à variante.

## Nova coleta ou atualização

Prepare o lote em JSON com a mesma estrutura de ficha. A importação usa a URL de origem e valida a unicidade de ID, SKU e slug antes da escrita. Fichas já existentes recebem os dados editoriais e técnicos revisados. Preços aprovados, propostas editadas, variantes, fotos e estado de publicação existentes são preservados. Itens novos entram como rascunho. Itens antigos ausentes do lote permanecem no cadastro.

```sh
python3 scripts/importar-curadoria.py caminho/lote-revisado.json
```

Para conferir o resultado em uma cópia, adicione `--destino caminho/copia.json`. O importador exige Python 3.9 ou superior. Trate o catálogo anterior de Stella Basic como fonte histórica independente. A integração com SKU de loja ou variante de checkout exige correspondência física confirmada.
