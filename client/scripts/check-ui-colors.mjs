#!/usr/bin/env node
/**
 * Ban raw colors and Tailwind palette utilities in TS/TSX.
 * Colors belong in src/styles/tokens.css; classes should be semantic tokens.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src');

const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const COLOR_FN =
  /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\s*\(/i;
const ARBITRARY_COLOR =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|decoration|accent|caret|shadow)-\[(?:#|rgb|hsl|oklch|oklab|lab|lch)/i;
const PALETTE =
  /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|decoration|accent|caret|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/[\d.]+)?\b/;
const BARE =
  /\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black)(?:\/[\d.]+)?\b/;

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

    for (const match of line.matchAll(new RegExp(ARBITRARY_COLOR, 'g'))) {
      findings.push({
        file,
        line: i + 1,
        message: `arbitrary Tailwind color "${match[0]}" — use a semantic token class`,
      });
    }

    for (const match of line.matchAll(new RegExp(PALETTE, 'g'))) {
      findings.push({
        file,
        line: i + 1,
        message: `palette utility "${match[0]}" — use semantic tokens (bg-background, text-foreground, …)`,
      });
    }

    for (const match of line.matchAll(new RegExp(BARE, 'g'))) {
      findings.push({
        file,
        line: i + 1,
        message: `bare color utility "${match[0]}" — use bg-background / text-foreground / border-border`,
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
  console.error(
    `\ncheck-ui-colors: ${all.length} violation(s). Define colors in src/styles/tokens.css only.`,
  );
  process.exit(1);
}

console.log('check-ui-colors: ok');
