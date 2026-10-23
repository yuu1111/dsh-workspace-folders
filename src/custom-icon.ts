/**
 * 画像ファイルから 利用者のアイコンを作る
 *
 * 保存先は localStorage なので 画像は小さな PNG へ縮めて data URL にする
 */

import { iconNameFromFile, isMonochrome } from "./icon-catalog";
import type { CustomIcon } from "./model";

/**
 * 縮めた画像の一辺 2倍の画素密度で 32px まで綺麗に出せる大きさ
 */
const ICON_EDGE = 64;

/**
 * 読み込む元の画像の上限 これより大きいファイルは断る
 */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * 画像ファイルを読み込む
 *
 * @param file - 画像ファイル
 * @returns 読み込んだ画像
 */
function loadImage(file: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("image could not be decoded"));
		};
		image.src = url;
	});
}

/**
 * 画像ファイルを 正方形に収めて縮めたアイコンにする
 *
 * 縦横比は保ち 余白は透過にする
 *
 * @param file - 画像ファイル
 * @param id - 新しいアイコンの id
 * @returns アイコン 画像でないか大きすぎるときは undefined
 */
export async function customIconFromFile(
	file: File,
	id: string,
): Promise<CustomIcon | undefined> {
	if (!file.type.startsWith("image/") || file.size > MAX_FILE_BYTES) {
		return undefined;
	}
	let image: HTMLImageElement;
	try {
		image = await loadImage(file);
	} catch {
		return undefined;
	}
	const width = image.naturalWidth || ICON_EDGE;
	const height = image.naturalHeight || ICON_EDGE;
	const scale = Math.min(ICON_EDGE / width, ICON_EDGE / height);
	const drawWidth = Math.max(1, Math.round(width * scale));
	const drawHeight = Math.max(1, Math.round(height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = ICON_EDGE;
	canvas.height = ICON_EDGE;
	const context = canvas.getContext("2d");
	if (context === null) {
		return undefined;
	}
	context.imageSmoothingQuality = "high";
	context.drawImage(
		image,
		(ICON_EDGE - drawWidth) / 2,
		(ICON_EDGE - drawHeight) / 2,
		drawWidth,
		drawHeight,
	);
	const pixels = context.getImageData(0, 0, ICON_EDGE, ICON_EDGE).data;
	const icon: CustomIcon = {
		id,
		name: iconNameFromFile(file.name),
		src: canvas.toDataURL("image/png"),
	};
	if (isMonochrome(pixels)) {
		icon.tint = true;
	}
	return icon;
}
