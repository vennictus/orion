// src/types/runtime.ts

export interface Runtime {
  (
    src: string,
    environment: Environment
  ): Promise<TickFunction>;
}

export interface TickFunction {
  (): void;
}

export interface Environment {
  print: PrintFunction;
}

export interface PrintFunction {
  (value: number): void;
}
