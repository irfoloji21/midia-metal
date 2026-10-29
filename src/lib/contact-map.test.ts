import { describe, expect, it } from 'vitest';
import { getGoogleMapsEmbedUrl, getGoogleMapsSearchUrl } from './contact-map';

describe('contact map links', () => {
  it.each([
    undefined,
    '',
    'not a URL',
    'https://www.google.com/maps/embed?pb=...',
    'https://www.google.com/maps/embed?pb=undefined',
    'https://www.google.com/maps/embed',
    'https://www.google.com/maps/place/London',
    'https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=London',
  ])('does not embed an incomplete or regular maps URL: %s', (url) => {
    expect(getGoogleMapsEmbedUrl(url)).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://www.google.com/maps/embed?pb=!1m18',
    'https://www.google.com.evil.example/maps/embed?pb=!1m18',
    'https://evil.example/maps/embed?pb=!1m18',
    'https://www.google.com@evil.example/maps/embed?pb=!1m18',
    'https://user:secret@www.google.com/maps/embed?pb=!1m18',
    'https://www.google.com:8443/maps/embed?pb=!1m18',
  ])('rejects unsafe or non-Google iframe destinations: %s', (url) => {
    expect(getGoogleMapsEmbedUrl(url)).toBeNull();
  });

  it.each([
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d158858.18237282',
    'https://www.google.co.uk/maps/embed?pb=!1m18!1m12',
    'https://maps.google.com/maps?q=London&output=embed',
    'https://www.google.com/maps/embed/v1/place?key=test-key&q=London',
    'https://www.google.com/maps/embed/v1/view?key=test-key&center=51.5,-0.1',
    'https://www.google.com/maps/embed/v1/directions?key=test-key&origin=London&destination=Oxford',
    'https://www.google.com/maps/embed/v1/streetview?key=test-key&pano=test-panorama',
    'https://www.google.com/maps/embed/v1/search?key=test-key&q=London',
  ])('preserves a configured Google embed: %s', (url) => {
    expect(getGoogleMapsEmbedUrl(url)).toBe(url);
  });

  it('builds the fallback from the public address without adding URL parameters from its text', () => {
    const address = ' Unit 8A, Ilford & London #1 / İşyeri ';
    const url = new URL(getGoogleMapsSearchUrl(address)!);

    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/maps/search/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('query')).toBe(address.trim());
    expect([...url.searchParams.keys()]).toEqual(['api', 'query']);
    expect(url.hash).toBe('');
  });

  it('does not invent a location when no address is configured', () => {
    expect(getGoogleMapsSearchUrl(' ')).toBeNull();
    expect(getGoogleMapsSearchUrl(undefined)).toBeNull();
  });
});
