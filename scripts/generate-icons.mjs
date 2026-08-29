#!/usr/bin/env node
/**
 * Gera os icones PWA a partir do mesmo desenho do favicon.
 *
 *   node scripts/generate-icons.mjs
 *
 * Escreve PNGs direto, sem dependencia de imagem — o desenho e simples o
 * bastante (fundo solido + quatro quadrados) para ser rasterizado a mao.
 * O conteudo fica dentro da zona segura de 80%, entao o mesmo arquivo serve
 * como `any` e como `maskable`.
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const BG = [18, 18, 23]; // #121217
const FG = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Cada scanline e precedida pelo byte de filtro (0 = nenhum).
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Mistura a cor de frente sobre o fundo conforme a opacidade. */
function blend(alpha) {
  return FG.map((channel, i) => Math.round(channel * alpha + BG[i] * (1 - alpha)));
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4);

  // Logo em 55% do lado, centralizado: sobra folga para o recorte maskable.
  const logo = Math.round(size * 0.55);
  const origin = Math.round((size - logo) / 2);
  const gap = Math.max(2, Math.round(logo * 0.08));
  const cell = Math.round((logo - gap) / 2);
  const radius = Math.max(1, Math.round(cell * 0.18));

  // Opacidades no mesmo padrao do favicon: diagonal cheia, contra-diagonal suave.
  const squares = [
    { x: origin, y: origin, alpha: 1 },
    { x: origin + cell + gap, y: origin, alpha: 0.55 },
    { x: origin, y: origin + cell + gap, alpha: 0.55 },
    { x: origin + cell + gap, y: origin + cell + gap, alpha: 1 },
  ];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let color = BG;

      for (const square of squares) {
        const dx = x - square.x;
        const dy = y - square.y;
        if (dx < 0 || dy < 0 || dx >= cell || dy >= cell) continue;

        // Canto arredondado: descarta o pixel fora do raio nas quinas.
        const cx = dx < radius ? radius - dx : dx >= cell - radius ? dx - (cell - radius - 1) : 0;
        const cy = dy < radius ? radius - dy : dy >= cell - radius ? dy - (cell - radius - 1) : 0;
        if (cx > 0 && cy > 0 && cx * cx + cy * cy > radius * radius) continue;

        color = blend(square.alpha);
        break;
      }

      const offset = (y * size + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = 255;
    }
  }

  return png(size, size, rgba);
}

const targets = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];

for (const [path, size] of targets) {
  mkdirSync(dirname(path), { recursive: true });
  const buffer = draw(size);
  writeFileSync(path, buffer);
  console.log(`  ${path.padEnd(36)} ${size}x${size}  ${buffer.length} bytes`);
}
