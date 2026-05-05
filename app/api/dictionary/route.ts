import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

// 4.x - API para diccionario contextual usando Gemini 1.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function POST(req: Request) {
  try {
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
  } catch (error: any) {
    console.error('[Dictionary API] Error:', error)
    return NextResponse.json({ error: 'Error al obtener la definición' }, { status: 500 })
  }
}
