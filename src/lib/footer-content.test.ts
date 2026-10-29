import { describe, expect, it } from 'vitest';
import { currentCopyright, socialProfileUrl } from './footer-content';

describe('footer content', () => {
  it('hides placeholders and unsafe URLs while keeping configured profiles', () => {
    for (const value of ['', '#', 'https://facebook.com/', 'https://www.instagram.com', 'javascript:alert(1)', 'https://user:pass@facebook.com/company']) {
      expect(socialProfileUrl(value)).toBeUndefined();
    }
    expect(socialProfileUrl('instagram.com/example')).toBe('https://instagram.com/example');
    expect(socialProfileUrl('https://facebook.com/profile.php?id=123')).toContain('id=123');
  });
  it('updates the copyright year and preserves company wording and date ranges', () => {
    expect(currentCopyright('Midia © 2024. All Rights Reserved.', 2026)).toBe('Midia © 2026. All Rights Reserved.');
    expect(currentCopyright('Midia © 2010–2024', 2026)).toBe('Midia © 2010–2026');
    expect(currentCopyright('Established 2024', 2026)).toBe('Established 2024');
  });
});
