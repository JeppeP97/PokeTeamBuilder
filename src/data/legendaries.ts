/**
 * Legendaries og mythicals i Gen 3's to relevante pokédexer (Kanto + Hoenn).
 * Filtreres fra som standard: de er sjældne, ofte umulige at bruge i en
 * normal gennemspilning, og ville ellers dominere enhver shortlist.
 */
export const GEN3_LEGENDARIES: ReadonlySet<string> = new Set([
  // Kanto
  "articuno",
  "zapdos",
  "moltres",
  "mewtwo",
  "mew",
  // Hoenn
  "regirock",
  "regice",
  "registeel",
  "latias",
  "latios",
  "kyogre",
  "groudon",
  "rayquaza",
  "jirachi",
  "deoxys",
]);
