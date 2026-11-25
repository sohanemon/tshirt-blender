# `gen` command

Generate images in bulk from a text file of prompts. Each line becomes one
JPEG. The prompt is sent as written.

```sh
bun src/cli.ts gen --prompts prompts.txt --out out/images
```

## API

Same call as the working curl:

```sh
curl -s https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/ai/run/@cf/black-forest-labs/flux-1-schnell \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a cat astronaut on mars"}'
```

The JPEG is base64 in `.result.image`. Decode it and write `<slug>.jpg`.

- Env: `CF_ACCOUNT_ID` and `CF_API_TOKEN`. Also accept
  `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
- Model default: `@cf/black-forest-labs/flux-1-schnell`.
- Body is only `{ "prompt" }`. No style suffix, no steps.
- Prompt length is 1–2048 characters.

## Prompt file

- Empty lines are skipped.
- A line whose first non-whitespace character is `#` is a comment.
- `slug: prompt text` sets the filename. The slug is
  `^[a-z0-9][a-z0-9-]{0,40}$` after lowercasing.
- A line with no slug uses a slug from the prompt: lowercase, non-alphanumerics
  become `-`, collapsed, trimmed, cut at 40 characters. Empty result becomes
  `image-01`, `image-02`, …
- Duplicate slugs get `-2`, `-3`, … in file order.
- A line that is only a slug is an error.

## CLI

```txt
tshirt-blender gen
  -p, --prompts <path>   Prompt file (required)
  -o, --out <dir>        Output folder (default: out/images)
      --model <id>       Default: @cf/black-forest-labs/flux-1-schnell
      --concurrency <n>  Default: 2, minimum 1
      --force            Overwrite existing files
```

Exit `1` before any request when credentials are missing, the file cannot be
read, or it yields zero prompts. Per image, skip an existing file unless
`--force`. One failure does not stop the batch. Exit `1` when any image fails.

## Files

| Path | Role |
| --- | --- |
| `src/lib/utils/prompt-file.ts` | Parse text into `{ slug, prompt, line }[]` |
| `src/lib/utils/image-gen.ts` | POST the prompt, return JPEG bytes. `fetch` is injectable |
| `src/lib/commands/gen.ts` | Commander command |
| `src/cli.ts` | Registers `gen` |
| `prompts.example.txt` | Sample prompt file |
| `tests/prompt-file.test.ts` | Parser |
| `tests/image-gen.test.ts` | Mock `fetch` |

## Out of scope

- Compositing onto a shirt, background removal, or rewriting prompts.
- Image edits, or more than one image per line.
- A second image provider.
