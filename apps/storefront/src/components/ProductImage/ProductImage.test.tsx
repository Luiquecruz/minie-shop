import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ImageDTO } from '@minieshop/contracts';
import { FIXTURE_PRODUCTS_DETAIL } from '../../test/fixtures/catalogFixture';
import ProductImage from './ProductImage';

const SAMPLE_IMAGE: ImageDTO = FIXTURE_PRODUCTS_DETAIL[0].images[0];
const SECOND_IMAGE: ImageDTO = FIXTURE_PRODUCTS_DETAIL[1].images[0];

describe('ProductImage with resilient inline SVG fallback', () => {
  it('renders inline SVG fallback directly without <img> when image is null or has empty variants', () => {
    const { container, rerender } = render(
      <ProductImage image={null} productName="Produto Sem Imagem" />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('img', { name: /Image unavailable/i }),
    ).toBeInTheDocument();

    rerender(
      <ProductImage
        image={{ ...SAMPLE_IMAGE, variants: [] }}
        productName="Produto Sem Variantes"
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('img', { name: /Image unavailable/i }),
    ).toBeInTheDocument();
  });

  it('switches to inline SVG fallback on error event and resets state when src changes', () => {
    const { rerender } = render(
      <ProductImage image={SAMPLE_IMAGE} productName="Fone Pro" />,
    );

    const img = screen.getByRole('img', { name: SAMPLE_IMAGE.alt });
    expect(img.tagName).toBe('IMG');

    fireEvent.error(img);

    expect(screen.queryByAltText(SAMPLE_IMAGE.alt)).toBeNull();
    expect(
      screen.getByRole('img', { name: /Image unavailable/i }),
    ).toBeInTheDocument();

    // Changing image prop (new src) resets fallback state and renders new <img>
    rerender(<ProductImage image={SECOND_IMAGE} productName="Caixa de Som" />);

    const nextImg = screen.getByRole('img', { name: SECOND_IMAGE.alt });
    expect(nextImg.tagName).toBe('IMG');
    expect(nextImg).toHaveAttribute(
      'src',
      SECOND_IMAGE.variants[SECOND_IMAGE.variants.length - 1].url,
    );

    // Returning to the original image (A -> B -> A) retries A rather than sticking on fallback
    rerender(<ProductImage image={SAMPLE_IMAGE} productName="Fone Pro" />);
    const retriedImg = screen.getByRole('img', { name: SAMPLE_IMAGE.alt });
    expect(retriedImg.tagName).toBe('IMG');
  });

  it('populates srcset from real variant widths, sets alt fallback, and supports priority eager loading', () => {
    const { rerender } = render(
      <ProductImage
        image={{ ...SAMPLE_IMAGE, alt: '' }}
        productName="Fallback Product Name"
        sizes="(max-width: 640px) 100vw, 400px"
      />,
    );

    const lazyImg = screen.getByRole('img', { name: 'Fallback Product Name' });
    expect(lazyImg).toHaveAttribute('loading', 'lazy');
    expect(lazyImg).toHaveAttribute(
      'srcset',
      SAMPLE_IMAGE.variants.map((v) => `${v.url} ${v.width}w`).join(', '),
    );
    expect(lazyImg).toHaveAttribute('sizes', '(max-width: 640px) 100vw, 400px');

    rerender(
      <ProductImage
        image={SAMPLE_IMAGE}
        productName="Hero Product"
        priority
      />,
    );

    const eagerImg = screen.getByRole('img', { name: SAMPLE_IMAGE.alt });
    expect(eagerImg).toHaveAttribute('loading', 'eager');
    expect(eagerImg).toHaveAttribute('fetchpriority', 'high');
  });
});
