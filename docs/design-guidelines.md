# 2240 — Design Guidelines

*Last updated 2026-06-15. Reference document for anyone (human or agent) building the 2240.us site.*

---

## North star

2240.us is not a music artist site. It is a **living sound archive** — a personal catalogue Toby adds to for life. The visual language is **information storage and retrieval**: card catalogs, network maps, technical schematics, terminal indexes. Dense but rigorously ordered. The feeling of opening a flat-file drawer or querying a catalog terminal, not browsing a label's homepage.

**The model — Archive as Constellation.** One dataset, two dense views of the same sounds:

1. **Constellation** (default landing view) — every sound is a node in space; edges connect related sounds. The newest release is the focal anchor, pre-expanded into the waveform player.
2. **Index** (toggle) — the same entries as a sortable monospace table (accession no., title, artist, year, duration). The card-catalog view.

Both views are monochrome with a single active-release accent. They share the same underlying entry data — never let them drift out of sync.

---

## Color system

### Base palette (always present, never changes)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0a0a0a` | Page background (near-black) |
| `--fg` | `#efefef` | Primary text (bone-white) |
| `--fg-dim` | `rgba(239,239,239,0.45)` | Secondary text, metadata |
| `--fg-faint` | `rgba(239,239,239,0.18)` | Tertiary labels, inactive |
| `--rule` | `rgba(239,239,239,0.12)` | Hairlines, grid, borders |
| `--paper` | `#e8e6df` | Inverted/light surfaces (catalog cards) — use sparingly |

The base is **strictly greyscale.** No gradients except the single ambient accent glow (below). No drop shadows for depth — use hairline rules and borders instead.

### Release accent (one color at a time)

The active release contributes exactly **one** accent via `--accent`. It lights up that release's node + edges in the constellation, the active index row, and a faint radial glow behind the focal area. Nothing else gets color.

| Release | `--accent` | Character |
|---|---|---|
| tonsure | `#efefef` | Pure mono — no color, just bright white |
| washboard | `#2e6bff` | Cobalt |
| patient | `#b3122a` | Oxblood |
| statues | `#8e95c8` | Periwinkle/slate |

> **Supersedes the old theme system.** The original `themes.css` flooded the whole page with each release's background. Under these guidelines the **background stays `--bg`** for every release; only `--accent` (and a ~3% accent glow) changes. Keep `--grain-op` per release if desired, but neutralize `--bg`/`--fg` to the base values above.

### System accent (fixed, interface-state only)

| Token | Value | Use |
|---|---|---|
| `--sys` | `#f5d020` | The "NEW" flag, the playing indicator, the filter/command cursor |

The recurring board yellow. **State only, never content.** Keeps release-color and interface-state from competing.

---

## Typography

**Monospace everywhere.** Current stack: `'Courier New', Courier, monospace` (zero-dependency, keep for now).

> **Upgrade path:** self-host a sharper mono — **IBM Plex Mono** (clean terminal feel) is the recommended default; an optional **pixel display face** (e.g. Departure Mono) may be used for ornamental markers and the wordmark only, never body text.

### Scale (px)

`7 · 8 · 9 · 10 · 12 · 14`, then display titles at `clamp(28px, 5.5vw, 64px)`.

### Rules

- **UI labels / metadata:** uppercase, letter-spacing `0.2–0.32em`.
- **Titles:** sentence or title case, tight tracking `-0.02em` to `-0.03em`.
- **All numbers:** `font-variant-numeric: tabular-nums`. Always. IDs are zero-padded (`001`, `042`).
- Body and labels are dim by default (`--fg-dim`/`--fg-faint`); full `--fg` is reserved for titles and the active entry.

---

## Density & layout

The site **exposes its structure.** This is the core departure from the current minimal layout.

- **Every entry shows its full metadata:** accession no., title, artist, year, duration, category/tag. Don't hide data behind hover.
- **Structure with hairline rules** (`--rule`) — ledger lines, schematic borders, table gridlines. Borrows from the navigational charts and filing diagrams.
- **Registration marks** at page margins — corner crosshairs, tick marks, a faint coordinate grid backdrop. From the astronomical/architectural pins.
- **Monospace column rhythm:** align tabular data to character columns, not arbitrary pixels.
- Generous *structural* clarity, not generous *empty* space. Dense is the goal — but every dense element is labeled and ordered.

---

## The constellation (primary navigation)

- **Nodes = sounds.** Each node carries a visible mono label: accession no. + title. Node size may encode recency (newest largest) or duration.
- **Focal node = newest release:** pinned near center, enlarged, pre-expanded into the waveform player panel (title, artist, transport, stream links).
- **Edges = relationships,** with a visible **legend/key** (very on-brand — the index keys from the board):
  - same artist → solid hairline
  - same year → dotted
  - shared tag/mood → faint
- **Color:** all nodes/edges in greyscale; the **active or hovered node and its edges light to `--accent`.**
- **Backdrop:** faint coordinate grid. Optional **slow drift** (≤ a few px, ease-in-out, mechanical — not bouncy). Fully static under `prefers-reduced-motion`.
- **Scales with the archive:** as holdings grow, provide filter + sort (year, artist, tag) and a terminal-style text filter. Nodes may cluster by category.

### Index view (the toggle)

The same entries as a sortable table. This is also the **accessibility-first equivalent** of the constellation — keyboard users get a fully navigable list even if the spatial view is hard to traverse.

```
┌─ 2240 ──────────────────────────── INDEX ─┐
 NO.  TITLE             ARTIST       YR  DUR
 001 ▸ YOU ARE THE MAN   Tonsure      26  4:12   ● NEW
 002   WASHBOARD          Toby Brown   26  3:48
 003   THE PATIENT        Toby Brown   22   --
 004   IS IT EVEN EASIER? Toby Brown   21   --
 holdings: 4 · sort: date ▾
```

---

## Components

- **Node** — label (mono, `--fg-dim`), dot/marker, greyscale → `--accent` on focus/active. `role="button"`, keyboard-activatable.
- **Expanded release / player** — eyebrow (tag), title, artist, scrolling waveform, transport (circular play button, tabular time), stream links. Player DOM stays fixed; only metadata + audio source swap when switching entries (see existing `player.js` `loadNewAudio`).
- **Compact index row** — accession no. · title · artist · year · duration. Dim until hover/active.
- **Sampler chrome** (Plan 2) — should align to this system: mono-base + active-source `--accent`. *Open decision:* keep the LCD green as the sampler's own instrument identity, or fold it into the mono-base palette. Lean toward keeping a restrained green LCD as a deliberate instrument signifier, but everything around it follows the base.

---

## Texture

- **Grain overlay** (existing SVG `feTurbulence`) at `--grain-op` ≈ `0.5–0.6` default on dark.
- **Hairline rules + tick/registration marks** at margins.
- Optional faint **scanline or dither** on the focal/hero area only — sparingly.
- Paper texture permitted on any `--paper` light surfaces (catalog cards).

---

## Motion

- **Mechanical and minimal.** Instrument-like, not playful. No spring/bounce easing.
- Constellation drift: very slow, small amplitude, pausable, **off under reduced-motion.**
- Accent/palette transitions: `0.6–0.8s ease` (already in `base.css`).
- Node focus light-up: fast, ~`150ms`.

---

## Voice & lexicon

Use archive language over generic music terms:

| Prefer | Over |
|---|---|
| Index / Catalog | Releases page |
| Entry / Accession | Track / Item |
| Holdings: 4 | 4 releases |
| Filed 2026 | Released 2026 |
| Collection | Discography |

---

## Accessibility (non-negotiable baseline)

- Every interactive node/row keyboard-navigable; visible focus state.
- Index view is the keyboard/screen-reader equivalent of the constellation.
- `aria-label` on icon-only buttons; canvas waveform `role="img"` with descriptive alt.
- **Color is never the only signal** — pair `--accent` with a label, marker shape, or position change.
- Respect `prefers-reduced-motion`: no drift, no scanline animation.
- Streaming links open in new tab with `aria-label` naming the destination.

---

## Do / Don't

**Do:** monospace, tabular nums, zero-padded IDs, exposed metadata, hairline structure, registration marks, one surgical accent, greyscale base, mechanical motion.

**Don't:** rounded friendly cards, drop shadows for depth, gradients (except the single accent glow), multiple bright colors at once, sans-serif body text, decorative photography, hiding data behind hover.

---

## Open questions / future

- Self-hosted mono selection (recommend IBM Plex Mono; optional pixel display face for wordmark/markers only).
- Sampler LCD green: keep as instrument identity vs. fold into base palette.
- Node-size / edge-type encodings as the catalogue grows past a handful of entries.
- Whether `themes.css` is refactored now (neutralize backgrounds, keep accents) or as part of the constellation build.
