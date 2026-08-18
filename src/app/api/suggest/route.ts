import { NextResponse } from "next/server";
import { getPokemon, getPokemonPool, PokeApiError } from "@/lib/pokeapi";
import { isGameId, GAMES, type GameId } from "@/lib/games/games";
import { buildShortlist, type Candidate } from "@/lib/analysis/candidates";
import type { TeamMemberInput } from "@/lib/analysis/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Første kald varmer cachen med hele poolen (151-202 opslag).
export const maxDuration = 60;

/**
 * GET /api/suggest?game=emerald&team=swellow,manectric,gardevoir
 *
 * Returnerer den FÆRDIGBEREGNEDE analyse og shortlist. Der er bevidst
 * ingen AI her: dette endpoint er sandheden, som AI-laget senere blot
 * skal formulere i prosa.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const gameParam = (url.searchParams.get("game") ?? "emerald").toLowerCase();
  const teamParam = url.searchParams.get("team") ?? "";
  const limit = clampInt(url.searchParams.get("limit"), 3, 1, 10);
  const minBaseStatTotal = clampInt(
    url.searchParams.get("minBst"),
    400,
    0,
    700,
  );
  const allowLegendaries = url.searchParams.get("legendaries") === "true";

  if (!isGameId(gameParam)) {
    return NextResponse.json(
      {
        error: `Ukendt spil "${gameParam}". Gyldige værdier: firered, emerald.`,
      },
      { status: 400 },
    );
  }
  const game: GameId = gameParam;

  const names = teamParam
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);

  if (names.length === 0) {
    return NextResponse.json(
      { error: "Angiv mindst én Pokémon, fx ?team=swellow,manectric" },
      { status: 400 },
    );
  }
  if (names.length > 6) {
    return NextResponse.json(
      { error: `Et hold kan højst have 6 Pokémon (fik ${names.length}).` },
      { status: 400 },
    );
  }

  const startedAt = Date.now();

  try {
    const resolved = await Promise.all(
      names.map(async (name) => {
        try {
          const mon = await getPokemon(name);
          return { ok: true as const, mon };
        } catch (err) {
          if (err instanceof PokeApiError && err.status === 404) {
            return { ok: false as const, name };
          }
          throw err;
        }
      }),
    );

    const unknown = resolved.filter((r) => !r.ok).map((r) => r.name);
    if (unknown.length > 0) {
      return NextResponse.json(
        { error: `Kender ikke disse Pokémon: ${unknown.join(", ")}` },
        { status: 404 },
      );
    }

    const pool = await getPokemonPool(game);
    const poolNames = new Set(pool.map((p) => p.name));

    const team: TeamMemberInput[] = [];
    const outOfDex: string[] = [];
    for (const r of resolved) {
      if (!r.ok) continue;
      if (!poolNames.has(r.mon.name)) outOfDex.push(r.mon.name);
      team.push({ name: r.mon.name, types: r.mon.types });
    }

    const candidates: Candidate[] = pool.map((p) => ({
      name: p.name,
      id: p.id,
      types: p.types,
      baseStatTotal: p.baseStatTotal,
      spriteUrl: p.spriteUrl,
    }));

    const shortlist = buildShortlist(team, candidates, {
      limit,
      minBaseStatTotal,
      allowLegendaries,
    });

    if (outOfDex.length > 0) {
      shortlist.notes.push(
        `Uden for ${GAMES[game].label}s pokédex: ${outOfDex.join(", ")}. De analyseres med, men kan ikke fanges i spillet.`,
      );
    }

    return NextResponse.json({
      game,
      label: GAMES[game].label,
      elapsedMs: Date.now() - startedAt,
      team: shortlist.analysisBefore.members,
      score: shortlist.scoreBefore,
      criticalThreats: shortlist.analysisBefore.defensive.criticalThreats,
      unresisted: shortlist.analysisBefore.defensive.unresisted,
      coverageGaps: shortlist.analysisBefore.offensive.coverageGaps,
      poolSize: shortlist.poolSize,
      consideredCandidates: shortlist.consideredCandidates,
      swaps: shortlist.swaps,
      additions: shortlist.additions,
      notes: [...shortlist.notes, ...shortlist.analysisBefore.warnings],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Ukendt fejl i /api/suggest",
      },
      { status: 502 },
    );
  }
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
