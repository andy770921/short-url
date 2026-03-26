-- Create the urls table for the URL shortener feature
CREATE TABLE urls (
  "shortUrl" TEXT PRIMARY KEY,
  "longUrl" TEXT NOT NULL,
  "creationTime" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expirationTime" TIMESTAMPTZ
);

-- Index on longUrl for deduplication lookups (idempotent creation)
CREATE INDEX idx_urls_long_url ON urls ("longUrl");
