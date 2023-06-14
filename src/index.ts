import { TransformStream } from "stream/web";

const TASK_READ_VALUE = 0;
const TASK_READ_FIELDS = 1;
const TASK_READ_FIELD = 2;
const TASK_READ_STRING = 3;
const TASK_CREATE_FIELD = 4;
const TASK_PUSH_FIELD_TO_STRUCTURE = 5;

const OPEN_PAREN_BYTE = 40;
const NEW_LINE_BYTE = 10;
const SPACE_BYTE = 32;
const COLON_BYTE = ":".charCodeAt(0);
const DOUBLE_QUOTE_BYTE = '"'.charCodeAt(0);
const COMMA_BYTE = ",".charCodeAt(0);

type TOutput = never;

class ByteVector {
  private underlying: Uint8Array;
  private len: number;
  private cap: number;
  constructor(
    underlying: Uint8Array,
    len: number = 0,
    capacity: number = underlying.length
  ) {
    this.underlying = underlying;
    this.len = len;
    this.cap = capacity;
  }
  push(byte: number) {
    if (this.len < this.cap) {
      this.underlying[this.len] = byte;
      this.len++;
      return;
    }
    let newCapacity = Math.max(1, ((this.cap * 3) / 2) | 0);
    let newUnderlying = new Uint8Array(newCapacity);
    newUnderlying.set(this.underlying);
    this.underlying = newUnderlying;
    this.cap = newCapacity;
    this.underlying[this.len] = byte;
    this.len++;
  }
  pop() {
    if (this.len <= 0) throw new Error("Cannot pop empty vector");
    this.len--;
    return this.underlying[this.len];
  }
  peek() {
    if (this.len <= 0) throw new Error("Cannot pop empty vector");
    return this.underlying[this.len - 1];
  }
  get length() {
    return this.len;
  }

  get capacity() {
    return this.cap;
  }

  at(index: number) {
    if (index < 0 || index >= this.len) {
      throw new Error("Index out of bounds");
    }
    return this.underlying[index];
  }
}

function printTasks(tasks: ByteVector) {
  let texts: string[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks.at(i);
    if (task === TASK_READ_VALUE) {
      texts.push("TASK_READ_VALUE");
      continue;
    }
    if (task === TASK_READ_FIELDS) {
      texts.push("TASK_READ_FIELDS");
      continue;
    }
    if (task === TASK_READ_FIELD) {
      texts.push("TASK_READ_FIELD");
      continue;
    }
    if (task === TASK_READ_STRING) {
      texts.push("TASK_READ_STRING");
      continue;
    }
    if (task === TASK_CREATE_FIELD) {
      texts.push("TASK_CREATE_FIELD");
      continue;
    }
  }
  console.log(texts);
}

interface TField {
  type: "field";
  key: string;
  value: TStackValue;
}
interface TStructure {
  type: "structure";
  fields: TField[];
}

type TStackValue = string | TField | TStructure;

export class RonTransform extends TransformStream {
  private tasks: ByteVector;
  private stack: TStackValue[] = [];
  constructor() {
    let transformer: Transformer<ArrayBuffer, TOutput> = {
      start: () => {},
      transform: (chunk, controller) => {
        let bytes = new Uint8Array(chunk);
        for (let i = 0; i < bytes.length; i++) {
          this.consume(bytes[i], controller);
        }
      },
      flush() {},
    };
    super(transformer);
  }

  private consume(
    byte: number,
    controller: TransformStreamDefaultController<TOutput>
  ) {
    if (!this.tasks) {
      this.tasks = new ByteVector(new Uint8Array(16));
    }
    if (this.tasks.length === 0) {
      this.tasks.push(TASK_READ_VALUE);
    }

    let task = this.tasks.peek();

    if (task === TASK_READ_VALUE) {
      if (byte === SPACE_BYTE) return;
      if (byte === OPEN_PAREN_BYTE) {
        this.stack.push({ type: "structure", fields: [] });
        this.tasks.push(TASK_READ_FIELDS);
        return;
      }
      if (byte === DOUBLE_QUOTE_BYTE) {
        this.stack.push("");
        this.tasks.pop();
        this.tasks.push(TASK_READ_STRING);
        return;
      }
      // console.log(this.stack);
      // printTasks(this.tasks);
      throw new Error(
        `Expected value but, '${String.fromCharCode(byte)}' (${byte}) occurred`
      );
    }

    if (task === TASK_READ_FIELDS) {
      if (byte === NEW_LINE_BYTE) return;
      if (byte === SPACE_BYTE) return;
      if (byte === COMMA_BYTE) return;
      const character = String.fromCharCode(byte);
      this.tasks.push(TASK_READ_FIELD);
      this.stack.push(character);
      return;
    }
    if (task === TASK_READ_FIELD) {
      if (byte === COLON_BYTE) {
        this.tasks.pop();
        this.tasks.push(TASK_READ_FIELD);
        this.tasks.push(TASK_PUSH_FIELD_TO_STRUCTURE);
        this.tasks.push(TASK_CREATE_FIELD);
        this.tasks.push(TASK_READ_VALUE);

        return;
      }
      if (byte === COMMA_BYTE) {
        return;
      }
      if (byte === NEW_LINE_BYTE) {
        throw new Error(`Expected: but newline occurred`);
      }
      const character = String.fromCharCode(byte);
      this.stack[this.stack.length - 1] += character;
      return;
    }

    if (task === TASK_READ_STRING) {
      if (byte === DOUBLE_QUOTE_BYTE) {
        this.tasks.pop();
        return;
      }
      const character = String.fromCharCode(byte);
      this.stack[this.stack.length - 1] += character;
      return;
    }

    if (task === TASK_CREATE_FIELD) {
      const value = this.stack.pop();
      if (value == null) {
        throw new Error("Expected field key to be a string");
      }
      const fieldKey = this.stack.pop();
      if (typeof fieldKey !== "string") {
        throw new Error("Expected field key to be a string");
      }
      const field: TField = {
        type: "field",
        key: fieldKey,
        value: value,
      };
      this.stack.push(field);
      this.tasks.pop();
      return;
    }

    if (task === TASK_PUSH_FIELD_TO_STRUCTURE) {
      console.log(this.stack);
      const field = this.stack.pop();
      if (
        field == null ||
        typeof field !== "object" ||
        field.type !== "field"
      ) {
        throw new Error("Field expected");
      }
      const structure = this.stack[this.stack.length - 1];
      if (
        structure == null ||
        typeof structure !== "object" ||
        structure.type !== "structure"
      ) {
        console.log(this.stack);
        throw new Error("Structure expected");
      }
      structure.fields.push(field);
      this.tasks.pop();
      return;
    }

    throw new Error("Undefined task: " + task);
  }
}
