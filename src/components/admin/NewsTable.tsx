'use client'

import { useEffect, useState } from 'react'
import { NewsItem } from '@/types/api'
import { useNewsList, useNewsApi } from '@/hooks/useNewsApi'

interface NewsTableProps {
  onEditNews: (newsItem: NewsItem) => void
}

export default function NewsTable({ onEditNews }: NewsTableProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null)
  const [aiFilter, setAiFilter] = useState<'ALL' | 'TRUE' | 'FALSE'>('ALL')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  
  const { 
    newsList, 
    pagination, 
    params, 
    loading, 
    error, 
    refreshNews, 
    updateParams 
  } = useNewsList({ 
    sortBy: 'isoDate', 
    sortOrder: 'desc',
    limit: 10 
  })
  
  const { deleteNews, updateNews } = useNewsApi()

  // 格式化时间
  const formatTime = (isoDate: string) => {
    const date = new Date(isoDate)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return '刚刚'
    } else if (diffInHours < 24) {
      return `${diffInHours}小时前`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}天前`
    }
  }

  // 获取状态样式
  const getStatusStyle = (status: 'DRAFT' | 'PUBLISH') => {
    switch (status) {
      case 'PUBLISH':
        return 'bg-green-100 text-green-800'
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusButtonStyle = (status: 'DRAFT' | 'PUBLISH') => {
    switch (status) {
      case 'PUBLISH':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
      case 'DRAFT':
        return 'bg-green-100 text-green-800 hover:bg-green-200'
      default:
        return 'bg-gray-200 text-gray-800 hover:bg-gray-300'
    }
  }

  // Get status text
  const getStatusText = (status: 'DRAFT' | 'PUBLISH') => {
    switch (status) {
      case 'PUBLISH':
        return 'Published'
      case 'DRAFT':
        return 'Draft'
      default:
        return 'Unknown'
    }
  }

  // Get category style
  const getCategoryStyle = (category: string | null) => {
    if (!category) return 'bg-gray-100 text-gray-800'
    
    const colors: Record<string, string> = {
      '财经': 'bg-blue-100 text-blue-800',
      '科技': 'bg-green-100 text-green-800',
      '国际': 'bg-purple-100 text-purple-800',
      '体育': 'bg-orange-100 text-orange-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  // Handle edit
  const handleEdit = (news: NewsItem) => {
    onEditNews(news)
  }

  // Handle delete
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this news item?')) return

    setDeletingId(id)
    try {
      await deleteNews(id)
      refreshNews()
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleStatus = async (news: NewsItem) => {
    const nextStatus = news.status === 'PUBLISH' ? 'DRAFT' : 'PUBLISH'

    setStatusUpdatingId(news.id)
    try {
      await updateNews(news.id, { status: nextStatus })
      refreshNews()
    } catch (err) {
      console.error('Status update failed:', err)
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const closeMenu = () => setOpenMenuId(null)

  useEffect(() => {
    if (openMenuId === null) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-action-menu]') || target.closest('[data-action-toggle]')) {
        return
      }
      closeMenu()
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuId])

  // Handle pagination
  const handlePageChange = (page: number) => {
    updateParams({ page })
  }

  // Handle AI worth filter change
  const handleFilterChange = (value: 'ALL' | 'TRUE' | 'FALSE') => {
    setAiFilter(value)

    if (value === 'ALL') {
      updateParams({ page: 1, aiWorth: undefined })
      return
    }

    updateParams({ page: 1, aiWorth: value === 'TRUE' })
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Loading failed: {error}</div>
        <button 
          onClick={refreshNews}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">AI Worth</span>
          <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm">
            {[
              { label: 'ALL', value: 'ALL' as const },
              { label: 'AI-True', value: 'TRUE' as const },
              { label: 'AI-False', value: 'FALSE' as const }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => handleFilterChange(option.value)}
                className={`px-3 py-1 text-sm transition-colors duration-200 first:rounded-l-md last:rounded-r-md ${
                  aiFilter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading || deletingId !== null || statusUpdatingId !== null}
            >
              {option.label}
            </button>
          ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        {loading && (
          <div className="text-center py-8">
            <div className="text-gray-600">Loading...</div>
          </div>
        )}
        
        {!loading && (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {newsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                newsList.map((news) => (
                  <tr key={news.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">
                        {news.title}
                      </div>
                      {news.content && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {news.content}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryStyle(news.category)}`}>
                        {news.category || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(news.status)}`}>
                        {getStatusText(news.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatTime(news.isoDate)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(news)}
                          className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${getStatusButtonStyle(news.status)}`}
                          disabled={statusUpdatingId === news.id || deletingId === news.id}
                        >
                          {statusUpdatingId === news.id
                            ? 'Updating...'
                            : news.status === 'PUBLISH'
                              ? 'Draft'
                              : 'Publish'}
                        </button>
                        <div className="relative inline-flex">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(openMenuId === news.id ? null : news.id)}
                            className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={deletingId === news.id || statusUpdatingId === news.id}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === news.id}
                            data-action-toggle="true"
                          >
                            <span className="sr-only">Open action menu</span>
                            <span aria-hidden="true" className="flex flex-col items-center justify-between h-4">
                              <span className="w-1 h-1 bg-current rounded-full"></span>
                              <span className="w-1 h-1 bg-current rounded-full"></span>
                              <span className="w-1 h-1 bg-current rounded-full"></span>
                            </span>
                          </button>
                          {openMenuId === news.id && (
                            <div
                              role="menu"
                              className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10"
                              data-action-menu="true"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  closeMenu()
                                  handleEdit(news)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                role="menuitem"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  closeMenu()
                                  void handleDelete(news.id)
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                role="menuitem"
                                disabled={deletingId === news.id || statusUpdatingId === news.id}
                              >
                                {deletingId === news.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        
        {/* 分页信息 */}
        {pagination && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{((pagination.current - 1) * (params.limit || 10)) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(pagination.current * (params.limit || 10), pagination.totalCount)}</span> of{' '}
                <span className="font-medium">{pagination.totalCount}</span> entries
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={!pagination.hasPrev || loading}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm bg-blue-600 text-white border border-blue-600 rounded-md">
                  {pagination.current}
                </span>
                <button 
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={!pagination.hasNext || loading}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  )
}
