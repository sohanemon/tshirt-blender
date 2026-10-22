# cli-template

A Bun-powered template for building a package that's **both a library and a CLI** from a single source of truth. Write a plain, documented function once in `src/index.ts` — get a fully-featured Commander CLI command generated automatically, complete with flags, validation, choices, and interactive prompts for anything the user doesn't supply.

Built with Commander, Chalk, Inquirer, and `ts-morph` for code generation.

## How it works

1. Write and export a normal function from `src/index.ts`.
2. Document it with a few TSDoc tags (`@description` is the only required one).
3. Run the generator — it reads your function's signature and TSDoc, and produces a matching CLI command.
4. Your function stays fully usable as a plain import too — nothing about it is CLI-specific.

```ts
/**
 * @description Set the log level
 * @param level the log level
 */
export function setLevel(level: 'debug' | 'info' | 'error') {
	return `level set to ${level}`;
}
```

Running `bun run generate:cli` turns this into a working `set-level --level <value>` command, with `--level` validated against `debug`/`info`/`error`, and an interactive select prompt if `--level` is omitted. No CLI code was hand-written for this command — commander args, choices, and prompts are all derived straight from the function's type signature and TSDoc.

## Usage

```sh
# Regenerate CLI commands from src/index.ts
bun run generate:cli

# Run locally
bun src/cli.ts --help

# Dev script
bun run dev
```

## Writing a command

Every exported function in `src/index.ts` becomes a command. The generator supports:

| TS type                          | CLI behavior                                      | Prompt (if required & missing) |
|-----------------------------------|----------------------------------------------------|----------------------------------|
| `string`                          | `--flag <value>`                                   | text input                       |
| `number`                          | `--flag <value>`                                   | text input, coerced to number    |
| `boolean`                         | `--flag` (boolean flag)                             | confirm (y/n)                    |
| `string[]` / `number[]`           | `--flag <values...>` (repeatable)                   | comma-separated input            |
| `'a' \| 'b' \| 'c'`               | `--flag <value>` validated against choices          | select (single choice)           |
| `('a' \| 'b' \| 'c')[]`           | `--flag <values...>` validated against choices      | checkbox (multi-select)          |
| `{ a: string; b: number }`        | flattened to `--parent-a`, `--parent-b`             | one prompt per sub-field         |

Every parameter is generated as a flag, never a positional argument — this is what lets any missing **required** value fall back to an interactive prompt instead of commander hard-failing. Optional parameters (with or without a default) are never prompted for; they just use their default or stay `undefined`.

TSDoc tags recognized by the generator:

```ts
/**
 * @name custom-command-name     // optional — defaults to the export name
 * @alias c                       // optional — short alias for the command
 * @description What this does   // REQUIRED — the only mandatory tag
 * @param paramName description   // optional — shown in --help; falls back to "name (type)"
 * @example my-command --flag x   // optional, repeatable — shown in --help
 */
export function myCommand(/* ... */) {}
```

Nested object parameters document their fields with a dotted path:

```ts
/**
 * @description Configure a service
 * @param config.name service name
 * @param config.mode service mode
 */
export function configureService(config: { name: string; mode: 'active' | 'standby' }) {
	return `${config.name}:${config.mode}`;
}
```

Arrays of objects and other complex/unsupported types aren't auto-generated — the generator throws a clear error telling you which parameter and why, so you can either simplify the type or hand-write that one command in `src/lib/cli-commands/` instead (see below).

## Manual (non-generated) commands

Some commands are inherently CLI-only — interactive-only flows, commands with no meaningful "library" equivalent, or ones needing prompt logic more complex than the generator supports. These live outside `index.ts` and are registered by hand in `src/cli.ts`, side-by-side with the generated ones. They're never picked up or touched by the generator.

## Commands (current template examples)

```
greet <name>     Greet someone
interactive|i    Launch an interactive prompt session
split <string>   Split a string into parts
spinner          Show a spinner animation
```

## Global install

The `bin` field in `package.json` points to `src/cli.ts` with a `#!/usr/bin/env bun` shebang, so the CLI can be installed globally:

```sh
# Install globally from local
bun install -g .

# Or link for development
bun link

# Or install from npm once published
bun install -g cli-template
```

Once installed, run from anywhere:

```sh
cli-template greet --name World
cli-template split "a,b,c" --first
```

You can also use it ad-hoc without installing:

```sh
bunx cli-template greet --name World
```

## Using it as a library

Everything exported from `src/index.ts` is also just a normal, importable function — the CLI is a generated layer on top, not a replacement:

```ts
import { setLevel } from 'cli-template';

setLevel('debug');
```

## Interactive prompts

Interactive prompting happens automatically wherever a required parameter is left unspecified on the command line — you don't need to do anything special to enable it per-command. Under the hood, generated commands use **Inquirer**:

```sh
cli-template set-level
# ? level  (Use arrow keys)
# ❯ debug
#   info
#   error
```

```sh
cli-template set-level --level debug
# runs immediately, no prompt — the value was already supplied
```

For fully custom interactive flows beyond what the generator produces, write the command by hand — see the existing `interactive` command in `src/lib/cli-commands/` for a direct-Inquirer example:

```ts
import inquirer from 'inquirer';

const answers = await inquirer.prompt([
  { type: 'input', name: 'name', message: 'What is your name?', default: 'World' },
  { type: 'select', name: 'color', message: 'Pick a color:', choices: ['Red', 'Green', 'Blue', 'Yellow'] },
  { type: 'confirm', name: 'shout', message: 'Shout it?', default: false },
]);

console.log(`Hello, ${answers.name}! Your color is ${answers.color}.`);
```

Run it:

```sh
bun src/cli.ts interactive
# or
bun run dev interactive
```


