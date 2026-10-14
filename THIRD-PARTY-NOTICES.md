# Third-party notices — Base Project App

Base Project App is licensed under Apache-2.0 (see [LICENSE](LICENSE)). It bundles the
third-party software listed below into its production build (`dist/`), and copies
some third-party source into `src/`. Their notices are reproduced here.

**Why this file matters.** A minified SPA bundle served to a browser is
distribution. MIT and ISC require their copyright and permission notices to travel
with "all copies"; minification strips the banner comments those notices live in.
This file is what satisfies that requirement for the shipped bundle, so it must
accompany any redistribution of `dist/`.

Verified against the on-disk `node_modules` tree on 2026-08-21. The production dependency
tree was scanned in full: **103 packages, 100% permissive** — no GPL,
LGPL, AGPL, MPL, SSPL, BUSL or Commons Clause anywhere in it.

---

## 1. Bundled runtime dependencies

### Apache License 2.0

Required notice under Apache-2.0 §4(d). Full text: [LICENSE](LICENSE).

| Package | Version | Copyright |
|---|---|---|
| `class-variance-authority` | 0.7.1 | Copyright Joe Bell |

### MIT License

> Permission is hereby granted, free of charge, to any person obtaining a copy of
> this software and associated documentation files (the "Software"), to deal in the
> Software without restriction, including without limitation the rights to use,
> copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
> Software, and to permit persons to whom the Software is furnished to do so,
> subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
> FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
> AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
> WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

| Package | Version | Copyright |
|---|---|---|
| `react`, `react-dom` | 19.2.4 | Copyright (c) Meta Platforms, Inc. and affiliates |
| `@reduxjs/toolkit` | 2.11.2 | Copyright (c) 2018 Mark Erikson |
| `react-redux` | 9.2.0 | Copyright (c) 2015-present Dan Abramov |
| `react-router-dom` | 7.18.2 | Copyright (c) React Training LLC 2015-2019; Copyright (c) Remix Software Inc. 2020-2021; Copyright (c) Shopify Inc. 2022-2024 |
| `radix-ui` | 1.6.5 | Copyright (c) 2022 WorkOS |
| `motion` | 12.42.2 | Copyright (c) 2024 Motion (https://motion.dev) B.V. |
| `sonner` | 2.0.7 | Copyright (c) 2023 Emil Kowalski |
| `clsx` | 2.1.1 | Copyright (c) Luke Edwards (https://lukeed.com) |
| `tailwind-merge` | 3.6.0 | Copyright (c) 2021 Dany Castillo |

### ISC License

| Package | Version | Copyright |
|---|---|---|
| `lucide-react` | 1.26.0 | Copyright (c) 2026 Lucide Icons and Contributors |

> Permission to use, copy, modify, and/or distribute this software for any purpose
> with or without fee is hereby granted, provided that the above copyright notice
> and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
> REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
> FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT,
> OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE,
> DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS
> ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS
> SOFTWARE.

`lucide-react` derives from Feather Icons, Copyright (c) 2013-2023 Cole Bemis (MIT).

---

## 2. Source copied into this repository

These are not npm dependencies. The code or data lives in `src/` and ships in the
bundle, so the obligation is the same.

### shadcn/ui — `src/components/ui/` (14 files)

Copyright (c) 2023 shadcn — MIT License (text as reproduced above).

shadcn/ui is distributed as copy-in source rather than as a package. Its own
documentation describes the copied files as yours to own and edit; the MIT notice
is reproduced here because the copied code retains no header of its own.

### Colour palettes — `src/features/ui/themes.ts`

Seven of the ten themes transcribe hex values from published palettes. Hex values
alone are facts and are thin copyright subject matter, but each upstream project
is MIT-licensed and each name is a project identity, so both are credited here.
The `source` field on each theme records the upstream URL in code.

| Theme | Upstream | License |
|---|---|---|
| `nord` | Nord — https://www.nordtheme.com/docs/colors-and-palettes | MIT — Copyright (c) 2016-present Sven Greb |
| `dracula` | Dracula — https://spec.draculatheme.com/ | MIT — Copyright (c) 2016 Dracula Theme |
| `catppuccin-mocha`, `catppuccin-latte` | Catppuccin — https://github.com/catppuccin/palette | MIT — Copyright (c) 2021-present Catppuccin Org |
| `gruvbox-dark` | gruvbox — https://github.com/morhetz/gruvbox | MIT — Copyright (c) 2012-2018 Pavel Pertsev |
| `solarized-light` | Solarized — https://ethanschoonover.com/solarized/ | MIT — Copyright (c) 2011 Ethan Schoonover |
| `high-contrast-light` | GitHub Primer primitives — https://github.com/primer/primitives | MIT — Copyright (c) 2018 GitHub, Inc. |

The `light`, `dark` and `midnight` themes are original to Base Project.

**Trademark note.** Nord, Dracula, Catppuccin, gruvbox and Solarized are used here
as descriptive names of the palettes they identify. Their MIT licenses grant no
trademark rights, and this project claims none.

---

## 3. Loaded at runtime, not redistributed

**Inter** is loaded from Google Fonts via a `<link>` in `index.html`. No font file
is redistributed by this repository, so the SIL Open Font License imposes no
obligation here. Self-hosting Inter later would change that — OFL requires the
license and copyright to accompany the font files.

---

## 4. Development-only dependencies

Not shipped. Listed because they carry weak-copyleft or attribution terms that
would matter if the toolchain were ever redistributed.

| Package | License | Note |
|---|---|---|
| `axe-core`, `@axe-core/playwright` | MPL-2.0 | File-scoped copyleft; test tooling only |
| `lightningcss`, `lightningcss-linux-x64-gnu` | MPL-2.0 | Build-time CSS transform (via Tailwind) |
| `caniuse-lite` | CC-BY-4.0 | Browser-support data; attribution required if the *data* is redistributed |

Full development tree: 484 MIT, 30 ISC, 24 Apache-2.0, 9 BSD-3-Clause,
8 BSD-2-Clause, 5 BlueOak-1.0.0, 4 MPL-2.0, 1 CC-BY-4.0, 1 MIT-0, 1 0BSD across
569 manifests. No GPL, AGPL, LGPL, SSPL, BUSL, Commons Clause or UNLICENSED
package anywhere in the tree.
