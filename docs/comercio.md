# Operação comercial da Felipe Modas

## Estado da entrega em 24 de novembro de 2026

O checkout separado atualmente associado à loja não oferece uma passagem de sacola homologada para esta integração. A equipe responsável deve confirmar o contrato de itens, valores, frete e pagamento antes de integrar esse serviço.

A nova implementação na loja prepara um checkout de Pix para **conta Pagar.me com Pix habilitado**. Ela possui funções e registros próprios no mesmo projeto Netlify da vitrine. O novo checkout permanece fechado enquanto as configurações estiverem ausentes. Para continuar usando o checkout separado de cartão, ainda é necessária uma integração de sacola autenticada naquele projeto, incluindo validação de valores, confirmação e conciliação. A implantação deste código não altera o checkout protegido nem seu domínio.

Os testes locais percorreram as funções HTTP com um adaptador de provedor controlado. Não houve chamada autenticada de homologação à Pagar.me, cobrança, teste do armazenamento remoto ou validação das credenciais do estabelecimento. A prévia visual não confirma pagamento ou estoque.

## Cadastro, frete e campanha

| Dado | Fonte operacional |
|---|---|
| Preços e variantes | `data/curadoria.json`. A função aceita apenas produtos com `status: active`, variante com ID exclusivo, preço inteiro positivo em centavos e `stock` inteiro não negativo. O preço da variante prevalece sobre o do produto. |
| Frete | `commerce/config.mjs`, lista `shippingRates`. Cada faixa contém `start` e `end` como oito dígitos, `priceCents` e `deliveryDays` em dias úteis. Cadastre faixas aprovadas, inclusivas e sem sobreposição. Quando não há tarifa para o CEP, a compra é bloqueada. |
| Cupom | `campaign` do mesmo arquivo. A proposta BEMVINDA10 começa desligada. A base é o subtotal dos produtos. O frete é somado depois do desconto. Uma compra aceita um único código. Configure a validade com data, hora e fuso em ISO 8601. |
| Histórico | A elegibilidade usa o e-mail e o CPF normalizados com HMAC na finalização. Pedidos pagos e cupons já reservados são considerados pelo servidor. Antes de aprovar uma campanha de primeira compra, concilie também vendas anteriores realizadas fora desse checkout. |

`stock` representa o estoque alocado a este canal antes das reservas e vendas registradas no ledger. Para receber mais peças, some a reposição ao valor. Não substitua pelo saldo líquido sem conciliar as vendas que já foram abatidas. Vendas por outros canais precisam atualizar essa alocação. O checkout retém o saldo no envio do pedido, mantém a baixa quando a Pagar.me confirma o pagamento e libera após recusa ou cancelamento confirmado. Um estorno requer conferência da devolução física antes de repor.

O ledger mantém os itens, os valores, o CEP, identificadores pseudonimizados e o estado do pedido. Nome, endereço completo e documento são encaminhados à Pagar.me para processar o pedido e permitir a expedição pelo lojista com acesso à conta. As escritas do ledger usam leitura forte e atualização condicional por ETag. Este modelo concentra o controle de um catálogo pequeno em um objeto por ambiente. Monitore tamanho e conflitos à medida que o volume crescer. Alterar o segredo de HMAC rompe links privados e a continuidade do histórico, por isso uma rotação exige migração.

## Ativação de homologação

1. No projeto Netlify, confirme Node 22 ou superior, a dependência `@netlify/blobs`, a pasta `netlify/functions` e o acesso a Netlify Blobs.
2. Reserve uma variante com preço próprio e saldo de teste no catálogo **da homologação**, cadastre sua faixa de frete e publique apenas na prévia de homologação.
3. Para o contexto de homologação, configure `FM_COMMERCE_MODE=sandbox`, `PAGARME_TEST_SECRET_KEY` com a chave de testes da conta com Pix e `FM_COMMERCE_SECRET` com um segredo aleatório de pelo menos 32 caracteres. Guarde os valores exclusivamente na Netlify.
4. Cadastre os eventos de pedido e cobrança da Pagar.me no endereço HTTPS da função `/.netlify/functions/payment-events` do ambiente correspondente. A notificação inicia uma consulta autenticada usando a chave do provedor. A alteração de estado depende da coincidência das referências, moeda, modalidade e valor.
5. Na prévia, selecione uma variante, altere a quantidade, recarregue, calcule o frete e confira o total. Abra o checkout, revise endereço e valores, gere o pedido com o simulador da conta e compare o número e o total no painel Pagar.me. No sandbox, verifique pendência, aprovação, recusa/cancelamento, reenvio de evento e concorrência pela última unidade. Guarde as evidências sem dados pessoais.
6. Para produção, valide os dados empresariais, a conta do estabelecimento, os preços, o frete e o estoque aprovados. Configure `FM_COMMERCE_MODE=live`, `PAGARME_SECRET_KEY` de produção e um `FM_COMMERCE_SECRET` exclusivo e estável. O modo real exige deploy publicado no domínio `felipemodasbr.com`. Configure o webhook da produção nesse domínio e remova credenciais de teste desse contexto.

## Jornada e recuperação

A cotação e o checkout usam `POST /.netlify/functions/commerce`. O cliente envia IDs de variante, quantidades, CEP, cupom e e-mail, quando necessário. No checkout, envia também uma chave UUID estável para a mesma tentativa. O servidor recalcula as quantias em centavos e retorna o link privado do pedido. O resumo e o formulário de entrega são servidos pela função `pagamento`. Somente confirmar os dados e gerar o Pix faz uma requisição de criação de pedido no provedor. O cliente pode guardar o link para acompanhar o pagamento.

A confirmação consulta a resposta da API Pagar.me. Atualizar o navegador, repetir o botão ou receber o mesmo evento não duplica a baixa. Se a primeira resposta se perder, a página busca o pedido pelo código local. Enquanto houver incerteza, o sistema conserva a reserva. Após o prazo seguro de idempotência, o atendimento deve conferir o código no painel do provedor e reenviar o evento ou reconciliar o pedido antes de iniciar qualquer cobrança. Jamais libere uma reserva só porque a imagem ou o código Pix expirou. A expiração local da sacola de 30 minutos ocorre antes do primeiro envio e não afeta pagamentos em andamento.

## Verificação local

Execute com Node 22 ou superior, na raiz, `node --test tests/commerce.test.mjs`. Os casos cobrem os endpoints de cotação, geração de checkout, envio, leitura do pedido e recebimento de eventos com dados isolados de teste. Incluem adulteração de valores, frete indisponível, cupom válido, inválido, expirado e não elegível, último saldo, retorno fora da sequência esperada e idempotência.

## Documentação de referência

- [Pedidos e campos obrigatórios na Pagar.me](https://docs.pagar.me/reference/criar-pedido-2)
- [Pix na API v5](https://docs.pagar.me/reference/pix-2)
- [Idempotência de pedidos](https://docs.pagar.me/docs/o-que-%C3%A9)
- [Eventos da Pagar.me](https://docs.pagar.me/docs/webhooks)
- [Gravações condicionais no Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
