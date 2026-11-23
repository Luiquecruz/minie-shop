import type {
  CategoriesResponseDTO,
  ImageDTO,
  ProductCardDTO,
  ProductDetailDTO,
} from '@minieshop/contracts';

const TINY_PLACEHOLDER =
  'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';

function makeImage(id: string, slug: string, alt: string): ImageDTO {
  return {
    id,
    alt,
    width: 1200,
    height: 900,
    placeholder: TINY_PLACEHOLDER,
    variants: [
      {
        name: 'thumb',
        url: `http://localhost:8333/minieshop-catalog-public/${slug}-320.webp`,
        width: 320,
        height: 240,
      },
      {
        name: 'card',
        url: `http://localhost:8333/minieshop-catalog-public/${slug}-640.webp`,
        width: 640,
        height: 480,
      },
      {
        name: 'detail',
        url: `http://localhost:8333/minieshop-catalog-public/${slug}-1200.webp`,
        width: 1200,
        height: 900,
      },
    ],
  };
}

export const FIXTURE_CATEGORIES: CategoriesResponseDTO = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    slug: 'eletronicos',
    name: 'Eletrônicos',
    productCount: 4,
    children: [
      {
        id: '10000000-0000-4000-8000-000000000011',
        slug: 'audio',
        name: 'Áudio',
        productCount: 2,
        children: [],
      },
      {
        id: '10000000-0000-4000-8000-000000000012',
        slug: 'perifericos',
        name: 'Periféricos',
        productCount: 2,
        children: [],
      },
    ],
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    slug: 'casa-e-decoracao',
    name: 'Casa & Decoração',
    productCount: 2,
    children: [
      {
        id: '10000000-0000-4000-8000-000000000021',
        slug: 'home-office',
        name: 'Home Office',
        productCount: 1,
        children: [],
      },
      {
        id: '10000000-0000-4000-8000-000000000022',
        slug: 'bem-estar',
        name: 'Bem-estar & Aromas',
        productCount: 1,
        children: [],
      },
    ],
  },
];

export const FIXTURE_PRODUCTS_DETAIL: ProductDetailDTO[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    slug: 'fone-de-ouvido-bluetooth-over-ear-pro',
    name: 'Fone de Ouvido Bluetooth Over-Ear Pro',
    description:
      'Fone over-ear com cancelamento ativo de ruído, bateria de 40 horas e acabamento em alumínio.',
    price: { amount: 29990, currency: 'BRL' },
    inStock: true,
    category: { slug: 'audio', name: 'Áudio' },
    breadcrumbs: [
      { slug: 'eletronicos', name: 'Eletrônicos' },
      { slug: 'audio', name: 'Áudio' },
    ],
    images: [
      makeImage(
        '30000000-0000-4000-8000-000000000001',
        'fone-over-ear-pro',
        'Fone de Ouvido Bluetooth Over-Ear Pro',
      ),
    ],
    attributes: [
      {
        code: 'connectivity',
        label: 'Conectividade',
        value: 'Bluetooth',
        icon: 'wifi',
      },
      {
        code: 'noise_cancellation',
        label: 'Cancelamento de ruído',
        value: true,
        icon: 'volume-x',
      },
      {
        code: 'battery_hours',
        label: 'Autonomia de bateria',
        value: 40,
        unit: 'h',
        icon: 'battery',
      },
      {
        code: 'material',
        label: 'Material',
        value: 'Alumínio',
        icon: 'layers',
      },
    ],
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    slug: 'caixa-de-som-portatil-bluetooth-ipx7',
    name: 'Caixa de Som Portátil Bluetooth IPX7',
    description:
      'Caixa de som portátil resistente à água IPX7 com bateria para até 15 horas de música.',
    price: { amount: 18990, currency: 'BRL' },
    inStock: true,
    category: { slug: 'audio', name: 'Áudio' },
    breadcrumbs: [
      { slug: 'eletronicos', name: 'Eletrônicos' },
      { slug: 'audio', name: 'Áudio' },
    ],
    images: [
      makeImage(
        '30000000-0000-4000-8000-000000000002',
        'caixa-de-som-ipx7',
        'Caixa de Som Portátil Bluetooth IPX7',
      ),
    ],
    attributes: [
      {
        code: 'connectivity',
        label: 'Conectividade',
        value: 'Bluetooth',
        icon: 'wifi',
      },
      {
        code: 'water_resistant',
        label: 'Resistente à água',
        value: true,
        icon: 'droplet',
      },
      {
        code: 'battery_hours',
        label: 'Autonomia de bateria',
        value: 15,
        unit: 'h',
        icon: 'battery',
      },
    ],
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    slug: 'teclado-mecanico-rgb-compacto-aluminio',
    name: 'Teclado Mecânico RGB Compacto Alumínio',
    description:
      'Teclado mecânico compacto em alumínio anodizado com switches táteis e conexão com fio.',
    price: { amount: 44900, currency: 'BRL' },
    inStock: true,
    category: { slug: 'perifericos', name: 'Periféricos' },
    breadcrumbs: [
      { slug: 'eletronicos', name: 'Eletrônicos' },
      { slug: 'perifericos', name: 'Periféricos' },
    ],
    images: [
      makeImage(
        '30000000-0000-4000-8000-000000000003',
        'teclado-mecanico',
        'Teclado Mecânico RGB Compacto Alumínio',
      ),
    ],
    attributes: [
      {
        code: 'material',
        label: 'Material',
        value: 'Alumínio',
        icon: 'layers',
      },
      {
        code: 'connectivity',
        label: 'Conectividade',
        value: 'Com Fio',
        icon: 'wifi',
      },
      {
        code: 'warranty_months',
        label: 'Garantia',
        value: 12,
        unit: 'meses',
        icon: 'shield',
      },
    ],
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    slug: 'mouse-ergonomico-sem-fio-4000-dpi',
    name: 'Mouse Ergonômico Sem Fio 4000 DPI',
    description:
      'Mouse ergonômico vertical sem fio de alta precisão com sensor de 4000 DPI.',
    price: { amount: 15900, currency: 'BRL' },
    inStock: false,
    category: { slug: 'perifericos', name: 'Periféricos' },
    breadcrumbs: [
      { slug: 'eletronicos', name: 'Eletrônicos' },
      { slug: 'perifericos', name: 'Periféricos' },
    ],
    images: [
      makeImage(
        '30000000-0000-4000-8000-000000000004',
        'mouse-ergonomico',
        'Mouse Ergonômico Sem Fio 4000 DPI',
      ),
    ],
    attributes: [
      {
        code: 'connectivity',
        label: 'Conectividade',
        value: 'Sem Fio (2.4GHz/BT)',
        icon: 'wifi',
      },
      {
        code: 'dpi',
        label: 'Sensibilidade (DPI)',
        value: 4000,
        unit: 'DPI',
        icon: 'crosshair',
      },
    ],
  },
  {
    id: '20000000-0000-4000-8000-000000000005',
    slug: 'organizador-de-mesa-em-madeira-e-aluminio',
    name: 'Organizador de Mesa em Madeira & Alumínio',
    description:
      'Organizador minimalista para home office sem imagem cadastrada para testar fallback visual.',
    price: { amount: 12990, currency: 'BRL' },
    inStock: true,
    category: { slug: 'home-office', name: 'Home Office' },
    breadcrumbs: [
      { slug: 'casa-e-decoracao', name: 'Casa & Decoração' },
      { slug: 'home-office', name: 'Home Office' },
    ],
    images: [],
    attributes: [
      {
        code: 'material',
        label: 'Material',
        value: 'Madeira',
        icon: 'layers',
      },
      {
        code: 'custom_unknown_icon',
        label: 'Acabamento',
        value: 'Fosco',
        icon: 'non-existent-icon-key',
      },
    ],
  },
  {
    id: '20000000-0000-4000-8000-000000000006',
    slug: 'vela-aromatica-soja-e-baunilha',
    name: 'Vela Aromática Soja & Baunilha',
    description:
      'Vela artesanal de cera de soja natural com aroma de baunilha e queima prolongada.',
    price: { amount: 7990, currency: 'BRL' },
    inStock: true,
    category: { slug: 'bem-estar', name: 'Bem-estar & Aromas' },
    breadcrumbs: [
      { slug: 'casa-e-decoracao', name: 'Casa & Decoração' },
      { slug: 'bem-estar', name: 'Bem-estar & Aromas' },
    ],
    images: [],
    attributes: [
      {
        code: 'material',
        label: 'Material',
        value: 'Cerâmica',
        icon: 'layers',
      },
    ],
  },
];

export function toProductCard(detail: ProductDetailDTO): ProductCardDTO {
  return {
    id: detail.id,
    slug: detail.slug,
    name: detail.name,
    price: detail.price,
    inStock: detail.inStock,
    image: detail.images[0] ?? null,
    highlights: detail.attributes.slice(0, 3),
    categorySlug: detail.category.slug,
  };
}

export const FIXTURE_PRODUCT_CARDS: ProductCardDTO[] =
  FIXTURE_PRODUCTS_DETAIL.map(toProductCard);
