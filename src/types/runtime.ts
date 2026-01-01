// src/types/runtime.ts

export interface Runtime {
  (
    src: string,
    environment: Environment
  ): Promise<TickFunction>;
}

/* 
  TickFunction is still callable,
  but now ALSO carries a renderer.
*/
export interface TickFunction {
  (): void;

  
  renderToCanvas?: (canvas: HTMLCanvasElement) => void;
}

export interface Environment {
  print: PrintFunction;
}

export interface PrintFunction {
  (value: number): void;
}
