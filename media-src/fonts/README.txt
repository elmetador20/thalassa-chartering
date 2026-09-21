Maersk Headline (Regular + Bold), v4.000, Kontrapunkt.

Licensed to the client, who confirmed use on this site.

These TTFs are the BUILD SOURCE only. The site serves the WOFF2 conversions in
src/fonts/, which are 61% smaller (71 KB -> 28 KB each) and are what
src/app/layout.tsx loads via next/font/local.

To regenerate after replacing a TTF here:

    pip install fonttools brotli
    python -c "from fontTools.ttLib import TTFont;       f=TTFont('media-src/fonts/Maersk-Headline.ttf'); f.flavor='woff2';       f.save('src/fonts/MaerskHeadline-Regular.woff2')"

Note the family ships as two static faces only, Regular (400) and Bold (700) --
there is no Light and no Medium. layout.tsx maps the design system's 300/400/500
onto Regular and 600/700 onto Bold via explicit @font-face weight ranges.

The family has no glyph for the rupee sign (U+20B9). The site carries no rupee
figures, so this does not arise; if one is reintroduced it will fall back to
another font. It also has no arrow (U+2192), but every arrow on the site renders
inside FlowLine, which is set in IBM Plex Mono and does cover it.
