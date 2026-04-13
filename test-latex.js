const formData = new FormData();
const latex = `\\documentclass{article}\\begin{document}Hello world\\end{document}`;
formData.append('filename[]', 'document.tex');
formData.append('filecontents[]', latex);
formData.append('engine', 'pdflatex');
formData.append('return', 'pdf');

fetch('https://texlive.net/cgi-bin/latexcgi', {
  method: 'POST',
  body: formData,
})
.then(async res => {
  console.log(res.status, res.headers.get('content-type'));
  if (res.ok) {
     if (res.headers.get('content-type') === 'application/pdf') {
         console.log('PDF received');
     } else {
         console.log(await res.text());
     }
  }
})
.catch(console.error);
