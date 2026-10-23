/**
 * Discord の絵文字ピッカーに倣ったアイコンの選択画面
 *
 * 上に検索欄 左にカテゴリの列 中央に見出し付きの格子 下に指している
 * アイコンの名前を出す 1つ押すとすぐに確定して閉じる
 */

import emojiCatalog from "virtual:emoji-catalog";
import {
	Button,
	IconClockOutlineRegular,
	IconSearchOutlineRegular,
	IconSparkleRegular,
	Input,
	Modal,
} from "@deepseek-ai/dsh-client-ui-primitives";
import { type ReactNode, useMemo, useRef, useState } from "react";
import type { Messages } from "./i18n";
import {
	type EmojiRow,
	matchesQuery,
	normalizeQuery,
	pushRecent,
	typedEmoji,
} from "./icon-catalog";
import { DSH_ICONS, dshIconOf, IconGlyph } from "./icons";

/**
 * 最近使ったアイコンを保存する localStorage のキー
 */
const RECENT_KEY = "dsh-workspace-folders.recent-icons.v1";

/**
 * 最近使ったアイコンを残す数
 */
const RECENT_MAX = 27;

/**
 * 格子1つ
 */
interface PickerItem {
	/**
	 * 保存する値
	 */
	value: string;
	/**
	 * 今の言語の名前
	 */
	label: string;
}

/**
 * 見出し付きの格子のまとまり1つ
 */
interface PickerSection {
	/**
	 * 識別子 カテゴリの列と対応する
	 */
	id: string;
	/**
	 * 見出し
	 */
	title: string;
	/**
	 * カテゴリの列に出す印
	 */
	mark: ReactNode;
	/**
	 * 並ぶアイコン
	 */
	items: PickerItem[];
}

/**
 * emojibase のグループごとのカテゴリの印
 */
const GROUP_MARKS: Record<number, string> = {
	0: "😀",
	1: "👋",
	3: "🐱",
	4: "🍎",
	5: "✈️",
	6: "⚽",
	7: "💡",
	8: "❤️",
	9: "🏁",
};

/**
 * 最近使ったアイコンを読む
 *
 * @returns 新しい順の値
 */
function readRecent(): string[] {
	try {
		const value: unknown = JSON.parse(
			globalThis.localStorage?.getItem(RECENT_KEY) ?? "[]",
		);
		return Array.isArray(value)
			? value.filter((entry): entry is string => typeof entry === "string")
			: [];
	} catch {
		return [];
	}
}

/**
 * 使ったアイコンを最近使ったものへ足す
 *
 * @param value - 使ったアイコン
 */
function rememberRecent(value: string): void {
	try {
		globalThis.localStorage?.setItem(
			RECENT_KEY,
			JSON.stringify(pushRecent(readRecent(), value, RECENT_MAX)),
		);
	} catch {
		// 保存できなくても選んだアイコンは使える
	}
}

/**
 * 絵文字の行を格子1つへ直す
 *
 * @param row - 絵文字の行
 * @param ja - 日本語で出すか
 * @returns 格子1つ
 */
function emojiItem(row: EmojiRow, ja: boolean): PickerItem {
	return { value: row[0], label: ja ? row[2] : row[3] };
}

/**
 * 値の名前を引く
 *
 * @param value - アイコンの値
 * @param ja - 日本語で出すか
 * @returns 名前 表に無ければ値そのもの
 */
function labelOf(value: string, ja: boolean): string {
	const icon = dshIconOf(value);
	if (icon !== undefined) {
		return ja ? icon.ja : icon.en;
	}
	const row = emojiCatalog.find((entry) => entry[0] === value);
	if (row === undefined) {
		return value;
	}
	return ja ? row[2] : row[3];
}

/**
 * 検索していないときのまとまり
 *
 * @param recent - 最近使ったアイコン
 * @param t - 文言
 * @returns 最近 DSH 絵文字の各グループの順のまとまり
 */
function browseSections(
	recent: readonly string[],
	t: Messages,
): PickerSection[] {
	const ja = t.lang === "ja";
	const sections: PickerSection[] = [];
	if (recent.length > 0) {
		sections.push({
			id: "recent",
			title: t.pickerRecent,
			mark: <IconClockOutlineRegular size={18} />,
			items: recent.map((value) => ({ value, label: labelOf(value, ja) })),
		});
	}
	sections.push({
		id: "dsh",
		title: t.pickerDsh,
		mark: <IconSparkleRegular size={18} />,
		items: DSH_ICONS.map((icon) => ({
			value: icon.value,
			label: ja ? icon.ja : icon.en,
		})),
	});
	const groups = new Map<number, PickerItem[]>();
	for (const row of emojiCatalog) {
		const items = groups.get(row[1]) ?? [];
		items.push(emojiItem(row, ja));
		groups.set(row[1], items);
	}
	for (const [group, items] of groups) {
		sections.push({
			id: `group-${group}`,
			title: t.emojiGroups[group] ?? "",
			mark: <span className="dwf-emoji">{GROUP_MARKS[group] ?? "❔"}</span>,
			items,
		});
	}
	return sections;
}

/**
 * 検索したときの1つのまとまり
 *
 * @param query - 検索欄の値
 * @param t - 文言
 * @returns 当たったアイコン 貼り付けた絵文字は先頭へ置く
 */
function searchSection(query: string, t: Messages): PickerSection {
	const ja = t.lang === "ja";
	const normalized = normalizeQuery(query);
	const items: PickerItem[] = [];
	const typed = typedEmoji(query);
	if (typed !== undefined) {
		items.push({ value: typed, label: labelOf(typed, ja) });
	}
	for (const icon of DSH_ICONS) {
		if (matchesQuery(icon.keywords, normalized)) {
			items.push({ value: icon.value, label: ja ? icon.ja : icon.en });
		}
	}
	for (const row of emojiCatalog) {
		if (row[0] !== typed && matchesQuery(row[4], normalized)) {
			items.push(emojiItem(row, ja));
		}
	}
	return {
		id: "search",
		title: t.pickerResults,
		mark: <IconSearchOutlineRegular size={18} />,
		items,
	};
}

/**
 * アイコンを選ぶダイアログ
 *
 * @param props - 見出し 今の値 確定時の処理
 * @returns ダイアログ
 */
export function IconPicker({
	title,
	value,
	onConfirm,
	onClose,
	t,
}: {
	title: string;
	value: string;
	onConfirm: (icon: string) => void;
	onClose: () => void;
	t: Messages;
}) {
	const [query, setQuery] = useState("");
	const [hovered, setHovered] = useState<PickerItem | null>(null);
	const [active, setActive] = useState<string | null>(null);
	const [recent] = useState(readRecent);
	const scroller = useRef<HTMLDivElement>(null);
	const searching = query.trim() !== "";
	const browse = useMemo(() => browseSections(recent, t), [recent, t]);
	const sections = useMemo(
		() => (searching ? [searchSection(query, t)] : browse),
		[searching, query, t, browse],
	);
	const ja = t.lang === "ja";
	const pick = (icon: string) => {
		rememberRecent(icon);
		onConfirm(icon);
	};
	const jump = (id: string) => {
		const container = scroller.current;
		const target = container?.querySelector<HTMLElement>(
			`[data-section="${id}"]`,
		);
		if (container != null && target != null) {
			container.scrollTop = target.offsetTop - container.offsetTop;
			setActive(id);
		}
	};
	const onScroll = () => {
		const container = scroller.current;
		if (container === null) {
			return;
		}
		let current: string | null = null;
		for (const element of Array.from(
			container.querySelectorAll<HTMLElement>("[data-section]"),
		)) {
			if (element.offsetTop - container.offsetTop <= container.scrollTop + 4) {
				current = element.dataset.section ?? null;
			}
		}
		setActive(current);
	};
	const first = sections[0]?.items[0];
	const preview =
		hovered ?? (value === "" ? null : { value, label: labelOf(value, ja) });
	return (
		<Modal
			open
			onClose={onClose}
			title={title}
			closeLabel={t.close}
			className="dwf-pickerModal"
		>
			<div className="dwf-picker">
				<Input
					data-modal-autofocus
					icon={<IconSearchOutlineRegular size={16} />}
					value={query}
					placeholder={t.pickerSearch}
					className="dwf-pickerSearch"
					onChange={(event) => {
						setQuery(event.target.value);
						if (scroller.current !== null) {
							scroller.current.scrollTop = 0;
						}
					}}
					onKeyDown={(event) => {
						if (
							event.key === "Enter" &&
							!event.nativeEvent.isComposing &&
							searching &&
							first !== undefined
						) {
							event.preventDefault();
							pick(first.value);
						}
					}}
				/>
				<div className="dwf-pickerMain">
					{!searching && (
						<div className="dwf-pickerRail" role="tablist" aria-label={title}>
							{browse.map((section) => (
								<button
									key={section.id}
									type="button"
									role="tab"
									aria-selected={(active ?? browse[0]?.id) === section.id}
									aria-label={section.title}
									title={section.title}
									className="dwf-pickerRailButton"
									onClick={() => {
										jump(section.id);
									}}
								>
									{section.mark}
								</button>
							))}
						</div>
					)}
					<div ref={scroller} className="dwf-pickerScroll" onScroll={onScroll}>
						{sections.map((section) => (
							<section key={section.id} data-section={section.id}>
								<h3 className="dwf-pickerHead">{section.title}</h3>
								<div className="dwf-pickerGrid">
									{section.items.map((item) => (
										<button
											key={item.value}
											type="button"
											className="dwf-pickerItem"
											aria-label={item.label}
											aria-pressed={item.value === value}
											onMouseEnter={() => {
												setHovered(item);
											}}
											onMouseLeave={() => {
												setHovered(null);
											}}
											onFocus={() => {
												setHovered(item);
											}}
											onClick={() => {
												pick(item.value);
											}}
										>
											<IconGlyph value={item.value} size={20} />
										</button>
									))}
								</div>
							</section>
						))}
						{sections.every((section) => section.items.length === 0) && (
							<p className="dwf-pickerEmpty">{t.pickerEmpty}</p>
						)}
					</div>
				</div>
				<div className="dwf-pickerFooter">
					<span className="dwf-pickerPreview">
						{preview !== null && <IconGlyph value={preview.value} size={24} />}
					</span>
					<span className="dwf-pickerName">
						{preview?.label ?? t.pickerHint}
					</span>
					<Button
						variant="outline"
						className="dwf-modalAction"
						disabled={value === ""}
						onClick={() => {
							onConfirm("");
						}}
					>
						{t.resetIcon}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
