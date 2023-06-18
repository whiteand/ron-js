import { IInput } from "./IInput";

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

function positiveFloatParser(input: IInput): ParserResult<number> {
  let allowedCharacters = new Set([
    ".",
    "e",
    "E",
    ...Array.from({ length: 10 }, (_, i) => i.toString()),
  ]);
  let collected = "";
  while (!input.eof()) {
    let ch = input.character();
    if (!allowedCharacters.has(ch)) {
      break;
    }
    if (ch === ".") {
      allowedCharacters.delete(".");
    } else if (ch === "e" || ch === "E") {
      allowedCharacters.delete("e");
      allowedCharacters.delete("E");
      allowedCharacters.delete(".");
      allowedCharacters.add("+");
      allowedCharacters.add("-");
    } else if (ch === "+" || ch === "-") {
      allowedCharacters.delete("+");
      allowedCharacters.delete("-");
    }
    collected += ch;
    input.skip(1);
  }
  if (!collected) return FALSE_RESULT;
  const parsed = Number.parseFloat(collected);
  if (Number.isNaN(parsed)) return FALSE_RESULT;
  return ok(parsed);
}
const HEX_DIGITS = "0123456789abcdefABCDEF";
function hexInteger(input: IInput): ParserResult<number> {
  let hexDigits = "";
  while (!input.eof()) {
    let ch = input.character();
    if (HEX_DIGITS.indexOf(ch) < 0) {
      break;
    }
    hexDigits += ch;
    input.skip(1);
  }
  if (!hexDigits) {
    return FALSE_RESULT;
  }
  const result = Number.parseInt(hexDigits, 16);
  if (Number.isNaN(result)) {
    return FALSE_RESULT;
  }
  return ok(result);
}
const BINARY_DIGITS = "01";
function binaryInteger(input: IInput): ParserResult<number> {
  let result = 0;
  let hasSomething = false;
  while (!input.eof()) {
    let ch = input.character();
    const digit = BINARY_DIGITS.indexOf(ch);
    if (digit < 0) {
      break;
    }
    hasSomething = true;
    result *= 2;
    result += digit;
    input.skip(1);
  }
  return hasSomething ? ok(result) : FALSE_RESULT;
}
const DECIMAL_DIGITS = "0123456789";
function decimalPositiveInteger(input: IInput): ParserResult<number> {
  let result = 0;
  let ch = input.character();
  if (DECIMAL_DIGITS.indexOf(ch) < 0) {
    return FALSE_RESULT;
  }
  while (!input.eof()) {
    const digit = DECIMAL_DIGITS.indexOf(ch);
    if (digit < 0) {
      break;
    }
    result *= 10;
    result += digit;
    input.skip(1);
    ch = input.character();
  }

  return ok(result);
}
export function positiveNumber(input: IInput): ParserResult<number> {
  input.skipWhitespace();
  let numberStart = input.checkpoint();
  let ch = input.character();
  if (ch === ".") {
    return positiveFloatParser(input);
  }
  if (ch === "0") {
    while (ch === "0" && !input.eof()) {
      input.skip(1);
      ch = input.character();
    }
    if (ch === "x" || ch === "X") {
      input.skip(1);
      return hexInteger(input);
    }
    if (ch === ".") {
      return positiveFloatParser(input);
    }
    if (ch === "b" || ch === "B") {
      input.skip(1);
      return binaryInteger(input);
    }
    let checkpoint = input.checkpoint();
    let decimalIntegerResult = decimalPositiveInteger(input);
    if (!decimalIntegerResult.ok) {
      input.rewind(checkpoint);
      return ok(0);
    }
    return decimalIntegerResult;
  }
  let integerPart = decimalPositiveInteger(input);
  if (!integerPart.ok) {
    return FALSE_RESULT;
  }
  if (input.eof()) {
    return integerPart;
  }
  ch = input.character();
  if (ch === "." || ch === "e" || ch === "E") {
    input.rewind(numberStart);
    return positiveFloatParser(input);
  }

  return integerPart;
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

interface IRonParserOptions {}

const DEFAULT_RON_PARSER_OPTIONS: IRonParserOptions = {};

export const createRonParser = (
  options: IRonParserOptions = DEFAULT_RON_PARSER_OPTIONS
) => or(number);
