const byId = id => document.getElementById(id);
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatPrice = cents => money.format(cents / 100);
const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const storageKey = 'casa-basica-cart-v1';
const pageSize = 24;
let limit = pageSize;
let category = '';
const products = new Map(catalogo.map(product => [product.id, product]));
const categories = [...new Set(catalogo.map(product => product.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const cart = new Map();

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function itemKey(product, variant) {
  return JSON.stringify([product.id, variant.id]);
}

try {
  for (const item of JSON.parse(localStorage.getItem(storageKey) || '[]')) {
    const product = products.get(item.product);
    const variant = product?.variants.find(option => option.id === item.variant);
    if (variant?.available && Number.isSafeInteger(item.quantity) && item.quantity > 0) {
      cart.set(itemKey(product, variant), { product, variant, quantity: item.quantity });
    }
  }
} catch {
  // The cart remains usable when storage is unavailable or contains invalid data.
}

function updateCart() {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...cart.values()].map(({ product, variant, quantity }) => ({
      product: product.id, variant: variant.id, quantity,
    }))));
  } catch {
    // Keep the cart in memory for this visit.
  }
  renderCart();
}

function cartButton(label, action, accessibleLabel = label) {
  const button = element('button', label);
  button.setAttribute('aria-label', accessibleLabel);
  button.addEventListener('click', action);
  return button;
}

function renderCart() {
  let total = 0;
  let count = 0;
  const items = byId('cart-items');
  items.replaceChildren();
  for (const [key, item] of cart) {
    const { product, variant, quantity } = item;
    const lineTotal = variant.price * quantity;
    total += lineTotal;
    count += quantity;
    const line = element('article', undefined, 'line');
    const title = element('strong', product.name);
    const description = element('p', variant.label + ' · ' + formatPrice(lineTotal));
    const actions = element('div', undefined, 'actions');
    actions.append(
      cartButton('−', () => changeQuantity(-1), 'Diminuir quantidade de ' + product.name),
      element('span', String(quantity)),
      cartButton('+', () => changeQuantity(1), 'Aumentar quantidade de ' + product.name),
      cartButton('Remover', () => changeQuantity(-quantity), 'Remover ' + product.name),
    );
    line.append(title, description, actions);
    items.append(line);

    function changeQuantity(amount) {
      item.quantity += amount;
      if (item.quantity <= 0) cart.delete(key);
      updateCart();
      const lines = [...items.querySelectorAll('.line')];
      const target = lines.find(node => node.querySelector('strong').textContent === product.name);
      (target?.querySelector('button') ?? byId('cart').querySelector('form button')).focus();
    }
  }
  if (!count) items.append(element('p', 'Seu carrinho está vazio.'));
  byId('count').textContent = count;
  byId('subtotal').textContent = formatPrice(total);
  byId('buy').disabled = count === 0;
}

function productCard(product) {
  const card = element('article', undefined, 'product');
  const photo = element('div', undefined, 'photo');
  const image = element('img');
  image.alt = product.name;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => photo.replaceChildren(element('span', 'Foto indisponível')), { once: true });
  if (product.image) {
    image.src = product.image;
    photo.append(image);
  } else {
    photo.append(element('span', 'Foto indisponível'));
  }
  const price = element('p', undefined, 'price');
  const form = element('form');
  const select = element('select');
  select.setAttribute('aria-label', 'Variação de ' + product.name);
  for (const variant of product.variants) {
    const option = element('option', variant.label + (variant.available ? '' : ' (esgotado)'));
    option.value = variant.id;
    option.disabled = !variant.available;
    select.append(option);
  }
  const available = product.variants.find(option => option.available);
  select.value = (available ?? product.variants[0]).id;
  const add = element('button', available ? 'Adicionar' : 'Esgotado');
  add.disabled = !available;
  select.disabled = !available;
  form.append(select, add);
  card.append(photo, element('h3', product.name), price, form);
  function selectedVariant() {
    return product.variants.find(option => option.id === select.value) ?? product.variants[0];
  }
  function showPrice() {
    const variant = selectedVariant();
    price.replaceChildren(element('strong', formatPrice(variant.price)));
    if (variant.original > variant.price) price.append(element('del', formatPrice(variant.original)));
  }
  select.addEventListener('change', showPrice);
  showPrice();
  form.addEventListener('submit', event => {
    event.preventDefault();
    const variant = selectedVariant();
    if (!variant.available) return;
    const key = itemKey(product, variant);
    const existing = cart.get(key);
    cart.set(key, { product, variant, quantity: (existing?.quantity ?? 0) + 1 });
    updateCart();
    byId('notice').textContent = product.name + ' adicionada ao carrinho.';
    byId('cart').showModal();
  });
  return card;
}

function renderProducts() {
  const query = normalize(byId('search').value.trim());
  const matches = catalogo.filter(product =>
    (!category || product.category === category) &&
    normalize(product.name + ' ' + product.category).includes(query),
  );
  byId('products').replaceChildren(...matches.slice(0, limit).map(productCard));
  byId('results').textContent = matches.length
    ? matches.length + (matches.length === 1 ? ' peça' : ' peças')
    : 'Nenhuma peça encontrada.';
  byId('more').hidden = limit >= matches.length;
}

for (const value of ['', ...categories]) {
  const button = cartButton(value || 'Todas', () => {
    category = value;
    limit = pageSize;
    byId('filters').querySelector('[aria-pressed=true]').setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    renderProducts();
  });
  button.setAttribute('aria-pressed', String(!value));
  byId('filters').append(button);
}
byId('search').addEventListener('input', () => {
  limit = pageSize;
  renderProducts();
});
byId('more').addEventListener('click', () => {
  limit += pageSize;
  renderProducts();
});
byId('open-cart').addEventListener('click', () => byId('cart').showModal());
byId('buy').addEventListener('click', () => {
  byId('cart').close();
  const start = byId('inicio');
  start.focus({ preventScroll: true });
  start.scrollIntoView({ block: 'start' });
});
renderCart();
renderProducts();
