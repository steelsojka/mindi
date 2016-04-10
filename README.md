mindi
=====

Minimal DI Container

Usage
-----

```javascript
import { Injector } from 'mindi';

const injector = new Injector();

function myOtherServiceFactory() {
  return {
    woot() {
      console.log('woot!!!');
    }
  };
}

class MyService {
  constructor(myOtherService) {
    this.myOtherService = myOtherService;
  }
}

// Annotate the class (optional decorators)
Injector.annotate(MyService, 'myOtherService');
// or
MyService.$inject = ['myOtherService'];

// Register with the injector (key, value)
injector.factory('myOtherService', myOtherServiceFactory);
// If a key is not provided the first parameter will act as the key (value, value)
injector.singleton(MyService);

const myService = injector.get(MyService);
const myOtherService = injector.get('myOtherService');

myService.myOtherService === myOtherService; // => true
myService.myOtherService.woot(); // => woot!!!
```

You can use optional decorators.


```javascript
import { Injector, inject } from 'mindi';

const injector = new Injector();

@injector.register.singleton()
@inject('myOtherService')
class MyService {
  constructor(myOtherService) {
    this.myOtherService = myOtherService;
  }
}
```

API
---

# Injector

A minimal DI container with support for decorators. Reads injection annotations in the format of `$inject` where
the value is an array of dependencies or as a function that returns an array of dependencies.

## decorator

Registers a decorator for a component. Injected service is available as '$delegate'.
The injector is available as '$injector'.

**Parameters**

-   `key` **any** The key.
-   `fn` **Function** The decorator function.
      This function is also injectable.

## destroy

Performs any cleanup work on the injector.

## factory

Shorthand for registering a factory.

**Parameters**

-   `key` **any** The key.
-   `factory` **Function** The factory.

## get

Gets a registered component. This will also detect circular dependencies.

**Parameters**

-   `key` **any** The key to access.
-   `locals` **[Object&lt;string, any&gt;]** Local injections. (optional, default `{}`)

Returns **any** The component

## getAnnotations

Gets the annotations from an object.

**Parameters**

-   `value` **Function or Object** The value.

Returns **Array&lt;any&gt;** The result.

## has

Whether the injector has a component.

**Parameters**

-   `key` **any** The key.

Returns **boolean** The result.

## instantiate

Instantiates a class with the requested dependencies.

**Parameters**

-   `Ctor` **Function** The Ctor.
-   `locals` **[Object&lt;string, any&gt;]** Local injections. (optional, default `{}`)

Returns **Object** The result.

## invoke

Invokes a function with it's requested dependencies.

**Parameters**

-   `fn` **Function** The fn.
-   `locals` **[Object&lt;string, any&gt;]** Local injections. (optional, default `{}`)
-   `context`   (optional, default `null`)

Returns **any** The result.

## register

A decorator for registering a component with the injector.

**Parameters**

-   `type` **string** The type to register as.
-   `key` **[any]** The key to store under. Uses the target is not defined.

Returns **Function** The decorator function.

## resolve

Resolves a functions dependencies.

**Parameters**

-   `fn` **Function** The function.
-   `locals` **[Object&lt;string, any&gt;]** Local injections. (optional, default `{}`)

Returns **Array&lt;any&gt;** The result.

## set

Sets the an entry with the injector.

**Parameters**

-   `key` **any** The key.
-   `fn` **Function** The factory function.
-   `cache` **[boolean]** Whether to cache the entry. (optional, default `false`)

## singleton

Shorthand for registering a singleton class.

**Parameters**

-   `key` **any** The key.
-   `Ctor` **Function** The class constructor.

## spawn

Spawns (clones) a child injector with that same state.

Returns **Injector** The spawned injector.

## transient

Shorthand for registering a transient class.

**Parameters**

-   `key` **any** The key.
-   `Ctor` **Function** The class constructor.

## value

Shorthand for registering a value.

**Parameters**

-   `key` **any** The key.
-   `value` **any** The value.

## annotate

Annotates a function.

**Parameters**

-   `target` **Function** The target.
-   `dependencies` **...any** The dependencies.
