/**
 * Os sete itens em que as letras do nome viram na abertura do app, um por tipo de lugar que o Fidelize atende:
 * tesoura (beleza e barbearia), xícara (café e padaria), copo de cerveja (bar e petiscos), patinha (pet shop),
 * haltere (academia), cruz (farmácia) e hambúrguer (restaurantes).
 * Desenhados em 40 × 52, com o degradê `g` e os detalhes na cor do fundo `bg`.
 */
type P = { g: string; bg: string };
const fill = (g: string) => `url(#${g})`;

export function Tesoura({ g }: P) {
  return (
    <g fill="none" stroke={fill(g)} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="42" r="6.5" strokeWidth="4" />
      <circle cx="30" cy="42" r="6.5" strokeWidth="4" />
      <path d="M13.5 36 L28 6" />
      <path d="M26.5 36 L12 6" />
    </g>
  );
}
export function Xicara({ g }: P) {
  return (
    <>
      <g fill={fill(g)}>
        <path d="M5 22h24v12a12 12 0 0 1-12 12h0A12 12 0 0 1 5 34z" />
        <rect x="2" y="47" width="30" height="4" rx="2" />
      </g>
      <g fill="none" stroke={fill(g)} strokeWidth="4" strokeLinecap="round">
        <path d="M29 26h3a5.5 5.5 0 0 1 0 11h-4" />
        <path d="M12 6c-3.5 3.2 3.5 5.8 0 9.5" />
        <path d="M21 6c-3.5 3.2 3.5 5.8 0 9.5" />
      </g>
    </>
  );
}
export function Cerveja({ g, bg }: P) {
  return (
    <>
      <g fill={fill(g)}>
        <circle cx="10.5" cy="12" r="6" />
        <circle cx="19" cy="9.5" r="7" />
        <circle cx="27" cy="12.5" r="5.5" />
        <rect x="5" y="13" width="26" height="36" rx="5" />
      </g>
      <path d="M31 22h3a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-3" fill="none" stroke={fill(g)} strokeWidth="4" strokeLinecap="round" />
      <g stroke={bg} strokeWidth="2.6" strokeLinecap="round">
        <path d="M12 24v16" />
        <path d="M19 24v16" />
        <path d="M26 24v16" />
      </g>
    </>
  );
}
export function Pata({ g }: P) {
  return (
    <g fill={fill(g)}>
      <ellipse cx="7.5" cy="25" rx="4.5" ry="6" transform="rotate(-20 7.5 25)" />
      <ellipse cx="15.5" cy="14.5" rx="4.8" ry="6.8" transform="rotate(-8 15.5 14.5)" />
      <ellipse cx="25.5" cy="14.5" rx="4.8" ry="6.8" transform="rotate(8 25.5 14.5)" />
      <ellipse cx="33.5" cy="25" rx="4.5" ry="6" transform="rotate(20 33.5 25)" />
      <path d="M9 40c0-7 5-11.5 11-11.5S31 33 31 40c0 5.5-4.5 8.5-11 8.5S9 45.5 9 40z" />
    </g>
  );
}
export function Haltere({ g }: P) {
  return (
    <g fill={fill(g)}>
      <rect x="6" y="5" width="28" height="11" rx="3.5" />
      <rect x="10" y="18" width="20" height="7" rx="2.5" />
      <rect x="17" y="25" width="6" height="2" />
      <rect x="10" y="27" width="20" height="7" rx="2.5" />
      <rect x="6" y="36" width="28" height="11" rx="3.5" />
    </g>
  );
}
export function Cruz({ g }: P) {
  return (
    <g fill={fill(g)}>
      <rect x="3" y="18" width="34" height="15" rx="5" />
      <rect x="12.5" y="6" width="15" height="40" rx="5" />
    </g>
  );
}
export function Hamburguer({ g, bg }: P) {
  return (
    <>
      <g fill={fill(g)}>
        <path d="M3 22C3 12 10.5 6 20 6s17 6 17 16z" />
        <rect x="3" y="31" width="34" height="8" rx="4" />
        <path d="M3 42h34v1a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6z" />
      </g>
      <path d="M3 27.5q3.4 3.5 6.8 0t6.8 0t6.8 0t6.8 0t6.8 0" fill="none" stroke={fill(g)} strokeWidth="3.4" strokeLinecap="round" />
      <g fill={bg}>
        <ellipse cx="13" cy="14" rx="1.8" ry="1.1" transform="rotate(-20 13 14)" />
        <ellipse cx="21" cy="11" rx="1.8" ry="1.1" />
        <ellipse cx="28" cy="15" rx="1.8" ry="1.1" transform="rotate(25 28 15)" />
        <ellipse cx="19" cy="18" rx="1.8" ry="1.1" transform="rotate(10 19 18)" />
      </g>
    </>
  );
}
