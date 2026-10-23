/**
 * アイコンの候補と検索の検証
 */

import { describe, expect, test } from "bun:test";
import {
	buildEmojiCatalog,
	iconNameFromFile,
	isMonochrome,
	matchesQuery,
	normalizeQuery,
	pushRecent,
	typedEmoji,
} from "../src/icon-catalog";

describe("buildEmojiCatalog", () => {
	const ja = [
		{
			hexcode: "1F431",
			unicode: "🐱",
			label: "猫の顔",
			group: 3,
			order: 2,
			tags: ["ネコ"],
		},
		{
			hexcode: "1F600",
			unicode: "😀",
			label: "にっこり笑う",
			group: 0,
			order: 1,
		},
		{ hexcode: "1F3FB", unicode: "🏻", label: "薄い肌色", group: 2, order: 3 },
		{ hexcode: "1FAE8", unicode: "🫨", label: "震える顔", group: 0, order: 4 },
		{ hexcode: "1F1E6", unicode: "🇦", label: "地域指標 A" },
	];
	const en = [
		{ hexcode: "1F431", unicode: "🐱", label: "cat face", tags: ["pet"] },
		{ hexcode: "1F600", unicode: "😀", label: "grinning face" },
	];
	const versions = [
		{ hexcode: "1F431", version: 0.6 },
		{ hexcode: "1F600", version: 1 },
		{ hexcode: "1F3FB", version: 1 },
		{ hexcode: "1FAE8", version: 15 + 1 },
	];
	const catalog = buildEmojiCatalog(ja, en, versions, 15);

	test("並び順に並べ 部品と新しすぎる版と群の無いものを除く", () => {
		expect(catalog.map((row) => row[0])).toEqual(["😀", "🐱"]);
	});

	test("日本語と英語の名前とタグで引ける", () => {
		const cat = catalog.find((row) => row[0] === "🐱");
		expect(cat?.[2]).toBe("猫の顔");
		expect(cat?.[3]).toBe("cat face");
		for (const query of ["ねこ", "猫", "CAT", "pet"]) {
			expect(matchesQuery(cat?.[4] ?? "", normalizeQuery(query))).toBe(true);
		}
	});
});

describe("検索", () => {
	test("空白で区切った語をすべて含むものだけ当たる", () => {
		const keywords = normalizeQuery("cat face ネコ");
		expect(matchesQuery(keywords, normalizeQuery("cat ねこ"))).toBe(true);
		expect(matchesQuery(keywords, normalizeQuery("cat dog"))).toBe(false);
	});

	test("貼り付けた絵文字1つを そのまま候補にする", () => {
		expect(typedEmoji(" 👨‍💻 ")).toBe("👨‍💻");
		expect(typedEmoji("🐱🐶")).toBeUndefined();
		expect(typedEmoji("cat")).toBeUndefined();
	});
});

test("最近使ったものは先頭へ寄せ 重なりを除き 数を絞る", () => {
	expect(pushRecent(["a", "b", "c"], "c", 3)).toEqual(["c", "a", "b"]);
	expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
});

describe("isMonochrome", () => {
	/**
	 * 透過の背景の上に 色を並べた画素を作る
	 *
	 * @param colors - 見える画素の色
	 * @returns RGBA の並び 背景は見える画素と同じ数だけ置く
	 */
	const pixels = (colors: readonly (readonly [number, number, number])[]) => [
		...colors.flatMap(([r, g, b]) => [r, g, b, 255]),
		...colors.flatMap(() => [0, 0, 0, 0]),
	];

	test("透過の上の黒一色のロゴは塗る", () => {
		expect(
			isMonochrome(
				pixels([
					[0, 0, 0],
					[20, 20, 20],
				]),
			),
		).toBe(true);
	});

	test("色のあるロゴと 背景の塗られた写真は塗らない", () => {
		expect(
			isMonochrome(
				pixels([
					[0, 0, 0],
					[255, 80, 0],
				]),
			),
		).toBe(false);
		expect(isMonochrome([0, 0, 0, 255, 10, 10, 10, 255])).toBe(false);
	});
});

test("ファイル名から拡張子を除いて名前にする", () => {
	expect(iconNameFromFile("github-mark.svg")).toBe("github-mark");
	expect(iconNameFromFile(".png")).toBe("image");
});
