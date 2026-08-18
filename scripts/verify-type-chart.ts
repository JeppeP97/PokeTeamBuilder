/**
 * Verificerer Gen 3-type-tabellen mod kendte facts.
 * Kør med: npm run verify:types
 *
 * Pointen: type-matematikken er fundamentet for hele coaching-analysen.
 * Er tabellen forkert, er alt AI'en siger forkert — men på en måde der
 * lyder overbevisende. Derfor testes den eksplicit.
 */
import {
  TYPES,
  type PokeType,
  damageClassOf,
  defensiveProfile,
  effectiveness,
  singleEffectiveness,
} from "../src/lib/types/type-chart";
import { analyseTeam } from "../src/lib/analysis/team";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`❌ ${label}\n     fik ${a}, forventede ${e}`);
  }
}

function assert(label: string, condition: boolean, detail = "") {
  checks++;
  if (!condition) {
    failures++;
    console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ---------------------------------------------------------------- */
console.log("\n— Struktur —");

check("17 typer", TYPES.length, 17);
assert("ingen Fairy", !(TYPES as readonly string[]).includes("fairy"));

const legalValues = new Set([0, 0.5, 1, 2]);
for (const a of TYPES) {
  for (const d of TYPES) {
    const v = singleEffectiveness(a, d);
    assert(
      `lovlig værdi ${a}→${d}`,
      legalValues.has(v),
      `fik ${v}`,
    );
  }
}

check(
  "physical/special-fordeling (Gen 3: bestemt af typen)",
  {
    physical: TYPES.filter((t) => damageClassOf(t) === "physical").length,
    special: TYPES.filter((t) => damageClassOf(t) === "special").length,
  },
  { physical: 9, special: 8 },
);

/* ---------------------------------------------------------------- */
console.log("— Gen 3-specifikke interaktioner —");

// Disse to blev ændret i Gen 6. Får vi dem forkert, er tabellen moderne.
check("ghost → steel = 0.5 (Gen 3)", singleEffectiveness("ghost", "steel"), 0.5);
check("dark → steel = 0.5 (Gen 3)", singleEffectiveness("dark", "steel"), 0.5);

// Gen 1-fejl der blev rettet i Gen 2 og altså IKKE gælder i Gen 3.
check("bug → poison = 0.5 (rettet i Gen 2)", singleEffectiveness("bug", "poison"), 0.5);
check("poison → bug = 1 (ikke Gen 1)", singleEffectiveness("poison", "bug"), 1);
check("ghost → psychic = 2 (ikke Gen 1)", singleEffectiveness("ghost", "psychic"), 2);
check("ice → fire = 0.5", singleEffectiveness("ice", "fire"), 0.5);

/* ---------------------------------------------------------------- */
console.log("— Immuniteter —");

check("normal → ghost", singleEffectiveness("normal", "ghost"), 0);
check("fighting → ghost", singleEffectiveness("fighting", "ghost"), 0);
check("ghost → normal", singleEffectiveness("ghost", "normal"), 0);
check("ground → flying", singleEffectiveness("ground", "flying"), 0);
check("electric → ground", singleEffectiveness("electric", "ground"), 0);
check("poison → steel", singleEffectiveness("poison", "steel"), 0);
check("psychic → dark", singleEffectiveness("psychic", "dark"), 0);

/* ---------------------------------------------------------------- */
console.log("— Dobbelt-typer (rigtige Gen 3-Pokémon) —");

const flygon: PokeType[] = ["ground", "dragon"];
check("Flygon tager 4x fra ice", effectiveness("ice", flygon), 4);
check("Flygon immun mod electric", effectiveness("electric", flygon), 0);

const charizard: PokeType[] = ["fire", "flying"];
check("Charizard tager 4x fra rock", effectiveness("rock", charizard), 4);
check("Charizard immun mod ground", effectiveness("ground", charizard), 0);

const gyarados: PokeType[] = ["water", "flying"];
check("Gyarados tager 4x fra electric", effectiveness("electric", gyarados), 4);

// Steel/Flying: electric er 0.5 × 2 = 1, ikke 2. Klassisk fejl at lave i hånden.
const skarmory: PokeType[] = ["steel", "flying"];
// Steel resisterer IKKE electric (udbredt misforståelse) — 1 x 2 = 2.
check("Skarmory tager 2x electric", effectiveness("electric", skarmory), 2);
check("Skarmory immun mod ground", effectiveness("ground", skarmory), 0);
check("Skarmory immun mod poison", effectiveness("poison", skarmory), 0);
check("Skarmory tager 2x fra fire", effectiveness("fire", skarmory), 2);

// Steel/Psychic: i Gen 6+ ville ghost og dark være 2x. I Gen 3 er de neutrale.
const metagross: PokeType[] = ["steel", "psychic"];
check("Metagross tager neutral ghost (Gen 3)", effectiveness("ghost", metagross), 1);
check("Metagross tager neutral dark (Gen 3)", effectiveness("dark", metagross), 1);
check("Metagross tager 2x fra fire", effectiveness("fire", metagross), 2);
check("Metagross tager 2x fra ground", effectiveness("ground", metagross), 2);

// Sableye (dark/ghost) har INGEN svagheder i Gen 3 — Fairy fandtes ikke endnu.
const sableye = defensiveProfile(["dark", "ghost"]);
check("Sableye har ingen svagheder i Gen 3", sableye.weaknesses, []);
check(
  "Sableye immun mod normal, fighting, psychic",
  [...sableye.immunities].sort(),
  ["fighting", "normal", "psychic"],
);

/* ---------------------------------------------------------------- */
console.log("— Team-analyse —");

// Et bevidst skævt hold: fire fire/flying-agtige svagheder mod rock/electric.
const team = analyseTeam([
  { name: "Charizard", types: ["fire", "flying"] },
  { name: "Pidgeot", types: ["normal", "flying"] },
  { name: "Gyarados", types: ["water", "flying"] },
  { name: "Manectric", types: ["electric"] },
]);

check("holdstørrelse", team.size, 4);
assert("ingen advarsler på gyldigt input", team.warnings.length === 0, JSON.stringify(team.warnings));

const electricRow = team.defensive.rows.find((r) => r.type === "electric")!;
check(
  "3 flyvere er svage mod electric",
  electricRow.weakMembers.sort(),
  ["Charizard", "Gyarados", "Pidgeot"],
);
assert(
  "electric er en kritisk trussel (Manectric resisterer den dog)",
  electricRow.resistCount === 1,
  `resistCount=${electricRow.resistCount}`,
);

const rockRow = team.defensive.rows.find((r) => r.type === "rock")!;
check("Charizard tager 4x rock", rockRow.doubleWeakCount, 1);
assert(
  "rock er kritisk: flere svage, ingen resisterer",
  team.defensive.criticalThreats.some((t) => t.type === "rock"),
);

assert(
  "holdet har offensive huller",
  team.offensive.coverageGaps.length > 0,
  `gaps=${team.offensive.coverageGaps.join(", ")}`,
);
assert(
  "coveredCount + gaps = 17",
  team.offensive.coveredCount + team.offensive.coverageGaps.length === 17,
);

/* ---------------------------------------------------------------- */
console.log("— Hele Steel-kolonnen mod PokéAPI (generation-v = samme chart som Gen 3) —");

// Kilde: PokéAPI /type/steel → past_damage_relations (generation-v).
const steel = defensiveProfile(["steel"]);
check(
  "Steel resisterer præcis disse",
  [...steel.resistances].sort(),
  [
    "bug",
    "dark",
    "dragon",
    "flying",
    "ghost",
    "grass",
    "ice",
    "normal",
    "psychic",
    "rock",
    "steel",
  ],
);
check("Steel svag mod præcis disse", [...steel.weaknesses].sort(), [
  "fighting",
  "fire",
  "ground",
]);
check("Steel immun mod poison", steel.immunities, ["poison"]);

/* ---------------------------------------------------------------- */

const unknown = analyseTeam([{ name: "Testmon", types: ["fairy"] }]);
assert(
  "fairy afvises som ukendt type",
  unknown.warnings.length === 1 && unknown.members[0].types.length === 0,
  JSON.stringify(unknown.warnings),
);

/* ---------------------------------------------------------------- */
console.log(
  `\n${failures === 0 ? "✅" : "❌"} ${checks - failures}/${checks} tjek bestået`,
);
if (failures > 0) process.exit(1);
