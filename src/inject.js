import Injector from './Injector';

/**
 * A decorator from annotating a class.
 * @param {...*} dep - The dep
 * @returns {Function} The decorator.
 */
export default function inject(...dep) {
  return function(target, name, descriptor) {
    if (arguments.length === 1) {
      Injector.annotate(target, ...dep);
    } else {
      Injector.annotate(descriptor.value, ...dep);
    }
  };
}
