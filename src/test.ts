import { runtime } from "./runtime";

(async () => {
  const output: number[] = [];

  const tick = await runtime("print 8 print 24", {
    print: (v: number) => {
      output.push(v);
    },
  });

  tick();

  console.log("OUTPUT:", output);
})();
