# AGENTS.md — PromptGuard

Guidance for AI coding agents working in this repo.

<!-- antislop-code:start -->
## Comment hygiene

When writing or editing code comments in this repo, read and follow `../custom-skills/antislop_code/SKILL.md` (absolute: `~/workspace/custom-skills/antislop_code/SKILL.md`). It is a comment-hygiene filter: remove AI-slop comment patterns (decorative banners, ALL CAPS shouting, comments that restate the code, step-by-step workflow narration, empty labels, vague TODOs, decorative emoji, end markers, over-explained multi-line comments) while keeping the comments that explain why (business logic, workarounds, constraints, edge cases). House rules: no instructions to the reader, no marketing language, no jargon, no changelogs in comments, tuning parameters live in config. Scope guardrail: only comments change, never executable code.
<!-- antislop-code:end -->

## Commit messages

Write commit subjects as `<type>: <subjek>`:

- Type in English, conventional-commit style: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `debug`.
- Subject in Indonesian, max ~72 characters, lowercase start unless a proper noun.
- Say what changed and why it matters. A bare "perbaikan" or "update" says nothing; "fix: selector tombol kirim pakai aria-label=Send (hasil inspect user)" says everything.
- No emoji in subjects, no marketing fluff, no AI-slop phrasing.
- Never mention AI, prompts, or internal skills/tooling in commit messages or docs; describe the change, not how it was made.
- Body is optional: 1-3 short lines explaining the reason, only when the subject is not self-evident.
- Never rewrite pushed history to "tidy" old messages; the convention applies going forward.
