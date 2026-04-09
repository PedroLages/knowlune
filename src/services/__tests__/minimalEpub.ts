/**
 * Creates a minimal valid EPUB for E2E testing.
 *
 * Uses JSZip to create a valid EPUB ZIP file structure.
 */

import JSZip from 'jszip'

/**
 * Creates a minimal valid EPUB as ArrayBuffer for testing.
 *
 * The EPUB contains:
 * - mimetype (uncompressed, must be first in the ZIP)
 * - META-INF/container.xml
 * - OEBPS/content.opf (metadata, manifest, spine)
 * - OEBPS/toc.ncx (navigation for EPUB 2.0 compatibility)
 * - OEBPS/nav.xhtml (navigation for EPUB 3.0)
 * - OEBPS/chapter1.xhtml, chapter2.xhtml, chapter3.xhtml (sample content)
 */
export async function createMinimalEpub(): Promise<ArrayBuffer> {
	const zip = new JSZip()

	// 1. mimetype file (must be uncompressed and first in the ZIP)
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

	// 2. META-INF/container.xml (points to the rootfile)
	zip.file(
		'META-INF/container.xml',
		`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
	)

	// 3. OEBPS/content.opf (metadata, manifest, spine)
	// EPUB 3.0 requires nav.xhtml in manifest with properties="nav"
	zip.file(
		'OEBPS/content.opf',
		`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test EPUB for E2E</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">test-e2e-epub-123</dc:identifier>
    <dc:creator>Test Author</dc:creator>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
    <itemref idref="chapter3"/>
  </spine>
</package>`
	)

	// 4. OEBPS/nav.xhtml (EPUB 3.0 navigation - this is what epub.js reads)
	zip.file(
		'OEBPS/nav.xhtml',
		`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="chapter1.xhtml">Chapter 1</a></li>
      <li><a href="chapter2.xhtml">Chapter 2</a></li>
      <li><a href="chapter3.xhtml">Chapter 3</a></li>
    </ol>
  </nav>
</body>
</html>`
	)

	// 5. OEBPS/toc.ncx (navigation for EPUB 2.0 compatibility)
	zip.file(
		'OEBPS/toc.ncx',
		`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="test-e2e-epub-123"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="3"/>
    <meta name="dtb:maxPageNumber" content="3"/>
  </head>
  <docTitle>
    <text>Test EPUB for E2E</text>
  </docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel>
        <text>Chapter 1</text>
      </navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-2" playOrder="2">
      <navLabel>
        <text>Chapter 2</text>
      </navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
    <navPoint id="navPoint-3" playOrder="3">
      <navLabel>
        <text>Chapter 3</text>
      </navLabel>
      <content src="chapter3.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`
	)

	// 6. OEBPS/chapter1.xhtml (actual content)
	zip.file(
		'OEBPS/chapter1.xhtml',
		`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 1</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <h1>Chapter 1</h1>
  <p>This is a test chapter for E2E testing of the EPUB reader.</p>
  <p>It contains enough content to allow epub.js to initialize and load TOC.</p>
</body>
</html>`
	)

	// 7. OEBPS/chapter2.xhtml
	zip.file(
		'OEBPS/chapter2.xhtml',
		`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 2</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <h1>Chapter 2</h1>
  <p>This is the second test chapter for E2E testing.</p>
  <p>It provides additional content for testing TOC navigation.</p>
</body>
</html>`
	)

	// 8. OEBPS/chapter3.xhtml
	zip.file(
		'OEBPS/chapter3.xhtml',
		`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Chapter 3</title>
  <meta charset="UTF-8"/>
</head>
<body>
  <h1>Chapter 3</h1>
  <p>This is the third test chapter for E2E testing.</p>
  <p>It completes the TOC structure with three chapters.</p>
</body>
</html>`
	)

	// Generate the ZIP file as ArrayBuffer
	const blob = await zip.generateAsync({ type: 'arraybuffer' })
	return blob as ArrayBuffer
}
