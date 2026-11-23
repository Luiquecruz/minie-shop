/**
 * Lightweight redirect table for legacy numeric PDP URLs (`/product/:id` -> `/:category/:slug`)
 * derived from `docs/data-mapping.md` (`MS-00001`..`MS-00030`).
 * Contains zero product data (no titles, prices, descriptions, or images).
 */
export interface LegacyProductTarget {
  categorySlug: string;
  slug: string;
}

export const LEGACY_PRODUCT_ID_TO_TARGET: Readonly<
  Record<string, LegacyProductTarget>
> = {
  '1': { categorySlug: 'audio', slug: 'fone-de-ouvido-bluetooth-over-ear-pro' },
  '2': { categorySlug: 'wearables-e-vr', slug: 'smartwatch-fitness-active-series' },
  '3': { categorySlug: 'perifericos', slug: 'teclado-mecanico-rgb-switch-brown' },
  '4': { categorySlug: 'perifericos', slug: 'mouse-optico-ergonomico-sem-fio' },
  '5': { categorySlug: 'audio', slug: 'caixa-de-som-portatil-bluetooth-waterproof' },
  '6': { categorySlug: 'foto-video-e-drones', slug: 'camera-mirrorless-4k-creator-kit' },
  '7': { categorySlug: 'bolsas-e-mochilas', slug: 'mochila-urbana-impermeavel-antifurto' },
  '8': { categorySlug: 'oculos-e-relogios', slug: 'oculos-de-sol-polarizado-classic-aviator' },
  '9': { categorySlug: 'dia-a-dia', slug: 'carteira-slim-em-couro-legitimo' },
  '10': { categorySlug: 'dia-a-dia', slug: 'garrafa-termica-inox-vacuum-750ml' },
  '11': { categorySlug: 'esportivos', slug: 'tenis-running-ultralight-performance' },
  '12': { categorySlug: 'casuais', slug: 'tenis-casual-canvas-vintage' },
  '13': { categorySlug: 'casacos-e-moletons', slug: 'jaqueta-jeans-trucker-vintage' },
  '14': { categorySlug: 'camisetas', slug: 'camiseta-basica-algodao-pima-premium' },
  '15': { categorySlug: 'casacos-e-moletons', slug: 'moletom-hoodie-minimalista-com-capuz' },
  '16': { categorySlug: 'home-office', slug: 'luminaria-de-mesa-articulada-nordica' },
  '17': { categorySlug: 'cozinha-e-cafe', slug: 'kit-xicaras-de-ceramica-artesanal-2-un' },
  '18': { categorySlug: 'cozinha-e-cafe', slug: 'cafeteira-prensa-francesa-inox-600ml' },
  '19': { categorySlug: 'bem-estar', slug: 'vela-aromatica-artesanal-soja-baunilha' },
  '20': { categorySlug: 'home-office', slug: 'cadeira-de-escritorio-ergonomica-mesh' },
  '21': { categorySlug: 'tablets-e-energia', slug: 'carregador-sem-fio-fast-charge-15w' },
  '22': { categorySlug: 'foto-video-e-drones', slug: 'drone-compacto-dobravel-4k-hdr' },
  '23': { categorySlug: 'audio', slug: 'earbuds-tws-cancelamento-de-ruido' },
  '24': { categorySlug: 'oculos-e-relogios', slug: 'oculos-de-grau-bloqueio-luz-azul' },
  '25': { categorySlug: 'oculos-e-relogios', slug: 'relogio-de-pulso-analogico-couro-camel' },
  '26': { categorySlug: 'bolsas-e-mochilas', slug: 'bolsa-mala-de-viagem-duffle-weekend' },
  '27': { categorySlug: 'tablets-e-energia', slug: 'tablet-10-5-polegadas-retina-display' },
  '28': { categorySlug: 'wearables-e-vr', slug: 'oculos-de-realidade-virtual-imersivo' },
  '29': { categorySlug: 'home-office', slug: 'organizador-de-mesa-em-madeira-aluminio' },
  '30': { categorySlug: 'suporte-e-setup', slug: 'suporte-articulado-para-notebook-aluminio' },
};

export function resolveLegacyProductPath(legacyId: string | undefined): string | null {
  if (!legacyId) return null;
  const target = Object.hasOwn(LEGACY_PRODUCT_ID_TO_TARGET, legacyId)
    ? LEGACY_PRODUCT_ID_TO_TARGET[legacyId]
    : undefined;
  return target ? `/${target.categorySlug}/${target.slug}` : null;
}
