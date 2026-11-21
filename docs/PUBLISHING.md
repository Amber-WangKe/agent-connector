# Publishing to GitHub

This checklist covers the first public release. Complete the local checks before creating a remote repository.

## 1. Repository identity

Recommended repository name:

```text
agent-connector
```

Recommended description:

```text
Local-first Feishu connector for user-owned AI agents, with a loopback setup console and read-only CLI/HTTP providers.
```

Recommended topics:

```text
feishu
lark
ai-agents
local-first
codex
claude
webhook
nodejs
```

Use the MIT License already present in the repository. Keep the project marked as pre-1.0 and community-maintained.

## 2. Local release gate

From the repository root:

```powershell
npm ci
npm run verify
npm audit --registry=https://registry.npmjs.org --audit-level=high
git status --short --ignored
npm run package:windows
Get-FileHash .\dist\agent-connector-0.2.0-win-x64.zip -Algorithm SHA256
```

Before the first commit, confirm that `.env`, `agents.json`, `data/`, `dist/` and `node_modules/` are ignored. Never force-add a file that contains local credentials or personal identifiers.

Extract the ZIP to a temporary directory, confirm that documentation links resolve, and run `setup.ps1` from the extracted copy. The archive must not contain `.env`, `agents.json`, runtime jobs or development dependencies.

## 3. Create and push the repository

Authenticate GitHub CLI first:

```powershell
gh auth login
gh auth status
```

If `api.github.com` works but `github.com` times out, follow
[GitHub network troubleshooting](GITHUB_NETWORK.md) before retrying login.

Create the public repository from the current directory:

```powershell
gh repo create <owner>/agent-connector --public --source . --remote origin --push --description "Local-first Feishu connector for user-owned AI agents"
```

If the repository already exists:

```powershell
git remote add origin https://github.com/<owner>/agent-connector.git
git push -u origin main
```

Do not create a second README or license during remote initialization. This directory is the source of truth.

## 4. Repository settings

Enable these settings after the first push:

- Private vulnerability reporting for `SECURITY.md`.
- Dependabot alerts and security updates.
- Secret scanning and push protection when available for the account.
- CodeQL default setup or the checked-in CodeQL workflow, not duplicate analyses.
- Issues enabled; wiki and projects optional.
- Squash merging enabled with a linear history.
- Delete branches after merge.

Review GitHub Actions permissions and allow the repository's workflows to run. The checked-in workflows only request the permissions needed for CI, CodeQL and release creation.

## 5. Branch protection

Protect `main` after CI has produced its first check names. Require pull requests, resolved conversations, and the actual CI/CodeQL checks shown by GitHub. Do not copy stale check names from a template.

A sole maintainer cannot approve their own pull request, so adding a mandatory human approval at bootstrap can lock the repository. Keep required approvals at zero while there is one maintainer; raise the requirement after a second trusted maintainer joins.

For initial bootstrap, push the reviewed local commit directly; then enable protection before accepting outside contributions.

## 6. First release

1. Update `package.json`, `package-lock.json` and `CHANGELOG.md` together.
2. Run the local release gate again.
3. Commit with a release-oriented message.
4. Create and push a tag only after the commit is merged:

```powershell
git tag -a v0.2.0 -m "v0.2.0"
git push origin v0.2.0
```

The release workflow runs the public-tree audit, builds `agent-connector-<version>-win-x64.zip`, and creates a draft GitHub release with generated notes.

Download the draft asset and independently verify:

- The version in the archive name and `package.json` matches the tag.
- The ZIP has no `.env`, `agents.json`, `data/`, `.git`, `node_modules` development state or test credentials.
- Setup and startup work from a clean extraction directory.
- The SHA256 shown on the release page matches the uploaded asset.

Publish the draft only after those checks pass. Keep `v*` tags immutable.

## 7. If a secret was committed

Rotate the Feishu App Secret, Agent token or other credential first. Removing a blob from the latest commit is not enough because Git history, forks, caches and notifications may retain it.

1. Rotate the credential in its provider console.
2. Revoke exposed sessions and tokens.
3. Remove the value from the current tree.
4. Rewrite history with a reviewed history-rewrite tool if the repository was already public.
5. Force-push rewritten branches, notify collaborators to re-clone, and invalidate cached artifacts.
6. Re-run `npm run verify` and inspect the public release assets.

Never include the leaked secret in an issue, pull request or validation output.
