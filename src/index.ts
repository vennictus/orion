import { tokenize } from "./tokenizer";
import { parse } from "./parser";

const tokens = tokenize("print ((6-4)+10)");
const ast = parse(tokens);

console.log(JSON.stringify(ast, null, 2));
