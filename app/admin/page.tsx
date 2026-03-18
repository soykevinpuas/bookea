import Link from "next/link";

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Panel de Administración</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/books"
          className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold mb-2">Libros</h2>
          <p className="text-gray-500">Gestionar catálogo de libros</p>
        </Link>
        <Link
          href="/admin/orders"
          className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold mb-2">Órdenes</h2>
          <p className="text-gray-500">Ver órdenes físicas</p>
        </Link>
        <Link
          href="/admin/users"
          className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <h2 className="text-lg font-semibold mb-2">Usuarios</h2>
          <p className="text-gray-500">Gestionar usuarios</p>
        </Link>
      </div>
    </div>
  );
}
