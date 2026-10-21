"""Serika autotagger.

A drop-in replacement for the Danbooru autotagger web API
(https://github.com/danbooru/autotagger) backed by SmilingWolf's WD v3 taggers
(ONNX, CPU or CUDA). Same request/response shape:

    curl http://localhost:5000/evaluate -X POST -F file=@image.jpg -F format=json

    [{"filename": "image.jpg",
      "tags": {"1girl": 0.998, "solo": 0.97, ..., "rating:s": 0.81},
      "categories": {"1girl": "general", "hatsune_miku": "character", ...}}]

`categories` is an extra field the Danbooru service doesn't send; clients that
don't know about it can ignore it.
"""

import csv
import io
import os
from contextlib import asynccontextmanager
from typing import List

import numpy as np
import onnxruntime as ort
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from huggingface_hub import hf_hub_download
from PIL import Image, ImageOps

MODEL_REPO = os.getenv("MODEL_REPO", "SmilingWolf/wd-swinv2-tagger-v3")
API_KEY = os.getenv("API_KEY", "")
MAX_FILES = int(os.getenv("MAX_FILES", "8"))
MAX_BYTES = int(os.getenv("MAX_BYTES", str(50 * 1024 * 1024)))

# selected_tags.csv category ids
CATEGORY_NAMES = {0: "general", 4: "character", 9: "rating"}
# WD rating labels → Danbooru autotagger keys
RATING_KEYS = {
    "general": "rating:g",
    "sensitive": "rating:s",
    "questionable": "rating:q",
    "explicit": "rating:e",
}


class Tagger:
    def __init__(self, repo: str):
        model_path = hf_hub_download(repo, "model.onnx")
        tags_path = hf_hub_download(repo, "selected_tags.csv")

        self.names: List[str] = []
        self.categories: List[str] = []
        with open(tags_path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                category = CATEGORY_NAMES.get(int(row["category"]), "general")
                name = row["name"]
                if category == "rating":
                    name = RATING_KEYS.get(name, f"rating:{name}")
                self.names.append(name)
                self.categories.append(category)
        self.rating_indexes = [i for i, c in enumerate(self.categories) if c == "rating"]

        options = ort.SessionOptions()
        threads = int(os.getenv("THREADS", "0"))
        if threads > 0:
            options.intra_op_num_threads = threads
        available = ort.get_available_providers()
        providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in available]
        self.session = ort.InferenceSession(model_path, options, providers=providers)

        model_input = self.session.get_inputs()[0]
        self.input_name = model_input.name
        self.size = int(model_input.shape[1])  # NHWC: [batch, size, size, 3]
        self.output_name = self.session.get_outputs()[0].name

    def prepare(self, data: bytes) -> np.ndarray:
        image = Image.open(io.BytesIO(data))
        image = ImageOps.exif_transpose(image)
        # Transparent areas → white, as in the training data
        image = image.convert("RGBA")
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.alpha_composite(image)
        image = background.convert("RGB")

        # Pad to a square, then resize to the model's input size
        side = max(image.size)
        square = Image.new("RGB", (side, side), (255, 255, 255))
        square.paste(image, ((side - image.width) // 2, (side - image.height) // 2))
        if side != self.size:
            square = square.resize((self.size, self.size), Image.BICUBIC)

        # The WD models expect BGR float32 in 0–255
        return np.asarray(square, dtype=np.float32)[:, :, ::-1]

    def predict(self, images: List[bytes], threshold: float, limit: int):
        batch = np.stack([self.prepare(data) for data in images])
        probabilities = self.session.run([self.output_name], {self.input_name: batch})[0]

        results = []
        for scores in probabilities:
            tags, categories = {}, {}
            for i in np.argsort(-scores):
                if self.categories[i] == "rating":
                    continue
                score = float(scores[i])
                if score < threshold or len(tags) >= limit:
                    break
                tags[self.names[i]] = score
                categories[self.names[i]] = self.categories[i]
            # Ratings are always reported, like the Danbooru service does when above threshold
            for i in self.rating_indexes:
                tags[self.names[i]] = float(scores[i])
            results.append((tags, categories))
        return results


tagger: Tagger | None = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global tagger
    tagger = Tagger(MODEL_REPO)
    yield


app = FastAPI(title="Serika autotagger", lifespan=lifespan)


def check_api_key(authorization: str = Header(default="")):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@app.get("/")
@app.get("/health")
def health():
    return {"status": "ok" if tagger else "loading", "model": MODEL_REPO}


@app.post("/evaluate", dependencies=[Depends(check_api_key)])
def evaluate(
    file: List[UploadFile] = File(...),
    threshold: float = Form(0.1),
    limit: int = Form(50),
    format: str = Form("json"),
):
    if tagger is None:
        raise HTTPException(status_code=503, detail="Model is still loading")
    if format != "json":
        raise HTTPException(status_code=400, detail="Only format=json is supported")
    if len(file) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"At most {MAX_FILES} files per request")

    blobs = []
    for upload in file:
        data = upload.file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"{upload.filename} is too large")
        blobs.append(data)

    try:
        predictions = tagger.predict(blobs, threshold=max(0.0, threshold), limit=max(1, min(limit, 500)))
    except Exception as exc:  # unreadable/corrupt image
        raise HTTPException(status_code=400, detail=f"Could not read image: {exc}") from exc

    return [
        {"filename": upload.filename, "tags": tags, "categories": categories}
        for upload, (tags, categories) in zip(file, predictions)
    ]
