# Release post draft

In January I posted ORION: a TypeScript compiler that takes ASTRA straight to WebAssembly bytes, with a Mandelbrot set as the demo.

I went back through it. Fixed the edge cases. Then made the compilation itself visible.

The new playground lets you follow a program through its tokens, lowered AST, generated instructions, and final bytes. Click an instruction and see exactly where it lives in the module.

Three guided examples, recursive functions, fractals, a working Stop button, and a much calmer interface.

Next: porting the compiler to Rust, with the same behavior fixtures to keep it honest.

Code: https://github.com/vennictus/orion

*Before publishing: attach the playground and Lab screenshots; add the public demo URL after deployment. The article draft is in BLOG.md. No post has been published.*
