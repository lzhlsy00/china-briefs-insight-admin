'use client'

import AdminSidebar from '@/components/admin/AdminSidebar'
import UserTable from '@/components/admin/UserTable'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'

export default function UsersPage() {
  const { isAuthenticated, isLoading } = useAuth()

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Left sidebar */}
      <AdminSidebar />
      
      {/* Right content area */}
      <main className="ml-64 p-6">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">View and manage all users</p>
          </div>
          <UserTable />
        </div>
      </main>
    </div>
  )
}

