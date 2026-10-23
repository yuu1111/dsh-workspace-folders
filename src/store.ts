/**
 * フォルダの状態の置き場
 *
 * DSH の設定（ホスト側の `workspace-folders` 項目の `state`）を正とし
 * どの端末のブラウザからも同じフォルダを見せる
 */

import { EMPTY_STATE, type FolderState, parseState } from "./model";

/**
 * ホストの設定のうち ここで読む形
 */
export interface HostSection {
	/**
	 * 状態を JSON にした文字列 1度も保存していなければ undefined
	 */
	state?: string | undefined;
}

/**
 * DSH の `configForms.get()` が返す設定のうち ここで使うもの
 */
export interface HostForm {
	getSnapshot(): {
		status: "loading" | "ready" | "unavailable";
		value: HostSection | undefined;
	};
	subscribe(listener: () => void): () => void;
	set(field: string, value: unknown): Promise<boolean>;
}

/**
 * 状態の置き場
 */
export interface FolderStore {
	getSnapshot(): FolderState;
	subscribe(listener: () => void): () => void;
	update(change: (state: FolderState) => FolderState): void;
	/**
	 * ホストの設定へつなぐ
	 *
	 * @returns 外す関数
	 */
	attach(form: HostForm): () => void;
}

/**
 * 状態の置き場を作る
 *
 * 書き込みはすぐ画面へ出し ホストが受け取るまでホスト側の古い値で
 * 上書きしない ホストが断ったときはホストの値へ戻す ホストの値を
 * 読む前の変更は保存できないため捨てる
 *
 * @returns 置き場
 */
export function createFolderStore(): FolderStore {
	const listeners = new Set<() => void>();
	let current: { raw: string | null; state: FolderState } = {
		raw: null,
		state: EMPTY_STATE,
	};
	let host: HostForm | undefined;
	let pending = 0;

	const show = (raw: string | null) => {
		if (raw === current.raw) {
			return;
		}
		current = { raw, state: parseState(raw) };
		for (const listener of [...listeners]) {
			listener();
		}
	};
	const sync = () => {
		const snapshot = host?.getSnapshot();
		if (snapshot?.status === "ready" && pending === 0) {
			show(snapshot.value?.state ?? null);
		}
	};

	return {
		getSnapshot: () => current.state,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		update(change) {
			const form = host;
			if (form?.getSnapshot().status !== "ready") {
				return;
			}
			const next = change(current.state);
			if (next === current.state) {
				return;
			}
			const raw = JSON.stringify(next);
			pending += 1;
			show(raw);
			form
				.set("state", raw)
				.catch(() => false)
				.finally(() => {
					pending -= 1;
					if (host === form) {
						sync();
					}
				});
		},
		attach(form) {
			host = form;
			const unsubscribe = form.subscribe(sync);
			sync();
			return () => {
				unsubscribe();
				if (host === form) {
					host = undefined;
				}
			};
		},
	};
}
