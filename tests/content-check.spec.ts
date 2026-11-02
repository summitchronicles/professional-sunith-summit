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

function getAllBuiltRoutes(): string[] {
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) return [];
  const routes: string[] = [];
  function walk(dir: string, rel = '/') {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      const rp = path.join(rel, e.name);
      if (e.isDirectory()) {
        walk(fp, rp + '/');
      } else if (e.isFile() && e.name === 'index.html') {
        const route = rp.replace(/index\.html$/, '');
        routes.push(route === '/' ? '/' : route);
      }
    }
  }
  walk(distDir, '/');
  // De-dup and normalize trailing slashes
  return Array.from(new Set(routes.map((r) => (r.endsWith('/') ? r : r + '/'))));
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

test('site pages have no hidden content, no overflow, and hero/header layout is sound', async ({ page }) => {
  const routes = getAllBuiltRoutes().filter((r) => !r.startsWith('/404'));
  expect(routes.length, 'No built routes found').toBeGreaterThan(0);
  fs.mkdirSync(screenshotsDir, { recursive: true });

  for (const route of routes) {
    for (const w of [390, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(route, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(screenshotsDir, `page-${route.replace(/\W+/g, '-')}-${w}.png`),
        fullPage: false,
      });

      // No hidden content after scroll (whole main area)
      const hiddenCount = await page.evaluate(() => {
        const root = document.querySelector('main') || document.body;
        const nodes = root.querySelectorAll<HTMLElement>('*');
        let hidden = 0;
        nodes.forEach((el) => {
          const cs = window.getComputedStyle(el);
          if (cs.opacity === '0' || cs.visibility === 'hidden') hidden++;
        });
        return hidden;
      });
      expect(hiddenCount, `hidden elements after scroll in ${route} @${w}`).toBe(0);

      // No horizontal overflow
      const overflowOK = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth <= window.innerWidth + 1; // allow 1px rounding
      });
      expect(overflowOK, `horizontal overflow in ${route} @${w}`).toBeTruthy();

      // Header vs hero overlap checks (where applicable)
      const hasMasthead = await page.$('.masthead');
      const hasHero = await page.$('.hero');
      if (hasMasthead && hasHero) {
        const headerBottom = await page.evaluate(() => {
          const h = document.querySelector('.masthead') as HTMLElement | null;
          if (!h) return 0;
          return h.getBoundingClientRect().bottom;
        });
        const kickerTop = await page.evaluate(() => {
          const el = document.querySelector('.hero .eyebrow') as HTMLElement | null;
          return el ? el.getBoundingClientRect().top : null;
        });
        const h1Top = await page.evaluate(() => {
          const el = document.querySelector('.hero h1') as HTMLElement | null;
          return el ? el.getBoundingClientRect().top : null;
        });
        if (kickerTop !== null) expect(kickerTop, `kicker overlaps header in ${route} @${w}`).toBeGreaterThanOrEqual(headerBottom - 1);
        if (h1Top !== null) expect(h1Top, `h1 overlaps header in ${route} @${w}`).toBeGreaterThanOrEqual(headerBottom - 1);

        // Hero image presence if exists (background-image or <img>)
        const heroBgHasImage = await page.evaluate(() => {
          const hp = document.querySelector('.hero-portrait') as HTMLElement | null;
          if (!hp) return null;
          const bg = window.getComputedStyle(hp).backgroundImage || '';
          return bg.includes('url(');
        });
        if (heroBgHasImage !== null) expect(heroBgHasImage, `hero image missing in ${route} @${w}`).toBeTruthy();

        const heroImgLoaded = await page.evaluate(() => {
          const img = document.querySelector('.hero img') as HTMLImageElement | null;
          if (!img) return null;
          return img.naturalWidth > 0;
        });
        if (heroImgLoaded !== null) expect(heroImgLoaded, `hero <img> not loaded in ${route} @${w}`).toBeTruthy();
      }
    }
  }
});

