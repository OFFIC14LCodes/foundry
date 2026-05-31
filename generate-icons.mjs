import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const INPUT = 'public/Tekori.svg';
const CANVAS = 1024;

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
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  },
})
  .composite([
    {
      input: Buffer.from(`
        <svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${CANVAS / 2 - 12}" fill="#ffffff" />
          <circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${CANVAS / 2 - 12.5}" fill="none" stroke="#d7dde6" stroke-width="3" />
        </svg>
      `),
    },
  ])
  .png()
  .toBuffer();

const renderedLogo = await sharp(INPUT, { density: 1200 })
  .resize({ width: 760, height: 760, fit: 'contain' })
  .toBuffer();

const logo = await sharp(renderedLogo)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 255 } })
  .toBuffer();

const { width, height } = await sharp(logo).metadata();

const left = Math.round((CANVAS - width) / 2);
const top = Math.round((CANVAS - height) / 2) + 8;

const centered = await sharp(base)
  .composite([
    { input: logo, top, left },
  ])
  .png()
  .toBuffer();

for (const { name, size } of SIZES) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
  );

  await sharp(centered)
    .resize(size, size)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(`public/${name}`);

  console.log(`✓ public/${name}`);
}

await writeFile(
  'public/favicon.svg',
  `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="clip">
      <circle cx="256" cy="256" r="250" />
    </clipPath>
  </defs>
  <circle cx="256" cy="256" r="244" fill="#ffffff" />
  <circle cx="256" cy="256" r="243" fill="none" stroke="#d7dde6" stroke-width="2" />
  <image href="data:image/png;base64,${centered.toString('base64')}" x="0" y="0" width="512" height="512" clip-path="url(#clip)" />
</svg>
`
);

console.log('✓ public/favicon.svg');
