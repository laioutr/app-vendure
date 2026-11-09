import { describe, expect, it } from 'vitest';
import { mapAssets, mapImage } from './media';
import { asset } from '../../../../test/fixtures/vendure';

describe('mapImage', () => {
  it('serves the preview through the vendure provider, sized as the preview renders', () => {
    expect(mapImage(asset({ focalPoint: { x: 0.25, y: 0.5 } }), 'Laptop')).toEqual({
      type: 'image',
      alt: 'Laptop',
      sources: [{ provider: 'vendure', src: asset().preview, width: 1600, height: 1200, focalPoint: [0.25, 0.5] }],
    });
  });

  it('keeps a small image at its own size', () => {
    expect(mapImage(asset({ width: 800, height: 600 })).sources[0]).toMatchObject({ width: 800, height: 600 });
  });

  it('maps videos and skips binary files', () => {
    const media = mapAssets([asset({ type: 'VIDEO', mimeType: 'video/mp4' }), asset({ type: 'BINARY' })]);
    expect(media).toHaveLength(1);
    expect(media[0]!.type).toBe('video');
  });
});
