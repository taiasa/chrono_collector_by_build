
export enum GameState {
  TITLE = 'TITLE',
  PLAYING = 'PLAYING',
  QUIZ = 'QUIZ',
  GACHA = 'GACHA',
  COLLECTION = 'COLLECTION',
  STAGECLEAR = 'STAGECLEAR',
  ENDING = 'ENDING'
}

export enum PowerUpType {
  NONE = 'NONE',
  MAGNET = 'MAGNET',
  BURST = 'BURST',
  GIANT = 'GIANT'
}

export interface Quiz {
  q: string;
  choices: string[];
  a: number;
}

export interface HistoryItem {
  id: number;
  name: string;
  icon: string;
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  description: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Gem {
  x: number;
  y: number;
  vx: number;
  id: number;
  active: boolean;
  type: number;
  isSpecial: boolean;
  specialType: PowerUpType;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}
