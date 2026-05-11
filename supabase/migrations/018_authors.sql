CREATE TABLE IF NOT EXISTS authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT
);

ALTER TABLE books ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES authors(id);

INSERT INTO authors (name, slug)
  SELECT DISTINCT ON (lower(trim(author)))
    trim(author),
    lower(regexp_replace(trim(author), '[^a-zA-Záéíóúñ0-9]+', '-', 'g'))
  FROM books WHERE author IS NOT NULL AND trim(author) != ''
  ON CONFLICT (name) DO NOTHING;

UPDATE books b SET author_id = a.id
  FROM authors a WHERE a.name = b.author;
