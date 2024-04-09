import {noChange} from "lit";
import {AsyncDirective} from "lit/async-directive.js";
import type {
  DirectiveParameters,
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

export interface AnimateOptions extends AnimationOptionsWithOverrides {
  /**
   * Called whenever the animation finishes animating.
   *
   * Note this does not get called if the animation is cancelled (e.g. because
   * of disconnection).
   */
  finished?: () => void;
}

export interface AnimateParameters<K extends string | symbol> {
  name?: K;
  variants?: Record<
    K,
    {keyframes: MotionKeyframesDefinition; options?: AnimateOptions}
  >;
  keyframes?: MotionKeyframesDefinition;
  options?: AnimateOptions;
}

// XXX: There is currently no way to play the animation if `autoplay` is set to
// `false`. Investigate user flows.
class Animate extends AsyncDirective {
  #name: string | symbol | undefined | null = null;
  #controls?: AnimationControls;
  #finish?: () => Promise<void>;
  #finishPromise: Promise<void> | null = null;

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
    [{options, name, variants, keyframes}]: DirectiveParameters<this>,
  ) {
    if (!this.isConnected || this.#name === name) {
      return;
    }
    this.#name = name;

    let definition;
    if (typeof name === "undefined") {
      definition = keyframes;
    } else {
      const variant = variants?.[name];
      definition = variant?.keyframes;
      options = {...options, ...variant?.options};
    }
    if (typeof definition === "undefined") {
      throw new Error(
        `The \`animate\` directive is missing either a \`keyframes\` or a \`variants\` definition, depending on whether a \`name\` was provided`,
      );
    }

    if (typeof this.#controls === "object") {
      this.#controls.stop();
    }

    const controls = motionAnimate(part.element, definition, options);
    if (
      typeof options !== "undefined" &&
      typeof options.finished === "function"
    ) {
      const {finished} = options;

      /* eslint-disable-next-line no-inner-declarations -- Uses inner variable. */
      this.#finish = async function finish(this: Animate) {
        await controls.finished;
        finished();
        this.#finishPromise = null;
      };

      // In case the animation is not running because autoplay was turned off.
      if (controls.playState !== "idle") {
        this.#finishPromise = this.#finish.call(this);
      }
    }
    this.#controls = controls;

    return noChange;
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
    if (typeof this.#finish === "function" && this.#finishPromise === null) {
      this.#finishPromise = this.#finish.call(this);
    }
  }

  override render<K extends symbol | string>(
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- Appears in the
       signature. */
    parameters: AnimateParameters<K>,
  ) {
    // Intentionally empty
  }
}

/**
 * Animates an element using the provided keyframes and options.
 *
 * To set the initial state of the element, you can either provide at least two
 * key frames or set the initial state in the element's style attribute. The
 * former takes precedence over the latter.
 *
 * For the best experience, it is recommended to use two key frames to set the
 * initial state. This isolates the animation from the element's current state
 * and ensures the animation is consistent.
 *
 * @example In this example, the element will animate from an opacity of `0` to
 * `1`. Note the initial state is deduced from the element's current state.
 *
 * ```ts
 * import {html} from "lit";
 *
 * import animate from "lit-motion";
 *
 * html`<div style="opacity:0" ${animate({opacity: 1})}></div>`;
 * ```
 *
 * @example In this example, the element will animate from an opacity of `0` to
 * `1` after 1 second. Similar to the previous example, the initial state is
 * deduced from the element's current state.
 *
 * ```ts
 * import {html, styleMap} from "lit";
 *
 * import animate from "lit-motion";
 *
 * html`<div style=${styleMap({opacity: 0})} ${animate({opacity: 1}, {delay: 1})}></div>`;
 * ```
 *
 * @example In this example, the element will animate from an opacity of `0` to
 * `1` after 1 second. Note the initial state is set to 0 (i.e. the first
 * state), even before the animation starts.
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
const animate = directive(Animate);
export default animate;
