import {esc,money} from './core.mjs';

const states='AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const bag='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7Zm4 1V6a3 3 0 016 0v2"/></svg>';
const pix='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m3 13 8-8 4 4a1.5 1.5 0 002 0l4-4 8 8m0 6-8 8-4-4a1.5 1.5 0 00-2 0l-4 4-8-8M2 16h6l6-6m16 6h-6l-6 6"/></svg>';
function input(label,name,attrs,wide=false) {
  return '<label class="co-field'+(wide?' co-wide':'')+'"><span>'+label+'</span><input name="'+name+'" '+attrs+'></label>';
}
export function shippingChoices(options, checked='pac') {
  return options.map(o=>'<label class="co-rate"><input type="radio" name="shippingMethod" value="'+esc(o.id)+'" '+(o.id===checked?'checked':'')+' required><span>'+esc(o.label)+'</span><strong>'+esc(money(o.priceCents))+'</strong></label>').join('');
}
function purchaseForm(rates,couponEnabled) {
  const section=(title,body)=>'<section class="co-panel"><h2>'+title+'</h2>'+body+'</section>';
  const contact='<div class="co-fields">'+
    input('Nome completo','name','required autocomplete="name" minlength="3" maxlength="64"',true)+
    input('E-mail','email','type="email" required autocomplete="email" maxlength="254"',true)+
    input('CPF','cpf','required inputmode="numeric" minlength="11" maxlength="14" placeholder="000.000.000-00"')+
    input('Telefone com DDD','phone','type="tel" required autocomplete="tel-national" minlength="10" maxlength="17" placeholder="(00) 00000-0000"')+'</div>';
  const zip=input('CEP','cep','required autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}-?[0-9]{3}" maxlength="9" placeholder="00000-000"');
  const address='<div class="co-fields">'+zip+'<div class="co-field co-zip-note" data-address-note role="status"></div>'+
    input('Rua ou avenida','street','required autocomplete="address-line1" minlength="2" maxlength="100"',true)+
    input('Número','number','required maxlength="10"')+input('Complemento (opcional)','extra','autocomplete="address-line2" maxlength="64"')+
    input('Bairro','district','required autocomplete="address-level3" minlength="2" maxlength="60"',true)+
    input('Cidade','city','required autocomplete="address-level2" minlength="2" maxlength="64"')+
    '<label class="co-field"><span>Estado</span><select name="uf" required autocomplete="address-level1"><option value="">UF</option>'+states.map(s=>'<option value="'+s+'">'+s+'</option>').join('')+'</select></label></div>';
  return '<form id="co-form" method="post" autocomplete="on"><fieldset class="co-form-root">'+
    section('Seus dados',contact)+section('Endereço de entrega',address)+
    section('Forma de entrega','<fieldset class="co-rates" data-options><legend class="co-sr">Escolha a modalidade de envio</legend>'+shippingChoices(rates)+'</fieldset><p class="co-hint" data-shipping-note role="status"></p>')+
    section('Forma de pagamento','<fieldset class="co-rates" data-payment-choices><legend class="co-sr">Escolha como pagar</legend></fieldset><div class="co-pix" data-pix-description hidden><span class="co-pix-icon">'+pix+'</span><p>Pague pelo QR Code ou código copia e cola.</p></div><div data-card-entry></div><p role="status" class="co-hint" data-method-note></p>')+
    (couponEnabled?section('Cupom',input('Código de desconto (opcional)','coupon','maxlength="40" autocapitalize="characters"')):'')+'</fieldset></form>';
}
export function checkoutDocument({shippingRates=[],couponEnabled=false}={}) {
  const rates=shippingRates.filter(o=>typeof o.id==='string'&&typeof o.label==='string'&&Number.isSafeInteger(o.priceCents)&&o.priceCents>=0);
  const tariff=rates.map(o=>'<div><dt>'+esc(o.label)+'</dt><dd>'+esc(money(o.priceCents))+'</dd></div>').join('');
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#faf8f1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>Finalizar compra | Felipe Modas</title><link rel="icon" href="/assets/brand/favicon.png"><link rel="stylesheet" href="/store/checkout.css"><script type="module" src="/store/checkout-client.mjs"></script></head><body>'+
    '<a class="co-skip" href="#principal">Pular para o conteúdo</a><header class="co-header"><div><a href="/" aria-label="Felipe Modas, início"><img src="/assets/brand/logo.png" width="200" height="48" alt="Felipe Modas"></a><a class="co-bag" href="/sacola/">'+bag+'<span>Sacola</span></a></div></header>'+
    '<main id="principal"><nav class="co-crumb" aria-label="Caminho da compra"><a href="/sacola/">Sacola</a><span aria-hidden="true">/</span><span>Finalização</span></nav><h1>Finalizar compra</h1><p data-loading class="co-hint" role="status">Carregando sua sacola…</p><noscript>Ative o JavaScript para consultar sua sacola e finalizar a compra.</noscript>'+
    '<div class="co-grid" data-empty hidden><section class="co-panel co-empty"><div class="co-bag-emblem">'+bag+'</div><h2>Sua sacola está vazia</h2><p>Escolha suas peças para continuar a compra.</p><a class="co-button" href="/colecao/todas/">Explorar a coleção</a></section><section class="co-panel co-tariff"><h2>Entrega</h2><dl>'+tariff+'</dl><form data-zip-preview><label class="co-field"><span>Consultar meu CEP</span><input name="cep" inputmode="numeric" maxlength="9" pattern="[0-9]{5}-?[0-9]{3}" placeholder="00000-000" autocomplete="postal-code" required></label><button class="co-secondary">Consultar</button></form><p role="status" data-preview-note></p></section></div>'+
    '<div class="co-grid" data-purchase hidden><div>'+purchaseForm(rates,couponEnabled)+'</div><aside class="co-panel co-summary"><div class="co-summary-head"><h2>Seu pedido</h2><a class="co-text-link" href="/sacola/">Editar sacola</a></div><div data-lines></div><dl class="co-totals"><div><dt>Subtotal</dt><dd data-subtotal>—</dd></div><div><dt>Frete</dt><dd data-shipping>Informe o CEP</dd></div><div data-discount-row hidden><dt>Desconto</dt><dd data-discount></dd></div><div class="co-grand"><dt>Total</dt><dd data-total>—</dd></div></dl><p data-quote-note class="co-hint" role="status"></p><button type="button" class="co-secondary" data-requote hidden>Atualizar total</button><button data-pay type="submit" form="co-form" class="co-button co-pay" disabled>Confirmar pedido</button><p data-error role="alert"></p><button type="button" data-recover class="co-secondary" hidden>Consultar tentativa anterior</button><p class="co-policy">Ao confirmar, você concorda com os <a href="/termos-de-compra/">termos de compra</a>.</p></aside></div>'+
    '<section class="co-panel co-payment-state" data-order aria-live="polite" hidden></section>'+
    '</main><footer class="co-footer"><div><img src="/assets/brand/monogram.png" alt="" width="32" height="32"><span>Felipe Modas</span></div><nav aria-label="Atendimento e políticas"><a href="/atendimento/">Atendimento</a><a href="/privacidade/">Privacidade</a><a href="/trocas-e-devolucoes/">Trocas e devoluções</a></nav></footer></body></html>';
}
