import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">Page not found</p>
                <Link
                    href="/"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md transition-colors"
                >
                    Return to Dashboard
                </Link>
            </div>
        </div>
    );
}
