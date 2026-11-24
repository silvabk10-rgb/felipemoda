// Os textos também alimentam o estúdio de arte Canvas.
const collection = slug => '/colecao/' + slug + '/';
export const artworks = [
  {key:'hero-colecao', title:'Entre luz e forma', overline:'Editorial de verão', cta:'Explorar a coleção', href:collection('todas'), alt:'Modelo de alfaiataria terracota sob a luz natural.'},
  {key:'hero-vestidos', title:'Vestidos ao vento', overline:'Seleção de vestidos', cta:'Descobrir vestidos', href:collection('vestidos'), alt:'Vestido claro em movimento entre colunas de pedra.'},
  {key:'hero-conjuntos', title:'Em boa companhia', overline:'Seleção de conjuntos', cta:'Descobrir conjuntos', href:collection('conjuntos'), alt:'Modelo combina colete claro e calça escura.'},
  {key:'cat-vestidos', title:'Vestidos', overline:'', cta:'Explorar', href:collection('vestidos'), alt:'Vestido vinho em movimento.'},
  {key:'cat-conjuntos', title:'Conjuntos', overline:'', cta:'Explorar', href:collection('conjuntos'), alt:'Conjunto grafite em uma escada de pedra.'},
  {key:'cat-calcas', title:'Calças', overline:'', cta:'Explorar', href:collection('calcas'), alt:'Calça de pregas clara e sandálias.'},
  {key:'cat-novidades', title:'Novidades', overline:'', cta:'Explorar', href:collection('novidades'), alt:'Camisa azul sob a luz do sol.'},
  {key:'mini-looks', title:'Um look, muitos caminhos', overline:'Combinações', cta:'Ver a seleção', href:collection('conjuntos'), alt:'Camisa azul, tricô claro e acessórios dispostos sobre pedra.'},
  {key:'mini-calcas', title:'Linhas de alfaiataria', overline:'Em detalhe', cta:'Explorar calças', href:collection('calcas'), alt:'Detalhe de pregas de uma calça grafite.'},
  {key:'head-vestidos', title:'Vestidos', overline:'Coleção', cta:'', href:collection('vestidos'), alt:'Tecido vinho em movimento.'},
  {key:'head-conjuntos', title:'Conjuntos', overline:'Coleção', cta:'', href:collection('conjuntos'), alt:'Conjunto verde-sálvia em uma arara de madeira.'},
  {key:'head-calcas', title:'Calças', overline:'Coleção', cta:'', href:collection('calcas'), alt:'Calças em tons de índigo, marfim e caramelo.'},
  {key:'editorial', title:'O jeito Felipe de vestir', overline:'Sobre a marca', cta:'Conheça a Felipe Modas', href:'/sobre/', alt:'Retrato editorial em luz natural junto à janela.'}
];
