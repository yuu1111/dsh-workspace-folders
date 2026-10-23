/**
 * フォルダとワークスペースに付けるアイコンの描画
 *
 * 値が {@link DSH_ICON_PREFIX} で始まれば DSH 純正のアイコン それ以外は絵文字として描く
 */

import {
	IconAgentPresetOutlineRegular,
	IconApiOutlineRegular,
	IconArchiveOutlineRegular,
	IconBranchOutlineRegular,
	IconBrowseOutlineRegular,
	IconChecklistOutlineRegular,
	IconClockOutlineRegular,
	IconCodeOutlineRegular,
	IconCordisPluginOutlineRegular,
	IconDarkOutlineRegular,
	IconDatabaseOutlineRegular,
	IconDataOutlineRegular,
	IconDeliverDocRegular,
	IconEditOutlineRegular,
	IconEnhanceOutlineRegular,
	IconFolderCloseRegular,
	IconFolderOpenRegular,
	IconGaugeOutlineRegular,
	IconGlobeOutlineRegular,
	IconGoalOutlineRegular,
	IconInspectOutlineRegular,
	IconLightOutlineRegular,
	IconLikeOutlineRegular,
	IconLinkOutlineRegular,
	IconListPenOutlineRegular,
	IconMicrophoneOutlineRegular,
	IconNewChatOutlineRegular,
	IconPaperPlaneOutlineRegular,
	IconPersonalizationOutlineRegular,
	IconPinOutlineRegular,
	IconPlanOutlineRegular,
	IconPluginPinwheelOutlineRegular,
	IconProjectAddOutlineRegular,
	type IconProps,
	IconQueueOutlineRegular,
	IconSearchOutlineRegular,
	IconSettingsOutlineRegular,
	IconShieldOutlineRegular,
	IconSkillOutlineRegular,
	IconSparkleRegular,
	IconThinkOutlineRegular,
	IconUserOutlineRegular,
	IconUsersOutlineRegular,
	IconWarningTriangleOutlineRegular,
	IconWorkspaceTreeOutlineRegular,
} from "@deepseek-ai/dsh-client-ui-primitives";
import type { ComponentType } from "react";
import { DSH_ICON_PREFIX, normalizeQuery } from "./icon-catalog";

/**
 * 選べる DSH 純正のアイコン1つ
 */
export interface DshIcon {
	/**
	 * 保存する値 {@link DSH_ICON_PREFIX} から始まる
	 */
	value: string;
	/**
	 * 描く部品
	 */
	component: ComponentType<IconProps>;
	/**
	 * 日本語名
	 */
	ja: string;
	/**
	 * 英語名
	 */
	en: string;
	/**
	 * 検索に使う整えた語
	 */
	keywords: string;
}

/**
 * 1つぶんの定義を作る
 *
 * @param id - 値の接頭辞の後ろ
 * @param component - 描く部品
 * @param ja - 日本語名と検索語
 * @param en - 英語名と検索語
 * @returns アイコン
 */
function dshIcon(
	id: string,
	component: ComponentType<IconProps>,
	ja: string,
	en: string,
): DshIcon {
	return {
		value: DSH_ICON_PREFIX + id,
		component,
		ja: ja.split(" ")[0] ?? ja,
		en: en.split(" ")[0] ?? en,
		keywords: normalizeQuery(`${ja} ${en} dsh`),
	};
}

/**
 * DSH 純正のアイコンの候補 画面の操作を表すだけのものは除く
 */
const ALL_DSH_ICONS: readonly DshIcon[] = [
	dshIcon("folder", IconFolderCloseRegular, "フォルダ", "Folder"),
	dshIcon(
		"folder-open",
		IconFolderOpenRegular,
		"開いたフォルダ",
		"Open folder",
	),
	dshIcon("project", IconProjectAddOutlineRegular, "プロジェクト", "Project"),
	dshIcon("tree", IconWorkspaceTreeOutlineRegular, "ツリー", "Tree"),
	dshIcon("code", IconCodeOutlineRegular, "コード 開発", "Code dev"),
	dshIcon("branch", IconBranchOutlineRegular, "ブランチ git", "Branch git"),
	dshIcon("api", IconApiOutlineRegular, "API", "API"),
	dshIcon("database", IconDatabaseOutlineRegular, "データベース", "Database"),
	dshIcon("data", IconDataOutlineRegular, "データ グラフ", "Data chart"),
	dshIcon("plugin", IconCordisPluginOutlineRegular, "プラグイン", "Plugin"),
	dshIcon("pinwheel", IconPluginPinwheelOutlineRegular, "風車", "Pinwheel"),
	dshIcon("skill", IconSkillOutlineRegular, "スキル", "Skill"),
	dshIcon("agent", IconAgentPresetOutlineRegular, "エージェント", "Agent"),
	dshIcon("sparkle", IconSparkleRegular, "きらめき AI", "Sparkle AI"),
	dshIcon("enhance", IconEnhanceOutlineRegular, "強化 魔法", "Enhance magic"),
	dshIcon("think", IconThinkOutlineRegular, "思考 アイデア", "Think idea"),
	dshIcon("chat", IconNewChatOutlineRegular, "チャット", "Chat"),
	dshIcon(
		"send",
		IconPaperPlaneOutlineRegular,
		"送信 紙飛行機",
		"Send paper plane",
	),
	dshIcon("globe", IconGlobeOutlineRegular, "地球 ウェブ", "Globe web"),
	dshIcon("browse", IconBrowseOutlineRegular, "ブラウザ", "Browse"),
	dshIcon("link", IconLinkOutlineRegular, "リンク", "Link"),
	dshIcon("search", IconSearchOutlineRegular, "検索", "Search"),
	dshIcon("inspect", IconInspectOutlineRegular, "調査", "Inspect"),
	dshIcon("doc", IconDeliverDocRegular, "文書 ドキュメント", "Document doc"),
	dshIcon("edit", IconEditOutlineRegular, "編集 ペン", "Edit pen"),
	dshIcon("list", IconListPenOutlineRegular, "リスト メモ", "List notes"),
	dshIcon(
		"checklist",
		IconChecklistOutlineRegular,
		"チェックリスト",
		"Checklist",
	),
	dshIcon("plan", IconPlanOutlineRegular, "計画", "Plan"),
	dshIcon("goal", IconGoalOutlineRegular, "目標", "Goal target"),
	dshIcon("queue", IconQueueOutlineRegular, "キュー", "Queue"),
	dshIcon("clock", IconClockOutlineRegular, "時計", "Clock"),
	dshIcon("gauge", IconGaugeOutlineRegular, "メーター", "Gauge"),
	dshIcon("settings", IconSettingsOutlineRegular, "設定 歯車", "Settings gear"),
	dshIcon(
		"shield",
		IconShieldOutlineRegular,
		"盾 セキュリティ",
		"Shield security",
	),
	dshIcon("warning", IconWarningTriangleOutlineRegular, "警告", "Warning"),
	dshIcon("archive", IconArchiveOutlineRegular, "アーカイブ", "Archive"),
	dshIcon("pin", IconPinOutlineRegular, "ピン", "Pin"),
	dshIcon("like", IconLikeOutlineRegular, "いいね", "Like"),
	dshIcon("user", IconUserOutlineRegular, "ユーザー 個人", "User personal"),
	dshIcon("users", IconUsersOutlineRegular, "チーム", "Team users"),
	dshIcon(
		"person",
		IconPersonalizationOutlineRegular,
		"パーソナライズ",
		"Personalize",
	),
	dshIcon("mic", IconMicrophoneOutlineRegular, "マイク", "Microphone"),
	dshIcon("light", IconLightOutlineRegular, "太陽 ライト", "Sun light"),
	dshIcon("dark", IconDarkOutlineRegular, "月 ダーク", "Moon dark"),
];

/**
 * 選べる DSH 純正のアイコン
 *
 * 動いている DSH が古く primitives に無いアイコンは undefined で届くため除く
 * 1つでも描くと React が投げて部品全体が止まる
 */
export const DSH_ICONS: readonly DshIcon[] = ALL_DSH_ICONS.filter(
	(icon) => typeof icon.component === "function",
);

/**
 * 値から DSH 純正のアイコンを引く
 *
 * @param value - 保存された値
 * @returns アイコン 絵文字や知らない値なら undefined
 */
export function dshIconOf(value: string): DshIcon | undefined {
	return value.startsWith(DSH_ICON_PREFIX)
		? DSH_ICONS.find((icon) => icon.value === value)
		: undefined;
}

/**
 * 保存されたアイコンの値を描く
 *
 * @param props - 値と大きさ
 * @returns 純正のアイコンか絵文字
 */
export function IconGlyph({ value, size }: { value: string; size?: number }) {
	const icon = dshIconOf(value);
	if (icon !== undefined) {
		const Component = icon.component;
		return <Component size={size ?? 16} />;
	}
	if (value.startsWith(DSH_ICON_PREFIX)) {
		return <IconFolderCloseRegular size={size ?? 16} />;
	}
	return <span className="dwf-emoji">{value}</span>;
}
