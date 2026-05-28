// src/pages/og/[token].png.ts
// Per-debtor Open Graph preview image — what shows up in WhatsApp/iMessage/
// Twitter when the per-token URL is shared.
// Pre-rendered at build time for every debtor. Output: dist/og/<token>.png
//
// Implementation: Satori turns a small JSX-ish tree into SVG, Resvg rasterises
// that SVG to a 1200×630 PNG (the canonical OG dimensions).
import type { APIRoute, GetStaticPaths } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { debtors } from '../../data/debtors';
import { getDaysRemaining } from '../../lib/deadline';
import { formatAmount } from '../../lib/format';

// Font is loaded once at module init — Satori needs raw TTF bytes.
const fontPath = resolve(process.cwd(), 'public/fonts/Inter-ExtraBold.ttf');
const interBold = readFileSync(fontPath);

export const getStaticPaths: GetStaticPaths = () =>
  debtors.map((d) => ({ params: { token: d.token } }));

export const GET: APIRoute = async ({ params }) => {
  const debtor = debtors.find((d) => d.token === params.token);
  if (!debtor) return new Response('Not found', { status: 404 });

  const daysLeft = getDaysRemaining();
  const amountStr = `${formatAmount(debtor.amount)} €`;
  const headline = `Hey ${debtor.name} —`;
  const subline = `you still owe ${amountStr}.`;
  const footer = daysLeft > 0
    ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left · pay-me-back`
    : 'pay-me-back';

  // Compose a 1200×630 OG card.
  // Palette mirrors Barcelona Pixel Dawn: warm peach bg, rust accent.
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #f8d4a8 0%, #e8a570 70%, #c0573a 100%)',
          fontFamily: 'Inter',
          color: '#2a1f1a',
        },
        children: [
          // Top row: small "PAY ME BACK" brand
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '28px',
                letterSpacing: '6px',
                opacity: 0.8,
              },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '20px',
                      height: '20px',
                      background: '#2a1f1a',
                    },
                  },
                },
                'PAY ME BACK',
              ],
            },
          },
          // Middle: name + amount, big and chunky
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '12px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '88px',
                      lineHeight: 1,
                      letterSpacing: '-3px',
                    },
                    children: headline,
                  },
                },
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '72px',
                      lineHeight: 1.1,
                      letterSpacing: '-2px',
                    },
                    children: subline,
                  },
                },
              ],
            },
          },
          // Bottom: countdown + brand line
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '26px',
                letterSpacing: '2px',
              },
              children: [
                { type: 'div', props: { children: footer } },
                {
                  type: 'div',
                  props: {
                    style: {
                      padding: '12px 24px',
                      border: '4px solid #2a1f1a',
                      background: '#fef3e2',
                      boxShadow: '6px 6px 0 #2a1f1a',
                    },
                    children: 'TAP TO PAY →',
                  },
                },
              ],
            },
          },
        ],
      },
    } as Parameters<typeof satori>[0],
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: interBold, weight: 800, style: 'normal' }],
    }
  );

  // Rasterise SVG → PNG (PNG is the universally-supported OG image format)
  const pngBuffer = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
    .render()
    .asPng();

  // Astro's image endpoint expects Uint8Array body. Buffer is a Uint8Array.
  return new Response(new Uint8Array(pngBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
