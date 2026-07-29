# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This repository is in its earliest scaffolding stage — no source files, dependencies, or build tooling exist yet. There are no build, lint, or test commands to document because there is no code to build, lint, or test. As soon as a language/framework and initial structure are chosen, this file should be updated with the concrete commands (build, lint, test — including how to run a single test) and an architecture overview.

Until then, the workflow rules below are the load-bearing content of this file and apply to all work in this repo, including the very first commit.

## Package Manager

Use **pnpm**, not npm or yarn, for all dependency installation and script running once a `package.json` exists (`pnpm install`, `pnpm add`, `pnpm run <script>`, etc.). Do not commit a `package-lock.json` or `yarn.lock` — only `pnpm-lock.yaml`.

## Language & Code Style

- **TypeScript**, not plain JavaScript, for all source code once code exists.
- **Functional approach favored** over class-based/OOP patterns: prefer pure functions, immutable data, and composition over classes, inheritance, and mutable shared state.
- **Custom lint rules required.** Don't rely solely on a stock ESLint config — define custom rules/config that enforce this project's specific standards (e.g. functional style, no-`any`, naming conventions) as they're identified, rather than only generic defaults.
- **Pre-commit hooks required.** Set up pre-commit hooks (e.g. via Husky + lint-staged, or similar) that run linting, type-checking, and tests before a commit is allowed, so code standards are enforced automatically rather than by discipline alone.

## Development Workflow

This project follows Small Dream Collective standards. These are not optional conventions — treat them as hard requirements for any change, including the first one.

1. **Issue-first.** No code is written without a corresponding issue/ticket describing the problem or feature first. If no issue exists for requested work, create one (or ask the user to) before writing code.
2. **Unit test per feature.** Every feature ships with a unit test covering it. No feature is considered done without one.
3. **Documentation per feature.** Every feature includes documentation describing what it does and how to use it.
4. **Markdown file per feature.** Every feature gets its own `.md` file recording what it is, why it exists, and any decisions behind it. Keep these alongside the feature or in a consistent `docs/` location once that structure is established.
5. **Code review required.** No feature or code change lands without a code review — every PR requires review before merge, no exceptions for "small" changes.

Follow this sequence for any unit of work: open/confirm the issue → implement → write the unit test → write the feature doc + `.md` file → submit for code review → merge only after review approval.

## Git Commits

Commit messages are plain and authored as Small Dream Collective. Never include a "Co-Authored-By: Claude" line or any other AI attribution in commit messages in this repo.

## Values

This project is built under Small Dream Collective's standards: technology serves people, not the reverse.

- **Environment** — favor small models, track costs, avoid waste.
- **Communities** — build for and with people, not extracting from them.
- **Social justice** — equity is a design constraint, not a stretch goal.
- **Human well-being** — the measure of success is whether people are better off.
- **User experience** — craft and quality are acts of respect.
- **Human rights** — privacy, dignity, and agency are non-negotiable.

Work slow and deliberate over fast and reactive. Keep humans in the loop — AI assists, never decides. Prefer bespoke solutions over generic ones. Research before assumption. Question whether software is even the right answer before building.

Refuse: dark patterns, surveillance, exclusion by default, environmental carelessness, extraction.
