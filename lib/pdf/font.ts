import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

export function registerJpFont(): void {
  if (registered) return;
  const regular = path.join(process.cwd(), "public/fonts/NotoSansJP-Regular.ttf");
  // Bold 専用ファイルが無いため Regular を bold にも割り当てる（文字化け回避を優先）
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: regular },
      { src: regular, fontWeight: "bold" },
    ],
  });
  registered = true;
}
