import { NextResponse } from 'next/server'

type DictionaryDefinition = {
  definition?: string
  example?: string
}

type DictionaryMeaning = {
  partOfSpeech?: string
  definitions?: DictionaryDefinition[]
}

type DictionaryEntry = {
  word?: string
  meanings?: DictionaryMeaning[]
}

type WiktionaryParseResponse = {
  parse?: {
    title?: string
    wikitext?: {
      '*'?: string
    }
  }
}

const normalizeWord = (value: string) => {
  const match = value.replace(/\s+/g, ' ').trim().match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/)
  return match?.[0]?.toLowerCase() || ''
}

const stripWikitext = (value: string) => {
  let text = value

  for (let index = 0; index < 4; index += 1) {
    text = text.replace(/\{\{[^{}|]+\|([^{}|]+)(?:\|[^{}]*)?\}\}/g, '$1')
    text = text.replace(/\{\{[^{}]+\}\}/g, '')
  }

  return text
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const getWiktionaryDefinition = async (word: string) => {
  const response = await fetch(
    `https://es.wiktionary.org/w/api.php?action=parse&format=json&page=${encodeURIComponent(word)}&prop=wikitext`,
    {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Bookea/1.0 (dictionary lookup)',
      },
    }
  )

  if (!response.ok) return null

  const data = (await response.json()) as WiktionaryParseResponse
  const wikitext = data.parse?.wikitext?.['*']
  if (!wikitext) return null

  const spanishStart = wikitext.indexOf('== {{lengua|es}} ==')
  const spanishText = spanishStart >= 0 ? wikitext.slice(spanishStart) : wikitext
  const definition = spanishText.match(/;\s*1(?:\s+\{\{[^}]+\}\})?\s*:\s*([^\n]+)/)?.[1]

  return definition ? stripWikitext(definition) : null
}

const getDictionaryApiDefinition = async (word: string) => {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/es/${encodeURIComponent(word)}`,
    {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }
  )

  if (!response.ok) return null

  const entries = (await response.json()) as DictionaryEntry[]
  return entries
    .flatMap((entry) => entry.meanings || [])
    .flatMap((meaning) => meaning.definitions || [])
    .find((item) => item.definition?.trim())?.definition?.trim() || null
}

export async function GET() {
  return NextResponse.json({ configured: true, provider: 'Wikcionario' })
}

export async function POST(req: Request) {
  try {
    const { word } = await req.json()
    const normalizedWord = normalizeWord(String(word || ''))

    if (!normalizedWord) {
      return NextResponse.json({ error: 'Palabra no proporcionada' }, { status: 400 })
    }

    const definition = await getWiktionaryDefinition(normalizedWord)
      || await getDictionaryApiDefinition(normalizedWord)

    if (!definition) {
      return NextResponse.json(
        { error: 'No encontré esa palabra en el diccionario' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      word: normalizedWord,
      definition,
      source: 'Wikcionario',
      sourceUrl: `https://es.wiktionary.org/wiki/${encodeURIComponent(normalizedWord)}`,
    })
  } catch {
    return NextResponse.json(
      { error: 'Error de conexión con el diccionario' },
      { status: 502 }
    )
  }
}
