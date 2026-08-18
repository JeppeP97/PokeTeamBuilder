import { analyseTeam, type TeamAnalysis, type TeamMemberInput } from "./team";
import { scoreTeam, type ScoreBreakdown } from "./score";
import type { PokeType } from "@/lib/types/type-chart";
import { GEN3_LEGENDARIES } from "@/data/legendaries";

/**
 * Kandidat-shortlist — stadig ren kode, ingen AI.
 *
 * Vi prøver hver mulig udskiftning af (medlem, kandidat) og måler hvor
 * meget holdets score flytter sig. Resultatet er navngivne forslag med
 * konkrete, allerede-beregnede begrundelser. AI-laget skal formulere
 * dem i prosa — ikke finde på dem.
 */

export interface Candidate {
  name: string;
  id: number;
  types: string[];
  baseStatTotal: number;
  spriteUrl?: string | null;
}

export interface ShortlistOptions {
  /** Frasortér uudviklede/svage Pokémon. */
  minBaseStatTotal?: number;
  /** Tag legendaries med i poolen. */
  allowLegendaries?: boolean;
  /** Hvor mange forslag der returneres. */
  limit?: number;
  /** Mindste scoreforbedring før et forslag tages med. */
  minImprovement?: number;
}

export interface SwapReasons {
  /** Kritiske trusler der forsvinder ved udskiftningen. */
  resolvedThreats: PokeType[];
  /** Nye kritiske trusler udskiftningen skaber. */
  introducedThreats: PokeType[];
  /** Typer holdet ikke længere står helt uden resistens mod. */
  newlyResisted: PokeType[];
  /** Typer holdet mister sin eneste resistens mod. */
  lostResistances: PokeType[];
  /** Offensive huller der lukkes. */
  closedCoverageGaps: PokeType[];
  /** Offensive huller der åbnes. */
  openedCoverageGaps: PokeType[];
}

export interface SwapSuggestion {
  /** Navnet på det medlem der foreslås udskiftet. */
  replace: string;
  /** Kandidaten der foreslås ind. */
  with: Candidate;
  /** Scoreforbedring. Positiv = bedre hold. */
  improvement: number;
  scoreBefore: ScoreBreakdown;
  scoreAfter: ScoreBreakdown;
  reasons: SwapReasons;
}

export interface AdditionSuggestion {
  with: Candidate;
  improvement: number;
  scoreAfter: ScoreBreakdown;
  reasons: SwapReasons;
}

export interface Shortlist {
  poolSize: number;
  consideredCandidates: number;
  scoreBefore: ScoreBreakdown;
  analysisBefore: TeamAnalysis;
  swaps: SwapSuggestion[];
  additions: AdditionSuggestion[];
  /** Fx "holdet er fuldt, kun udskiftninger foreslås". */
  notes: string[];
}

/* ------------------------------------------------------------------ */

function criticalSet(analysis: TeamAnalysis): Set<PokeType> {
  return new Set(analysis.defensive.criticalThreats.map((t) => t.type));
}

function unresistedSet(analysis: TeamAnalysis): Set<PokeType> {
  return new Set(analysis.defensive.unresisted);
}

function gapSet(analysis: TeamAnalysis): Set<PokeType> {
  return new Set(analysis.offensive.coverageGaps);
}

function diff(before: Set<PokeType>, after: Set<PokeType>) {
  const gone: PokeType[] = [];
  const added: PokeType[] = [];
  for (const t of before) if (!after.has(t)) gone.push(t);
  for (const t of after) if (!before.has(t)) added.push(t);
  return { gone, added };
}

function compareReasons(
  before: TeamAnalysis,
  after: TeamAnalysis,
): SwapReasons {
  const threats = diff(criticalSet(before), criticalSet(after));
  const unresisted = diff(unresistedSet(before), unresistedSet(after));
  const gaps = diff(gapSet(before), gapSet(after));

  return {
    resolvedThreats: threats.gone,
    introducedThreats: threats.added,
    newlyResisted: unresisted.gone,
    lostResistances: unresisted.added,
    closedCoverageGaps: gaps.gone,
    openedCoverageGaps: gaps.added,
  };
}

function toMember(c: Candidate): TeamMemberInput {
  return { name: c.name, types: c.types };
}

/* ------------------------------------------------------------------ */

export function buildShortlist(
  team: readonly TeamMemberInput[],
  pool: readonly Candidate[],
  options: ShortlistOptions = {},
): Shortlist {
  const {
    minBaseStatTotal = 400,
    allowLegendaries = false,
    limit = 5,
    minImprovement = 0.5,
  } = options;

  const notes: string[] = [];
  const onTeam = new Set(team.map((m) => m.name.toLowerCase()));

  const candidates = pool.filter((c) => {
    if (onTeam.has(c.name.toLowerCase())) return false;
    if (c.baseStatTotal < minBaseStatTotal) return false;
    if (!allowLegendaries && GEN3_LEGENDARIES.has(c.name.toLowerCase()))
      return false;
    return true;
  });

  if (candidates.length === 0) {
    notes.push(
      `Ingen kandidater tilbage efter filtrering (BST ≥ ${minBaseStatTotal}${allowLegendaries ? "" : ", uden legendaries"}).`,
    );
  }

  const analysisBefore = analyseTeam(team);
  const scoreBefore = scoreTeam(analysisBefore);

  /* ---- udskiftninger ---- */

  const swaps: SwapSuggestion[] = [];

  for (let i = 0; i < team.length; i++) {
    for (const candidate of candidates) {
      const hypothetical = team.map((m, j) =>
        j === i ? toMember(candidate) : m,
      );
      const analysisAfter = analyseTeam(hypothetical);
      const scoreAfter = scoreTeam(analysisAfter);
      const improvement = Number(
        (scoreAfter.total - scoreBefore.total).toFixed(3),
      );
      if (improvement < minImprovement) continue;

      swaps.push({
        replace: team[i].name,
        with: candidate,
        improvement,
        scoreBefore,
        scoreAfter,
        reasons: compareReasons(analysisBefore, analysisAfter),
      });
    }
  }

  swaps.sort(
    (a, b) =>
      b.improvement - a.improvement ||
      b.with.baseStatTotal - a.with.baseStatTotal,
  );

  // Højst ét forslag pr. medlem der skal ud — ellers fylder den samme
  // svage plads hele listen.
  const seenSlots = new Set<string>();
  const topSwaps: SwapSuggestion[] = [];
  for (const s of swaps) {
    if (seenSlots.has(s.replace)) continue;
    seenSlots.add(s.replace);
    topSwaps.push(s);
    if (topSwaps.length >= limit) break;
  }

  /* ---- tilføjelser (hvis holdet ikke er fuldt) ---- */

  const additions: AdditionSuggestion[] = [];

  if (team.length < 6) {
    const scored = candidates.map((candidate) => {
      const analysisAfter = analyseTeam([...team, toMember(candidate)]);
      const scoreAfter = scoreTeam(analysisAfter);
      return {
        with: candidate,
        improvement: Number((scoreAfter.total - scoreBefore.total).toFixed(3)),
        scoreAfter,
        reasons: compareReasons(analysisBefore, analysisAfter),
      };
    });

    scored.sort(
      (a, b) =>
        b.improvement - a.improvement ||
        b.with.baseStatTotal - a.with.baseStatTotal,
    );
    additions.push(...scored.slice(0, limit));
  } else {
    notes.push("Holdet er fuldt (6) — kun udskiftninger foreslås.");
  }

  if (team.length > 0 && topSwaps.length === 0 && candidates.length > 0) {
    notes.push(
      `Ingen udskiftning forbedrer holdet med mindst ${minImprovement} point — holdet er allerede rimeligt afbalanceret.`,
    );
  }

  return {
    poolSize: pool.length,
    consideredCandidates: candidates.length,
    scoreBefore,
    analysisBefore,
    swaps: topSwaps,
    additions,
    notes,
  };
}
