import { describe, it } from "@vitest/runner";
import { RonTransform } from "../src";
import * as fs from "node:fs/promises";
import * as path from "node:path";

async function readFile(p: string): Promise<fs.FileHandle> {
  // we are calculating relative path relative to this file
  let x = path.resolve(__dirname, p);
  return fs.open(x, "r");
}

describe("my test", () => {
  it("should work", async () => {
    const ronBytes = await readFile("./examples/node.ron");
    const input = ronBytes.readableWebStream().pipeThrough(new RonTransform());
    for await (const line of input.values()) {
      console.log(line);
    }
  });
});
