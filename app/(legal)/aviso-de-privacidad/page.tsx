import Link from 'next/link'

export default function AvisoDePrivacidadPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <Link href="/" className="text-blue-600 dark:text-blue-400 text-sm hover:underline mb-8 inline-block">&larr; Volver al inicio</Link>
        
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-8">Aviso de Privacidad</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Última actualización: Mayo 2026</p>

        <div className="space-y-8 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Identidad y domicilio del responsable</h2>
            <p><strong>Bookea</strong> (en adelante, &ldquo;el Responsable&rdquo;) es responsable del tratamiento de sus datos personales. Al utilizar nuestros servicios, usted acepta los términos de este aviso.</p>
            <p className="mt-2">Para cualquier comunicación relacionada con este aviso, puede contactarnos a través del correo: <strong>privacidad@bookea.mx</strong></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Datos personales que recabamos</h2>
            <p>Para las finalidades descritas en este aviso, podemos recabar las siguientes categorías de datos personales:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Datos de identificación: nombre, correo electrónico</li>
              <li>Datos de facturación: nombre fiscal, RFC (cuando aplique)</li>
              <li>Datos de envío: dirección, ciudad, estado, código postal, teléfono</li>
              <li>Datos de pago: se procesan a través de Stripe; no almacenamos números de tarjeta ni datos bancarios</li>
              <li>Datos de uso: libros leídos, progreso de lectura, reseñas, rachas, preferencias de lectura</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Finalidades del tratamiento</h2>
            <p className="font-semibold mt-2">Finalidades primarias (necesarias):</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Proveer acceso a la plataforma de lectura y sus funcionalidades</li>
              <li>Procesar pagos y gestionar suscripciones</li>
              <li>Gestionar órdenes de libros físicos</li>
              <li>Dar mantenimiento y soporte técnico a la cuenta</li>
              <li>Cumplir con obligaciones fiscales y administrativas</li>
            </ul>
            <p className="font-semibold mt-4">Finalidades secundarias (con su consentimiento):</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Enviar recomendaciones personalizadas de lectura</li>
              <li>Notificar sobre nuevos títulos, promociones o eventos</li>
              <li>Generar estadísticas agregadas de uso para mejorar el servicio</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Transferencia de datos</h2>
            <p>Sus datos personales pueden ser compartidos con:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Stripe:</strong> para el procesamiento de pagos (sus datos de pago son manejados directamente por Stripe bajo su propio aviso de privacidad)</li>
              <li><strong>Supabase:</strong> como proveedor de infraestructura de base de datos y autenticación</li>
              <li><strong>Vercel:</strong> como proveedor de hosting</li>
              <li><strong>Google Cloud (Gemini AI):</strong> para funcionalidades opcionales del diccionario inteligente</li>
            </ul>
            <p className="mt-2">No transferimos sus datos personales a otros terceros sin su consentimiento, salvo las excepciones previstas en la Ley.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Derechos ARCO</h2>
            <p>Usted tiene derecho a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Acceso:</strong> conocer qué datos personales tenemos y cómo los usamos</li>
              <li><strong>Rectificación:</strong> solicitar la corrección de datos inexactos</li>
              <li><strong>Cancelación:</strong> solicitar la eliminación de sus datos</li>
              <li><strong>Oposición:</strong> oponerse al tratamiento de sus datos para fines específicos</li>
            </ul>
            <p className="mt-2">Para ejercer sus derechos ARCO, envíe su solicitud a <strong>privacidad@bookea.mx</strong> con el asunto &ldquo;Derechos ARCO&rdquo;. Le responderemos en un plazo máximo de 20 días hábiles.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. Limitación y revocación del consentimiento</h2>
            <p>Usted puede revocar el consentimiento que nos haya otorgado para el tratamiento de sus datos personales en cualquier momento. La revocación podrá implicar que no podamos seguir prestando el servicio.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Uso de cookies y tecnologías similares</h2>
            <p>Utilizamos cookies estrictamente necesarias para el funcionamiento de la plataforma (sesión de usuario, preferencias de lectura). No utilizamos cookies de rastreo publicitario ni compartimos datos con redes de anuncios.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. Seguridad de la información</h2>
            <p>Implementamos medidas de seguridad técnicas, administrativas y físicas para proteger sus datos personales contra daño, pérdida, alteración, destrucción o uso no autorizado. El acceso a los datos está restringido a personal autorizado mediante mecanismos de autenticación y control de acceso.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">9. Cambios al aviso de privacidad</h2>
            <p>Nos reservamos el derecho de modificar este aviso en cualquier momento. Los cambios entrarán en vigor a partir de su publicación en la plataforma. Le recomendamos revisar periódicamente esta página.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
