import raw from "@/data/type-chart.gen3.json";

/**
 * Gen 3-type-matematik.
 *
 * ALT herunder er almindelig kode på en statisk tabel — ingen AI.
 * AI-laget må kun se de færdige tal, aldrig regne dem ud.
 */

/**
 * De 17 Gen 3-typer. Fairy findes IKKE i Gen 3 og må ikke tilføjes her.
 * Unionen er skrevet eksplicit (ikke udledt af JSON), så TypeScript kan
 * fange stavefejl i resten af koden.
 */
export const TYPES = [
  "normal",
  "fighting",
  "flying",
  "poison",
  "ground",
  "rock",
  "bug",
  "ghost",
  "steel",
  "fire",
  "water",
  "grass",
  "electric",
  "psychic",
  "ice",
  "dragon",
  "dark",
] as const;

export type PokeType = (typeof TYPES)[number];

export type DamageClass = "physical" | "special";

const TYPE_SET: ReadonlySet<string> = new Set(TYPES);

// Fail fast hvis JSON-filen og unionen kommer ud af sync.
{
  const fromJson = raw.types as string[];
  const missing = TYPES.filter((t) => !fromJson.includes(t));
  const extra = fromJson.filter((t) => !TYPE_SET.has(t));
  if (missing.length || extra.length) {
    throw new Error(
      `type-chart.gen3.json matcher ikke PokeType-unionen. ` +
        `Mangler: [${missing.join(", ")}]. Ukendte: [${extra.join(", ")}].`,
    );
  }
}

export function isPokeType(value: string): value is PokeType {
  return TYPE_SET.has(value);
}

/**
 * I Gen 1-3 er physical/special bestemt af movets TYPE, ikke af movet selv.
 * Det påvirker om Attack eller Sp. Attack bruges.
 */
export function damageClassOf(type: PokeType): DamageClass {
  return (raw.damageClass as Record<string, DamageClass>)[type];
}

/* ------------------------------------------------------------------ */
/* Matrix                                                              */
/* ------------------------------------------------------------------ */

type Matrix = Record<PokeType, Record<PokeType, number>>;

function buildMatrix(): Matrix {
  const matrix = {} as Matrix;
  const chart = raw.chart as Record<
    string,
    {
      superEffective: PokeType[];
      notVeryEffective: PokeType[];
      noEffect: PokeType[];
    }
  >;

  for (const attacker of TYPES) {
    matrix[attacker] = {} as Record<PokeType, number>;
    for (const defender of TYPES) matrix[attacker][defender] = 1;

    const entry = chart[attacker];
    if (!entry) throw new Error(`Type-tabel mangler angriber-typen "${attacker}"`);

    for (const d of entry.superEffective) matrix[attacker][d] = 2;
    for (const d of entry.notVeryEffective) matrix[attacker][d] = 0.5;
    for (const d of entry.noEffect) matrix[attacker][d] = 0;
  }

  return matrix;
}

const MATRIX = buildMatrix();

/** Multiplikator for én angribende type mod én forsvarende type. */
export function singleEffectiveness(
  attacker: PokeType,
  defender: PokeType,
): number {
  return MATRIX[attacker][defender];
}

/**
 * Multiplikator mod en (evt. dobbelt-typet) Pokémon.
 * Gen 3 ganger de to typer sammen: 0, 0.25, 0.5, 1, 2 eller 4.
 */
export function effectiveness(
  attacker: PokeType,
  defenderTypes: readonly PokeType[],
): number {
  return defenderTypes.reduce(
    (mult, defender) => mult * MATRIX[attacker][defender],
    1,
  );
}

/* ------------------------------------------------------------------ */
/* Defensiv profil                                                     */
/* ------------------------------------------------------------------ */

export interface DefensiveProfile {
  /** Multiplikator for hver af de 17 angribende typer. */
  multipliers: Record<PokeType, number>;
  /** > 1 (2x eller 4x) */
  weaknesses: PokeType[];
  /** 4x — værd at fremhæve særskilt */
  doubleWeaknesses: PokeType[];
  /** < 1 men > 0 (0.5x eller 0.25x) */
  resistances: PokeType[];
  /** 0x */
  immunities: PokeType[];
}

export function defensiveProfile(
  defenderTypes: readonly PokeType[],
): DefensiveProfile {
  const multipliers = {} as Record<PokeType, number>;
  const weaknesses: PokeType[] = [];
  const doubleWeaknesses: PokeType[] = [];
  const resistances: PokeType[] = [];
  const immunities: PokeType[] = [];

  for (const attacker of TYPES) {
    const mult = effectiveness(attacker, defenderTypes);
    multipliers[attacker] = mult;

    if (mult === 0) immunities.push(attacker);
    else if (mult > 1) {
      weaknesses.push(attacker);
      if (mult >= 4) doubleWeaknesses.push(attacker);
    } else if (mult < 1) resistances.push(attacker);
  }

  return { multipliers, weaknesses, doubleWeaknesses, resistances, immunities };
}

/** Typer denne angriber rammer for mindst 2x (mod enkelt-typede mål). */
export function superEffectiveAgainst(attacker: PokeType): PokeType[] {
  return TYPES.filter((d) => MATRIX[attacker][d] > 1);
}
