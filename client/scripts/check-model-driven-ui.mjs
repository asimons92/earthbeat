#!/usr/bin/env node
/**
 * Ban hand-rolled UI option lists and catalog imports outside Clay-generated modules.
 * Dropdowns, create nav, and palette labels must come from client/src/generated/.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src');
const GENERATED = path.resolve(SRC, 'generated');

const EXCEPTION_RE =
  /\/\/\s*earthbeat-ui:\s*exception\s+model-driven\b|\/\*\s*earthbeat-ui:\s*exception\s+model-driven\b/;

const FORBIDDEN_CONST =
  /^(?:SIDEBAR_|PATCH_TABS$|CREATE_ACTIONS$|.+OPTIONS$|.+_OPTIONS$)/;

const OPTION_KEYS = new Set(['id', 'key', 'value', 'nodeType']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function isUnderGenerated(file) {
  return file === GENERATED || file.startsWith(GENERATED + path.sep);
}

function propName(prop) {
  if (ts.isPropertyAssignment(prop)) {
    if (ts.isIdentifier(prop.name)) return prop.name.text;
    if (ts.isStringLiteral(prop.name)) return prop.name.text;
  }
  if (ts.isShorthandPropertyAssignment(prop)) return prop.name.text;
  return null;
}

function isStringLiteralish(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)
  );
}

function isOptionShapedObject(node) {
  if (!ts.isObjectLiteralExpression(node)) return false;
  let hasIdentity = false;
  let hasLabel = false;
  for (const prop of node.properties) {
    const name = propName(prop);
    if (!name || !ts.isPropertyAssignment(prop)) continue;
    if (!isStringLiteralish(prop.initializer)) continue;
    if (OPTION_KEYS.has(name)) hasIdentity = true;
    if (name === 'label' || name === 'name') hasLabel = true;
  }
  return hasIdentity && hasLabel;
}

function isOptionArray(node) {
  if (!ts.isArrayLiteralExpression(node)) return false;
  const objects = node.elements.filter((el) => ts.isObjectLiteralExpression(el));
  if (objects.length === 0) return false;
  return objects.every(isOptionShapedObject);
}

function unwrap(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function checkFile(file, source) {
  if (EXCEPTION_RE.test(source)) return [];

  const findings = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (
        spec === '@/catalog' ||
        spec === './catalog' ||
        spec === '../catalog' ||
        /(^|\/)catalog$/.test(spec)
      ) {
        if (!spec.includes('/generated/')) {
          findings.push({
            file,
            line: lineOf(sourceFile, node),
            message: `import "${spec}" — import UI catalog from "@/generated/catalog" only`,
          });
        }
      }
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const name = node.name.text;
      const init = unwrap(node.initializer);
      if (FORBIDDEN_CONST.test(name) && isOptionArray(init)) {
        findings.push({
          file,
          line: lineOf(sourceFile, node),
          message: `hand-rolled option list "${name}" — define it in clay/model.json catalog and import from @/generated/catalog`,
        });
      } else if (isOptionArray(init) && init.elements.length >= 2) {
        findings.push({
          file,
          line: lineOf(sourceFile, node),
          message: `hand-rolled option array "${name}" — define lists in clay/model.json and import from @/generated/catalog`,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return findings;
}

const files = (await walk(SRC)).filter((file) => !isUnderGenerated(file));
const allFindings = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  allFindings.push(...checkFile(file, source));
}

if (allFindings.length > 0) {
  for (const finding of allFindings) {
    const rel = path.relative(path.resolve(__dirname, '..'), finding.file);
    console.error(`${rel}:${finding.line}: ${finding.message}`);
  }
  console.error(
    `\n${allFindings.length} model-driven UI violation(s). Put option lists in clay/model.json, run clay generate, import @/generated/catalog.`,
  );
  process.exit(1);
}

console.log('check-model-driven-ui: ok');
