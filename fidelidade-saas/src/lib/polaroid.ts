/** Medidas e texto da imagem "Polaroid" que a pessoa publica no story do Instagram (sem navegador, para testar). */

export const POLAROID = {
  /** Formato de story: 9:16. */
  width: 1080,
  height: 1920,
  cardX: 100,
  cardY: 330,
  cardW: 880,
  pad: 50,
  /** A foto é um quadrado dentro da moldura branca. */
  photo: 780,
  captionH: 360,
  tilt: -2.5,
} as const;

export const POLAROID_COMMENT_MAX_LINES = 3;

/** Quebra o texto em linhas que cabem em `maxWidth` (medido por `measure`); o que passar de `maxLines` vira reticências. */
export function wrapLines(text: string, measure: (s: string) => number, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (measure(next) <= maxWidth) { line = next; continue; }
    if (line) { lines.push(line); line = ''; }
    if (lines.length === maxLines) break;
    // palavra maior que a linha inteira: corta na marra
    let w = words[i];
    while (measure(w) > maxWidth && w.length > 1) w = w.slice(0, -1);
    line = w;
    if (w.length < words[i].length) { lines.push(line); line = ''; if (lines.length === maxLines) { i++; break; } }
  }
  if (line && lines.length < maxLines) { lines.push(line); line = ''; i = words.length; }
  const truncated = i < words.length || line !== '';
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[\s.,;:!?-]+$/, '')}…`;
  }
  return lines.slice(0, maxLines);
}

/** Nome do arquivo da imagem: "fidelize-burger-do-ze.png". */
export function polaroidFileName(placeName: string) {
  const slug = placeName.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `fidelize-${slug || 'indicacao'}.png`;
}
