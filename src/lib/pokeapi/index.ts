import { getResource, getByUrl, mapWithConcurrency, PokeApiError } from "./client";
import { GAMES, type GameId } from "../games/games";
import type {
  BaseStats,
  LearnableMove,
  PokedexEntry,
  PokedexResource,
  PokemonResource,
  PokemonSpeciesResource,
  PokemonSummary,
  PokemonWithMoves,
  StatKey,
} from "./types";

export * from "./types";
export { PokeApiError, POKEAPI_BASE } from "./client";
export { cacheStats, clearMemoryCache } from "./cache";

const STAT_KEYS: StatKey[] = [
  "hp",
  "attack",
  "defense",
  "special-attack",
  "special-defense",
  "speed",
];

const EMPTY_STATS: BaseStats = {
  hp: 0,
  attack: 0,
  defense: 0,
  "special-attack": 0,
  "special-defense": 0,
  speed: 0,
};

/* ------------------------------------------------------------------ */
/* Pokédex-pools                                                       */
/* ------------------------------------------------------------------ */

/** Alle species i det valgte spils regionale pokédex. */
export async function getPokedexEntries(game: GameId): Promise<PokedexEntry[]> {
  const dex = await getResource<PokedexResource>(`pokedex/${GAMES[game].pokedex}`);
  return dex.pokemon_entries
    .map((e) => ({
      entryNumber: e.entry_number,
      species: e.pokemon_species.name,
    }))
    .sort((a, b) => a.entryNumber - b.entryNumber);
}

/* ------------------------------------------------------------------ */
/* Enkelt-Pokémon                                                      */
/* ------------------------------------------------------------------ */

function toBaseStats(resource: PokemonResource): BaseStats {
  const stats: BaseStats = { ...EMPTY_STATS };
  for (const entry of resource.stats) {
    const key = entry.stat.name as StatKey;
    if (STAT_KEYS.includes(key)) stats[key] = entry.base_stat;
  }
  return stats;
}

function gen3Sprite(resource: PokemonResource): string | null {
  const gen3 = resource.sprites.versions?.["generation-iii"];
  return (
    gen3?.["emerald"]?.front_default ??
    gen3?.["firered-leafgreen"]?.front_default ??
    gen3?.["ruby-sapphire"]?.front_default ??
    resource.sprites.front_default ??
    null
  );
}

function toSummary(resource: PokemonResource): PokemonSummary {
  const baseStats = toBaseStats(resource);
  return {
    id: resource.id,
    name: resource.name,
    types: [...resource.types]
      .sort((a, b) => a.slot - b.slot)
      .map((t) => t.type.name),
    baseStats,
    baseStatTotal: STAT_KEYS.reduce((sum, k) => sum + baseStats[k], 0),
    abilities: resource.abilities
      .filter((a) => !a.is_hidden) // skjulte abilities findes ikke i Gen 3
      .sort((a, b) => a.slot - b.slot)
      .map((a) => a.ability.name),
    spriteUrl: gen3Sprite(resource),
  };
}

/**
 * Henter en Pokémon-ressource. Species-navne matcher næsten altid
 * /pokemon/<navn>; hvor de ikke gør (fx "deoxys") slår vi op via
 * species-endpointet og bruger default-varianten.
 */
export async function getPokemonResource(
  nameOrId: string | number,
): Promise<PokemonResource> {
  try {
    return await getResource<PokemonResource>(`pokemon/${nameOrId}`);
  } catch (err) {
    if (!(err instanceof PokeApiError) || err.status !== 404) throw err;

    const species = await getResource<PokemonSpeciesResource>(
      `pokemon-species/${nameOrId}`,
    );
    const variety =
      species.varieties.find((v) => v.is_default) ?? species.varieties[0];
    if (!variety) {
      throw new PokeApiError(`Ingen varianter fundet for ${nameOrId}`, 404);
    }
    return getByUrl<PokemonResource>(variety.pokemon.url);
  }
}

export async function getPokemon(
  nameOrId: string | number,
): Promise<PokemonSummary> {
  return toSummary(await getPokemonResource(nameOrId));
}

/* ------------------------------------------------------------------ */
/* Movesets pr. spil                                                   */
/* ------------------------------------------------------------------ */

/** Moves som denne Pokémon rent faktisk kan lære i det valgte spil. */
export function movesForGame(
  resource: PokemonResource,
  game: GameId,
): LearnableMove[] {
  const versionGroup = GAMES[game].versionGroup;
  const out: LearnableMove[] = [];

  for (const entry of resource.moves) {
    for (const detail of entry.version_group_details) {
      if (detail.version_group.name !== versionGroup) continue;
      out.push({
        name: entry.move.name,
        method: detail.move_learn_method.name,
        levelLearnedAt: detail.level_learned_at,
      });
    }
  }

  // Samme move kan optræde via flere metoder – behold den "billigste".
  const priority = ["level-up", "machine", "tutor", "egg"];
  const byName = new Map<string, LearnableMove>();
  for (const move of out) {
    const existing = byName.get(move.name);
    if (
      !existing ||
      priority.indexOf(move.method) < priority.indexOf(existing.method)
    ) {
      byName.set(move.name, move);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPokemonWithMoves(
  nameOrId: string | number,
  game: GameId,
): Promise<PokemonWithMoves> {
  const resource = await getPokemonResource(nameOrId);
  return { ...toSummary(resource), moves: movesForGame(resource, game) };
}

/* ------------------------------------------------------------------ */
/* Hele poolen                                                         */
/* ------------------------------------------------------------------ */

/**
 * Alle Pokémon i spillets pool, normaliseret (uden moves – de er tunge
 * og hentes først når en Pokémon vælges).
 */
export async function getPokemonPool(game: GameId): Promise<PokemonSummary[]> {
  const entries = await getPokedexEntries(game);
  const results = await mapWithConcurrency(entries, 8, async (entry) => {
    try {
      return await getPokemon(entry.species);
    } catch {
      return null;
    }
  });
  return results
    .filter((p): p is PokemonSummary => p !== null)
    .sort((a, b) => a.id - b.id);
}
