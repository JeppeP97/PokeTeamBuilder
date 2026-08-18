/**
 * Minimale, håndskrevne typer for de dele af PokéAPI vi faktisk bruger.
 * (PokéAPI's fulde skema er enormt – vi typer kun felterne vi læser.)
 */

export interface NamedAPIResource {
  name: string;
  url: string;
}

/** GET /api/v2/pokedex/{kanto|hoenn} */
export interface PokedexResource {
  id: number;
  name: string;
  pokemon_entries: {
    entry_number: number;
    pokemon_species: NamedAPIResource;
  }[];
}

/** GET /api/v2/pokemon/{name|id} */
export interface PokemonResource {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: {
    slot: number;
    type: NamedAPIResource;
  }[];
  stats: {
    base_stat: number;
    effort: number;
    stat: NamedAPIResource;
  }[];
  abilities: {
    ability: NamedAPIResource;
    is_hidden: boolean;
    slot: number;
  }[];
  moves: {
    move: NamedAPIResource;
    version_group_details: {
      level_learned_at: number;
      move_learn_method: NamedAPIResource;
      version_group: NamedAPIResource;
    }[];
  }[];
  sprites: {
    front_default: string | null;
    versions?: Record<string, Record<string, { front_default?: string | null }>>;
  };
}

/** GET /api/v2/pokemon-species/{name|id} */
export interface PokemonSpeciesResource {
  id: number;
  name: string;
  varieties: {
    is_default: boolean;
    pokemon: NamedAPIResource;
  }[];
}

/** GET /api/v2/move/{name} */
export interface MoveResource {
  id: number;
  name: string;
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  priority: number;
  type: NamedAPIResource;
  damage_class: NamedAPIResource;
}

/* ------------------------------------------------------------------ */
/* App-interne, normaliserede former                                   */
/* ------------------------------------------------------------------ */

export type StatKey =
  | "hp"
  | "attack"
  | "defense"
  | "special-attack"
  | "special-defense"
  | "speed";

export type BaseStats = Record<StatKey, number>;

export interface LearnableMove {
  name: string;
  /** "level-up" | "machine" | "tutor" | "egg" | ... */
  method: string;
  levelLearnedAt: number;
}

/** Den normaliserede Pokémon-form resten af appen arbejder med. */
export interface PokemonSummary {
  id: number;
  name: string;
  /** 1-2 typer, lowercase PokéAPI-navne, fx ["water", "ground"] */
  types: string[];
  baseStats: BaseStats;
  baseStatTotal: number;
  abilities: string[];
  spriteUrl: string | null;
}

export interface PokemonWithMoves extends PokemonSummary {
  /** Kun moves der kan læres i det valgte spils version-group. */
  moves: LearnableMove[];
}

export interface PokedexEntry {
  entryNumber: number;
  species: string;
}
