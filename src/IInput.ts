export interface IInput {
  skipWhitespace(): void;
  position(): void;
  character(): string;
  skip(length: number): void;
  checkpoint(): number;
  rewind(checkpoint: number): void;
  rest(): string;
  fail(message: string): never;
  failMessage(message: string): string;
  eof(): boolean;
}
