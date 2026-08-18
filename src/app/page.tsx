import { getPokedexEntries, getPokemonWithMoves, PokeApiError } from "@/lib/pokeapi";
import { GAME_IDS, GAMES, type GameId } from "@/lib/games/games";

export const dynamic = "force-dynamic";

const SAMPLE: Record<GameId, string> = {
  firered: "charizard",
  emerald: "flygon",
};

const TYPE_COLORS: Record<string, string> = {
  normal: "bg-stone-400", fire: "bg-orange-500", water: "bg-blue-500",
  electric: "bg-yellow-400", grass: "bg-green-500", ice: "bg-cyan-300",
  fighting: "bg-red-700", poison: "bg-purple-500", ground: "bg-amber-600",
  flying: "bg-indigo-300", psychic: "bg-pink-500", bug: "bg-lime-500",
  rock: "bg-yellow-700", ghost: "bg-violet-700", dragon: "bg-indigo-600",
  dark: "bg-neutral-700", steel: "bg-slate-400",
};

async function loadGame(game: GameId) {
  try {
    const [entries, sample] = await Promise.all([
      getPokedexEntries(game),
      getPokemonWithMoves(SAMPLE[game], game),
    ]);
    return { ok: true as const, entries, sample };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof PokeApiError
          ? `${error.message}`
          : error instanceof Error
            ? error.message
            : String(error),
    };
  }
}

export default async function Home() {
  const results = await Promise.all(
    GAME_IDS.map(async (game) => [game, await loadGame(game)] as const),
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Gen 3 · FireRed &amp; Emerald
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          Pokémon AI Team Builder
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Trin 1: datalaget. Siden herunder henter live fra PokéAPI og
          bekræfter at pools, stats og version-specifikke movesets kan hentes
          for begge spil.{" "}
          <a className="underline underline-offset-4" href="/api/health">
            /api/health
          </a>{" "}
          giver samme tjek som JSON.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {results.map(([game, result]) => {
          const cfg = GAMES[game];
          return (
            <section
              key={game}
              className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">{cfg.label}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    result.ok
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  }`}
                >
                  {result.ok ? "PokéAPI ok" : "fejl"}
                </span>
              </div>

              <dl className="mt-2 text-xs text-neutral-500">
                <div className="flex gap-2">
                  <dt>pokédex:</dt>
                  <dd className="font-mono">{cfg.pokedex}</dd>
                  <dt>· version-group:</dt>
                  <dd className="font-mono">{cfg.versionGroup}</dd>
                </div>
              </dl>

              {!result.ok ? (
                <p className="mt-4 rounded-lg bg-red-50 p-3 font-mono text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {result.message}
                </p>
              ) : (
                <>
                  <p className="mt-4 text-sm">
                    <strong>{result.entries.length}</strong> Pokémon i poolen (
                    {result.entries[0]?.species} → {result.entries.at(-1)?.species})
                  </p>

                  <div className="mt-4 flex items-center gap-4 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                    {result.sample.spriteUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.sample.spriteUrl}
                        alt={result.sample.name}
                        width={64}
                        height={64}
                        className="[image-rendering:pixelated]"
                      />
                    ) : null}
                    <div>
                      <p className="font-medium capitalize">
                        {result.sample.name}{" "}
                        <span className="text-neutral-400">
                          #{result.sample.id}
                        </span>
                      </p>
                      <div className="mt-1 flex gap-1">
                        {result.sample.types.map((t) => (
                          <span
                            key={t}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white ${
                              TYPE_COLORS[t] ?? "bg-neutral-500"
                            }`}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        BST {result.sample.baseStatTotal} ·{" "}
                        {result.sample.moves.length} moves i {cfg.versionGroup}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-xs text-neutral-500">
        Næste trin: Gen 3-korrekt type-tabel (ingen Fairy) som lokal JSON, og
        al type-matematik i almindelig kode — AI-laget formulerer kun
        resultaterne.
      </p>
    </main>
  );
}
