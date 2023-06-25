import { StringInput } from "./StringInput";
import { IRonParserOptions, createRonParser } from "./parser";

export function parse<T = unknown>(
  text: string,
  options: IRonParserOptions = {}
): T {
  const parser = createRonParser(options);
  const input = new StringInput(text);
  const result = parser(input);
  if (!result.ok) {
    input.fail("failed to parse ron value");
  }
  return (result as any).value;
}
