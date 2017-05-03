export function getInheritedMetadata<T>(key: string, prototype: object): T[] {
  const result: T[] = [];
  let next = prototype;

  while (next && next !== Object.prototype) {
    const meta = Reflect.getOwnMetadata(key, next);

    if (meta) {
      result.push(meta);
    }

    next = Object.getPrototypeOf(next);
  }

  return result;
}