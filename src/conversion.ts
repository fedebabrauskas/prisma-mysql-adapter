import { ColumnTypeEnum, type ColumnType } from "@prisma/driver-adapter-utils";
import type { FieldPacket, QueryOptions } from "mysql2";

const MySqlCodes: Record<number, string> = {
  0x00: "DECIMAL",
  0x01: "TINY",
  0x02: "SHORT",
  0x03: "LONG",
  0x04: "FLOAT",
  0x05: "DOUBLE",
  0x06: "NULL",
  0x07: "TIMESTAMP",
  0x08: "LONGLONG",
  0x09: "INT24",
  0x0a: "DATE",
  0x0b: "TIME",
  0x0c: "DATETIME",
  0x0d: "YEAR",
  0x0e: "NEWDATE",
  0x0f: "VARCHAR",
  0x10: "BIT",
  0xf5: "JSON",
  0xf6: "NEWDECIMAL",
  0xf7: "ENUM",
  0xf8: "SET",
  0xf9: "TINY_BLOB",
  0xfa: "MEDIUM_BLOB",
  0xfb: "LONG_BLOB",
  0xfc: "BLOB",
  0xfd: "VAR_STRING",
  0xfe: "STRING",
  0xff: "GEOMETRY",
};

const MySqlTypes = {
  DECIMAL: 0x00,
  TINY: 0x01,
  SHORT: 0x02,
  LONG: 0x03,
  FLOAT: 0x04,
  DOUBLE: 0x05,
  NULL: 0x06,
  TIMESTAMP: 0x07,
  LONGLONG: 0x08,
  INT24: 0x09,
  DATE: 0x0a,
  TIME: 0x0b,
  DATETIME: 0x0c,
  YEAR: 0x0d,
  NEWDATE: 0x0e,
  VARCHAR: 0x0f,
  BIT: 0x10,
  JSON: 0xf5,
  NEWDECIMAL: 0xf6,
  ENUM: 0xf7,
  SET: 0xf8,
  TINY_BLOB: 0xf9,
  MEDIUM_BLOB: 0xfa,
  LONG_BLOB: 0xfb,
  BLOB: 0xfc,
  VAR_STRING: 0xfd,
  STRING: 0xfe,
  GEOMETRY: 0xff,
};

const MySqlFlags = {
  NOT_NULL: 1,
  PRI_KEY: 2,
  UNIQUE_KEY: 4,
  MULTIPLE_KEY: 8,
  BLOB: 16,
  UNSIGNED: 32,
  ZEROFILL: 64,
  BINARY: 128,
  ENUM: 256,
  AUTO_INCREMENT: 512,
  TIMESTAMP: 1024,
  SET: 2048,
  NO_DEFAULT_VALUE: 4096,
  ON_UPDATE_NOW: 8192,
  NUM: 32768,
};

type TypeCast = Exclude<QueryOptions["typeCast"], undefined>;

export const typeCast: TypeCast = (field, next) => {
  if (field.type === "TIMESTAMP") {
    return field.string();
  }
  if (field.type === "DATETIME") {
    return field.string();
  }
  if (field.type === "DATE") {
    return field.string();
  }
  // Experimental
  if (field.type === "LONGLONG") {
    return field.string();
  }
  return next();
};

export class UnsupportedNativeDataType extends Error {
  type: string;

  constructor(field: FieldPacket) {
    super();
    this.type = (field.columnType && MySqlCodes[field.columnType]) || "Unknown";
    this.message = `Unsupported native data type: ${this.type}`;
  }
}

export function fieldToColumnType(field: FieldPacket): ColumnType {
  if (isReal(field)) return ColumnTypeEnum.Numeric;
  if (isFloat(field)) return ColumnTypeEnum.Float;
  if (isDouble(field)) return ColumnTypeEnum.Double;
  if (isInt32(field)) return ColumnTypeEnum.Int32;
  if (isInt64(field)) return ColumnTypeEnum.Int64;
  if (isDateTime(field)) return ColumnTypeEnum.DateTime;
  if (isTime(field)) return ColumnTypeEnum.Time;
  if (isDate(field)) return ColumnTypeEnum.Date;
  if (isText(field)) return ColumnTypeEnum.Text;
  if (isBytes(field)) return ColumnTypeEnum.Bytes;
  if (isBool(field)) return ColumnTypeEnum.Boolean;
  if (isJson(field)) return ColumnTypeEnum.Json;
  if (isEnum(field)) return ColumnTypeEnum.Enum;
  if (isNull(field)) return ColumnTypeEnum.Int32;
  throw new UnsupportedNativeDataType(field);
}

function isReal(field: FieldPacket) {
  return field.columnType === MySqlTypes.DECIMAL || field.columnType === MySqlTypes.NEWDECIMAL;
}

function isFloat(field: FieldPacket) {
  return field.columnType === MySqlTypes.FLOAT;
}

function isDouble(field: FieldPacket) {
  return field.columnType === MySqlTypes.DOUBLE;
}

function isInt32(field: FieldPacket) {
  return (
    field.columnType === MySqlTypes.TINY ||
    field.columnType === MySqlTypes.SHORT ||
    field.columnType === MySqlTypes.YEAR ||
    (field.columnType === MySqlTypes.LONG && !hasFlag(field.flags, MySqlFlags.UNSIGNED)) ||
    (field.columnType === MySqlTypes.INT24 && !hasFlag(field.flags, MySqlFlags.UNSIGNED))
  );
}

function isInt64(field: FieldPacket) {
  return (
    field.columnType === MySqlTypes.LONGLONG ||
    (field.columnType === MySqlTypes.LONG && hasFlag(field.flags, MySqlFlags.UNSIGNED)) ||
    (field.columnType === MySqlTypes.INT24 && hasFlag(field.flags, MySqlFlags.UNSIGNED))
  );
}

function isDateTime(field: FieldPacket) {
  // TODO: Add TIMESTAMP2 and DATETIME2?
  return field.columnType === MySqlTypes.TIMESTAMP || field.columnType === MySqlTypes.DATETIME;
}

function isTime(field: FieldPacket) {
  // TODO: Add TIME2?
  return field.columnType === MySqlTypes.TIME;
}

function isDate(field: FieldPacket) {
  return field.columnType === MySqlTypes.DATE || field.columnType === MySqlTypes.NEWDATE;
}

function isText(field: FieldPacket) {
  return (
    field.columnType === MySqlTypes.VARCHAR ||
    field.columnType === MySqlTypes.VAR_STRING ||
    field.columnType === MySqlTypes.STRING ||
    (field.columnType === MySqlTypes.TINY_BLOB && field.characterSet !== 63) ||
    (field.columnType === MySqlTypes.MEDIUM_BLOB && field.characterSet !== 63) ||
    (field.columnType === MySqlTypes.LONG_BLOB && field.characterSet !== 63) ||
    (field.columnType === MySqlTypes.BLOB && field.characterSet !== 63)
  );
}

function isBytes(field: FieldPacket) {
  return (
    (field.columnType === MySqlTypes.TINY_BLOB && field.characterSet === 63) ||
    (field.columnType === MySqlTypes.MEDIUM_BLOB && field.characterSet === 63) ||
    (field.columnType === MySqlTypes.LONG_BLOB && field.characterSet === 63) ||
    (field.columnType === MySqlTypes.BLOB && field.characterSet === 63) ||
    (field.columnType === MySqlTypes.BIT && field.columnLength && field.columnLength > 1)
  );
}

function isBool(field: FieldPacket) {
  return field.columnType === MySqlTypes.BIT && field.columnLength === 1;
}

function isJson(field: FieldPacket) {
  return field.columnType === MySqlTypes.JSON;
}

function isEnum(field: FieldPacket) {
  return field.columnType === MySqlTypes.ENUM || hasFlag(field.flags, MySqlFlags.ENUM);
}

function isNull(field: FieldPacket) {
  return field.columnType === MySqlTypes.NULL;
}

function hasFlag(flags: FieldPacket["flags"], target: number) {
  return (flags as number) & target;
}
