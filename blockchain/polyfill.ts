// Polyfill for Iterator.flatMap for Node 20 compatibility
const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
if (!IteratorPrototype.flatMap) {
  IteratorPrototype.flatMap = function* (fn) {
    for (const item of this) {
      const result = fn(item);
      if (result && typeof result[Symbol.iterator] === 'function') {
        yield* result;
      } else {
        yield result;
      }
    }
  };
}
