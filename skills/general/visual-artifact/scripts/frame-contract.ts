import type { BuildFrameSkeletonInput } from './types.js'

export const FRAME_WRAPPER_CLASS = 'frame'
export const ROOT_CSS_RELATIVE_HREF = '../styles/root.css'

export function buildFrameSkeleton(input: BuildFrameSkeletonInput): string {
  const title = escapeHtml(input.title)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="${ROOT_CSS_RELATIVE_HREF}">
    <style>
      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: var(--artifact-width);
        height: var(--artifact-height);
        margin: 0;
        overflow: hidden;
      }

      body {
        background: var(--color-bg);
        color: var(--color-text);
        font-family: var(--font-body);
      }

      .${FRAME_WRAPPER_CLASS} {
        position: relative;
        width: var(--artifact-width);
        height: var(--artifact-height);
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    <main class="${FRAME_WRAPPER_CLASS}">
    </main>
  </body>
</html>
`
}

function escapeHtml(value: string): string {
  return [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;']
  ].reduce((escapedValue, [search, replacement]) => {
    return escapedValue.split(search).join(replacement)
  }, value)
}
