/**
 * 純正の行だけが動いて見出しが瞬間移動しないよう 同じ200msで位置を補間する
 * 純正の開閉では見出しだけ フォルダの開閉では直下の群も動かす
 */
export function createRowMotion() {
	let tree: HTMLElement | null = null;
	let observer: ResizeObserver | undefined;
	let armed = false;
	let positions = new Map<HTMLElement, number>();
	const animations = new Map<HTMLElement, Animation>();
	const arm = () => {
		armed = true;
	};
	const measure = () =>
		new Map(
			Array.from(tree?.children ?? []).flatMap((element) =>
				element instanceof HTMLElement && element.getClientRects().length > 0
					? [[element, element.offsetTop] as const]
					: [],
			),
		);
	const sync = (own: boolean) => {
		const previous = positions;
		positions = measure();
		for (const element of positions.keys()) {
			observer?.observe(element);
		}
		if (
			!armed ||
			globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
		) {
			return;
		}
		for (const [element, top] of positions) {
			const before = previous.get(element);
			if (
				before === undefined ||
				before === top ||
				!(own || element.classList.contains("dwf-row"))
			) {
				continue;
			}
			if (typeof element.animate !== "function") {
				continue;
			}
			const active = animations.get(element);
			const remaining =
				active === undefined
					? 0
					: new DOMMatrixReadOnly(getComputedStyle(element).transform).m42;
			active?.cancel();
			const animation = element.animate(
				[
					{ transform: `translate(0, ${before - top + remaining}px)` },
					{ transform: "translate(0, 0)" },
				],
				{ duration: 200, easing: "ease-out" },
			);
			animations.set(element, animation);
			animation.onfinish = () => {
				animations.delete(element);
			};
		}
	};
	const attach = (next: HTMLElement | null) => {
		if (tree === next) {
			return;
		}
		observer?.disconnect();
		tree?.removeEventListener("pointerdown", arm, true);
		tree?.removeEventListener("keydown", arm, true);
		for (const animation of animations.values()) {
			animation.cancel();
		}
		animations.clear();
		tree = next;
		armed = false;
		positions = measure();
		if (tree === null) {
			return;
		}
		tree.addEventListener("pointerdown", arm, true);
		tree.addEventListener("keydown", arm, true);
		observer = new ResizeObserver(() => sync(false));
		for (const element of Array.from(tree.children)) {
			observer.observe(element);
		}
	};
	return { attach, sync };
}
