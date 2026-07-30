import { isDevelopmentBuild } from "../config/buildConfig";

const SENSITIVE_KEY_PATTERN =
  /(api[-_ ]?key|authorization|token|secret|password|credential)/i;
const COORDINATE_KEY_PATTERN = /^(lat|lng|lon|latitude|longitude|coords)$/i;

export function redactLogValue(value, key = "") {
  if (SENSITIVE_KEY_PATTERN.test(key) || COORDINATE_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item));
  }

  if (value && typeof value === "object") {
    if (value instanceof Error) {
      return { name: value.name, message: value.message };
    }

    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactLogValue(childValue, childKey),
      ]),
    );
  }

  return value;
}

function safeArgs(args) {
  return args.map((value) => redactLogValue(value));
}

export const logger = {
  log: (...args) => {
    if (isDevelopmentBuild) {
      console.log(...safeArgs(args));
    }
  },

  warn: (...args) => {
    if (isDevelopmentBuild) {
      console.warn(...safeArgs(args));
    }
  },

  error: (...args) => {
    if (isDevelopmentBuild) {
      console.error(...safeArgs(args));
    }
  },
};
