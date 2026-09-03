Cossette Texte font goes here.

Drop the Regular weight file into THIS folder using ONE of these exact names
(the CSS @font-face in index.html tries them in this order):

    CossetteTexte-Regular.woff2   <- best (smallest, fastest)
    CossetteTexte-Regular.woff
    CossetteTexte-Regular.otf     <- if you only have the desktop .otf, this works
    CossetteTexte-Regular.ttf

That's it — reload the page and every window title / label switches to Cossette
Texte. No code changes needed. Until a file is here, the text falls back to the
system sans stack (which is what you currently see).

Tip: if you have a .otf/.ttf and want the smaller .woff2, convert it at
https://cloudconvert.com/ttf-to-woff2 (or otf-to-woff2).
