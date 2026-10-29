import { useEffect, useState } from 'react';
import { dimensionInputLimits, fromCentimetres, toCentimetres, type DimensionUnit } from '@/lib/dimensions';

type DimensionInputProps = {
    valueCm: unknown;
    unit: DimensionUnit;
    label: string;
    onChangeCm: (value: number | null) => void;
    className?: string;
};

export default function DimensionInput({ valueCm, unit, label, onChangeCm, className }: DimensionInputProps) {
    const [draft, setDraft] = useState(() => String(fromCentimetres(valueCm, unit) ?? ''));

    useEffect(() => {
        setDraft(String(fromCentimetres(valueCm, unit) ?? ''));
    }, [valueCm, unit]);

    return (
        <input
            type="number"
            aria-label={`${label} (${unit})`}
            {...dimensionInputLimits(unit)}
            value={draft}
            onChange={(event) => {
                const value = event.target.value;
                setDraft(value);
                onChangeCm(toCentimetres(value, unit));
            }}
            className={className}
            placeholder="base"
        />
    );
}
