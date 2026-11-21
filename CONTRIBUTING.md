# Contributing to Starry Agent Connector

Thanks for helping improve the project. This repository connects a Feishu bot to user-owned local Agents, so changes must preserve three properties: local credentials stay local, untrusted chat text never becomes a shell command, and write access remains opt-in.

## Development setup

Requirements:

- Node.js 20 or newer
- npm
- PowerShell 7 or Windows PowerShell 5.1 for the Windows scripts

```powershell
npm ci
npm run setup
npm test
npm run verify
```

`npm run setup` creates local-only `.env` and `agents.json` files. Both are ignored by Git. Never paste their contents into an issue, pull request, discussion or screenshot.

## Before opening a pull request

1. Keep the change focused and explain the user-visible outcome.
2. Add or update tests for behavior changes.
3. Run `npm run verify` and include the result in the pull request.
4. Remove credentials, local absolute paths, personal `open_id` values, generated ZIP files and runtime logs from the diff.
5. Update `README.md`, `QUICKSTART.md` or `CHANGELOG.md` when behavior or setup changes.

## Security expectations

- Treat every Feishu message as untrusted input.
- Never concatenate user text into a shell command.
- Keep Agent execution read-only unless a reviewed approval and audit model exists.
- Keep HTTP Agent endpoints loopback-only by default.
- Do not add telemetry, cloud storage or secret collection without an explicit design discussion.
- Report vulnerabilities using the process in `SECURITY.md`, not a public issue.

## Agent provider contributions

Provider changes should include tests for success, timeout and malformed response paths. A provider must not expose environment variables, headers or stderr containing secrets in Feishu responses. Remote endpoints must continue to require the explicit `allowRemoteAgentEndpoints` setting.

## Commit and review style

Clear, imperative commit messages are preferred, for example `fix: reject remote agents by default`. Maintainers may squash commits when merging. By submitting a contribution, you agree that it is licensed under the repository's MIT License.
