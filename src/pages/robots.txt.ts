import type { APIRoute } from 'astro';

const siteUrl = process.env.SITE_URL || 'https://sunithkumar.is-a.dev';

const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');

const robotsText = `User-agent: *
Allow: /
Disallow: /api/

# Block AI training crawlers
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: ClaudeBot
Disallow: /

Sitemap: ${normalizedSiteUrl}/sitemap-index.xml
`;

export const GET: APIRoute = () =>
  new Response(robotsText, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
