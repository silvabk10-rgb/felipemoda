const form = document.querySelector('#fm-browser-data');
const message = document.querySelector('#fm-preferences-status');
const keys = {
  recent: ['felipe-moda-vistos-v1'],
  favorites: ['felipe-moda-favoritos-v1'],
  cart: ['felipe-moda-sacola-v2', 'casa-basica-cart-v1']
};

form?.addEventListener('submit', event => {
  event.preventDefault();
  const choices = new FormData(form).getAll('area').filter(area => Object.hasOwn(keys, area));
  if (!choices.length) {
    message.textContent = 'Selecione pelo menos um tipo de dado para apagar.';
    return;
  }
  try {
    for (const area of choices) {
      for (const key of keys[area]) localStorage.removeItem(key);
    }
    if (choices.includes('cart')) {
      document.querySelectorAll('[data-cart-count]').forEach(count => { count.textContent = '0'; });
    }
    form.reset();
    message.textContent = 'Os dados selecionados foram apagados deste navegador.';
  } catch {
    message.textContent = 'Seu navegador bloqueou o acesso. Use as configurações de privacidade do navegador para apagar os dados deste site.';
  }
});
