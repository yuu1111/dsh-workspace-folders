/**
 * Discord の絵文字ピッカーに倣ったアイコンの選択画面
 *
 * 上に検索欄 左にカテゴリの列 中央に見出し付きの格子 下に指している
 * アイコンの名前を出す 1つ押すとすぐに確定して閉じる
 *
 * 利用者は画像を追加でき 追加した画像は「カスタム」に並ぶ 画像はボタン
 * ドラッグ アンド ドロップ 貼り付けのどれでも取り込める
 */

import emojiCatalog from "virtual:emoji-catalog";
import {
	Button,
	IconClockOutlineRegular,
	IconCloseOutlineRegular,
	IconPersonalizationOutlineRegular,
	IconPlusOutlineRegular,
	IconSearchOutlineRegular,
	IconSparkleRegular,
	Input,
	Modal,
} from "@deepseek-ai/dsh-client-ui-primitives";
import {
	type ClipboardEvent,
	type DragEvent,
	type ReactNode,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import { customIconFromFile } from "./custom-icon";
import type { Messages } from "./i18n";
import {
	type EmojiRow,
	matchesQuery,
	normalizeQuery,
	pushRecent,
	typedEmoji,
} from "./icon-catalog";
import {
	CustomIconsContext,
	customIconOf,
	DSH_ICONS,
	dshIconOf,
	IconGlyph,
} from "./icons";
import { CUSTOM_ICON_PREFIX, type CustomIcon } from "./model";

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
	/**
	 * 利用者が追加した画像なら その id 消すボタンを出す
	 */
	customId?: string;
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
	/**
	 * 末尾に画像を追加するボタンを置くか
	 */
	addable?: boolean;
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
 * @param custom - 利用者が追加した画像
 * @returns 名前 表に無ければ値そのもの
 */
function labelOf(
	value: string,
	ja: boolean,
	custom: readonly CustomIcon[],
): string {
	const image = customIconOf(custom, value);
	if (image !== undefined) {
		return image.name;
	}
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
 * 画像のアイコンを格子1つへ直す
 *
 * @param icon - 画像のアイコン
 * @returns 格子1つ
 */
function customItem(icon: CustomIcon): PickerItem {
	return {
		value: CUSTOM_ICON_PREFIX + icon.id,
		label: icon.name,
		customId: icon.id,
	};
}

/**
 * 検索していないときのまとまり
 *
 * @param recent - 最近使ったアイコン
 * @param custom - 利用者が追加した画像
 * @param t - 文言
 * @returns 最近 カスタム DSH 絵文字の各グループの順のまとまり
 */
function browseSections(
	recent: readonly string[],
	custom: readonly CustomIcon[],
	t: Messages,
): PickerSection[] {
	const ja = t.lang === "ja";
	const sections: PickerSection[] = [];
	const live = recent.filter(
		(value) =>
			!value.startsWith(CUSTOM_ICON_PREFIX) ||
			customIconOf(custom, value) !== undefined,
	);
	if (live.length > 0) {
		sections.push({
			id: "recent",
			title: t.pickerRecent,
			mark: <IconClockOutlineRegular size={18} />,
			items: live.map((value) => ({
				value,
				label: labelOf(value, ja, custom),
			})),
		});
	}
	sections.push({
		id: "custom",
		title: t.pickerCustom,
		mark: <IconPersonalizationOutlineRegular size={18} />,
		items: custom.map(customItem),
		addable: true,
	});
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
 * @param custom - 利用者が追加した画像
 * @param t - 文言
 * @returns 当たったアイコン 貼り付けた絵文字は先頭へ置く
 */
function searchSection(
	query: string,
	custom: readonly CustomIcon[],
	t: Messages,
): PickerSection {
	const ja = t.lang === "ja";
	const normalized = normalizeQuery(query);
	const items: PickerItem[] = [];
	const typed = typedEmoji(query);
	if (typed !== undefined) {
		items.push({ value: typed, label: labelOf(typed, ja, custom) });
	}
	for (const icon of custom) {
		if (matchesQuery(normalizeQuery(icon.name), normalized)) {
			items.push(customItem(icon));
		}
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
	onAddCustom,
	onRemoveCustom,
	newId,
	t,
}: {
	title: string;
	value: string;
	onConfirm: (icon: string) => void;
	onClose: () => void;
	onAddCustom: (icons: readonly CustomIcon[]) => void;
	onRemoveCustom: (id: string) => void;
	newId: () => string;
	t: Messages;
}) {
	const custom = useContext(CustomIconsContext);
	const fileInput = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [hovered, setHovered] = useState<PickerItem | null>(null);
	const [active, setActive] = useState<string | null>(null);
	const [recent] = useState(readRecent);
	const scroller = useRef<HTMLDivElement>(null);
	const searching = query.trim() !== "";
	const browse = useMemo(
		() => browseSections(recent, custom, t),
		[recent, custom, t],
	);
	const sections = useMemo(
		() => (searching ? [searchSection(query, custom, t)] : browse),
		[searching, query, custom, t, browse],
	);
	const importFiles = async (files: readonly File[]) => {
		const images = files.filter((file) => file.type.startsWith("image/"));
		if (images.length === 0) {
			return;
		}
		const added: CustomIcon[] = [];
		for (const file of images) {
			const icon = await customIconFromFile(file, newId());
			if (icon !== undefined) {
				added.push(icon);
			}
		}
		setNotice(added.length < images.length ? t.pickerImageFailed : null);
		if (added.length === 0) {
			return;
		}
		onAddCustom(added);
		setQuery("");
		requestAnimationFrame(() => {
			jump("custom");
		});
	};
	const onDrop = (event: DragEvent) => {
		event.preventDefault();
		setDragging(false);
		void importFiles(Array.from(event.dataTransfer.files));
	};
	const onPaste = (event: ClipboardEvent) => {
		const files = Array.from(event.clipboardData.files);
		if (files.some((file) => file.type.startsWith("image/"))) {
			event.preventDefault();
			void importFiles(files);
		}
	};
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
		hovered ??
		(value === "" ? null : { value, label: labelOf(value, ja, custom) });
	return (
		<Modal
			open
			onClose={onClose}
			title={title}
			closeLabel={t.close}
			className="dwf-pickerModal"
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: 画像のドロップと貼り付けを受けるだけで 操作は中の部品が持つ */}
			<div
				className={dragging ? "dwf-picker dwf-pickerDragging" : "dwf-picker"}
				onPaste={onPaste}
				onDragOver={(event) => {
					if (event.dataTransfer.types.includes("Files")) {
						event.preventDefault();
						setDragging(true);
					}
				}}
				onDragLeave={(event) => {
					if (
						!(event.relatedTarget instanceof Node) ||
						!event.currentTarget.contains(event.relatedTarget)
					) {
						setDragging(false);
					}
				}}
				onDrop={onDrop}
			>
				<input
					ref={fileInput}
					type="file"
					accept="image/*"
					multiple
					hidden
					onChange={(event) => {
						const files = Array.from(event.target.files ?? []);
						event.target.value = "";
						void importFiles(files);
					}}
				/>
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
										<span key={item.value} className="dwf-pickerCell">
											<button
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
											{item.customId !== undefined && (
												<button
													type="button"
													className="dwf-pickerRemove"
													aria-label={t.pickerRemove(item.label)}
													title={t.pickerRemove(item.label)}
													onClick={() => {
														if (item.customId !== undefined) {
															onRemoveCustom(item.customId);
														}
													}}
												>
													<IconCloseOutlineRegular size={10} />
												</button>
											)}
										</span>
									))}
									{section.addable === true && (
										<button
											type="button"
											className="dwf-pickerItem dwf-pickerAdd"
											aria-label={t.pickerAddImage}
											title={t.pickerAddImage}
											onClick={() => {
												fileInput.current?.click();
											}}
										>
											<IconPlusOutlineRegular size={18} />
										</button>
									)}
								</div>
								{section.addable === true && section.items.length === 0 && (
									<p className="dwf-pickerCustomHint">{t.pickerCustomHint}</p>
								)}
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
						{notice ?? preview?.label ?? t.pickerHint}
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
				{dragging && <div className="dwf-pickerDrop">{t.pickerDropHere}</div>}
			</div>
		</Modal>
	);
}
