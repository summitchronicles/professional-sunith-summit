import { defineCollection, z } from 'astro:content';

const thinking = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    publishDate: z.coerce.date(),
    summary: z.string().max(300),
    readingTime: z.number(),
    draft: z.boolean().default(false),
  }),
});

const expeditions = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    mountain: z.string(),
    elevation: z.string(),
    region: z.string(),
    country: z.string(),
    date: z.coerce.date(),
    duration: z.string(),
    heroImage: z.string(),
    summary: z.string().max(200),
    draft: z.boolean().default(false),
  }),
});

export const collections = { thinking, expeditions };
