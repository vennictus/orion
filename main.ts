import { runtime } from "./src/runtime";

const source = `
let y = 0
while (y < 100)
  let x = 0
  while (x < 100)
    setpixel x y (x + y)
    x = (x + 1)
  end
  y = (y + 1)
end
`;

async function main() {
  const canvasEl = document.getElementById("canvas");

  if (!(canvasEl instanceof HTMLCanvasElement)) {
    throw new Error("Canvas element not found or not a canvas");
  }

  const tick = await runtime(source, {
    print: (v: number) => console.log(v),
  });

  // Run Astra → fills WASM memory
  tick();

  // At this point, we KNOW renderToCanvas exists
  if (!tick.renderToCanvas) {
    throw new Error("renderToCanvas not attached to runtime");
  }

  tick.renderToCanvas(canvasEl);
}

main();
