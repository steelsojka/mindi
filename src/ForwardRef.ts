/**
 * An instance of a forward ref function.
 * @export
 * @class ForwardRef
 * @example
 * const test = new ForwardRef(() => 'test');
 * 
 * test.ref; // => 'test'
 */
export class ForwardRef {
  constructor(private fn: Function) {}

  /**
   * The reference invoked reference function result.
   * @readonly
   * @type {*}
   */
  get ref(): any {
    return this.fn();
  }

  /**
   * Resolves a potential forward reference.
   * @static
   * @param {*} val 
   * @returns {*} 
   */
  static resolve(val: any): any {
    if (val instanceof ForwardRef) {
      return val.ref;
    }

    return val;
  }
}

/**
 * A factory that creates a ForwardRef.
 * @export
 * @param {Function} fn 
 * @returns {ForwardRef}
 * @example
 * const test = forwardRef(() => 'test');
 * 
 * test.ref; // => 'test'
 */
export function forwardRef(fn: Function): ForwardRef {
  return new ForwardRef(fn);
}
