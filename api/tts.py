from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from io import BytesIO
from gtts import gTTS

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
            lang = (qs.get("lang", ["vi"]) or ["vi"])[0]

            if not text:
                self.send_response(400)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(b'{"error":"missing text"}')
                return

            # gTTS trả mp3
            mp3_fp = BytesIO()
            tts = gTTS(text=text, lang=lang, slow=False)
            tts.write_to_fp(mp3_fp)
            audio_bytes = mp3_fp.getvalue()

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
            msg = ("{\"error\":\"tts failed\",\"details\":\"" + str(e).replace('\"', \"'\") + "\"}").encode("utf-8")
            self.wfile.write(msg)
