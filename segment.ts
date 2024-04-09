/* eslint-disable-next-line max-classes-per-file */
import {noChange} from "lit";
import {AsyncDirective} from "lit/async-directive.js";
import type {
  DirectiveParameters,
  ElementPart,
  PartInfo,
} from "lit/directive.js";
import {PartType, directive} from "lit/directive.js";
import type {
  AnimationListOptions,
  MotionKeyframesDefinition,
  TimelineSegment,
} from "motion";

export interface SegmentEventDetail {
  segment: TimelineSegment;
  index: number;
  end?: true;
  name?: string | symbol;
  attached: () => void;
}

export class SegmentEvent extends CustomEvent<SegmentEventDetail> {
  constructor(detail: SegmentEventDetail) {
    super("litmotionsegment", {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail,
    });
  }
}

export type SegmentOrder = number | [number, true];

export interface SegmentParameters {
  name?: string | symbol;
  order: SegmentOrder;
  keyframes: MotionKeyframesDefinition;
  options?: AnimationListOptions;
}

class Segment extends AsyncDirective {
  #attached = false;

  #name: string | symbol | undefined | false = false;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        "The `frame` directive must be used as an HTML `attribute`",
      );
    }
  }

  override update(
    part: ElementPart,
    [{name, order, keyframes, options}]: DirectiveParameters<this>,
  ) {
    if (this.#name === name && (this.#attached || !this.isConnected)) {
      return;
    }
    this.#name = name;
    this.#attached = false;

    const event = new SegmentEvent({
      attached: () => {
        this.#attached = true;
      },
      segment: [
        part.element,
        keyframes,
        ...(typeof options === "object" ? ([options] as const) : ([] as const)),
      ],
      ...(Array.isArray(order)
        ? {
            end: order[1],
            index: order[0],
          }
        : {index: order}),
      ...(typeof name === "string" ? {name} : {}),
    });

    // Queue until the element is connected.
    // XXX: Should use https://github.com/lit/lit/pull/4613.
    (function queueDispatch(this: Segment) {
      if (!part.element.isConnected) {
        queueMicrotask(queueDispatch.bind(this));
        return;
      }
      part.element.dispatchEvent(event);
      if (!this.#attached) {
        throw new Error(
          "`segment` directive must be below an element with a `timeline` directive.",
        );
      }
    }).call(this);

    return noChange;
  }

  override render(
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars -- Appears in the
       signature. */
    parameters: SegmentParameters,
  ) {
    // Intentionally empty
  }
}

/**
 * Declares an element as a segment for a timeline.
 *
 * @param order - The order of the segment in the timeline. This can be a number to
 * specify the index of the segment, an array with a number and `true` to specify the
 * index and that the segment is the end of the timeline, or an object with a `name`
 * property to specify the name of the timeline to attach to.
 * @param keyframes - The keyframes for the segment.
 * @param options - The options for the segment.
 */
const segment = directive(Segment);
export default segment;
