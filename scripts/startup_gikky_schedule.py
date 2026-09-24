import time
import subprocess
import sys
import sqlite3
from pathlib import Path

# Wait for Antigravity desktop app and language server to initialize
time.sleep(25)

agentapi_bat = Path(r"C:\Users\Ng Xuan Mui\.gemini\antigravity\bin\agentapi.bat")
db_path = Path(r"C:\Users\Ng Xuan Mui\.gemini\antigravity\conversation_summaries.db")

conv_id = "d35dd1b4-ddf2-4707-b498-6a0df332e9fa"
try:
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        c = conn.cursor()
        c.execute("SELECT conversation_id FROM conversation_summaries WHERE workspace_uris LIKE '%gikky%' AND conversation_id != 'f5aee8f8-49d6-4ec4-a89b-1c6cd4cbb960' ORDER BY last_modified_time DESC LIMIT 1")
        row = c.fetchone()
        if row and row[0]:
            conv_id = row[0]
        conn.close()
except Exception:
    pass

msg = "Máy tính vừa khởi động lại: Hãy kiểm tra danh sách tác vụ nền bằng manage_task list. Nếu bộ 9 lịch cron đăng bài gikky vẫn đang chạy bình thường thì ghi nhận xác nhận; nếu chưa chạy hoặc bị thiếu lịch nào, hãy tự động kích hoạt lại đầy đủ."

cmd = [str(agentapi_bat), "send-message", conv_id, msg]
try:
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    log_dir = Path(r"C:\Users\Ng Xuan Mui\.gemini\antigravity\scratch")
    log_dir.mkdir(parents=True, exist_ok=True)
    with open(log_dir / "startup_sync.log", "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Sent sync message to {conv_id}. Returncode: {res.returncode}\n")
except Exception as e:
    log_dir = Path(r"C:\Users\Ng Xuan Mui\.gemini\antigravity\scratch")
    log_dir.mkdir(parents=True, exist_ok=True)
    with open(log_dir / "startup_sync.log", "a", encoding="utf-8") as f:
        f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Error: {e}\n")
