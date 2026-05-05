// 6.x - Quiz de finalización de lectura para otorgar monedas
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, X, Award, Loader2 } from 'lucide-react'

interface BookCompletionQuizProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
  bookTitle: string
  bookId: string
}

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
}

const DEFAULT_QUESTIONS: QuizQuestion[] = [
  { question: '¿De qué trataba principalmente el libro?', options: ['No recuerdo', 'Lo leí por completo', 'Solo vi algunas partes'], correctIndex: 1 },
  { question: '¿Cuál era el tema central?', options: ['No estoy seguro', 'El desarrollo del argumento principal', 'Solo el inicio'], correctIndex: 1 },
  { question: '¿Qué opinas de la conclusión?', options: ['No la leí', 'Me pareció coherente con el resto', 'N/A'], correctIndex: 1 },
  { question: '¿Recomendarías este libro?', options: ['Sí', 'No', 'Tal vez'], correctIndex: 0 },
  { question: '¿Qué parte te gustó más?', options: ['El inicio', 'El desarrollo', 'La conclusión'], correctIndex: 1 },
]

export function BookCompletionQuiz({ isOpen, onClose, onComplete, bookTitle, bookId }: BookCompletionQuizProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>(DEFAULT_QUESTIONS)
  const [isLoading, setIsLoading] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [finished, setFinished] = useState(false)
  const [allCorrect, setAllCorrect] = useState(false)

  useEffect(() => {
    if (isOpen && bookId) {
      const fetchQuiz = async () => {
        setIsLoading(true)
        try {
          const res = await fetch(`/api/books/${bookId}/quiz`)
          const data = await res.json()
          if (data.questions && data.questions.length > 0) {
            setQuestions(data.questions)
          }
        } catch (err) {
          console.error("Error fetching quiz questions, using defaults:", err)
          setQuestions(DEFAULT_QUESTIONS)
        } finally {
          setIsLoading(false)
        }
      }
      fetchQuiz()
    }
  }, [isOpen, bookId])

  if (!isOpen) return null

  const q = questions[currentQuestion]

  const handleAnswer = (optionIndex: number) => {
    const newAnswers = [...answers, optionIndex]
    setAnswers(newAnswers)

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      // Quiz finished
      const correctCount = newAnswers.filter((ans, i) => ans === questions[i].correctIndex).length
      const passed = correctCount >= 3 // Need 3/5 to pass
      setAllCorrect(passed)
      setFinished(true)

      if (passed) {
        onComplete()
      }
    }
  }

  const handleClose = () => {
    onClose()
    setCurrentQuestion(0)
    setAnswers([])
    setFinished(false)
    setAllCorrect(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-md bg-white dark:bg-[#151515] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {finished ? 'Resultado' : 'Verificación de lectura'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Generando preguntas inteligentes...</p>
            </div>
          ) : !finished ? (
            <>
              {/* Progress */}
              <div className="flex items-center gap-2">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i < currentQuestion ? 'bg-gray-900 dark:bg-white' : i === currentQuestion ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pregunta {currentQuestion + 1} de {questions.length}
              </p>

              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{q.question}</h3>

              {/* Options */}
              <div className="space-y-2">
                {q.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:border-gray-300 dark:hover:border-white/20 transition-all"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center space-y-4 py-4">
              {allCorrect ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
                    <Award className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">¡Felicidades!</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Completaste <span className="font-semibold">"{bookTitle}"</span>. Has ganado una <span className="text-amber-600 dark:text-amber-400 font-semibold">moneda de bronce</span> 🪙
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold hover:opacity-90 transition-all"
                  >
                    <CheckCircle className="w-4 h-4" />
                    ¡Genial!
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-500/10 flex items-center justify-center">
                    <X className="w-8 h-8 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No pudimos confirmar tu lectura</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Termina de leer el libro y vuelve a intentarlo.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-bold hover:opacity-90 transition-all"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
