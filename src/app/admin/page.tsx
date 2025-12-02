'use client'

import { useState } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'
import NewsTable from '@/components/admin/NewsTable'
import NewsEditPage from '@/components/admin/NewsEditPage'
import NewsCreatePage from '@/components/admin/NewsCreatePage'
import LoginPage from '@/components/admin/LoginPage'
import { NewsItem } from '@/types/api'
import { useAuth } from '@/hooks/useAuth'

export default function AdminPage() {
  const [currentView, setCurrentView] = useState<'list' | 'edit' | 'create'>('list')
  const [editingNews, setEditingNews] = useState<NewsItem | null>(null)
  const [refreshSignal, setRefreshSignal] = useState<number | null>(null)
  const { isAuthenticated, isLoading } = useAuth()

  const handleEditNews = (newsItem: NewsItem) => {
    setEditingNews(newsItem)
    setCurrentView('edit')
  }

  const handleBackToList = () => {
    setCurrentView('list')
    setEditingNews(null)
  }

  const handleAddNews = () => {
    setEditingNews(null)
    setCurrentView('create')
  }

  const handleSaveNews = (_updatedNews: NewsItem) => {
    void _updatedNews;
    // This function will be called in NewsEditPage to notify list refresh
    // The actual refresh logic is handled in the NewsTable component
  }

  const handleNewsCreated: (news?: NewsItem) => void = () => {
    setRefreshSignal((prev) => (prev ?? 0) + 1)
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
        {currentView === 'list' && (
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">News Management</h1>
                <p className="text-gray-600 mt-1">Manage all news content</p>
              </div>
              <button
                type="button"
                onClick={handleAddNews}
                className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 transition-colors"
              >
                Add
              </button>
            </div>
            <NewsTable onEditNews={handleEditNews} refreshSignal={refreshSignal ?? undefined} />
          </div>
        )}
        {currentView === 'edit' && editingNews && (
            <NewsEditPage
              newsItem={editingNews}
              onBack={handleBackToList}
              onSave={handleSaveNews}
            />
        )}
        {currentView === 'create' && (
          <NewsCreatePage
            onBack={handleBackToList}
            onCreated={handleNewsCreated}
          />
        )}
      </main>
    </div>
  )
}
