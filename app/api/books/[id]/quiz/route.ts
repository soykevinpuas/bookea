import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/server'
import { NextResponse } from 'next/server'

// 6.x - API para generar Quiz inteligente basado en la historia del libro
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookId } = await params
    const supabase = await createClient()

    // 1. Obtener información del libro
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('title, author, description')
      .eq('id', bookId)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Libro no encontrado' }, { status: 404 })
    }

    // 2. Generar prompt para Gemini
    const prompt = `
      Eres un experto literario de la plataforma Bookea. Tu tarea es crear un quiz de COMPRENSIÓN DE LECTURA de 5 preguntas para el libro "${book.title}" de ${book.author}.
      
      IMPORTANTE:
      - Basate en la trama real del libro si lo conoces por tu entrenamiento.
      - Si NO conoces los detalles específicos del libro, usa EXCLUSIVAMENTE esta descripción para generar las preguntas: "${book.description || 'No hay descripción disponible'}".
      - Las preguntas deben ser sobre eventos, personajes o temas específicos de la historia.
      - Las respuestas incorrectas deben ser verosímiles pero claramente falsas para quien leyó el libro.
      - Las preguntas NO deben ser genéricas (evita cosas como "¿Quién escribió el libro?" o "¿Te gustó?").
      
      Estructura del Quiz:
      1. 5 preguntas con 3 opciones cada una.
      2. Solo una opción debe ser la correcta.
      3. Formato JSON ESTRICTO:
         {
           "questions": [
             {
               "question": "¿Pregunta detallada...?",
               "options": ["Opción A", "Opción B", "Opción C"],
               "correctIndex": 0
             }
           ]
         }
      
      Idioma: Español. No incluyas nada más que el JSON.
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
  } catch (error: any) {
    console.error('[Quiz API] Error:', error)
    return NextResponse.json({ error: 'Error al generar el quiz' }, { status: 500 })
  }
}
