import {html, noChange} from "lit";
import type {DirectiveParameters, Part} from "lit/async-directive.js";
import {AsyncDirective, directive} from "lit/async-directive.js";

class WhenDirective extends AsyncDirective {
  #value = false;

  override update(
    _: Part,
    [predicate, trueCase, falseCase]: DirectiveParameters<this>,
  ): unknown {
    // XXX: We can probably simplify all this.
    const value = Boolean(predicate);
    if (value === this.#value) {
      if (Boolean(this.#value)) {
        return trueCase();
      }
      return falseCase?.();
    }
    this.#value = value;
    if (this.#value) {
      if (typeof falseCase === "function") {
        return falseCase(() => {
          this.setValue(trueCase());
        });
      }
      return trueCase();
    }
    return trueCase(() => {
      this.setValue(falseCase?.());
    });
  }

  override render<C, T, F>(
    predicate: C,
    trueCase: (done?: () => void) => T,
    falseCase?: (done?: () => void) => F,
  ) {
    this.#value = Boolean(predicate);
    if (Boolean(this.#value)) {
      return trueCase();
    }
    return falseCase?.();
  }
}

/* eslint-disable-next-line no-restricted-syntax -- TypeScript cannot deduce this. */
const when = directive(WhenDirective) as <C, T, F>(
  predicate: C,
  trueCase: (done?: () => void) => T,
  falseCase?: (done?: () => void) => F,
) => F | T;
export default when;
