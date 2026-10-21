FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the model into the image so containers start without downloading it.
# Bigger/more accurate: SmilingWolf/wd-eva02-large-tagger-v3 (slower on CPU).
ARG MODEL_REPO=SmilingWolf/wd-swinv2-tagger-v3
ENV MODEL_REPO=${MODEL_REPO}
RUN python -c "import os; from huggingface_hub import hf_hub_download as d; r = os.environ['MODEL_REPO']; d(r, 'model.onnx'); d(r, 'selected_tags.csv')"

COPY app.py .

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health')"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
