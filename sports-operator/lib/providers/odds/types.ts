import type { Game } from '../../types';

export interface OddsProvider {
  name: string;
  isDemo: boolean;
  fetchTodayGames(): Promise<Game[]>;
}
