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

## Usage

1. Create or update a plugin via `cordis_define` in a DSH session
2. Retrieve the latest Package source with `cordis_inspect_self(pluginId, packageId)`
3. Save it into this repository following the layout above, then commit

Push via SSH: `git@gitee.com:CGWP/dsh-plugins.git`
