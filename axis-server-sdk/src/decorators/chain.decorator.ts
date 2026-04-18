import "reflect-metadata";

import type { ChainOptions, RegisteredChainConfig } from "../engine/axis-chain.types";

export const CHAIN_METADATA_KEY = "axis:chain";

export function Chain(options: ChainOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const value: RegisteredChainConfig = {
      enabled: true,
      ...options,
    };

    Reflect.defineMetadata(CHAIN_METADATA_KEY, value, target, propertyKey);
  };
}