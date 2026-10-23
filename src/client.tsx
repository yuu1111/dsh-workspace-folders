/**
 * ブラウザ側の本体
 *
 * 純正のワークスペース一覧は置き換えない 一覧の木（role="tree"）へフォルダの
 * 見出し行を React ポータルで差し込み 純正のワークスペース群の並びと字下げと
 * 表示を生成した CSS で決める そのためセッション行のメニュー ステータス 検索
 * 表示オプションは純正のまま動く
 *
 * 純正の要素へは属性も書き込まない 並びは `:has()` と純正が行へ付ける
 * `data-row-key` だけで選ぶ
 */

import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-layout/client";
import {
	Button,
	IconChevronDownOutlineRegular,
	IconChevronUpOutlineRegular,
	IconEditOutlineRegular,
	IconEllipsisOutlineRegular,
	IconFolderCloseRegular,
	IconFolderOpenRegular,
	IconPlusOutlineRegular,
	IconTrashOutlineRegular,
	IconTriangleRightFillRegular,
	Input,
	Menu,
	type MenuEntry,
	Modal,
	Tooltip,
} from "@deepseek-ai/dsh-client-ui-primitives";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import {
	type CSSProperties,
	type DragEvent,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
	type Activity,
	folderActivities,
	type SessionStatusFacts,
	sessionActivity,
	strongerActivity,
	workspaceActivities,
} from "./activity";
import { type Messages, messagesFor } from "./i18n";
import { IconPicker } from "./icon-picker";
import {
	CustomIconsContext,
	customIconOf,
	DSH_ICONS,
	IconGlyph,
} from "./icons";
import {
	activityCss,
	activityStyle,
	guideBackground,
	iconCss,
	layoutCss,
	quote,
	ROW_KEY_PREFIX,
	SLOT_SELECTOR,
} from "./layout-css";
import {
	addCustomIcons,
	assignWorkspace,
	type CustomIcon,
	childFolders,
	computeLayout,
	createFolder,
	type DropPosition,
	deleteFolder,
	descendantIds,
	type Folder,
	type FolderState,
	folderPath,
	type HeadingRow,
	INDENT_PX,
	moveFolder,
	placeFolder,
	pruneWorkspaces,
	removeCustomIcon,
	renameFolder,
	setFolderIcon,
	setWorkspaceIcon,
	shiftFolder,
	toggleCollapsed,
	UNASSIGNED_ID,
} from "./model";
import { createRowMotion } from "./motion";
import { createFolderStore, type HostForm } from "./store";

/**
 * 常駐させる枠
 *
 * 画面全体の浮き層 何も描かず 見出し行はポータルでサイドバーへ出す
 */
const OVERLAY = "shell.overlay";

declare module "@deepseek-ai/cordis" {
	interface Context {
		/**
		 * DSH の設定を読み書きするサービス ui-settings が配る
		 */
		configForms: { get(entryId: string): HostForm };
	}
}

/**
 * 登録 id
 */
const ENTRY_ID = "workspace-folders";

/**
 * 画像のアイコンが1つも無いときの並び 毎回同じ値を渡して描き直しを避ける
 */
const NO_CUSTOM_ICONS: readonly CustomIcon[] = [];

/**
 * 状態を置くホスト側の設定項目の id `cordis.patch.yml` の行と合わせる
 */
const SETTINGS_ENTRY_ID = "workspace-folders";

/**
 * フォルダ行をドラッグするときの型
 */
const FOLDER_DRAG_TYPE = "application/x-dsh-workspace-folder";

/**
 * 見出し行と 純正の一覧へ足すボタンの見た目
 *
 * 純正の CSS Modules は外から読めないため 0.2.1 の純正のワークスペース行と
 * 同じトークンと同じ宣言を自前の class で持つ
 */
const STYLE = `
.dwf-row{box-sizing:border-box;flex:none;height:34px;margin-top:4px;border-radius:var(--dsw-radius-md);padding:0 8px;padding-inline-start:calc(8px + var(--dwf-indent,0px));cursor:pointer;user-select:none;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:6px}
.dwf-row.dwf-top{margin-top:4px}
.dwf-row.dwf-first{margin-top:0}
.dwf-row:hover,.dwf-row.dwf-menuOpen{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dwf-row{position:relative}
.dwf-row.dwf-drop-inside{background:var(--dsw-alias-interactive-bg-hover);box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary)}
.dwf-row.dwf-drop-before:before,.dwf-row.dwf-drop-after:after{content:"";position:absolute;left:calc(8px + var(--dwf-indent,0px));right:4px;height:2px;border-radius:1px;background:var(--dsw-alias-state-business-primary);pointer-events:none}
.dwf-row.dwf-drop-before:before{top:-3px}
.dwf-row.dwf-drop-after:after{bottom:-3px}
.dwf-slot{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;display:inline-flex;align-items:center;justify-content:center}
.dwf-arrow{transition:transform .15s var(--ds-ease-in-out)}
.dwf-arrowOpen{transform:rotate(90deg)}
.dwf-emoji{font-size:14px;line-height:1}
.dwf-title{flex:1;min-width:0;font-size:13px;font-weight:600;line-height:20px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
.dwf-count{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.dwf-row:hover .dwf-count,.dwf-row.dwf-menuOpen .dwf-count{display:none}
.dwf-actions{flex:none;height:20px;align-items:center;gap:15px;display:none}
.dwf-row:hover .dwf-actions,.dwf-row.dwf-menuOpen .dwf-actions{display:inline-flex}
.dwf-iconButton{border-radius:var(--dsw-radius-xs);cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}
.dwf-iconButton:hover{color:var(--dsw-alias-label-primary)}
.dwf-headerButton{border-radius:var(--dsw-radius-sm);cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}
.dwf-headerButton:hover{background:var(--dsw-alias-interactive-bg-hover)}
:has(input[tabindex="0"]) > .dwf-headerButton{display:none}
[role="tree"]:has(> .dwf-row[class*="dwf-drop-"]) > :not(.dwf-row)::before,[role="tree"]:has(> .dwf-row[class*="dwf-drop-"]) > :not(.dwf-row)::after{display:none !important}
:has(> [role="tree"] > .dwf-row[class*="dwf-drop-"]) > span[aria-hidden="true"]{display:none !important}
.dwf-pickerModal{width:min(440px,100%);padding-bottom:0}
.dwf-picker{display:flex;flex-direction:column;gap:8px;margin:0 -24px}
.dwf-pickerSearch{margin:0 16px}
.dwf-pickerMain{display:flex;height:320px;border-top:.5px solid var(--dsw-alias-border-l2)}
.dwf-pickerRail{flex:none;display:flex;flex-direction:column;gap:2px;padding:6px;overflow-y:auto;background:var(--dsw-alias-bg-layer-1);border-right:.5px solid var(--dsw-alias-border-l2)}
.dwf-pickerRailButton{width:32px;height:32px;flex:none;border:none;border-radius:var(--dsw-radius-sm);background:0 0;cursor:pointer;color:var(--dsw-alias-label-tertiary);display:inline-flex;align-items:center;justify-content:center;filter:grayscale(1);opacity:.7}
.dwf-pickerRailButton:hover,.dwf-pickerRailButton[aria-selected=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);filter:none;opacity:1}
.dwf-pickerRailButton .dwf-emoji{font-size:18px}
.dwf-pickerScroll{flex:1;min-width:0;overflow-y:auto;padding:0 10px 10px;position:relative}
.dwf-pickerHead{position:sticky;top:0;z-index:1;margin:0;padding:10px 4px 6px;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}
.dwf-pickerGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(36px,1fr));gap:2px}
.dwf-pickerItem{height:36px;border:none;border-radius:var(--dsw-radius-sm);background:0 0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);padding:0}
.dwf-pickerItem .dwf-emoji{font-size:22px}
.dwf-pickerItem:hover,.dwf-pickerItem:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);outline:none}
.dwf-pickerItem[aria-pressed=true]{box-shadow:inset 0 0 0 1.5px var(--dsw-alias-state-business-primary)}
.dwf-pickerEmpty{margin:24px 0;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px}
.dwf-pickerFooter{display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.dwf-pickerPreview{width:28px;height:28px;flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-primary)}
.dwf-pickerPreview .dwf-emoji{font-size:24px}
.dwf-picker{position:relative}
.dwf-pickerCell{position:relative;display:block}
.dwf-pickerCell .dwf-pickerItem{width:100%}
.dwf-pickerRemove{position:absolute;top:-3px;right:-3px;width:16px;height:16px;border-radius:50%;border:none;padding:0;cursor:pointer;display:none;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);box-shadow:0 0 0 .5px var(--dsw-alias-border-l4)}
.dwf-pickerCell:hover .dwf-pickerRemove,.dwf-pickerRemove:focus-visible{display:inline-flex}
.dwf-pickerRemove:hover{color:var(--dsw-alias-state-error-primary,#e5484d)}
.dwf-pickerAdd{border:1px dashed var(--dsw-alias-border-l4);color:var(--dsw-alias-label-tertiary)}
.dwf-pickerCustomHint{margin:6px 4px 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dwf-pickerDrop{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 85%,transparent);border:2px dashed var(--dsw-alias-state-business-primary);border-radius:var(--dsw-radius-md);pointer-events:none}
.dwf-customImage{display:block;object-fit:contain}
.dwf-customTint{display:inline-block;background:currentColor;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center}
.dwf-pickerName{flex:1;min-width:0;font-size:13px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dwf-modalBody{display:flex;flex-direction:column;gap:8px}
.dwf-modalText{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;margin:0}
.dwf-modalAction{min-width:72px}
`;

/**
 * スタイルタグの識別子
 */
const STYLE_TAG_ID = "dsh-workspace-folders/style.css";

/**
 * 並びを決めるスタイルタグの識別子
 */
const LAYOUT_TAG_ID = "dsh-workspace-folders/layout.css";

/**
 * ワークスペースのアイコンを差し替えるスタイルタグの識別子
 */
const ICON_TAG_ID = "dsh-workspace-folders/icons.css";

/**
 * ワークスペース行へ中のセッションの状態を出すスタイルタグの識別子
 */
const ACTIVITY_TAG_ID = "dsh-workspace-folders/activity.css";

/**
 * 状態が1つも無いときの対応 毎回同じ値を渡して描き直しを避ける
 */
const NO_ACTIVITIES: ReadonlyMap<string, Activity> = new Map();

/**
 * このプラグインが待つサービス
 */
export const inject = ["slots"];

/**
 * 純正のワークスペース1件の見え方
 */
interface WorkspaceRow {
	workspaceId: string;
	title: string;
	sessionIds?: readonly string[];
}

/**
 * 純正のセッション一覧のうち ここで読むもの
 */
interface SessionList {
	byId: Readonly<Record<string, { running?: boolean } | undefined>>;
	projectionsBySession?: Readonly<
		Record<
			string,
			| {
					values?: {
						subagentCatalog?: readonly { id: string }[] | undefined;
					};
			  }
			| undefined
		>
	>;
}

/**
 * 浮き層の枠が配る props のうち ここで使うもの
 *
 * `useWorkspaces` は ui-workspace が根へ配る読み口で 無い構成でも動くよう任意にする
 */
interface OverlayProps {
	useWorkspaces?: <T>(
		selector: (snapshot: {
			items: readonly WorkspaceRow[];
			phase: string;
			archivedSessionIds?: readonly string[];
		}) => T,
	) => T;
	/**
	 * ui-session が根へ配るセッション一覧の読み口
	 */
	useSessions?: <T>(selector: (snapshot: SessionList) => T) => T;
	/**
	 * ui-session が根へ配るセッションの状態の読み口
	 */
	useSessionStatus?: <T>(
		selector: (snapshot: ReadonlyMap<string, SessionStatusFacts>) => T,
	) => T;
}

/**
 * 開いているダイアログ
 */
type Dialog =
	| { kind: "create"; parentId?: string; assign?: string }
	| { kind: "rename"; folder: Folder }
	| { kind: "icon"; folder: Folder }
	| { kind: "workspaceIcon"; workspaceId: string; title: string }
	| { kind: "delete"; folder: Folder };
/**
 * 状態の置き場 DSH の設定へつないでから読み書きする
 */
const store = createFolderStore();

/**
 * スタイルタグを document へ入れる
 *
 * @param id - タグの識別子
 * @param text - 本文
 * @returns 取り除く関数
 */
function installStyle(id: string, text: string): () => void {
	const existing = document.getElementById(id);
	if (existing !== null) {
		existing.textContent = text;
		return () => {
			existing.remove();
		};
	}
	const style = document.createElement("style");
	style.id = id;
	style.textContent = text;
	document.head.append(style);
	return () => {
		style.remove();
	};
}

/**
 * 純正の一覧の今の姿
 */
interface Surface {
	/**
	 * 見出し行を差し込む木 一覧が出ていなければ null
	 */
	tree: HTMLElement | null;
	/**
	 * 新しいフォルダのボタンを足す見出し 広いサイドバーのときだけ
	 */
	header: HTMLElement | null;
	/**
	 * 木に並ぶワークスペース群の id 純正の並び順
	 */
	sectionIds: readonly string[];
}

/**
 * 何も無いときの姿
 */
const NO_SURFACE: Surface = { tree: null, header: null, sectionIds: [] };

/**
 * 木の直下に並ぶワークスペース群の id を読む
 *
 * @param tree - 純正の一覧の木
 * @returns 純正の並び順の id
 */
function readSectionIds(tree: HTMLElement): string[] {
	const ids: string[] = [];
	for (const child of Array.from(tree.children)) {
		if (child.classList.contains("dwf-row")) {
			continue;
		}
		const row = child.querySelector(`[data-row-key^=${quote(ROW_KEY_PREFIX)}]`);
		const key = row?.getAttribute("data-row-key");
		if (key?.startsWith(ROW_KEY_PREFIX) === true) {
			ids.push(key.slice(ROW_KEY_PREFIX.length));
		}
	}
	return ids;
}

/**
 * 純正の一覧を探して追う
 *
 * サイドバーの開閉 検索 表示の切り替えで木は作り直されるため document の
 * 変化を監視し フレームごとに1回だけ探し直す
 *
 * @returns 今の姿
 */
function useSurface(): Surface {
	const [surface, setSurface] = useState<Surface>(NO_SURFACE);
	useEffect(() => {
		let frame = 0;
		const scan = () => {
			frame = 0;
			const slot = document.querySelector<HTMLElement>(SLOT_SELECTOR);
			let tree: HTMLElement | null = null;
			for (const candidate of Array.from(
				slot?.querySelectorAll<HTMLElement>('[role="tree"]') ?? [],
			)) {
				if (readSectionIds(candidate).length > 0) {
					tree = candidate;
					break;
				}
			}
			const headerCandidate = slot?.firstElementChild?.firstElementChild;
			const header =
				headerCandidate instanceof HTMLElement &&
				headerCandidate.querySelector("input") !== null
					? headerCandidate
					: null;
			const sectionIds = tree === null ? [] : readSectionIds(tree);
			setSurface((current) =>
				current.tree === tree &&
				current.header === header &&
				current.sectionIds.join("\n") === sectionIds.join("\n")
					? current
					: { tree, header, sectionIds },
			);
		};
		const schedule = () => {
			if (frame === 0) {
				frame = requestAnimationFrame(scan);
			}
		};
		scan();
		const observer = new MutationObserver(schedule);
		observer.observe(document.body, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, []);
	return surface;
}

/**
 * DSH の言語設定に合う文言
 *
 * @returns 今の言語の文言
 */
function useMessages(): Messages {
	const [lang, setLang] = useState(() => document.documentElement.lang);
	useEffect(() => {
		const observer = new MutationObserver(() => {
			setLang(document.documentElement.lang);
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["lang"],
		});
		return () => {
			observer.disconnect();
		};
	}, []);
	return useMemo(() => messagesFor(lang), [lang]);
}

/**
 * 新しいフォルダの id
 *
 * @returns 重ならない id
 */
function newId(): string {
	return (
		globalThis.crypto?.randomUUID?.() ??
		`f${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
	);
}

/**
 * フォルダの先頭のアイコン
 *
 * @param props - フォルダと開閉
 * @returns 選んだアイコンか 純正と同じフォルダのアイコン
 */
function FolderIcon({
	folder,
	open,
}: {
	folder?: Folder | undefined;
	open: boolean;
}) {
	if (folder?.icon !== undefined) {
		return <IconGlyph value={folder.icon} />;
	}
	return open ? <IconFolderOpenRegular /> : <IconFolderCloseRegular />;
}

/**
 * 見出し行の案内線を style へ直す
 *
 * @param depth - 字下げの段数
 * @returns style へ渡す値
 */
function guideStyle(depth: number): CSSProperties {
	const style: Record<string, string> = {};
	for (const declaration of guideBackground(depth).split(";")) {
		const colon = declaration.indexOf(":");
		if (colon > 0) {
			const name = declaration
				.slice(0, colon)
				.replace(/-([a-z])/g, (_match: string, letter: string) =>
					letter.toUpperCase(),
				);
			style[name] = declaration.slice(colon + 1);
		}
	}
	return style;
}

/**
 * イベントの起きた場所を含む 純正のワークスペース群の id
 *
 * @param tree - 純正の一覧の木
 * @param target - イベントの対象
 * @returns 群の id 見出し行や木の外なら undefined
 */
function sectionAt(
	tree: HTMLElement,
	target: EventTarget | null,
): string | undefined {
	let node = target instanceof Element ? target : null;
	while (node !== null && node.parentElement !== tree) {
		node = node.parentElement;
	}
	if (node === null || node.classList.contains("dwf-row")) {
		return undefined;
	}
	const key = node
		.querySelector(`[data-row-key^=${quote(ROW_KEY_PREFIX)}]`)
		?.getAttribute("data-row-key");
	return key?.startsWith(ROW_KEY_PREFIX) === true
		? key.slice(ROW_KEY_PREFIX.length)
		: undefined;
}

/**
 * ドラッグ中の指が行のどこにあるか
 *
 * フォルダを運んでいるときは 上下の4分の1を前後 真ん中を中とする
 * ワークスペースを運んでいるときと 未分類の行では常に中とする
 *
 * @param event - ドラッグのイベント
 * @param reorderable - 前後へ置ける行か
 * @returns 置く位置
 */
function dropPosition(event: DragEvent, reorderable: boolean): DropPosition {
	if (!reorderable || !event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) {
		return "inside";
	}
	const rect = event.currentTarget.getBoundingClientRect();
	const ratio = (event.clientY - rect.top) / rect.height;
	if (ratio < 0.25) {
		return "before";
	}
	return ratio > 0.75 ? "after" : "inside";
}

/**
 * 見出し行1つ
 *
 * @param props - 行の中身と操作
 * @returns 行
 */
function HeadingRowView({
	row,
	label,
	menuItems,
	onMenuSelect,
	onToggle,
	onDropWorkspace,
	onDropFolder,
	highlighted,
	first,
	activity,
	t,
}: {
	row: HeadingRow;
	activity: Activity | undefined;
	label: string;
	menuItems: readonly MenuEntry[];
	onMenuSelect: (id: string) => void;
	onToggle: () => void;
	onDropWorkspace: (workspaceId: string) => void;
	onDropFolder: (folderId: string, position: DropPosition) => void;
	highlighted: boolean;
	first: boolean;
	t: Messages;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [drop, setDrop] = useState<DropPosition | null>(null);
	const accepts = (event: DragEvent) =>
		event.dataTransfer.types.includes(FOLDER_DRAG_TYPE) ||
		event.dataTransfer.types.includes("text/plain");
	return (
		<div
			className={[
				"dwf-row",
				menuOpen ? "dwf-menuOpen" : "",
				drop === null ? "" : `dwf-drop-${drop}`,
				highlighted ? "dwf-drop-inside" : "",
				first ? "dwf-first" : "",
				!first && row.depth === 0 ? "dwf-top" : "",
			]
				.filter(Boolean)
				.join(" ")}
			style={
				{
					order: row.order,
					"--dwf-indent": `${row.depth * INDENT_PX}px`,
					...guideStyle(row.depth),
				} as CSSProperties
			}
			role="treeitem"
			tabIndex={0}
			aria-expanded={!row.collapsed}
			onClick={onToggle}
			onKeyDown={(event) => {
				if (
					event.target === event.currentTarget &&
					(event.key === "Enter" || event.key === " ")
				) {
					event.preventDefault();
					onToggle();
				}
			}}
			draggable={row.folder !== undefined}
			onDragStart={(event) => {
				if (row.folder === undefined) {
					return;
				}
				event.stopPropagation();
				event.dataTransfer.effectAllowed = "move";
				event.dataTransfer.setData(FOLDER_DRAG_TYPE, row.folder.id);
			}}
			onDragOver={(event) => {
				if (!accepts(event)) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				event.dataTransfer.dropEffect = "move";
				setDrop(dropPosition(event, row.folder !== undefined));
			}}
			onDragLeave={() => {
				setDrop(null);
			}}
			onDrop={(event) => {
				const position = dropPosition(event, row.folder !== undefined);
				setDrop(null);
				const folderId = event.dataTransfer.getData(FOLDER_DRAG_TYPE);
				if (folderId !== "") {
					event.preventDefault();
					event.stopPropagation();
					onDropFolder(folderId, position);
					return;
				}
				const text = event.dataTransfer.getData("text/plain");
				if (text !== "") {
					event.preventDefault();
					onDropWorkspace(text);
				}
			}}
		>
			{activity !== undefined && (
				<span className="dwf-activity" data-state={activity} aria-hidden />
			)}
			<span className="dwf-slot">
				<IconTriangleRightFillRegular
					className={row.collapsed ? "dwf-arrow" : "dwf-arrow dwf-arrowOpen"}
				/>
			</span>
			<span className="dwf-slot">
				<FolderIcon folder={row.folder} open={!row.collapsed} />
			</span>
			<span className="dwf-title">{label}</span>
			{row.collapsed && row.count > 0 && (
				<span className="dwf-count" title={t.count(row.count)}>
					{row.count}
				</span>
			)}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: 行の開閉を止めるだけで 操作は中のボタンが持つ */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: 同上 */}
			<span
				className="dwf-actions"
				onClick={(event) => {
					event.stopPropagation();
				}}
			>
				<Menu
					open={menuOpen}
					onClose={() => {
						setMenuOpen(false);
					}}
					items={menuItems}
					onSelect={(id) => {
						setMenuOpen(false);
						onMenuSelect(id);
					}}
					portal
					closeOnPointerLeave
					anchor={
						<button
							type="button"
							className="dwf-iconButton"
							aria-label={t.folderActions(label)}
							onClick={() => {
								setMenuOpen((open) => !open);
							}}
						>
							<IconEllipsisOutlineRegular />
						</button>
					}
				/>
			</span>
		</div>
	);
}

/**
 * フォルダ行の「…」メニュー
 *
 * @param state - 今の状態
 * @param folder - 対象のフォルダ
 * @param workspaces - 純正のワークスペース
 * @param t - 文言
 * @returns メニューの行
 */
function folderMenu(
	state: FolderState,
	folder: Folder,
	workspaces: readonly WorkspaceRow[],
	t: Messages,
): MenuEntry[] {
	const siblings = childFolders(state, folder.parentId);
	const blocked = descendantIds(state, folder.id);
	blocked.add(folder.id);
	const targets = state.folders
		.filter((candidate) => !blocked.has(candidate.id))
		.map((candidate) => ({
			id: `move:${candidate.id}`,
			label: folderPath(state, candidate.id),
		}))
		.sort((a, b) =>
			a.label.localeCompare(b.label, undefined, { numeric: true }),
		);
	const addable = workspaces
		.filter(
			(workspace) => state.assignments[workspace.workspaceId] !== folder.id,
		)
		.map((workspace) => ({
			id: `assign:${workspace.workspaceId}`,
			label: workspace.title,
		}));
	return [
		{ id: "rename", label: t.rename, icon: <IconEditOutlineRegular /> },
		{
			id: "icon",
			label: t.changeIcon,
			icon: <FolderIcon folder={folder} open={false} />,
		},
		{
			id: "subfolder",
			label: t.newSubfolder,
			icon: <IconPlusOutlineRegular />,
		},
		{ type: "separator", id: "order" },
		{
			id: "up",
			label: t.moveUp,
			icon: <IconChevronUpOutlineRegular />,
			...(siblings[0]?.id === folder.id ? { disabled: true } : {}),
		},
		{
			id: "down",
			label: t.moveDown,
			icon: <IconChevronDownOutlineRegular />,
			...(siblings.at(-1)?.id === folder.id ? { disabled: true } : {}),
		},
		{ type: "separator", id: "place" },
		{
			id: "assign",
			label: t.addWorkspace,
			icon: <IconFolderOpenRegular />,
			...(addable.length === 0 ? { disabled: true } : { submenu: addable }),
		},
		{
			id: "move",
			label: t.moveTo,
			icon: <IconTriangleRightFillRegular />,
			submenu: [
				...(folder.parentId === undefined
					? []
					: [{ id: "move:", label: t.topLevel }]),
				...targets,
			],
			...(folder.parentId === undefined && targets.length === 0
				? { disabled: true }
				: {}),
		},
		{ type: "separator", id: "danger" },
		{
			id: "delete",
			label: t.deleteFolder,
			icon: <IconTrashOutlineRegular />,
			danger: true,
		},
	];
}

/**
 * 名前を入れるダイアログ
 *
 * @param props - 見出し 初期値 確定時の処理
 * @returns ダイアログ
 */
function NameDialog({
	title,
	initial,
	confirmLabel,
	onConfirm,
	onClose,
	t,
}: {
	title: string;
	initial: string;
	confirmLabel: string;
	onConfirm: (name: string) => void;
	onClose: () => void;
	t: Messages;
}) {
	const [draft, setDraft] = useState(initial);
	const trimmed = draft.trim();
	const submit = () => {
		if (trimmed !== "") {
			onConfirm(trimmed);
		}
	};
	return (
		<Modal
			open
			onClose={onClose}
			title={title}
			closeLabel={t.close}
			footer={
				<>
					<Button
						variant="outline"
						className="dwf-modalAction"
						onClick={onClose}
					>
						{t.cancel}
					</Button>
					<Button
						variant="primary"
						className="dwf-modalAction"
						disabled={trimmed === ""}
						onClick={submit}
					>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<Input
				data-modal-autofocus
				value={draft}
				placeholder={t.namePlaceholder}
				maxLength={80}
				onChange={(event) => {
					setDraft(event.target.value);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.nativeEvent.isComposing) {
						// 閉じたダイアログが焦点を引き金のボタンへ返すため 既定の動作を
						// 止めないと 同じ Enter がそのボタンを押して作成画面が開き直す
						event.preventDefault();
						submit();
					}
				}}
			/>
		</Modal>
	);
}

/**
 * 画像のアイコンを保存する
 *
 * @param icons - 足すアイコン
 */
function addCustom(icons: readonly CustomIcon[]): void {
	store.update((state) => addCustomIcons(state, icons));
}

/**
 * 画像のアイコンを消す 使っていたフォルダとワークスペースは既定へ戻る
 *
 * @param id - 消すアイコン
 */
function removeCustom(id: string): void {
	store.update((state) => removeCustomIcon(state, id));
}

/**
 * 開いているダイアログを描く
 *
 * @param props - ダイアログと閉じる処理
 * @returns ダイアログ 開いていなければ null
 */
function DialogView({
	dialog,
	onClose,
	t,
}: {
	dialog: Dialog | null;
	onClose: () => void;
	t: Messages;
}): ReactNode {
	if (dialog === null) {
		return null;
	}
	switch (dialog.kind) {
		case "create":
			return (
				<NameDialog
					title={t.createTitle}
					initial=""
					confirmLabel={t.create}
					onClose={onClose}
					t={t}
					onConfirm={(name) => {
						const id = newId();
						store.update((state) => {
							const created = createFolder(state, id, name, dialog.parentId);
							return dialog.assign === undefined
								? created
								: assignWorkspace(created, dialog.assign, id);
						});
						onClose();
					}}
				/>
			);
		case "rename":
			return (
				<NameDialog
					title={t.renameTitle}
					initial={dialog.folder.name}
					confirmLabel={t.save}
					onClose={onClose}
					t={t}
					onConfirm={(name) => {
						store.update((state) =>
							renameFolder(state, dialog.folder.id, name),
						);
						onClose();
					}}
				/>
			);
		case "icon":
			return (
				<IconPicker
					title={t.iconTitle}
					value={dialog.folder.icon ?? ""}
					onClose={onClose}
					t={t}
					newId={newId}
					onAddCustom={addCustom}
					onRemoveCustom={removeCustom}
					onConfirm={(icon) => {
						store.update((state) =>
							setFolderIcon(state, dialog.folder.id, icon),
						);
						onClose();
					}}
				/>
			);
		case "workspaceIcon":
			return (
				<IconPicker
					title={t.workspaceIconTitle(dialog.title)}
					value={store.getSnapshot().icons?.[dialog.workspaceId] ?? ""}
					onClose={onClose}
					t={t}
					newId={newId}
					onAddCustom={addCustom}
					onRemoveCustom={removeCustom}
					onConfirm={(icon) => {
						store.update((state) =>
							setWorkspaceIcon(state, dialog.workspaceId, icon),
						);
						onClose();
					}}
				/>
			);
		case "delete":
			return (
				<Modal
					open
					onClose={onClose}
					title={t.deleteTitle}
					closeLabel={t.close}
					footer={
						<>
							<Button
								variant="outline"
								className="dwf-modalAction"
								onClick={onClose}
							>
								{t.cancel}
							</Button>
							<Button
								variant="primary"
								className="dwf-modalAction"
								onClick={() => {
									store.update((state) =>
										deleteFolder(state, dialog.folder.id),
									);
									onClose();
								}}
							>
								{t.delete}
							</Button>
						</>
					}
				>
					<p className="dwf-modalText">{t.deleteBody(dialog.folder.name)}</p>
				</Modal>
			);
	}
}

/**
 * 純正のワークスペース行の「…」メニューの今の姿
 */
interface WorkspaceMenu {
	/**
	 * メニューを開いているワークスペース
	 */
	workspaceId: string;
	/**
	 * 行を足す先 純正のメニューの項目が並ぶ要素
	 */
	viewport: HTMLElement;
}

/**
 * 純正のワークスペース行の「…」メニューが開いているかを追う
 *
 * 純正のメニューは項目を外から足す口を持たないため 開いている間に行へ付く
 * `_menuOpen` と body 直下へ描かれるメニューを見つけ 項目の並ぶ要素を返す
 *
 * @param tree - 純正の一覧の木
 * @returns 開いているメニュー 無ければ null
 */
function useWorkspaceMenu(tree: HTMLElement | null): WorkspaceMenu | null {
	const [menu, setMenu] = useState<WorkspaceMenu | null>(null);
	useEffect(() => {
		if (tree === null) {
			setMenu(null);
			return;
		}
		let frame = 0;
		const scan = () => {
			frame = 0;
			const row = tree.querySelector(
				`[data-row-key^=${quote(ROW_KEY_PREFIX)}][class*="_menuOpen"]`,
			);
			const key = row?.getAttribute("data-row-key") ?? "";
			const menus = document.body.querySelectorAll<HTMLElement>(
				':scope > [role="menu"][data-menu-material] > [role="presentation"]',
			);
			const viewport = menus[menus.length - 1];
			const next =
				key.length > ROW_KEY_PREFIX.length && viewport !== undefined
					? { workspaceId: key.slice(ROW_KEY_PREFIX.length), viewport }
					: null;
			setMenu((current) =>
				current?.workspaceId === next?.workspaceId &&
				current?.viewport === next?.viewport
					? current
					: next,
			);
		};
		const schedule = () => {
			if (frame === 0) {
				frame = requestAnimationFrame(scan);
			}
		};
		scan();
		const observer = new MutationObserver(schedule);
		observer.observe(document.body, { childList: true });
		observer.observe(tree, {
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [tree]);
	return menu;
}

/**
 * 純正の「…」メニューへ項目を1つ足す
 *
 * React のポータルで足すと 純正のメニューは指が項目へ移ったのを外へ出たと
 * 受け取り 200ms 後に閉じてしまう そのため純正の項目を DOM のまま複製し
 * 純正の木の中の要素として扱わせる 危険な項目（削除）があればその前へ置く
 *
 * @param viewport - 純正のメニューの項目が並ぶ要素
 * @param label - 項目の文言
 * @param icon - 先頭に出すアイコンの見本 複製して使う
 * @param onSelect - 選ばれたときの処理
 * @returns 取り除く関数 足せなかったときは undefined
 */
function insertShippedMenuItem(
	viewport: HTMLElement,
	label: string,
	icon: Element | null,
	onSelect: () => void,
): (() => void) | undefined {
	const items = Array.from(
		viewport.querySelectorAll<HTMLButtonElement>(
			':scope > * > button[role="menuitem"]',
		),
	);
	const sample = items.find((item) => !/_danger/.test(item.className));
	const sampleWrap = sample?.parentElement;
	if (sample === undefined || sampleWrap == null) {
		return undefined;
	}
	const wrap = document.createElement("div");
	wrap.className = sampleWrap.className;
	const button = sample.cloneNode(true) as HTMLButtonElement;
	button.disabled = false;
	button.removeAttribute("aria-keyshortcuts");
	button.removeAttribute("aria-current");
	for (const extra of Array.from(
		button.querySelectorAll('[class*="_shortcut"], [class*="_check"]'),
	)) {
		extra.remove();
	}
	const text = button.querySelector('[class*="_itemLabel"]');
	if (text === null) {
		return undefined;
	}
	text.textContent = label;
	const iconSlot = button.querySelector('[class*="_itemIcon"]');
	if (iconSlot !== null && icon !== null) {
		iconSlot.replaceChildren(icon.cloneNode(true));
	}
	button.addEventListener("click", onSelect);
	wrap.append(button);
	const danger = items.find((item) => /_danger/.test(item.className));
	const before = danger?.parentElement;
	if (before != null && before.parentElement === viewport) {
		viewport.insertBefore(wrap, before);
	} else {
		viewport.append(wrap);
	}
	return () => {
		button.removeEventListener("click", onSelect);
		wrap.remove();
	};
}

/**
 * 純正の「…」メニューを閉じる
 *
 * 純正のメニューは外側の pointerdown で閉じるため 同じ合図を body へ送る
 */
function closeShippedMenu(): void {
	document.body.dispatchEvent(
		new PointerEvent("pointerdown", { bubbles: true }),
	);
}

/**
 * 純正のワークスペースの一覧を読む
 *
 * @param useWorkspaces - 根の読み口 無い構成では undefined
 * @returns ワークスペースと 読み終えたか
 */
function useWorkspaceRows(useWorkspaces: OverlayProps["useWorkspaces"]): {
	rows: readonly WorkspaceRow[];
	ready: boolean;
	archived: readonly string[] | undefined;
} {
	const fallback = (
		selector: (snapshot: {
			items: readonly WorkspaceRow[];
			phase: string;
		}) => unknown,
	) => selector({ items: [], phase: "pending" });
	const read = (useWorkspaces ?? fallback) as NonNullable<
		OverlayProps["useWorkspaces"]
	>;
	const items = read((snapshot) => snapshot.items);
	const phase = read((snapshot) => snapshot.phase);
	const archived = read((snapshot) => snapshot.archivedSessionIds);
	return { rows: items, ready: phase === "ready", archived };
}

/**
 * 空の読み口 ui-session が無い構成で使う
 *
 * @param selector - 読む関数
 * @returns 何も無いときの値
 */
function noSource<T>(selector: (snapshot: never) => T): T {
	return selector(undefined as never);
}

/**
 * ワークスペースごとに 中のセッションの一番強い状態を読む
 *
 * 純正のセッション行と同じく 走っているサブエージェントも進行中に数える
 *
 * @param props - 浮き層が配る読み口と ワークスペース
 * @returns 状態のあるワークスペースだけの対応
 */
function useWorkspaceActivities({
	useSessions,
	useSessionStatus,
	workspaces,
	archived,
}: {
	useSessions: OverlayProps["useSessions"];
	useSessionStatus: OverlayProps["useSessionStatus"];
	workspaces: readonly WorkspaceRow[];
	archived: readonly string[] | undefined;
}): ReadonlyMap<string, Activity> {
	const readSessions = (useSessions ?? noSource) as NonNullable<
		OverlayProps["useSessions"]
	>;
	const readStatus = (useSessionStatus ?? noSource) as NonNullable<
		OverlayProps["useSessionStatus"]
	>;
	const list = readSessions((snapshot) => snapshot as SessionList | undefined);
	const statuses = readStatus(
		(snapshot) =>
			snapshot as ReadonlyMap<string, SessionStatusFacts> | undefined,
	);
	return useMemo(() => {
		if (list === undefined && statuses === undefined) {
			return NO_ACTIVITIES;
		}
		const running = (id: string) =>
			(statuses?.get(id)?.running ?? list?.byId[id]?.running) === true;
		const activities = workspaceActivities(
			workspaces,
			new Set(archived ?? []),
			(sessionId) => {
				const own = sessionActivity(
					statuses?.get(sessionId),
					list?.byId[sessionId]?.running,
				);
				const children =
					list?.projectionsBySession?.[sessionId]?.values?.subagentCatalog ??
					[];
				return children.some((child) => running(child.id))
					? strongerActivity(own, "ongoing")
					: own;
			},
		);
		return activities.size === 0 ? NO_ACTIVITIES : activities;
	}, [list, statuses, workspaces, archived]);
}

/**
 * フォルダの見出しと 並びの CSS を純正の一覧へ足す
 *
 * @param props - 浮き層が配る props
 * @returns ポータルとダイアログ
 */
function WorkspaceFolders({
	useWorkspaces,
	useSessions,
	useSessionStatus,
}: OverlayProps) {
	const t = useMessages();
	const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
	const { tree, header, sectionIds } = useSurface();
	const { rows: workspaces, ready, archived } = useWorkspaceRows(useWorkspaces);
	const workspaceActivity = useWorkspaceActivities({
		useSessions,
		useSessionStatus,
		workspaces,
		archived,
	});
	const folderActivity = useMemo(
		() => folderActivities(state, workspaceActivity),
		[state, workspaceActivity],
	);
	useLayoutEffect(
		() => installStyle(ACTIVITY_TAG_ID, activityCss(workspaceActivity)),
		[workspaceActivity],
	);
	const [dialog, setDialog] = useState<Dialog | null>(null);
	const layout = useMemo(
		() => computeLayout(state, sectionIds),
		[state, sectionIds],
	);
	const css = useMemo(() => layoutCss(layout), [layout]);

	const motion = useMemo(createRowMotion, []);
	const ownChange = useRef(false);
	const update = (change: (current: FolderState) => FolderState) => {
		ownChange.current = true;
		store.update(change);
	};

	useLayoutEffect(() => {
		motion.attach(tree);
		return () => motion.attach(null);
	}, [motion, tree]);

	const glyphs = useRef<HTMLDivElement>(null);
	const [svgs, setSvgs] = useState<ReadonlyMap<string, string>>(new Map());
	useLayoutEffect(() => {
		const map = new Map<string, string>();
		for (const element of Array.from(
			glyphs.current?.querySelectorAll<HTMLElement>("[data-icon]") ?? [],
		)) {
			const svg = element.querySelector("svg");
			if (svg !== null) {
				map.set(element.dataset.icon ?? "", svg.outerHTML);
			}
		}
		setSvgs(map);
	}, []);
	const icons = useMemo(
		() =>
			iconCss(state.icons, (value) => {
				const custom = customIconOf(state.customIcons ?? [], value);
				if (custom !== undefined) {
					return { src: custom.src, tint: custom.tint === true };
				}
				const svg = svgs.get(value);
				return svg === undefined
					? undefined
					: {
							src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
							tint: true,
						};
			}),
		[state.icons, state.customIcons, svgs],
	);
	useLayoutEffect(() => installStyle(ICON_TAG_ID, icons), [icons]);

	useLayoutEffect(() => {
		const style = installStyle(LAYOUT_TAG_ID, css);
		motion.sync(ownChange.current);
		ownChange.current = false;
		return style;
	}, [css, motion]);

	const folderOfSection = (workspaceId: string): string =>
		layout.sections.has(workspaceId)
			? (state.assignments[workspaceId] ?? UNASSIGNED_ID)
			: UNASSIGNED_ID;
	const [sectionTarget, setSectionTarget] = useState<string | null>(null);

	useEffect(() => {
		if (tree === null || !layout.active) {
			return;
		}
		const carrying = (event: globalThis.DragEvent) =>
			event.dataTransfer?.types.includes(FOLDER_DRAG_TYPE) === true;
		const onOver = (event: globalThis.DragEvent) => {
			const section = sectionAt(tree, event.target);
			if (section === undefined || section === "") {
				setSectionTarget(null);
				return;
			}
			const folderId = folderOfSection(section);
			if (carrying(event)) {
				if (folderId === UNASSIGNED_ID) {
					setSectionTarget(null);
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				setSectionTarget(folderId);
				return;
			}
			setSectionTarget(null);
		};
		const onDrop = (event: globalThis.DragEvent) => {
			const section = sectionAt(tree, event.target);
			setSectionTarget(null);
			if (section === undefined || section === "") {
				return;
			}
			const folderId = folderOfSection(section);
			const movingFolder = event.dataTransfer?.getData(FOLDER_DRAG_TYPE) ?? "";
			if (movingFolder !== "") {
				if (folderId !== UNASSIGNED_ID) {
					event.preventDefault();
					event.stopPropagation();
					update((current) =>
						placeFolder(current, movingFolder, folderId, "inside"),
					);
				}
				return;
			}
			const workspaceId = event.dataTransfer?.getData("text/plain") ?? "";
			if (
				workspaceId !== "" &&
				knownWorkspace(workspaceId) &&
				workspaceId !== section
			) {
				update((current) =>
					assignWorkspace(
						current,
						workspaceId,
						folderId === UNASSIGNED_ID ? undefined : folderId,
					),
				);
			}
		};
		const onEnd = () => {
			setSectionTarget(null);
		};
		const onLeave = (event: globalThis.DragEvent) => {
			if (
				!(event.relatedTarget instanceof Node) ||
				!tree.contains(event.relatedTarget)
			) {
				setSectionTarget(null);
			}
		};
		tree.addEventListener("dragleave", onLeave, true);
		tree.addEventListener("dragover", onOver, true);
		tree.addEventListener("drop", onDrop, true);
		document.addEventListener("dragend", onEnd, true);
		document.addEventListener("drop", onEnd, true);
		return () => {
			tree.removeEventListener("dragleave", onLeave, true);
			tree.removeEventListener("dragover", onOver, true);
			tree.removeEventListener("drop", onDrop, true);
			document.removeEventListener("dragend", onEnd, true);
			document.removeEventListener("drop", onEnd, true);
		};
	});

	const workspaceMenu = useWorkspaceMenu(tree);
	const iconTemplate = useRef<HTMLSpanElement>(null);
	const openWorkspaceIcon = useRef<(workspaceId: string) => void>(
		() => undefined,
	);
	openWorkspaceIcon.current = (workspaceId) => {
		setDialog({
			kind: "workspaceIcon",
			workspaceId,
			title:
				workspaces.find((workspace) => workspace.workspaceId === workspaceId)
					?.title ?? workspaceId,
		});
	};

	useEffect(() => {
		if (workspaceMenu === null) {
			return;
		}
		const { workspaceId, viewport } = workspaceMenu;
		const icon = iconTemplate.current?.firstElementChild ?? null;
		return insertShippedMenuItem(viewport, t.changeIcon, icon, () => {
			closeShippedMenu();
			openWorkspaceIcon.current(workspaceId);
		});
	}, [workspaceMenu, t]);

	useEffect(() => {
		if (!ready) {
			return;
		}
		const ids = new Set(workspaces.map((workspace) => workspace.workspaceId));
		store.update((current) => pruneWorkspaces(current, ids));
	}, [ready, workspaces]);

	const knownWorkspace = (id: string) =>
		workspaces.some((workspace) => workspace.workspaceId === id) ||
		sectionIds.includes(id);

	const onFolderMenu = (folder: Folder, id: string) => {
		if (id === "rename") {
			setDialog({ kind: "rename", folder });
		} else if (id === "icon") {
			setDialog({ kind: "icon", folder });
		} else if (id === "subfolder") {
			setDialog({ kind: "create", parentId: folder.id });
		} else if (id === "delete") {
			setDialog({ kind: "delete", folder });
		} else if (id === "up" || id === "down") {
			update((current) =>
				shiftFolder(current, folder.id, id === "up" ? -1 : 1),
			);
		} else if (id.startsWith("assign:")) {
			update((current) =>
				assignWorkspace(current, id.slice("assign:".length), folder.id),
			);
		} else if (id.startsWith("move:")) {
			const target = id.slice("move:".length);
			update((current) =>
				moveFolder(current, folder.id, target === "" ? undefined : target),
			);
		}
	};

	const headings =
		tree === null
			? null
			: layout.rows
					.filter((row) => !row.hidden)
					.map((row, index) => {
						const folder = row.folder;
						const key = folder?.id ?? UNASSIGNED_ID;
						return (
							<HeadingRowView
								key={`dwf:${key}`}
								row={row}
								highlighted={sectionTarget === key}
								activity={folderActivity.get(key)}
								first={index === 0}
								label={folder?.name ?? t.unassigned}
								t={t}
								menuItems={
									folder === undefined
										? [
												{
													id: "create",
													label: t.newFolder,
													icon: <IconPlusOutlineRegular />,
												},
											]
										: folderMenu(state, folder, workspaces, t)
								}
								onMenuSelect={(id) => {
									if (folder === undefined) {
										setDialog({ kind: "create" });
									} else {
										onFolderMenu(folder, id);
									}
								}}
								onToggle={() => {
									update((current) => toggleCollapsed(current, key));
								}}
								onDropWorkspace={(workspaceId) => {
									if (knownWorkspace(workspaceId)) {
										update((current) =>
											assignWorkspace(current, workspaceId, folder?.id),
										);
									}
								}}
								onDropFolder={(folderId, position) => {
									update((current) =>
										folder === undefined
											? moveFolder(current, folderId)
											: placeFolder(current, folderId, folder.id, position),
									);
								}}
							/>
						);
					});

	return (
		<CustomIconsContext.Provider value={state.customIcons ?? NO_CUSTOM_ICONS}>
			{tree !== null && headings !== null && createPortal(headings, tree)}
			{header !== null &&
				createPortal(
					<Tooltip label={t.newFolder} side="bottom" delayMs={500}>
						<button
							type="button"
							className="dwf-headerButton"
							aria-label={t.newFolder}
							onClick={() => {
								setDialog({ kind: "create" });
							}}
						>
							<IconFolderCloseRegular size={16} />
						</button>
					</Tooltip>,
					header,
				)}
			<span ref={iconTemplate} hidden>
				<IconFolderCloseRegular />
			</span>
			<div ref={glyphs} hidden>
				{DSH_ICONS.map((icon) => (
					<span key={icon.value} data-icon={icon.value}>
						<IconGlyph value={icon.value} size={16} />
					</span>
				))}
			</div>
			<DialogView
				dialog={dialog}
				t={t}
				onClose={() => {
					setDialog(null);
				}}
			/>
		</CustomIconsContext.Provider>
	);
}

/**
 * 浮き層へ常駐する部品を登録する
 *
 * @param ctx - クライアント側 cordis コンテキスト
 */
export function apply(ctx: Context): void {
	ctx.effect(
		() => installStyle(STYLE_TAG_ID, STYLE + activityStyle()),
		"workspace-folders: style",
	);
	ctx.effect(
		() => () => {
			document.getElementById(LAYOUT_TAG_ID)?.remove();
			document.getElementById(ICON_TAG_ID)?.remove();
			document.getElementById(ACTIVITY_TAG_ID)?.remove();
		},
		"workspace-folders: layout cleanup",
	);
	ctx.inject(["configForms"], (scope) => {
		scope.effect(
			() => store.attach(scope.configForms.get(SETTINGS_ENTRY_ID)),
			"workspace-folders: host state",
		);
	});
	ctx.slots.inject(OVERLAY, () =>
		ctx.slots.register({ name: OVERLAY, id: ENTRY_ID }, WorkspaceFolders),
	);
}
