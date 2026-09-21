FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir fastapi==0.115.12 uvicorn==0.34.2 python-multipart==0.0.20 faster-whisper==1.1.1
WORKDIR /service
COPY app.py .
ENV WHISPER_MODEL=tiny WHISPER_DEVICE=cpu WHISPER_COMPUTE_TYPE=int8
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]
