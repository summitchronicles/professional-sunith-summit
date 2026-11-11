// Build-time share images (1200x630) for every published essay: /og/<slug>.png
// Ink background, mono pillar kicker, 64x3 accent rule, title in Instrument Serif, site address.
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const fontDir = path.resolve('src/assets/fonts');
const serif = fs.readFileSync(path.join(fontDir, 'InstrumentSerif-Regular.ttf'));
const mono = fs.readFileSync(path.join(fontDir, 'JetBrainsMono-Regular.ttf'));

const C = { bg: '#0a0a0a', text: '#e0e0e0', muted: '#8c8c8c', accent: '#c44200' };

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getCollection('thinking', ({ data }) => !data.draft);
  return entries.map((entry) => ({
    params: { slug: entry.id.replace(/\.(mdx?|md)$/, '') },
    props: { title: entry.data.title, pillar: entry.data.pillar },
  }));
};

const titleSize = (t: string) => (t.length <= 60 ? 72 : t.length <= 90 ? 66 : 58);

const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
  type,
  props: { style, children },
});

export const GET: APIRoute = async ({ props }) => {
  const { title, pillar } = props as { title: string; pillar?: string };
  const kicker = `${(pillar ?? 'Thinking').toUpperCase()} / ESSAY`;
  const monoText = { fontFamily: 'JetBrains Mono', fontSize: 22, letterSpacing: 2.6, color: C.muted };
  const tree = el(
    'div',
    {
      width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      backgroundColor: C.bg, padding: '84px 80px 72px 80px',
    },
    [
      el('div', { display: 'flex', flexDirection: 'column' }, [
        el('div', monoText, kicker),
        el('div', { width: 64, height: 3, backgroundColor: C.accent, marginTop: 22, marginBottom: 34 }, ''),
        el('div', {
          fontFamily: 'Instrument Serif', fontSize: titleSize(title), lineHeight: 1.08,
          color: C.text, maxWidth: 1040, display: 'block', lineClamp: 3, textWrap: 'balance',
        }, title),
      ]),
      el('div', { display: 'flex', justifyContent: 'space-between' }, [
        el('div', { ...monoText, fontSize: 20 }, 'SUNITHKUMAR.IS-A.DEV'),
        el('div', { ...monoText, fontSize: 20 }, 'SUNITH KUMAR KOKKU'),
      ]),
    ],
  );
  const svg = await satori(tree as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Instrument Serif', data: serif, weight: 400, style: 'normal' },
      { name: 'JetBrains Mono', data: mono, weight: 400, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
