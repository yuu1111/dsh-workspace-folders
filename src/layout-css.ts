/**
 * 純正の一覧の DOM を選ぶセレクタと 並びの CSS
 *
 * DOM に触れない純粋な関数だけを置く 純正の構造に依存する場所はここへ集める
 */

import type { Activity } from "./activity";
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
 * 絵文字以外のアイコンの画像
 */
export interface IconImage {
	/**
	 * 画像の URL data URL を想定する
	 */
	src: string;
	/**
	 * 形だけを使い 文字色で塗るか
	 */
	tint: boolean;
}

/**
 * 純正のワークスペース行のフォルダアイコンを 選んだアイコンへ差し替える CSS
 *
 * 純正の行へは書き込まず 行の中のアイコンの枠で svg を隠し 疑似要素で描く
 * 絵文字は文字として出す 画像は塗るものを mask に そうでないものを背景にする
 * フォルダが無くても効かせるため 並びの CSS とは別に作る
 *
 * @param icons - ワークスペース id からアイコンの値への対応
 * @param imageOf - 値から画像を引く 絵文字なら undefined
 * @returns スタイルシートの本文 アイコンが無ければ空文字
 */
export function iconCss(
	icons: Readonly<Record<string, string>> = {},
	imageOf: (value: string) => IconImage | undefined = () => undefined,
): string {
	const rules: string[] = [];
	for (const [workspaceId, icon] of Object.entries(icons)) {
		const slot = `${SLOT_SELECTOR} [data-row-key=${quote(ROW_KEY_PREFIX + workspaceId)}] > [class*="_folder"]`;
		const image = imageOf(icon);
		if (image === undefined && /^[a-z]+:/.test(icon)) {
			continue;
		}
		rules.push(`${slot} > svg{display:none}`);
		if (image === undefined) {
			rules.push(
				`${slot}::before{content:${quote(icon.replace(/[\r\n]/g, ""))};font-size:14px;line-height:1}`,
			);
			continue;
		}
		const url = `url(${quote(image.src)})`;
		const paint = image.tint
			? `background:currentColor;-webkit-mask:${url} center/contain no-repeat;mask:${url} center/contain no-repeat`
			: `background:${url} center/contain no-repeat`;
		rules.push(`${slot}::before{content:"";width:16px;height:16px;${paint}}`);
	}
	return rules.join("\n");
}

/**
 * 状態ごとの色 純正の StateDot と同じトークン
 */
const ACTIVITY_COLOR: Readonly<Record<Activity, string>> = {
	done: "var(--dsw-alias-state-success-primary)",
	warning: "var(--dsw-alias-state-warn-primary)",
	ongoing: "var(--dsw-alias-label-tertiary)",
};

/**
 * 進行中の輪 純正の StateDot の薄い輪と弧を mask にして文字色で塗る
 */
const SPINNER_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9.5" opacity=".25"/><circle cx="12" cy="12" r="9.5" stroke-dasharray="15 150"/></svg>',
)}") center/contain no-repeat`;

/**
 * 字下げの無い行での印の中心の横位置 行の左の余白 8px の真ん中
 */
const ACTIVITY_CENTER_PX = 4;

/**
 * 字下げのある行で 字下げの端から印の中心を左へ離す量
 *
 * アイコンに寄せすぎると窮屈に見えるため 親の案内線との間へ置く
 */
const ACTIVITY_INSET_PX = 9;

/**
 * 回る輪のアニメーション名
 */
const SPIN_NAME = "dwf-activity-spin";

/**
 * 行の左に出す状態の印の宣言
 *
 * 印は行の流れに入れず 字下げの中へ浮かせる そのため印の有無で アイコンと
 * 名前の位置は動かない 字下げの無い行では行の左の余白へ置く
 *
 * @param activity - 出す状態
 * @param indentVar - 行の字下げを持つ CSS 変数
 * @returns 宣言 位置と見た目
 */
export function activityDeclarations(
	activity: Activity,
	indentVar: string,
): string {
	const size = activity === "ongoing" ? 8 : 6;
	const paint =
		activity === "ongoing"
			? `-webkit-mask:${SPINNER_MASK};mask:${SPINNER_MASK};animation:${SPIN_NAME} 1.5s linear infinite`
			: "border-radius:50%";
	return [
		"position:absolute",
		"pointer-events:none",
		`width:${size}px`,
		`height:${size}px`,
		`top:calc(50% - ${size / 2}px)`,
		`left:max(${ACTIVITY_CENTER_PX - size / 2}px,calc(var(${indentVar},0px) - ${ACTIVITY_INSET_PX + size / 2}px))`,
		`background:${ACTIVITY_COLOR[activity]}`,
		paint,
	].join(";");
}

/**
 * フォルダの見出し行の印と 回る輪のアニメーションの CSS
 *
 * 見出し行は `data-state` を持つ span で印を出す
 *
 * @returns スタイルシートの本文
 */
export function activityStyle(): string {
	const states: Activity[] = ["done", "ongoing", "warning"];
	return [
		...states.map(
			(activity) =>
				`.dwf-activity[data-state="${activity}"]{${activityDeclarations(activity, "--dwf-indent")}}`,
		),
		`@keyframes ${SPIN_NAME}{to{transform:rotate(360deg)}}`,
		`@media (prefers-reduced-motion:reduce){.dwf-activity,[data-row-key]::before{animation:none !important}}`,
	].join("\n");
}

/**
 * 純正のワークスペース行のアイコンの左へ 中のセッションの状態を出す CSS
 *
 * 純正の行へは書き込まず 行の疑似要素で描く フォルダが無くても効かせるため
 * 並びの CSS とは別に作る
 *
 * @param activities - ワークスペース id から状態への対応
 * @returns スタイルシートの本文 状態が無ければ空文字
 */
export function activityCss(activities: ReadonlyMap<string, Activity>): string {
	const rules: string[] = [];
	for (const [workspaceId, activity] of activities) {
		const row = `${SLOT_SELECTOR} [data-row-key=${quote(ROW_KEY_PREFIX + workspaceId)}]`;
		rules.push(
			`${row}{position:relative}`,
			`${row}::before{content:"";${activityDeclarations(activity, "--dsh-workspace-indent")}}`,
		);
	}
	return rules.join("\n");
}

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
