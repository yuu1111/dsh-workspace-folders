/**
 * セッションの状態をワークスペースとフォルダへ集める処理の検証
 */

import { describe, expect, test } from "bun:test";
import {
	folderActivities,
	sessionActivity,
	workspaceActivities,
} from "../src/activity";
import {
	assignWorkspace,
	createFolder,
	EMPTY_STATE,
	UNASSIGNED_ID,
} from "../src/model";

describe("sessionActivity", () => {
	test("応答待ちを実行中より 実行中を完了より優先する", () => {
		expect(
			sessionActivity(
				{ running: true, pendingInteraction: { kind: "approval" } },
				false,
			),
		).toBe("warning");
		expect(
			sessionActivity({ running: true, completionUnread: true }, false),
		).toBe("ongoing");
		expect(
			sessionActivity({ running: false, completionUnread: true }, true),
		).toBe("done");
	});

	test("状態が届く前は一覧の実行中の印を使い 何も無ければ出さない", () => {
		expect(sessionActivity(undefined, true)).toBe("ongoing");
		expect(sessionActivity(undefined, false)).toBeUndefined();
		expect(
			sessionActivity({ pendingInteraction: { kind: "unknown" } }, false),
		).toBeUndefined();
	});
});

describe("workspaceActivities", () => {
	test("中のセッションの一番強い状態を集め アーカイブしたものは数えない", () => {
		const activities = workspaceActivities(
			[
				{ workspaceId: "a", sessionIds: ["s1", "s2"] },
				{ workspaceId: "b", sessionIds: ["s3"] },
				{ workspaceId: "c", sessionIds: ["s4"] },
			],
			new Set(["s3"]),
			(id) => ({ s1: "done", s2: "ongoing", s3: "warning" })[id] as never,
		);
		expect([...activities]).toEqual([["a", "ongoing"]]);
	});
});

describe("folderActivities", () => {
	test("祖先のフォルダへも伝え 入っていないものは未分類へ集める", () => {
		let state = createFolder(EMPTY_STATE, "work", "仕事");
		state = createFolder(state, "dsh", "DSH", "work");
		state = createFolder(state, "hobby", "趣味");
		state = assignWorkspace(state, "w-dsh", "dsh");
		state = assignWorkspace(state, "w-work", "work");
		const activities = folderActivities(
			state,
			new Map([
				["w-dsh", "done"],
				["w-work", "warning"],
				["w-free", "ongoing"],
			] as const),
		);
		expect(activities.get("dsh")).toBe("done");
		expect(activities.get("work")).toBe("warning");
		expect(activities.get("hobby")).toBeUndefined();
		expect(activities.get(UNASSIGNED_ID)).toBe("ongoing");
	});
});
