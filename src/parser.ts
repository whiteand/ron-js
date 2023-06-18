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
const HEX_DIGITS = "0123456789abcdefABCDEF";
export function positiveNumber(input: IInput): ParserResult<number> {
  input.skipWhitespace();
  const GET_DOT = 1;
  const GET_EXP = 2;
  const GET_EXP_SIGN = 4;
  const GET_EXP_DIGIT = 8;
  const GET_BINARY_SIGN = 16;
  const GET_HEX_SIGN = 32;

  let state = 0;
  let collected = "";
  while (!input.eof()) {
    let ch = input.character();
    if (ch === ".") {
      if ((state & GET_DOT) > 0) {
        return FALSE_RESULT;
      }
      collected += ch;
      state |= GET_DOT;
      input.skip(1);
      continue;
    }
    if (ch === "e" || ch === "E") {
      if ((state & GET_BINARY_SIGN) > 0) {
        return FALSE_RESULT;
      }
      if ((state & GET_HEX_SIGN) > 0) {
        return FALSE_RESULT;
      }
      if ((state & GET_EXP) > 0) {
        return FALSE_RESULT;
      }
      collected += ch;
      state |= GET_EXP;
      input.skip(1);
      continue;
    }
    if (ch === "+" || ch === "-") {
      if ((state & GET_BINARY_SIGN) > 0) {
        return FALSE_RESULT;
      }
      if ((state & GET_HEX_SIGN) > 0) {
        return FALSE_RESULT;
      }
      if ((state & GET_EXP) === 0) {
        break;
      }
      if ((state & GET_EXP_SIGN) > 0) {
        return FALSE_RESULT;
      }
      collected += ch;
      state |= GET_EXP_SIGN;
      input.skip(1);
      continue;
    }
    if (ch === "b" || ch === "B") {
      if ((state & GET_BINARY_SIGN) > 0) {
        return FALSE_RESULT;
      }
      if ((state & GET_HEX_SIGN) > 0) {
        return FALSE_RESULT;
      }
      collected = "";
      state |= GET_BINARY_SIGN;
      input.skip(1);
      continue;
    }
    if (ch === "x" || ch === "X") {
      if ((state & GET_BINARY_SIGN) > 0) {
        return FALSE_RESULT;
      }
      if ((state & GET_HEX_SIGN) > 0) {
        return FALSE_RESULT;
      }
      if ((state & GET_EXP) > 0) {
        return FALSE_RESULT;
      }
      collected = "";
      state |= GET_HEX_SIGN;
      input.skip(1);
      continue;
    }
    let d = HEX_DIGITS.indexOf(ch);
    if (d < 0) {
      break;
    }
    if ((state & GET_BINARY_SIGN) > 0) {
      if (d > 1) {
        return FALSE_RESULT;
      }
      collected += ch;
      input.skip(1);
      continue;
    }
    if ((state & GET_HEX_SIGN) > 0) {
      collected += ch;
      input.skip(1);
      continue;
    }
    if ((state & GET_EXP) > 0) {
      if (d > 9) {
        return FALSE_RESULT;
      }
      collected += ch;
      state |= GET_EXP_DIGIT;
      input.skip(1);
      continue;
    }
    if ((state & GET_DOT) > 0) {
      if (d > 9) {
        return FALSE_RESULT;
      }
      collected += ch;
      input.skip(1);
      continue;
    }
    if (d > 9) {
      return FALSE_RESULT;
    }
    collected += ch;
    input.skip(1);
  }
  // input.fail(`collected: ${JSON.stringify(collected)}`);
  if ((state & GET_BINARY_SIGN) > 0) {
    const result = Number.parseInt(collected, 2);
    if (Number.isNaN(result)) {
      input.fail(`Failed to parse binary number: ${collected}`);
    }
    return ok(result);
  }
  if ((state & GET_HEX_SIGN) > 0) {
    const result = Number.parseInt(collected, 16);
    if (Number.isNaN(result)) {
      input.fail(`Failed to parse hex number: ${collected}`);
    }
    return ok(result);
  }
  if ((state & GET_EXP) > 0 || (state & GET_DOT) > 0) {
    const result = Number.parseFloat(collected);
    if (Number.isNaN(result)) {
      input.fail(`Failed to parse float number: ${collected}`);
    }
    return ok(result);
  }

  const result = Number.parseInt(collected, 10);
  if (Number.isNaN(result)) {
    input.fail(`Failed to parse int number: ${collected}`);
  }
  return ok(result);
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
