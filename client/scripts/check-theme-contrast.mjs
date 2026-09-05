#!/usr/bin/env node
/**
 * Make sure that semantic surface/ink token pairs in tokens.css keep readable contrast
 * in both :root (light) and .dark themes (WCAG AA 4.5:1 for normal text).
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = path.resolve(__dirname, '../src/styles/tokens.css');
const MIN_RATIO = 4.5;

/** @type {Array<[string, string]>} */
const PAIRS = [
  ['background', 'foreground'],
  ['card', 'card-foreground'],
  ['popover', 'popover-foreground'],
  ['primary', 'primary-foreground'],
  ['secondary', 'secondary-foreground'],
  ['muted', 'muted-foreground'],
  ['accent', 'accent-foreground'],
  ['sidebar', 'sidebar-foreground'],
  ['sidebar-primary', 'sidebar-primary-foreground'],
  ['sidebar-accent', 'sidebar-accent-foreground'],
  ['bg', 'ink'],
  ['bg-panel', 'ink'],
  ['bg-node', 'ink'],
];

/**
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * @param {number} channel
 */
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {string} hex
 */
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {string} a
 * @param {string} b
 */
function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * @param {string} css
 * @param {string} selector
 * @returns {Map<string, string>}
 */
function parseThemeBlock(css, selector) {
  const escaped = selector.replace('.', '\\.');
  const blockRe = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = css.match(blockRe);
  const map = new Map();
  if (!match) return map;
  const declRe = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
  let decl;
  while ((decl = declRe.exec(match[1]))) {
    map.set(decl[1], decl[2]);
  }
  return map;
}

const css = await readFile(TOKENS, 'utf8');
const themes = [
  { name: ':root', tokens: parseThemeBlock(css, ':root') },
  { name: '.dark', tokens: parseThemeBlock(css, '.dark') },
];

const findings = [];

for (const theme of themes) {
  if (theme.tokens.size === 0) {
    findings.push(`${theme.name}: no hex tokens found`);
    continue;
  }
  for (const [bgName, fgName] of PAIRS) {
    const bg = theme.tokens.get(bgName);
    const fg = theme.tokens.get(fgName);
    if (!bg || !fg) {
      findings.push(
        `${theme.name}: missing pair --${bgName} / --${fgName} (bg=${bg ?? 'missing'}, fg=${fg ?? 'missing'})`,
      );
      continue;
    }
    const ratio = contrastRatio(bg, fg);
    if (ratio < MIN_RATIO) {
      findings.push(
        `${theme.name}: --${bgName} (${bg}) / --${fgName} (${fg}) contrast ${ratio.toFixed(2)} < ${MIN_RATIO}`,
      );
    }
  }
}

if (findings.length) {
  for (const finding of findings) {
    console.error(finding);
  }
  console.error(
    `\ncheck-theme-contrast: ${findings.length} violation(s). Keep surface/ink pairs above WCAG AA (${MIN_RATIO}:1).`,
  );
  process.exit(1);
}

console.log('check-theme-contrast: ok');
