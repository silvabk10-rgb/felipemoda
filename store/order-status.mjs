const paymentFailures = Object.freeze({
  customer_preparation: 'O pagamento parou antes da cobrança. Confira os dados de contato e endereço e tente novamente.',
  card_preparation: 'A tentativa parou na preparação do cartão, antes da cobrança. Digite novamente os dados ou use outro cartão.',
  card_verification: 'A Pagar.me não conseguiu verificar o cartão. Nenhuma cobrança foi criada. Use outro cartão ou consulte seu banco.',
  order_validation: 'A Pagar.me não aceitou este pedido. Nenhuma cobrança foi criada. Revise os dados e tente novamente ou fale com o atendimento.',
  interrupted_before_dispatch: 'O envio do pedido foi interrompido antes da cobrança. Você pode tentar novamente.',
  not_dispatched: 'A cobrança não chegou a ser enviada à Pagar.me. Você pode tentar novamente.'
});

export function checkoutFailure(state, reason) {
  if (state !== 'canceled' || !Object.hasOwn(paymentFailures, reason)) return null;
  return paymentFailures[reason];
}
