'use client';

import { useState } from 'react';
import { maskCpfInput, maskPhoneInput } from './ui';

export function MaskedInput({
  mask,
  defaultValue = '',
  ...props
}: { mask: 'phone' | 'cpf'; defaultValue?: string } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'defaultValue'
>) {
  const fn = mask === 'phone' ? maskPhoneInput : maskCpfInput;
  const [value, setValue] = useState(fn(defaultValue));
  return (
    <input
      {...props}
      className="glass-input"
      inputMode="numeric"
      value={value}
      onChange={(e) => setValue(fn(e.target.value))}
    />
  );
}
