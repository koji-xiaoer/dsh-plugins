# dsh-plugins

Source repository for **Dynamic Cordis Plugins** created by the AI assistant in DeepSeek Harness (DSH) sessions.

## Purpose

DSH dynamic plugins run temporarily inside the DSH process and are defined via `cordis_define`. Plugin definitions do **not** survive a process restart, so this repository persists:

- Host / Client source code of every plugin
- Purpose, version history, and repair records
- Everything needed to recreate a plugin in any session (`cordis_define` + `cordis_run`)

## Layout

```
dsh-plugins/
├── README.md            # this file (Chinese)
├── README.en.md         # English overview
├── scripts/             # secret scan, one-click installer, cost estimator
├── hooks/               # pre-commit hook
├── patches/             # distributable patch (ui-conversation.patch, used by scripts/install.sh)
├── docs/                # dependency map / migration plan
├── 插件类/              # dynamic plugins, one directory per pluginId
│   └── dsh-mods-enhanced/  # static profile plugin merging the 5 dynamic plugins
├── 增强主页类/          # UI/enhancement patches (dsh-mods)
└── 其他/                # miscellaneous
```

Each plugin follows:

```
插件类/<pluginId>/
├── README.md        # purpose, versions, run notes
├── host.js          # Host source (if any)
└── client.js        # Client source (if any)
```

Two plugin forms:

| Form | Description | Example |
|---|---|---|
| Dynamic plugin | defined via `cordis_define` in a session, lost on process restart | `插件类/baln-4/` etc. |
| Static resident package | profile static plugin, auto-loaded with dsh web | `插件类/dsh-mods-enhanced/` (merges baln-4/sntf-5/tokm-1/imgr-3/cost-6) |

## Secret review before every commit

This repository is **public** — any committed secret must be treated as leaked and revoked immediately.

- Run `scripts/check-secrets.sh --all` before every push: exit `1` (CRITICAL, e.g. private keys, `sk-`-prefixed DeepSeek/OpenAI keys, Zhipu GLM `<32hex>.<secret>` format, JWTs, Baidu `bce-v3/ALTAK`, Tencent `AKID`, GitHub/GitLab/Slack/AWS/Google tokens, hardcoded Authorization, credentials in URLs) blocks the commit; exit `2` (WARNING, e.g. 32/40-hex strings, assignments to sensitive fields like `password`/`api_key`) requires case-by-case manual review.
- False positives go into `scripts/secret-allowlist.txt` as `relative/path:exact-line-content` with a `# reason` comment. CRITICAL hits are never allowlisted.
- Plugin sources must never hardcode secrets: use `<YOUR_XXX_TOKEN>` placeholders and read real values from environment/config at runtime.
- A pre-commit hook is enabled via `git config core.hooksPath hooks`.

## Install

This repository root declares `dsh.bundle` (see `package.json` + `cordis.patch.yml`) and installs as a standard **DSH profile bundle**:

```bash
dsh plugin --profile web add github:koji-xiaoer/dsh-plugins
```

This installs the repo via pnpm and inserts the `dsh-mods-enhanced` and `dsh-model-select-provider-label` plugins into the web profile; restart `dsh web` to activate (both declare `dsh.client`, so their front-end modules are injected too).

> Note: pnpm must be on PATH (Node.js >= 20 ships corepack: `corepack enable`).

For the additional **ui-conversation client enhancement patch** (cost estimate / billing / currency / notify / balance UI, a text patch on dsh's own files that the bundle mechanism cannot cover), use the legacy script:

```bash
git clone git@github.com:koji-xiaoer/dsh-plugins.git
cd dsh-plugins
bash scripts/install.sh
```

The script will:

1. Install `@deepseek-ai/dsh@0.1.0-rc.6`
2. Apply `patches/ui-conversation.patch` to ui-conversation (cost estimate / billing / currency / notify / balance)
3. Install the `dsh-mods-enhanced` plugin into the web profile (image-to-text / completion notify / token projection)
4. Configure `package.json` + `cordis.patch.yml`

After install, restart `dsh web --port 3080`. Image-to-text needs `ZHIPU_API_KEY`, balance query needs `DEEPSEEK_API_KEY`.

> Note: the ui-conversation patch is **locked to dsh 0.1.0-rc.6**. After a dsh upgrade the client.js changes and the patch may fail; regenerate it.

## Usage

1. Create or update a plugin via `cordis_define` in a DSH session
2. Retrieve the latest Package source with `cordis_inspect_self(pluginId, packageId)`
3. Save it into this repository following the layout above, then commit

Push via SSH: `git@github.com:koji-xiaoer/dsh-plugins.git`

## License

[MIT](LICENSE) © 2026 koji-xiaoer (CGWP)
