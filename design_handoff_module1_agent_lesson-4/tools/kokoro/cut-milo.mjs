// Splits the approved Milo drawing (assets/milo/milo-original.png) into full-canvas layers so the arms can move and the
// eyes can blink while keeping the approved art pixel-for-pixel: base.png (body+head, arms removed), arm-left.png, arm-right.png.
// All layers share the original 1299×1211 canvas, so stacking them reproduces the original exactly.
import sharp from 'sharp';
const dir = new URL('../../assets/milo/', import.meta.url).pathname;
const W = 1299, H = 1211, OUT_W = 866; // shipped layers are 2/3 size; the art is positioned by percentages of the canvas
const pts = (a) => a.map(p => p.join(',')).join(' ');
// left arm: polygon through the white gaps around the waving hand, around the shoulder cap, down to the elbow
const LEFT = [[60,495],[254,495],[260,510],[266,525],[272,540],[284,556],[296,570],[306,580],[306,690],[372,706],[378,722],[400,724],[418,733],[428,752],[431,770],[425,789],[416,802],[408,814],[400,826],[380,836],[340,862],[300,876],[60,876]];
// right arm: everything right of the torso edge between shoulder and hand, minus the shoulder joint (centre 751,745 r≈62)
const J = { x: 751, y: 745, r: 62 };
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);
const rightShape = `<mask id="m"><rect width="${W}" height="${H}" fill="#000"/><rect x="772" y="700" width="423" height="205" fill="#fff"/><circle cx="${J.x}" cy="${J.y}" r="${J.r}" fill="#000"/></mask><rect width="${W}" height="${H}" fill="#fff" mask="url(#m)"/>`;
const leftShape = `<polygon points="${pts(LEFT)}" fill="#fff"/>`;
const maskL = svg(leftShape), maskR = svg(rightShape), maskBoth = svg(leftShape + rightShape);
const src = dir + 'milo-original.png';
const layer = async (mask, blend, file) => {
  const full = await sharp(src).ensureAlpha().composite([{ input: mask, blend }]).png().toBuffer();
  await sharp(full).resize(OUT_W).png({ compressionLevel: 9 }).toFile(dir + file);
};
await layer(maskL, 'dest-in', 'arm-left.png');
await layer(maskR, 'dest-in', 'arm-right.png');
await layer(maskBoth, 'dest-out', 'base.png');
console.log('layers written');
