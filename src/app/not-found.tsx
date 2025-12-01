import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-6">
      <div className="max-w-lg w-full rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">404</p>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">Page Not Found</h1>
        <p className="mt-3 text-base text-gray-600">
          The page you tried to open does not exist or has been moved. Try returning to the dashboard or choose another
          section from the sidebar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center rounded-md bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Back to Admin
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Visit Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
