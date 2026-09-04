interface Dependency {
  read(): unknown;
  value: unknown;
}
let collector: Dependency[] | undefined;

export function trackModelRead<Value>(read: () => Value): Value {
  const value = read();
  collector?.push({ read, value });
  return value;
}

export function trackedValue<Value>(read: () => Value): {
  value: Value;
  dependencies: Dependency[];
} {
  const previous = collector;
  const dependencies: Dependency[] = [];
  collector = dependencies;
  try {
    return { value: read(), dependencies };
  } finally {
    collector = previous;
  }
}

export function dependenciesUnchanged(dependencies: Dependency[]): boolean {
  const previous = collector;
  collector = undefined;
  try {
    return dependencies.every((dependency) =>
      Object.is(dependency.read(), dependency.value),
    );
  } finally {
    collector = previous;
  }
}
