# Operação comercial da Felipe Modas

## Estado da entrega em 24 de novembro de 2026

A loja usa `/checkout/` no mesmo projeto da vitrine. O subdomínio `checkout.felipemodasbr.com` mantém a aplicação protegida anterior, cujo contrato de recebimento da sacola ainda não foi homologado.

O checkout em uma página reúne identificação, endereço, modalidade de entrega, resumo e pagamento. A conta Pagar.me (Stone) deve estar habilitada para as formas oferecidas, Pix e/ou cartão de crédito em uma parcela. As funções e o registro de pedidos ficam no projeto Netlify da vitrine. A consulta de endereço e das modalidades é independente da ativação do pagamento.

Os testes locais percorreram as funções HTTP com um adaptador de provedor controlado. Não houve chamada autenticada de homologação à Pagar.me, cobrança, teste do armazenamento remoto ou validação das credenciais do estabelecimento. A prévia visual não confirma pagamento ou estoque.

## Cadastro, frete e campanha

| Dado | Fonte operacional |
|---|---|
| Preços e variantes | `data/curadoria.json`. A função aceita apenas produtos com `status: active`, variante com ID exclusivo, preço inteiro positivo em centavos e `stock` inteiro não negativo. O preço da variante prevalece sobre o do produto. |
| Frete | `shippingRates` em `commerce/config.mjs` define `id`, `label` e `priceCents` de cada modalidade. PAC custa 2300 centavos e SEDEX custa 4800 centavos por pedido. O navegador envia a modalidade escolhida e o servidor obtém o valor a partir da configuração. O valor é somado uma única vez. Não há prazo fixo configurado. |
| Cupom | `campaign` do mesmo arquivo. A proposta BEMVINDA10 começa desligada. A base é o subtotal dos produtos. O frete é somado depois do desconto. Uma compra aceita um único código. Configure a validade com data, hora e fuso em ISO 8601. |
| Histórico | A elegibilidade usa o e-mail e o CPF normalizados com HMAC na finalização. Pedidos pagos e cupons já reservados são considerados pelo servidor. Antes de aprovar uma campanha de primeira compra, concilie também vendas anteriores realizadas fora desse checkout. |

`stock` representa o estoque alocado a este canal antes das reservas e vendas registradas no ledger. Para receber mais peças, some a reposição ao valor. Não substitua pelo saldo líquido sem conciliar as vendas que já foram abatidas. Vendas por outros canais precisam atualizar essa alocação. O checkout retém o saldo no envio do pedido, mantém a baixa quando a Pagar.me confirma o pagamento e libera após recusa ou cancelamento confirmado. Um estorno requer conferência da devolução física antes de repor.

O ledger mantém os itens, os valores, o CEP, identificadores pseudonimizados e o estado do pedido. Nome, endereço completo e documento são encaminhados à Pagar.me para processar o pedido e permitir a expedição pelo lojista com acesso à conta. As escritas do ledger usam leitura forte e atualização condicional por ETag. Este modelo concentra o controle de um catálogo pequeno em um objeto por ambiente. Monitore tamanho e conflitos à medida que o volume crescer. Alterar o segredo de HMAC rompe links privados e a continuidade do histórico, por isso uma rotação exige migração.

## Ativação de homologação

1. No projeto Netlify, confirme Node 22 ou superior, a dependência `@netlify/blobs`, a pasta `netlify/functions` e o acesso a Netlify Blobs.
2. Reserve uma variante com preço próprio e saldo de teste no catálogo **da homologação**, confira PAC e SEDEX para o mesmo pedido e publique na prévia de homologação.
3. Para homologação, configure `FM_COMMERCE_MODE=sandbox`, `PAGARME_TEST_SECRET_KEY` e um segredo aleatório e estável de ao menos 32 caracteres em `FM_COMMERCE_SECRET`. Para cartão de crédito, habilite `FM_CARD_ENABLED=true` e configure `PAGARME_TEST_PUBLIC_KEY`. Para uma conta sem Pix, defina `FM_PIX_ENABLED=false`. O servidor verifica as configurações locais para mostrar as modalidades. Somente a homologação com o provedor comprova que a modalidade funciona naquela conta. Na Netlify, disponibilize o indicador de ambiente `FM_COMMERCE_MODE` para o build e para as funções. As chaves privadas e `FM_COMMERCE_SECRET` pertencem somente ao ambiente das funções.
4. Cadastre os eventos de pedido e cobrança da Pagar.me no endereço HTTPS da função `/.netlify/functions/payment-events` do ambiente correspondente. Inclua os eventos de cancelamento parcial, estorno e contestação habilitados no estabelecimento, entre eles `charge.partial_canceled`, `charge.refunded`, `chargeback.received` e `charge.chargedback`. A notificação inicia uma consulta autenticada usando a chave do provedor. A alteração de estado depende da coincidência das referências, moeda, modalidade e valor.
5. Na prévia de homologação, selecione uma variante, altere a quantidade e recarregue a sacola. Abra `/checkout/`, preencha o endereço, alterne entre PAC e SEDEX e confira a diferença de R$ 25,00. Para cada modalidade habilitada, use dados de teste da conta e compare o número, o total e o estado com o painel Pagar.me. No sandbox, verifique Pix pendente, cartão em uma parcela, aprovação, recusa/cancelamento, reenvio de evento e concorrência pela última unidade. Guarde as evidências sem dados pessoais.
6. O endereço cadastral está definido em `institucional/build.mjs`. Para produção, confira a conta do estabelecimento, o estoque próprio por variante e a homologação das modalidades contratadas. Configure `FM_COMMERCE_MODE=live`, `PAGARME_SECRET_KEY` de produção e um `FM_COMMERCE_SECRET` exclusivo e estável. Se a loja oferecer cartão, configure a chave pública de produção em `PAGARME_PUBLIC_KEY` e habilite a modalidade. O modo real exige deploy publicado no domínio `felipemodasbr.com`. Configure o webhook da produção nesse domínio e remova credenciais de teste desse contexto.

## Jornada e recuperação

A página única usa `POST /.netlify/functions/commerce`. A ação `address` encaminha somente o CEP ao ViaCEP e permite ao cliente completar os dados manualmente. A ação `shipping` mostra PAC e SEDEX. A ação `methods` informa as opções de pagamento configuradas para o ambiente e, quando o cartão está habilitado, a chave pública usada na tokenização. A cotação e a criação de pagamento usam IDs de variante, quantidades, CEP, modalidade e cupom opcional. O servidor recalcula os valores em centavos. Na mesma página, a ação `pix` recebe os dados de contato e entrega e uma chave UUID para a tentativa, registra o pedido e pede o código ao provedor. O cliente pode copiar o código ou escanear a imagem do QR quando disponível. Para cartão, os dados completos seguem diretamente do navegador à Pagar.me. A ação `card` utiliza o token resultante e gera a cobrança em uma parcela. O número e o código de segurança do cartão não fazem parte do corpo enviado à loja. O acompanhamento usa a ação `payment-status` e um token opaco no fragmento do link privado.

A confirmação consulta a resposta da API Pagar.me. Atualizar o navegador, repetir o botão ou receber o mesmo evento não duplica a baixa. Se a primeira resposta se perder, a página busca o pedido pelo código local. Enquanto houver incerteza, o sistema conserva a reserva. Após o prazo seguro de idempotência, o atendimento deve conferir o código no painel do provedor e reenviar o evento ou reconciliar o pedido antes de iniciar qualquer cobrança. Jamais libere uma reserva só porque a imagem ou o código Pix expirou. A expiração local da sacola de 30 minutos ocorre antes do primeiro envio e não afeta pagamentos em andamento.

## Verificação local

Execute com Node 22 ou superior, na raiz, `node --test tests/commerce.test.mjs`. Os casos cobrem os endpoints de cotação, geração de checkout, envio, leitura do pedido e recebimento de eventos com dados isolados de teste. Incluem adulteração de valores, frete indisponível, cupom válido, inválido, expirado e não elegível, último saldo, retorno fora da sequência esperada e idempotência.

## Documentação de referência

- [Pedidos e campos obrigatórios na Pagar.me](https://docs.pagar.me/reference/criar-pedido-2)
- [Pix na API v5](https://docs.pagar.me/reference/pix-2)
- [Idempotência de pedidos](https://docs.pagar.me/docs/o-que-%C3%A9)
- [Eventos da Pagar.me](https://docs.pagar.me/docs/webhooks)
- [Gravações condicionais no Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
