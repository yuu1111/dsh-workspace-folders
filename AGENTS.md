# Repository Guidelines

## Project Structure & Module Organization

`src/index.ts` はホスト側の本体で プラグイン名 `workspace-folders` を公開するだけの空の `apply` を持つ
Loader に行を1つ持たせ クライアントの走査に `./client` を見つけさせるためだけにある
`src/client.tsx` はブラウザ側の本体で `slots` を待ち `shell.overlay` へ何も描かない常駐部品を1つ（id `workspace-folders`）登録する
その部品は純正のワークスペース一覧の木（`[data-slot="sidebar.workspaces"] [role="tree"]`）を MutationObserver で追い フォルダの見出し行を React ポータルで木へ差し込み 見出しの新規作成ボタンを一覧の見出しへ差し込む
純正の要素へは属性もイベントも書き込まず 並びと字下げと折りたたみは `src/layout-css.ts` が作る CSS を1つの style タグへ入れて決める
`src/model.ts` はフォルダの状態（`FolderState`）と操作と `computeLayout` を持つ純粋な関数だけを置く
`src/layout-css.ts` は純正の DOM に依存するセレクタと CSS の生成を集める
`src/i18n.ts` は日本語と英語の文言を持ち `<html lang>` で選ぶ
`src/icon-catalog.ts` はアイコンの値と絵文字の表と検索の純粋な関数を持つ
`src/icons.tsx` は選べる DSH 純正のアイコンと 保存した値を描く `IconGlyph` を持つ
`src/icon-picker.tsx` は Discord に倣ったアイコンのピッカーを持つ 絵文字の表は `build.ts` が emojibase-data から作り `virtual:emoji-catalog` としてバンドルへ埋める
`build.ts` は Bun のバンドラで `lib/` を出力し ブラウザ側を `window.__ModuleLoader__.load({ id, factory })` のローダー形式へ包む
`lib/` は生成物で git の管理外にあり 公開 tarball へは `prepack` が組み込む
`README.md` と `README.ja.md` は互いの翻訳で 常に一緒に更新する

## Build, Test, and Development Commands

`package.json` の `packageManager` が示す Bun を使う

- `bun install` は固定済みの依存を導入する
- `bun run build` は `lib/index.js` と `lib/client.js` を生成し直す
- `bun run check` は `tsc -p tsconfig.json` で型を検査する
- `bun run lint` は Biome で検査する
- `bun test` はモデルと CSS の生成を検査する

.github/workflows/ci.yml が push と pull request で同じ並びを回す コミット前にはローカルでも同じ並びを走らせる

## Shipped DOM Contract

ここは DSH の更新で壊れやすい部分なので慎重に変える
純正の一覧は木の直下にワークスペース群（`groupSection`）を並べ 群の先頭にワークスペース行 `[data-row-key="workspace:<id>"]` を置く ワークスペース行はホバーカードの span に包まれることがある
並べ替えは木を `display:flex;flex-direction:column` にし 群と見出し行へ `order` を当てて行う DOM の順は変えない
字下げは純正が群へ渡す `--dsh-workspace-indent` を上書きして行う
純正のワークスペース行をドラッグすると `text/plain` にワークスペース id が入るため 見出し行はそれを受けて割り当てる フォルダ行のドラッグは `application/x-dsh-workspace-folder` を使う
新規作成ボタンは純正の一覧の見出しの最初の要素（検索の input を持つもの）へポータルで足す
この形が変わったら `src/layout-css.ts` と `useSurface` を合わせて直す

## Coding Style & Naming Conventions

strict な TypeScript ESM を書き `biome.json` と `tsconfig.json` が参照する共有設定に従う
Biome はタブ字下げ 二重引用符 展開した JSON を強制する
JSDoc は日本語で コードが語れないことだけを書き 常に複数行のブロック形式にする
関数と変数は `camelCase` 型は `PascalCase` とし 名前付き export だけを使う

## Client Bundle Constraints

ブラウザ側が `require()` してよいのはシェルが配る `react` `react/jsx-runtime` `react-dom` `@deepseek-ai/dsh-client-ui-primitives` だけとする
`build.ts` は許可外の specifier がバンドルへ現れたときに失敗する

## Commit & Pull Request Guidelines

短い命令形の subject を使い 各コミットは1つの話題に絞る

## Release

`package.json` の `version` を上げ 一致するタグを付ける npm への公開はまだ設定していない
