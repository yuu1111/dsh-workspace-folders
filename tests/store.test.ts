/**
 * DSH の設定と localStorage をまたぐ状態の置き場の検証
 */

import { describe, expect, test } from "bun:test";
import { createFolder, EMPTY_STATE, renameFolder } from "../src/model";
import {
	createFolderStore,
	type HostForm,
	type HostSection,
	type LocalBackend,
} from "../src/store";

/**
 * 書き込みを手で決着させられるホストの設定
 */
function fakeHost(status: "loading" | "ready" | "unavailable" = "loading") {
	let snapshot: ReturnType<HostForm["getSnapshot"]> = {
		status,
		value: status === "ready" ? {} : undefined,
	};
	const listeners = new Set<() => void>();
	const writes: { value: unknown; settle: (ok: boolean) => void }[] = [];
	const publish = (
		next: "loading" | "ready" | "unavailable",
		value?: HostSection,
	) => {
		snapshot = { status: next, value };
		for (const listener of [...listeners]) {
			listener();
		}
	};
	const form: HostForm = {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		set(_field, value) {
			return new Promise((resolve) => {
				writes.push({ value, settle: resolve });
			});
		},
	};
	return { form, writes, publish };
}

/**
 * 記憶だけの localStorage
 */
function fakeLocal(initial: string | null = null): LocalBackend & {
	raw: string | null;
} {
	return {
		raw: initial,
		read() {
			return this.raw;
		},
		write(raw) {
			this.raw = raw;
		},
		watch: () => () => undefined,
	};
}

const withFolder = JSON.stringify(createFolder(EMPTY_STATE, "a", "Work"));

/**
 * 待っている Promise の続きを流す
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createFolderStore", () => {
	test("ホストの値を どの端末でも同じ状態として見せる", () => {
		const host = fakeHost();
		const store = createFolderStore(fakeLocal());
		store.attach(host.form);
		host.publish("ready", { state: withFolder });
		expect(store.getSnapshot().folders.map((folder) => folder.name)).toEqual([
			"Work",
		]);
	});

	test("ホストが空なら このブラウザの localStorage の状態を1度だけ送る", () => {
		const host = fakeHost();
		const store = createFolderStore(fakeLocal(withFolder));
		store.attach(host.form);
		host.publish("ready", {});
		host.publish("ready", {});
		expect(host.writes.map((write) => write.value)).toEqual([withFolder]);
		expect(store.getSnapshot().folders).toHaveLength(1);
	});

	test("ホストに値があれば localStorage の状態で上書きしない", () => {
		const host = fakeHost();
		const store = createFolderStore(fakeLocal(withFolder));
		store.attach(host.form);
		host.publish("ready", { state: JSON.stringify(EMPTY_STATE) });
		expect(host.writes).toHaveLength(0);
		expect(store.getSnapshot().folders).toHaveLength(0);
	});

	test("変更はすぐ見せ ホストが受け取るまで古い値へ戻さない", async () => {
		const host = fakeHost();
		const local = fakeLocal();
		const store = createFolderStore(local);
		store.attach(host.form);
		host.publish("ready", { state: withFolder });
		store.update((state) => renameFolder(state, "a", "Home"));
		expect(store.getSnapshot().folders[0]?.name).toBe("Home");
		host.publish("ready", { state: withFolder });
		expect(store.getSnapshot().folders[0]?.name).toBe("Home");
		const sent = host.writes[0];
		host.publish("ready", { state: String(sent?.value) });
		sent?.settle(true);
		await flush();
		expect(store.getSnapshot().folders[0]?.name).toBe("Home");
		expect(local.raw).toBeNull();
	});

	test("ホストが断った変更は ホストの値へ戻す", async () => {
		const host = fakeHost();
		const store = createFolderStore(fakeLocal());
		store.attach(host.form);
		host.publish("ready", { state: withFolder });
		store.update((state) => renameFolder(state, "a", "Home"));
		host.writes[0]?.settle(false);
		await flush();
		expect(store.getSnapshot().folders[0]?.name).toBe("Work");
	});

	test("ホストが設定を配らない構成では localStorage へ保存する", () => {
		const host = fakeHost("unavailable");
		const local = fakeLocal();
		const store = createFolderStore(local);
		store.attach(host.form);
		store.update((state) => createFolder(state, "b", "Solo"));
		expect(host.writes).toHaveLength(0);
		expect(local.raw).not.toBeNull();
		expect(store.getSnapshot().folders[0]?.name).toBe("Solo");
	});
});
