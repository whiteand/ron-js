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

interface IRonParserOptions {}

const DEFAULT_RON_PARSER_OPTIONS: IRonParserOptions = {};

export const createRonParser = (
  options: IRonParserOptions = DEFAULT_RON_PARSER_OPTIONS
) => or(number);
