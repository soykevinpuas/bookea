import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export async function GET() {
  const configured = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
  return NextResponse.json({ configured })
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'La clave de Gemini no está configurada en el servidor',
        details: 'missing_env_var'
      }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const { word, context } = await req.json()

    if (!word) {
      return NextResponse.json({ error: 'Palabra no proporcionada' }, { status: 400 })
    }

    const prompt = `
      Eres un diccionario inteligente y contextual para una aplicación de lectura de libros llamada Bookea.
      
      Palabra a definir: "${word}"
      Contexto de la frase: "${context || 'No proporcionado'}"
      
      Instrucciones:
      1. Define la palabra basándote estrictamente en el contexto proporcionado.
      2. Si no hay contexto, da la definición más común.
      3. La respuesta debe ser corta (máximo 150 caracteres).
      4. Responde solo con la definición, sin introducciones ni frases como "La palabra significa...".
      5. Idioma: Español.
    `

    const result = await model.generateContent(prompt)
    const definition = result.response.text().trim()

    return NextResponse.json({ definition })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({
      error: 'Error al obtener la definición',
      details: message
    }, { status: 500 })
  }
}
