import Link from 'next/link'

// TerminosPage: documento legal estatico que define reglas de uso, pagos y acceso.
export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        <Link href="/" className="text-blue-600 dark:text-blue-400 text-sm hover:underline mb-8 inline-block">&larr; Volver al inicio</Link>

        {/* Encabezado legal: la fecha permite rastrear cambios de condiciones. */}
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-8">Términos y Condiciones de Servicio</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">Última actualización: Mayo 2026</p>

        {/* Cuerpo legal por bloques; no depende de datos externos ni APIs. */}
        <div className="space-y-8 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Aceptación de los términos</h2>
            <p>Al registrarse, acceder o utilizar la plataforma Bookea (en adelante, &ldquo;la Plataforma&rdquo;), usted acepta estar sujeto a estos Términos y Condiciones de Servicio. Si no está de acuerdo con alguno de ellos, no utilice la Plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Descripción del servicio</h2>
            <p>Bookea es una plataforma de lectura digital que ofrece:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Acceso a libros digitales (EPUB) mediante suscripción mensual o compra permanente</li>
              <li>Venta de libros físicos con envío a domicilio en México</li>
              <li>Herramientas de lectura: progreso, subrayados, notas, diccionario inteligente</li>
              <li>Comunidad de lectores: reseñas, calificaciones y rachas de lectura</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Cuentas de usuario</h2>
            <p>Para utilizar la Plataforma, debe registrarse con un correo electrónico válido y crear una contraseña. Usted es responsable de mantener la confidencialidad de su cuenta y de todas las actividades que ocurran bajo ella.</p>
            <p className="mt-2">Bookea se reserva el derecho de suspender o cancelar cuentas que violen estos términos o que presenten actividad fraudulenta.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Planes y suscripciones</h2>
            <div className="space-y-3 mt-2">
              <div>
                <p className="font-semibold">4.1 Plan Free</p>
                <p>Los usuarios gratuitos pueden acceder a una vista previa limitada del catálogo. Bookea puede cambiar el alcance del plan Free en cualquier momento.</p>
              </div>
              <div>
                <p className="font-semibold">4.2 Suscripción mensual ($99 MXN)</p>
                <p>Incluye acceso completo al catálogo digital mientras la suscripción esté activa. La suscripción se renueva automáticamente cada mes. Puede cancelar en cualquier momento desde el portal de facturación de Stripe; el acceso continuará hasta el final del período pagado.</p>
              </div>
              <div>
                <p className="font-semibold">4.3 Compra permanente</p>
                <p>Otorga acceso de por vida al libro adquirido. No incluye descarga del archivo EPUB, solo lectura en línea dentro de la Plataforma.</p>
              </div>
              <div>
                <p className="font-semibold">4.4 Compra física</p>
                <p>Incluye el envío del libro físico a la dirección proporcionada. Los costos de envío pueden variar según la ubicación. Los tiempos de entrega dependen de la paquetería utilizada.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Facturación y pagos</h2>
            <p>Todos los pagos se procesan a través de Stripe. No almacenamos información de tarjetas de crédito o débito. Los precios están expresados en pesos mexicanos (MXN) e incluyen impuestos aplicables.</p>
            <p className="mt-2">Para emitir una factura (CFDI), el usuario debe solicitarla a <strong>facturacion@bookea.mx</strong> dentro de los primeros 30 días posteriores al pago, proporcionando sus datos fiscales completos.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. Política de reembolsos</h2>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Suscripciones:</strong> No se realizan reembolsos por meses parciales. Puede cancelar en cualquier momento y el acceso continuará hasta el final del período pagado.</li>
              <li><strong>Compras permanentes:</strong> No se aceptan reembolsos una vez que el acceso al libro digital ha sido otorgado.</li>
              <li><strong>Libros físicos:</strong> Si el libro llega en malas condiciones, debe reportarlo dentro de los 7 días posteriores a la entrega para coordinar un cambio o reembolso.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Propiedad intelectual</h2>
            <p>Todo el contenido disponible en Bookea está protegido por derechos de autor. Los libros son proporcionados bajo licencia de los titulares de derechos correspondientes. El usuario se obliga a no reproducir, distribuir, modificar o compartir el contenido fuera de la Plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. Limitación de responsabilidad</h2>
            <p>Bookea no será responsable por daños indirectos, pérdida de datos, interrupción del servicio o cualquier otro perjuicio derivado del uso de la Plataforma. La Plataforma se proporciona &ldquo;tal cual&rdquo;, sin garantías de disponibilidad continua o libre de errores.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">9. Ley aplicable y jurisdicción</h2>
            <p>Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia derivada de su interpretación o cumplimiento, las partes se someten a la jurisdicción de los tribunales de la Ciudad de México.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">10. Contacto</h2>
            <p>Para cualquier duda o queja relacionada con estos términos, contáctenos en <strong>soporte@bookea.mx</strong></p>
          </section>
        </div>
      </div>
    </div>
  )
}
