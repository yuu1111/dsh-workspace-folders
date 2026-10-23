/**
 * フォルダの状態と 並びの計算
 *
 * React と DOM に依存しない純粋な関数だけを置く 状態はブラウザの
 * localStorage へ JSON のまま保存するため plain なオブジェクトに保つ
 */

/**
 * 1つのフォルダ
 */
export interface Folder {
	/**
	 * 生成時に決める識別子
	 */
	id: string;
	/**
	 * 表示名
	 */
	name: string;
	/**
	 * 既定のフォルダアイコンの代わりに出す絵文字
	 */
	icon?: string;
	/**
	 * 親フォルダ 無ければ最上位
	 */
	parentId?: string;
	/**
	 * 折りたたんでいるか
	 */
	collapsed?: boolean;
}

/**
 * 利用者が追加した画像のアイコン
 */
export interface CustomIcon {
	/**
	 * 生成時に決める識別子 値は {@link CUSTOM_ICON_PREFIX} を前に付けて使う
	 */
	id: string;
	/**
	 * 検索と表示に使う名前
	 */
	name: string;
	/**
	 * 縮めた画像の data URL
	 */
	src: string;
	/**
	 * 形だけを使い 文字色で塗るか 単色のロゴのとき true
	 */
	tint?: boolean;
}

/**
 * 利用者が追加した画像のアイコンを指す値の接頭辞
 */
export const CUSTOM_ICON_PREFIX = "custom:";

/**
 * 保存する状態の全体
 */
export interface FolderState {
	/**
	 * 形の版 形を変えるときに上げる
	 */
	version: 1;
	/**
	 * 作成順のフォルダ
	 */
	folders: Folder[];
	/**
	 * ワークスペース id から入っているフォルダ id への対応
	 */
	assignments: Record<string, string>;
	/**
	 * 「未分類」を折りたたんでいるか
	 */
	unassignedCollapsed?: boolean;
	/**
	 * ワークスペース id から 純正のフォルダアイコンの代わりに出す絵文字への対応
	 *
	 * 後から足した任意の項目なので 版は上げない
	 */
	icons?: Record<string, string>;
	/**
	 * 利用者が追加した画像のアイコン 追加した順
	 */
	customIcons?: CustomIcon[];
}

/**
 * フォルダが1つも無い状態
 */
export const EMPTY_STATE: FolderState = {
	version: 1,
	folders: [],
	assignments: {},
};

/**
 * どのフォルダにも入っていないワークスペース群の見出しを指す id
 */
export const UNASSIGNED_ID = "";

/**
 * 1段の字下げ
 *
 * 親には三角とアイコン 子Projectにはアイコンだけがあるため
 * 22pxではアイコン位置が揃ってしまう さらに14px右へ寄せて親子を区別する
 */
export const INDENT_PX = 36;

/**
 * 値が plain なオブジェクトか
 *
 * @param value - 調べる値
 * @returns オブジェクトなら true
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 保存された1件をフォルダとして読む
 *
 * @param value - 保存された値
 * @returns 読めたフォルダ 形が違えば undefined
 */
function parseFolder(value: unknown): Folder | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	const { id, name, icon, parentId, collapsed } = value;
	if (typeof id !== "string" || id === "" || typeof name !== "string") {
		return undefined;
	}
	const folder: Folder = { id, name };
	if (typeof icon === "string" && icon !== "") {
		folder.icon = icon;
	}
	if (typeof parentId === "string" && parentId !== "") {
		folder.parentId = parentId;
	}
	if (collapsed === true) {
		folder.collapsed = true;
	}
	return folder;
}

/**
 * 保存されたフォルダの並びを読む 重なる id は最初の1件だけ残す
 *
 * @param value - 保存された値
 * @returns 読めたフォルダ
 */
function parseFolders(value: unknown): Folder[] {
	const seen = new Set<string>();
	const folders: Folder[] = [];
	for (const entry of Array.isArray(value) ? value : []) {
		const folder = parseFolder(entry);
		if (folder !== undefined && !seen.has(folder.id)) {
			seen.add(folder.id);
			folders.push(folder);
		}
	}
	return folders;
}

/**
 * 保存された割り当てを読む 知らないフォルダを指すものは捨てる
 *
 * @param value - 保存された値
 * @param known - 存在するフォルダ id
 * @returns 読めた割り当て
 */
function parseAssignments(
	value: unknown,
	known: ReadonlySet<string>,
): Record<string, string> {
	const assignments: Record<string, string> = {};
	if (isRecord(value)) {
		for (const [workspaceId, folderId] of Object.entries(value)) {
			if (typeof folderId === "string" && known.has(folderId)) {
				assignments[workspaceId] = folderId;
			}
		}
	}
	return assignments;
}

/**
 * 保存されたワークスペースのアイコンを読む
 *
 * @param value - 保存された値
 * @returns 読めたアイコン 1つも無ければ undefined
 */
function parseIcons(value: unknown): Record<string, string> | undefined {
	if (!isRecord(value)) {
		return undefined;
	}
	const icons: Record<string, string> = {};
	for (const [workspaceId, icon] of Object.entries(value)) {
		if (workspaceId !== "" && typeof icon === "string" && icon !== "") {
			icons[workspaceId] = icon;
		}
	}
	return Object.keys(icons).length === 0 ? undefined : icons;
}

/**
 * 保存された画像のアイコンを読む 画像の data URL でないものと重なる id は捨てる
 *
 * @param value - 保存された値
 * @returns 読めたアイコン 1つも無ければ undefined
 */
function parseCustomIcons(value: unknown): CustomIcon[] | undefined {
	const seen = new Set<string>();
	const icons: CustomIcon[] = [];
	for (const entry of Array.isArray(value) ? value : []) {
		if (!isRecord(entry)) {
			continue;
		}
		const { id, name, src, tint } = entry;
		if (
			typeof id !== "string" ||
			id === "" ||
			seen.has(id) ||
			typeof name !== "string" ||
			typeof src !== "string" ||
			!src.startsWith("data:image/")
		) {
			continue;
		}
		seen.add(id);
		icons.push(tint === true ? { id, name, src, tint } : { id, name, src });
	}
	return icons.length === 0 ? undefined : icons;
}

/**
 * 親の鎖が輪になっていたら そのフォルダを最上位へ戻す
 *
 * 手で書き換えた保存値でも描画が止まらないようにする
 *
 * @param folders - 読み込んだフォルダ
 * @returns 輪を断ったフォルダ
 */
function breakCycles(folders: Folder[]): Folder[] {
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	return folders.map((folder) => {
		const seen = new Set<string>([folder.id]);
		let parent = folder.parentId;
		while (parent !== undefined) {
			const next = byId.get(parent);
			if (next === undefined || seen.has(parent)) {
				const { parentId: _dropped, ...rest } = folder;
				return rest;
			}
			seen.add(parent);
			parent = next.parentId;
		}
		return folder;
	});
}

/**
 * 保存された文字列を状態として読む
 *
 * 壊れた値や知らない版は空の状態として扱う
 *
 * @param raw - localStorage の値
 * @returns 読めた状態
 */
export function parseState(raw: string | null): FolderState {
	if (raw === null) {
		return EMPTY_STATE;
	}
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return EMPTY_STATE;
	}
	if (!isRecord(value) || value.version !== 1) {
		return EMPTY_STATE;
	}
	const folders = parseFolders(value.folders);
	const assignments = parseAssignments(
		value.assignments,
		new Set(folders.map((folder) => folder.id)),
	);
	const state: FolderState = {
		version: 1,
		folders: breakCycles(folders),
		assignments,
	};
	if (value.unassignedCollapsed === true) {
		state.unassignedCollapsed = true;
	}
	const icons = parseIcons(value.icons);
	if (icons !== undefined) {
		state.icons = icons;
	}
	const customIcons = parseCustomIcons(value.customIcons);
	if (customIcons !== undefined) {
		state.customIcons = customIcons;
	}
	return state;
}

/**
 * 1つのフォルダを書き換える
 *
 * @param state - 今の状態
 * @param id - 対象のフォルダ
 * @param update - 新しいフォルダを返す関数
 * @returns 新しい状態
 */
function updateFolder(
	state: FolderState,
	id: string,
	update: (folder: Folder) => Folder,
): FolderState {
	return {
		...state,
		folders: state.folders.map((folder) =>
			folder.id === id ? update(folder) : folder,
		),
	};
}

/**
 * フォルダを作る
 *
 * @param state - 今の状態
 * @param id - 新しいフォルダの id
 * @param name - 表示名
 * @param parentId - 親フォルダ 無ければ最上位
 * @returns 新しい状態
 */
export function createFolder(
	state: FolderState,
	id: string,
	name: string,
	parentId?: string,
): FolderState {
	const folder: Folder = { id, name };
	if (parentId !== undefined && state.folders.some((f) => f.id === parentId)) {
		folder.parentId = parentId;
	}
	const opened =
		folder.parentId === undefined
			? state
			: updateFolder(state, folder.parentId, (parent) => {
					const { collapsed: _collapsed, ...rest } = parent;
					return rest;
				});
	return { ...opened, folders: [...opened.folders, folder] };
}

/**
 * フォルダの名前を変える
 *
 * @param state - 今の状態
 * @param id - 対象のフォルダ
 * @param name - 新しい表示名
 * @returns 新しい状態
 */
export function renameFolder(
	state: FolderState,
	id: string,
	name: string,
): FolderState {
	return updateFolder(state, id, (folder) => ({ ...folder, name }));
}

/**
 * フォルダのアイコンを変える
 *
 * @param state - 今の状態
 * @param id - 対象のフォルダ
 * @param icon - 絵文字 空文字なら既定のアイコンへ戻す
 * @returns 新しい状態
 */
export function setFolderIcon(
	state: FolderState,
	id: string,
	icon: string,
): FolderState {
	return updateFolder(state, id, (folder) => {
		const { icon: _old, ...rest } = folder;
		return icon === "" ? rest : { ...rest, icon };
	});
}

/**
 * ワークスペースのアイコンを変える
 *
 * @param state - 今の状態
 * @param workspaceId - 対象のワークスペース
 * @param icon - 絵文字 空文字なら純正のアイコンへ戻す
 * @returns 新しい状態
 */
export function setWorkspaceIcon(
	state: FolderState,
	workspaceId: string,
	icon: string,
): FolderState {
	const { icons: current, ...rest } = state;
	const { [workspaceId]: _old, ...others } = current ?? {};
	const icons = icon === "" ? others : { ...others, [workspaceId]: icon };
	return Object.keys(icons).length === 0 ? rest : { ...rest, icons };
}

/**
 * 画像のアイコンを足す
 *
 * @param state - 今の状態
 * @param added - 足すアイコン
 * @returns 新しい状態
 */
export function addCustomIcons(
	state: FolderState,
	added: readonly CustomIcon[],
): FolderState {
	return added.length === 0
		? state
		: { ...state, customIcons: [...(state.customIcons ?? []), ...added] };
}

/**
 * 画像のアイコンを消す
 *
 * 使っているフォルダとワークスペースは既定のアイコンへ戻す
 *
 * @param state - 今の状態
 * @param id - 消すアイコン
 * @returns 新しい状態
 */
export function removeCustomIcon(state: FolderState, id: string): FolderState {
	const value = CUSTOM_ICON_PREFIX + id;
	const { customIcons: current, icons: currentIcons, ...rest } = state;
	const next: FolderState = {
		...rest,
		folders: state.folders.map((folder) => {
			if (folder.icon !== value) {
				return folder;
			}
			const { icon: _old, ...plain } = folder;
			return plain;
		}),
	};
	const customIcons = (current ?? []).filter((icon) => icon.id !== id);
	if (customIcons.length > 0) {
		next.customIcons = customIcons;
	}
	const icons = Object.entries(currentIcons ?? {}).filter(
		([, icon]) => icon !== value,
	);
	if (icons.length > 0) {
		next.icons = Object.fromEntries(icons);
	}
	return next;
}

/**
 * フォルダの開閉を切り替える
 *
 * @param state - 今の状態
 * @param id - 対象のフォルダ 「未分類」なら {@link UNASSIGNED_ID}
 * @returns 新しい状態
 */
export function toggleCollapsed(state: FolderState, id: string): FolderState {
	if (id === UNASSIGNED_ID) {
		const { unassignedCollapsed, ...rest } = state;
		return unassignedCollapsed === true
			? rest
			: { ...rest, unassignedCollapsed: true };
	}
	return updateFolder(state, id, (folder) => {
		const { collapsed, ...rest } = folder;
		return collapsed === true ? rest : { ...rest, collapsed: true };
	});
}

/**
 * あるフォルダの下にある全てのフォルダ
 *
 * @param state - 今の状態
 * @param id - 起点のフォルダ
 * @returns 子孫の id 起点自身は含まない
 */
export function descendantIds(state: FolderState, id: string): Set<string> {
	const result = new Set<string>();
	const queue = [id];
	while (queue.length > 0) {
		const current = queue.shift();
		for (const folder of state.folders) {
			if (folder.parentId === current && !result.has(folder.id)) {
				result.add(folder.id);
				queue.push(folder.id);
			}
		}
	}
	return result;
}

/**
 * フォルダを別の親の下へ移す
 *
 * 自分自身と自分の子孫の下へは移さない
 *
 * @param state - 今の状態
 * @param id - 移すフォルダ
 * @param parentId - 新しい親 無ければ最上位
 * @returns 新しい状態 移せないときは元の状態
 */
export function moveFolder(
	state: FolderState,
	id: string,
	parentId?: string,
): FolderState {
	if (parentId === id) {
		return state;
	}
	if (
		parentId !== undefined &&
		(!state.folders.some((folder) => folder.id === parentId) ||
			descendantIds(state, id).has(parentId))
	) {
		return state;
	}
	return updateFolder(state, id, (folder) => {
		const { parentId: _old, ...rest } = folder;
		return parentId === undefined ? rest : { ...rest, parentId };
	});
}

/**
 * フォルダを消す
 *
 * 中のサブフォルダとワークスペースは1つ上の階層へ移す
 *
 * @param state - 今の状態
 * @param id - 消すフォルダ
 * @returns 新しい状態
 */
export function deleteFolder(state: FolderState, id: string): FolderState {
	const target = state.folders.find((folder) => folder.id === id);
	if (target === undefined) {
		return state;
	}
	const parentId = target.parentId;
	const folders = state.folders
		.filter((folder) => folder.id !== id)
		.map((folder) => {
			if (folder.parentId !== id) {
				return folder;
			}
			const { parentId: _old, ...rest } = folder;
			return parentId === undefined ? rest : { ...rest, parentId };
		});
	const assignments: Record<string, string> = {};
	for (const [workspaceId, folderId] of Object.entries(state.assignments)) {
		if (folderId !== id) {
			assignments[workspaceId] = folderId;
		} else if (parentId !== undefined) {
			assignments[workspaceId] = parentId;
		}
	}
	return { ...state, folders, assignments };
}

/**
 * ワークスペースをフォルダへ入れる
 *
 * @param state - 今の状態
 * @param workspaceId - 対象のワークスペース
 * @param folderId - 入れる先 無ければどのフォルダからも出す
 * @returns 新しい状態
 */
export function assignWorkspace(
	state: FolderState,
	workspaceId: string,
	folderId?: string,
): FolderState {
	const { [workspaceId]: _old, ...assignments } = state.assignments;
	if (
		folderId !== undefined &&
		state.folders.some((folder) => folder.id === folderId)
	) {
		assignments[workspaceId] = folderId;
	}
	return { ...state, assignments };
}

/**
 * 今は存在しないワークスペースの割り当てとアイコンを捨てる
 *
 * @param state - 今の状態
 * @param workspaceIds - 存在するワークスペース
 * @returns 新しい状態 捨てるものが無ければ元の状態
 */
export function pruneWorkspaces(
	state: FolderState,
	workspaceIds: ReadonlySet<string>,
): FolderState {
	const entries = Object.entries(state.assignments);
	const kept = entries.filter(([workspaceId]) => workspaceIds.has(workspaceId));
	const iconEntries = Object.entries(state.icons ?? {});
	const keptIcons = iconEntries.filter(([workspaceId]) =>
		workspaceIds.has(workspaceId),
	);
	if (
		kept.length === entries.length &&
		keptIcons.length === iconEntries.length
	) {
		return state;
	}
	const { icons: _old, ...rest } = state;
	const next: FolderState = { ...rest, assignments: Object.fromEntries(kept) };
	if (keptIcons.length > 0) {
		next.icons = Object.fromEntries(keptIcons);
	}
	return next;
}

/**
 * 1つの親の直下にあるフォルダを 保存された順に並べる
 *
 * @param state - 今の状態
 * @param parentId - 親 無ければ最上位
 * @returns 並び順のフォルダ
 */
export function childFolders(state: FolderState, parentId?: string): Folder[] {
	return state.folders.filter((folder) => folder.parentId === parentId);
}

/**
 * フォルダを置く位置
 *
 * 相手の前か後ろなら相手と同じ親の兄弟に 中なら相手の子の末尾にする
 */
export type DropPosition = "before" | "after" | "inside";

/**
 * フォルダを別のフォルダの前 後ろ 中へ置く
 *
 * 自分自身と自分の子孫を基準には置かない
 *
 * @param state - 今の状態
 * @param id - 動かすフォルダ
 * @param targetId - 基準のフォルダ
 * @param position - 基準に対する位置
 * @returns 新しい状態 置けないときは元の状態
 */
export function placeFolder(
	state: FolderState,
	id: string,
	targetId: string,
	position: DropPosition,
): FolderState {
	const moving = state.folders.find((folder) => folder.id === id);
	const target = state.folders.find((folder) => folder.id === targetId);
	if (
		moving === undefined ||
		target === undefined ||
		id === targetId ||
		descendantIds(state, id).has(targetId)
	) {
		return state;
	}
	const parentId = position === "inside" ? targetId : target.parentId;
	const { parentId: _old, ...rest } = moving;
	const moved: Folder = parentId === undefined ? rest : { ...rest, parentId };
	const others = state.folders.filter((folder) => folder.id !== id);
	let index = others.findIndex((folder) => folder.id === targetId);
	if (position === "after") {
		index += 1;
	} else if (position === "inside") {
		index = others.length;
	}
	others.splice(index, 0, moved);
	const placed = { ...state, folders: others };
	return position === "inside"
		? updateFolder(placed, targetId, (folder) => {
				const { collapsed: _collapsed, ...open } = folder;
				return open;
			})
		: placed;
}

/**
 * フォルダを兄弟の中で1つ前か後ろへずらす
 *
 * @param state - 今の状態
 * @param id - 動かすフォルダ
 * @param delta - 前なら -1 後ろなら 1
 * @returns 新しい状態 端では元の状態
 */
export function shiftFolder(
	state: FolderState,
	id: string,
	delta: -1 | 1,
): FolderState {
	const folder = state.folders.find((candidate) => candidate.id === id);
	if (folder === undefined) {
		return state;
	}
	const siblings = childFolders(state, folder.parentId);
	const neighbor = siblings[siblings.indexOf(folder) + delta];
	return neighbor === undefined
		? state
		: placeFolder(state, id, neighbor.id, delta < 0 ? "before" : "after");
}

/**
 * 最上位からの道筋を「親 / 子」の形で表す
 *
 * @param state - 今の状態
 * @param id - 対象のフォルダ
 * @returns 道筋の表示名
 */
export function folderPath(state: FolderState, id: string): string {
	const byId = new Map(state.folders.map((folder) => [folder.id, folder]));
	const names: string[] = [];
	let current = byId.get(id);
	while (current !== undefined && names.length <= state.folders.length) {
		names.unshift(current.name);
		current =
			current.parentId === undefined ? undefined : byId.get(current.parentId);
	}
	return names.join(" / ");
}

/**
 * サイドバーに足す見出し行1つ
 */
export interface HeadingRow {
	/**
	 * フォルダか「未分類」か
	 */
	kind: "folder" | "unassigned";
	/**
	 * フォルダの行なら そのフォルダ
	 */
	folder?: Folder;
	/**
	 * 字下げの段数
	 */
	depth: number;
	/**
	 * 並びの位置
	 */
	order: number;
	/**
	 * 祖先が折りたたまれて見えないか
	 */
	hidden: boolean;
	/**
	 * 自分が折りたたまれているか
	 */
	collapsed: boolean;
	/**
	 * 下にあるワークスペースの数 サブフォルダの中も数える
	 */
	count: number;
}

/**
 * 純正のワークスペース群1つの置き場所
 */
export interface SectionPlacement {
	/**
	 * 並びの位置
	 */
	order: number;
	/**
	 * 字下げの段数
	 */
	depth: number;
	/**
	 * 折りたたまれたフォルダの中で見えないか
	 */
	hidden: boolean;
}

/**
 * 見出しと ワークスペース群の置き場所の全体
 */
export interface FolderLayout {
	/**
	 * フォルダが1つでもあり 並べ替えを効かせるか
	 */
	active: boolean;
	/**
	 * 足す見出し行
	 */
	rows: HeadingRow[];
	/**
	 * ワークスペース id ごとの置き場所 純正の「未グループ化」は空文字
	 */
	sections: Map<string, SectionPlacement>;
}

/**
 * 見出しとワークスペース群の並びを決める
 *
 * フォルダは名前順で サブフォルダを先に その後にフォルダ直下の
 * ワークスペースを純正の並び順のまま置く 最後に「未分類」と 純正の
 * 「未グループ化」のセッション群を置く
 *
 * @param state - 今の状態
 * @param sectionIds - 純正の一覧に並ぶワークスペース id 純正の並び順
 * @returns 並びの全体
 */
export function computeLayout(
	state: FolderState,
	sectionIds: readonly string[],
): FolderLayout {
	const rows: HeadingRow[] = [];
	const sections = new Map<string, SectionPlacement>();
	if (state.folders.length === 0) {
		return { active: false, rows, sections };
	}
	const known = new Set(state.folders.map((folder) => folder.id));
	const folderOf = (workspaceId: string): string | undefined => {
		const folderId = state.assignments[workspaceId];
		return folderId !== undefined && known.has(folderId) ? folderId : undefined;
	};
	const workspaceIds = sectionIds.filter((id) => id !== "");
	const counts = new Map<string, number>();
	for (const workspaceId of workspaceIds) {
		let folderId = folderOf(workspaceId);
		const seen = new Set<string>();
		while (folderId !== undefined && !seen.has(folderId)) {
			seen.add(folderId);
			counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
			folderId = state.folders.find(
				(folder) => folder.id === folderId,
			)?.parentId;
		}
	}
	let order = 1;
	const visit = (
		parentId: string | undefined,
		depth: number,
		hidden: boolean,
	) => {
		for (const folder of childFolders(state, parentId)) {
			const collapsed = folder.collapsed === true;
			rows.push({
				kind: "folder",
				folder,
				depth,
				order: order++,
				hidden,
				collapsed,
				count: counts.get(folder.id) ?? 0,
			});
			const inner = hidden || collapsed;
			visit(folder.id, depth + 1, inner);
			for (const workspaceId of workspaceIds) {
				if (folderOf(workspaceId) === folder.id) {
					sections.set(workspaceId, {
						order: order++,
						depth: depth + 1,
						hidden: inner,
					});
				}
			}
		}
	};
	visit(undefined, 0, false);
	const unassigned = workspaceIds.filter((id) => folderOf(id) === undefined);
	const unassignedCollapsed = state.unassignedCollapsed === true;
	rows.push({
		kind: "unassigned",
		depth: 0,
		order: order++,
		hidden: false,
		collapsed: unassignedCollapsed,
		count: unassigned.length,
	});
	for (const workspaceId of unassigned) {
		sections.set(workspaceId, {
			order: order++,
			depth: 1,
			hidden: unassignedCollapsed,
		});
	}
	if (sectionIds.includes("")) {
		sections.set("", { order: order++, depth: 0, hidden: false });
	}
	return { active: true, rows, sections };
}
