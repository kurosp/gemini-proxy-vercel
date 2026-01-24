from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import asyncio
import edge_tts

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        try:
            qs = parse_qs(urlparse(self.path).query)
            text = (qs.get("text", [""]) or [""])[0].strip()
            voice = (qs.get("voice", ["vi-VN-HoaiMyNeural"]) or ["vi-VN-HoaiMyNeural"])[0]
            rate = (qs.get("rate", ["+0%"]) or ["+0%"])[0]
            pitch = (qs.get("pitch", ["+0Hz"]) or ["+0Hz"])[0]

            if not text:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"error":"missing text"}')
                return

            audio_bytes = asyncio.run(self._synth(text, voice, rate, pitch))

            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(audio_bytes)

        except Exception as e:
            self.send_response(500)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            msg = ("{\"error\":\"tts failed\",\"details\":\"" + str(e).replace("\"","'") + "\"}").encode("utf-8")
            self.wfile.write(msg)

    async def _synth(self, text: str, voice: str, rate: str, pitch: str) -> bytes:
        communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        return b"".join(chunks)
