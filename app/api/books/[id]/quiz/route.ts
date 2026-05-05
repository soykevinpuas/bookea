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
      Eres un experto literario. Crea un quiz de comprensión de lectura de 5 preguntas para el libro "${book.title}" de ${book.author}.
      
      Información del libro: ${book.description || 'No hay descripción disponible'}
      
      Requisitos del Quiz:
      1. Las preguntas deben ser sobre la trama, personajes o temas del libro.
      2. Cada pregunta debe tener 3 opciones.
      3. Solo una opción debe ser la correcta.
      4. El formato de respuesta debe ser ESTRICTAMENTE un JSON válido con esta estructura:
         {
           "questions": [
             {
               "question": "¿Pregunta...?",
               "options": ["Opción A", "Opción B", "Opción C"],
               "correctIndex": 0
             }
           ]
         }
      5. Idioma: Español.
      6. No incluyas explicaciones ni texto fuera del JSON.
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
