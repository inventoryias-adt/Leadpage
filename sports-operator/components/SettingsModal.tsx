'use client';

import { useState } from 'react';
import type { UserSettings } from '../lib/types';

export default function SettingsModal({
  settings,
  onClose,
  onSave
}: {
  settings: UserSettings;
  onClose: () => void;
  onSave: (s: UserSettings) => Promise<void>;
}) {
  const [form, setForm] = useState<UserSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof UserSettings>(key: K, value: string) {
    const num = Number(value);
    setForm((f) => ({ ...f, [key]: Number.isFinite(num) ? num : f[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-panel border border-border rounded-lg max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Configurações</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Banca (R$)" value={form.bankroll} onChange={(v) => field('bankroll', v)} />
          <Field label="Stake (%)" value={form.stakePercent} onChange={(v) => field('stakePercent', v)} />
          <Field label="Stake máxima (R$)" value={form.maxStake} onChange={(v) => field('maxStake', v)} />
          <Field label="Meta de lucro (%)" value={form.profitTarget} onChange={(v) => field('profitTarget', v)} />
          <Field
            label="Probabilidade mínima (0-1)"
            value={form.minProbability}
            onChange={(v) => field('minProbability', v)}
            step="0.01"
          />
          <Field label="Odd mínima" value={form.minOdd} onChange={(v) => field('minOdd', v)} step="0.01" />
          <Field label="Odd máxima" value={form.maxOdd} onChange={(v) => field('maxOdd', v)} step="0.01" />
          <div>
            <label className="text-xs text-muted block mb-1">Máx. seleções na múltipla</label>
            <select
              className="w-full bg-panel2 border border-border rounded px-2 py-1.5"
              value={form.maxLegsMultiple}
              onChange={(e) => setForm((f) => ({ ...f, maxLegsMultiple: Number(e.target.value) as 2 | 3 }))}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
        </div>

        {error && <p className="text-danger text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded border border-border text-sm">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded bg-accent text-black font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = '1'
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1">{label}</label>
      <input
        type="number"
        step={step}
        className="w-full bg-panel2 border border-border rounded px-2 py-1.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
