/**
 * 画面の文言
 *
 * DSH の言語設定は `<html lang>` へ映るため その値で日本語と英語を選ぶ
 */

/**
 * 1言語ぶんの文言
 */
export interface Messages {
	newFolder: string;
	newSubfolder: string;
	moveUp: string;
	moveDown: string;
	unassigned: string;
	rename: string;
	changeIcon: string;
	addWorkspace: string;
	noWorkspaces: string;
	moveTo: string;
	topLevel: string;
	deleteFolder: string;
	folderActions: (name: string) => string;
	createTitle: string;
	renameTitle: string;
	iconTitle: string;
	workspaceIconTitle: (name: string) => string;
	deleteTitle: string;
	deleteBody: (name: string) => string;
	namePlaceholder: string;
	iconPlaceholder: string;
	resetIcon: string;
	cancel: string;
	create: string;
	save: string;
	delete: string;
	close: string;
	count: (n: number) => string;
}

/**
 * 日本語
 */
const JA: Messages = {
	newFolder: "新しいフォルダ",
	newSubfolder: "サブフォルダを作成",
	moveUp: "上へ移動",
	moveDown: "下へ移動",
	unassigned: "未分類",
	rename: "名前を変更",
	changeIcon: "アイコンを変更",
	addWorkspace: "ワークスペースを入れる",
	noWorkspaces: "入れられるワークスペースがありません",
	moveTo: "移動",
	topLevel: "最上位",
	deleteFolder: "フォルダを削除",
	folderActions: (name) => `フォルダ「${name}」の操作`,
	createTitle: "新しいフォルダ",
	renameTitle: "フォルダの名前を変更",
	iconTitle: "フォルダのアイコン",
	workspaceIconTitle: (name) => `「${name}」のアイコン`,
	deleteTitle: "フォルダを削除",
	deleteBody: (name) =>
		`「${name}」を削除します 中のワークスペースとサブフォルダは1つ上の階層へ移ります`,
	namePlaceholder: "フォルダ名",
	iconPlaceholder: "絵文字を入力",
	resetIcon: "既定に戻す",
	cancel: "キャンセル",
	create: "作成",
	save: "保存",
	delete: "削除",
	close: "閉じる",
	count: (n) => `${n} 件のワークスペース`,
};

/**
 * 英語
 */
const EN: Messages = {
	newFolder: "New folder",
	newSubfolder: "New subfolder",
	moveUp: "Move up",
	moveDown: "Move down",
	unassigned: "Unfiled",
	rename: "Rename",
	changeIcon: "Change icon",
	addWorkspace: "Add workspace",
	noWorkspaces: "No workspaces to add",
	moveTo: "Move to",
	topLevel: "Top level",
	deleteFolder: "Delete folder",
	folderActions: (name) => `Folder actions for ${name}`,
	createTitle: "New folder",
	renameTitle: "Rename folder",
	iconTitle: "Folder icon",
	workspaceIconTitle: (name) => `Icon for ${name}`,
	deleteTitle: "Delete folder",
	deleteBody: (name) =>
		`Delete "${name}"? Its workspaces and subfolders move up one level.`,
	namePlaceholder: "Folder name",
	iconPlaceholder: "Type an emoji",
	resetIcon: "Reset",
	cancel: "Cancel",
	create: "Create",
	save: "Save",
	delete: "Delete",
	close: "Close",
	count: (n) => `${n} workspace${n === 1 ? "" : "s"}`,
};

/**
 * 言語タグに合う文言を選ぶ
 *
 * @param lang - `<html lang>` の値
 * @returns 日本語なら日本語 それ以外は英語
 */
export function messagesFor(lang: string): Messages {
	return lang.toLowerCase().startsWith("ja") ? JA : EN;
}
