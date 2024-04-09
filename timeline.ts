import {AsyncDirective} from "lit/async-directive.js";
import type {ElementPart, PartInfo} from "lit/directive.js";
import {PartType, directive} from "lit/directive.js";
import type {
  AnimationControls,
  TimelineOptions as MotionTimelineOptions,
  TimelineSegment,
} from "motion";
import {timeline as motionTimeline} from "motion";

import type {SegmentEvent} from "./segment.js";
import {noChange} from "lit";

export interface TimelineOptions extends MotionTimelineOptions {
  /**
   * The name of the timeline. Useful if you want to connect segments to a specific
   * timeline.
   *
   * If provided, timeline segments will only be added if the name matches.
   */
  name?: string | symbol;
  /**
   * Called whenever the animation finishes animating.
   *
   * Note this does not get called if the animation is cancelled (e.g. because of
   * disconnection).
   */
  finished?: () => void;
}

// XXX: There is currently no way to play the animation if `autoplay` is set to
// `false`. Investigate user flows.
class Timeline extends AsyncDirective {
  #controls?: AnimationControls;
  #finish?: () => Promise<void>;
  #finishPromise: Promise<void> | null = null;

  #segments: TimelineSegment[] = [];
  #segmentsCount = 0;
  #segmentsLength?: number;

  #listenerAdded = false;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        "The `timeline` directive must be used as an HTML `attribute`",
      );
    }
  }

  override update(part: ElementPart, [options]: [TimelineOptions?]) {
    if (!this.#listenerAdded) {
      part.element.addEventListener("litmotionsegment", (event) => {
        const segmentEvent = event as SegmentEvent;
        const {segment, index, end, name} = segmentEvent.detail;
        if (name !== options?.name) {
          return;
        }

        if (typeof this.#controls === "object") {
          throw new Error(
            `Segments cannot be added after the animation has started.`,
          );
        }
        event.stopImmediatePropagation();
        segmentEvent.detail.attached();

        if (typeof this.#segments[index] === "object") {
          throw new Error(`Segment at index ${index} already exists.`);
        }
        this.#segments[index] = segment;
        this.#segmentsCount += 1;

        if (end) {
          if (typeof this.#segmentsLength === "number") {
            throw new Error(`Two end segments found.`);
          }
          this.#segmentsLength = index + 1;
          this.#segments.length = this.#segmentsLength;
        }

        this.update(part, typeof options === "object" ? [options] : []);
      });
      this.#listenerAdded = true;
    }

    if (
      this.#segmentsLength !== this.#segmentsCount ||
      !this.isConnected ||
      typeof this.#controls !== "undefined"
    ) {
      return;
    }
    const controls = motionTimeline(this.#segments, options);
    if (
      typeof options !== "undefined" &&
      typeof options.finished === "function"
    ) {
      const {finished} = options;

      /* eslint-disable-next-line no-inner-declarations -- Uses inner variable. */
      this.#finish = async function finish(this: Timeline) {
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

  override render(
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- Appears in the
       signature. */
    options?: TimelineOptions,
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
    if (typeof this.#finish === "function" && this.#finishPromise === null) {
      this.#finishPromise = this.#finish.call(this);
    }
  }
}

/**
 * Animates a set of segments along a timeline.
 *
 * @example In this example, the animation will start once all segments are attached and
 * the timeline is connected to the DOM.
 *
 * ```ts
 * import {html} from "lit";
 *
 * import {timeline, segment} from "lit-motion";
 *
 * html`
 *   <div ${timeline()}>
 *     <div style="opacity:0" ${segment(0, {opacity: 1})}></div>
 *     <div style="opacity:0" ${segment([1, true], {opacity: 1})}></div>
 *   </div>
 * `;
 * ```
 *
 * @example In this advanced example, the timeline will trigger a callback one the `init`
 * timeline finishes. If `init` is flipped to `false`, the `end` timeline will start and
 * print `"end finished"` when the timeline finishes.
 *
 * Note we don't ternary the between the `init` and `end` timelines. This is important
 * because `lit` uses the placement of the directive to determine when a directive is
 * connected.
 *
 * ```ts
 * import { html } from "lit";
 *
 * import { segment, timeline, nothing } from "lit-motion";
 *
 * let init = true;
 *
 * html`
 *   <div
 *     ${init
 *       ? timeline({
 *           name: "init",
 *           finished: () => {
 *             console.log("init finished");
 *           },
 *         })
 *       : nothing}
 *     ${!init
 *       ? timeline({
 *           name: "end",
 *           finished: () => {
 *             console.log("end finished");
 *           },
 *         })
 *       : nothing}
 *   >
 *     <div
 *       style="opacity:0"
 *       ${init ? segment({ name: "init", index: 0 }, { opacity: 1 }) : nothing}
 *       ${!init
 *         ? segment({ name: "end", index: 1, end: true }, { opacity: 0 })
 *         : nothing}
 *     ></div>
 *     <div
 *       style="opacity:0"
 *       ${init
 *         ? segment({ name: "init", index: 1, end: true }, { opacity: 1 })
 *         : nothing}
 *       ${!init ? segment({ name: "end", index: 0 }, { opacity: 0 }) : nothing}
 *     ></div>
 *   </div>
 * `;
 * ```
 *
 * @param options - The options to use when animating the timeline.
 */
const timeline = directive(Timeline);
export default timeline;
