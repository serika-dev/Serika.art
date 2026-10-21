# Serika autotagger

Tag predictions for uploads, in the style of
[danbooru/autotagger](https://github.com/danbooru/autotagger) — and API-compatible
with it — but running SmilingWolf's newer WD v3 taggers (ONNX), which know
far more tags and characters than Danbooru's 2022 ResNet model.

Serika.art calls it when someone picks an image on `/upload` (the form shows
suggested tags and a suggested rating), from `POST /api/v1/autotag`, and on
`POST /api/v1/upload` with `auto_tag=true`.

## Run it

```bash
docker build -t serika-autotagger autotagger
docker run -d --name serika-autotagger --restart unless-stopped -p 5000:5000 serika-autotagger
```

Then point the site at it and restart the site:

```bash
AUTOTAGGER_URL=http://<host>:5000
```

The model is downloaded into the image at build time (≈450 MB for the default
`wd-swinv2-tagger-v3`). A request takes roughly 0.2–0.5 s on a few CPU cores.

Keep port 5000 private (same host or internal network). If it has to be
reachable from elsewhere, set a shared key on both sides:

```bash
docker run ... -e API_KEY=some-long-secret serika-autotagger
AUTOTAGGER_API_KEY=some-long-secret   # on the site
```

### Using the stock Danbooru autotagger instead

```bash
docker run -d -p 5000:5000 ghcr.io/danbooru/autotagger
```

Works with the same `AUTOTAGGER_URL`. It doesn't report tag categories, so new
character tags are typed from Serika's existing tags only.

## Options

Service (`docker run -e ...`):

| Variable     | Default                          | |
|--------------|----------------------------------|-|
| `MODEL_REPO` | `SmilingWolf/wd-swinv2-tagger-v3` | Any WD v3 repo, e.g. `SmilingWolf/wd-eva02-large-tagger-v3` (better, ~3× slower). Pass as a build arg too: `--build-arg MODEL_REPO=...` |
| `THREADS`    | all cores                        | ONNX Runtime threads |
| `API_KEY`    | –                                | Require `Authorization: Bearer <key>` |

Site (`.env`):

| Variable                          | Default | |
|-----------------------------------|---------|-|
| `AUTOTAGGER_URL`                  | –       | Enables suggestions |
| `AUTOTAGGER_API_KEY`              | –       | Matches the service's `API_KEY` |
| `AUTOTAGGER_GENERAL_THRESHOLD`    | `0.35`  | Score at which a tag is pre-selected / auto-applied |
| `AUTOTAGGER_CHARACTER_THRESHOLD`  | `0.75`  | Same, for character tags |
| `AUTOTAGGER_TIMEOUT_MS`           | `20000` | |

## API

```bash
curl http://localhost:5000/evaluate -X POST -F file=@image.jpg -F threshold=0.2 -F format=json
```

```json
[{
  "filename": "image.jpg",
  "tags": { "1girl": 0.996, "hatsune_miku": 0.981, "twintails": 0.93, "rating:g": 0.88, "rating:s": 0.11, "rating:q": 0.004, "rating:e": 0.001 },
  "categories": { "1girl": "general", "hatsune_miku": "character", "twintails": "general" }
}]
```

`GET /health` → `{"status": "ok", "model": "..."}`.
