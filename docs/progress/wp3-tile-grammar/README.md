# WP3 tile grammar evidence

The offline grammar viewer is available at `/?grammar=1` in development and in
the production preview. `grammar-base.png` records the first validated base
family before the unlockable packs are added.

Verified on 2026-08-05:

- 14 base definitions rendered with zero asset errors;
- layer filtering reduced the gallery from 14 definitions to 5 features;
- rotating `terrain.path.straight` changed `0 x 90 degrees` to
  `1 x 90 degrees` and rotated PATH sockets from N/S to E/W;
- `npm run validate:assets`, `npm run validate:tiles`, and the production build
  passed.

The viewer can also download a deterministic SVG inventory for the selected
pack. `grammar-authorized-packs.png` records the final authorized inventory:

- Base: 14 definitions;
- Water: 7 definitions;
- Forest: 8 definitions;
- Ruin: 7 definitions;
- Total: 36 definitions across 4 packs, with zero loading or asset errors.

Storm is intentionally absent. Issue #22 remains blocked by release candidate
issue #51 and additionally requires the later 10,000-seed simulation gate.
