import { emitter, EmitterOptions } from "./wasm/module";
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import { Compiler } from "./types/compiler";

export const compile: Compiler = (src, options: EmitterOptions = {}) => {
  const tokens = tokenize(src);
  const ast = parse(tokens);

  
  return emitter(ast, options);
};
