const TOKEN_ENDPOINT = 'https://api.pagar.me/core/v5/tokens';
const UNAVAILABLE = 'O pagamento com cartão está indisponível. Tente novamente.';

function requirePublicKey(key) {
  if (typeof key !== 'string' || !/^pk_[a-zA-Z0-9_-]+$/.test(key)) throw new Error(UNAVAILABLE);
}

// Kept separate from the store's API client: card details go directly to the processor.
export async function tokenizeCard(publicKey, card, {signal, transport = fetch} = {}) {
  requirePublicKey(publicKey);
  const url = new URL(TOKEN_ENDPOINT);
  url.searchParams.set('appId', publicKey);
  let response;
  try {
    response = await transport(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      signal,
      body: JSON.stringify({type: 'card', card})
    });
  } catch {
    throw new Error(UNAVAILABLE);
  }
  if (response.status === 400 || response.status === 422) {
    throw new Error('Confira os dados impressos no cartão e tente novamente.');
  }
  if (!response.ok) throw new Error(UNAVAILABLE);
  const result = await response.json().catch(() => null);
  if (!result || !/^token_[a-zA-Z0-9_-]+$/.test(result.id)) throw new Error(UNAVAILABLE);
  return result.id;
}

function cardField(container, title, attributes, wide = false) {
  const doc = container.ownerDocument;
  const label = doc.createElement('label');
  label.className = wide ? 'co-field co-wide' : 'co-field';
  const caption = doc.createElement('span');
  caption.textContent = title;
  const input = doc.createElement('input');
  // No name: neither native form submission nor FormData can include card details.
  Object.assign(input, {type: 'text', required: true, spellcheck: false, ...attributes});
  input.addEventListener('input', () => input.setCustomValidity(''));
  label.append(caption, input);
  container.append(label);
  return input;
}

function invalid(input, message) {
  input.setCustomValidity(message);
  input.focus();
  input.reportValidity();
  throw new Error(message);
}

function readCard(fields) {
  const number = fields.number.value.replace(/[ -]/g, '');
  if (!/^\d{13,19}$/.test(number)) invalid(fields.number, 'Informe o número do cartão, com 13 a 19 dígitos.');
  const holder = fields.holder.value.trim().replace(/\s+/g, ' ');
  if (holder.length < 2 || holder.length > 64) invalid(fields.holder, 'Informe o nome como aparece no cartão.');
  const expiry = /^(\d{2})\s*\/?\s*(\d{2}|\d{4})$/.exec(fields.expiry.value.trim());
  const now = new Date();
  const month = Number(expiry?.[1]);
  const year = expiry?.[2].length === 2 ? 2000 + Number(expiry[2]) : Number(expiry?.[2]);
  if (!expiry || month < 1 || month > 12 || year < now.getFullYear() ||
      (year === now.getFullYear() && month < now.getMonth() + 1)) {
    invalid(fields.expiry, 'Informe uma validade vigente, no formato mês/ano.');
  }
  const cvv = fields.cvv.value.trim();
  if (!/^\d{3,4}$/.test(cvv)) invalid(fields.cvv, 'Informe o código de segurança de 3 ou 4 dígitos.');
  return {number, holder_name: holder, exp_month: month, exp_year: year, cvv};
}

export function mountCardPayment(container, {publicKey, tokenize = tokenizeCard}) {
  requirePublicKey(publicKey);
  const area = container.ownerDocument.createElement('div');
  area.className = 'co-fields';
  const fields = {
    number: cardField(area, 'Número do cartão', {
      autocomplete: 'cc-number', inputMode: 'numeric', maxLength: 23, placeholder: '0000 0000 0000 0000'
    }, true),
    holder: cardField(area, 'Nome impresso no cartão', {
      autocomplete: 'cc-name', maxLength: 64, autocapitalize: 'words'
    }, true),
    expiry: cardField(area, 'Validade', {
      autocomplete: 'cc-exp', inputMode: 'numeric', maxLength: 7, placeholder: 'MM/AA'
    }),
    cvv: cardField(area, 'Código de segurança', {
      type: 'password', autocomplete: 'cc-csc', inputMode: 'numeric', maxLength: 4, placeholder: 'CVV'
    })
  };
  container.replaceChildren(area);
  const host = container.ownerDocument.defaultView;
  let pending;
  let removed = false;
  function erase() {
    for (const input of Object.values(fields)) {
      input.value = '';
      input.setCustomValidity('');
    }
  }
  function clear() {
    pending?.abort();
    erase();
  }
  host?.addEventListener('pagehide', clear);
  return {
    clear,
    destroy() {
      removed = true;
      clear();
      host?.removeEventListener('pagehide', clear);
      area.remove();
    },
    async getPayment() {
      if (removed) throw new Error('Escolha uma forma de pagamento para continuar.');
      if (pending) throw new Error('Aguarde a validação do cartão.');
      const card = readCard(fields);
      const request = new AbortController();
      pending = request;
      const timeout = setTimeout(() => request.abort(), 16000);
      try {
        const cardToken = await tokenize(publicKey, card, {signal: request.signal});
        if (request.signal.aborted || removed) throw new Error(UNAVAILABLE);
        erase();
        return {method: 'card', cardToken};
      } finally {
        clearTimeout(timeout);
        pending = undefined;
      }
    }
  };
}
