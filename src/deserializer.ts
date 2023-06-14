import { IDataSource, IDeserializerVisitor, IResultSource } from "./types";
import { ExpectedStructLikeError, TrailingCharactersError } from "./errors";

export class Deserializer<DS extends IDataSource = IDataSource>
  implements IResultSource
{
  private bytes: DS;
  private destroyed: boolean = false;
  private lastError: unknown = null;
  private lastResult: unknown = null;
  private lastIdentifier: string | null = null;
  private newTypeVariant: boolean = false;

  constructor(dataSource: DS) {
    this.bytes = dataSource;
  }

  intoDataSource(): DS {
    this.destroyed = true;
    return this.bytes;
  }

  unwrapError<T = unknown>(): T {
    if (this.lastError == null) {
      throw new Error("There is no error");
    }
    return this.lastError as T;
  }

  unwrapResult<T = unknown>(): T {
    if (this.lastError != null) {
    }
    return this.lastResult as T;
  }

  ok(result: unknown): boolean {
    this.lastError = null;
    this.lastResult = result;
    return true;
  }
  err(error: unknown): boolean {
    this.lastResult = null;
    this.lastError = error;
    return false;
  }

  call<RS extends IResultSource>(
    rs: RS,
    callback: (rs: RS) => boolean
  ): boolean {
    if (callback(rs)) {
      return this.ok(rs.unwrapResult());
    } else {
      return this.err(rs.unwrapError());
    }
  }
  /**
   * Check if the remaining bytes are whitespace only,
   * otherwise finishes with error signal.
   */
  end(): boolean {
    if (!this.bytes.skipWS()) {
      return this.err(this.bytes.unwrapError());
    }
    if (this.bytes.bytes().length === 0) {
      return this.ok(null);
    } else {
      return this.err(new TrailingCharactersError());
    }
  }

  handleAnyStructure<V>(visitor: IDeserializerVisitor<V>): boolean {
    const bytes = this.bytes;

    if (!bytes.consume("(")) {
      return this.call(visitor, (v) => v.visitUnit());
    }

    if (!bytes.checkTupleStruct()) {
      return this.err(bytes.unwrapError());
    }
    if (bytes.unwrapResult()) {
      return this.deserializeTuple(0, visitor);
    }

    return this.deserializeStruct("", [], visitor);
  }

  deserializeTuple<V>(len: number, visitor: IDeserializerVisitor<V>): boolean {
    if (!this.newTypeVariant && !this.bytes.consume("(")) {
      return this.err(new ExpectedStructLikeError());
    }

    const oldNewTypeVariant = this.newTypeVariant;
    this.newTypeVariant = false;

    let success = visitor.visitSeq();
  }

  /*

fn deserialize_tuple<V>(mut self, _len: usize, visitor: V) -> Result<V::Value>
    where
        V: Visitor<'de>,
    {
        if self.newtype_variant || self.bytes.consume("(") {
            let old_newtype_variant = self.newtype_variant;
            self.newtype_variant = false;

            let value = visitor.visit_seq(CommaSeparated::new(b')', self))?;
            self.bytes.comma()?;

            if old_newtype_variant || self.bytes.consume(")") {
                Ok(value)
            } else {
                Err(Error::ExpectedStructLikeEnd)
            }
        } else {
            Err(Error::ExpectedStructLike)
        }
    }
*/

  deserializeStruct<V>(
    name: string,
    fields: string[],
    visitor: IDeserializerVisitor<V>
  ): boolean {
    throw new Error("not implemented yet");
  }
}
