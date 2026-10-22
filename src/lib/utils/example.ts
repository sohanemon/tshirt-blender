// 1. Basic case (yours) — required string + optional boolean, alias, no @name (falls back to export name)
/**
 * @alias g
 * @description Greet someone by name
 * @option shout lets shout out
 * @interactive
 */
export function greet(name: string, shout?: boolean) {
	const msg = `Hello, ${name}!`;
	return shout ? msg.toUpperCase() : msg;
}

// 2. Explicit @name overriding export name
/**
 * @name say-hi
 * @description Custom-named command
 */
export function sayHiInternal(name: string) {
	return `Hi ${name}`;
}

// 3. Required number
/**
 * @description Add two numbers
 * @option a first number
 * @option b second number
 */
export function add(a: number, b: number) {
	return a + b;
}

// 4. Optional number with default value
/**
 * @description Multiply with a configurable factor
 * @option value the input value
 * @option factor multiplier
 */
export function scale(value: number, factor: number = 2) {
	return value * factor;
}

// 5. Required string array (variadic positional)
/**
 * @description Join a list of words
 * @option words words to join
 */
export function joinWords(words: string[]) {
	return words.join(' ');
}

// 6. Optional string array (repeatable flag)
/**
 * @description Print optional tags
 * @option tags optional tags to include
 */
export function printTags(tags?: string[]) {
	return tags?.join(',') ?? '';
}

// 7. Required number array
/**
 * @description Sum a list of numbers
 * @option values numbers to sum
 */
export function sumAll(values: number[]) {
	return values.reduce((a, b) => a + b, 0);
}

// 8. Required enum (string-literal union) as positional
/**
 * @description Set log level
 * @option level the log level
 */
export function setLevel(level: 'debug' | 'info' | 'error') {
	return `level set to ${level}`;
}

// 9. Optional enum with default
/**
 * @description Format output
 * @option format output format
 */
export function formatOutput(text: string, format: 'json' | 'text' = 'text') {
	return format === 'json' ? JSON.stringify({ text }) : text;
}

// 10. No description on params at all — should fall back to "name (kind)"
/**
 * @description Undocumented params fallback test
 */
export function undocumented(name: string, active?: boolean) {
	return `${name}:${active}`;
}

// 11. Flat object param (your nested-object feature, one level)
/**
 * @description Create a user
 * @option user.name the user's name
 * @option user.age the user's age
 */
export function createUser(user: { name: string; age: number }) {
	return `${user.name} (${user.age})`;
}

// 12. Deeply nested object param (2+ levels)
/**
 * @description Complex nested config test
 * @option config.retries retry count
 */
export function configure(config: {
	retries: number;
	nested: { deep: { flag: boolean } };
}) {
	return JSON.stringify(config);
}

// 13. Optional object param
/**
 * @description Optional settings object
 */
export function applySettings(settings?: { verbose: boolean; level: number }) {
	return JSON.stringify(settings ?? {});
}

// 14. Async function — should generate `async` action + `await` call
/**
 * @description Fetch something asynchronously
 * @option id the resource id
 */
export async function fetchResource(id: string) {
	return Promise.resolve(`resource-${id}`);
}

// 15. Multiple @example tags — should render in --help via addHelpText
/**
 * @description Command with examples
 * @option name target name
 * @example greet-multi Alice --loud
 * @example greet-multi Bob
 */
export function greetMulti(name: string, loud?: boolean) {
	return loud ? name.toUpperCase() : name;
}

// 16. No params at all
/**
 * @description Run with zero arguments
 */
export function ping() {
	return 'pong';
}

// 17. Mixed required positional + required enum + optional flag, ordering correct
/**
 * @description Deploy to an environment
 * @option service service name
 * @option env target environment
 * @option dryRun preview only, don't apply
 */
export function deploy(
	service: string,
	env: 'staging' | 'prod',
	dryRun?: boolean,
) {
	return `deploying ${service} to ${env}${dryRun ? ' (dry run)' : ''}`;
}

// 18. Required enum[] → --tags <values...> option with .choices(),
//    prompts via inquirer 'checkbox' when --tags isn't passed
/**
 * @description Enable feature tags
 * @option tags feature tags to enable
 */
export function enableTags(tags: ('api' | 'db' | 'cache')[]) {
	return tags.join(',');
}

// 19. Mixed: required string + required enum + optional boolean with default
//    Only `name` and `mode` should generate inquirer questions; `verbose`
//    should NOT prompt since it's optional (has a default).
/**
 * @description Run the build
 * @option name build target name
 * @option mode build mode
 * @option verbose print extra output
 */
export function build(
	name: string,
	mode: 'dev' | 'prod',
	verbose: boolean = false,
) {
	return `${name}:${mode}:${verbose}`;
}

// 20. Required number + required enum[] — mixed kind prompting in one command
/**
 * @description Allocate resources
 * @option count how many to allocate
 * @option regions regions to allocate in
 */
export function allocate(count: number, regions: ('us' | 'eu' | 'apac')[]) {
	return `${count} in ${regions.join(',')}`;
}

// 21. All-optional command — should generate zero inquirer questions,
//    no prompting should ever trigger since nothing is required
/**
 * @description List items with optional filters
 * @option search optional search term
 * @option limit max results
 */
export function listItems(search?: string, limit: number = 10) {
	return `${search ?? 'all'}:${limit}`;
}

// 22. Required string array (not enum) — should still use free-form
//    comma-separated 'input' prompt, NOT checkbox (only enum[] gets checkbox)
/**
 * @description Process a list of file paths
 * @option files files to process
 */
export function processFiles(files: string[]) {
	return files.length;
}

// 23. Nested object with a required enum sub-field — tests that enum
//    detection + prompting still works inside a flattened object path
/**
 * @description Configure a service
 * @option config.name service name
 * @option config.mode service mode
 */
export function configureService(config: {
	name: string;
	mode: 'active' | 'standby';
}) {
	return `${config.name}:${config.mode}`;
}

// 24. Async function with a required enum — confirms await + prompting
//    both work together correctly
/**
 * @description Deploy asynchronously
 * @option env target environment
 */
export async function deployAsync(env: 'staging' | 'prod') {
	return Promise.resolve(`deployed to ${env}`);
}

// 25. Required enum with only two choices, single-word command name via @name
/**
 * @name toggle
 * @description Toggle a binary state
 * @option state the state to set
 */
export function setState(state: 'on' | 'off') {
	return state;
}

// 26. Required number[] (not enum[]) — should use comma-separated input
//     with .map(Number), not checkbox
/**
 * @description Sum specific values
 * @option values numbers to sum
 */
export function sumSpecific(values: number[]) {
	return values.reduce((a, b) => a + b, 0);
}
