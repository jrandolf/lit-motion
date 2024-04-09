# Lit Motion

This is a simple [Lit](https://github.com/lit/lit) adaptor for the fantastic
[Motion One](https://motion.dev) library.

## Getting started

```sh
npm i lit-motion
```

## Usage

The main export is a directive. See `index.ts` for documentation.

## Alternatives

- `@lit-labs/motion` - This is Lit's first-party animation library. It is
  lower-level than Motion One in some respects. We recommend using this library
  over `@lit-labs/motion` for two specific reasons:

  1.  It's much easier to use.
  2.  Cross-platform differences are polyfilled/gracefully handled. See
      https://motion.dev/guides/waapi-improvements for more information.

  The most important difference is this library automatically handles persisting
  final animation keyframe beyond the animation without using `"forward"`. See
  https://motion.dev/guides/waapi-improvements#persisting-animation-state for
  more details.
