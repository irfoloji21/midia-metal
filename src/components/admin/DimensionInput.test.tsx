import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import DimensionInput from './DimensionInput';

afterEach(cleanup);

it('changes the displayed unit without writing a new measurement', () => {
    const onChangeCm = vi.fn();
    const view = render(<DimensionInput valueCm={100} unit="m" label="Length" onChangeCm={onChangeCm} />);
    expect(screen.getByRole('spinbutton', { name: 'Length (m)' })).toHaveValue(1);
    view.rerender(<DimensionInput valueCm={100} unit="cm" label="Length" onChangeCm={onChangeCm} />);
    expect(screen.getByRole('spinbutton', { name: 'Length (cm)' })).toHaveValue(100);
    view.rerender(<DimensionInput valueCm={100} unit="mm" label="Length" onChangeCm={onChangeCm} />);
    expect(screen.getByRole('spinbutton', { name: 'Length (mm)' })).toHaveValue(1000);
    expect(onChangeCm).not.toHaveBeenCalled();
});

it('allows decimal entry, saves centimetres and keeps an empty override empty', () => {
    const changed = vi.fn();
    function Field() {
        const [value, setValue] = useState<number | null>(null);
        return <DimensionInput valueCm={value} unit="m" label="Width" onChangeCm={value => { setValue(value); changed(value); }} />;
    }
    render(<Field />);
    const input = screen.getByRole('spinbutton', { name: 'Width (m)' });
    fireEvent.change(input, { target: { value: '0.1' } });
    expect(changed).toHaveBeenLastCalledWith(10);
    expect(input).toHaveValue(0.1);
    fireEvent.change(input, { target: { value: '0.115' } });
    expect(changed).toHaveBeenLastCalledWith(11.5);
    expect(input).toBeValid();
    fireEvent.change(input, { target: { value: '0.001' } });
    expect(input).toBeInvalid();
    fireEvent.change(input, { target: { value: '' } });
    expect(changed).toHaveBeenLastCalledWith(null);
    expect(input).toHaveValue(null);
});
