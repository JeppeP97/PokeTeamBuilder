/**
 * Scope: kun Gen 3 – FireRed og Emerald.
 * Hvert spil mapper til en regional pokédex (pool) og en version-group
 * (movesets). Begge dele hentes fra PokéAPI.
 */

export const GAMES = {
  firered: {
    id: "firered",
    label: "Pokémon FireRed",
    /** PokéAPI /pokedex/<name> – bestemmer hvilke Pokémon der er i poolen */
    pokedex: "kanto",
    /** PokéAPI version-group – bestemmer hvilke moves der findes i spillet */
    versionGroup: "firered-leafgreen",
    generation: 3,
  },
  emerald: {
    id: "emerald",
    label: "Pokémon Emerald",
    pokedex: "hoenn",
    versionGroup: "emerald",
    generation: 3,
  },
} as const;

export type GameId = keyof typeof GAMES;

export const GAME_IDS = Object.keys(GAMES) as GameId[];

export function isGameId(value: string): value is GameId {
  return value in GAMES;
}

export function getGame(id: GameId) {
  return GAMES[id];
}
