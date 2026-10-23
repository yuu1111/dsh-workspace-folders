/**
 * ホスト側の本体
 *
 * フォルダの割り当てはブラウザ側だけで持つため ここでは何もしない Loader に
 * 行を1つ持たせ クライアントの走査に `./client` を見つけさせるためだけにある
 */

/**
 * プラグイン名
 */
export const name = "workspace-folders";

/**
 * 何も登録しない
 */
export function apply(): void {
	// ホスト側で持つものは無い
}
