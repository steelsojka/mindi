import { 
  Type,
  Provider, 
  ProviderArg,
  INJECT_METADATA, 
  InjectionMetadata,
  InjectableConfig,
  INJECTABLE_META_KEY,
  ClassProvider,
  FactoryProvider,
  ValueProvider,
  ExistingProvider,
  CONSTRUCTED_META_KEY,
  ConstructMetadata,
  ClassInjectionMetadata,
  Token,
  InjectionMetadataArg
} from './common';
import { ForwardRef } from './ForwardRef';
import * as MetadataUtils from './MetadataUtils';

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
  private _resolving: any[] = [];
  
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
  get<T>(token: Type<T>|Token<T>, defaultValue?: any, metadata: InjectionMetadata = {}): T {
    let resource;
    let { optional = false } = metadata;

    token = ForwardRef.resolve(token);

    if (this._providers.has(token) && !metadata.skipSelf) {
      const provider = this._providers.get(token) as Provider;

      if (provider.multi) {
        resource = ((provider as ValueProvider).useValue || []).map((p: Provider) => this._resolve(p));

        if (this._parent && !metadata.self) {
          let parentResource = this._parent.get(token as Token<T[]>, [], { ...metadata, skipSelf: false, self: false });

          if (!Array.isArray(parentResource)) {
            parentResource = [ parentResource ];
          }

          resource = [ ...resource, ...parentResource ];
        }
      } else {
        if (provider.resolved !== undefined) {
          resource = provider.resolved;  
        } else {
          resource = this._resolve(provider as Provider, metadata);
        }
      }
    } else if (!metadata.self && this._parent) {
      resource = this._parent.get(token, defaultValue, { ...metadata, skipSelf: false, self: false });
    } else if (defaultValue !== undefined) {
      resource = defaultValue;
    } else if (optional) {
      resource = null;
    } else {
      throw new Error(`Injector -> no token exists for ${token}`);
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
   * Wires up properties on a class instance with dependencies. This is invoked on class construction as well.
   * Note, dependencies will NOT be available in the constructor. They will be in any `PostConstruct` hooks however.
   * @template T 
   * @param {(T & { constructor?: Type<T>, [key: string]: any })} instance 
   * @param {ClassInjectionMetadata} [metadata]
   * @returns {void} 
   */
  autowire(instance: { [key: string]: any }, propMetadata?: { [key: string]: InjectionMetadata }): void {
    let metaList: ClassInjectionMetadata[] = [];

    if (propMetadata) {
      metaList = [ { properties: propMetadata, params: [] } ];
    } else if (typeof instance.constructor === 'function') {
      metaList = MetadataUtils.getInheritedMetadata<ClassInjectionMetadata>(INJECT_METADATA, instance.constructor.prototype);
    }

    const properties = metaList
      .reverse()
      .reduce<{ [key: string]: InjectionMetadata }>((result, meta) => ({ ...result, ...meta.properties }), {});

    const keys = Object.keys(properties);
    const dependencies = this._getDependencies(keys.map(key => this._resolveMetadata(properties[key])));

    for (const [ index, dependency ] of dependencies.entries()) {
      instance[keys[index]] = dependency;
    }
  }

  /**
   * Resolves the given provider with this injector.
   * @template T The return type.
   * @param {*} provider 
   * @returns {T} 
   */
  resolveAndInstantiate<T>(provider: any, metadata?: InjectionMetadata): T {
    // Skip the cyclical check on this token since we are just instantiating a provider that
    // is not registered.
    return this._resolve(provider, metadata, true);
  }

  /**
   * Invokes a function with the list of providers.
   * @param {Function} fn 
   * @param {InjectionMetadataArg[]} providers 
   * @returns {*} 
   */
  invoke(fn: Function, providers: InjectionMetadataArg[]): any {
    return fn(...this._getDependencies(this._resolveMetadataList(providers)));
  }

  private _resolve(_provider: ProviderArg, metadata: InjectionMetadata = {}, skipCyclicCheck: boolean = false): any {
    const provider = this._normalizeProvider(_provider);
    let result;

    if (provider.resolved !== undefined) {
      return provider.resolved;
    }

    if (!skipCyclicCheck) {
      // Cyclical dependency
      if (this._resolving.indexOf(provider.provide) !== -1) {
        throw new Error(`Cyclical dependency: Last evaludated ${provider.provide}`);
      }

      this._resolving.push(provider.provide);
    }
    
    if (this._isClassProvider(provider)) {
      const injections = this._getConstructorMetadata(provider.useClass);
      const resolved = this._getDependencies(injections);
      const ref = ForwardRef.resolve(provider.useClass);

      result = this._instantiateWithHooks(ref, metadata.skipInit, ...resolved);
      provider.resolved = result;
    } else if (this._isFactoryProvider(provider)) {
      const resolved = this._getDependencies(this._resolveMetadataList(provider.deps));
      const ref = ForwardRef.resolve(provider.useFactory);

      result = ref(...resolved);
      provider.resolved = result;
    } else if (this._isValueProvider(provider)) {
      result = ForwardRef.resolve(provider.useValue);
      provider.resolved = result;
    } else if (this._isExistingProvider(provider)) {
      result = this.get(ForwardRef.resolve(provider.useExisting));
      // Intentionally don't store existing providers as resolved as it is
      // just an alias.
    } else {
      throw new Error(`Injector -> could not resolve provider ${(<Provider>provider).provide}`);
    }

    if (!skipCyclicCheck) {
      this._resolving.splice(this._resolving.indexOf(provider.provide), 1);
    }

    return result;
  }
      
  private _getDependencies(metadata: InjectionMetadata[]): any[] {
    return metadata.map(meta => {
      if (meta.lazy) {
        return () => this.get<any>(meta.token, undefined, meta);
      }

      return this.get(meta.token, undefined, meta);
    });
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

  private _instantiateWithHooks(Ref: Function, skipInit?: boolean, ...d: any[]): any {
    const instance = this._instantiate(Ref, ...d);
    const metadata = MetadataUtils.getInheritedMetadata<ConstructMetadata>(CONSTRUCTED_META_KEY, Ref.prototype);
    const postConstructs = metadata
      .reverse()  
      .reduce<string[]>((result, meta) => {
        for (const postConstruct of meta.postConstruct) {
          if (result.indexOf(postConstruct) === -1) {
            result.push(postConstruct);
          }
        }

        return result;
      }, []);

    this.autowire(instance);

    if (metadata && !skipInit) {
      for (const postConstruct of postConstructs) {
        instance[postConstruct]();
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

  private _getConstructorMetadata(Ctor: Function & { inject?: InjectionMetadataArg[] | (() => InjectionMetadataArg[]) }): InjectionMetadata[] {
    let metadata = Reflect.getMetadata(INJECT_METADATA, Ctor.prototype) as ClassInjectionMetadata;
    let injections: InjectionMetadata[] = [];

    if (metadata && metadata.params) {
      injections = metadata.params;
    } else {
      if (typeof Ctor.inject === 'function') {
        injections = this._resolveMetadataList(Ctor.inject());
      } else if (Array.isArray(Ctor.inject)) {
        injections = this._resolveMetadataList(Ctor.inject);
      }
    }

    return injections;
  }

  /**
   * Resolves a list of injection arguments.
   * @private
   * @param {InjectionMetadataArg[]} [list=[]] 
   * @returns {InjectionMetadata[]} 
   */
  private _resolveMetadataList(list: InjectionMetadataArg[] = []): InjectionMetadata[] {
    if (!Array.isArray(list)) {
      return [];
    }

    return list.map(metadata => this._resolveMetadata(metadata));
  }

  /**
   * Resolves an injection argument.
   * @private
   * @param {InjectionMetadataArg} metadata 
   * @returns {InjectionMetadata} 
   */
  private _resolveMetadata(metadata: InjectionMetadataArg): InjectionMetadata {
    if (metadata instanceof Token || typeof metadata === 'function') {
      return { token: metadata };
    }

    return metadata;
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