import { renderToBuffer as rpdfRenderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { registerJpFont } from "./font";

export async function renderToBuffer(element: ReactElement): Promise<Buffer> {
  registerJpFont();
  // @react-pdf/renderer の型は DocumentProps を要求するが、実体は Document 要素
  return rpdfRenderToBuffer(element as Parameters<typeof rpdfRenderToBuffer>[0]);
}
