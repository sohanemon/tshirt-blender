# tshirt-blender

Composite artwork onto t-shirt photos with fabric-aware shading and
displacement. Built with Bun, Commander and [sharp](https://sharp.pixelplumbing.com/).

One command:

- `overlay` — drop a design onto a shirt photo, no setup needed. The print area
  is a fixed chest rectangle, the design follows the fabric folds and picks up
  the fabric shading.

## Usage

```sh
# Run locally
bun src/cli.ts --help

# Single design
bun src/cli.ts overlay \
  --shirt src/assets/black-tshirt.png \
  --design src/assets/designs/design-a.png \
  --out out/mockups/design-a.jpg

# Batch a folder, two color variants
bun src/cli.ts overlay \
  --shirt src/assets/black-tshirt.png \
  --design src/assets/designs \
  --out out/mockups \
  --color '#ff0000' --color '#1f2937'
```

## `overlay`

The shirt photo should be a transparent-background PNG; the design is a
transparent PNG (or a folder of PNG/WebP files to batch).

| Option | Default | Meaning |
| --- | --- | --- |
| `--shirt <path>` | required | T-shirt photo with a transparent background |
| `--design <path>` | required | Design image, or a folder of PNG/WebP designs |
| `--out <path>` | required | Output file (single design) or output folder (batch) |
| `--color <hex>` | none | Shirt color variant, repeatable |
| `--size <px>` | `2000` | Output size, square |
| `--opacity <n>` | `0.93` | Design opacity over the fabric |
| `--displace <px>` | `14` | Displacement along the fabric folds |
| `--shade <n>` | `6` | Fabric shading strength on the ink |
| `--box <l,t,w,h>` | `0.33,0.22,0.34,0.32` | Print area as fractions of the shirt image |

Batch output is named `<design>[-<colorhex>].jpg`. Recoloring a dark base shirt
looks fake, and a dark design on a dark shirt disappears — the command warns
about both.

### How the composite works

1. The shirt is loaded once and cached; the shading and displacement maps are
   derived from it and reused for every design.
2. **Shading** — greyscale + light blur, normalized on the 2/50/98 luminance
   percentiles of the visible fabric. A black shirt spans only a few luminance
   levels, so the range is stretched before use.
3. **Displacement** — greyscale + heavy blur, then central differences give the
   fabric slope. The design is sampled along that slope, so the print follows
   the folds.
4. **Blend** — the design is fit inside the print box (never stretched),
   sampled with premultiplied alpha (no halo), shaded by the fabric, then
   alpha-blended onto the shirt and clipped to its silhouette.
5. **Export** — resized to a square, flattened on white, JPEG quality 88.

## Global install

```sh
bun install -g .
# or link for development
bun link
```

```sh
tshirt-blender overlay --shirt shirt.png --design art.png --out out.jpg
```

## Using it as a library

```ts
import { compositeOverlayOntoShirt, loadShirtMaps } from 'tshirt-blender';

const maps = await loadShirtMaps('shirt.png');
const { data } = await compositeOverlayOntoShirt({
  designPath: 'art.png',
  maps,
  options: {
    size: 2000,
    opacity: 0.93,
    displace: 14,
    shade: 6,
    box: { left: 0.33, top: 0.22, width: 0.34, height: 0.32 },
  },
});
```

## Development

```sh
bun run dev       # watch build
bun run build     # bundle to dist/
bun run typecheck # tsc --noEmit
bun run lint      # biome
bun run test:run  # vitest
```
