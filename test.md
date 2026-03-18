# 🧪 BOOKEA — Testing Guide

---

## 1. FILOSOFÍA

No testeamos todo — testeamos lo que duele si falla.
Prioridad: lógica de negocio crítica > UI > todo lo demás.

---

## 2. QUÉ TESTEAR Y QUÉ NO

### ✅ Testear siempre
- Lógica de pagos (Stripe)
- Acceso a libros (quién puede leer qué)
- Descuento de stock físico al comprar
- Reset de créditos de suscripción
- Roles de usuario (admin vs user)
- Auth (login, sesión, redirecciones)

### ⬜ Testear cuando sea posible
- Componentes críticos de UI (lector, catálogo)
- Queries a Supabase
- Webhooks de Stripe

### ❌ No testear
- Estilos y Tailwind
- Animaciones
- Componentes puramente visuales

---

## 3. STACK DE TESTING

| Herramienta | Para qué |
|-------------|----------|
| **Vitest** | Tests unitarios (lógica, utils, hooks) |
| **React Testing Library** | Componentes React |
| **Playwright** | Tests E2E (flujos completos en browser) |
| **Stripe CLI** | Simular webhooks de pago |

Instalación:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright
```

---

## 4. ESTRUCTURA DE ARCHIVOS DE TEST

```
bookea/
├── __tests__/
│   ├── unit/
│   │   ├── auth.test.ts
│   │   ├── books.test.ts
│   │   ├── orders.test.ts
│   │   └── subscriptions.test.ts
│   ├── components/
│   │   ├── catalog.test.tsx
│   │   └── reader.test.tsx
│   └── e2e/
│       ├── login.spec.ts
│       ├── purchase.spec.ts
│       └── reader.spec.ts
```

---

## 5. TESTS UNITARIOS CRÍTICOS

### Auth
```typescript
// __tests__/unit/auth.test.ts
- usuario sin sesión es redirigido a /login
- usuario con role:admin puede acceder a /admin
- usuario con role:free NO puede acceder a /admin
- después de login exitoso redirige a /dashboard
```

### Acceso a libros
```typescript
// __tests__/unit/books.test.ts
- usuario free NO puede leer libro completo
- usuario suscrito SÍ puede leer sus 5 libros seleccionados
- usuario suscrito NO puede leer libros que no seleccionó
- usuario con compra permanente SÍ puede leer ese título
- usuario con compra permanente NO puede leer otros títulos
```

### Stock físico
```typescript
// __tests__/unit/orders.test.ts
- al confirmar orden, stock se descuenta en 1
- si stock = 0, no se puede crear orden física
- solo admin puede actualizar stock manualmente
```

### Suscripción
```typescript
// __tests__/unit/subscriptions.test.ts
- usuario puede seleccionar máximo 5 libros por ciclo
- al renovar, créditos se resetean a 5
- al cancelar suscripción, pierde acceso a los libros
```

---

## 6. TESTS E2E CRÍTICOS (Playwright)

### Flujo de login
```
1. Ir a /login
2. Ingresar email y password
3. Verificar redirección a /dashboard
4. Verificar que navbar muestra sesión activa
```

### Flujo de compra digital
```
1. Ir a /catalog
2. Seleccionar un libro
3. Click en "Comprar digital $49 MXN"
4. Completar pago con tarjeta de prueba Stripe
5. Verificar acceso al lector
```

### Flujo de compra física
```
1. Ir a /book/[id]
2. Click en "Comprar físico $199 MXN"
3. Llenar formulario de envío
4. Completar pago
5. Verificar que stock se descontó
6. Verificar que orden aparece en panel admin
```

### Flujo de suscripción
```
1. Ir a /pricing
2. Click en "Suscribirse $99 MXN/mes"
3. Completar pago recurrente con Stripe
4. Verificar 5 créditos disponibles
5. Seleccionar 5 libros
6. Verificar acceso al lector de esos libros
```

---

## 7. TARJETAS DE PRUEBA STRIPE

```
Pago exitoso:        4242 4242 4242 4242
Pago rechazado:      4000 0000 0000 0002
Requiere 3D Secure:  4000 0025 0000 3155

Fecha: cualquiera futura
CVC: cualquier 3 dígitos
CP: cualquier 5 dígitos
```

---

## 8. CÓMO CORRER LOS TESTS

```bash
# Tests unitarios
npm run test

# Tests unitarios en watch mode
npm run test:watch

# Tests E2E
npm run test:e2e

# Tests E2E con UI visual
npm run test:e2e:ui
```

Agregar al `package.json`:
```json
"scripts": {
  "test": "vitest",
  "test:watch": "vitest --watch",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## 9. CUÁNDO CORRER TESTS

| Momento | Qué correr |
|---------|-----------|
| Antes de cada commit | `npm run test` |
| Antes de merge a main | `npm run test` + `npm run test:e2e` |
| Antes de deploy a producción | Todo |
| Cuando el agente termina una feature | Tests relacionados a esa feature |

---

## 10. REGLA DEL AGENTE

Después de cada feature, escribe automáticamente los tests unitarios correspondientes en `__tests__/unit/[nombre].test.ts` usando Vitest. Cubre casos exitosos y casos de error.

---

*Última actualización: Marzo 2026*
*Proyecto: Bookea — bookea.mx*