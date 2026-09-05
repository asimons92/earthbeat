#!/usr/bin/env node
/**
 * Ban example-style and tautological assertions in unit tests.
 * Prefer fast-check properties and dynamic factories over hardcoded expect values.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|js|jsx)$/;
const EXCEPTION_RE =
  /\/\/\s*earthbeat-test:\s*exception\b|\/\*\s*earthbeat-test:\s*exception\b/;

const EQUALITY_MATCHERS = new Set([
  'toBe',
  'toEqual',
  'toStrictEqual',
  'toBeCloseTo',
  'toContain',
  'toContainEqual',
  'toMatch',
  'toMatchObject',
  'toThrow',
  'toThrowError',
  'toHaveLength',
  'toHaveProperty',
  'toHaveBeenCalledWith',
  'toHaveBeenLastCalledWith',
  'toHaveBeenNthCalledWith',
  'toHaveReturnedWith',
  'toHaveLastReturnedWith',
  'toHaveNthReturnedWith',
]);

const TAUTOLOGY_MATCHERS = new Set(['toBeTruthy', 'toBeFalsy']);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (TEST_FILE.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function isLiteralish(node) {
  if (!node) return false;
  switch (node.kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.BigIntLiteral:
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
    case ts.SyntaxKind.NullKeyword:
    case ts.SyntaxKind.RegularExpressionLiteral:
      return true;
    case ts.SyntaxKind.PrefixUnaryExpression:
      return isLiteralish(node.operand);
    case ts.SyntaxKind.ArrayLiteralExpression:
      return node.elements.every(
        (el) =>
          el.kind !== ts.SyntaxKind.SpreadElement && isLiteralish(el),
      );
    case ts.SyntaxKind.ObjectLiteralExpression:
      return node.properties.every((prop) => {
        if (ts.isPropertyAssignment(prop)) return isLiteralish(prop.initializer);
        if (ts.isShorthandPropertyAssignment(prop)) return false;
        if (ts.isSpreadAssignment(prop)) return isLiteralish(prop.expression);
        return true;
      });
    case ts.SyntaxKind.AsExpression:
    case ts.SyntaxKind.TypeAssertionExpression:
    case ts.SyntaxKind.SatisfiesExpression:
    case ts.SyntaxKind.ParenthesizedExpression:
      return isLiteralish(node.expression);
    default:
      return false;
  }
}

function identText(node) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
    const left = identText(node.expression);
    return left ? `${left}.${node.name.text}` : null;
  }
  return null;
}

function pos(sourceFile, node) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return line + 1;
}

function checkSource(file, source) {
  const findings = [];
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('tsx') || file.endsWith('jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );

  const hasException = EXCEPTION_RE.test(source);
  let importsFastCheck = false;

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'fast-check'
    ) {
      importsFastCheck = true;
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'expect' &&
      node.arguments.length > 0
    ) {
      const subject = node.arguments[0];
      if (isLiteralish(subject)) {
        findings.push({
          file,
          line: pos(sourceFile, subject),
          message:
            'literal expect(...) subject — assert an invariant over generated or factory data',
        });
      }
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const matcher = node.expression.name.text;
      const args = node.arguments;

      if (TAUTOLOGY_MATCHERS.has(matcher)) {
        findings.push({
          file,
          line: pos(sourceFile, node.expression.name),
          message: `${matcher}() is too weak — assert a concrete invariant`,
        });
      }

      if (EQUALITY_MATCHERS.has(matcher) && args.length > 0 && isLiteralish(args[0])) {
        findings.push({
          file,
          line: pos(sourceFile, args[0]),
          message: `hardcoded ${matcher}(...) expected value — use a generator, factory, or derived invariant`,
        });
      }

      if (
        (matcher === 'toBe' || matcher === 'toEqual' || matcher === 'toStrictEqual') &&
        args.length > 0
      ) {
        let expectCall = node.expression.expression;
        while (ts.isPropertyAccessExpression(expectCall)) {
          expectCall = expectCall.expression;
        }
        if (
          ts.isCallExpression(expectCall) &&
          ts.isIdentifier(expectCall.expression) &&
          expectCall.expression.text === 'expect' &&
          expectCall.arguments.length > 0
        ) {
          const left = identText(expectCall.arguments[0]);
          const right = identText(args[0]);
          if (left && right && left === right) {
            findings.push({
              file,
              line: pos(sourceFile, node),
              message: `tautology expect(${left}).${matcher}(${right})`,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!hasException && !importsFastCheck) {
    findings.push({
      file,
      line: 1,
      message:
        'missing fast-check import — property tests are the default; for canvas/shell wiring only, line 1: `// earthbeat-test: exception ui-surface — <reason>`',
    });
  }

  return findings;
}

const files = await walk(ROOT);
const all = [];
for (const file of files) {
  const source = await readFile(file, 'utf8');
  all.push(...checkSource(file, source));
}

if (all.length) {
  for (const f of all) {
    console.error(`${path.relative(process.cwd(), f.file)}:${f.line}: ${f.message}`);
  }
  console.error(
    `\ncheck-test-invariants: ${all.length} violation(s). Prefer fast-check properties and factories.`,
  );
  process.exit(1);
}

console.log('check-test-invariants: ok (no test files or all clean)');
