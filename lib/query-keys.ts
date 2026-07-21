// Claves canonicas por dominio para que todas las vistas compartan invalidaciones.
export const queryKeys = {
  orders: {
    all: ["orders"] as const,
    user: (userId: string) => ["orders", "user", userId] as const,
    admin: ["orders", "admin"] as const,
  },
  profile: {
    summary: (userId: string) => ["profile-data", userId] as const,
    purchasedBooks: (userId: string) => ["purchased-books", userId] as const,
  },
  users: {
    admin: ["admin-users"] as const,
  },
  coins: {
    all: (userId: string) => ["user-coins", userId] as const,
    transactions: (userId: string) => ["user-coin-transactions", userId] as const,
    redemptions: (userId: string) => ["user-coin-redemptions", userId] as const,
  },
} as const;
