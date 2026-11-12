#!/usr/bin/env python3
"""Local server with no-cache headers so edits show up immediately."""
import http.server,functools,os
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-cache');super().end_headers()
os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.ThreadingHTTPServer(('127.0.0.1',8765),H).serve_forever()
