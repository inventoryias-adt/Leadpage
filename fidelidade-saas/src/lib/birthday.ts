/** Aniversário do cliente: só dia e mês (sem o ano). Regras puras, sem banco. */

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // fevereiro com 29: quem nasceu em 29/02 pode informar

export const MONTH_NAMES = MONTHS;

export function validBirthday(day: number, month: number) {
  return Number.isInteger(day) && Number.isInteger(month) && month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

/** "12 de março". */
export const birthdayText = (day: number, month: number) => `${day} de ${MONTHS[month - 1]}`;

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Quais aniversários (dia/mês) pedem presente numa data: o próprio dia e, em ano não bissexto, quem faz 29/02 recebe em 28/02
 * (para não ficar sem presente três anos em quatro).
 */
export function birthdaysFor(day: number, month: number, year: number): { day: number; month: number }[] {
  const out = [{ day, month }];
  if (day === 28 && month === 2 && !isLeapYear(year)) out.push({ day: 29, month: 2 });
  return out;
}
