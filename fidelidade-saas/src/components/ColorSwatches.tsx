import { COLORS } from '@/lib/palette';

/** Escolha de cor (campo de formulário): bolinhas da paleta fixa. Sem escolher, vale a cor padrão. */
export function ColorSwatches({ name = 'color', value, label = 'Cor', hint }: { name?: string; value?: string | null; label?: string; hint?: string }) {
  return (
    <fieldset>
      <legend className="glass-label">{label}{hint && <span className="font-normal text-slate-500"> — {hint}</span>}</legend>
      <div className="flex flex-wrap gap-2.5">
        {COLORS.map((c) => (
          <label key={c.key} title={c.label} className="relative cursor-pointer">
            <input type="radio" name={name} value={c.key} defaultChecked={value === c.key} className="peer sr-only" />
            <span className="block h-9 w-9 rounded-full ring-2 ring-transparent ring-offset-2 transition peer-checked:ring-primary peer-focus-visible:ring-electric-500" style={{ background: c.hex }} />
            <span className="sr-only">{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Troca de cor de algo já criado: cada bolinha é um botão que envia a cor escolhida (sem JavaScript). */
export function ColorDots({ action, id, value }: { action: (formData: FormData) => void | Promise<void>; id: string; value: string }) {
  return (
    <form action={action} className="flex items-center gap-1.5" aria-label="Cor">
      <input type="hidden" name="id" value={id} />
      {COLORS.map((c) => (
        <button
          key={c.key}
          name="color"
          value={c.key}
          title={c.label}
          aria-label={`Cor ${c.label}`}
          aria-pressed={value === c.key}
          className={`h-6 w-6 rounded-full ring-2 ring-offset-1 transition ${value === c.key ? 'ring-primary' : 'ring-transparent hover:ring-slate-300'}`}
          style={{ background: c.hex }}
        />
      ))}
    </form>
  );
}
