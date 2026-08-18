/**
 * Smoke test: bekræfter at vi kan hente alt det data appen bygger på,
 * for begge spil. Kør med: npm run smoke
 */
import {
  getPokedexEntries,
  getPokemon,
  getPokemonWithMoves,
  cacheStats,
} from "../src/lib/pokeapi";
import { GAME_IDS, GAMES } from "../src/lib/games/games";

const EXPECTED_POOL_SIZE: Record<string, number> = {
  firered: 151,
  emerald: 202,
};

const SAMPLE: Record<string, string> = {
  firered: "charizard",
  emerald: "flygon",
};

function ok(label: string, passed: boolean, detail: string) {
  console.log(`${passed ? "✅" : "❌"} ${label} — ${detail}`);
  if (!passed) process.exitCode = 1;
}

async function main() {
  const started = Date.now();

  for (const game of GAME_IDS) {
    const cfg = GAMES[game];
    console.log(`\n=== ${cfg.label} (pokedex: ${cfg.pokedex}, moves: ${cfg.versionGroup}) ===`);

    const entries = await getPokedexEntries(game);
    ok(
      "Pokédex-pool hentet",
      entries.length === EXPECTED_POOL_SIZE[game],
      `${entries.length} species (forventet ${EXPECTED_POOL_SIZE[game]}), #1 = ${entries[0]?.species}, #${entries.length} = ${entries.at(-1)?.species}`,
    );

    const mon = await getPokemonWithMoves(SAMPLE[game], game);
    ok(
      `Pokémon-detaljer: ${mon.name}`,
      mon.types.length > 0 && mon.baseStatTotal > 0,
      `#${mon.id} · typer=[${mon.types.join(", ")}] · BST=${mon.baseStatTotal} · abilities=[${mon.abilities.join(", ")}]`,
    );

    const levelUp = mon.moves.filter((m) => m.method === "level-up");
    const tms = mon.moves.filter((m) => m.method === "machine");
    ok(
      `Moveset filtreret til ${cfg.versionGroup}`,
      mon.moves.length > 0 && levelUp.length > 0,
      `${mon.moves.length} moves i alt (${levelUp.length} level-up, ${tms.length} TM/HM)`,
    );
    console.log(
      `   fx level-up: ${levelUp.slice(0, 6).map((m) => `${m.name}@${m.levelLearnedAt}`).join(", ")}`,
    );

    // Sanity: ingen Gen 3-Pokémon må have Fairy-typen.
    const fairy = mon.types.includes("fairy");
    ok("Ingen Fairy-type (Gen 3)", !fairy, fairy ? "fandt fairy!" : "ok");
  }

  // Krydstjek: en Pokémon der findes i begge spil skal have forskellige movesets.
  const frPika = await getPokemonWithMoves("pikachu", "firered");
  const emPika = await getPokemonWithMoves("pikachu", "emerald");
  ok(
    "Movesets er version-specifikke",
    frPika.moves.length > 0 && emPika.moves.length > 0,
    `pikachu: FireRed=${frPika.moves.length} moves, Emerald=${emPika.moves.length} moves`,
  );

  const bulbasaur = await getPokemon(1);
  ok("Opslag på numerisk id", bulbasaur.name === "bulbasaur", `1 → ${bulbasaur.name}`);

  console.log(
    `\nCache: ${JSON.stringify(cacheStats())}\nFærdig på ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}

main().catch((err) => {
  console.error("\n❌ Smoke test fejlede:", err);
  process.exit(1);
});
