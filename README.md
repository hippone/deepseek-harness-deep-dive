# DeepSeek Harness Deconstructed: How a Replaceable Agent Runtime Is Assembled

English | [中文](README.zh.md)

A source-level architecture analysis of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`), the open-source agent harness where **everything is a plugin**, powered by [Cordis](https://github.com/cordiverse/cordis).

This repository is an independent technical writing project: it reads the pinned upstream commit and explains how the runtime is actually assembled — Cordis ownership, Profile/Bundle product assembly, the default Agent loop, session facts, replaceable capability seams, multi-entry products, security boundaries, evidence grading, and adoption routes.

## Contents

- **Decision brief** — one-page verdict, adoption cards, and positioning against adjacent projects ([`00-executive-brief.md`](00-executive-brief.md))
- **Table of contents** — reading map and chapter list ([`00-outline.md`](00-outline.md))
- **Full text** — twelve chapters in four parts ([`01-deep-dive.md`](01-deep-dive.md))
- **Appendix A** — capability map: core services and the Definition/Provider/Consumer inventory ([`appendices/A-capability-map.md`](appendices/A-capability-map.md))
- **Appendix B** — event and lifecycle map ([`appendices/B-event-and-lifecycle-map.md`](appendices/B-event-and-lifecycle-map.md))
- **Appendix C** — adoption checklist for pilot trials ([`appendices/C-adoption-checklist.md`](appendices/C-adoption-checklist.md))
- **Appendix D** — sources and evidence index ([`appendices/D-sources-and-evidence.md`](appendices/D-sources-and-evidence.md))

## Read online

The rendered site is published with GitHub Pages: <https://hippone.github.io/deepseek-harness-internals/>

## Research baseline

Every implementation claim is pinned to `deepseek-ai/deepseek-harness@47f943859bef60e4160492346772ded9b24f765a`; line numbers are verified against the local checkout under `sources/`. Evidence discipline: interface existence is recorded separately from runnable capability, official documentation supports design intent only, and adoption advice is labeled as inference. See Appendix D for the full index.

## Repository layout

```text
00-executive-brief.md        decision brief
00-outline.md                published table of contents
01-deep-dive.md              full text (chapters 1–12)
appendices/                  A capability map · B events · C checklist · D evidence
sources/                     pinned upstream checkout (gitignored, verification only)
```

## Disclaimer

This is an independent technical analysis and does not represent the views of DeepSeek. The whale artwork on the site comes from the official brand assets in the pinned commit.
