mindi
=====

Minimal DI Container

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