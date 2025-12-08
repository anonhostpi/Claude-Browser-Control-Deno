import { Client } from "./client.ts";
import type { EndpointContract } from "../contract.ts";
import type {
  JSONSchema,
  FromSchema
} from "../schema.ts";

/**
 * Extract a contract by its name from a contracts array type.
 *
 * @example
 * ```ts
 * import { contracts } from "../contracts/api.ts";
 * type TargetControl = ContractByName<typeof contracts, "target:control">;
 * // TargetControl is the full contract type with request/response schemas
 * ```
 */
export type ContractByName<
  Contracts extends readonly EndpointContract[],
  Name extends Contracts[number]["name"]
> = Extract<Contracts[number], { name: Name }>;

function _create<
  RequestType,
  ResponseType,
  ErrorType
>(contract: EndpointContract): (client: Client, request?: RequestType) => Promise<ResponseType | ErrorType> {
  return async (client: Client, request?: RequestType): Promise<ResponseType | ErrorType> => {
    let response: unknown;
    switch (contract.method) {
      case "HEAD":
        await client.simple(contract.method, contract.path);
        response = undefined;
        break;
      case "GET":
      case "DELETE":
        response = await client.simple(contract.method, contract.path);
        break;
      case "POST":
      case "PUT":
      case "PATCH":
        response = contract.request
          ? await client.complex(contract.method, contract.path, request)
          : await client.simple(contract.method, contract.path);
        break;
    }
    return response as ResponseType | ErrorType;
  };
}

export type Extension = ReturnType<typeof _create>;

export function create<
  RequestSchema extends JSONSchema,
  ResponseSchema extends JSONSchema,
  ErrorSchema extends JSONSchema
>(contract: EndpointContract<RequestSchema, ResponseSchema, ErrorSchema>): (client: Client, request?: FromSchema<RequestSchema>) => Promise<FromSchema<ResponseSchema> | FromSchema<ErrorSchema>> {
  return _create<
    FromSchema<RequestSchema>,
    FromSchema<ResponseSchema>,
    FromSchema<ErrorSchema>
  >(contract);
}
