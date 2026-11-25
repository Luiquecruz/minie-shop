import type { MessageKey } from './en';

export const ptBRMessages: Record<MessageKey, string> = {
  // Navigation & Global
  'nav.brandAria': 'Início da Minie Shop',
  'nav.currencyLabel': 'Moeda',
  'nav.currencyAria': 'Selecionar moeda de exibição',
  'nav.languageLabel': 'Idioma',
  'nav.languageAria': 'Selecionar idioma da interface',
  'nav.cartAria': 'Carrinho de compras com {count} itens',
  'nav.cartLabel': 'Carrinho',
  'search.placeholder': 'Buscar produtos...',
  'search.ariaLabel': 'Buscar produtos',
  'search.clearAria': 'Limpar busca',
  'search.submitAria': 'Enviar busca',
  'search.seeAllResults': 'Ver todos os resultados para «{query}»',
  'search.noSuggestions': 'Nenhuma sugestão',
  'search.suggestionsError': 'Não foi possível carregar sugestões',
  'search.suggestionsLoading': 'Buscando sugestões...',
  'search.suggestionsAvailableSingular': '1 sugestão disponível',
  'search.suggestionsAvailable': '{count} sugestões disponíveis',
  'search.suggestionsListboxAria': 'Sugestões de busca',

  // Search Results Page
  'searchPage.metaTitle': 'Buscar Produtos | Minie Shop',
  'searchPage.metaTitleWithQuery': 'Busca: {query} | Minie Shop',
  'searchPage.metaDescription':
    'Busque produtos na Minie Shop com correspondência híbrida semântica e textual.',
  'searchPage.badge': 'Busca no Catálogo',
  'searchPage.heading': 'Buscar Produtos',
  'searchPage.resultsHeading': 'Resultados da busca',
  'searchPage.inputLabel': 'Buscar produtos',
  'searchPage.inputPlaceholder': 'O que você está procurando?',
  'searchPage.submitButton': 'Buscar',
  'searchPage.resultsSingular': '1 resultado para «{query}»',
  'searchPage.resultsPlural': '{count} resultados para «{query}»',
  'searchPage.noResultsLive': 'Nenhum resultado',
  'searchPage.showingOf': 'Exibindo {loaded} de {total} resultados para «{query}»',
  'searchPage.updating': 'Atualizando resultados...',
  'searchPage.loadingResults': 'Carregando resultados da busca',
  'searchPage.emptyPromptTitle': 'Digite para buscar produtos',
  'searchPage.emptyPromptText':
    'Busque por nome do produto, categoria ou descreva como pretende utilizá-lo.',
  'searchPage.emptyResultsTitle': 'Nenhum resultado para «{query}»',
  'searchPage.emptyResultsTip':
    'Revise a ortografia, use termos mais curtos ou explore o catálogo completo.',
  'searchPage.backToCatalog': 'Explorar catálogo',
  'searchPage.loadMore': 'Carregar mais',
  'searchPage.loadingMore': 'Carregando mais...',
  'searchPage.offsetLimitReached':
    'Refine sua busca para ver resultados mais específicos',
  'searchPage.errorTitle': 'Não foi possível concluir a busca',
  'searchPage.errorFallback':
    'A busca está temporariamente indisponível. Tente novamente.',
  'searchPage.retry': 'Tentar novamente',
  'searchPage.loadingRoute': 'Carregando busca...',
  'searchPage.devBadge': 'DEV • mode: {mode} • {ms} ms',

  // Recommendations & Carousel
  'recommendations.relatedTitle': 'Você também pode gostar',
  'recommendations.upsellTitle': 'Alternativas para considerar',
  'recommendations.crossSellTitle': 'Combine com o seu pedido',
  'recommendations.previousAria': 'Produtos anteriores em {title}',
  'recommendations.nextAria': 'Próximos produtos em {title}',
  'recommendations.previousLabel': 'Anterior',
  'recommendations.nextLabel': 'Próximo',
  'recommendations.carouselRoleDescription': 'carrossel',
  'recommendations.loadingAria': 'Carregando {title}',
  'recommendations.devErrorBadge': 'DEV • Erro ao carregar recomendações ({code})',

  // Pricing
  'price.currentPriceAria': 'Preço atual {price}',

  // Catalog / PLP
  'plp.metaTitle': 'Catálogo de Produtos | Minie Shop',
  'plp.metaDescription':
    'Explore produtos selecionados na Minie Shop com filtros em tempo real, preços transparentes e entrega rápida.',
  'plp.badge': 'Coleção Completa',
  'plp.title': 'Catálogo de Produtos',
  'plp.subtitle':
    'Explore nossa coleção selecionada com filtros estruturados, disponibilidade ao vivo e preços transparentes.',
  'plp.sortLabel': 'Ordenar por:',
  'plp.sortAria': 'Ordenar produtos',
  'plp.sort.newest': 'Mais recentes',
  'plp.sort.price_asc': 'Menor preço',
  'plp.sort.price_desc': 'Maior preço',
  'plp.sort.name_asc': 'Nome (A - Z)',
  'plp.sort.relevance': 'Relevância',
  'plp.resultsUpdated': 'Resultados atualizados',
  'plp.resultsUpdatedWithCount':
    'Resultados atualizados: {count} produtos disponíveis',
  'plp.showingLoaded': 'Exibindo {count} produtos carregados',
  'plp.showingLoadedOf': 'Exibindo {loaded} de {total} produtos',
  'plp.updating': 'Atualizando resultados...',
  'plp.loadingProducts': 'Carregando produtos',
  'plp.loadMore': 'Carregar mais',
  'plp.loadingMore': 'Carregando mais...',
  'plp.errorTitle': 'Não foi possível carregar os produtos',
  'plp.errorFallback':
    'Não foi possível carregar os produtos. Tente novamente.',
  'plp.retry': 'Tentar novamente',
  'plp.retrying': 'Tentando...',
  'plp.emptyTitle': 'Nenhum produto encontrado',
  'plp.emptyText': 'Tente ajustar os filtros ou os termos de busca.',
  'plp.clearFilters': 'Limpar filtros',
  'plp.dismissNotification': 'Dispensar notificação',

  // Filters Sidebar / Panel
  'filters.formAria': 'Filtros do catálogo',
  'filters.heading': 'Filtros',
  'filters.clearAll': 'Limpar tudo',
  'filters.categoriesLegend': 'Categorias',
  'filters.allCategories': 'Todas as categorias',
  'filters.priceLegend': 'Faixa de preço',
  'filters.minPriceLabel': 'Preço mín. ({currency})',
  'filters.maxPriceLabel': 'Preço máx. ({currency})',
  'filters.availabilityLegend': 'Disponibilidade',
  'filters.inStockOnly': 'Apenas em estoque',
  'filters.yes': 'Sim',
  'filters.no': 'Não',
  'filters.minValue': 'Mín',
  'filters.maxValue': 'Máx',

  // Product Card
  'card.viewDetails': 'Ver detalhes de {name}',
  'card.highlightsAria': 'Destaques do produto',
  'card.inStock': 'Em estoque',
  'card.outOfStock': 'Fora de estoque',
  'card.addToCart': 'Adicionar',
  'card.addToCartAria': 'Adicionar {name} ao carrinho',
  'card.saveFavorite': 'Salvar nos favoritos',
  'card.removeFavorite': 'Remover dos favoritos',
  'card.addFavoriteAria': 'Adicionar {name} aos favoritos',
  'card.removeFavoriteAria': 'Remover {name} dos favoritos',

  // Product Image
  'image.unavailable': 'Imagem indisponível',

  // PDP
  'pdp.metaDescriptionFallback':
    'Compre {name} na Minie Shop com o melhor preço e entrega rápida.',
  'pdp.breadcrumbAria': 'Trilha de navegação',
  'pdp.breadcrumbCatalog': 'Catálogo',
  'pdp.galleryAria': 'Galeria de imagens do produto',
  'pdp.detailsAria': 'Detalhes do produto',
  'pdp.saved': 'Salvo',
  'pdp.save': 'Salvar',
  'pdp.inStock': 'Em estoque',
  'pdp.outOfStock': 'Fora de estoque',
  'pdp.addToCart': 'Adicionar ao carrinho',
  'pdp.buyNow': 'Comprar agora',
  'pdp.buyNowAria': 'Comprar {name} agora',
  'pdp.floatingBarAria': 'Ações rápidas',
  'pdp.addedToCart': '"{name}" adicionado ao carrinho!',
  'pdp.proceedingToCheckout': 'Seguindo para o checkout com "{name}"!',
  'pdp.tabDescription': 'Descrição',
  'pdp.tabSpecs': 'Especificações',
  'pdp.noSpecs': 'Nenhum atributo técnico cadastrado para este produto.',
  'pdp.errorTitle': 'Não foi possível carregar o produto',
  'pdp.errorFallback': 'Não foi possível carregar este produto no momento.',
  'pdp.backToCatalog': 'Voltar ao catálogo',
  'pdp.swipeHint': 'Deslize para explorar as fotos',
  'pdp.assuranceShipping': 'Envio expresso rápido',
  'pdp.assuranceWarranty': 'Garantia oficial de 12 meses',
  'pdp.assuranceReturn': 'Devolução gratuita em até 30 dias',

  // MiniCart
  'miniCart.drawerAria': 'Gaveta do carrinho de compras',
  'miniCart.title': 'Seu Carrinho',
  'miniCart.closeAria': 'Fechar gaveta do carrinho',
  'miniCart.emptyTitle': 'Seu carrinho está vazio',
  'miniCart.emptyDesc':
    'Parece que você ainda não adicionou nenhum produto ao carrinho.',
  'miniCart.exploreCatalog': 'Explorar catálogo',
  'miniCart.removeItemAria': 'Remover {name} do carrinho',
  'miniCart.unitPriceEach': '({price} cada)',
  'miniCart.availableCount': '{count} disponíveis',
  'miniCart.subtotal': 'Subtotal',
  'miniCart.total': 'Total',
  'miniCart.taxNote': 'Frete e impostos calculados no checkout.',
  'miniCart.proceedToCheckout': 'Finalizar compra',
  'miniCart.viewFullCart': 'Ver carrinho completo',
  'miniCart.checkoutNotice':
    'O fluxo de checkout estará disponível na próxima etapa.',
  'miniCart.updatingItemPrice': 'Atualizando preço do item',
  'miniCart.updatingSubtotal': 'Atualizando subtotal',
  'miniCart.updatingTotal': 'Atualizando total',
  'miniCart.liveUpdatingTotals': 'Atualizando totais em {currency}...',
  'miniCart.liveSubtotalUpdated': 'Subtotal do carrinho em {currency}: {amount}',

  // Cart Page
  'cart.metaTitle': 'Carrinho de Compras | Minie Shop',
  'cart.metaTitleWithCount': 'Carrinho de Compras ({count}) | Minie Shop',
  'cart.metaDescription':
    'Revise seu carrinho, ajuste quantidades, aplique cupons e escolha a forma de envio na Minie Shop.',
  'cart.breadcrumbAria': 'Trilha de navegação',
  'cart.breadcrumbCatalog': 'Catálogo',
  'cart.title': 'Carrinho de Compras',
  'cart.unitSingular': 'unidade',
  'cart.unitPlural': 'unidades',
  'cart.clearCart': 'Limpar carrinho',
  'cart.emptySectionAria': 'Carrinho de compras vazio',
  'cart.emptyTitle': 'Seu carrinho de compras está vazio',
  'cart.emptyDesc':
    'Adicione produtos do catálogo para testar validações de quantidade, cupons, opções de frete e memoização de seletores Redux.',
  'cart.exploreCatalog': 'Explorar catálogo',
  'cart.itemsSectionAria': 'Itens do carrinho',
  'cart.viewItemAria': 'Ver {name}',
  'cart.remove': 'Remover',
  'cart.removeItemAria': 'Remover {name} do carrinho',
  'cart.eachPrice': '{price} cada',
  'cart.updatingUnitPrice': 'Atualizando preço unitário',
  'cart.updatingLineTotal': 'Atualizando total do item',
  'cart.decreaseQty': 'Diminuir quantidade',
  'cart.increaseQty': 'Aumentar quantidade',
  'cart.decreaseQtyFor': 'Diminuir quantidade de {name}',
  'cart.increaseQtyFor': 'Aumentar quantidade de {name}',
  'cart.qtyLabel': 'Quantidade do produto',
  'cart.qtyLabelFor': 'Quantidade de {name}',
  'cart.inStockCount': '{count} em estoque',
  'cart.validatingStock': 'Validando estoque',
  'cart.validatingStockEllipsis': 'Validando estoque...',
  'cart.lineTotal': 'Total do item',
  'cart.stockValidateError': 'Não foi possível validar o estoque agora.',
  'cart.maxStockReached': 'Estoque máximo atingido ({max} unidades).',
  'cart.onlyAvailableInStock': 'Apenas {max} unidades disponíveis em estoque.',
  'cart.outOfStockWarning': 'Este produto está indisponível no momento.',
  'cart.quoteError':
    'Não foi possível atualizar os preços do carrinho para a moeda selecionada.',
  'cart.retry': 'Tentar novamente',

  // Cart Promo
  'cart.promoHeading': 'Cupom Promocional',
  'cart.promoInputLabel': 'Código promocional',
  'cart.promoPlaceholder': 'Digite MINIE10, MINIE20 ou FREESHIP',
  'cart.promoApply': 'Aplicar',
  'cart.promoChipsAria': 'Cupons disponíveis',
  'cart.promoRemoveAria': 'Remover cupom {code}',
  'cart.promoRemove': 'Remover',
  'cart.promo.MINIE10': '10% de desconto no subtotal dos itens',
  'cart.promo.MINIE20': '20% de desconto no subtotal dos itens',
  'cart.promo.FREESHIP': 'Frete grátis nas modalidades Padrão ou Expresso',
  'cart.promo.emptyError': 'Informe um código promocional para aplicar.',
  'cart.promo.invalidError':
    'O código promocional "{code}" é inválido. Tente MINIE10, MINIE20 ou FREESHIP.',

  // Cart Shipping
  'cart.shippingHeading': 'Método de Envio',
  'cart.shippingFree': 'Grátis',
  'cart.updatingShippingPrice': 'Atualizando valor do frete',
  'cart.shipping.standard.name': 'Entrega Padrão',
  'cart.shipping.standard.eta': '5-7 dias úteis',
  'cart.shipping.express.name': 'Entrega Expressa',
  'cart.shipping.express.eta': '1-2 dias úteis',
  'cart.shipping.pickup.name': 'Retirar na Loja',
  'cart.shipping.pickup.eta': 'Pronto em 2 horas',

  // Cart Order Note
  'cart.noteHeading': 'Observações do Pedido e Entrega',
  'cart.noteHint':
    'Adicione instruções para presente ou preferências de entrega.',
  'cart.notePlaceholder':
    'Ex.: Deixar na portaria, embrulhar para presente...',
  'cart.noteCounter': '{length}/{max} caracteres',

  // Cart Summary
  'cart.summaryHeading': 'Resumo do Pedido',
  'cart.freeShippingAddMoreBefore': 'Adicione mais ',
  'cart.freeShippingAddMoreAfter': ' para ganhar Entrega Padrão grátis',
  'cart.freeShippingUnlocked': 'Você desbloqueou a Entrega Padrão grátis!',
  'cart.freeShippingProgressAria': 'Progresso para frete padrão grátis',
  'cart.subtotalWithUnits': 'Subtotal ({count} unidades)',
  'cart.promoLine': 'Cupom ({code})',
  'cart.shippingLine': 'Frete ({name})',
  'cart.noteAttached': 'Observação anexada',
  'cart.estimatedTotal': 'Total Estimado',
  'cart.updatingSubtotal': 'Atualizando subtotal',
  'cart.updatingDiscount': 'Atualizando desconto',
  'cart.updatingShipping': 'Atualizando frete',
  'cart.updatingEstimatedTotal': 'Atualizando total estimado',
  'cart.checkoutNotice':
    'O fluxo de checkout será adicionado no próximo incremento da Fase 6.',
  'cart.proceedToCheckout': 'Finalizar compra',
  'cart.continueShopping': 'Continuar comprando',

  // 404 Page
  'notFound.metaTitle': 'Página Não Encontrada | Minie Shop',
  'notFound.metaDescription':
    'A página ou o produto solicitado não foi encontrado.',
  'notFound.badge': '404',
  'notFound.title': 'Produto ou Página Não Encontrada',
  'notFound.description':
    'Não conseguimos encontrar o recurso que você procura. Ele pode ter sido removido ou movido para outro endereço.',
  'notFound.backToCatalog': 'Voltar ao catálogo',

  // Favorites error
  'favorites.toggleError':
    'Não foi possível atualizar o favorito. Sua alteração foi revertida.',
};
