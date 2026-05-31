import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const INPUT = 'public/Tekori.svg';
const CANVAS = 1024;
const RADIUS = 264;

const SIZES = [
  { name: 'favicon-32x32.png',    size: 32  },
  { name: 'icon-192.png',         size: 192 },
  { name: 'icon-512.png',         size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

const base = await sharp({
  create: {
    width: CANVAS,
    height: CANVAS,
    channels: 4,
    background: { r: 10, g: 29, b: 54, alpha: 255 },
  },
})
  .composite([
    {
      input: Buffer.from(`
        <svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="glow" cx="50%" cy="18%" r="46%">
              <stop offset="0%" stop-color="#f7d98b" stop-opacity="0.22" />
              <stop offset="52%" stop-color="#d89b2b" stop-opacity="0.08" />
              <stop offset="100%" stop-color="#061832" stop-opacity="0" />
            </radialGradient>
            <linearGradient id="panel" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stop-color="#102944" />
              <stop offset="100%" stop-color="#061832" />
            </linearGradient>
            <linearGradient id="rim" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stop-color="rgba(216,155,43,0.20)" />
              <stop offset="38%" stop-color="rgba(216,155,43,0.05)" />
              <stop offset="100%" stop-color="rgba(216,155,43,0)" />
            </linearGradient>
          </defs>
          <rect width="${CANVAS}" height="${CANVAS}" rx="${RADIUS}" fill="url(#panel)" />
          <rect width="${CANVAS}" height="${CANVAS}" rx="${RADIUS}" fill="url(#glow)" />
          <rect width="${CANVAS}" height="${CANVAS}" rx="${RADIUS}" fill="url(#rim)" />
          <rect x="0.5" y="0.5" width="${CANVAS - 1}" height="${CANVAS - 1}" rx="${RADIUS - 0.5}" fill="none" stroke="rgba(216,155,43,0.22)" />
        </svg>
      `),
    },
  ])
  .png()
  .toBuffer();

const renderedLogo = await sharp(INPUT, { density: 240 })
  .resize({ width: 640, height: 640, fit: 'contain' })
  .toBuffer();

const logo = await sharp(renderedLogo)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 255 } })
  .trim()
  .toBuffer();

const { width, height } = await sharp(logo).metadata();

const left = Math.round((CANVAS - width) / 2);
const top = Math.round((CANVAS - height) / 2) + 6;

const shadow = await sharp({
  create: {
    width: CANVAS,
    height: CANVAS,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite([{ input: logo, top: top + 20, left, blend: 'screen' }])
  .blur(16)
  .png()
  .toBuffer();

const centered = await sharp(base)
  .composite([
    { input: shadow },
    { input: logo, top, left, blend: 'screen' },
  ])
  .png()
  .toBuffer();

for (const { name, size } of SIZES) {
  await sharp(centered)
    .resize(size, size)
    .png()
    .toFile(`public/${name}`);

  console.log(`✓ public/${name}`);
}

await writeFile(
  'public/favicon.svg',
  `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="18%" r="46%">
      <stop offset="0%" stop-color="#f7d98b" stop-opacity="0.22" />
      <stop offset="52%" stop-color="#d89b2b" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#061832" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="panel" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#102944" />
      <stop offset="100%" stop-color="#061832" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="132" fill="url(#panel)" />
  <rect width="512" height="512" rx="132" fill="url(#glow)" />
  <rect x="0.5" y="0.5" width="511" height="511" rx="131.5" fill="none" stroke="rgba(216,155,43,0.22)" />
  <image href="/Tekori.svg" x="76" y="70" width="360" height="360" preserveAspectRatio="xMidYMid meet" />
</svg>
`
);

console.log('✓ public/favicon.svg');
