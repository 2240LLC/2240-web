Self-hosted fonts for 2240
==========================

index.html loads the display face "Chicago FLF" from this folder first, and
falls back to a CDN until the files below are present.

To finish self-hosting, download these two files into this /fonts folder
(keep the exact filenames):

  ChicagoFLF.woff2
    https://cdn.jsdelivr.net/gh/sakofchit/system.css@main/fonts/ChicagoFLF.woff2

  ChicagoFLF.woff
    https://cdn.jsdelivr.net/gh/sakofchit/system.css@main/fonts/ChicagoFLF.woff

For example, from the repo root:

  curl -L -o fonts/ChicagoFLF.woff2 https://cdn.jsdelivr.net/gh/sakofchit/system.css@main/fonts/ChicagoFLF.woff2
  curl -L -o fonts/ChicagoFLF.woff  https://cdn.jsdelivr.net/gh/sakofchit/system.css@main/fonts/ChicagoFLF.woff

Once both files are here and committed, the page uses the local copies and the
CDN line in the @font-face (in index.html) can be removed.

Chicago FLF is bundled by the open-source project system.css
(https://github.com/sakofchit/system.css).
