import { describe, expect, it } from 'vitest';
import { decodeEntities, plainTextOf } from './text';

describe('plainTextOf', () => {
  it("shows the shop's rich text as the characters it means, as text", () => {
    expect(plainTextOf('<p>Pay&nbsp;on delivery &amp; save &lt;5%&gt; &quot;now&quot; &#39;today&#39; &#x2013; &apos;ok&apos;</p>')).toBe(
      "Pay on delivery & save <5%> \"now\" 'today' – 'ok'"
    );
    // A decoded tag stays text: tags are stripped before decoding, never after.
    expect(plainTextOf('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
  });

  it('keeps a reference it does not know, or one naming no character, as written', () => {
    expect(decodeEntities('&unknown; &#0; &#xD800; &#x110000; &#65;')).toBe('&unknown; &#0; &#xD800; &#x110000; A');
  });
});
