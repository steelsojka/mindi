import { 
  Type,
  Provider, 
  ProviderArg,
  INJECT_PARAM_KEY, 
  InjectionMetadata,
  InjectableConfig,
  INJECTABLE_META_KEY,
  ClassProvider,
  FactoryProvider,
  ValueProvider,
  ExistingProvider,
  CONSTRUCTED_META_KEY,
  ConstructMetadata
} from './common';
import { ForwardRef } from './ForwardRef';

/**
 * A dependency injector for resolving dependencies. Injectors are hierarchicle.
 * @export
 * @class Injector
 * @example
 * const injector = new Injector([
 *   { provide: 'test', useValue: 'blorg' },
 *   { provide: 'factory', useFactory: () => 'BOOM' },
 *   { provide: 'myClass', useClass: MyClass },
 *   MyClass
 * ]);
 * 
 * injector.get('test'); // => 'blorg';
 * injector.get('factory'); // => 'BOOM';
 * injector.get('myClass'); // => instanceof MyClass;
 * injector.get(MyClass); // => instanceof MyClass;
 */
export class Injector {
  private _providers: Map<any, Provider> = new Map();
  
  /**
   * Creates an instance of Injector.
   * @param {ProviderArg[]} [providers=[]] List of providers for this injector.
   * @param {(Injector|null)} [_parent=null] A parent injector.
   */
  constructor(
    providers: ProviderArg[] = [],
    private _parent: Injector|null = null
  ) {
    this.registerProvider({ provide: Injector, useValue: this });

    providers.forEach(p => this.registerProvider(p));
  }

  /**
   * The parent injector if it is set.
   * @readonly
   * @type {(Injector|null)}
   */
  get parent(): Injector|null {
    return this._parent;
  }

  /**
   * Registers a provider with the injector.
   * @param {ProviderArg} provider 
   */
  registerProvider(provider: ProviderArg): void {
    const _provider = this._normalizeProvider(provider);

    if (_provider.multi) {
      const entry = (this._providers.get(_provider.provide) || { provide: _provider.provide, multi: true, useValue: [] }) as ValueProvider;

      (entry.useValue as Provider[]).push(_provider);

      this._providers.set(_provider.provide, entry);
    } else {
      this._providers.set(_provider.provide, _provider);
    }
  }

  /**
   * Gets a dependecy from the provided token.
   * @param {*} token 
   * @param {*} [defaultValue] 
   * @param {InjectionMetadata} [metadata={}] 
   * @returns {*} 
   */
  get(token: any, defaultValue?: any, metadata: InjectionMetadata = {}): any {
    let resource;
    let { optional = false, lazy = false } = metadata;

    if (lazy) {
      return () => this.get(token, defaultValue, { ...metadata, lazy: false });
    }
    
    if (this._providers.has(token) && !metadata.skipSelf) {
      const provider = this._providers.get(token) as Provider;

      if (provider.multi) {
        resource = ((provider as ValueProvider).useValue || []).map((p: Provider) => this._resolve(p));

        if (this._parent && !metadata.self) {
          let parentResource = this._parent.get(token, [], { ...metadata, skipSelf: false, self: false });

          if (!Array.isArray(parentResource)) {
            parentResource = [ parentResource ];
          }

          resource = [ ...resource, ...parentResource ];
        }
      } else {
        if (provider.resolved === undefined) {
          this._resolve(provider as Provider, metadata);
        }

        resource = provider.resolved;  
      }
    }

    if (resource === undefined && !metadata.self && this._parent) {
      resource = this._parent.get(token, defaultValue, { ...metadata, skipSelf: false, self: false });
    }

    if (resource === undefined) {
      if (defaultValue !== undefined) {
        resource = defaultValue;
      } else if (optional) {
        resource = null;
      } else {
        throw new Error(`Injector -> no token exists for ${token}`);
      }
    }

    return resource;
  }
  
  /**
   * Creates a new injector with the given providers and sets
   * this injector as it's parent.
   * @param {ProviderArg[]} [providers=[]] 
   * @returns {Injector} 
   */
  resolveAndCreateChild(providers: ProviderArg[] = []): Injector {
    return new Injector(providers, this);    
  }

  /**
   * Programmatically set the parent injector.
   * @param {Injector} parent 
   */
  setParent(parent: Injector): void {
    this._parent = parent;
  }

  /**
   * Resolves the given provider with this injector.
   * @template T The return type.
   * @param {*} provider 
   * @returns {T} 
   */
  resolveAndInstantiate<T>(provider: any): T {
    return this._resolve(provider);
  }

  invoke(fn: Function, providers: ProviderArg[]): any {
    return fn(...providers.map(p => this._resolve(p)));
  }

  private _resolve(_provider: ProviderArg, metadata: InjectionMetadata = {}): any {
    const provider = this._normalizeProvider(_provider);
    let result;
    
    if (this._isClassProvider(provider)) {
      const injections = Reflect.getMetadata(INJECT_PARAM_KEY, provider.useClass, (<any>undefined)) || [];
      const resolved = this._getDependencies(injections);
      const ref = ForwardRef.resolve(provider.useClass);

      result = this._instantiateWithHooks(ref, ...resolved);
    } else if (this._isFactoryProvider(provider)) {
      const resolved = this._getDependencies((provider.deps || []).map(token => ({ token })));
      const ref = ForwardRef.resolve(provider.useFactory);

      result = ref(...resolved);
    } else if (this._isValueProvider(provider)) {
      result = ForwardRef.resolve(provider.useValue);
    } else if (this._isExistingProvider(provider)) {
      result = this.get(ForwardRef.resolve(provider.useExisting));
    } else {
      throw new Error(`Injector -> could not resolve provider ${(<Provider>provider).provide}`);
    }

    provider.resolved = result;

    return result;
  }
      
  private _getDependencies(metadata: any[]): any[] {
    return metadata.map(meta => this.get(meta.token, undefined, meta));
  }

  private _instantiate(Ref: any, ...d: any[]): any {
    switch (d.length) {
      case 0: return new Ref();
      case 1: return new Ref(d[0]);
      case 2: return new Ref(d[0], d[1]);
      case 3: return new Ref(d[0], d[1], d[2]);
      case 4: return new Ref(d[0], d[1], d[2], d[3]);
      case 5: return new Ref(d[0], d[1], d[2], d[3], d[4]);
      case 6: return new Ref(d[0], d[1], d[2], d[3], d[4], d[5]);
      case 7: return new Ref(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
      case 8: return new Ref(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7]);
      case 9: return new Ref(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8]);
      case 10: return new Ref(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9]);
      case 11: return new Ref(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10]);
      case 12: return new Ref(d[0], d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[10], d[11]);
      default: 
        return new Ref(...d);
    }
  }

  private _instantiateWithHooks(Ref: Function, ...d: any[]): any {
    const instance = this._instantiate(Ref, ...d);

    const metadata = Reflect.getOwnMetadata(CONSTRUCTED_META_KEY, Ref.prototype) as ConstructMetadata|undefined;

    if (metadata) {
      for (const postConstruct of metadata.postConstruct) {
        instance[postConstruct].call(instance);
      }
    }

    return instance;
  }

  private _isClassProvider(provider: Provider): provider is ClassProvider {
    return provider.hasOwnProperty('useClass');
  }

  private _isFactoryProvider(provider: Provider): provider is FactoryProvider {
    return provider.hasOwnProperty('useFactory');
  }

  private _isValueProvider(provider: Provider): provider is ValueProvider {
    return provider.hasOwnProperty('useValue');
  }

  private _isExistingProvider(provider: Provider): provider is ExistingProvider {
    return provider.hasOwnProperty('useExisting');
  }

  private _normalizeProvider(_provider: ProviderArg): Provider {
    if (typeof _provider === 'function') {
      return { provide: _provider, useClass: _provider };
    } 

    return _provider;
  }

  /**
   * Creates a new injector from an annotated injectable Class. 
   * See {@link Injectable} for more details.
   * @static
   * @param {Type<any>} injectable 
   * @param {ProviderArg[]} [providers=[]] 
   * @param {Injector} [parent] 
   * @returns {Injector} 
   */
  static fromInjectable(injectable: Type<any>, providers: ProviderArg[] = [], parent?: Injector): Injector {
    return new Injector([ ...Injector.resolveInjectables(injectable), ...providers ], parent);
  }

  static resolveInjectables(injectable: Type<any>): ProviderArg[] {
    const metadata = Reflect.getOwnMetadata(INJECTABLE_META_KEY, injectable);

    if (metadata) {
      return (<InjectableConfig>metadata).providers;
    }
    
    return [];
  }
}