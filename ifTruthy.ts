import {nothing} from "lit";

export default function ifTruthy<T>(value: T): T | typeof nothing {
  return Boolean(value) ? value : nothing;
}
