'use client'

import { useState } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import NewsTable from '@/components/admin/NewsTable'
import NewsEditPage from '@/components/admin/NewsEditPage'
import LoginPage from '@/components/admin/LoginPage'
import { NewsItem } from '@/types/api'
import { useAuth } from '@/hooks/useAuth'

export default function AdminPage() {
  const [currentView, setCurrentView] = useState<'list' | 'edit'>('list')
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const { isAuthenticated, isLoading } = useAuth()

  const handleEditNews = (newsItem: NewsItem) => {
    setEditingNews(newsItem)
    setCurrentView('edit')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setEditingNews(null)
  }

  const handleSaveNews = (_updatedNews: NewsItem) => {
    void _updatedNews;
    // This function will be called in NewsEditPage to notify list refresh
    // The actual refresh logic is handled in the NewsTable component
  }

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
        {currentView === 'list' ? (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">News Management</h1>
            <p className="text-gray-600 mt-1">Manage all news content</p>
            </div>
            <NewsTable onEditNews={handleEditNews} />
          </div>
        ) : (
          editingNews && (
            <NewsEditPage
              newsItem={editingNews}
              onBack={handleBackToList}
              onSave={handleSaveNews}
            />
          )
        )}
      </main>
    </div>
  )
}
