# Pokémon AI Team Builder

Byg et hold på op til 6 Pokémon til **FireRed** eller **Emerald**, og få en
AI-coachet analyse der ender i konkrete, navngivne erstatningsforslag.

## Arkitektur-princip (gælder hele projektet)

> Al type-matematik — weaknesses, resistances, coverage, synergy — beregnes i
> almindelig TypeScript ud fra en statisk Gen 3-type-tabel. **Aldrig af AI'en.**
> AI-laget modtager kun færdigberegnede tal plus en kort shortlist af
> kandidat-Pokémon, og formulerer det som naturligt sprog og strategi.

## Stack

| Lag | Valg |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Pokémon-data | PokéAPI, live med to-lags cache (memory + disk) |
| Pool pr. spil | `/pokedex/kanto` (FireRed), `/pokedex/hoenn` (Emerald) |
| Movesets | version-group `firered-leafgreen` / `emerald` |
| Type-tabel | lokal JSON, Gen 3-korrekt — ingen Fairy, Steel resisterer Ghost/Dark |
| AI | Anthropic API via serverless route handler, nøgle kun server-side |

## Kom i gang

```bash
npm install
npm run dev      # http://localhost:3000
npm run smoke    # verificerer PokéAPI-datalaget for begge spil
npm run verify:types       # 332 tjek af Gen 3-type-tabellen og team-matematikken
npm run verify:candidates  # 20 tjek af shortlist-logikken
npm run build
```

## Endpoints

`GET /api/health` — pool-størrelser, et konkret Pokémon-opslag og movesets
pr. spil. Bekræfter at datalaget virker i et deploy.

`GET /api/suggest?game=emerald&team=swellow,manectric,gardevoir` — den
færdigberegnede analyse: kritiske trusler, uresisterede typer, offensive
huller, og en rangeret shortlist af navngivne udskiftninger med
begrundelser. Ingen AI involveret — dette er sandheden AI-laget senere
skal formulere.

Parametre: `limit` (1-10), `minBst` (0-700, default 400), `legendaries=true`.

## Miljøvariabler

Kopiér `.env.example` til `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Nøglen læses **kun** i server-side route handlers under `src/app/api/`.
Den må aldrig præfikses med `NEXT_PUBLIC_` og aldrig importeres i en
client component. På Vercel sættes den som Environment Variable.

## Struktur

```
src/
  app/
    api/health/route.ts   # datalags-healthcheck (JSON)
    api/suggest/route.ts  # analyse + shortlist (ren kode, ingen AI)
    page.tsx              # status-side: pools + sample pr. spil
  data/
    type-chart.gen3.json  # 17 typer, ingen Fairy, Gen 3-interaktioner
    legendaries.ts        # frasorteres fra shortlisten som standard
  lib/
    analysis/
      team.ts             # team-matematik: trusler, coverage, huller
      score.ts            # én score pr. hold, så hold kan sammenlignes
      candidates.ts       # rangerede udskiftninger med begrundelser
    types/type-chart.ts   # effectiveness + defensive profiler
    games/games.ts        # FireRed/Emerald → pokedex + version-group
    pokeapi/
      client.ts           # fetch m. retry + concurrency-limiter
      cache.ts            # memory + disk cache (30 dages TTL)
      types.ts            # PokéAPI-typer + app-interne former
      index.ts            # pools, Pokémon, version-filtrerede movesets
scripts/
  smoke-pokeapi.ts        # end-to-end datatjek
  verify-type-chart.ts    # tjekker type-tabellen mod kendte Gen 3-facts
  verify-candidates.ts    # tjekker shortlist-logikken uden netværk
```

## Roadmap

- [x] Scaffold + PokéAPI-datalag med cache
- [x] Gen 3-type-tabel som lokal JSON (ingen Fairy, gammel Dark/Ghost/Steel)
- [x] Team-analyse i ren kode: defensiv dækning, offensiv coverage, huller
- [x] Kandidat-shortlist ud fra beregnede huller + spillets pool
- [ ] `/api/analyze`: Anthropic-kald der formulerer analysen
- [ ] Team-builder UI
