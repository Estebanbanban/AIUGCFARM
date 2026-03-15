# Pinterest Image Scraper

Scrapes Pinterest for aesthetic images by niche, downloads them, and uploads to CineRads Supabase.

## Setup

```bash
cd scripts/pinterest-scraper
bun install
bunx playwright install chromium
```

## Usage

### Single query
```bash
bun run scrape.ts --query "aesthetic desk setup education" --count 50 --category education
```

### Bulk scrape all niches (recommended)
```bash
bun run bulk-scrape.ts              # All niches
bun run bulk-scrape.ts education    # Single niche
```

### Upload to Supabase
```bash
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=xxx \
bun run upload-to-supabase.ts <admin-user-uuid>
```

## Predefined Niches
- education, business, coaching, fitness, ecommerce, tech, lifestyle

## Output
Images saved to `pinterest-images/{category}/` with metadata JSON.
