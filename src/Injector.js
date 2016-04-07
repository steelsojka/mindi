/**
 * A minimal DI container with support for decorators.
 */
export default class Injector {
  constructor() {
    this.container = new Map();
    this.cache = new Map();
    this.decorators = new Map();

    this.register = this.register.bind(this);
    this.register.singleton = this.register.bind(this, 'singleton');
    this.register.transient = this.register.bind(this, 'transient');
    this.register.value = this.register.bind(this, 'value');
    this.register.factory = this.register.bind(this, 'factory');
  }

  /**
   * Gets a registered component.
   * @param {any} key - The key to access.
   * @param {Object<string, any>} [locals={}] - Local injections.
   * @returns {any} The component
   */
  get(key, locals = {}) {
    if (locals.hasOwnProperty(key)) {
      return locals[key];
    }

    if (this.container.has(key)) {
      return this.container.get(key)(locals);
    }
  }

  /**
   * Whether the injector has a component.
   * @param {any} key - The key.
   * @returns {boolean} The result.
   */
  has(key) {
    return this.container.has(key);
  }

  /**
   * Sets the an entry with the injector.
   * @param {any} key - The key.
   * @param {Function} fn - The factory function.
   * @param {boolean} [cache=false] - Whether to cache the entry.
   */
  set(key, fn, cache = false) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.container.set(key, locals => {
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      const decorators = this.decorators.get(key) || [];
      const result = decorators.reduce((result, decorator) => {
        return this.invoke(decorator, Object.assign({}, { $delegate: result }, locals));
      }, fn(locals));

      if (cache) {
        this.cache.set(key, result);
      }

      return result;
    });
  }

  /**
   * Shorthand for registering a factory.
   * @param {any} key - The key.
   * @param {Function} factory - The factory.
   */
  factory(key, factory) {
    this.set(key, locals => this.invoke(factory, locals), true);
  }
  
  /**
   * Shorthand for registering a singleton class.
   * @param {any} key - The key.
   * @param {Function} Ctor - The class constructor.
   */
  singleton(key, Ctor) {
    this.set(key, locals => this.instantiate(Ctor, locals), true);
  }

  /**
   * Shorthand for registering a transient class.
   * @param {any} key - The key.
   * @param {Function} Ctor - The class constructor.
   */
  transient(key, Ctor) {
    this.set(key, locals => this.instantiate(Ctor, locals), false);
  }

  /**
   * Shorthand for registering a value.
   * @param {any} key - The key.
   * @param {any} value - The value.
   */
  value(key, value) {
    this.set(key, () => value, true);
  }

  /**
   * Invokes a function with it's requested dependencies.
   * @param {Function} fn - The fn.
   * @param {Object<string, any>} [locals={}] - Local injections.
   * @returns {any} The result.
   */
  invoke(fn, locals = {}) {
    return fn(...this.resolve(fn, locals));
  }

  /**
   * Instantiates a class with the requested dependencies.
   * @param {Function} Ctor - The Ctor.
   * @param {Object<string, any>} [locals={}] - Local injections.
   * @returns {Object} The result.
   */
  instantiate(Ctor, locals = {}) {
    return new Ctor(...this.resolve(Ctor, locals));
  }

  /**
   * Resolves a functions dependencies.
   * @param {Function} fn - The function.
   * @param {Object<string, any>} [locals={}] - Local injections.
   * @returns {any[]} The result.
   */
  resolve(fn, locals = {}) {
    return this.getAnnotations(fn).map(name => this.get(name, locals));
  }

  /**
   * Registers a decorator for a component.
   * @param {any} key - The key.
   * @param {Function} fn - The decorator function. 
   *   This function is also injectable.
   */
  decorator(key, fn) {
    if (!this.decorators.has(key)) {
      this.decorators.set(key, []);
    }

    this.decorators.get(key).push(fn);
  }

  /**
   * Gets the annotations from an object.
   * @param {Function|Object} value - The value.
   * @returns {any[]} The result.
   */
  getAnnotations(value) {
    if (typeof value !== 'function' && typeof value !== 'object') {
      return [];
    }

    let result = value.$inject;

    if (typeof value.$inject === 'function') {
      result = value.$inject();
    }

    return Array.isArray(result) ? result : [];
  }

  /**
   * Annotates a function.
   * @param {Function} target - The target.
   * @param {...any} dependencies - The dependencies.
   */
  annotate(target, ...dependencies) {
    target.$inject = dependencies;
  }

  /**
   * A decorator from annotating a class.
   * @param {...*} dep - The dep
   * @returns {Function} The decorator.
   */
  inject(...dep) {
    return target => {
      this.annotate(target, ...dep);
    };
  }

  /**
   * A decorator for registering a component with the injector.
   * @param {string} type - The type to register as.
   * @param {any} [key] - The key to store under. Uses the target is not defined.
   * @returns {Function} The decorator function.
   */
  register(type, key) {
    return target => {
      if (!this[type]) {
        throw new Error(`'${type}' is not a valid type.`);
      }

      this[type](key || target, target);
    };
  }
}
