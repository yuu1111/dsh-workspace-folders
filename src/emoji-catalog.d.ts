/**
 * ビルド時に emojibase-data から作る絵文字の表
 *
 * build.ts のプラグインが中身を埋める 1件は icon-catalog の EmojiRow と同じ形
 */
declare module "virtual:emoji-catalog" {
	const catalog: readonly (readonly [
		emoji: string,
		group: number,
		ja: string,
		en: string,
		keywords: string,
	])[];
	// biome-ignore lint/plugin: 仮想モジュールの宣言は既定の export でしか書けない
	export default catalog;
}
