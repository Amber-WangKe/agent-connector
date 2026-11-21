# Security Policy

## Supported versions

Starry Agent Connector is currently pre-1.0. Security fixes are applied to the latest release and the `main` branch. Older snapshots are not guaranteed to receive backports.

## Report a vulnerability

Please use GitHub's **Private vulnerability reporting** for this repository when it becomes available. Do not open a public issue containing a working exploit, credentials or private user data.

If private reporting is unavailable, contact a maintainer privately via the contact method on their GitHub profile and provide only the minimum information required to reproduce the issue. Never send real App Secrets or user tokens.

## Security model

- Feishu message content is untrusted input.
- The setup console binds to `127.0.0.1`, validates the Host header and requires a per-session token.
- App credentials are stored in the local `.env` file and are never returned by the setup API.
- Agents are currently read-only. CLI Agents are spawned without a shell; Feishu text is not used as a command string.
- HTTP Agents are loopback-only by default. Access to LAN or public endpoints requires explicit opt-in.
- A local Agent runs with the permissions of the Connector process. Read-only configuration reduces risk but is not a substitute for operating-system isolation.

Users are responsible for their local Agent sandbox, Feishu app permissions, host security and network policy.

## If a secret was exposed

1. Rotate the Feishu App Secret immediately in the Feishu developer console.
2. Revoke any exposed device or Agent tokens.
3. Inspect local logs and process history for unauthorized use.
4. Remove the secret from the affected commit or artifact and treat Git history as compromised.

## Scope

Reports about the Connector, its setup console, Feishu event handling, Agent execution boundary and packaging scripts are in scope. Vulnerabilities in third-party Agents or Feishu itself should be reported to their respective maintainers.
