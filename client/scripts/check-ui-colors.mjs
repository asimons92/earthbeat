#!/usr/bin/env node
/**
 * Ban raw colors in TS/TSX so UI stays on CSS tokens.
 * Allowed: CSS var(...) references, currentColor, transparent, inherit, none.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src');

const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const COLOR_FN =
  /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/i;
const NAMED =
  /\b(?:aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)\b/i;

const ALLOWED_NAMED = new Set(['transparent', 'currentcolor', 'inherit', 'initial', 'unset', 'none']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function checkFile(file, source) {
  const findings = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const match of line.matchAll(new RegExp(HEX, 'g'))) {
      findings.push({
        file,
        line: i + 1,
        message: `raw hex color "${match[0]}" — use a CSS token (var(--…))`,
      });
    }

    for (const match of line.matchAll(new RegExp(COLOR_FN, 'g'))) {
      findings.push({
        file,
        line: i + 1,
        message: `raw color function "${match[0].trim()}" — use a CSS token`,
      });
    }

    // Only flag named colors in style-ish contexts to reduce false positives.
    if (/style\s*=|color\s*:|stroke\s*=|fill\s*=|background/i.test(line)) {
      for (const match of line.matchAll(new RegExp(NAMED, 'gi'))) {
        if (ALLOWED_NAMED.has(match[0].toLowerCase())) continue;
        findings.push({
          file,
          line: i + 1,
          message: `named color "${match[0]}" — use a CSS token`,
        });
      }
    }
  }

  // Catch template/string hexes that may span odd formatting
  let m;
  const hexGlobal = new RegExp(HEX, 'g');
  while ((m = hexGlobal.exec(source))) {
    const already = findings.some((f) => f.line === lineOf(source, m.index) && f.message.includes(m[0]));
    if (!already) {
      findings.push({
        file,
        line: lineOf(source, m.index),
        message: `raw hex color "${m[0]}" — use a CSS token (var(--…))`,
      });
    }
  }

  return findings;
}

const files = await walk(SRC);
const all = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  all.push(...checkFile(file, source));
}

if (all.length) {
  for (const f of all) {
    console.error(`${path.relative(process.cwd(), f.file)}:${f.line}: ${f.message}`);
  }
  console.error(`\ncheck-ui-colors: ${all.length} violation(s). Define colors in src/styles/tokens.css only.`);
  process.exit(1);
}

console.log('check-ui-colors: ok');
