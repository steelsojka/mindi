import { Injector } from './Injector';

export interface Type<T> {
  new (...args: any[]): T;
}

export interface BaseProvider {
  multi?: boolean;
  resolved?: any;
}

export interface ClassProvider extends BaseProvider {
  provide: any;
  useClass: any;
}

export interface FactoryProvider extends BaseProvider {
  provide: any;
  useFactory: any;
  deps?: any[];
}

export interface ExistingProvider extends BaseProvider {
  provide: any;
  useExisting: any;
}

export interface ValueProvider extends BaseProvider {
  provide: any;
  useValue: any;
}

export type ProviderArg = ClassProvider|FactoryProvider|ExistingProvider|ValueProvider|Type<any>;
export type Provider = ClassProvider|FactoryProvider|ExistingProvider|ValueProvider;

export interface InjectionMetadata {
  skipSelf?: boolean;
  self?: boolean;
  lazy?: boolean;
  optional?: boolean;
  token?: any;
  multi?: boolean;
}

export interface ConstructMetadata {
  postConstruct: string[];
}

export const INJECT_PARAM_KEY = 'mindi:injections';
export const INJECTABLE_META_KEY = 'mindi:injectable';
export const CONSTRUCTED_META_KEY = 'mindi:constructed';

export interface InjectableConfig {
  providers: ProviderArg[];
}

export type InjectableConfigArgs = {
  [P in keyof InjectableConfig]?: InjectableConfig[P];
}

/**
 * A token used for dependency injection.
 * @export
 * @class Token
 */
export class Token {
  /**
   * Creates an instance of Token.
   * @param {string} name String representation of the string.
   */
  constructor(private name: string) {}

  toString(): string {
    return `Token(${this.name})`;
  }
}