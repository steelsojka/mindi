mindi
=====

A minimal dependency injection container, loosely based on Angular's DI.

Install
-------

`npm install --save mindi`

Usage
-----

```typescript
import { Inject, Injector } from 'mindi';

import { SomeDependency } from './SomeDependency';

export class MyClass {
  constructor(@Inject(SomeDependency) public someDependency: SomeDependency) {}
}

const injector = new Injector([ SomeDependency, MyClass ]);
const myClass = injector.get(MyClass);

myClass.someDepenedency instanceof SomeDependency; // => true
```

## Creating an injector

Injectors are heirarchical. So an injector can have a parent.

```typescript
class MyClass {}

const injector = new Injector([ MyClass ]);
const childInjector = new Injector([], injector);

childInjector.get(MyClass) === injector.get(MyClass); // => true
```

## Injecting dependencies into a class

You can inject dependencies two ways.

### Constructor injection

You inject dependencies directly into the constructor.

```typescript
import { Token, Injector, Inject } from 'mindi';

const token = new Token('someService');

class MyClass {
  constructor(@Inject(token) public service: string) {}
}

const injector = new Injector([ { provide: token, useValue: 'blorg' } ]);
const myClass = injector.get(MyClass);

myClass.service; // => 'blorg'
```

### Property injection

You can inject dependencies by having them assigned to properties on the instance.

```typescript
import { Token, Injector, Inject } from 'mindi';

const token = new Token('someService');

class MyClass {
  @Inject(token) service: string;
}

const injector = new Injector([ { provide: token, useValue: 'blorg' } ]);
const myClass = injector.get(MyClass);

myClass.service; // => 'blorg'
```

Note, the injected properties will NOT be available in the constructor, but will be availble in the `PostConstruct` annotated hooks.