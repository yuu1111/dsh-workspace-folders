import { application } from "@yuu1111/knip-config/application";

export default {
	...application,
	entry: ["src/index.ts", "src/client.tsx"],
	// build.ts が JSON をファイルとして読み 絵文字の表をバンドルへ埋める
	ignoreDependencies: ["emojibase-data"],
};
