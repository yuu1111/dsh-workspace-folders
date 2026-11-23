/**
 * 純正のアイコンのスプライトから 単体で描ける SVG の文字列を作る
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * 純正のアイコン1つを 画像として使える SVG の文字列にする
 *
 * 純正のアイコンは `<use href="#id">` でスプライトの symbol を指すだけで
 * outerHTML を画像にしても参照先が無く 何も描かれない そのため symbol の
 * 属性と中身を取り出し 名前空間と viewBox を持つ独立した svg に組み直す
 *
 * @param icon - 純正のアイコンの svg 要素
 * @returns SVG の文字列 スプライトに symbol が無ければ undefined
 */
export function standaloneSvg(icon: Element): string | undefined {
	const id = icon.querySelector("use")?.getAttribute("href")?.slice(1);
	const symbol = id === undefined ? null : document.getElementById(id);
	if (symbol === null || symbol.getAttribute("viewBox") === null) {
		return undefined;
	}
	const svg = document.createElementNS(SVG_NS, "svg");
	for (const { name, value } of Array.from(symbol.attributes)) {
		if (name !== "id") {
			svg.setAttribute(name, value);
		}
	}
	svg.append(
		...Array.from(symbol.childNodes).map((node) => node.cloneNode(true)),
	);
	return new XMLSerializer().serializeToString(svg);
}
