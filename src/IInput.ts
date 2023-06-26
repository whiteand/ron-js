export interface IInput {
  skipWhitespace(): void;
  character(): string;
  skip(length: number): void;
  checkpoint(): number;
  rewind(checkpoint: number): void;
  fail(message: string): never;
  eof(): boolean;
}
