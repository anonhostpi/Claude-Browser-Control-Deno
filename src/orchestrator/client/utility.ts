import { Client } from "./client.ts";
import { EndpointContract } from "../contract.ts";
import { JSONSchema, FromSchema } from "json-schema-to-ts";

function _create<
  RequestType,
  ResponseType,
  ErrorType
>(contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema>): (client: Client, request?: RequestType) => Promise<ResponseType | ErrorType> {
  return async (client: Client, request?: RequestType): Promise<ResponseType | ErrorType> => {
    const response = contract.request ?
      await client.complex(
        contract.method,
        contract.path,
        request
      ) :
      await client.simple(
        contract.method,
        contract.path
      );
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