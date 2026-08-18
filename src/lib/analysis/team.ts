import {
  TYPES,
  type PokeType,
  damageClassOf,
  defensiveProfile,
  effectiveness,
  isPokeType,
} from "@/lib/types/type-chart";

/**
 * Team-analyse — ren kode, ingen AI.
 *
 * Output herfra er præcis det AI-laget senere får serveret: færdige tal
 * og lister. AI'en skal formulere dem, ikke genberegne dem.
 */

export interface TeamMemberInput {
  name: string;
  types: string[];
  /** Typer af de moves medlemmet faktisk kender (valgfrit). */
  moveTypes?: string[];
  baseStats?: {
    hp: number;
    attack: number;
    defense: number;
    "special-attack": number;
    "special-defense": number;
    speed: number;
  };
}

export interface MemberDefense {
  name: string;
  types: PokeType[];
  weaknesses: PokeType[];
  doubleWeaknesses: PokeType[];
  resistances: PokeType[];
  immunities: PokeType[];
}

export interface DefensiveTypeRow {
  type: PokeType;
  /** Antal holdmedlemmer der tager mindst 2x fra denne type. */
  weakCount: number;
  /** Antal der tager 4x. */
  doubleWeakCount: number;
  /** Antal der resisterer (0.25x eller 0.5x). */
  resistCount: number;
  /** Antal der er immune. */
  immuneCount: number;
  /** Navne på de sårbare medlemmer — gør AI-outputtet konkret. */
  weakMembers: string[];
  /**
   * Nettoscore: negativ = holdet er dårligt stillet mod typen.
   * (resist + immune*2) - (weak + doubleWeak)
   */
  score: number;
}

export interface OffensiveTypeRow {
  type: PokeType;
  /** Medlemmer der kan ramme denne forsvarstype for mindst 2x. */
  hitBy: string[];
  /** Medlemmer hvis angreb prelles helt af (0x). */
  wallCandidates: string[];
}

export interface TeamAnalysis {
  size: number;
  members: MemberDefense[];

  defensive: {
    rows: DefensiveTypeRow[];
    /** Typer hvor mindst 2 medlemmer er svage OG ingen resisterer. */
    criticalThreats: DefensiveTypeRow[];
    /** Typer ingen på holdet resisterer eller er immune overfor. */
    unresisted: PokeType[];
    /** Gennemsnitligt antal svagheder pr. medlem. */
    averageWeaknesses: number;
  };

  offensive: {
    rows: OffensiveTypeRow[];
    /** Forsvarstyper ingen på holdet rammer for 2x eller mere. */
    coverageGaps: PokeType[];
    /** Hvor mange af de 17 typer holdet rammer super-effektivt. */
    coveredCount: number;
    /** Fordeling af angrebstyper på physical/special (Gen 3-regel). */
    damageClassSplit: { physical: number; special: number };
  };

  /** Advarsler om input, fx ukendte typer. */
  warnings: string[];
}

function toPokeTypes(values: readonly string[], warnings: string[], who: string) {
  const out: PokeType[] = [];
  for (const v of values) {
    const t = v.toLowerCase();
    if (isPokeType(t)) out.push(t);
    else warnings.push(`Ukendt Gen 3-type "${v}" på ${who} — ignoreret.`);
  }
  return out;
}

export function analyseTeam(team: readonly TeamMemberInput[]): TeamAnalysis {
  const warnings: string[] = [];

  const members: MemberDefense[] = team.map((m) => {
    const types = toPokeTypes(m.types, warnings, m.name);
    const profile = defensiveProfile(types);
    return {
      name: m.name,
      types,
      weaknesses: profile.weaknesses,
      doubleWeaknesses: profile.doubleWeaknesses,
      resistances: profile.resistances,
      immunities: profile.immunities,
    };
  });

  /* ---------------- defensivt ---------------- */

  const rows: DefensiveTypeRow[] = TYPES.map((type) => {
    const weakMembers = members
      .filter((m) => m.weaknesses.includes(type))
      .map((m) => m.name);
    const doubleWeakCount = members.filter((m) =>
      m.doubleWeaknesses.includes(type),
    ).length;
    const resistCount = members.filter((m) =>
      m.resistances.includes(type),
    ).length;
    const immuneCount = members.filter((m) =>
      m.immunities.includes(type),
    ).length;

    return {
      type,
      weakCount: weakMembers.length,
      doubleWeakCount,
      resistCount,
      immuneCount,
      weakMembers,
      score: resistCount + immuneCount * 2 - (weakMembers.length + doubleWeakCount),
    };
  });

  const criticalThreats = rows
    .filter((r) => r.weakCount >= 2 && r.resistCount === 0 && r.immuneCount === 0)
    .sort((a, b) => a.score - b.score);

  const unresisted = rows
    .filter((r) => r.resistCount === 0 && r.immuneCount === 0)
    .map((r) => r.type);

  const totalWeaknesses = members.reduce((s, m) => s + m.weaknesses.length, 0);

  /* ---------------- offensivt ---------------- */

  // Angrebstyper = STAB (medlemmets egne typer) + evt. kendte move-typer.
  const attackTypesPerMember = team.map((m, i) => {
    const declared = m.moveTypes
      ? toPokeTypes(m.moveTypes, warnings, `${m.name} (moves)`)
      : [];
    const set = new Set<PokeType>([...members[i].types, ...declared]);
    return { name: m.name, attacks: [...set] };
  });

  const offensiveRows: OffensiveTypeRow[] = TYPES.map((defType) => {
    const hitBy: string[] = [];
    const wallCandidates: string[] = [];

    for (const { name, attacks } of attackTypesPerMember) {
      const best = attacks.reduce(
        (max, a) => Math.max(max, effectiveness(a, [defType])),
        0,
      );
      if (best >= 2) hitBy.push(name);
      if (attacks.length > 0 && best === 0) wallCandidates.push(name);
    }

    return { type: defType, hitBy, wallCandidates };
  });

  const allAttackTypes = new Set<PokeType>(
    attackTypesPerMember.flatMap((m) => m.attacks),
  );
  const damageClassSplit = { physical: 0, special: 0 };
  for (const t of allAttackTypes) damageClassSplit[damageClassOf(t)] += 1;

  const coverageGaps = offensiveRows
    .filter((r) => r.hitBy.length === 0)
    .map((r) => r.type);

  return {
    size: team.length,
    members,
    defensive: {
      rows,
      criticalThreats,
      unresisted,
      averageWeaknesses: team.length
        ? Number((totalWeaknesses / team.length).toFixed(2))
        : 0,
    },
    offensive: {
      rows: offensiveRows,
      coverageGaps,
      coveredCount: TYPES.length - coverageGaps.length,
      damageClassSplit,
    },
    warnings,
  };
}
