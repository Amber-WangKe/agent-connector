# Architecture

Starry Agent Connector is a local-first adapter between a Feishu bot and Agents that run under the user's control. Its main job is to make one outbound connection to Feishu and avoid exposing a user's computer to the public internet.

## System boundary

```text
Feishu cloud
    |
    |  WebSocket long connection (outbound from this process)
    v
Local Connector process
    |-- message validation and authorization
    |-- slash-command parser
    |-- job queue and concurrency limits
    |-- CLI provider
    `-- HTTP provider
```

Feishu cloud services cannot connect to `127.0.0.1` on a user's computer. A cloud-hosted app or marketplace plugin therefore cannot call a local Agent merely because the configuration contains a localhost URL. The Connector reverses the direction: the user's computer connects outward to Feishu.

This repository does not contain a Starry Relay service. It is the self-hosted Connector used with a Feishu custom app owned by the user.

## Message path

1. Feishu delivers `im.message.receive_v1` through the SDK's WebSocket client.
2. The runtime ignores non-user senders and normalized mention markup.
3. `/whoami` is available before allowlist authorization so a new user can discover their `open_id`.
4. Other messages require an allowed `open_id`; when configured, the chat must also be in `allowedChatIds`.
5. The command parser accepts `/ask <agent> <prompt>` and `/<agent> <prompt>`, plus `/help`, `/agents` and `/status`.
6. The Connector acknowledges a job immediately, queues it, and sends the result back to the originating chat when it finishes.

The current version only supports read-only Agents. Prompt text is passed as data to a provider; it is never concatenated into a shell command.

## Agent providers

### CLI

The CLI provider starts a configured executable with an argument array and no shell. The prompt can be supplied through standard input. The working directory, timeout and environment are explicit configuration fields.

CLI processes inherit the operating-system permissions of the Connector process. `readOnly=true` records the product contract and selects read-only examples, but it is not an operating-system sandbox. Users who need a hard boundary should run the Connector in a restricted account, container or virtual machine.

### HTTP

The HTTP provider sends a fixed request to a configured endpoint. Redirects are rejected, requests have a timeout, and responses can select a text value with `responsePath`.

Endpoints are loopback-only by default. A LAN or public endpoint requires `allowRemoteAgentEndpoints=true`, which is an explicit trust decision by the user. Do not expose an unauthenticated Agent endpoint to a shared or public network.

## Job execution

The in-memory job queue limits global concurrency and the number of queued or running jobs per user. Each job has a local directory under the configured data directory containing its metadata and result. Job state is not durable across a Connector restart in this version.

Output is truncated before delivery and common configured secrets are redacted. This defense is best effort; providers must not return credentials or private environment data.

## Local setup console

The setup console is an administrative surface, not a public web application.

- It binds to loopback only.
- It validates the HTTP `Host` header as a loopback host.
- API calls require a random per-session token delivered to the local page.
- It applies a restrictive Content Security Policy and anti-framing headers.
- It never returns the App Secret after storage.
- It writes `.env` and `agents.json` with local file permissions where the platform supports them.

The console protects the local administration path. It does not protect a computer that is already compromised by another process running under the same user account.

## Secrets and data

Feishu App credentials stay in the local `.env` file. Agent configuration with `open_id`, `chat_id`, local paths and endpoints stays in `agents.json`. Runtime job results stay under `data/`.

These paths are ignored by Git and excluded from release archives. `npm run verify` audits the public tree for accidental inclusion of common credentials, local identifiers and absolute machine paths.

## Failure behavior

- Invalid configuration fails closed before the Connector starts.
- An invalid or missing Feishu credential prevents authentication.
- One Feishu custom app should have one active long-connection receiver; stop another Gateway using the same app before starting this Connector.
- Failed agent execution is reported in the originating chat without exposing the full local environment.
- Delivery failure does not re-run an Agent; the job result remains available in local runtime state until the process restarts.

## Relay and marketplace boundary

A future hosted Feishu app would need a Relay between Feishu and user devices. That Relay must not accept arbitrary localhost addresses from the cloud. A production design requires at least device pairing, per-tenant routing, signed control messages, replay protection, revocation, quota controls and an audit trail.

The MVP deliberately avoids that additional trust surface. The repository should not claim to be an installable marketplace plugin until the Relay, tenant isolation and operations model exist.
