import { describe, it } from "@vitest/runner";
import { StringInput, createRonParser } from "../src";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { expect } from "vitest";

describe("ron parser", () => {
  it("should correctly parses numbers", () => {
    const ronParser = createRonParser();
    const inputs = [
      ["42", true, 42, ""],
      ["   42", true, 42, ""],
      ["   42 ", true, 42, " "],
      ["001", true, 1, ""],
      ["0x1", true, 1, ""],
      ["0xa", true, 10, ""],
      ["0xAa", true, 170, ""],
      ["0b010", true, 2, ""],
      ["   a42 ", false, null, "   a42 "],
      ["3.14", true, 3.14, ""],
      ["3.14e2", true, 314, ""],
      ["3e2", true, 300, ""],
      ["e2", false, null, "e2"],
    ] as const;
    for (const [input, isOk, value, rest] of inputs) {
      const stringInput = new StringInput(input);

      const parsedValue = ronParser(stringInput);

      if (isOk) {
        if (!parsedValue.ok) {
          stringInput.fail("expected to be ok");
        }
        expect(parsedValue.ok).toBe(true);
        expect((parsedValue as any).value).toBe(value);
        expect(stringInput.rest()).toBe(rest);
      } else {
        expect(parsedValue.ok).toBe(false);
        expect(stringInput.rest()).toBe(rest);
      }
    }
  });
});
