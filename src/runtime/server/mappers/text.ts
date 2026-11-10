const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** A code point the text may hold: not a surrogate, not beyond Unicode, not NUL. */
const isTextCodePoint = (codePoint: number) =>
  Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);

/**
 * Turns HTML character references into the characters they stand for. The result is shown as text,
 * never as markup, so a decoded `<` stays a visible character. A reference it does not know is kept
 * as written.
 */
export const decodeEntities = (text: string): string =>
  text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (reference, name: string) => {
    if (name[0] !== '#') return NAMED_ENTITIES[name.toLowerCase()] ?? reference;
    const codePoint = name[1] === 'x' || name[1] === 'X' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return isTextCodePoint(codePoint) ? String.fromCodePoint(codePoint) : reference;
  });

/** The plain text of Vendure's HTML (descriptions are rich text), whitespace collapsed. */
export const plainTextOf = (html: string): string =>
  decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
