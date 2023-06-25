# rusty-object-notation

This is a library for Rusty Object Notation (RON) in Javascript.

# Rusty Object Notation

Numbers: `42`, `3.14`, `0xFF`, `0b0110`  
Strings: `"Hello"`, `"with\\escapes\n"`, `r#"raw string, great for regex\."#`  
Booleans: `true`, `false`  
Chars: `'e'`, `'\n'`  
Optionals: `Some("string")`, `Some(Some(1.34))`, `None`  
Tuples: `("abc", 1.23, true)`, `()`  
Lists: `["abc", "def"]`  
Structs: `( foo: 1.0, bar: ( baz: "I'm nested" ) )`  
Maps: `{ "arbitrary": "keys", "are": "allowed" }`  

# Usage

```typescript
import { parse } from 'rusty-object-notation'

const ron = '( foo: 1.0, bar: ( baz: "I\'m nested" ) )'
const obj = parse(ron)
console.log(obj) // { foo: 1.0, bar: { baz: "I'm nested" } }
```