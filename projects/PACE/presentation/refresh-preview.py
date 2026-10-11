from pathlib import Path
import json,re,base64,io
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
p=Path('presentation'); n=len(json.loads((p/'content.json').read_text(encoding='utf-8')))
files=[p/'previews'/f'{i:02}.png' for i in range(1,n+1)]
f=p/'preview.html'; s=f.read_text(encoding='utf-8'); pages=['data:image/png;base64,'+base64.b64encode(q.read_bytes()).decode() for q in files]; s=re.sub(r'const pages=.*?;let n=0;', 'const pages='+json.dumps(pages)+';let n=0;',s,flags=re.S); f.write_text(s,encoding='utf-8')
for name,compact in [('완성본/PACE_나의앱프로젝트_고화질보관용_김라연.pdf',False)]:
 c=canvas.Canvas(str(p/name),pagesize=(960,540))
 for q in files:
  if compact:
   im=Image.open(q).convert('RGB'); im.thumbnail((1920,1080)); b=io.BytesIO(); im.save(b,format='JPEG',quality=90); b.seek(0); source=ImageReader(b)
  else: source=ImageReader(str(q))
  c.drawImage(source,0,0,width=960,height=540); c.showPage()
 c.save()
print('Updated preview and PDFs:',n,'slides')
