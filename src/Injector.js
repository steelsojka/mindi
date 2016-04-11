/**
 * A minimal DI container with support for decorators. Reads injection annotations in the format of `$inject` where
 * the value is an array of dependencies or as a function that returns an array of dependencies.
 */
export default class Injector {
  constructor() {
    this.container = new Map();
    this.cache = new Map();
    this.decorators = new Map();
    this.resolving = [];

    this.register = this.register.bind(this);
    this.register.singleton = this.register.bind(this, 'singleton');
    this.register.transient = this.register.bind(this, 'transient');
    this.register.factory = this.register.bind(this, 'factory');
    this.register.value = this.register.bind(this, 'value');
  }

  /**
   * Gets a registered component. This will also detect circular dependencies.
   * @param {any} key - The key to access.
   * @param {Object|Map<any, any>} [locals={}] - Local injections.
   * @returns {any} The component
   */
  get(key, locals = {}) {
    let result;

    if (this.resolving.indexOf(key) !== -1) {
      throw new Error(`Circular reference detected [${this.resolving.join(' => ')}]`);
    }

    this.resolving.push(key);

    if (this.hasLocal(key, locals)) {
      result = this.resolveLocal(key, locals);
    } else if (this.container.has(key)) {
      result = this.container.get(key).call(this, locals);
    }

    this.resolving.splice(this.resolving.indexOf(key), 1)

    return result;
  }

  /**
   * Resolves a value from a local map. Supports
   * object literals and Maps.
   * @param {any} key - The key.
   * @param {Object|Map<any, any>} [locals={}] - Local map.
   * @returns {any} The result.
   */
  resolveLocal(key, locals = {}) {
    if (locals instanceof Map) {
      return locals.get(key);
    }

    return locals[key];
  }

  /**
   * Whether a value exists in a local map. Supports
   * object literals and Maps.
   * @param {any} key - The key.
   * @param {Object|Map<any, any>} [locals={}] - Local map.
   * @returns {boolean} The result.
   */
  hasLocal(key, locals = {}) {
    if (locals instanceof Map) {
      return locals.has(key);
    }

    return locals.hasOwnProperty(key);
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

    this.container.set(key, function(locals) {
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }

      const decorators = this.decorators.get(key) || [];
      const result = decorators.reduce((result, decorator) => {
        return this.invoke(decorator, Object.assign({}, { $delegate: result, $injector: this }, locals));
      }, fn(this, locals));

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
    this.set(key, (injector, locals) => injector.invoke(factory || key, locals), true);
  }
  
  /**
   * Shorthand for registering a singleton class.
   * @param {any} key - The key.
   * @param {Function} Ctor - The class constructor.
   */
  singleton(key, Ctor) {
    this.set(key, (injector, locals) => injector.instantiate(Ctor || key, locals), true);
  }

  /**
   * Shorthand for registering a transient class.
   * @param {any} key - The key.
   * @param {Function} Ctor - The class constructor.
   */
  transient(key, Ctor) {
    this.set(key, (injector, locals) => injector.instantiate(Ctor || key, locals), false);
  }

  /**
   * Shorthand for registering a value.
   * @param {any} key - The key.
   * @param {any} value - The value.
   */
  value(key, value) {
    this.set(key, () => value, false);
  }

  /**
   * Invokes a function with it's requested dependencies.
   * @param {Function} fn - The fn.
   * @param {Object|Map<any, any>} [locals={}] - Local map.
   * @returns {any} The result.
   */
  invoke(fn, locals = {}, context = null) {
    return fn.apply(context, this.resolve(fn, locals));
  }

  /**
   * Instantiates a class with the requested dependencies.
   * @param {Function} Ctor - The Ctor.
   * @param {Object|Map<any, any>} [locals={}] - Local map.
   * @returns {Object} The result.
   */
  instantiate(Ctor, locals = {}) {
    return new Ctor(...this.resolve(Ctor, locals));
  }

  /**
   * Resolves a functions dependencies.
   * @param {Function} fn - The function.
   * @param {Object|Map<any, any>} [locals={}] - Local map.
   * @returns {any[]} The result.
   */
  resolve(fn, locals = {}) {
    return this.getAnnotations(fn).map(name => this.get(name, locals));
  }

  /**
   * Registers a decorator for a component. Injected service is available as '$delegate'.
   * The injector is available as '$injector'.
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

  /**
   * Spawns (clones) a child injector with that same state.
   * @returns {Injector} The spawned injector.
   */
  spawn() {
    const injector = new this.constructor();

    injector.container = new Map(this.container);
    injector.decorators = new Map(this.decorators);
    injector.cache = new Map(this.cache);

    return injector;
  }

  /**
   * Performs any cleanup work on the injector.
   */
  destroy() {
    this.container = null;
    this.decorators = null;
    this.cache = null;
    this.resolving = [];
  }
  
  /**
   * Annotates a function.
   * @param {Function} target - The target.
   * @param {...any} dependencies - The dependencies.
   */  
  annotate(target, ...dependencies) {
    Injector.annotate(target, ...dependencies);
  }

  /**
   * Annotates a function.
   * @param {Function} target - The target.
   * @param {...any} dependencies - The dependencies.
   */
  static annotate(target, ...dependencies) {
    target.$inject = dependencies;
  }
}
