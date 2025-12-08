import type {
  JSONSchema, FromSchemaOptions, FromSchemaDefaultOptions,
  FromSchema as CoreFromSchema
} from "json-schema-to-ts";

export type { JSONSchema }

export type JSONPrimitive = string | number | boolean | null | undefined | void;
export type JSONPrimitiveNonVoid = Exclude<JSONPrimitive, void>;
export type JSONObject = { [key: string]: JSONSerializable };
export type JSONArray = JSONSerializable[];
export type JSONSerializable = JSONPrimitive | JSONObject | JSONArray;

export type FromSchema<
  SCHEMA extends JSONSchema,
  OPTIONS extends FromSchemaOptions = FromSchemaDefaultOptions
> =
  CoreFromSchema<SCHEMA, OPTIONS> extends { [x: string]: unknown; }
    ? CoreFromSchema<SCHEMA, OPTIONS> & JSONObject
    : CoreFromSchema<SCHEMA, OPTIONS>;