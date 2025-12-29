import { emitter } from "./wasm/module";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { Compiler } from "./types/compiler";

export const compile: Compiler = (src) => {
  const tokens = tokenize(src);
  const ast = parse(tokens);

  // TEMP: ignore AST, just return valid wasm
  return emitter(ast );
};
