export class RonBytesToJsTransformStream extends TransformStream {
  constructor() {
    let transformer: Transformer<any, any> = {
      start() {}, // required.
      async transform(chunk, controller) {
        console.log(chunk)
      },
      flush() {
        /* do any destructor work here */
      }
    }
    super(transformer)
  }
}
