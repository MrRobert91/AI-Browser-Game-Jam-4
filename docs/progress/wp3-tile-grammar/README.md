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
pack. A final all-pack capture replaces or complements this base record after
the remaining WP3 content commits.
