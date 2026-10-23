/**
 * セッションの状態を ワークスペースとフォルダへ集める
 *
 * React と DOM に依存しない純粋な関数だけを置く 1件のセッションの見え方は
 * 純正の一覧のセッション行の点と同じ順位で決める
 */

import { type FolderState, UNASSIGNED_ID } from "./model";

/**
 * 行の左に出す状態 弱い順に完了 進行中 応答待ち
 */
export type Activity = "done" | "ongoing" | "warning";

/**
 * 状態の強さ 大きいほど優先する
 */
const RANK: Readonly<Record<Activity, number>> = {
	done: 1,
	ongoing: 2,
	warning: 3,
};

/**
 * 純正がセッション行で応答待ちとして点を出す種類
 */
const PENDING_KINDS: ReadonlySet<string> = new Set([
	"approval",
	"plan-review",
	"question",
]);

/**
 * 純正の `useSessionStatus` が配る1件ぶんのうち ここで読むもの
 */
export interface SessionStatusFacts {
	running?: boolean | undefined;
	pendingInteraction?: { kind: string } | undefined;
	completionUnread?: boolean | undefined;
}

/**
 * 強いほうの状態
 *
 * @param a - 片方
 * @param b - もう片方
 * @returns 強いほう どちらも無ければ undefined
 */
export function strongerActivity(
	a: Activity | undefined,
	b: Activity | undefined,
): Activity | undefined {
	if (a === undefined) {
		return b;
	}
	return b === undefined || RANK[a] >= RANK[b] ? a : b;
}

/**
 * 1件のセッションの状態
 *
 * @param status - 純正の状態 まだ届いていなければ undefined
 * @param summaryRunning - 一覧の要約が持つ実行中の印 状態が届く前の代わり
 * @returns 出す状態 何も無ければ undefined
 */
export function sessionActivity(
	status: SessionStatusFacts | undefined,
	summaryRunning: boolean | undefined,
): Activity | undefined {
	const kind = status?.pendingInteraction?.kind;
	if (kind !== undefined && PENDING_KINDS.has(kind)) {
		return "warning";
	}
	if ((status?.running ?? summaryRunning) === true) {
		return "ongoing";
	}
	return status?.completionUnread === true ? "done" : undefined;
}

/**
 * ワークスペース1件と その中のセッション
 */
export interface WorkspaceSessions {
	workspaceId: string;
	sessionIds?: readonly string[] | undefined;
}

/**
 * ワークスペースごとに 中のセッションの一番強い状態を集める
 *
 * アーカイブしたセッションは純正の行でも点を出さないため数えない
 *
 * @param workspaces - 純正のワークスペース
 * @param archived - アーカイブしたセッション
 * @param activityOf - セッション1件の状態
 * @returns 状態のあるワークスペースだけの対応
 */
export function workspaceActivities(
	workspaces: readonly WorkspaceSessions[],
	archived: ReadonlySet<string>,
	activityOf: (sessionId: string) => Activity | undefined,
): Map<string, Activity> {
	const result = new Map<string, Activity>();
	for (const workspace of workspaces) {
		let strongest: Activity | undefined;
		for (const sessionId of workspace.sessionIds ?? []) {
			if (!archived.has(sessionId)) {
				strongest = strongerActivity(strongest, activityOf(sessionId));
			}
		}
		if (strongest !== undefined) {
			result.set(workspace.workspaceId, strongest);
		}
	}
	return result;
}

/**
 * フォルダごとに 中のワークスペースの一番強い状態を集める
 *
 * サブフォルダの中も祖先へ数える どのフォルダにも入っていないものは
 * 「未分類」の {@link UNASSIGNED_ID} へ集める
 *
 * @param state - 今の状態
 * @param workspaces - ワークスペースごとの状態
 * @returns フォルダ id から状態への対応
 */
export function folderActivities(
	state: FolderState,
	workspaces: ReadonlyMap<string, Activity>,
): Map<string, Activity> {
	const byId = new Map(state.folders.map((folder) => [folder.id, folder]));
	const result = new Map<string, Activity>();
	const raise = (id: string, activity: Activity) => {
		result.set(id, strongerActivity(result.get(id), activity) ?? activity);
	};
	for (const [workspaceId, activity] of workspaces) {
		const assigned = state.assignments[workspaceId];
		let folder = assigned === undefined ? undefined : byId.get(assigned);
		if (folder === undefined) {
			raise(UNASSIGNED_ID, activity);
			continue;
		}
		const seen = new Set<string>();
		while (folder !== undefined && !seen.has(folder.id)) {
			seen.add(folder.id);
			raise(folder.id, activity);
			folder =
				folder.parentId === undefined ? undefined : byId.get(folder.parentId);
		}
	}
	return result;
}
