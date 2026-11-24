import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import curatedProducts from '../data/curadoria.json' with {type:'json'};
import { renderSizeGuide } from './medidas.mjs';
import { shippingRates as configuredShipping } from '../commerce/config.mjs';

const source = dirname(fileURLToPath(import.meta.url));
export const company = {
  name: 'Felipe Modas',
  cnpj: '68.293.261/0001-80',
  email: 'felipemodas.atendimento.rj@gmail.com',
  whatsApp: '(21) 97462-3058',
  whatsAppUrl: 'https://wa.me/5521974623058',
  legalName: '68.293.261 LUIS FILIPE CARDOSO DO AMARAL',
  address: '10A Rua Rua Tiradentes, 23, Centro, Porto Seguro/BA, CEP 45810-000',
  hours: '',
  social: [],
};
const emailUrl = 'mailto:' + company.email;
const urls = {
  cdc: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
  decreto: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm',
  lgpd: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
  cookies: 'https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais',
};
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const link = (href, label) => '<a href="' + escape(href) + '">' + escape(label) + '</a>';
const mail = (label, subject = '') => link(emailUrl + (subject ? '?subject=' + encodeURIComponent(subject) : ''), label);
const whatsApp = (label, message = '') => link(company.whatsAppUrl + (message ? '?text=' + encodeURIComponent(message) : ''), label);
const section = (title, content, id = '') => '<section' + (id ? ' id="' + id + '"' : '') + '><h2>' + title + '</h2>' + content + '</section>';
const p = text => '<p>' + text + '</p>';
const entry = (label, href) => ({ label, href });
export const footerGroups = [
  { title: 'Atendimento', links: [entry('Fale conosco', '/atendimento/'), entry('Entregas e frete', '/entregas/'), entry('Trocas e devoluções', '/trocas-e-devolucoes/'), entry('Guia de medidas', '/guia-de-medidas/'), entry('Perguntas frequentes', '/perguntas-frequentes/')] },
  { title: 'Felipe Modas', links: [entry('Sobre a marca', '/sobre/'), entry('Termos de compra', '/termos-de-compra/'), entry('Privacidade', '/privacidade/'), entry('Cookies e preferências', '/cookies/')] }
];
const currentLinks = footerGroups.flatMap(group => group.links);
export const institutionalPaths = currentLinks.map(item => item.href);
const article = (path, title, summary, content) => ({ path, title, summary, content });
function details(question, answer) {
  return '<details><summary>' + question + '</summary><div>' + answer + '</div></details>';
}
function storeIdentity() {
  const fields = [
    ['Nome comercial', company.name], ['Razão social', company.legalName], ['CNPJ', company.cnpj],
    ['Endereço cadastral', company.address], ['Horário de atendimento', company.hours]
  ].filter(([, value]) => value);
  return '<dl class="fm-info-facts">' + fields.map(([label, value]) => '<div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>').join('') + '</dl>';
}
const returnsLink = link('/trocas-e-devolucoes/', 'Trocas e devoluções');
const helpLink = link('/atendimento/', 'Atendimento');
const cookiesLink = link('/cookies/', 'Cookies e preferências');

function contentPages({ checkoutEnabled, remotePhotos, shippingRates, products }) {
  const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const shippingChoices = shippingRates.map(rate => escape(rate.label) + ' por ' + reais.format(rate.priceCents / 100)).join(' ou ');
  const shippingText = shippingChoices
    ? 'Você pode escolher ' + shippingChoices + '. O frete tem valor fixo e é cobrado uma única vez por pedido.'
    : 'Consulte as opções de entrega para o seu pedido no atendimento.';
  const paymentText = checkoutEnabled
    ? 'Para os itens disponíveis à compra, você revisa as peças, informa os dados de entrega e escolhe o frete em uma única página. O pagamento é exclusivamente por cartão de crédito em uma parcela, processado pela Pagar.me (Stone).'
    : 'A loja aceita exclusivamente cartão de crédito em uma parcela. O pagamento online está indisponível no momento. Você pode consultar a disponibilidade de uma peça pelo ' + helpLink + '.';
  const checkoutPrivacy = checkoutEnabled
    ? section('Ao comprar', p('Para fechar um pedido, utilizamos seu nome, CPF, e-mail, telefone e endereço para identificar a compra, organizar a entrega, processar o pagamento e atender suas solicitações. O serviço de pagamento Pagar.me (Stone) recebe as informações necessárias à transação. No pagamento, o navegador envia os dados do cartão de crédito diretamente à Pagar.me para gerar um identificador de pagamento. A loja recebe esse identificador. O serviço de entrega recebe os dados de destinatário e endereço necessários ao envio.') + p('Esses tratamentos servem à contratação, à entrega, ao atendimento após a compra e ao cumprimento de obrigações fiscais e legais.'))
    : '';
  return [
    article('/sobre/', 'Sobre a Felipe Modas', 'Vestidos, conjuntos e calças que deixam espaço para o seu jeito de vestir.',
      section('Um guarda-roupa que acompanha você', p('Na Felipe Modas, a seleção começa por uma pergunta simples. De quantas maneiras essa peça cabe na sua rotina? Um conjunto pode sair inteiro ou ganhar novas combinações. Uma calça muda de tom com a escolha da blusa. Um vestido resolve o look em um gesto.') +
      p('Reunimos moda feminina com estoque próprio e peças à pronta entrega. Entre pela categoria que você gosta e observe os detalhes de cada modelo.')) +
      section('Quer uma segunda opinião?', p('Se a dúvida ficou entre duas peças ou dois tamanhos, envie o nome da peça para a nossa equipe. Conte como gosta do caimento e o que gostaria de conferir.') + p(whatsApp('Conversar com a Felipe Modas'))) +
      section('Dados da loja', storeIdentity())),
    article('/atendimento/', 'Atendimento', 'Converse com a Felipe Modas sobre uma peça, uma entrega ou uma compra.',
      '<div class="fm-info-channels"><div><h2>WhatsApp</h2>' + p(escape(company.whatsApp)) + p(whatsApp('Iniciar conversa')) + '</div><div><h2>E-mail</h2>' + p(mail(company.email)) + p('Envie sua dúvida e guarde a conversa para consultar a resposta.') + '</div></div>' +
      section('Dúvidas sobre uma peça', p('Envie o nome ou a referência do modelo, a cor e o tamanho que você procura. Se a dúvida for sobre caimento, indique a medida que gostaria de comparar.')) +
      section('Ajuda com um pedido', p('Informe o número da compra, se tiver, e descreva o que aconteceu. Para pedir devolução, basta identificar a compra e comunicar sua decisão. Evite enviar senhas, código de segurança ou foto do seu cartão.') + p(mail('Pedir ajuda com meu pedido', 'Atendimento sobre pedido')), 'pedido') +
      section('Dados da loja', storeIdentity() + p('O atendimento é feito pelos canais desta página. Para devolver uma peça, solicite à equipe as instruções de postagem ou coleta.'))),
    article('/entregas/', 'Entregas e frete', 'Confira o que observar antes do envio e como pedir ajuda se a sua encomenda atrasar.',
      section('Modalidades e valores', p(shippingText)) +
      section('Disponibilidade e prazo', p('A Felipe Modas trabalha com estoque próprio à pronta entrega. A disponibilidade depende do modelo, da cor e do tamanho.') +
      p('O prazo varia conforme o destino e a modalidade escolhida. Para confirmar a previsão antes da compra, ' + whatsApp('fale com a equipe e informe seu CEP') + '.')) +
      section('Confira o endereço', p('Revise o CEP, logradouro, número, complemento, bairro e nome da pessoa que receberá a compra. Se perceber um erro depois da confirmação, entre em contato assim que possível para verificarmos se ainda é possível alterar a entrega.')) +
      section('Pedido atrasado ou com divergência', p('Se o prazo informado na compra terminou, a embalagem chegou danificada ou você recebeu outra peça, fale com a equipe informando o número da compra. Guarde a confirmação do pedido e, se possível, uma foto da embalagem ou do item.') + p(link('/atendimento/#pedido', 'Solicitar atendimento sobre a entrega')))),
    article('/trocas-e-devolucoes/', 'Trocas e devoluções', 'Saiba como devolver uma compra feita pela internet, solicitar uma troca ou comunicar um defeito.',
      section('Desistência em até sete dias', p('Nas compras online de peças físicas, você pode desistir em até sete dias corridos contados do recebimento. Basta comunicar sua decisão dentro do prazo, sem precisar apresentar motivo. A devolução é gratuita e o reembolso é integral, incluindo o frete da compra devolvida.') +
      '<ol><li>Identifique a compra pelo número do pedido ou pelos dados usados na compra.</li><li>Solicite a devolução pelo canal da contratação, pelo WhatsApp ou por e-mail. Guarde a mensagem com a data do pedido de devolução.</li><li>A equipe confirmará o recebimento da solicitação e informará como devolver a peça sem custo. Guarde o comprovante de envio ou coleta.</li></ol>' +
      '<div class="fm-info-actions">' + mail('Solicitar devolução por e-mail', 'Direito de arrependimento — devolução de compra') + whatsApp('Solicitar pelo WhatsApp', 'Olá! Gostaria de solicitar a devolução de uma compra online.') + '</div>', 'arrependimento') +
      section('Como funciona o reembolso', p('Ao receber a manifestação de arrependimento, a loja comunica imediatamente a instituição de pagamento para cancelar a transação ou providenciar o estorno. O valor deve ser restituído integralmente. O momento em que um estorno aparece na fatura depende da administradora. Peça o comprovante ao atendimento.')) +
      section('Outra cor, outro tamanho', p('Para trocar por preferência depois do prazo de arrependimento, consulte se a oferta da sua compra incluía essa possibilidade. A equipe verificará as condições e a existência da variante desejada. Os direitos de arrependimento e de garantia legal continuam válidos.')) +
      section('Defeito ou item diferente do pedido', p('Conte o que aconteceu e identifique a peça. Em caso de vício aparente de produto durável, o prazo legal de reclamação é de 90 dias a partir da entrega. Para um vício oculto, a contagem começa quando ele se torna evidente. Decorrido o prazo legal de reparo, em regra de até 30 dias, você pode escolher substituição, restituição do valor ou abatimento proporcional, conforme o CDC. Há hipóteses legais de solução imediata.') +
      p('Se uma peça diferente da ofertada foi entregue, você pode exigir o cumprimento da oferta, aceitar equivalente ou pedir cancelamento e restituição, nos termos do CDC.') + p(link(urls.cdc, 'Consultar o Código de Defesa do Consumidor')))),
    article('/privacidade/', 'Privacidade', 'Entenda quais dados são usados na sua visita e como falar com a Felipe Modas sobre eles.',
      section('Quem cuida dos dados', p('A loja ' + escape(company.name) + ' é operada por ' + escape(company.legalName) + ', CNPJ ' + escape(company.cnpj) + ', responsável pelo tratamento dos dados pessoais. Para qualquer questão de privacidade, envie uma mensagem para ' + mail(company.email, 'Privacidade e dados pessoais') + '.')) +
      section('Durante a navegação', p('A infraestrutura de hospedagem recebe informações técnicas como endereço IP, data, horário e tipo de navegador para entregar as páginas e proteger o serviço.' + (remotePhotos ? ' Quando uma foto é carregada de um servidor externo, esse serviço recebe a requisição da imagem e os dados técnicos necessários para entregá-la.' : '')) +
      p('A sacola, os favoritos e os produtos vistos recentemente usam o armazenamento do seu navegador. Os identificadores guardados nele permitem recuperar suas escolhas. Você pode apagar essas informações em ' + cookiesLink + '.')) +
      section('Ao consultar um CEP', p('Quando você usa o preenchimento de endereço, a loja envia apenas o CEP ao ViaCEP para localizar logradouro, bairro, cidade e estado. Você pode conferir e completar os campos manualmente.')) +
      section('Quando você entra em contato', p('Utilizamos o endereço de e-mail ou o número de telefone, as mensagens e os dados da compra que você decidir enviar para responder, localizar uma solicitação ou atender a um pedido. Os serviços de e-mail e WhatsApp processam a comunicação de acordo com suas próprias políticas.')) +
      checkoutPrivacy +
      section('Conservação e compartilhamento', p('As informações de atendimento são conservadas pelo período necessário para resolver a solicitação, cumprir obrigações legais e exercer direitos. Quando a finalidade se encerra, os registros podem ser eliminados ou anonimizados, ressalvadas as hipóteses de conservação previstas em lei. Dados podem ser fornecidos a autoridades quando houver obrigação legal.')) +
      section('Seus direitos', p('Você pode solicitar confirmação de tratamento, acesso, correção, informações sobre compartilhamento e eliminação de dados nas hipóteses legais. Quando o tratamento depender de consentimento, você pode revogá-lo. Para preservar sua privacidade, podemos solicitar informações proporcionais para confirmar sua identidade.') +
      p(mail('Solicitar atendimento sobre meus dados', 'Exercício de direitos — dados pessoais') + ' · ' + link(urls.lgpd, 'Lei Geral de Proteção de Dados')))),
    article('/cookies/', 'Cookies e preferências', 'Gerencie as escolhas salvas neste navegador.',
      section('O que fica no seu dispositivo', p('A sacola guarda os modelos, as variantes e as quantidades escolhidas para que você possa retomar a seleção em outra visita. Favoritos e peças vistas recentemente também ficam neste navegador. Ao iniciar um pedido, um identificador temporário ajuda a evitar o envio repetido na mesma sessão.') +
      p('A vitrine não carrega pixels de publicidade nem ferramentas de medição de audiência. Os serviços externos que você abrir, como o WhatsApp, têm suas próprias configurações de privacidade.')) +
      section('Gerenciar dados locais', p('Escolha o que deseja apagar neste dispositivo. A seleção apagada não pode ser recuperada. Essa limpeza não cancela pedidos nem apaga conversas com a loja.') +
      '<form id="fm-browser-data"><fieldset><legend>Dados para apagar</legend><label><input type="checkbox" name="area" value="recent"> Produtos vistos recentemente</label><label><input type="checkbox" name="area" value="favorites"> Favoritos</label><label><input type="checkbox" name="area" value="cart"> Itens da sacola</label></fieldset><button type="submit">Apagar seleção</button><p id="fm-preferences-status" role="status"></p></form><noscript><p>Para apagar os dados com JavaScript desativado, use as configurações de privacidade do seu navegador e remova os dados deste site.</p></noscript>') +
      section('Outras opções', p('As configurações de privacidade do navegador permitem bloquear ou excluir dados deste site. Se o armazenamento for bloqueado, suas escolhas poderão deixar de ser recuperadas em uma próxima visita.') + p(link('/privacidade/', 'Ler a política de privacidade')))),
    article('/termos-de-compra/', 'Termos de compra', 'Consulte as condições aplicáveis aos produtos e pedidos da Felipe Modas.',
      section('A loja e as ofertas', storeIdentity() + p('A descrição de cada peça indica os atributos confirmados para o modelo. Os preços de venda, quando disponíveis, são expressos em reais. Leia as informações da cor e do tamanho escolhidos. Para esclarecer uma característica antes da compra, use o ' + helpLink + '.')) +
      section('Antes de confirmar', p('Confira a variante, a quantidade, os itens, o desconto eventualmente aplicado, o frete, o prazo e o total da compra. Corrija o endereço e os itens antes de enviar o pedido. Apenas promoções ativas, dentro de suas condições publicadas, podem ser utilizadas.') + p(shippingText)) +
      section('Pagamento do pedido', p(paymentText) + p('A aprovação do pagamento depende da confirmação do provedor. Se o valor já aparece na fatura e o pedido segue pendente, guarde o comprovante e envie o número do pedido ao atendimento antes de tentar novamente.')) +
      section('Entrega, cancelamento e devolução', p('Consulte as condições de ' + link('/entregas/', 'entrega e frete') + ' e as instruções em ' + returnsLink + '. Para alterações ou cancelamentos, entre em contato com a identificação da compra. Os direitos previstos no Código de Defesa do Consumidor se aplicam às compras na loja.') + p(link(urls.decreto, 'Decreto sobre comércio eletrônico') + ' · ' + link(urls.cdc, 'Código de Defesa do Consumidor')))),
    article('/perguntas-frequentes/', 'Perguntas frequentes', 'Respostas para acompanhar sua escolha, da medida da peça ao atendimento depois da compra.',
      '<div class="fm-info-faq">' +
      details('Como escolho meu tamanho?', p('Compare suas medidas com as informações do modelo. O ' + link('/guia-de-medidas/', 'guia de medidas') + ' explica onde posicionar a fita. Se faltar uma medida específica na página, peça a conferência ao atendimento.')) +
      details('As peças são de pronta entrega?', p('A loja trabalha com estoque próprio à pronta entrega. A disponibilidade para compra depende da cor e do tamanho que você procura.')) +
      details('Quanto custa o frete?', p(shippingText) + p(link('/entregas/', 'Consultar as condições de entrega'))) +
      details('Como faço o pagamento?', p(paymentText)) +
      details('Posso devolver uma peça comprada pela internet?', p('Sim. Você pode comunicar a desistência em até sete dias corridos do recebimento, com devolução gratuita e reembolso integral. Veja como solicitar em ' + returnsLink + '.')) +
      details('Como consulto uma compra ou um atraso?', p('Tenha o número do pedido em mãos e ' + link('/atendimento/#pedido', 'fale com a equipe sobre a sua compra') + '.')) +
      details('Como removo minha sacola ou meus favoritos?', p('Você pode remover itens individualmente ou apagar uma categoria de dados deste navegador em ' + cookiesLink + '.')) + '</div>'),
    article('/guia-de-medidas/', 'Guia de medidas', 'Consulte os tamanhos, equivalências e comprimentos das peças da Felipe Modas e aprenda a tirar suas medidas.', renderSizeGuide(products, company.whatsAppUrl)),
  ];
}
function navigation(current) {
  const items = currentLinks.map(({href, label}) => '<a href="' + href + '"' + (href === current ? ' aria-current="page"' : '') + '>' + escape(label) + '</a>').join('');
  return '<aside class="fm-info-side"><nav aria-label="Sobre a loja e atendimento">' + items + '</nav><details><summary>Outras informações da loja</summary><nav aria-label="Outras páginas">' + items + '</nav></details></aside>';
}
function legacyPolicy() {
  const rows = [
    ['termos', 'Termos de compra', '/termos-de-compra/', 'Informações sobre as ofertas e a contratação.'],
    ['privacidade', 'Privacidade', '/privacidade/', 'Como os dados são utilizados e como exercer seus direitos.'],
    ['seguranca', 'Segurança e atendimento', '/atendimento/', 'Tire dúvidas sobre uma cobrança ou uma compra.'],
    ['entrega', 'Entrega e pagamento', '/entregas/', 'Condições de entrega e orientações para o seu pedido.'],
    ['trocas', 'Trocas e devoluções', '/trocas-e-devolucoes/', 'Solicite uma devolução ou receba orientação sobre uma peça.']
  ];
  return article('/politicas.html', 'Políticas da loja', 'Consulte as condições e encontre o atendimento que procura.',
    rows.map(([id, title, href, subtitle]) => section(title, p(subtitle) + p(link(href, 'Consultar ' + title.toLowerCase())), id)).join(''));
}
export async function buildInstitutional({ outDir, layout, checkoutEnabled = false, remotePhotos = false, shippingRates = configuredShipping, products = curatedProducts.filter(p => ['active','listed'].includes(p.status)) }) {
  const assetDir = join(outDir, 'institucional');
  await mkdir(assetDir, { recursive: true });
  await Promise.all(['info.css', 'preferencias.js', 'medidas.css', 'medidas.js', 'tabela-canvas.mjs'].map(file => copyFile(join(source, file), join(assetDir, file))));
  const pages = [...contentPages({ checkoutEnabled, remotePhotos, shippingRates, products }), legacyPolicy()];
  for (const page of pages) {
    const path = page.path;
    const isGuide = path === '/guia-de-medidas/';
    const body = isGuide ? page.content : '<div class="fm-info-shell"><nav class="fm-info-crumb" aria-label="Caminho de navegação"><a href="/">Início</a><span aria-hidden="true">/</span><span aria-current="page">' + escape(page.title) + '</span></nav><div class="fm-info-grid">' + navigation(path) +
       '<article class="fm-info-article"><header class="fm-info-header"><h1>' + escape(page.title) + '</h1><p>' + escape(page.summary) + '</p></header>' + page.content + '</article></div></div>';
    const head = isGuide ? '<link rel="stylesheet" href="/institucional/medidas.css"><script type="module" src="/institucional/medidas.js"></script><script type="module" src="/institucional/tabela-canvas.mjs"></script>' : '<link rel="stylesheet" href="/institucional/info.css">' + (path === '/cookies/' ? '<script type="module" src="/institucional/preferencias.js"></script>' : '');
    const output = path.endsWith('/') ? join(outDir, path.slice(1), 'index.html') : join(outDir, path.slice(1));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, await layout({ title: page.title, description: page.summary, canonical: 'https://felipemodasbr.com' + path, path, body, head }));
  }
  return pages.map(page => page.path);
}
