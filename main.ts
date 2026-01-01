import { runtime } from "./src/runtime";

const source = `
let y = 0
while (y < 100)
  let x = 0
  while (x < 100)

    let cx = (((x / 100) * 3.5) - 2.5)
    let cy = (((y / 100) * 2.0) - 1.0)

    let zx = 0
    let zy = 0
    let i = 0

    while (i < 255)
      let zx2 = (zx * zx)
      let zy2 = (zy * zy)

      if ((zx2 + zy2) > 4)
        break
      end

      let newZx = ((zx2 - zy2) + cx)
      let newZy = (((2 * zx) * zy) + cy)

      zx = newZx
      zy = newZy
      i = (i + 1)
    end

    setpixel x y i
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

  // Render memory → canvas
  if (!tick.renderToCanvas) {
    throw new Error("renderToCanvas not attached to runtime");
  }

  tick.renderToCanvas(canvasEl);
}

main();
