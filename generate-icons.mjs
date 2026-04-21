import sharp from 'sharp';

const INPUT = 'public/Foundry Logo.png';
const CANVAS = 1024;

// Logo visual center sits around y=370 in the 1024px image.
// Shift it down to y=512 (true center) by offsetting +142px.
const VERTICAL_SHIFT = 142;

const SIZES = [
  { name: 'favicon-32x32.png',   size: 32  },
  { name: 'icon-192.png',        size: 192 },
  { name: 'icon-512.png',        size: 512 },
  { name: 'apple-touch-icon.png',size: 180 },
];

// Step 1: shift the logo down so it's vertically centered on a 1024x1024 black canvas
const centered = await sharp({
  create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
})
  .composite([{ input: INPUT, top: VERTICAL_SHIFT, left: 0 }])
  .png()
  .toBuffer();

// Step 2: for each target size, resize then apply a circular mask
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
