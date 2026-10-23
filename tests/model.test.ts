/**
 * フォルダの状態と並びの計算の検証
 */

import { describe, expect, test } from "bun:test";
import {
	assignWorkspace,
	childFolders,
	computeLayout,
	createFolder,
	deleteFolder,
	EMPTY_STATE,
	type FolderState,
	folderPath,
	moveFolder,
	parseState,
	placeFolder,
	pruneAssignments,
	setFolderIcon,
	shiftFolder,
	toggleCollapsed,
	UNASSIGNED_ID,
} from "../src/model";

/**
 * 「仕事 > DSH」と「趣味」の2段の木を作る
 *
 * @returns 状態
 */
function sample(): FolderState {
	let state = createFolder(EMPTY_STATE, "work", "仕事");
	state = createFolder(state, "dsh", "DSH", "work");
	state = createFolder(state, "hobby", "趣味");
	state = assignWorkspace(state, "w-dsh", "dsh");
	state = assignWorkspace(state, "w-work", "work");
	return assignWorkspace(state, "w-game", "hobby");
}

describe("computeLayout", () => {
	test("フォルダが無ければ並べ替えない", () => {
		const layout = computeLayout(EMPTY_STATE, ["a", "b"]);
		expect(layout.active).toBe(false);
		expect(layout.rows).toEqual([]);
	});

	test("保存された順の木と 字下げと 未分類を並べる", () => {
		const layout = computeLayout(sample(), [
			"w-game",
			"w-free",
			"w-work",
			"w-dsh",
			"",
		]);
		const order = [
			...layout.rows.map((row) => ({
				order: row.order,
				name: row.folder?.name ?? "未分類",
				depth: row.depth,
			})),
			...[...layout.sections].map(([id, placement]) => ({
				order: placement.order,
				name: id,
				depth: placement.depth,
			})),
		].sort((a, b) => a.order - b.order);
		expect(order.map((entry) => `${entry.depth}:${entry.name}`)).toEqual([
			"0:仕事",
			"1:DSH",
			"2:w-dsh",
			"1:w-work",
			"0:趣味",
			"1:w-game",
			"0:未分類",
			"1:w-free",
			"0:",
		]);
	});

	test("折りたたむと子孫を隠し 中の数を数える", () => {
		const state = toggleCollapsed(sample(), "work");
		const layout = computeLayout(state, ["w-dsh", "w-work"]);
		const work = layout.rows.find((row) => row.folder?.id === "work");
		expect(work?.collapsed).toBe(true);
		expect(work?.count).toBe(2);
		expect(layout.rows.find((row) => row.folder?.id === "dsh")?.hidden).toBe(
			true,
		);
		expect(layout.sections.get("w-dsh")?.hidden).toBe(true);
		expect(layout.sections.get("w-work")?.hidden).toBe(true);
	});

	test("未分類も折りたためる", () => {
		const state = toggleCollapsed(sample(), UNASSIGNED_ID);
		const layout = computeLayout(state, ["w-free"]);
		expect(layout.sections.get("w-free")?.hidden).toBe(true);
		expect(
			computeLayout(toggleCollapsed(state, UNASSIGNED_ID), [
				"w-free",
			]).sections.get("w-free")?.hidden,
		).toBe(false);
	});
});

describe("フォルダの操作", () => {
	test("自分の子孫の下へは移さない", () => {
		const state = sample();
		expect(moveFolder(state, "work", "dsh")).toBe(state);
		expect(moveFolder(state, "work", "work")).toBe(state);
		const moved = moveFolder(state, "dsh", "hobby");
		expect(folderPath(moved, "dsh")).toBe("趣味 / DSH");
		expect(folderPath(moveFolder(moved, "dsh"), "dsh")).toBe("DSH");
	});

	test("消すと中身を1つ上へ移す", () => {
		const state = deleteFolder(sample(), "work");
		expect(
			state.folders.find((folder) => folder.id === "dsh")?.parentId,
		).toBeUndefined();
		expect(state.assignments["w-work"]).toBeUndefined();
		expect(state.assignments["w-dsh"]).toBe("dsh");
		const nested = deleteFolder(sample(), "dsh");
		expect(nested.assignments["w-dsh"]).toBe("work");
	});

	test("サブフォルダを作ると親を開く", () => {
		const closed = toggleCollapsed(sample(), "work");
		const state = createFolder(closed, "new", "新規", "work");
		expect(
			state.folders.find((folder) => folder.id === "work")?.collapsed,
		).toBeUndefined();
	});

	test("アイコンは空文字で既定へ戻る", () => {
		const state = setFolderIcon(sample(), "hobby", "🎮");
		expect(state.folders.find((folder) => folder.id === "hobby")?.icon).toBe(
			"🎮",
		);
		expect(
			setFolderIcon(state, "hobby", "").folders.find(
				(folder) => folder.id === "hobby",
			)?.icon,
		).toBeUndefined();
	});

	test("無くなったワークスペースの割り当てを捨てる", () => {
		const state = sample();
		const pruned = pruneAssignments(state, new Set(["w-dsh"]));
		expect(Object.keys(pruned.assignments)).toEqual(["w-dsh"]);
		expect(pruneAssignments(pruned, new Set(["w-dsh"]))).toBe(pruned);
	});
});

describe("フォルダの並び替え", () => {
	test("兄弟の前後へ置き 中へ入れる", () => {
		const names = (state: FolderState, parentId?: string) =>
			childFolders(state, parentId).map((folder) => folder.name);
		const base = sample();
		expect(names(base)).toEqual(["仕事", "趣味"]);
		const before = placeFolder(base, "hobby", "work", "before");
		expect(names(before)).toEqual(["趣味", "仕事"]);
		const inside = placeFolder(base, "hobby", "work", "inside");
		expect(names(inside)).toEqual(["仕事"]);
		expect(names(inside, "work")).toEqual(["DSH", "趣味"]);
		const out = placeFolder(base, "dsh", "work", "after");
		expect(names(out)).toEqual(["仕事", "DSH", "趣味"]);
	});

	test("自分の子孫を基準には置かない", () => {
		const state = sample();
		expect(placeFolder(state, "work", "dsh", "before")).toBe(state);
		expect(placeFolder(state, "work", "work", "inside")).toBe(state);
	});

	test("中へ入れると 閉じていた相手を開く", () => {
		const closed = toggleCollapsed(sample(), "hobby");
		const state = placeFolder(closed, "work", "hobby", "inside");
		expect(
			state.folders.find((folder) => folder.id === "hobby")?.collapsed,
		).toBeUndefined();
	});

	test("1つ前後へずらし 端では動かない", () => {
		const state = sample();
		const down = shiftFolder(state, "work", 1);
		expect(childFolders(down).map((folder) => folder.id)).toEqual([
			"hobby",
			"work",
		]);
		expect(shiftFolder(down, "work", 1)).toBe(down);
		expect(shiftFolder(state, "dsh", -1)).toBe(state);
	});
});

describe("parseState", () => {
	test("保存した状態を往復できる", () => {
		const state = sample();
		expect(parseState(JSON.stringify(state))).toEqual(state);
	});

	test("壊れた値は空の状態になる", () => {
		expect(parseState(null)).toBe(EMPTY_STATE);
		expect(parseState("{")).toBe(EMPTY_STATE);
		expect(parseState(JSON.stringify({ version: 2 }))).toBe(EMPTY_STATE);
	});

	test("輪になった親と 知らないフォルダへの割り当てを断つ", () => {
		const state = parseState(
			JSON.stringify({
				version: 1,
				folders: [
					{ id: "a", name: "A", parentId: "b" },
					{ id: "b", name: "B", parentId: "a" },
				],
				assignments: { w1: "a", w2: "gone" },
			}),
		);
		expect(state.folders.every((folder) => folder.parentId === undefined)).toBe(
			true,
		);
		expect(state.assignments).toEqual({ w1: "a" });
	});
});
