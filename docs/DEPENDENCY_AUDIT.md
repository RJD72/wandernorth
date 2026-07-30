# Dependency audit for limited Android beta

Audit date: 2026-07-30

## Results

- `npm audit --omit=dev`: 30 findings (20 high, 10 moderate)
- `npm audit`: 52 findings (42 high, 10 moderate)
- `npx expo-doctor`: 18/18 checks passed

The reported paths are in the Expo/Metro/prebuild, React Native codegen and
development middleware, Jest/coverage, ESLint, glob/minimatch/brace-expansion,
PostCSS, and Xcode configuration toolchains. The audit did not identify a
vulnerable Wander North business-logic module or a remotely callable server
dependency; this repository builds a client application.

## Deferred advisories

| Packages/advisory family                         | Severity | Reach in this project                       | Compatible fix                                                                         |
| ------------------------------------------------ | -------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `brace-expansion`, `minimatch`, `glob`, `rimraf` | High     | Build, CLI, codegen, lint, and test tooling | No non-breaking lockfile resolution reported; audit force proposes React Native 0.86.2 |
| `postcss`                                        | High     | Expo/Metro and CSS build pipeline           | No SDK 54-compatible audit fix; audit force proposes Expo 57.0.9                       |
| `uuid` through `xcode`/Expo config plugins       | Moderate | Native project generation tooling           | No SDK 54-compatible audit fix; audit force proposes Expo 57.0.9                       |

`npm audit fix --force` was not run because its proposed Expo and React Native
major upgrades are outside this beta-hardening scope and would require a
separate migration and full native regression cycle. These findings remain
accepted beta risk, not resolved vulnerabilities. Refresh the audit before each
beta build and schedule the Expo/React Native upgrade separately.
