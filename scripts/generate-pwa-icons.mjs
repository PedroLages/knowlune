import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync('public/favicon.svg')

const sizes = [
  { size: 192, name: 'public/pwa-192x192.png' },
  { size: 512, name: 'public/pwa-512x512.png' },
  { size: 180, name: 'public/apple-touch-icon-180x180.png' },
]

for (const { size, name } of sizes) {
  await sharp(svg).resize(size, size).png().toFile(name)
  console.log(`Generated ${name}`)
}
