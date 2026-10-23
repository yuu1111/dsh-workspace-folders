/**
 * 純正の一覧の DOM を選ぶセレクタと 並びの CSS
 *
 * DOM に触れない純粋な関数だけを置く 純正の構造に依存する場所はここへ集める
 */

import { type FolderLayout, INDENT_PX } from "./model";

/**
 * 純正のワークスペース一覧の差し込み口
 */
export const SLOT_SELECTOR = '[data-slot="sidebar.workspaces"]';

/**
 * 純正の一覧の木 検索結果の木も同じ role を持つが ワークスペース行を持たない
 */
export const TREE_SELECTOR = `${SLOT_SELECTOR} [role="tree"]`;

/**
 * 純正のワークスペース行の目印の接頭辞
 */
export const ROW_KEY_PREFIX = "workspace:";

/**
 * 属性セレクタへ入れる文字列を引用する
 *
 * @param value - 値
 * @returns 二重引用符で囲んだ文字列
 */
export function quote(value: string): string {
	return `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/**
 * 純正のワークスペース群1つを選ぶセレクタ
 *
 * 群の先頭にワークスペース行があり ホバーカードの span に包まれることもある
 *
 * @param workspaceId - ワークスペース id 純正の「未グループ化」は空文字
 * @returns セレクタ
 */
function sectionSelector(workspaceId: string): string {
	const key = quote(ROW_KEY_PREFIX + workspaceId);
	return [
		`${TREE_SELECTOR} > :has(> [data-row-key=${key}])`,
		`${TREE_SELECTOR} > :has(> * > [data-row-key=${key}])`,
	].join(",");
}

/**
 * 字下げの段ごとに縦の案内線を引く背景
 *
 * 各段の線は 親の見出し行の三角の真下 先頭から 8px と三角の幅の半分の位置に引く
 * 子孫の群にも同じ線を引くと 同じフォルダの中身が1本の線でつながって見える
 *
 * @param depth - 字下げの段数
 * @returns background の宣言 段が無ければ空文字
 */
export function guideBackground(depth: number): string {
	if (depth <= 0) {
		return "";
	}
	const lines: string[] = [];
	const positions: string[] = [];
	for (let level = 0; level < depth; level++) {
		lines.push(GUIDE_LINE);
		positions.push(`${GUIDE_OFFSET_PX + level * INDENT_PX}px 0`);
	}
	return `background-image:${lines.join(",")};background-size:1px 100%;background-repeat:no-repeat;background-position:${positions.join(",")}`;
}

/**
 * 案内線1本の画像
 */
const GUIDE_LINE =
	"linear-gradient(var(--dsw-alias-border-l2,rgba(127,127,127,.25)),var(--dsw-alias-border-l2,rgba(127,127,127,.25)))";

/**
 * 案内線の横位置 行の左の余白 8px と三角の幅 16px の半分
 */
const GUIDE_OFFSET_PX = 15;

/**
 * 並びの全体から CSS を作る
 *
 * @param layout - 並びの全体
 * @returns スタイルシートの本文 並べ替えないときは空文字
 */
export function layoutCss(layout: FolderLayout): string {
	if (!layout.active) {
		return "";
	}
	const rules = [
		`${TREE_SELECTOR}:has(> .dwf-row){display:flex;flex-direction:column}`,
		`${TREE_SELECTOR}:has(> .dwf-row) > *{flex:none}`,
		// 純正はDOM上の最初のProjectの目印を一覧上端へ逃がすが 視覚順では別の位置になる
		`${SLOT_SELECTOR} :has(> ${'[role="tree"]'} > .dwf-row) > [class*="_listTopDropIndicator"]{display:none !important}`,
		`${TREE_SELECTOR}:has(> .dwf-row) > [class*="_workspaceDropBefore"]:before{display:block !important;left:var(--dsh-workspace-indent,0px)}`,
		`${TREE_SELECTOR}:has(> .dwf-row) > [class*="_workspaceDropAfter"]:after{left:var(--dsh-workspace-indent,0px)}`,
	];
	for (const [workspaceId, placement] of layout.sections) {
		const body = placement.hidden
			? "display:none !important"
			: [
					`order:${placement.order}`,
					`--dsh-workspace-indent:${placement.depth * INDENT_PX}px !important`,
					guideBackground(placement.depth),
				]
					.filter(Boolean)
					.join(";");
		rules.push(`${sectionSelector(workspaceId)}{${body}}`);
	}
	return rules.join("\n");
}
