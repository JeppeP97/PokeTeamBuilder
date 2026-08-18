import { NextResponse } from "next/server";
import { getPokedexEntries, getPokemonWithMoves, cacheStats } from "@/lib/pokeapi";
import { GAME_IDS, GAMES } from "@/lib/games/games";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE = { firered: "charizard", emerald: "flygon" } as const;

/**
 * GET /api/health
 * Bekræfter at PokéAPI-datalaget virker: pool-størrelser pr. spil +
 * et konkret opslag med typer, stats og version-specifikt moveset.
 */
export async function GET() {
  const startedAt = Date.now();

  const games = await Promise.all(
    GAME_IDS.map(async (game) => {
      try {
        const [entries, sample] = await Promise.all([
          getPokedexEntries(game),
          getPokemonWithMoves(SAMPLE[game], game),
        ]);

        return {
          game,
          label: GAMES[game].label,
          pokedex: GAMES[game].pokedex,
          versionGroup: GAMES[game].versionGroup,
          ok: true as const,
          poolSize: entries.length,
          firstEntry: entries[0]?.species ?? null,
          lastEntry: entries.at(-1)?.species ?? null,
          sample: {
            name: sample.name,
            id: sample.id,
            types: sample.types,
            baseStats: sample.baseStats,
            baseStatTotal: sample.baseStatTotal,
            abilities: sample.abilities,
            moveCount: sample.moves.length,
            levelUpMoveCount: sample.moves.filter((m) => m.method === "level-up")
              .length,
            firstMoves: sample.moves.slice(0, 5).map((m) => m.name),
          },
        };
      } catch (error) {
        return {
          game,
          label: GAMES[game].label,
          pokedex: GAMES[game].pokedex,
          versionGroup: GAMES[game].versionGroup,
          ok: false as const,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const allOk = games.every((g) => g.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      source: "pokeapi.co/api/v2",
      elapsedMs: Date.now() - startedAt,
      cache: cacheStats(),
      games,
    },
    { status: allOk ? 200 : 503 },
  );
}
