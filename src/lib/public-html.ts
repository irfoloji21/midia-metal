import { parseFragment } from 'parse5';
import { fromParse5 } from 'hast-util-from-parse5';
import type { Root } from 'hast';

/** Parse strings without VFile's node:process import, which opens stdin under Passenger. */
export function parseHtmlFragment(html: string): Root {
  return fromParse5(parseFragment(html, { scriptingEnabled: false })) as Root;
}
