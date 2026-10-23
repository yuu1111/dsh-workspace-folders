/**
 * 純正の一覧へ当てる CSS の検証
 *
 * 純正の DOM の形に依存する場所なので セレクタの形も固定する
 */

import { describe, expect, test } from "bun:test";
import { guideBackground, iconCss, layoutCss, quote } from "../src/layout-css";
import {
	assignWorkspace,
	computeLayout,
	createFolder,
	EMPTY_STATE,
	toggleCollapsed,
} from "../src/model";

describe("layoutCss", () => {
	test("フォルダが無ければ何も当てない", () => {
		expect(layoutCss(computeLayout(EMPTY_STATE, ["a"]))).toBe("");
	});

	test("ワークスペース群へ並びと字下げを当てる", () => {
		const state = assignWorkspace(
			createFolder(EMPTY_STATE, "f", "F"),
			"a",
			"f",
		);
		const css = layoutCss(computeLayout(state, ["a", "b"]));
		expect(css).toContain(
			'[data-slot="sidebar.workspaces"] [role="tree"] > :has(> [data-row-key="workspace:a"])',
		);
		expect(css).toContain(
			'[data-slot="sidebar.workspaces"] [role="tree"] > :has(> * > [data-row-key="workspace:a"])',
		);
		expect(css).toContain("order:2;--dsh-workspace-indent:36px !important");
		expect(css).toContain("display:flex;flex-direction:column");
	});

	test("折りたたんだフォルダの中身を隠す", () => {
		const state = toggleCollapsed(
			assignWorkspace(createFolder(EMPTY_STATE, "f", "F"), "a", "f"),
			"f",
		);
		expect(layoutCss(computeLayout(state, ["a"]))).toContain(
			"display:none !important",
		);
	});

	test("段ごとに親の三角の真下へ案内線を引く", () => {
		expect(guideBackground(0)).toBe("");
		const two = guideBackground(2);
		expect(two).toContain("background-position:15px 0,51px 0");
		expect(two.match(/linear-gradient/g)).toHaveLength(2);
	});

	test("ワークスペース行のアイコンの枠だけを絵文字へ差し替える", () => {
		expect(iconCss()).toBe("");
		const css = iconCss({ a: "🐋" });
		expect(css).toContain(
			'[data-slot="sidebar.workspaces"] [data-row-key="workspace:a"] > [class*="_folder"] > svg{display:none}',
		);
		expect(css).toContain('::before{content:"🐋"');
	});

	test("塗る画像は文字色の mask に 塗らない画像は背景にし 引けない値は描かない", () => {
		const css = iconCss(
			{ a: "dsh:code", b: "custom:logo", c: "custom:gone" },
			(value) => {
				if (value === "dsh:code") {
					return { src: "data:image/svg+xml,x", tint: true };
				}
				return value === "custom:logo"
					? { src: "data:image/png;base64,x", tint: false }
					: undefined;
			},
		);
		expect(css).toContain(
			'background:currentColor;-webkit-mask:url("data:image/svg+xml,x")',
		);
		expect(css).toContain('background:url("data:image/png;base64,x")');
		expect(css).not.toContain("workspace:c");
	});

	test("属性値の引用符と円記号を逃がす", () => {
		expect(quote('a"b\\c')).toBe('"a\\"b\\\\c"');
	});
});
