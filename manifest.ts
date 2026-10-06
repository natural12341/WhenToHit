import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Цикл',
    short_name: 'Цикл',
    start_url: '/',
    display: 'standalone',
    background_color: '#100d14',
    theme_color: '#100d14',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
