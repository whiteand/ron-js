import { IInput } from "./IInput";

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

let cnt = 0;

export class StringInput implements IInput {
  private text: string;
  private pos: number;

  constructor(text: string) {
    this.text = text;
    this.pos = 0;
  }
  eof(): boolean {
    cnt += 1;
    if (cnt > 1e4) {
      this.fail(`infinite loop`);
    }
    return this.pos >= this.text.length;
  }
  failMessage(message: string): string {
    const startPosition = Math.max(0, this.pos - 10);
    const endPosition = Math.min(this.text.length, this.pos + 10);
    const context = this.text.slice(startPosition, endPosition);

    const lines: string[] = [];
    lines.push(`Failed to parse: ${message}`);
    lines.push(`  at ${this.pos}`);
    lines.push(`Input:`);
    lines.push(`  ${context}`);
    lines.push(`  ${" ".repeat(this.pos - startPosition)}^`);

    return lines.join("\n");
  }
  fail(message: string): never {
    throw new Error(this.failMessage(message));
  }
  rest(): string {
    return this.text.slice(this.pos);
  }
  skipWhitespace(): void {
    while (this.pos < this.text.length) {
      const ch = this.text[this.pos];
      if (isWhitespace(ch)) {
        this.pos++;
      } else {
        break;
      }
    }
  }
  position(): void {
    throw new Error("Method not implemented.");
  }
  character(): string {
    return this.text[this.pos];
  }
  skip(length: number): void {
    this.pos += length;
    if (this.pos > this.text.length) {
      this.pos = this.text.length;
    }
  }
  checkpoint(): number {
    return this.pos;
  }
  rewind(checkpoint: number): void {
    this.pos = checkpoint;
  }
}
