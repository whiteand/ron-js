export interface IDataSource extends IResultSource {
  /**
   * Skips white space characters
   */
  skipWS(): boolean;
  /**
   * Returns the remaining bytes of the data source
   */
  bytes(): Uint8Array;

  /**
   * Skips the specified string if it is at the beginning of the remaining bytes
   *
   * returns true if the string is skipped, false otherwise
   */
  consume(str: string): boolean;
  checkTupleStruct(): boolean;
}

/**
 *  If some method of the object is supposed to return a result
 *  The actual result of the function should be returned via methods unwrapResult or unwrapResult.
 *  The result-returning function should return true if the result is available,
 *  and false if the result is failed.
 */
export interface IResultSource {
  unwrapError<T = unknown>(): T;
  unwrapResult<T = unknown>(): T;
}

export interface IDeserializerVisitor<V> extends IResultSource {
  visitUnit(): boolean;
}
