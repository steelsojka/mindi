import { Injector } from './Injector';
import { forwardRef } from './ForwardRef';
import { Token } from './common';
import { Inject, PostConstruct, Lazy, SkipInit } from './decorators';
import test from 'ava';

class MyClass {}

test('should get the class dependency', t => {
  const injector = new Injector([ MyClass ]);

  t.true(injector.get(MyClass) instanceof MyClass);
});

test('should get the factory dependency', t => {
  const injector = new Injector([{ provide: MyClass, useFactory: () => new MyClass() }]);

  t.true(injector.get(MyClass) instanceof MyClass);
});

test('should get the value dependency', t => {
  const injector = new Injector([{ provide: MyClass, useValue: new MyClass() }]);

  t.true(injector.get(MyClass) instanceof MyClass);
});

test('should get the existing dependency', t => {
  const token = new Token('test');
  const injector = new Injector([ MyClass, { provide: token, useExisting: MyClass }]);
  const myClass = injector.get(MyClass);

  t.true(injector.get(token) === myClass);
});

test('should get the dependency from parent', t => {
  const parent = new Injector([ MyClass ]);
  const injector = new Injector([], parent);
  const myClass = injector.get(MyClass);

  t.true(injector.get(MyClass) instanceof MyClass);
});

test('should get the dependency lazily', t => {
  const token = new Token('blorg');
  class LazyClass {
    constructor(@Inject(token) @Lazy() public dep: any) {}
  }

  const injector = new Injector([ LazyClass, { provide: token, useValue: 'blorg' } ]);
  const instance = injector.get<LazyClass>(LazyClass);

  t.is(typeof instance.dep, 'function');
  t.is(instance.dep(), 'blorg');
});

test('should return null for optional dependency', t => {
  const injector = new Injector([]);

  t.is(injector.get(MyClass, undefined, { optional: true }), null);
});

test('should only get from self', t => {
  const parent = new Injector([ MyClass ]);
  const injector = new Injector([], parent);
  const myClass = injector.get(MyClass, null, { self: true });

  t.is(myClass, null);
});

test('should get from the parent', t => {
  const parent = new Injector([ MyClass ]);
  const injector = new Injector([], parent);
  const myClass = injector.get(MyClass);

  t.true(myClass instanceof MyClass);
});

test('should return the default value', t => {
  const injector = new Injector([]);

  t.is(injector.get(MyClass, 'test'), 'test');
});

test('should return the same references', t => {
  const injector = new Injector([ MyClass ]);
  const myClass = injector.get(MyClass);
  const otherMyClass = injector.get(MyClass);

  t.true(myClass === otherMyClass);
});

test('should throw if not found', t => {
  const injector = new Injector([]);

  t.throws(() => injector.get(MyClass));
});

test('should throw if not found from the parent', t => {
  const parent = new Injector([]);
  const injector = new Injector([], parent);

  t.throws(() => injector.get(MyClass));
});

test('should resolve a forwardRef', t => {
  const token = new Token('test');
  const injector = new Injector([ MyClass, { provide: token, useValue: forwardRef(() => myClass) } ]);
  const myClass = injector.get(MyClass);

  t.is(injector.get(token), myClass);
});

test('should resolve the provider with the injector', t => {
  t.plan(2);
  
  const injector = new Injector([ MyClass ]);
  class TestClass {
    constructor(
      @Inject(MyClass) myClass: MyClass
    ) {
      t.true(myClass instanceof MyClass);
    }
  }

  const testClass = injector.resolveAndInstantiate(TestClass);

  t.true(testClass instanceof TestClass);
});

test('should invoke the post construct hook', t => {
  t.plan(2);
  class TestClass {
    @PostConstruct()
    init() {
      t.pass();
    }
  }

  const injector = new Injector();

  const testClass = injector.resolveAndInstantiate(TestClass);

  t.true(testClass instanceof TestClass);
});

test('should skip its own injector', t => {
  const token = new Token('test');
  const injector = new Injector();
  const injector2 = injector.resolveAndCreateChild([ { provide: token, useValue: 'test' } ]);

  t.is(injector2.get(token, null, { skipSelf: true }), null);
  t.is(injector2.get(token, null, { skipSelf: false }), 'test');
});

test('should get multiple providers', t => {
  class MyClass {}
  const token = new Token('test');
  const injector = new Injector([{ provide: token, useValue: 'blorg', multi: true }]);
  const childInjector = new Injector([{ provide: token, useClass: MyClass, multi: true }], injector)

  const result = childInjector.get<any[]>(token);

  t.true(result.length === 2);
  t.true(result[0] instanceof MyClass);
  t.is(result[1], 'blorg');
});

test('should get multiple providers when the parent is not multi', t => {
  class MyClass {}
  const token = new Token('test');
  const injector = new Injector([{ provide: token, useValue: 'blorg' }]);
  const childInjector = new Injector([{ provide: token, useClass: MyClass, multi: true }], injector)

  const result = childInjector.get<any[]>(token);

  t.true(result.length === 2);
  t.true(result[0] instanceof MyClass);
  t.is(result[1], 'blorg');
});

test('should resolve the static injection list', t => {
  const token = new Token('test');

  class MyClass {
    static inject() {
      return [ token ];
    }

    constructor(public dep: any) {}
  }
  const injector = new Injector([ MyClass, { provide: token, useValue: 'blorg' } ]);

  const myClass = injector.get<MyClass>(MyClass);

  t.is(myClass.dep, 'blorg');
});

test('should resolve the static injection list property', t => {
  const token = new Token('test');

  class MyClass {
    static inject = [ token ];

    constructor(public dep: any) {}
  }
  const injector = new Injector([ MyClass, { provide: token, useValue: 'blorg' } ]);

  const myClass = injector.get<MyClass>(MyClass);

  t.is(myClass.dep, 'blorg');
});

test('should resolve the static injection list property metadata', t => {
  const token = new Token('test');

  class MyClass {
    static inject = [ { token, lazy: true } ];

    constructor(public dep: any) {}
  }
  const injector = new Injector([ MyClass, { provide: token, useValue: 'blorg' } ]);

  const myClass = injector.get<MyClass>(MyClass);

  t.is(typeof myClass.dep, 'function');
  t.is(myClass.dep(), 'blorg');
});

test('should resolve inject properties', t => {
  t.plan(3);

  class MyService {}

  class MyClass {
    @Inject(MyService) myService: MyService;

    constructor() {
      t.is(this.myService, undefined);
    }

    @PostConstruct()
    init() {
      t.true(this.myService instanceof MyService);
    }
  }

  const injector = new Injector([ MyClass, MyService ]);

  const myClass = injector.get<MyClass>(MyClass);

  t.true(myClass.myService instanceof MyService);
});

test('should resolve inject properties on instances', t => {
  const token = new Token('token');
  const token2 = new Token('token');
  const instance: { [key: string]: any } = {};
  const injector = new Injector([
    { provide: token, useValue: 'blorg' },
    { provide: token2, useValue: 'test' }
  ]);

  injector.autowire(instance, { test: { token }, test2: token2 });

  t.is(instance.test, 'blorg');
  t.is(instance.test2, 'test');
});

test('should resolve inject properties lazily', t => {
  class MyService {}

  class MyClass {
    @Inject(MyService) @Lazy() myService: () => MyService;
  }

  const injector = new Injector([ MyClass, MyService ]);

  const myClass = injector.get(MyClass);

  t.is(typeof myClass.myService, 'function');
  t.true(myClass.myService() instanceof MyService);
});

test('should autowire inherited properties', t => {
  const token = new Token('blorg');
  const token2 = new Token('blorg2');
  const dep = {};
  const dep2 = {};
  class MyService {
    @Inject(token) dep: typeof dep;
  }

  class MyClass extends MyService {
    @Inject(token2) dep2: typeof dep2;
  }

  const injector = new Injector([
    MyClass,
    { provide: token, useValue: dep },
    { provide: token2, useValue: dep2 }
  ]);
  const myClass = injector.get(MyClass);

  t.is(myClass.dep2, dep2);
  t.is(myClass.dep, dep);
});

test('should invoke inherited post constructs', t => {
  t.plan(3);
  class MyService {
    @PostConstruct()
    fn() {
      t.pass();
    }

    @PostConstruct()
    fn3() {
      t.fail();
    }
  }

  class MyClass extends MyService {
    @PostConstruct()
    fn2() {
      t.pass();
    }

    @PostConstruct()
    fn3() {
      t.pass();
    }
  }

  const injector = new Injector([ MyClass ]);
  const myClass = injector.get(MyClass);
});

test('when injections are inherited it should find metadata', t => {
  const token = new Token<string>('blorg');

  class MyService {
    constructor(
      @Inject(token) public dep: string
    ) {}
  }

  class MyClass extends MyService {}

  const injector = new Injector([ MyClass, { provide: token, useValue: 'blorg' } ]);
  const myClass = injector.get(MyClass);

  t.is(myClass.dep, 'blorg');
});

test('should skip the init step', t => {
  class MyService {
    @PostConstruct()
    fn() {
      t.fail();
    }
  }

  class MyClass {
    @Inject(MyService) @SkipInit() myService: MyService;
  }

  const injector = new Injector([ MyClass, MyService ]);
  const myClass = injector.get(MyClass);

  t.true(myClass.myService instanceof MyService);
});

test('should throw a cyclical dependency error', t => {
  t.plan(1);
  const token = new Token('test');

  class MyService {
    @Inject(token) service: any;
  }

  class MyService2 {
    @Inject(MyService) service: any;
  }

  const injector = new Injector([ MyService, { provide: token, useClass: MyService2 } ]);

  t.throws(() => {
    injector.get(MyService);
  });
});

test('should not throw a cyclical dependency error when lazy', t => {
  t.plan(3);
  const token = new Token('test');

  class MyService {
    @Inject(token) @Lazy() service: any;
  }

  class MyService2 {
    @Inject(MyService) service: any;
  }

  const injector = new Injector([ MyService, { provide: token, useClass: MyService2 } ]);
  const myService = injector.get(MyService);

  t.is(typeof myService.service, 'function');
  t.true(myService.service() instanceof MyService2);
  t.pass();
});

test('should invoke the function with the dependencies', t => {
  t.plan(1);
  const token = new Token('test');

  function fn(dep: any) {
    t.is(dep, 'test');
  }

  const injector = new Injector([ { provide: token, useValue: 'test' } ]);

  injector.invoke(fn, [ token ]);
});

test('should allow undefined as a value', t => {
  const token = new Token('test');
  const injector = new Injector([ { provide: token, useValue: undefined } ]);

  t.true(injector.get(token) === undefined);
});