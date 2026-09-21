import os
import subprocess
import tempfile
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from faster_whisper import WhisperModel

app = FastAPI()
model = None

def speech_model():
    global model
    if model is None:
        model = WhisperModel(
            os.getenv("WHISPER_MODEL", "small"),
            device=os.getenv("WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        )
    return model

@app.get("/health")
def health():
    return {"ok": True, "stt": os.getenv("WHISPER_MODEL", "small"), "language": os.getenv("WHISPER_LANGUAGE", "auto"), "tts": "espeak-ng"}

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    suffix = os.path.splitext(audio.filename or "voice.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix) as source:
        source.write(await audio.read())
        source.flush()
        configured_language = os.getenv("WHISPER_LANGUAGE", "auto").strip().lower()
        segments, info = speech_model().transcribe(
            source.name,
            language=None if configured_language == "auto" else configured_language,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
            initial_prompt=(
                "MoneyPath personal finance conversation in natural Hindi, Indian English and Hinglish. "
                "Transcribe the speaker's words exactly. Common Hinglish words and phrases: hai, nahi, kya, "
                "abhi, mera, mujhe, kitna, bacha, baki, de du, karu, rupaye, paisa, savings, salary, "
                "credit card, payment, kharcha, loan, EMI, SBI, HDFC, ICICI, Axis."
            ),
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
    if not text:
        raise HTTPException(400, "No speech detected")
    return {"text": text, "language": info.language}

@app.post("/speak")
def speak(text: str = Form(...), language: str = Form("en-in")):
    if not text.strip() or len(text) > 1500:
        raise HTTPException(400, "Invalid speech text")
    voice = "hi" if language.startswith("hi") else "en-in"
    wav = subprocess.run(
        ["espeak-ng", "-v", voice, "-s", "155", "--stdout", text],
        check=True, capture_output=True,
    )
    completed = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "wav", "-i", "pipe:0", "-f", "mp3", "pipe:1"],
        input=wav.stdout, check=True, capture_output=True,
    )
    return Response(completed.stdout, media_type="audio/mpeg")
