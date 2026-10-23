/**
 * フォルダの状態の置き場
 *
 * DSH の設定（ホスト側の `workspace-folders` 項目の `state`）を正とし
 * どの端末のブラウザからも同じフォルダを見せる 設定が使えない構成では
 * ブラウザの localStorage へ退避する
 *
 * ホストの設定がまだ空のときは このブラウザの localStorage にある状態を
 * 1度だけ送り 以前の版で作ったフォルダを引き継ぐ
 */

import { type FolderState, parseState } from "./model";

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
 * 退避先の読み書き
 */
export interface LocalBackend {
	read(): string | null;
	write(raw: string): void;
	/**
	 * 別のタブでの書き換えを知らせる
	 *
	 * @returns 監視をやめる関数
	 */
	watch(listener: () => void): () => void;
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
	 * @returns 外して退避先へ戻す関数
	 */
	attach(form: HostForm): () => void;
}

/**
 * 引き継ぐ値のある状態か
 *
 * @param state - 調べる状態
 * @returns フォルダかアイコンが1つでもあれば true
 */
function hasContent(state: FolderState): boolean {
	return (
		state.folders.length > 0 ||
		Object.keys(state.icons ?? {}).length > 0 ||
		(state.customIcons?.length ?? 0) > 0
	);
}

/**
 * 状態の置き場を作る
 *
 * 書き込みはすぐ画面へ出し ホストが受け取るまでホスト側の古い値で
 * 上書きしない ホストが断ったときはホストの値へ戻す
 *
 * @param local - 退避先
 * @returns 置き場
 */
export function createFolderStore(local: LocalBackend): FolderStore {
	const listeners = new Set<() => void>();
	let current: { raw: string | null; state: FolderState } = {
		raw: local.read(),
		state: parseState(local.read()),
	};
	let host: HostForm | undefined;
	let hostReady = false;
	let pending = 0;

	const notify = () => {
		for (const listener of [...listeners]) {
			listener();
		}
	};
	const show = (raw: string | null) => {
		if (raw === current.raw) {
			return;
		}
		current = { raw, state: parseState(raw) };
		notify();
	};
	const push = (form: HostForm, raw: string) => {
		pending += 1;
		show(raw);
		form
			.set("state", raw)
			.catch(() => false)
			.finally(() => {
				pending -= 1;
				if (pending === 0 && host === form) {
					sync();
				}
			});
	};
	const sync = () => {
		const form = host;
		if (form === undefined) {
			return;
		}
		const snapshot = form.getSnapshot();
		if (snapshot.status !== "ready") {
			hostReady = false;
			if (snapshot.status === "unavailable") {
				show(local.read());
			}
			return;
		}
		hostReady = true;
		if (pending > 0) {
			return;
		}
		const raw = snapshot.value?.state;
		if (raw !== undefined) {
			show(raw);
			return;
		}
		const saved = local.read();
		if (saved !== null && hasContent(parseState(saved))) {
			push(form, saved);
		} else {
			show(null);
		}
	};

	local.watch(() => {
		if (!hostReady) {
			show(local.read());
		}
	});

	return {
		getSnapshot: () => current.state,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		update(change) {
			const next = change(current.state);
			if (next === current.state) {
				return;
			}
			const raw = JSON.stringify(next);
			if (host !== undefined && hostReady) {
				push(host, raw);
				return;
			}
			local.write(raw);
			show(raw);
		},
		attach(form) {
			host = form;
			const unsubscribe = form.subscribe(sync);
			sync();
			return () => {
				unsubscribe();
				if (host === form) {
					host = undefined;
					hostReady = false;
					show(local.read());
				}
			};
		},
	};
}
