# Operação comercial da Felipe Modas

## Estado da entrega em 24 de novembro de 2026

A loja usa `/checkout/` no mesmo projeto da vitrine. O subdomínio `checkout.felipemodasbr.com` mantém a aplicação protegida anterior, cujo contrato de recebimento da sacola ainda não foi homologado.

O checkout em uma página reúne identificação, endereço, modalidade de entrega, resumo e pagamento. A conta Pagar.me (Stone) deve estar habilitada para o pagamento por cartão de crédito em uma parcela. As funções e o registro de pedidos ficam no projeto Netlify da vitrine. A consulta de endereço e das modalidades é independente da ativação do pagamento.

Os testes locais percorreram as funções HTTP com um adaptador de provedor controlado. Não houve chamada autenticada de homologação à Pagar.me, cobrança, teste do armazenamento remoto ou validação das credenciais do estabelecimento. A prévia visual não confirma pagamento ou estoque.

Em uma falha confirmada antes da cobrança, a consulta privada identifica a etapa disponível e permite iniciar outra tentativa a partir da mesma sacola. Para consultar a falha na Netlify, filtre os logs da função `commerce` pelo código do pedido Felipe Modas. As entradas de diagnóstico trazem apenas a etapa da integração e, quando disponível, o status HTTP do provedor. Se a criação do pedido ficar indeterminada, consulte o mesmo pedido para preservar a proteção contra cobranças repetidas.

## Cadastro, frete e campanha

| Dado | Fonte operacional |
|---|---|
| Preços e variantes | `data/curadoria.json`. A função aceita apenas produtos com `status: active`, variante com ID exclusivo, preço inteiro positivo em centavos e `stock` inteiro não negativo. O preço da variante prevalece sobre o do produto. |
| Frete | `shippingRates` em `commerce/config.mjs` define `id`, `label` e `priceCents` de cada modalidade. PAC custa 2300 centavos e SEDEX custa 4800 centavos por pedido. O navegador envia a modalidade escolhida e o servidor obtém o valor a partir da configuração. O valor é somado uma única vez. Não há prazo fixo configurado. |
| Cupom | `campaign` do mesmo arquivo. A proposta BEMVINDA10 começa desligada. A base é o subtotal dos produtos. O frete é somado depois do desconto. Uma compra aceita um único código. Configure a validade com data, hora e fuso em ISO 8601. |
| Histórico | A elegibilidade usa o e-mail e o CPF normalizados com HMAC na finalização. Pedidos pagos e cupons já reservados são considerados pelo servidor. Antes de aprovar uma campanha de primeira compra, concilie também vendas anteriores realizadas fora desse checkout. |

`stock` representa o estoque alocado a este canal antes das reservas e vendas registradas no ledger. Para receber mais peças, some a reposição ao valor. Não substitua pelo saldo líquido sem conciliar as vendas que já foram abatidas. Vendas por outros canais precisam atualizar essa alocação. O checkout retém o saldo no envio do pedido, mantém a baixa quando a Pagar.me confirma o pagamento e libera após recusa ou cancelamento confirmado. Um estorno requer conferência da devolução física antes de repor.

O ledger mantém os itens, os valores, o CEP, identificadores pseudonimizados e o estado do pedido. Nome, endereço completo e documento são encaminhados à Pagar.me para processar o pedido e permitir a expedição pelo lojista com acesso à conta. As escritas do ledger usam leitura forte e atualização condicional por ETag. Este modelo concentra o controle de um catálogo pequeno em um objeto por ambiente. Monitore tamanho e conflitos à medida que o volume crescer. Alterar o segredo de HMAC rompe links privados e a continuidade do histórico, por isso uma rotação exige migração.

## Configuração de produção

1. No projeto Netlify, use Node 22 ou superior, a dependência `@netlify/blobs`, a pasta `netlify/functions` e o acesso a Netlify Blobs. Confira o cadastro da empresa, o domínio autorizado para tokenização na Pagar.me e os saldos próprios por variante.
2. Configure `FM_COMMERCE_MODE=live` no contexto de produção para o build e as funções. Configure `PAGARME_SECRET_KEY` e `FM_COMMERCE_SECRET`, um segredo exclusivo e estável de pelo menos 32 caracteres, apenas no ambiente de execução das funções.
3. Para cartão em uma parcela, configure `FM_CARD_ENABLED=true` e a chave pública de produção em `PAGARME_PUBLIC_KEY`. O cartão em uma parcela é a única forma de pagamento disponibilizada pelo checkout. O modo de produção dispensa chaves de teste e utiliza o deploy publicado em `felipemodasbr.com`.
4. Após a publicação, abra a função agendada **reconcile-orders** no painel da Netlify. O botão **Run now** inicia uma execução autenticada da rotina. Confira o resultado nos logs de função privados. A validação usa uma consulta de leitura ao provedor, sem criar transação.
5. Opcionalmente, use o webhook `/.netlify/functions/payment-events` para acelerar as atualizações quando houver integração de eventos disponível para o canal. Inclua eventos de pedido, pagamento, estorno e contestação pertinentes, como `charge.partial_canceled`, `charge.refunded`, `chargeback.received` e `charge.chargedback`. A notificação inicia uma verificação autenticada dos dados da adquirente. A rotina agendada funciona independentemente do webhook e do navegador do comprador.

Para uma homologação futura, use um contexto separado com `FM_COMMERCE_MODE=sandbox`, `PAGARME_TEST_SECRET_KEY`, segredo HMAC exclusivo e, para cartão, `PAGARME_TEST_PUBLIC_KEY` e `FM_CARD_ENABLED=true`. A função de conciliação automática só roda no deploy de produção publicado.

## Conciliação agendada e autenticação

A Netlify executa `reconcile-orders` a cada cinco minutos no deploy publicado. A função usa uma trava temporária no registro da loja e confere até cinco pedidos locais por lote. As consultas priorizam pedidos pendentes e selecionam pelo menos uma venda previamente paga para revisão quando há registros elegíveis. Pedidos pagos e parcialmente estornados voltam à fila a partir de 24 horas desde a última conferência. O prazo para percorrer toda a fila depende do volume. Um pedido enviado sem resposta do provedor pode ser localizado pelo código exato da loja. A função só lê a API da adquirente e atualiza o registro local após conferir referência, valor, moeda e modalidade.

A mesma execução faz um GET com filtro por um código aleatório reservado para diagnóstico e tamanho de página 1. Uma página vazia com resposta bem-sucedida confirma acesso autenticado à consulta de pedidos. O resultado comprova a autorização de leitura da chave privada. A aceitação de cartão, a correspondência com a chave pública e uma venda concluída exigem evidências próprias. A sondagem acontece no primeiro processamento do deploy, quando há alteração da chave e a cada 24 horas após um sucesso. Após uma falha, a rotina aguarda 15 minutos antes de repetir a sondagem na mesma configuração. Os logs apresentam apenas resultado e contagens. O horário agendado e a execução manual ficam disponíveis no painel da Netlify, sem URL pública de diagnóstico.

| Resultado nos logs | Interpretação |
|---|---|
| `authenticated` | O provedor aceitou a requisição autenticada e devolveu a página vazia esperada. |
| `unauthorized` ou `forbidden` | A API recusou a autenticação ou o acesso. Confira o ambiente e a permissão da chave no painel. |
| `unavailable` ou `inconclusive` | O serviço não respondeu como esperado. A rotina preserva o estado do pedido e tenta novamente. |
| `already_running` | Outra execução já está processando o lote. |

## Jornada e recuperação

A página única usa `POST /.netlify/functions/commerce`. A ação `address` encaminha somente o CEP ao ViaCEP e permite ao cliente completar os dados manualmente. A ação `shipping` mostra PAC e SEDEX. A ação `methods` informa as opções de pagamento configuradas para o ambiente e, quando o cartão está habilitado, a chave pública usada na tokenização. A cotação e a criação de pagamento usam IDs de variante, quantidades, CEP, modalidade e cupom opcional. O servidor recalcula os valores em centavos. Para cartão, os dados completos seguem diretamente do navegador à Pagar.me. A ação `card` recebe o token resultante, os dados de contato e endereço, a cotação e uma chave UUID da tentativa. O servidor confirma os valores e solicita a cobrança em uma parcela. O número e o código de segurança do cartão não fazem parte do corpo enviado à loja. O acompanhamento usa a ação `payment-status` e um token opaco no fragmento do link privado.

A confirmação consulta a resposta da API Pagar.me. Atualizar o navegador, repetir o botão ou receber o mesmo evento não duplica a baixa. Se a primeira resposta se perder, a página busca o pedido pelo código local. Enquanto houver incerteza, o sistema conserva a reserva. Após o prazo seguro de idempotência, o atendimento deve conferir o código no painel do provedor e confrontá-lo com a rotina de conciliação antes de iniciar qualquer cobrança. Recibos anteriores permanecem disponíveis para consulta, sem formulário de cobrança ou código de pagamento. A expiração local da sacola de 30 minutos ocorre antes do primeiro envio e não afeta pagamentos em andamento.

## Verificação local

Execute com Node 22 ou superior, na raiz, `node --test tests/commerce*.test.mjs`. Os casos cobrem os endpoints de cotação, geração de checkout, envio, leitura do pedido e recebimento de eventos com dados isolados de teste. Incluem adulteração de valores, frete indisponível, cupom válido, inválido, expirado e não elegível, último saldo, retorno fora da sequência esperada e idempotência.

## Documentação de referência

- [Pedidos e campos obrigatórios na Pagar.me](https://docs.pagar.me/reference/criar-pedido-2)
- [Cartão de crédito na API v5](https://docs.pagar.me/reference/cart%C3%A3o-de-cr%C3%A9dito-1)
- [Idempotência de pedidos](https://docs.pagar.me/docs/o-que-%C3%A9)
- [Eventos da Pagar.me](https://docs.pagar.me/docs/webhooks)
- [Funções agendadas da Netlify](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Gravações condicionais no Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
