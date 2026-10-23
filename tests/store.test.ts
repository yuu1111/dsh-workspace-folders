/**
 * DSH の設定を正とする状態の置き場の検証
 */

import { describe, expect, test } from "bun:test";
import { createFolder, EMPTY_STATE, renameFolder } from "../src/model";
import {
	createFolderStore,
	type HostForm,
	type HostSection,
} from "../src/store";

/**
 * 書き込みを手で決着させられるホストの設定
 */
function fakeHost() {
	let snapshot: ReturnType<HostForm["getSnapshot"]> = {
		status: "loading",
		value: undefined,
	};
	const listeners = new Set<() => void>();
	const writes: { value: unknown; settle: (ok: boolean) => void }[] = [];
	const publish = (
		status: "loading" | "ready" | "unavailable",
		value?: HostSection,
	) => {
		snapshot = { status, value };
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

const withFolder = JSON.stringify(createFolder(EMPTY_STATE, "a", "Work"));

/**
 * 待っている Promise の続きを流す
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createFolderStore", () => {
	test("ホストの値を どの端末でも同じ状態として見せる", () => {
		const host = fakeHost();
		const store = createFolderStore();
		store.attach(host.form);
		host.publish("ready", { state: withFolder });
		expect(store.getSnapshot().folders.map((folder) => folder.name)).toEqual([
			"Work",
		]);
	});

	test("変更はすぐ見せ ホストが受け取るまで古い値へ戻さない", async () => {
		const host = fakeHost();
		const store = createFolderStore();
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
	});

	test("ホストが断った変更は ホストの値へ戻す", async () => {
		const host = fakeHost();
		const store = createFolderStore();
		store.attach(host.form);
		host.publish("ready", { state: withFolder });
		store.update((state) => renameFolder(state, "a", "Home"));
		host.writes[0]?.settle(false);
		await flush();
		expect(store.getSnapshot().folders[0]?.name).toBe("Work");
	});

	test("ホストの値を読む前の変更は保存しない", () => {
		const host = fakeHost();
		const store = createFolderStore();
		store.attach(host.form);
		store.update((state) => createFolder(state, "b", "Early"));
		expect(host.writes).toHaveLength(0);
		expect(store.getSnapshot().folders).toHaveLength(0);
	});
});
