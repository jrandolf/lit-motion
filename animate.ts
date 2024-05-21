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

    const finishHandlers: (() => void)[] = [];
    measure(part, keyframes, finishHandlers);

    const controls = motionAnimate(part.element, keyframes, options);
    if (typeof options?.finished === "function") {
      const {finished} = options;
      finishHandlers.push(() => {
        finished();
      });
    }
    this.#controls = controls;

    void (async () => {
      await controls.finished;
      for (const handler of finishHandlers) {
        handler();
      }
    })();

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
  }
}

/**
 * Animates an element using the provided keyframes and options.
 *
 * To set the initial state of the element, you can either provide at least two key
 * frames or set the initial state in the element's style attribute. The former takes
 * precedence over the latter.
 *
 * Do not use `styleMap` to set the initial state as `styleMap` will disrupt the
 * animation.
 *
 * For the best experience, set the initial state in the element's style attribute.
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

function measure(
  part: ElementPart,
  keyframes: MotionKeyframesDefinition,
  finishHandlers: (() => void)[],
) {
  /* eslint-disable-next-line no-restricted-syntax -- When is this never an HTMLElement? */
  const element = part.element as HTMLElement;
  for (const attribute of [
    "width",
    "height",
    "top",
    "left",
    "right",
    "bottom",
  ] as const) {
    if (!(attribute in keyframes)) {
      continue;
    }
    // If the element is auto, replace with a concrete value.
    if (element.style[attribute] === "auto") {
      const autoStyles = window.getComputedStyle(element);
      element.style[attribute] = autoStyles[attribute];
    }

    // XXX: Technically, other attributes in the keyframe may affect the element's size.
    // However, this is a good enough approximation for now.
    const keyframe = keyframes[attribute];
    if (Array.isArray(keyframe)) {
      const lastKeyframe = keyframe[keyframe.length - 1];
      if (lastKeyframe !== "auto") {
        return;
      }
      keyframe[keyframe.length - 1] = getMeasuredValue(attribute, lastKeyframe);
    } else if (keyframe === "auto") {
      keyframes[attribute] = getMeasuredValue(attribute, keyframe);
    }
  }

  function getMeasuredValue(
    attribute: "bottom" | "height" | "left" | "right" | "top" | "width",
    keyframe: string,
  ) {
    const original = element.style[attribute];
    element.style[attribute] = keyframe;
    const value = window.getComputedStyle(element)[attribute];
    element.style[attribute] = original;
    finishHandlers.push(() => {
      element.style[attribute] = keyframe;
    });
    return value;
  }
}
