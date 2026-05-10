import { Resend } from 'resend'

const FROM = 'Bookea <noreply@bookea.mx>'

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    const resend = getResend()
    if (!resend) return
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Bienvenido a Bookea',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0a0a0a; color: #e5e7eb;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -1px; color: #ffffff;">
              <span style="color: #a855f7;">B</span>ookea
            </h1>
          </div>
          <h2 style="color: #ffffff; font-size: 20px;">¡Bienvenido${name ? `, ${name}` : ''}!</h2>
          <p style="line-height: 1.6; color: #9ca3af;">
            Has creado tu cuenta en Bookea. Ya puedes explorar el catálogo, leer libros digitales y usar todas las herramientas de lectura.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://bookea.mx'}/catalog" style="display: inline-block; padding: 12px 32px; background: #9333ea; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600;">
              Explorar catálogo
            </a>
          </div>
          <p style="line-height: 1.6; color: #9ca3af; font-size: 14px;">
            Si tienes alguna duda, responde a este correo o escríbenos a soporte@bookea.mx
          </p>
          <hr style="border: none; border-top: 1px solid #1f2937; margin: 32px 0;" />
          <p style="color: #4b5563; font-size: 12px; text-align: center;">
            Bookea &mdash; Tu biblioteca digital en México
          </p>
        </div>
      `,
    })
  } catch (error: unknown) {
    console.warn('[Email] Error al enviar bienvenida:', error instanceof Error ? error.message : error)
  }
}
