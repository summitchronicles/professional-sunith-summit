import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

type Counts = { h2: number; h3: number; li: number; a: number };

function getChangedContentFiles(): string[] {
  try {
    const diff = require('child_process')
      .execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    return diff.filter((p: string) => /^src\/content\/.+\.(md|mdx)$/.test(p));
  } catch {
    return [];
  }
}

function allContentFilesUnder(dir: string): string[] {
  const out: string[] = [];
  function walk(p: string) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const fp = path.join(p, e.name);
      if (e.isDirectory()) walk(fp);
      else if (/\.(md|mdx)$/.test(e.name)) out.push(fp);
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function routeFromContentPath(p: string): string {
  // src/content/<collection>/<slug>.mdx -> /<collection>/<slug>/
  const [_, collection, filename] = p.match(/^src\/content\/([^/]+)\/(.+?)\.(md|mdx)$/) || [];
  if (!collection || !filename) throw new Error(`Cannot map route from ${p}`);
  return `/${collection}/${filename}/`;
}

async function countDom(page, selectorRoot: string): Promise<Counts> {
  return await page.evaluate((rootSel) => {
    const root = document.querySelector(rootSel) || document;
    const q = (sel: string) => root.querySelectorAll(sel).length;
    return { h2: q('h2'), h3: q('h3'), li: q('li'), a: q('a[href]') };
  }, selectorRoot);
}

function countMarkdown(source: string): Counts {
  const lexer = new marked.Lexer({ gfm: true });
  const tokens = lexer.lex(source);
  let h2 = 0,
    h3 = 0,
    li = 0,
    a = 0;
  function walk(toks: any[]) {
    for (const t of toks) {
      if (t.type === 'heading') {
        if (t.depth === 2) h2++;
        if (t.depth === 3) h3++;
        // Count links inside heading text
        if (t.tokens) walk(t.tokens);
      } else if (t.type === 'list') {
        for (const it of t.items) {
          li++;
          if (it.tokens) walk(it.tokens);
        }
      } else if (t.type === 'link') {
        a++;
        if (t.tokens) walk(t.tokens);
      } else if (t.tokens) {
        walk(t.tokens);
      }
    }
  }
  walk(tokens as any);
  return { h2, h3, li, a };
}

function readSource(p: string): string {
  const raw = fs.readFileSync(p, 'utf8');
  // strip frontmatter if present
  return raw.replace(/^---[\s\S]*?---\s*/, '');
}

const screenshotsDir = path.resolve('artifacts', 'playwright');

test('content pages render structure and visibility correctly', async ({ page, browserName }) => {
  // Determine which content pages to check
  let files = getChangedContentFiles();
  if (files.length === 0) {
    // Fallback: check the GCC decision rights essay if present
    const fallback = 'src/content/thinking/gcc-decision-rights.mdx';
    if (fs.existsSync(fallback)) files = [fallback];
  }
  expect(files.length, 'No content files to check').toBeGreaterThan(0);

  fs.mkdirSync(screenshotsDir, { recursive: true });

  for (const file of files) {
    const route = routeFromContentPath(file);
    const src = readSource(file);
    const mdCounts = countMarkdown(src);

    // Mobile
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(route, { waitUntil: 'networkidle' });
    // Scroll to bottom to trigger any reveals
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    await page.screenshot({
      path: path.join(screenshotsDir, `${path.basename(file, path.extname(file))}-mobile.png`),
      fullPage: false,
    });

    // Desktop
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    await page.screenshot({
      path: path.join(screenshotsDir, `${path.basename(file, path.extname(file))}-desktop.png`),
      fullPage: false,
    });

    // Compare counts with rendered DOM inside main content
    const domCounts = await countDom(page, '.essay-body, .prose');
    expect(domCounts.h2, `h2 count for ${route}`).toBe(mdCounts.h2);
    expect(domCounts.h3, `h3 count for ${route}`).toBe(mdCounts.h3);
    expect(domCounts.li, `li count for ${route}`).toBe(mdCounts.li);
    expect(domCounts.a, `a count for ${route}`).toBe(mdCounts.a);

    // Ensure no hidden/transparent elements after reveal in main content
    const hiddenCount = await page.evaluate((rootSel) => {
      const root = document.querySelector(rootSel) || document;
      const nodes = root.querySelectorAll<HTMLElement>('*');
      let hidden = 0;
      nodes.forEach((el) => {
        const cs = window.getComputedStyle(el);
        if (cs.opacity === '0' || cs.visibility === 'hidden') hidden++;
      });
      return hidden;
    }, '.essay-body, .prose');
    expect(hiddenCount, `hidden elements after scroll in ${route}`).toBe(0);
  }
});

