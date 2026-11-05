/**
 * Os sete itens em que as letras do nome viram na abertura do app, um por lugar que o Fidelize atende:
 * tesoura (barbearia), xícara (café), cupcake (doceria), batom (estética), sorvete, pizza e copo de açaí.
 * Desenhados em 40 × 52, com o degradê `g` e os furos/detalhes na cor do fundo `bg`.
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
export function Cupcake({ g, bg }: P) {
  return (
    <>
      <g fill={fill(g)}>
        <circle cx="20" cy="6" r="4" />
        <path d="M4 28c0-9 6-15 16-15s16 6 16 15z" />
        <path d="M7 32h26l-3 15a4 4 0 0 1-3.9 3.2H13.9A4 4 0 0 1 10 47z" />
      </g>
      <g stroke={bg} strokeWidth="2.2" strokeLinecap="round">
        <path d="M14 36l1 10" />
        <path d="M20 36v11" />
        <path d="M26 36l-1 10" />
      </g>
    </>
  );
}
export function Batom({ g }: P) {
  return (
    <g fill={fill(g)}>
      <path d="M14 23V13c0-4 2.5-9 6-9s6 5 6 9v10z" />
      <rect x="12" y="26" width="16" height="5" rx="1.5" />
      <rect x="10" y="33" width="20" height="16" rx="3.5" />
    </g>
  );
}
export function Sorvete({ g, bg }: P) {
  return (
    <>
      <g fill={fill(g)} stroke={fill(g)} strokeLinejoin="round" strokeWidth="2.5">
        <circle cx="20" cy="15" r="11" />
        <path d="M9.5 25h21L20 50z" />
      </g>
      <g stroke={bg} strokeWidth="2" strokeLinecap="round">
        <path d="M14 30l8 12" />
        <path d="M26 30l-8 12" />
      </g>
    </>
  );
}
export function Pizza({ g, bg }: P) {
  return (
    <>
      <g fill={fill(g)} stroke={fill(g)} strokeLinejoin="round" strokeWidth="2.5">
        <path d="M5 17Q20 8 35 17L20 50z" />
      </g>
      <path d="M3.5 13Q20 4 36.5 13" fill="none" stroke={fill(g)} strokeWidth="6" strokeLinecap="round" />
      <g fill={bg}>
        <circle cx="14.5" cy="22" r="3" />
        <circle cx="25" cy="24" r="3" />
        <circle cx="19.5" cy="35" r="3" />
      </g>
    </>
  );
}
export function Acai({ g }: P) {
  return (
    <>
      <g fill={fill(g)}>
        <path d="M8 20C8 11 13 7 20 7s12 4 12 13z" />
        <path d="M4 23h32l-4.2 24.5a4 4 0 0 1-3.9 3.5H12.1a4 4 0 0 1-3.9-3.5z" />
      </g>
      <path d="M25 14 L33 1" fill="none" stroke={fill(g)} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}
