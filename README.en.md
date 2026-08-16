# dsh-plugins

Source repository for **Dynamic Cordis Plugins** created by the AI assistant in DeepSeek Harness (DSH) sessions.

## Purpose

DSH dynamic plugins run temporarily inside the DSH process and are defined via `cordis_define`. Plugin definitions do **not** survive a process restart, so this repository persists:

- Host / Client source code of every plugin
- Purpose, version history, and repair records
- Everything needed to recreate a plugin in any session (`cordis_define` + `cordis_run`)

## Layout

One directory per plugin, named by `pluginId`:

```
dsh-plugins/
├── README.md
└── <pluginId>/
    ├── README.md        # purpose, versions, run notes
    ├── host.js          # Host source (if any)
    └── client.js        # Client source (if any)
```

## Secret review before every commit

This repository is **public** — any committed secret must be treated as leaked and revoked immediately.

- Run `scripts/check-secrets.sh --all` before every push: exit `1` (CRITICAL, e.g. private keys, known token formats, hardcoded Authorization, credentials in URLs) blocks the commit; exit `2` (WARNING, e.g. 32/40-hex strings, assignments to sensitive fields like `password`/`api_key`) requires case-by-case manual review.
- False positives go into `scripts/secret-allowlist.txt` as `relative/path:exact-line-content` with a `# reason` comment. CRITICAL hits are never allowlisted.
- Plugin sources must never hardcode secrets: use `<YOUR_XXX_TOKEN>` placeholders and read real values from environment/config at runtime.
- A pre-commit hook is enabled via `git config core.hooksPath hooks`.

## Usage

1. Create or update a plugin via `cordis_define` in a DSH session
2. Retrieve the latest Package source with `cordis_inspect_self(pluginId, packageId)`
3. Save it into this repository following the layout above, then commit

Push via SSH: `git@gitee.com:CGWP/dsh-plugins.git`
