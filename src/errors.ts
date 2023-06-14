export class TrailingCharactersError extends Error {
  constructor() {
    super("Trailing characters");
  }
}
export class ExpectedStructLikeError extends Error {
  constructor() {
    super("Expected struct-like");
  }
}
