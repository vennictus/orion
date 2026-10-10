import { Opcode } from "./constants";

export interface BinarySection {
  name: string;
  offset: number;
  end: number;
  payloadOffset: number;
}
export interface Instruction {
  offset: number;
  end: number;
  mnemonic: string;
  operand: string;
  depth: number;
}
export interface InspectedFunction {
  name: string;
  index: number;
  offset: number;
  end: number;
  locals: string[];
  instructions: Instruction[];
}
export interface BinaryInspection {
  sections: BinarySection[];
  functions: InspectedFunction[];
}

const sectionNames: Record<number, string> = {
  1: "Types", 2: "Imports", 3: "Functions", 5: "Memory", 7: "Exports", 10: "Code",
};
const names: Partial<Record<Opcode, string>> = {
  [Opcode.get_local]: "local.get", [Opcode.set_local]: "local.set",
  [Opcode.return_]: "return", [Opcode.br_if]: "br_if",
};

/** Decode the actual emitted bytes, including instruction immediates and offsets.
 * Deliberately restricted to ORION's instruction set; unsupported bytes fail closed.
 */
export function inspectBinary(bytes: Uint8Array, userFunctions: string[] = []): BinaryInspection {
  let pos = 8;
  const readU32 = () => {
    let result = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      if (pos >= bytes.length) throw new Error("Truncated WASM integer");
      const byte = bytes[pos++];
      result += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) return result;
    }
    throw new Error("Invalid WASM integer");
  };
  const readI32 = () => {
    let result = 0, shift = 0, byte = 0;
    do {
      if (pos >= bytes.length || shift >= 35) throw new Error("Invalid WASM signed integer");
      byte = bytes[pos++];
      result |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
    if (shift < 32 && byte & 64) result |= -1 << shift;
    return result;
  };
  const sections: BinarySection[] = [{ name: "Header", offset: 0, end: 8, payloadOffset: 0 }];
  const functions: InspectedFunction[] = [];
  const functionNames = ["env.print_f32", "env.print_i32", "run", ...userFunctions];
  while (pos < bytes.length) {
    const offset = pos;
    const id = bytes[pos++];
    const size = readU32();
    const payloadOffset = pos;
    const end = pos + size;
    if (end > bytes.length) throw new Error("Truncated WASM section");
    sections.push({ name: sectionNames[id] ?? `Section ${id}`, offset, end, payloadOffset });
    if (id === 10) {
      const count = readU32();
      for (let f = 0; f < count; f++) {
        const bodySize = readU32();
        const bodyOffset = pos;
        const bodyEnd = pos + bodySize;
        if (bodyEnd > end) throw new Error("Truncated WASM function");
        const groups = readU32();
        const locals: string[] = [];
        for (let i = 0; i < groups; i++) {
          const n = readU32();
          const type = bytes[pos++] === 0x7d ? "f32" : "i32";
          locals.push(`${n} × ${type}`);
        }
        const instructions: Instruction[] = [];
        let depth = 0;
        while (pos < bodyEnd) {
          const offset = pos;
          const opcode = bytes[pos++] as Opcode;
          if (typeof Opcode[opcode] !== "string") throw new Error(`Unsupported opcode 0x${opcode.toString(16)}`);
          const mnemonic = names[opcode] ?? Opcode[opcode].replace("_", ".");
          let operand = "";
          if (opcode === Opcode.block || opcode === Opcode.loop) {
            if (bytes[pos++] !== 0x40) throw new Error("Unsupported block type");
          } else if ([Opcode.get_local, Opcode.set_local, Opcode.br, Opcode.br_if, Opcode.call].includes(opcode)) {
            const value = readU32();
            operand = opcode === Opcode.call ? `${value} · ${functionNames[value] ?? "unknown"}` : String(value);
          } else if (opcode === Opcode.i32_const) {
            operand = String(readI32());
          } else if (opcode === Opcode.f32_const) {
            if (pos + 4 > bodyEnd) throw new Error("Truncated f32 constant");
            operand = String(new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getFloat32(0, true));
            pos += 4;
          } else if (opcode === Opcode.i32_store8) {
            const align = readU32();
            operand = `align=${2 ** align} offset=${readU32()}`;
          }
          if (opcode === Opcode.end) depth = Math.max(0, depth - 1);
          instructions.push({ offset, end: pos, mnemonic, operand, depth });
          if (opcode === Opcode.block || opcode === Opcode.loop) depth++;
        }
        if (pos !== bodyEnd) throw new Error("Instruction exceeds WASM function body");
        functions.push({ name: functionNames[f + 2] ?? `function ${f + 2}`, index: f + 2, offset: bodyOffset, end: bodyEnd, locals, instructions });
      }
    }
    pos = end;
  }
  return { sections, functions };
}
