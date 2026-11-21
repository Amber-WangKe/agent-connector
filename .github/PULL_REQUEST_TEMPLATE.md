## Summary

Describe the user-visible change and why it is needed.

## Validation

- [ ] `npm test` passes
- [ ] `npm run verify` passes
- [ ] I tested the affected setup or Feishu flow manually where practical

## Security and privacy

- [ ] No credentials, personal `open_id`, local absolute path or runtime config is included
- [ ] Feishu text is still treated as untrusted input
- [ ] Agent execution remains read-only unless separately approved
- [ ] Remote endpoints still require explicit opt-in

## Documentation

- [ ] User-facing behavior or setup changes are documented
- [ ] `CHANGELOG.md` is updated for notable changes
