import sharp from 'sharp';

const INPUT = 'public/Foundry Logo.png';
const CANVAS = 1024;

const SIZES = [
  { name: 'favicon-32x32.png',    size: 32  },
  { name: 'icon-192.png',         size: 192 },
  { name: 'icon-512.png',         size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

// Step 1: trim the black border to get just the flame content (478x608)
const trimmed = await sharp(INPUT).trim({ threshold: 30 }).toBuffer();

// Step 2: scale the flame to fill ~85% of the circle height (1024 * 0.85 = 870px)
const TARGET_HEIGHT = Math.round(CANVAS * 0.85);
const resized = await sharp(trimmed)
  .resize({ height: TARGET_HEIGHT, fit: 'inside' })
  .toBuffer();
const { width, height } = await sharp(resized).metadata();

// Step 3: center it on a black 1024x1024 canvas
const left = Math.round((CANVAS - width) / 2);
const top  = Math.round((CANVAS - height) / 2);

const centered = await sharp({
  create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
})
  .composite([{ input: resized, top, left }])
  .png()
  .toBuffer();

// Step 4: for each size, resize then apply a circular mask
for (const { name, size } of SIZES) {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
  );

  await sharp(centered)
    .resize(size, size)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(`public/${name}`);

  console.log(`✓ public/${name}`);
}
