/**
 * ホスト側の本体
 *
 * フォルダの状態を DSH の設定へ置くため 編集できる（volatile な）設定項目
 * `state` を1つだけ宣言する ブラウザ側は `configForms` で読み書きし
 * 書いた値はプロファイルの cordis.patch.yml に残るので どの端末の
 * ブラウザからも同じフォルダが見える
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";

declare module "@deepseek-ai/cordis" {
	interface Context {
		/**
		 * DSH の設定サービス 自動で出す設定画面の有無を受け取る
		 */
		settings: {
			configure(policy: { auto: boolean }, fiber: unknown): () => void;
		};
	}
}

/**
 * プラグイン名
 */
export const name = "workspace-folders";

/**
 * ホストの設定の形
 */
export const Config = z.object({
	/**
	 * フォルダの状態を JSON にした文字列 中身はブラウザ側が検査する
	 */
	state: z.string().volatile(),
});

/**
 * 設定画面へ自動で項目を出さないよう DSH の設定サービスへ伝える
 *
 * @param ctx - ホスト側 cordis コンテキスト
 */
export function apply(ctx: Context): void {
	ctx.inject(["settings"], (child) => {
		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
	});
}
