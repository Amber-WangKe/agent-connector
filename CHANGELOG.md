# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open-source repository metadata, contribution and security policies.
- Cross-platform CI and Windows release automation.
- Public-tree audit for accidental credential or local-state commits.

## [0.2.0] - 2026-11-21

### Added

- Local setup console for Feishu credentials, allowlists and multiple Agents.
- CLI and HTTP Agent providers with read-only execution.
- Whoami-only bootstrap mode when the allowlist is empty.
- Asynchronous Feishu jobs with concurrency and timeout controls.
- Portable Windows package builder.

### Security

- Loopback-only setup console with a per-session token and Host validation.
- Secrets remain in the local `.env` file and are redacted from errors.
- Local files are never executed as shell commands based on Feishu text.
