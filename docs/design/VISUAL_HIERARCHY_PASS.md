# Humn visual hierarchy restraint pass

This pass changes presentation only. It does not change palette values, font families, routing, data access, provenance, strikes, moderation, Collections behavior, or Supabase schema.

## Hierarchy changes

- One page-level `h1` remains on Account, Creator, Discover, Search, Collections, Collection detail, Work detail, and Style Guide.
- Global `h2` and `h3` scale is restrained to section and panel sizes.
- Decorative mono eyebrows were replaced with body-font page, section, and panel labels except for the single page kicker retained on index-style pages.
- Status values and counts no longer render at display size.
- Vertical section spacing, panel padding, and provenance-block spacing were tightened.
- Style Guide now demonstrates one display headline, restrained section/panel headings, and the live shared toggle.

## Toggle fix

The Account settings and Style Guide now use the same `ToggleSwitch` component.

OFF state renders:

```text
class="track track--off"
data-on="false"
```

The OFF track is transparent with a 1px `--ink` border and an `--ink` knob at the left. ON uses `--accent` with a `--paper` knob translated right.

## Decorative mono kicker count

- `/account`: 0
- `/creator/[handle]`: 0
- `/discover`: 1 page kicker
- `/search`: 1 page kicker
- `/collections`: 1 page kicker
- `/collections/[id]`: 1 page kicker
- `/work/[id]`: 0 decorative kickers; evidence labels, timestamps, hashes, provenance signal names, and inline counts remain mono metadata

## Verification

1. Account has one dominant H1; standing, work counts, history, settings, export, and deletion are calm section/panel headings.
2. Public creator profile has one handle H1 and a restrained showcase heading.
3. Discover, Search, and Collections each have one page H1; subordinate feed headings are 20–24px.
4. Work detail uses the Work title as the focal heading; provenance section names are body-font labels and evidence remains mono.
5. Account OFF toggles show an outlined transparent track, never a black filled rectangle.
