import { Client } from "./client.ts";
import type { EndpointContract } from "../contract.ts";
import type { JSONSchema, FromSchema } from "json-schema-to-ts";

function _create<
  RequestType,
  ResponseType,
  ErrorType
>(contract: EndpointContract): (client: Client, request?: RequestType) => Promise<ResponseType | ErrorType> {
  return async (client: Client, request?: RequestType): Promise<ResponseType | ErrorType> => {
    let response: unknown;
    switch (contract.method) {
      case "HEAD":
      case "DELETE":
        await client.simple(contract.method, contract.path);
        response = undefined;
        break;
      case "GET":
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
  }
}

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