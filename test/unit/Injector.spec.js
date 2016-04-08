import Injector from '../../src/Injector';
import { expect } from 'chai';

describe('Injector', () => {
  let actual, injector;

  beforeEach(() => {
    injector = new Injector();
  });

  describe('get', () => {
    describe('when local', () => {
      beforeEach(() => {
        actual = injector.get('test', { test: 123 });
      });

      it('should return the value', () => {
        expect(actual).to.equal(123);
      });
    });

    describe('when not local', () => {
      beforeEach(() => {
        injector.value('test', 123);
      });

      it('should return the value', () => {
        expect(injector.get('test')).to.equal(123);
      });
    });

    describe('when there is a circular dependency ', () => {
      let factory1, factory2;

      beforeEach(() => {
        factory1 = function() {};
        factory2 = function() {};

        factory1.$inject = ['factory2'];
        factory2.$inject = ['factory1'];

        injector.factory('factory1', factory1);
        injector.factory('factory2', factory2);
      });

      it('should throw an error', () => {
        expect(() => injector.get('factory1')).to.throw;
      });
    });
  });

  describe('has', () => {
    beforeEach(() => {
      injector.value('test', 123);
    });

    it('should return true', () => {
      expect(injector.has('test')).to.be.true;
    });

    it('should return false', () => {
      expect(injector.has('blorg')).to.be.false;
    });
  });

  describe('set', () => {
    let value;

    describe('when cached', () => {
      let result, result2;

      beforeEach(() => {
        value = function() {};
        injector.set('test', () => new value(), true);

        result = injector.get('test');
        result2 = injector.get('test');
      });

      it('should be the same instance', () => {
        expect(result).to.equal(result2);
      });
    });

    describe('when not cached', () => {
      let result, result2;

      beforeEach(() => {
        value = function() {};
        injector.set('test', () => new value(), false);

        result = injector.get('test');
        result2 = injector.get('test');
      });

      it('should be the same instance', () => {
        expect(result).not.to.equal(result2);
      });
    });

    describe('when using decorators', () => {
      let result, _$injector, _$delegate;

      beforeEach(() => {
        result = {};
        injector.set('test', () => result, false);
        injector.decorator('test', decorator);
        decorator.$inject = ['$delegate', '$injector'];

        actual = injector.get('test');

        function decorator($delegate, $injector) {
          _$injector = $injector;
          _$delegate = $delegate;

          $delegate.blorg = 123;

          return $delegate;
        }
      });

      it('should inject the injector', () => {
        expect(_$injector).to.equal(injector);
      });

      it('should inject the delegate', () => {
        expect(_$delegate).to.equal(result);
      });

      it('should decorate the service', () => {
        expect(result.blorg).to.equal(123);
      });
    });
  });

  describe('factory', () => {
    beforeEach(() => {
      injector.factory('test', () => 123);
    });

    it('should return the value', () => {
      expect(injector.get('test')).to.equal(123);
    });
  });

  describe('singleton', () => {
    beforeEach(() => {
      injector.singleton('test', function() {});
    });

    it('should match instances', () => {
      expect(injector.get('test')).to.equal(injector.get('test'));
    });
  });

  describe('transient', () => {
    beforeEach(() => {
      injector.transient('test', function() {});
    });

    it('should match instances', () => {
      expect(injector.get('test')).not.to.equal(injector.get('test'));
    });
  });

  describe('value', () => {
    beforeEach(() => {
      injector.value('test', 123);
    });

    it('should return the value', () => {
      expect(injector.get('test')).to.equal(123);
    });
  });
});
