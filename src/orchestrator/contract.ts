import { JSONSchema } from "json-schema-to-ts";
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export type EndpointContract<
  RequestSchema extends JSONSchema,
  ResponseSchema extends JSONSchema,
  ErrorSchema extends JSONSchema,
  Name extends string = string
> = {
  name: Name; // unique identifier for filtering via `T extends { name: "..." }`
  path: string;
  method: Method;
  description: string; // description of the method
  request?: RequestSchema; // JSON Schema for the request body
  error?: ErrorSchema; // JSON Schema for usercode-defined errors
  response: ResponseSchema; // JSON Schema for the response body
  module: string; // module where the method is defined for server-side
};