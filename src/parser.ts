import { IInput } from "./IInput";
import { typeSymbol } from "./typeSymbol";

const FALSE_RESULT = { ok: false } as const;
class OkResult<T> {
  public value: T;
  public ok: true = true;
  constructor(value: T) {
    this.value = value;
  }
}

function ok<T>(value: T): OkResult<T> {
  return new OkResult(value);
}

type ParserResult<T> = OkResult<T> | typeof FALSE_RESULT;

export type Parser<T> = (input: IInput) => ParserResult<T>;

export function optionalNumberSign(input: IInput): ParserResult<1 | -1 | null> {
  input.skipWhitespace();
  let ch = input.character();
  if (ch === "+") {
    input.skip(1);
    return ok(1);
  }
  if (ch === "-") {
    input.skip(1);
    return ok(-1);
  }
  return ok(null);
}

function isDecimalDigit(ch: string) {
  return ch >= "0" && ch <= "9";
}
const HEX_DIGITS = "0123456789abcdefABCDEF";
function isHexDigit(ch: string) {
  return (
    isDecimalDigit(ch) || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F")
  );
}
export function positiveNumber(input: IInput): ParserResult<number> {
  input.skipWhitespace();

  const POSSIBLY_DECIMAL = 1;
  const POSSIBLY_FLOAT = 2;
  const POSSIBLY_HEX = 4;
  const POSSIBLY_BINARY = 8;
  const HAS_DOT = 16;
  const HAS_EXP = 32;
  const HAS_EXP_SIGN = 64;
  const HEX_SYSTEM_LETTER = 128;

  let possibilities =
    POSSIBLY_DECIMAL | POSSIBLY_FLOAT | POSSIBLY_HEX | POSSIBLY_BINARY;

  let state = 0;

  let collected = "";
  while (!input.eof()) {
    let ch = input.character();
    if (ch === ".") {
      if ((possibilities & POSSIBLY_FLOAT) === 0) {
        return FALSE_RESULT;
      }
      if ((state & HAS_DOT) > 0) {
        return FALSE_RESULT;
      }
      collected += ch;
      state |= HAS_DOT;
      input.skip(1);
      possibilities = POSSIBLY_FLOAT;
      continue;
    }
    if (ch === "e" || ch === "E") {
      if ((possibilities & POSSIBLY_FLOAT) === 0) {
        return FALSE_RESULT;
      }
      if ((state & HAS_EXP) > 0) {
        return FALSE_RESULT;
      }
      if (!isDecimalDigit(collected[collected.length - 1])) {
        return FALSE_RESULT;
      }
      possibilities = POSSIBLY_FLOAT;
      state |= HAS_EXP;
      collected += ch;
      input.skip(1);
      continue;
    }
    if (ch === "+" || ch === "-") {
      if ((possibilities & POSSIBLY_FLOAT) === 0) {
        return FALSE_RESULT;
      }
      if ((state & HAS_EXP) === 0) {
        return FALSE_RESULT;
      }
      if ((state & HAS_EXP_SIGN) > 0) {
        return FALSE_RESULT;
      }
      collected += ch;
      state |= HAS_EXP_SIGN;
      input.skip(1);
      continue;
    }

    if (ch === "b" || ch === "B") {
      if (collected !== "0") return FALSE_RESULT;
      if ((possibilities & POSSIBLY_BINARY) === 0) {
        return FALSE_RESULT;
      }
      if ((state & HEX_SYSTEM_LETTER) > 0) {
        return FALSE_RESULT;
      }
      possibilities = POSSIBLY_BINARY;
      state |= HEX_SYSTEM_LETTER;
      collected = "";
      input.skip(1);
      continue;
    }
    if (ch === "x" || ch === "X") {
      if (collected !== "0") return FALSE_RESULT;
      if ((possibilities & POSSIBLY_HEX) === 0) {
        return FALSE_RESULT;
      }
      if ((state & HEX_SYSTEM_LETTER) > 0) {
        return FALSE_RESULT;
      }
      possibilities = POSSIBLY_HEX;
      state |= HEX_SYSTEM_LETTER;
      collected = "";
      input.skip(1);
      continue;
    }

    if (ch === "0" || ch === "1") {
      collected += ch;
      input.skip(1);
      continue;
    }

    if (isDecimalDigit(ch)) {
      if (possibilities === POSSIBLY_BINARY) {
        return FALSE_RESULT;
      }
      possibilities = possibilities & ~POSSIBLY_BINARY;
      collected += ch;
      input.skip(1);
      continue;
    }
    if (isHexDigit(ch)) {
      if (possibilities !== POSSIBLY_HEX) {
        return FALSE_RESULT;
      }
      possibilities = possibilities & ~POSSIBLY_BINARY;
      possibilities = possibilities & ~POSSIBLY_DECIMAL;
      collected += ch;
      input.skip(1);
      continue;
    }
    break;
  }
  if (possibilities === 0) {
    return FALSE_RESULT;
  }
  if (possibilities === POSSIBLY_BINARY) {
    const res = Number.parseInt(collected, 2);
    if (Number.isNaN(res)) {
      input.fail("failed to decode binary number literal");
    }
    return ok(res);
  }
  if (possibilities === POSSIBLY_HEX) {
    const res = Number.parseInt(collected, 16);
    if (Number.isNaN(res)) {
      input.fail("failed to decode hex number literal");
    }
    return ok(res);
  }
  if (possibilities === POSSIBLY_FLOAT) {
    const res = Number.parseFloat(collected);
    if (Number.isNaN(res)) {
      input.fail("failed to decode float number literal");
    }
    return ok(res);
  }
  if (!collected) return FALSE_RESULT;
  const res = Number.parseInt(collected, 10);
  if (Number.isNaN(res)) {
    input.fail("failed to decode decimal number literal");
  }
  return ok(res);
}
export function number(input: IInput): ParserResult<number> {
  input.skipWhitespace();

  let optionalSignResult = optionalNumberSign(input);

  if (!optionalSignResult.ok) {
    return FALSE_RESULT;
  }

  let pos = positiveNumber(input);
  if (!pos.ok) {
    return FALSE_RESULT;
  }

  if (optionalSignResult.value === -1) {
    return ok(-pos.value);
  }
  return ok(pos.value);
}
type InferOrParserResultValue<PS extends Parser<any>[]> = PS extends []
  ? never
  : PS extends [Parser<infer T>]
  ? T
  : PS extends [Parser<infer T>, ...infer Rest]
  ? Rest extends Parser<any>[]
    ? T | InferOrParserResultValue<Rest>
    : never
  : never;

export function or<Parsers extends Parser<any>[]>(
  ...parsers: Parsers
): Parser<InferOrParserResultValue<Parsers>> {
  return (input: IInput) => {
    const checkpoint = input.checkpoint();
    for (const parser of parsers) {
      const result = parser(input);
      if (result.ok) {
        return result; // as ParserResult<InferOrParserResultValue<Parsers>>;
      }
      input.rewind(checkpoint);
    }
    return FALSE_RESULT;
  };
}

export interface IRonParserOptions {}

const DEFAULT_RON_PARSER_OPTIONS: IRonParserOptions = {};

function stringLiteral(input: IInput): ParserResult<string> {
  input.skipWhitespace();
  let ch = input.character();
  let numberOfHashes = 0;
  if (ch === "r") {
    input.skip(1);
    while (!input.eof()) {
      if (input.character() === "#") {
        numberOfHashes += 1;
        input.skip(1);
        continue;
      }
      if (input.character() !== '"') {
        return FALSE_RESULT;
      }
      input.skip(1);
      break;
    }
  } else if (ch === '"') {
    input.skip(1);
  } else {
    return FALSE_RESULT;
  }
  let result = "";
  while (!input.eof()) {
    let ch = input.character();
    if (numberOfHashes === 0 && ch === "\\") {
      input.skip(1);
      ch = input.character();
      if (ch === "n") {
        result += "\n";
        input.skip(1);
        continue;
      }
      if (ch === "r") {
        result += "\r";
        input.skip(1);
        continue;
      }
      if (ch === "t") {
        result += "\t";
        input.skip(1);
        continue;
      }
      if (ch === "0") {
        result += "\0";
        input.skip(1);
        continue;
      }
      if (ch === '"') {
        result += '"';
        input.skip(1);
        continue;
      }
      if (ch === "\\") {
        result += "\\";
        input.skip(1);
        continue;
      }
      input.fail("unknown escape sequence");
    }
    if (ch === '"' && numberOfHashes === 0) {
      input.skip(1);
      return ok(result);
    }
    if (ch !== '"') {
      result += ch;
      input.skip(1);
      continue;
    }
    input.skip(1);
    let checkpoint = input.checkpoint();
    if (containsHashes(input, numberOfHashes)) {
      input.rewind(checkpoint);
      input.skip(numberOfHashes);
      return ok(result);
    } else {
      input.rewind(checkpoint);
      result += ch;
      input.skip(1);
    }
  }
  return FALSE_RESULT;
}

function containsHashes(input: IInput, numberOfHashes: number) {
  for (let i = 0; i < numberOfHashes; i++) {
    if (input.character() !== "#") {
      return false;
    }
    input.skip(1);
  }
  return true;
}

function startsWith(input: IInput, text: string): boolean {
  const checkpoint = input.checkpoint();
  const res = consume(input, text);
  input.rewind(checkpoint);
  return res;
}

function consume(input: IInput, text: string): boolean {
  let checkpoint = input.checkpoint();
  let i = 0;
  while (!input.eof()) {
    const ch = input.character();
    if (ch !== text[i]) {
      break;
    }
    input.skip(1);
    i++;
  }
  if (i === text.length) {
    return true;
  }
  input.rewind(checkpoint);
  return false;
}

function booleanLiteral(input: IInput): ParserResult<true | false> {
  input.skipWhitespace();

  if (startsWith(input, "true")) {
    input.skip(4);
    return ok(true);
  }
  if (startsWith(input, "false")) {
    input.skip(5);
    return ok(false);
  }
  return FALSE_RESULT;
}

function charLiteral(input: IInput): ParserResult<string> {
  input.skipWhitespace();
  if (input.character() !== "'") {
    return FALSE_RESULT;
  }
  input.skip(1);
  let ch = input.character();
  if (ch === "\\") {
    input.skip(1);
    ch = input.character();
    if (ch === "n") {
      ch = "\n";
    } else if (ch === "r") {
      ch = "\r";
    } else if (ch === "t") {
      ch = "\t";
    } else if (ch === "0") {
      ch = "\0";
    } else if (ch === '"') {
      ch = '"';
    } else if (ch === "'") {
      ch = "'";
    } else {
      return FALSE_RESULT;
    }
  }
  input.skip(1);
  if (input.character() !== "'") {
    return FALSE_RESULT;
  }
  input.skip(1);

  return ok(ch);
}

type TOption<T> = { type: "some"; value: T } | { type: "none" };

function optionalLiteral(p: Parser<any>): Parser<TOption<any>> {
  return function optionalLiteral(input: IInput): ParserResult<TOption<any>> {
    skipCommentsAndWhitespace(input);
    if (consume(input, "None")) {
      return ok({ type: "none" });
    }
    if (consume(input, "Some(")) {
      const result = p(input);
      if (!result.ok) {
        return FALSE_RESULT;
      }
      if (!consume(input, ")")) {
        return FALSE_RESULT;
      }
      return ok({ type: "some", value: result.value });
    }
    return FALSE_RESULT;
  };
}

function commaSeparatedList(
  p: Parser<any>,
  start: string,
  end: string
): Parser<any[]> {
  return function commaSeparatedListParser(input: IInput) {
    skipCommentsAndWhitespace(input);
    if (!consume(input, start)) {
      return FALSE_RESULT;
    }
    skipCommentsAndWhitespace(input);
    if (consume(input, end)) {
      return ok([]);
    }
    const result_tupple: any[] = [];
    while (true) {
      const result = p(input);
      if (!result.ok) {
        return FALSE_RESULT;
      }
      result_tupple.push(result.value);
      skipCommentsAndWhitespace(input);
      if (input.character() === ",") {
        input.skip(1);
      }
      skipCommentsAndWhitespace(input);
      if (consume(input, end)) {
        break;
      }
    }

    if (result_tupple.length <= 0) {
      return FALSE_RESULT;
    }

    return ok(result_tupple);
  };
}

function tuppleLiteral(p: Parser<any>): Parser<any[]> {
  const res = commaSeparatedList(p, "(", ")");
  return function tuppleLiteralParser(input: IInput) {
    return res(input);
  };
}
function lists(p: Parser<any>): Parser<any[]> {
  const res = commaSeparatedList(p, "[", "]");
  return function listLiteral(input: IInput) {
    return res(input);
  };
}

interface TypedStructure extends Record<string, any> {
  [typeSymbol]: string;
}

function isAlpha(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

const unitStructures = new Map<string, {}>();

function identifier(input: IInput): ParserResult<string> {
  let result = "";
  while (!input.eof()) {
    const ch = input.character();
    if (ch === "_" || isAlpha(ch) || isDigit(ch)) {
      result += ch;
      input.skip(1);
      continue;
    }
    break;
  }
  if (result === "") {
    return FALSE_RESULT;
  }
  return ok(result);
}

function structLiteral(p: Parser<any>): Parser<TypedStructure> {
  const parseKeyValue = function structureKeyValueParser(input: IInput) {
    skipCommentsAndWhitespace(input);
    const keyResult = identifier(input);
    if (!keyResult.ok) {
      return FALSE_RESULT;
    }
    skipCommentsAndWhitespace(input);
    if (!consume(input, ":")) {
      return FALSE_RESULT;
    }
    const valueResult = p(input);
    if (!valueResult.ok) {
      return FALSE_RESULT;
    }
    return ok([keyResult.value, valueResult.value]);
  };

  const fieldsParser = commaSeparatedList(parseKeyValue, "(", ")");

  return function structureLiteral(input: IInput) {
    skipCommentsAndWhitespace(input);
    const idResult = identifier(input);
    const structureType = idResult.ok ? idResult.value : null;
    skipCommentsAndWhitespace(input);

    let fields: [string, any][] = [];
    if (input.character() === "(") {
      const fieldsResult = fieldsParser(input);
      if (!fieldsResult.ok) {
        return FALSE_RESULT;
      }
      fields = fieldsResult.value;
    } else if (structureType == null) {
      return FALSE_RESULT;
    }
    if (fields.length === 0 && structureType != null) {
      const unitStructure = unitStructures.get(structureType);
      if (unitStructure == null) {
        const structureValue = { [typeSymbol]: structureType };
        unitStructures.set(structureType, structureValue);
        return ok(structureValue);
      }
      return ok(unitStructure);
    }

    let result = Object.create(null);
    for (const [key, value] of fields) {
      result[key] = value;
    }
    result[typeSymbol] = structureType;
    return ok(result);
  };
}

function mapLiteral(p: Parser<any>): Parser<Map<any, any>> {
  const parseKeyValue = function parseKeyValue(input: IInput) {
    skipCommentsAndWhitespace(input);
    const keyResult = p(input);
    if (!keyResult.ok) {
      return FALSE_RESULT;
    }
    skipCommentsAndWhitespace(input);
    if (!consume(input, ":")) {
      return FALSE_RESULT;
    }
    const valueResult = p(input);
    if (!valueResult.ok) {
      return FALSE_RESULT;
    }
    return ok([keyResult.value, valueResult.value]);
  };

  const keyValuesParser = commaSeparatedList(parseKeyValue, "{", "}");

  return function mapParser(input: IInput) {
    const fields = keyValuesParser(input);
    if (!fields.ok) {
      return FALSE_RESULT;
    }
    return ok(new Map(fields.value));
  };
}

function skipCommentsAndWhitespace(input: IInput) {
  input.skipWhitespace();
  if (input.character() !== "/") return false;
  let checkpoint = input.checkpoint();
  input.skip(1);
  if (input.character() !== "/") {
    input.rewind(checkpoint);
    return false;
  }
  while (!input.eof()) {
    if (input.character() === "\n") {
      input.skip(1);
      break;
    }
    input.skip(1);
  }
  return true;
}

export const createRonParser = (
  options: IRonParserOptions = DEFAULT_RON_PARSER_OPTIONS
) => {
  const parseValue = or(
    number,
    stringLiteral,
    booleanLiteral,
    charLiteral,
    optionalLiteral(p),
    tuppleLiteral(p),
    lists(p),
    structLiteral(p),
    mapLiteral(p)
  );

  function p(input: IInput) {
    skipCommentsAndWhitespace(input);
    return parseValue(input);
  }
  return p;
};
