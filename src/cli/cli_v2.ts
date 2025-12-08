import {
  ICLI,
  AllOptions,
  AllContractOptions,
  FlagMap,
} from "./types.ts";

export class CLI implements ICLI {
  "root:health": () => Promise<unknown>;
  "root:version": () => Promise<unknown>;
  "root:list": () => Promise<unknown>;
  "root:killAll": () => Promise<unknown>;
  
  "endpoint:exists": () => Promise<boolean>;
  "endpoint:info": () => Promise<unknown>;
  "endpoint:launch": () => Promise<unknown>;
  "endpoint:killAll": () => Promise<unknown>;

  "context:exists": () => Promise<boolean>;
  "context:info": () => Promise<unknown>;
  "context:create": () => Promise<unknown>;
  "context:close": () => Promise<unknown>;

  "target:exists": () => Promise<boolean>;
  "target:info": () => Promise<unknown>;
  "target:cdp": () => Promise<unknown>;
  "target:control": () => Promise<unknown>;
  "target:create": () => Promise<unknown>;
  "target:content": () => Promise<unknown>;
  "target:emulate": () => Promise<unknown>;
  "target:throttle": () => Promise<unknown>;
  "target:intercept": () => Promise<unknown>;
  "target:label": () => Promise<unknown>;
  "target:close": () => Promise<unknown>;

  "node:exists": () => Promise<boolean>;
  "node:info": () => Promise<unknown>;
  "node:create": () => Promise<unknown>;
  "node:replace": () => Promise<unknown>;
  "node:interact": () => Promise<unknown>;
  "node:remove": () => Promise<unknown>;

  static #singleton: CLI | null = null;
  static create(
    location: string,
    version: string,
    usage: string
  ): CLI {
    if (this.#singleton)
      throw new Error("CLI instance is a singleton and already exists.");

    return this.#singleton = new CLI(location, version, usage);
  }
  static get instance(): CLI {
    if (!this.#singleton)
      throw new Error("CLI instance has not been instantiated yet.");

    return this.#singleton;
  }
  private constructor(
    location: string,
    version: string,
    usage: string
  ) {
    this.location = location;
    this.version = version;
    this.usage = usage;

    this.flags = this.parse();
  }

  readonly location: string;
  readonly version: string;
  readonly usage: string;
  readonly flags: Partial<FlagMap> = {};
  help(): string {
    return this.usage;
  }

  readonly args: string[] = Deno.args.slice(1);
  readonly command: string = Deno.args[0] || "help";
  parse(args: string[] = this.args): Partial<FlagMap> {
    const flags: Partial<FlagMap> = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--")) {
        const eqIdx = arg.indexOf("=");
        if (eqIdx > 0)
          flags[arg.slice(2, eqIdx) as AllOptions] = arg.slice(eqIdx + 1);
        else {
          const next = args[i + 1];
          if (!next || next.startsWith("-"))
            flags[arg.slice(2) as AllOptions] = true;
          else {
            flags[arg.slice(2) as AllOptions] = next;
            i++;
          }
        }
      } else if (arg.startsWith("-")) {
        const letters = arg.slice(1).split("");
        if (letters.length === 1) {
          const next = args[i + 1];
          if (!next || next.startsWith("-"))
            flags[letters[0] as AllOptions] = true;
          else {
            flags[letters[0] as AllOptions] = next;
            i++;
          }
        } else {
          for (const letter of letters)
            flags[letter as AllOptions] = true;
        }
      }
    }
    return flags;
  }

  #disallowed = ["args", "command", "parse"] as const;
  #get(command: string): () => Promise<any> {
    const bad =
      this.#disallowed.includes(command as any) ||
      !(command in this);
    if (bad)
      throw new Error(`Unknown command: ${command}`);

    const member = this[command as keyof this];
    if (typeof member !== "function")
      return () => Promise.resolve(this[command as keyof this]);
    return member.bind(this) as () => Promise<any>;
  }

  serve(): string { // returns url
    // WIP
  }
}