/**
 * アイコンの候補と検索
 *
 * React と DOM に依存しない純粋な関数だけを置く 絵文字の表はビルド時に
 * emojibase-data から作り 仮想モジュールとしてブラウザ側のバンドルへ埋める
 */

/**
 * DSH 純正のアイコンを指す値の接頭辞 それ以外の値は絵文字として扱う
 */
export const DSH_ICON_PREFIX = "dsh:";

/**
 * 絵文字の表へ入れる最も新しい Emoji の版
 *
 * Windows の Segoe UI Emoji が描けない新しい絵文字は豆腐になるため除く
 */
export const MAX_EMOJI_VERSION = 15;

/**
 * emojibase の「コンポーネント」群 肌の色などの部品で 単独では選ばせない
 */
const COMPONENT_GROUP = 2;

/**
 * 絵文字1つ
 *
 * バンドルを小さく保つため配列で持つ 検索語は {@link normalizeQuery} で整えた
 * 日本語名 英語名 タグをつないだもの
 */
export type EmojiRow = readonly [
	emoji: string,
	group: number,
	ja: string,
	en: string,
	keywords: string,
];

/**
 * emojibase の compact 形式の1件のうち使うもの
 */
interface CompactEmoji {
	hexcode: string;
	unicode: string;
	label: string;
	group?: number;
	order?: number;
	tags?: string[];
}

/**
 * 検索語を比べられる形へ整える
 *
 * 全角と半角 大文字と小文字 カタカナとひらがなの違いを無くす
 *
 * @param text - 元の文字列
 * @returns 整えた文字列
 */
export function normalizeQuery(text: string): string {
	return text
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[\u30a1-\u30f6]/g, (c) =>
			String.fromCharCode(c.charCodeAt(0) - 0x60),
		)
		.trim();
}

/**
 * 整えた検索語が 空白で区切った語をすべて含むか
 *
 * @param keywords - 整えた検索語
 * @param query - 整えた問い合わせ
 * @returns すべて含めば true 問い合わせが空なら true
 */
export function matchesQuery(keywords: string, query: string): boolean {
	return query
		.split(/\s+/)
		.filter(Boolean)
		.every((term) => keywords.includes(term));
}

/**
 * emojibase の日本語と英語のデータから 絵文字の表を作る
 *
 * @param ja - 日本語の compact データ
 * @param en - 英語の compact データ
 * @param versions - 版を持つ完全なデータ
 * @param maxVersion - 入れる最も新しい版
 * @returns emojibase の並び順の表
 */
export function buildEmojiCatalog(
	ja: readonly CompactEmoji[],
	en: readonly CompactEmoji[],
	versions: readonly { hexcode: string; version: number }[],
	maxVersion: number,
): EmojiRow[] {
	const english = new Map(en.map((entry) => [entry.hexcode, entry]));
	const version = new Map(
		versions.map((entry) => [entry.hexcode, entry.version]),
	);
	const rows: { order: number; row: EmojiRow }[] = [];
	for (const entry of ja) {
		const group = entry.group;
		if (
			group === undefined ||
			group === COMPONENT_GROUP ||
			(version.get(entry.hexcode) ?? Number.POSITIVE_INFINITY) > maxVersion
		) {
			continue;
		}
		const other = english.get(entry.hexcode);
		const enLabel = other?.label ?? entry.label;
		const keywords = normalizeQuery(
			[
				entry.label,
				enLabel,
				...(entry.tags ?? []),
				...(other?.tags ?? []),
			].join(" "),
		);
		rows.push({
			order: entry.order ?? 0,
			row: [entry.unicode, group, entry.label, enLabel, keywords],
		});
	}
	return rows.sort((a, b) => a.order - b.order).map(({ row }) => row);
}

/**
 * 問い合わせそのものが絵文字1文字なら その絵文字
 *
 * 表に無い絵文字も 検索欄へ貼り付ければ選べるようにする
 *
 * @param query - 検索欄の値
 * @returns 絵文字 そうでなければ undefined
 */
export function typedEmoji(query: string): string | undefined {
	const value = query.trim();
	if (!/^\p{Extended_Pictographic}/u.test(value)) {
		return undefined;
	}
	const graphemes = [...new Intl.Segmenter().segment(value)];
	return graphemes.length === 1 ? value : undefined;
}

/**
 * 最近使ったアイコンの並びの先頭へ足す
 *
 * @param recent - 今の並び
 * @param value - 使ったアイコン
 * @param max - 残す数
 * @returns 新しい並び 重なりは除く
 */
export function pushRecent(
	recent: readonly string[],
	value: string,
	max: number,
): string[] {
	return [value, ...recent.filter((entry) => entry !== value)].slice(0, max);
}
