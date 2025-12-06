/**
 * CDP Module Exports
 */

import { default as Original } from "chrome-remote-interface";

export type CDP = typeof Original & {
  WithPage(options?: Original.Options): Promise<Original.Client>;
}
export const CDP: CDP = Object.assign(Original, {
  WithPage(options?: Original.Options): Promise<Original.Client> {
    return Original(Object.assign({}, options, {
      target: (targets: Original.Target[]) => {
        const page = targets.find((t) => t.type === "page");
        if (!page) throw new Error("No page target found");
        return page;
      }
    }))
  }
});
