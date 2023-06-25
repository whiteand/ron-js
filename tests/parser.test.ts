import { describe, it } from "@vitest/runner";
import { StringInput, createRonParser, parse, typeSymbol } from "../src";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { expect } from "vitest";

describe("ron parser", () => {
  it.each([
    ["42", true, 42, ""],
    ["   42", true, 42, ""],
    ["   42 ", true, 42, " "],
    ["001", true, 1, ""],
    ["0x1", true, 1, ""],
    ["0xa", true, 10, ""],
    ["0xAa", true, 170, ""],
    ["0b010", true, 2, ""],
    ["3.14", true, 3.14, ""],
    ["3.14e2", true, 314, ""],
    ["3e2", true, 300, ""],
  ])(
    'should correctly parse number literal: "%s"',
    (input, isOk, value, rest) => {
      const stringInput = new StringInput(input);

      const ronParser = createRonParser();

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        if (!parsedValue.ok) return;
        expect((parsedValue as any).value).toBe(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  );
  it("should correctly parse string literals", () => {
    const ronParser = createRonParser();
    const inputs = [
      // `"Hello"`, `"with\\escapes\n"`, `r#"raw string, great for regex\."#`
      [`"Hello"`, true, "Hello", ""],
      [`"with\\\\escapes\\n"`, true, `with\\escapes\n`, ""],
      [
        `r#"raw string, great for regex\\."#`,
        true,
        "raw string, great for regex\\.",
        "",
      ],
    ] as const;
    for (const [input, isOk, value, rest] of inputs) {
      const stringInput = new StringInput(input);

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        if (!parsedValue.ok) return;
        expect((parsedValue as any).value).toBe(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  });
  it("should correctly parse boolean literals", () => {
    const ronParser = createRonParser();
    const inputs = [
      [`true`, true, true, ""],
      [` true`, true, true, ""],
      [`false`, true, false, ""],
      [` false`, true, false, ""],
    ] as const;
    for (const [input, isOk, value, rest] of inputs) {
      const stringInput = new StringInput(input);

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        if (!parsedValue.ok) return;
        expect((parsedValue as any).value).toBe(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  });

  it("should correctly parse character literals", () => {
    const ronParser = createRonParser();
    const inputs = [
      [`'e'`, true, "e", ""],
      [`'\\n'`, true, "\n", ""],
    ] as const;
    for (const [input, isOk, value, rest] of inputs) {
      const stringInput = new StringInput(input);

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        if (!parsedValue.ok) return;
        expect((parsedValue as any).value).toBe(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  });
  it("should correctly parse optional literals", () => {
    const ronParser = createRonParser();
    const inputs = [
      [`Some("string")`, true, { type: "some", value: "string" }, ""],
      [`None`, true, { type: "none" }, ""],
    ] as const;
    for (const [input, isOk, value, rest] of inputs) {
      const stringInput = new StringInput(input);

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        if (!parsedValue.ok) return;
        expect((parsedValue as any).value).toEqual(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  });
  it("should correctly parse tupples", () => {
    const ronParser = createRonParser();
    const inputs = [
      [`("abc", 1.23, true)`, true, ["abc", 1.23, true], ""],
      [`()`, true, [], ""],
    ] as const;
    for (const [input, isOk, value, rest] of inputs) {
      const stringInput = new StringInput(input);

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        if (!parsedValue.ok) return;
        expect((parsedValue as any).value).toEqual(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  });
  it("should correctly parse lists", () => {
    const ronParser = createRonParser();
    const inputs = [
      [`["abc", "def"]`, true, ["abc", "def"], ""],
      [`[]`, true, [], ""],
    ] as const;
    for (const [input, isOk, value, rest] of inputs) {
      const stringInput = new StringInput(input);

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        if (!parsedValue.ok) return;
        expect((parsedValue as any).value).toEqual(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  });
  it("should correctly parse structures", () => {
    let input = `( foo: 1.0, bar: ( baz: "I'm nested" ) )`;
    const stringInput = new StringInput(input);
    const parsedValue = createRonParser()(stringInput);
    expect(parsedValue.ok).toBe(true);
    if (!parsedValue.ok) return;
    expect(parsedValue.value).toEqual({
      foo: 1.0,
      bar: {
        baz: "I'm nested",
        [typeSymbol]: null,
      },
      [typeSymbol]: null,
    });
  });
  it("should correctly parse typed structures", () => {
    let input = `Coin( foo: 1.0, bar: ( baz: "I'm nested" ) )`;
    const stringInput = new StringInput(input);
    const parsedValue = createRonParser()(stringInput);
    expect(parsedValue.ok).toBe(true);
    if (!parsedValue.ok) return;
    expect(parsedValue.value).toEqual({
      foo: 1.0,
      bar: {
        baz: "I'm nested",
        [typeSymbol]: null,
      },
      [typeSymbol]: "Coin",
    });
  });
  it("should correctly parse typed structures", () => {
    let input = `Coin`;
    const stringInput = new StringInput(input);
    const parsedValue = createRonParser()(stringInput);
    expect(parsedValue.ok).toBe(true);
    if (!parsedValue.ok) return;
    expect(parsedValue.value).toEqual({
      [typeSymbol]: "Coin",
    });
  });
  it("should correctly parse map literal", () => {
    let input = `{ "arbitrary": "keys", "are": "allowed" }`;
    const stringInput = new StringInput(input);
    const parsedValue = createRonParser()(stringInput);
    expect(parsedValue.ok).toBe(true);
    if (!parsedValue.ok) return;
    expect(parsedValue.value).toEqual(
      new Map([
        ["arbitrary", "keys"],
        ["are", "allowed"],
      ])
    );
  });
  it("correctly parses example value", () => {
    const examplesDirectoryPath = require("path").resolve(
      __dirname,
      "./examples"
    );

    const files = require("fs").readdirSync(examplesDirectoryPath);
    for (const file of files) {
      if (file.trim().endsWith(".ron")) {
        const filePath = require("path").resolve(examplesDirectoryPath, file);

        const input = require("fs").readFileSync(filePath).toString();
        const parsedValue = parse(input);

        console.log(parsedValue);
      }
    }
  });
});
