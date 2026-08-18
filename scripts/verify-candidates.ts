/**
 * Verificerer shortlist-logikken uden netværk: en lille pool af rigtige
 * Gen 3-Pokémon med deres faktiske typer og base stat totals.
 * Kør med: npm run verify:candidates
 */
import { buildShortlist, type Candidate } from "../src/lib/analysis/candidates";
import { analyseTeam } from "../src/lib/analysis/team";
import { scoreTeam } from "../src/lib/analysis/score";

let failures = 0;
let checks = 0;

function assert(label: string, condition: boolean, detail = "") {
  checks++;
  if (!condition) {
    failures++;
    console.log(`❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function check(label: string, actual: unknown, expected: unknown) {
  checks++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`❌ ${label}\n     fik ${a}, forventede ${e}`);
  }
}

// Rigtige Gen 3-værdier.
const POOL: Candidate[] = [
  { name: "swampert", id: 260, types: ["water", "ground"], baseStatTotal: 535 },
  { name: "flygon", id: 330, types: ["ground", "dragon"], baseStatTotal: 520 },
  { name: "metagross", id: 376, types: ["steel", "psychic"], baseStatTotal: 600 },
  { name: "aggron", id: 306, types: ["steel", "rock"], baseStatTotal: 530 },
  { name: "skarmory", id: 227, types: ["steel", "flying"], baseStatTotal: 465 },
  { name: "gardevoir", id: 282, types: ["psychic"], baseStatTotal: 518 },
  { name: "milotic", id: 350, types: ["water"], baseStatTotal: 540 },
  { name: "breloom", id: 286, types: ["grass", "fighting"], baseStatTotal: 460 },
  { name: "camerupt", id: 323, types: ["fire", "ground"], baseStatTotal: 460 },
  { name: "claydol", id: 344, types: ["ground", "psychic"], baseStatTotal: 500 },
  { name: "manectric", id: 310, types: ["electric"], baseStatTotal: 475 },
  { name: "swellow", id: 277, types: ["normal", "flying"], baseStatTotal: 430 },
  // Skal filtreres fra:
  { name: "magikarp", id: 129, types: ["water"], baseStatTotal: 200 },
  { name: "sableye", id: 302, types: ["dark", "ghost"], baseStatTotal: 380 },
  { name: "rayquaza", id: 384, types: ["dragon", "flying"], baseStatTotal: 680 },
];

/* ---------------------------------------------------------------- */
console.log("\n— Filtrering af poolen —");

const flyingTeam = [
  { name: "charizard", types: ["fire", "flying"] },
  { name: "pidgeot", types: ["normal", "flying"] },
  { name: "gyarados", types: ["water", "flying"] },
  { name: "manectric", types: ["electric"] },
];

const list = buildShortlist(flyingTeam, POOL);

check("poolstørrelse rapporteres", list.poolSize, POOL.length);
assert(
  "magikarp filtreret fra (BST 200)",
  !list.swaps.some((s) => s.with.name === "magikarp") &&
    !list.additions.some((a) => a.with.name === "magikarp"),
);
assert(
  "sableye filtreret fra (BST 380 < 400)",
  !list.additions.some((a) => a.with.name === "sableye"),
);
assert(
  "rayquaza filtreret fra (legendary)",
  !list.additions.some((a) => a.with.name === "rayquaza"),
);
assert(
  "manectric er allerede på holdet og foreslås ikke",
  !list.additions.some((a) => a.with.name === "manectric"),
);
check("kandidater efter filtrering", list.consideredCandidates, 11);

const withLegends = buildShortlist(flyingTeam, POOL, { allowLegendaries: true });
assert(
  "legendaries kan slås til",
  withLegends.consideredCandidates === 12,
  `fik ${withLegends.consideredCandidates}`,
);

/* ---------------------------------------------------------------- */
console.log("— Forslagene giver mening —");

assert("der findes mindst ét udskiftningsforslag", list.swaps.length > 0);

const top = list.swaps[0];
console.log(
  `   top: erstat ${top.replace} med ${top.with.name} (+${top.improvement})`,
);
console.log(
  `        løser: ${top.reasons.resolvedThreats.join(", ") || "—"} | nye trusler: ${top.reasons.introducedThreats.join(", ") || "—"}`,
);
console.log(
  `        nu resisteret: ${top.reasons.newlyResisted.join(", ") || "—"} | lukkede huller: ${top.reasons.closedCoverageGaps.join(", ") || "—"}`,
);

assert("topforslaget forbedrer holdet", top.improvement > 0);
assert(
  "topforslaget skaber ikke flere trusler end det løser",
  top.reasons.introducedThreats.length <= top.reasons.resolvedThreats.length,
  `løser ${top.reasons.resolvedThreats.length}, skaber ${top.reasons.introducedThreats.length}`,
);

// Holdet har tre flyvere: rock og electric er de åbenlyse problemer.
const before = analyseTeam(flyingTeam);
assert(
  "rock er en kritisk trussel før udskiftning",
  before.defensive.criticalThreats.some((t) => t.type === "rock"),
);
assert(
  "topforslaget rører ved rock eller electric",
  top.reasons.resolvedThreats.includes("rock") ||
    top.reasons.newlyResisted.includes("rock") ||
    top.reasons.newlyResisted.includes("electric"),
  JSON.stringify(top.reasons),
);

assert(
  "højst ét forslag pr. plads på holdet",
  new Set(list.swaps.map((s) => s.replace)).size === list.swaps.length,
);
assert("forslag er sorteret faldende", 
  list.swaps.every((s, i, arr) => i === 0 || arr[i - 1].improvement >= s.improvement),
);

/* ---------------------------------------------------------------- */
console.log("— Tilføjelser vs. fuldt hold —");

const fullTeam = [
  ...flyingTeam,
  { name: "sceptile", types: ["grass"] },
  { name: "aggron", types: ["steel", "rock"] },
];
const fullList = buildShortlist(fullTeam, POOL);
check("fuldt hold giver ingen tilføjelser", fullList.additions.length, 0);
assert(
  "fuldt hold noteres",
  fullList.notes.some((n) => n.includes("fuldt")),
  JSON.stringify(fullList.notes),
);

const partial = buildShortlist(flyingTeam.slice(0, 2), POOL);
assert("delvist hold giver tilføjelser", partial.additions.length > 0);

/* ---------------------------------------------------------------- */
console.log("— Determinisme og scoring —");

const again = buildShortlist(flyingTeam, POOL);
check(
  "samme input giver samme output",
  again.swaps.map((s) => [s.replace, s.with.name, s.improvement]),
  list.swaps.map((s) => [s.replace, s.with.name, s.improvement]),
);

const balanced = analyseTeam([
  { name: "swampert", types: ["water", "ground"] },
  { name: "skarmory", types: ["steel", "flying"] },
  { name: "gardevoir", types: ["psychic"] },
  { name: "breloom", types: ["grass", "fighting"] },
]);
assert(
  "et afbalanceret hold scorer højere end tre flyvere",
  scoreTeam(balanced).total > scoreTeam(before).total,
  `${scoreTeam(balanced).total} vs ${scoreTeam(before).total}`,
);

check("tomt hold giver score 0 defensivt", scoreTeam(analyseTeam([])).defensive, 0);

/* ---------------------------------------------------------------- */
console.log(
  `\n${failures === 0 ? "✅" : "❌"} ${checks - failures}/${checks} tjek bestået`,
);
if (failures > 0) process.exit(1);
