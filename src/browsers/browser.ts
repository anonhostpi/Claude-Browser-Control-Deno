import {
  Type,
  Config
} from "./metadata.ts";

import { BROWSER_CONFIGS } from "./configs.ts";
import { OS } from "../os/mod.ts";
import { CLI } from "../cli/cli.ts";

export interface IBrowser {
  type: Type;
  name: string;
  executable: string;
  user_data: string;
  version?: string;
  installed: boolean;
}

export class Browser implements IBrowser {
  static check(query: Config): Browser {
    const os = OS.instance;
    const paths = query.paths[os.platform];
    let exe: string;
    for (const path of paths.executables) {
      if (CLI.exists("file", path, true)) {
        exe = path;
        break;
      }
    }

    const data_dir = CLI.expand(paths.user_data);
    return new Browser({
      type: query.type,
      name: query.name,
      executable: exe!,
      user_data: data_dir,
      installed: CLI.exists("file", exe!, true),
    });
  }

  static discover(): Browser[] {
    const browsers: Browser[] = [];
    for (const config of BROWSER_CONFIGS) {
      const browser = Browser.check(config);
      if (browser.installed)
        browsers.push(browser);
    }
    return browsers;
  }

  static get(type: Type): Browser | null {
    const config = BROWSER_CONFIGS.find((c) => c.type === type);
    if (!config) return null;
    const browser = Browser.check(config);
    return browser.installed ? browser : null;
  }

  static get default(): Browser | null {
    const preference: Type[] = [
      "chrome", "edge", "brave", "chromium", "vivaldi"
    ];
    for (const type of preference) {
      const browser = Browser.get(type);
      if (browser)
        return browser;
    }
    return null;
  }

  constructor(info: IBrowser) {
    Object.assign(this, info);
  }
  readonly type!: Type;
  readonly name!: string;
  readonly executable!: string;
  readonly user_data!: string;
  readonly installed!: boolean;
  readonly version?: string;
}