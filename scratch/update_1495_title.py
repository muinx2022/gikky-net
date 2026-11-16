import subprocess

code = """
from core.models.dien_dan import Mach
from core.revalidate import lam_moi_mach

m = Mach.objects.get(id=1495)
print('OLD TITLE:', m.title)
m.title = m.title.replace('[Nhật ký] ', '').replace('[Nhật kí] ', '').strip()
m.save(update_fields=['title'])
lam_moi_mach(m)
print('NEW TITLE:', m.title)
"""

p = subprocess.run(
    ["ssh", "vps-muinx", "docker compose -p gikkynet exec -T api python manage.py shell"],
    input=code,
    capture_output=True,
    text=True,
    encoding="utf-8"
)
print("STDOUT:", p.stdout)
if p.stderr:
    print("STDERR:", p.stderr)
