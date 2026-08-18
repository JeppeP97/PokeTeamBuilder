import { TYPES } from "@/lib/types/type-chart";
import type { TeamAnalysis } from "./team";

/**
 * Én talværdi for hvor sundt et hold er, så to hold kan sammenlignes.
 *
 * Vægtene er bevidst eksplicitte og dokumenterede — de er et designvalg,
 * ikke en naturlov, og AI-laget skal aldrig justere dem.
 */
export const WEIGHTS = {
  /** Pr. medlem der resisterer en type (tælles højst 2 gange pr. type). */
  resist: 1,
  /** Pr. medlem der er immun. Immunitet er stærkere end resistens. */
  immune: 1.5,
  /** Pr. medlem der er svagt. */
  weak: -1,
  /** Ekstra straf oveni for 4x-svagheder. */
  doubleWeak: -1.5,
  /** Ekstra straf hvis mindst 2 er svage og ingen resisterer: et reelt hul. */
  criticalHole: -3,
  /** Pr. type holdet kan ramme for mindst 2x. */
  coverage: 0.75,
  /** Straf hvis holdet er helt ensidigt physical eller special. */
  lopsidedOffense: -2,
} as const;

export interface ScoreBreakdown {
  total: number;
  defensive: number;
  offensive: number;
  criticalHoles: number;
  coveredTypes: number;
}

/** Højere = bedre hold. Skalaen er relativ; kun forskelle betyder noget. */
export function scoreTeam(analysis: TeamAnalysis): ScoreBreakdown {
  let defensive = 0;
  let criticalHoles = 0;

  for (const row of analysis.defensive.rows) {
    // Kun de to første resistenser tæller — tre Water-resists slår ikke
    // et hul mod Rock ihjel.
    defensive += Math.min(row.resistCount, 2) * WEIGHTS.resist;
    defensive += row.immuneCount * WEIGHTS.immune;
    defensive += row.weakCount * WEIGHTS.weak;
    defensive += row.doubleWeakCount * WEIGHTS.doubleWeak;

    if (row.weakCount >= 2 && row.resistCount === 0 && row.immuneCount === 0) {
      defensive += WEIGHTS.criticalHole;
      criticalHoles += 1;
    }
  }

  let offensive = analysis.offensive.coveredCount * WEIGHTS.coverage;
  const { physical, special } = analysis.offensive.damageClassSplit;
  if (physical === 0 || special === 0) offensive += WEIGHTS.lopsidedOffense;

  return {
    total: Number((defensive + offensive).toFixed(3)),
    defensive: Number(defensive.toFixed(3)),
    offensive: Number(offensive.toFixed(3)),
    criticalHoles,
    coveredTypes: analysis.offensive.coveredCount,
  };
}

/** Antal typer i spillet — bruges til at normalisere i UI'et. */
export const TYPE_COUNT = TYPES.length;
