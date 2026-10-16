import * as cheerio from 'cheerio';

/**
 * Normalizes HTML content by removing styling, decorative elements, and navigation
 * Useful for preparing HTML content for AI processing or clean text extraction
 */
export function normalizeHtml(html: string): string {
  const $ = cheerio.load(html, {}, false);

  // Strip active content at the parser level: never trust fetched HTML
  // (prompt-injection / stored-XSS source if ever rendered). A real parser
  // handles every tag/attribute spelling (weird casing, whitespace, unclosed
  // tags) that regex filtering cannot. Output goes to the AI pipeline, not
  // the DOM.
  $(
    'script, iframe, object, embed, style, link, meta, base, nav, footer, header',
  ).remove();

  $('*').each((_, node) => {
    if (node.type !== 'tag') return;
    for (const [name, value] of Object.entries(node.attribs)) {
      if (/^on/i.test(name) || name === 'style') {
        $(node).removeAttr(name);
      } else if (
        (name === 'href' || name === 'src') &&
        /^\s*(?:javascript|data):/i.test(value)
      ) {
        $(node).attr(name, '#');
      }
    }
  });

  let normalized = $.html();

  normalized = normalized.replaceAll(/<\/?span[^>]*>/gi, '');
  normalized = normalized.replaceAll(/<\/?font[^>]*>/gi, '');

  const decorativePatterns = [
    /Plan de cours/gi,
    /Version PDF/gi,
    /Imprimer/gi,
    /Retour/gi,
    /Haut de page/gi,
    / École de technologie supérieure/gi,
  ];

  decorativePatterns.forEach((pattern) => {
    normalized = normalized.replaceAll(pattern, '');
  });

  normalized = normalized.replaceAll(/Tous droits réservés[\s\S]*$/gi, '');
  normalized = normalized.replaceAll(/<br\s*\/?>/gi, '\n');
  normalized = normalized.replaceAll(/<li[^>]*>/gi, '• ');
  normalized = normalized.replaceAll(/<\/li>/gi, '\n');
  normalized = normalized.replaceAll(/<\/ul>/gi, '\n');
  normalized = normalized.replaceAll(/<\/ol>/gi, '\n');
  normalized = normalized.replaceAll(/<ul[^>]*>/gi, '');
  normalized = normalized.replaceAll(/<ol[^>]*>/gi, '');
  normalized = normalized.replaceAll(/\n{3,}/g, '\n\n');
  normalized = normalized.trim();

  return normalized;
}
