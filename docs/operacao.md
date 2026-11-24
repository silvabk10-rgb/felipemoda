# Manutenção das informações da Felipe Modas

## Cadastro empresarial

O proprietário confirmou a razão social e o uso do CNPJ já existente na loja. As páginas de identificação usam esse cadastro central e os canais de atendimento do site.

| Campo | Registro para a loja |
|---|---|
| Nome comercial | Felipe Modas |
| Razão social | 68.293.261 LUIS FILIPE CARDOSO DO AMARAL |
| CNPJ | 68.293.261/0001-80 |
| E-mail | felipemodas.atendimento.rj@gmail.com |
| WhatsApp | (21) 97462-3058 |
| Endereço cadastral | 10A Rua Rua Tiradentes, 23, Centro, Porto Seguro/BA, CEP 45810-000 |
| Horário de atendimento e redes sociais | Informar somente se confirmados. |

O cadastro fica no objeto `company` de `institucional/build.mjs`. Em 24/11/2026, CNPJ.biz e CNPJá exibiam a matriz como ativa e coincidiam quanto a logradouro, número, bairro, município, UF e CEP. As duas consultas trazem a grafia “10A Rua Rua Tiradentes” e não indicam complemento. A loja autorizou publicar o endereço cadastral. O atendimento usa os canais da loja. Oriente a postagem ou coleta de uma devolução individualmente após a solicitação. [CNPJ.biz](https://cnpj.biz/68293261000180) · [CNPJá](https://cnpja.com/office/68293261000180).

Ao alterar o nome comercial, o telefone ou o domínio, confira também o cabeçalho, o rodapé, o checkout e o canonical das páginas. Ao alterar o WhatsApp, atualize o texto de exibição e a URL com o telefone internacional.

## Políticas e páginas

As nove rotas institucionais são geradas por `buildInstitutional({outDir, layout, checkoutEnabled, remotePhotos, shippingRates})`. A função devolve a lista de caminhos gerados. A lista `footerGroups` organiza os links e `institutionalPaths` identifica as rotas canônicas atuais. O arquivo `/politicas.html` mantém os destinos antigos com os fragmentos `#termos`, `#privacidade`, `#seguranca`, `#entrega` e `#trocas`.

| Quem atualiza | Quando revisar | Onde revisar |
|---|---|---|
| Atendimento | Mudança de canal, razão social, endereço ou horário | Cadastro e páginas Sobre, Atendimento e Termos. |
| Logística | Mudança de região atendida, cálculo de frete ou processo de devolução | Entregas e frete, Trocas e devoluções, checkout e FAQ. |
| Comercial | Nova condição de troca por preferência, cupom ou forma de pagamento | Termos, checkout e oferta em que a condição se aplica. |
| Responsável pela privacidade | Mudança de hospedagem, fotos externas, pagamentos, analytics, mídias ou serviços de atendimento | Privacidade, Cookies e preferências e lista efetiva de parceiros e dados. |

O frete aprovado é único por pedido, com PAC por R$ 23,00 ou SEDEX por R$ 48,00. Atualize `shippingRates` em `commerce/config.mjs` para mudar as modalidades e seus valores. O checkout e as páginas de entrega, termos e FAQ usam essa fonte. Não há prazo de transporte definido para publicação. O atendimento pode informar a previsão para o CEP consultado.

A página `/checkout/` reúne contato, endereço, frete, revisão e pagamento exclusivamente por cartão de crédito em uma parcela. A consulta de endereço por CEP usa ViaCEP no servidor. A página de privacidade identifica o serviço. `checkoutEnabled` indica que a vitrine tem catálogo ativo e modo compatível com o ambiente. O servidor verifica as credenciais de sua própria configuração antes de qualquer pagamento. A autorização depende de uma resposta confirmada do provedor. A Pagar.me (Stone) recebe os dados do cartão diretamente do navegador para tokenização. A loja usa o identificador retornado. Ajuste-o se os operadores, os campos ou a finalidade mudarem. Se as fotografias dos produtos forem solicitadas a um servidor externo, passe `remotePhotos: true` para informar o tráfego dessa visita.

O site não precisa solicitar autorização publicitária para uma integração que não existe. Se a loja incorporar medição ou publicidade que dependa de consentimento, adicione controles para aceitar, recusar ou personalizar as categorias com igual facilidade, bloqueie as chamadas antes da escolha e permita revisar a decisão em Cookies e preferências.

As chaves locais da sacola, dos favoritos e das peças visitadas estão em `institucional/preferencias.js`. Mantenha-as iguais às do módulo de vitrine. As ações de limpeza não apagam pedidos no servidor nem a proteção de reenvio da sessão de checkout.

## Atendimento após a compra

1. Receba a solicitação no canal da contratação ou por e-mail/WhatsApp. Identifique o pedido com o mínimo de dados necessário.
2. Confirme imediatamente o recebimento da demanda e encaminhe uma manifestação ao consumidor em até cinco dias, conforme o Decreto nº 7.962/2013. Mantenha a data da mensagem.
3. Para arrependimento em até sete dias corridos do recebimento de um produto físico comprado online, registre a manifestação, envie a logística reversa gratuita e comunique imediatamente a instituição financeira para cancelamento ou estorno. Ofereça restituição integral dos valores da compra devolvida.
4. Considere separadamente divergência da oferta, vício do produto e troca por preferência. A compra de tamanho incorreto dentro dos sete dias conserva o direito de arrependimento. Condições adicionais de troca podem ser anunciadas após serem definidas.
5. Forneça a confirmação do pedido e o resumo contratual em formato conservável. Restrinja os dados de acompanhamento à pessoa autorizada. Só habilite acesso a acompanhamento quando o sistema real puder prestar essa informação.

## Referências conferidas

- [Decreto nº 7.962/2013, especialmente arts. 2º, 4º e 5º](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm)
- [Código de Defesa do Consumidor, especialmente arts. 18, 26, 35 e 49](https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm)
- [Lei Geral de Proteção de Dados Pessoais](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [Guia da ANPD sobre cookies e proteção de dados pessoais](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_orientativo_cookies_e_protecao_de_dados_pessoais)
