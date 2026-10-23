# dsh-workspace-folders

English | [日本語](README.ja.md)

A DeepSeek Harness Web GUI plugin that groups sidebar workspaces into folders.
Folders nest, and folders and workspaces can each carry an icon: any emoji or
one of the DSH UI icons, picked from a searchable Discord-style picker.

```
▾ 🛠️ DSH plugins
│  ▾ 📁 UI
│  │  📁 dsh-ui-cost-meter
│  │  📁 dsh-workspace-folders
│  📁 dsh-locale-ja
▸ 🏠 Vault                3
▾ 📁 Unfiled
   📁 dotfiles
```

It does not replace the shipped workspace browser. It inserts folder heading
rows into that list and only changes the order and indent of the shipped
workspace groups, so the Session "..." menu, status dots, pinning, search, and
view options all stay the shipped ones.

## Install

```sh
dsh plugin --profile web add github:yuu1111/dsh-workspace-folders
```

`add link:<path>` works the same from a source checkout. The plugin ships its
own bundle patch, so the profile's `cordis.patch.yml` needs no edit. Restart
`dsh web` after installing.

## Usage

| Action | How |
|---|---|
| Create a folder | The folder button in the Workspaces header, or "..." on Unfiled |
| Create a subfolder | Folder "..." → New subfolder |
| File a workspace | Drag the workspace row onto a folder row, or folder "..." → Add workspace |
| Unfile a workspace | Drag the workspace row onto Unfiled |
| Reorder folders | Drag a folder row onto the top or bottom edge of another, or "..." → Move up / Move down |
| Nest a folder | Drag a folder row onto the middle of another, or "..." → Move to |
| Change the icon | Folder "..." → Change icon |
| Change a workspace's icon | Workspace "..." → Change icon |
| Collapse / expand | Click the folder row; a collapsed folder shows how many workspaces it holds |

Deleting a folder moves its workspaces and subfolders up one level. Workspaces
and Sessions themselves are never deleted.

While no folder exists, the plugin leaves the shipped list untouched.

## Storage

Folders, assignments, and workspace icons live in the browser's `localStorage`
(`dsh-workspace-folders.state.v1`). They are per browser and never change
DSH's workspace registry or its order.

## Limits

- The ordering CSS targets the shipped list's DOM shape
  (`role="tree"` inside `[data-slot="sidebar.workspaces"]` and each row's
  `data-row-key`). A DSH update that changes that shape can misplace the
  folder rows; the shipped list and its features keep working either way.
- The shipped "In one list" view has no workspace groups, so no folders show
  there.
- Verified on the DeepSeek Harness 0.2.1-rc.2 Web GUI.

## Development

```sh
bun install
bun run build
bun run check
bun run lint
bun test
```

## License

MIT
