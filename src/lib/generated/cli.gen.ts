// AUTO-GENERATED — do not edit by hand. Run `commander-codegen` to regenerate.
import { Command, Option } from 'commander';
import inquirer from 'inquirer';
import { greet, sayHiInternal, add, scale, joinWords, printTags, sumAll, setLevel, formatOutput, undocumented, createUser, configure, applySettings, fetchResource, greetMulti, ping, deploy, enableTags, build, allocate, listItems, processFiles, configureService, deployAsync, setState, sumSpecific } from '../../index';

export function registerCommands(program: Command): void {
  program
    .command('greet')
    .alias('g')
    .description("Greet someone by name")
    .option('--name <value>', "name (string)")
    .option('--shout', "lets shout out")
    .action(async (opts) => {
      const values = { name: opts.name, shout: opts.shout };
      const missingQuestions = [
        { type: 'input', name: 'name', message: "name (string)" }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = greet(resolved.name, resolved.shout);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('say-hi')
    .description("Custom-named command")
    .option('--name <value>', "name (string)")
    .action(async (opts) => {
      const values = { name: opts.name };
      const missingQuestions = [
        { type: 'input', name: 'name', message: "name (string)" }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = sayHiInternal(resolved.name);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('add')
    .description("Add two numbers")
    .option('--a <value>', "first number")
    .option('--b <value>', "second number")
    .action(async (opts) => {
      const values = { a: opts.a, b: opts.b };
      const missingQuestions = [
        { type: 'input', name: 'a', message: "first number", filter: (v) => Number(v) },
  		{ type: 'input', name: 'b', message: "second number", filter: (v) => Number(v) }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = add(resolved.a, resolved.b);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('scale')
    .description("Multiply with a configurable factor")
    .option('--value <value>', "the input value")
    .option('--factor <value>', "multiplier", 2)
    .action(async (opts) => {
      const values = { value: opts.value, factor: opts.factor };
      const missingQuestions = [
        { type: 'input', name: 'value', message: "the input value", filter: (v) => Number(v) }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = scale(resolved.value, resolved.factor);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('joinWords')
    .description("Join a list of words")
    .option('--words <values...>', "words to join", [])
    .action(async (opts) => {
      const values = { words: opts.words };
      const missingQuestions = [
        { type: 'input', name: 'words', message: "words to join" + ' (comma-separated)', filter: (v) => v.split(',').map((s) => s.trim()) }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = joinWords(resolved.words);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('printTags')
    .description("Print optional tags")
    .option('--tags <values...>', "optional tags to include", [])
    .action(async (opts) => {
      const resolved = { tags: opts.tags };
      const result = printTags(resolved.tags);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('sumAll')
    .description("Sum a list of numbers")
    .option('--values <values...>', "numbers to sum", [])
    .action(async (opts) => {
      const values = { values: opts.values };
      const missingQuestions = [
        { type: 'input', name: 'values', message: "numbers to sum" + ' (comma-separated)', filter: (v) => v.split(',').map((s) => s.trim()).map(Number) }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = sumAll(resolved.values);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('setLevel')
    .description("Set log level")
    .addOption(new Option('--level <value>', "the log level").choices(["debug","info","error"]))
    .action(async (opts) => {
      const values = { level: opts.level };
      const missingQuestions = [
        { type: 'select', name: 'level', message: "the log level", choices: ["debug","info","error"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = setLevel(resolved.level);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('formatOutput')
    .description("Format output")
    .option('--text <value>', "text (string)")
    .addOption(new Option('--format <value>', "output format").choices(["json","text"]).default('text'))
    .action(async (opts) => {
      const values = { text: opts.text, format: opts.format };
      const missingQuestions = [
        { type: 'input', name: 'text', message: "text (string)" }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = formatOutput(resolved.text, resolved.format);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('undocumented')
    .description("Undocumented params fallback test")
    .option('--name <value>', "name (string)")
    .option('--active', "active (boolean)")
    .action(async (opts) => {
      const values = { name: opts.name, active: opts.active };
      const missingQuestions = [
        { type: 'input', name: 'name', message: "name (string)" }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = undocumented(resolved.name, resolved.active);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('createUser')
    .description("Create a user")
    .option('--user-name <value>', "the user's name")
    .option('--user-age <value>', "the user's age")
    .action(async (opts) => {
      const values = { userName: opts.userName, userAge: opts.userAge };
      const missingQuestions = [
        { type: 'input', name: 'userName', message: "the user's name" },
  		{ type: 'input', name: 'userAge', message: "the user's age", filter: (v) => Number(v) }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = createUser({ name: resolved.userName, age: resolved.userAge });
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('configure')
    .description("Complex nested config test")
    .option('--config-retries <value>', "retry count")
    .option('--config-nested-deep-flag', "flag (boolean)")
    .action(async (opts) => {
      const values = { configRetries: opts.configRetries, configNestedDeepFlag: opts.configNestedDeepFlag };
      const missingQuestions = [
        { type: 'input', name: 'configRetries', message: "retry count", filter: (v) => Number(v) },
  		{ type: 'confirm', name: 'configNestedDeepFlag', message: "flag (boolean)", default: false }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = configure({ retries: resolved.configRetries, nested: { deep: { flag: resolved.configNestedDeepFlag } } });
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('applySettings')
    .description("Optional settings object")
    .option('--settings-verbose', "verbose (boolean)")
    .option('--settings-level <value>', "level (number)")
    .action(async (opts) => {
      const resolved = { settingsVerbose: opts.settingsVerbose, settingsLevel: opts.settingsLevel };
      const result = applySettings({ verbose: resolved.settingsVerbose, level: resolved.settingsLevel });
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('fetchResource')
    .description("Fetch something asynchronously")
    .option('--id <value>', "the resource id")
    .action(async (opts) => {
      const values = { id: opts.id };
      const missingQuestions = [
        { type: 'input', name: 'id', message: "the resource id" }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = await fetchResource(resolved.id);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('greetMulti')
    .description("Command with examples")
    .option('--name <value>', "target name")
    .option('--loud', "loud (boolean)")
    .addHelpText('after', "\nExamples:\n  $ greet-multi Alice --loud\n  $ greet-multi Bob")
    .action(async (opts) => {
      const values = { name: opts.name, loud: opts.loud };
      const missingQuestions = [
        { type: 'input', name: 'name', message: "target name" }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = greetMulti(resolved.name, resolved.loud);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('ping')
    .description("Run with zero arguments")
  
    .action(async (opts) => {
      const resolved = {  };
      const result = ping();
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('deploy')
    .description("Deploy to an environment")
    .option('--service <value>', "service name")
    .addOption(new Option('--env <value>', "target environment").choices(["staging","prod"]))
    .option('--dryRun', "preview only, don't apply")
    .action(async (opts) => {
      const values = { service: opts.service, env: opts.env, dryRun: opts.dryRun };
      const missingQuestions = [
        { type: 'input', name: 'service', message: "service name" },
  		{ type: 'select', name: 'env', message: "target environment", choices: ["staging","prod"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = deploy(resolved.service, resolved.env, resolved.dryRun);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('enableTags')
    .description("Enable feature tags")
    .addOption(new Option('--tags <values...>', "feature tags to enable").choices(["api","db","cache"]))
    .action(async (opts) => {
      const values = { tags: opts.tags };
      const missingQuestions = [
        { type: 'checkbox', name: 'tags', message: "feature tags to enable", choices: ["api","db","cache"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = enableTags(resolved.tags);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('build')
    .description("Run the build")
    .option('--name <value>', "build target name")
    .addOption(new Option('--mode <value>', "build mode").choices(["prod","dev"]))
    .option('--verbose', "print extra output", false)
    .action(async (opts) => {
      const values = { name: opts.name, mode: opts.mode, verbose: opts.verbose };
      const missingQuestions = [
        { type: 'input', name: 'name', message: "build target name" },
  		{ type: 'select', name: 'mode', message: "build mode", choices: ["prod","dev"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = build(resolved.name, resolved.mode, resolved.verbose);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('allocate')
    .description("Allocate resources")
    .option('--count <value>', "how many to allocate")
    .addOption(new Option('--regions <values...>', "regions to allocate in").choices(["us","eu","apac"]))
    .action(async (opts) => {
      const values = { count: opts.count, regions: opts.regions };
      const missingQuestions = [
        { type: 'input', name: 'count', message: "how many to allocate", filter: (v) => Number(v) },
  		{ type: 'checkbox', name: 'regions', message: "regions to allocate in", choices: ["us","eu","apac"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = allocate(resolved.count, resolved.regions);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('listItems')
    .description("List items with optional filters")
    .option('--search <value>', "optional search term")
    .option('--limit <value>', "max results", 10)
    .action(async (opts) => {
      const resolved = { search: opts.search, limit: opts.limit };
      const result = listItems(resolved.search, resolved.limit);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('processFiles')
    .description("Process a list of file paths")
    .option('--files <values...>', "files to process", [])
    .action(async (opts) => {
      const values = { files: opts.files };
      const missingQuestions = [
        { type: 'input', name: 'files', message: "files to process" + ' (comma-separated)', filter: (v) => v.split(',').map((s) => s.trim()) }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = processFiles(resolved.files);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('configureService')
    .description("Configure a service")
    .option('--config-name <value>', "service name")
    .addOption(new Option('--config-mode <value>', "service mode").choices(["active","standby"]))
    .action(async (opts) => {
      const values = { configName: opts.configName, configMode: opts.configMode };
      const missingQuestions = [
        { type: 'input', name: 'configName', message: "service name" },
  		{ type: 'select', name: 'configMode', message: "service mode", choices: ["active","standby"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = configureService({ name: resolved.configName, mode: resolved.configMode });
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('deployAsync')
    .description("Deploy asynchronously")
    .addOption(new Option('--env <value>', "target environment").choices(["staging","prod"]))
    .action(async (opts) => {
      const values = { env: opts.env };
      const missingQuestions = [
        { type: 'select', name: 'env', message: "target environment", choices: ["staging","prod"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = await deployAsync(resolved.env);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('toggle')
    .description("Toggle a binary state")
    .addOption(new Option('--state <value>', "the state to set").choices(["on","off"]))
    .action(async (opts) => {
      const values = { state: opts.state };
      const missingQuestions = [
        { type: 'select', name: 'state', message: "the state to set", choices: ["on","off"] }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = setState(resolved.state);
      if (result !== undefined) console.log(result);
    });
  
  program
    .command('sumSpecific')
    .description("Sum specific values")
    .option('--values <values...>', "numbers to sum", [])
    .action(async (opts) => {
      const values = { values: opts.values };
      const missingQuestions = [
        { type: 'input', name: 'values', message: "numbers to sum" + ' (comma-separated)', filter: (v) => v.split(',').map((s) => s.trim()).map(Number) }
      ].filter((q) => (values as Record<string, unknown>)[q.name] === undefined);
      const answers = missingQuestions.length > 0 ? await inquirer.prompt(missingQuestions) : {};
      const resolved = { ...values, ...answers };
      const result = sumSpecific(resolved.values);
      if (result !== undefined) console.log(result);
    });
}
