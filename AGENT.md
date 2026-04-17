# Agent Workflow

This file defines the long-term agent workflow for this repository.

Use it for project iterations that benefit from:

- one coordinating main agent
- multiple subagents working in parallel
- separate branches per workstream
- separate PRs into an integration branch
- one final integration PR into `main`

Specific feature plans, refactors, or implementation specs should live outside this file, usually under:

```text
docs/superpowers/plans/
docs/superpowers/specs/
```

`AGENT.md` is the stable workflow. Plan files are the changing per-iteration instructions.

## Core Workflow

```text
plan -> main agent -> subagents -> branches -> PRs -> integration branch -> final PR -> main
```

The default branch flow is:

```text
main
  └── work/<iteration-name>
        ├── agent/<workstream-a>
        ├── agent/<workstream-b>
        └── agent/<workstream-c>
```

Example:

```text
main
  └── work/typescript-refactor
        ├── agent/scaffold-db-types
        ├── agent/data-tools
        └── agent/bot-orchestrator
```

## When To Use Multi-Agent Workflow

Use this workflow when an iteration has at least two mostly independent workstreams, such as:

- frontend and backend changes
- data model and API changes
- independent service integrations
- test suite and implementation work
- scaffolding, feature implementation, and verification docs

Do not force this workflow for small edits. For narrow changes, use a normal single branch and single PR.

## Iteration Plan Requirements

Before spawning subagents, create or identify a plan file that defines:

- goal
- scope
- non-goals
- files or modules likely to change
- workstream split
- dependencies between workstreams
- verification commands
- acceptance criteria
- known risks

Recommended path:

```text
docs/superpowers/plans/YYYY-MM-DD-<iteration-name>.md
```

Optional design/spec path:

```text
docs/superpowers/specs/YYYY-MM-DD-<iteration-name>-design.md
```

The plan is the source of truth for the current iteration. If the plan conflicts with this file, prefer this file for workflow rules and prefer the plan for feature-specific behavior.

## Main Agent Responsibilities

The main agent coordinates the iteration.

The main agent must:

- read the relevant plan and existing code before assigning work
- create or verify the integration branch
- split work into non-overlapping workstreams
- assign each subagent explicit file or module ownership
- tell subagents they are not alone in the codebase
- tell subagents not to revert unrelated edits
- review each PR before merge
- merge PRs in dependency order
- update remaining branches after each merge
- run final verification on the integration branch
- open the final PR from the integration branch to `main`

The main agent should avoid duplicating subagent work. It may make integration fixes when branches meet.

## Subagent Rules

Each subagent owns one workstream.

Every subagent must:

- work only in its assigned branch
- stay inside its assigned file or module ownership
- avoid broad refactors outside its workstream
- preserve user changes and other agents' changes
- avoid reverting files it does not own
- keep commits focused
- run relevant verification before opening a PR
- document what was changed and what was not verified

If a subagent needs to edit outside its ownership area, it must call that out in the PR and explain why.

## Branch Naming

Use this naming scheme:

```text
work/<iteration-name>
agent/<workstream-name>
fix/<short-description>
docs/<short-description>
```

Examples:

```text
work/typescript-refactor
agent/scaffold-db-types
agent/data-tools
agent/bot-orchestrator
fix/research-timeout-handling
docs/smoke-test-runbook
```

The integration branch must be created from `main`:

```bash
git checkout main
git pull --ff-only
git checkout -b work/<iteration-name>
git push -u origin work/<iteration-name>
```

Each subagent branch must be created from the integration branch:

```bash
git checkout work/<iteration-name>
git pull --ff-only
git checkout -b agent/<workstream-name>
git push -u origin agent/<workstream-name>
```

## PR Targets

Subagent PRs target the integration branch:

```text
agent/<workstream-name> -> work/<iteration-name>
```

The final PR targets `main`:

```text
work/<iteration-name> -> main
```

Do not open subagent PRs directly into `main` unless the main agent explicitly decides the integration branch is unnecessary.

## Workstream Ownership

Each workstream should have explicit ownership.

Good ownership examples:

```text
Agent A owns:
- package setup
- build config
- shared types

Agent B owns:
- data-source clients
- external API parsing

Agent C owns:
- orchestration
- command handlers
- smoke-test docs
```

Avoid assigning two agents to the same file unless the plan gives a clear merge strategy.

If two agents need the same shared type, prefer merging the type owner first, then rebasing dependent branches.

## Merge Order

Merge in dependency order.

Default order:

1. scaffolding and shared types
2. low-level libraries or data access
3. feature modules
4. UI, command, or orchestration layers
5. tests and documentation
6. final integration PR

After each subagent PR merges, update remaining branches:

```bash
git checkout agent/<remaining-workstream>
git fetch origin
git rebase origin/work/<iteration-name>
git push --force-with-lease
```

Use merge instead of rebase only when the team explicitly wants merge commits on feature branches.

## Commit Rules

Use small commits that match task boundaries.

Good examples:

```bash
git commit -m "chore: add project scaffolding"
git commit -m "feat: add data source client"
git commit -m "fix: handle request timeout"
git commit -m "test: cover report formatting"
git commit -m "docs: add smoke test runbook"
```

Rules:

- do not mix unrelated ownership areas in one commit
- do not commit secrets
- do not commit generated dependency folders
- do not hide formatting-only rewrites inside behavioral changes
- mention migrations or required manual steps in the commit or PR body

## PR Rules

Every subagent PR must include:

- linked plan or task
- summary of completed work
- files or modules changed
- verification commands run
- screenshots or logs when useful
- known limitations
- follow-up tasks, if any

PR body template:

```markdown
## Summary
- Completed ...
- Added ...
- Updated ...

## Files Changed
- ...

## Verification
- [ ] <command>
- [ ] <manual check>

## Notes
- Required env vars:
- Manual setup:
- Known limitations:
```

## Review Rules

Review PRs for:

- correctness against the plan
- clear file ownership
- type safety or runtime safety
- error handling
- secret handling
- migration safety
- test coverage proportional to risk
- backwards compatibility when relevant
- user-facing behavior

Reject or request changes when:

- the PR edits unrelated files without explanation
- the PR reverts another agent's work
- verification is missing without a clear reason
- secrets or local-only files are committed
- the code introduces fragile coupling between workstreams

## Verification

The plan must define concrete verification commands for each iteration.

Typical verification examples:

```bash
bun run typecheck
bun test
npm test
pnpm test
pytest
ruff check .
tsc --noEmit
```

Before merging each subagent PR:

- run the commands relevant to that workstream
- document skipped checks and why they were skipped

Before the final PR to `main`:

- run all project-level checks available in the repo
- run smoke tests when credentials and external services are available
- verify required env vars are documented
- verify no secrets are committed
- verify the app can start if startup is part of the iteration

## Conflict Handling

Rules:

- prefer the current iteration plan for feature behavior
- prefer existing project conventions when the plan is silent
- preserve user changes and unrelated agent changes
- do not delete another agent's work unless the main agent explicitly decides it is obsolete
- if two PRs edit the same file unexpectedly, stop and reassign ownership before continuing
- resolve shared-type or shared-interface conflicts before merging dependent feature PRs

When conflicts happen:

1. identify which workstream owns the conflicted file
2. merge or rebase the lower-level dependency first
3. update the dependent branch
4. make the smallest integration fix possible
5. rerun relevant verification

## Environment And Secrets

Rules:

- secrets must come from environment variables or approved secret storage
- `.env` files must not be committed
- `.env.example` should document required keys with empty values
- tests should avoid requiring live secrets unless they are explicitly smoke tests
- PRs must mention any new required environment variables

Example `.env.example` style:

```text
SERVICE_API_KEY=
DATABASE_URL=
FEATURE_FLAG=
```

## Documentation Rules

Update documentation when an iteration changes:

- setup steps
- commands
- environment variables
- architecture
- public API behavior
- smoke-test steps
- deployment steps

Prefer adding iteration-specific details to plan, spec, or runbook files instead of bloating `AGENT.md`.

## Final Integration Checklist

Before opening the final PR from `work/<iteration-name>` to `main`:

- all subagent PRs have been reviewed and merged
- integration branch is up to date with `main`
- project-level verification passes
- smoke tests are complete or explicitly skipped
- required env vars are documented
- migrations or manual setup steps are documented
- no secrets are committed
- no unrelated files are changed
- final PR body links the plan and summarizes all merged workstreams

Final PR body template:

```markdown
## Summary
- Integrated ...
- Completed ...

## Workstreams
- Agent A:
- Agent B:
- Agent C:

## Verification
- [ ] <project-level command>
- [ ] <smoke test>

## Deployment / Manual Steps
- ...

## Risks
- ...
```

## Repository Initialization

If this directory has not been initialized as a Git repository yet, initialize it before using the branch and PR workflow:

```bash
git init
git add .
git commit -m "chore: initial commit"
git branch -M main
```

After that, add the remote and push `main` before creating integration and subagent branches.

## Quick Start For A New Iteration

1. Create a plan:

```text
docs/superpowers/plans/YYYY-MM-DD-<iteration-name>.md
```

2. Create an integration branch:

```bash
git checkout main
git pull --ff-only
git checkout -b work/<iteration-name>
git push -u origin work/<iteration-name>
```

3. Split workstreams and spawn subagents.

4. Have each subagent open a PR into:

```text
work/<iteration-name>
```

5. Merge in dependency order.

6. Run final verification on `work/<iteration-name>`.

7. Open final PR into:

```text
main
```
