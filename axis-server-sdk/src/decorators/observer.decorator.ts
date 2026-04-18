import "reflect-metadata";

import { Injectable } from "@nestjs/common";

import type { AxisObserverEvent } from "../engine/axis-chain.types";

export const OBSERVER_METADATA_KEY = "axis:observer";
export const OBSERVER_BINDINGS_KEY = "axis:observer:bindings";

export type AxisObserverRef = string | Function;

export interface AxisObserverDefinition {
  name?: string;
  tags?: string[];
  events?: AxisObserverEvent[];
  intents?: string[];
  handlers?: string[];
}

export interface AxisObserverBinding {
  refs: AxisObserverRef[];
  tags?: string[];
  events?: AxisObserverEvent[];
}

export interface AxisObserverBindingOptions {
  use: AxisObserverRef | AxisObserverRef[];
  tags?: string[];
  events?: AxisObserverEvent[];
}

function isBindingOptions(
  value: unknown,
): value is AxisObserverBindingOptions {
  return !!value && typeof value === "object" && "use" in value;
}

function isDefinitionOptions(value: unknown): value is AxisObserverDefinition {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isBindingOptions(value)
  );
}

function toBinding(
  input?:
    | AxisObserverDefinition
    | AxisObserverBindingOptions
    | AxisObserverRef
    | AxisObserverRef[],
): AxisObserverBinding | null {
  if (!input) return null;

  if (isBindingOptions(input)) {
    const refs = Array.isArray(input.use) ? input.use : [input.use];
    return { refs, tags: input.tags, events: input.events };
  }

  if (Array.isArray(input)) {
    return { refs: input };
  }

  if (typeof input === "function" || typeof input === "string") {
    return { refs: [input] };
  }

  return null;
}

export function Observer(
  input?:
    | AxisObserverDefinition
    | AxisObserverBindingOptions
    | AxisObserverRef
    | AxisObserverRef[],
): ClassDecorator & MethodDecorator {
  return ((
    target: object | Function,
    propertyKey?: string | symbol,
  ) => {
    const binding = toBinding(input);
    if (binding) {
      if (propertyKey !== undefined) {
        const existing: AxisObserverBinding[] =
          Reflect.getMetadata(OBSERVER_BINDINGS_KEY, target, propertyKey) || [];
        existing.push(binding);
        Reflect.defineMetadata(
          OBSERVER_BINDINGS_KEY,
          existing,
          target,
          propertyKey,
        );
        return;
      }

      const existing: AxisObserverBinding[] =
        Reflect.getMetadata(OBSERVER_BINDINGS_KEY, target as Function) || [];
      existing.push(binding);
      Reflect.defineMetadata(OBSERVER_BINDINGS_KEY, existing, target as Function);
      return;
    }

    if (propertyKey !== undefined) {
      throw new Error(
        "@Observer method usage must reference one or more observer classes or names",
      );
    }

    const definition = isDefinitionOptions(input) ? input : {};
    Reflect.defineMetadata(OBSERVER_METADATA_KEY, definition, target as Function);
    Injectable()(target as any);
  }) as ClassDecorator & MethodDecorator;
}