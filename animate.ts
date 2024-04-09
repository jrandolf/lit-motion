import {noChange} from "lit";
import {AsyncDirective} from "lit/async-directive.js";
import type {
  DirectiveParameters,
  DirectiveResult,
  ElementPart,
  PartInfo,
} from "lit/directive.js";
import {PartType, directive} from "lit/directive.js";
import type {
  AnimationControls,
  AnimationOptionsWithOverrides,
  MotionKeyframesDefinition,
} from "motion";
import {animate as motionAnimate} from "motion";

export type AnimateOptions = AnimationOptionsWithOverrides & {
  /**
   * Called whenever the animation finishes animating.
   *
   * Note this does not get called if the animation is cancelled (e.g. because of
   * disconnection).
   */
  finished?: () => void;
};

export interface VariantAnimateParameters<
  Variant extends string | symbol,
  Context extends NonNullable<unknown>,
> {
  variants: Record<
    Variant,
    | ((context: Context) => {
        keyframes: MotionKeyframesDefinition;
        options?: AnimateOptions;
      })
    | {keyframes: MotionKeyframesDefinition; options?: AnimateOptions}
  >;
  keyframes: Variant;
  context?: Context;
  options?: AnimateOptions;
}

export interface SimpleAnimateParameters {
  keyframes: MotionKeyframesDefinition;
  options?: AnimateOptions;
}

export type AnimateParameters<
  Variant extends string | symbol,
  Key extends NonNullable<unknown>,
> = SimpleAnimateParameters | VariantAnimateParameters<Variant, Key>;

// XXX: There is currently no way to play the animation if `autoplay` is set to
// `false`. Investigate user flows.
class Animate extends AsyncDirective {
  #variant?: string | symbol;

  #controls?: AnimationControls;

  #finish?: (this: Animate) => Promise<void>;
  #finishPromise: Promise<void> | false = false;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        "The `animate` directive must be used as an HTML `attribute`",
      );
    }
  }

  override update(
    part: ElementPart,
    [{options, ...parameters}]: DirectiveParameters<this>,
  ) {
    if (!this.isConnected) {
      return;
    }

    let keyframes;
    if ("variants" in parameters) {
      if (this.#variant === parameters.keyframes) {
        return;
      }
      let variant = parameters.variants[parameters.keyframes];
      if (typeof variant === "undefined") {
        throw new Error(
          `The variant "${String(parameters.keyframes)}" does not exist on the element`,
        );
      }
      if (typeof variant === "function") {
        if (typeof parameters.context === "undefined") {
          throw new Error(
            `The variant "${String(parameters.keyframes)}" requires a context`,
          );
        }
        variant = variant(parameters.context);
      }
      ({keyframes} = variant);
      this.#variant = parameters.keyframes;
      /* eslint-disable-next-line no-param-reassign -- Downstream users shouldn't need to
         original. */
      options = {...variant.options, ...options};
      if (typeof this.#controls === "object") {
        this.#controls.stop();
      }
    } else {
      if (typeof this.#controls === "object") {
        return;
      }
      ({keyframes} = parameters);
    }

    const controls = motionAnimate(part.element, keyframes, options);
    if (
      typeof options !== "undefined" &&
      typeof options.finished === "function"
    ) {
      const {finished} = options;

      /* eslint-disable-next-line no-inner-declarations -- Uses inner variable. */
      this.#finish = async function finish(this: Animate) {
        await controls.finished;
        finished();
        this.#finishPromise = false;
      };

      // In case the animation is not running because autoplay was turned off.
      if (controls.playState !== "idle") {
        this.#finishPromise = this.#finish.apply(this);
      }
    }
    this.#controls = controls;

    return noChange;
  }

  override render<
    Variant extends string | symbol,
    Context extends NonNullable<unknown>,
  >(
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- Appears in the
       signature. */
    parameters: AnimateParameters<Variant, Context>,
  ) {
    // Intentionally empty
  }

  protected override disconnected(): void {
    if (typeof this.#controls === "undefined") {
      return;
    }
    this.#controls.cancel();
  }

  protected override reconnected(): void {
    if (typeof this.#controls === "undefined") {
      return;
    }
    this.#controls.play();
    if (typeof this.#finish === "function" && this.#finishPromise === false) {
      this.#finishPromise = this.#finish.apply(this);
    }
  }
}

/**
 * Animates an element using the provided keyframes and options.
 *
 * To set the initial state of the element, you can either provide at least two key
 * frames or set the initial state in the element's style attribute. The former takes
 * precedence over the latter.
 *
 * For the best experience, it is recommended to use two key frames to set the initial
 * state. This isolates the animation from the element's current state and ensures the
 * animation is consistent.
 *
 * @example In this example, the element will animate from an opacity of `0` to `1`. Note
 * the initial state is deduced from the element's current state.
 *
 * ```ts
 * import {html} from "lit";
 *
 * import animate from "lit-motion";
 *
 * html`<div style="opacity:0" ${animate({opacity: 1})}></div>`;
 * ```
 *
 * @example In this example, the element will animate from an opacity of `0` to `1` after
 * 1 second. Similar to the previous example, the initial state is deduced from the
 * element's current state.
 *
 * ```ts
 * import {html, styleMap} from "lit";
 *
 * import animate from "lit-motion";
 *
 * html`<div
 *   style=${styleMap({opacity: 0})}
 *   ${animate({opacity: 1}, {delay: 1})}
 * ></div>`;
 * ```
 *
 * @example In this example, the element will animate from an opacity of `0` to `1` after
 * 1 second. Note the initial state is set to 0 (i.e. the first state), even before the
 * animation starts.
 *
 * ```ts
 * import {html} from "lit";
 *
 * import animate from "lit-motion";
 *
 * html`<div ${animate({opacity: [0, 1]}, {delay: 1})}></div>`;
 * ```
 *
 * @param keyframes - The keyframes to animate the element with.
 * @param options - The options to use when animating the element.
 */
/* eslint-disable-next-line no-restricted-syntax -- TypeScript cannot deduce a
   higher-kinded type. */
const animate = directive(Animate) as <
  Variant extends string | symbol,
  Context extends NonNullable<unknown>,
>(
  parameters: AnimateParameters<Variant, Context>,
) => DirectiveResult<typeof Animate>;
export default animate;
