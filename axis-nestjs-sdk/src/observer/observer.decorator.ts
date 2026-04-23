import { Injectable } from "@nestjs/common";
import {
  Observer as CoreObserver,
  OBSERVER_BINDINGS_KEY,
  OBSERVER_METADATA_KEY,
  type AxisObserverBindingInput,
} from "@nextera.one/axis-server-sdk";
import type {
  AxisObserverBinding,
  AxisObserverBindingOptions,
  AxisObserverDefinition,
  AxisObserverRef,
} from "@nextera.one/axis-server-sdk";

export { OBSERVER_BINDINGS_KEY, OBSERVER_METADATA_KEY };
export type {
  AxisObserverBinding,
  AxisObserverBindingInput,
  AxisObserverBindingOptions,
  AxisObserverDefinition,
  AxisObserverRef,
};

function isObserverDefinition(value: unknown): value is AxisObserverDefinition {
  return !!value && typeof value === "object" && !Array.isArray(value) && !("use" in value);
}

export function Observer(
  input?: AxisObserverBindingInput,
): ClassDecorator & MethodDecorator {
  const applyCore = CoreObserver(input);
  const applyInjectable = Injectable();

  return ((target: object | Function, propertyKey?: string | symbol) => {
    if (propertyKey === undefined) {
      applyCore(target as never);
    } else {
      const descriptor =
        Object.getOwnPropertyDescriptor(target, propertyKey) ?? undefined;
      applyCore(target as never, propertyKey, descriptor as never);
    }

    if (propertyKey === undefined && (input === undefined || isObserverDefinition(input))) {
      applyInjectable(target as never);
    }
  }) as ClassDecorator & MethodDecorator;
}
