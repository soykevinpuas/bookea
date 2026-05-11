CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  photo_url TEXT
);

ALTER TABLE books ADD COLUMN author_id UUID REFERENCES authors(id);

INSERT INTO authors (name, slug)
  SELECT DISTINCT author, lower(regexp_replace(author, '[^a-zA-Záéíóúñ0-9]+', '-', 'g'))
  FROM books WHERE author IS NOT NULL;

UPDATE books b SET author_id = a.id
  FROM authors a WHERE a.name = b.author;
