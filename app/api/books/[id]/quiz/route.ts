import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/server'
import { NextResponse } from 'next/server'

// API para generar Quiz inteligente basado en la historia del libro
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params
    const supabase = await createClient()

    // Obtener información del libro
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('title, author, description')
      .eq('id', bookId)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 })
    }

    // Generar prompt para Gemini
    const prompt = `
      Eres un experto literario crítico de la plataforma Bookea. Tu tarea es crear un quiz de ALTO NIVEL de comprensión de lectura para el libro "${book.title}" de ${book.author}.

      IMPORTANTE:
      - Tienes prohibido usar preguntas genéricas como "¿Quién escribió el libro?", "¿Te gustó?", "¿De qué trata?".
      - Las preguntas deben ser ESPECÍFICAS sobre la trama, giros narrativos, nombres de personajes secundarios o eventos clave.
      - Si conoces el libro por tu entrenamiento, usa detalles que solo alguien que leyó el libro sabría.
      - Si NO conoces los detalles específicos, analiza profundamente esta descripción: "${book.description || 'No hay descripción disponible'}".
      - En caso de usar la descripción, no te limites a repetir palabras; infiere situaciones basadas en el género del libro.
      - Las respuestas incorrectas (distractores) deben ser muy verosímiles, no pongas opciones como "No sé" o "N/A".

      Estructura del Quiz:
      1. EXACTAMENTE 5 preguntas.
      2. 3 opciones por pregunta.
      3. Una sola opción correcta.
      4. Formato JSON ESTRICTO:
         {
           "questions": [
             {
               "question": "¿Pregunta muy específica...?",
               "options": ["Opción A", "Opción B", "Opción C"],
               "correctIndex": 0
             }
           ]
         }

      Idioma: Español. Responde ÚNICAMENTE con el objeto JSON.
    `

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Limpiar respuesta de Gemini (a veces incluye bloques de código markdown)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    const quizData = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    if (!quizData || !quizData.questions) {
      throw new Error('Formato de quiz inválido')
    }

    return NextResponse.json(quizData)
  } catch (error: unknown) {
    console.error('[Quiz API] Error:', error)
    return NextResponse.json({ error: 'Error al generar el quiz' }, { status: 500 })
  }
}
