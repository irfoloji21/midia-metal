import { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useModalFocus } from './use-modal-focus';
afterEach(cleanup);
function Fixture() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(open, ref, () => setOpen(false));
  return <><button onClick={() => setOpen(true)}>Open</button><a href="/cart">Background</a>{open && <div ref={ref} role="dialog" tabIndex={-1}><button onClick={() => setOpen(false)}>Close</button><button>Last</button></div>}</>;
}
it('traps both Tab directions, closes with Escape, and restores opening focus', () => {
  render(<Fixture />);
  const opener = screen.getByText('Open');
  opener.focus(); fireEvent.click(opener);
  expect(screen.getByText('Close')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByText('Last')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByText('Close')).toHaveFocus();
  screen.getByText('Background').focus();
  expect(screen.getByText('Close')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});
