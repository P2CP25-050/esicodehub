#!/bin/sh
set -e

# Start Celery worker in background
celery -A config worker --loglevel=info --concurrency=2 &

# Keep a minimal HTTP server on port 8080 for Cloud Run health checks
exec python -c "
import http.server, socketserver

class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')
    def log_message(self, *args):
        pass

with socketserver.TCPServer(('0.0.0.0', 8080), HealthHandler) as httpd:
    httpd.serve_forever()
"
