'use client'

import { useEffect, useState } from 'react'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  subscription_status: string
  subscription_end: string | null
  created_at: string
}

interface Pagination {
  current: number
  totalCount: number
  totalPages: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export default function UserTable() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // 获取用户列表
  const fetchUsers = async (page: number = 1) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/v1/admin/users?page=${page}&limit=10`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users')
      }
      
      setUsers(data.data.users)
      setPagination(data.data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(currentPage)
  }, [currentPage])

  // Close menu when clicking outside
  useEffect(() => {
    if (openMenuId === null) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-subscription-menu]') || target.closest('[data-subscription-toggle]')) {
        return
      }
      setOpenMenuId(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuId])

  // Format date
  const formatDate = (isoDate: string | null) => {
    if (!isoDate) return '-'
    const date = new Date(isoDate)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Format creation time
  const formatCreateTime = (isoDate: string) => {
    const date = new Date(isoDate)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取订阅状态样式
  const getSubscriptionStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'premium':
      case 'pro':
        return 'bg-purple-100 text-purple-800'
      case 'free':
        return 'bg-gray-100 text-gray-800'
      case 'trial':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Get subscription text
  const getSubscriptionText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'premium':
        return 'Premium'
      case 'pro':
        return 'Pro'
      case 'free':
        return 'Free'
      case 'trial':
        return 'Trial'
      default:
        return status
    }
  }

  // Update user subscription status
  const updateSubscription = async (userId: string, newStatus: string) => {
    const confirmMessage = `Are you sure you want to change this user's subscription to ${newStatus}?`
    
    if (!confirm(confirmMessage)) {
      return
    }

    setUpdatingId(userId)
    setOpenMenuId(null)

    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription_status: newStatus,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subscription')
      }

      // Refresh user list
      await fetchUsers(currentPage)
    } catch (err) {
      alert('Failed to update subscription: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setUpdatingId(null)
    }
  }

  // 处理分页
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Subscription options
  const subscriptionOptions = ['free', 'trial', 'premium', 'pro']

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-4">Loading failed: {error}</div>
        <button 
          onClick={() => fetchUsers(currentPage)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <>
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
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {user.full_name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                          disabled={updatingId === user.id}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-200 ${getSubscriptionStyle(user.subscription_status)} ${
                            updatingId === user.id 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 cursor-pointer'
                          }`}
                          data-subscription-toggle="true"
                        >
                          {updatingId === user.id ? 'Updating...' : getSubscriptionText(user.subscription_status)}
                          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {openMenuId === user.id && (
                          <div
                            className="absolute z-10 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg"
                            data-subscription-menu="true"
                          >
                            <div className="py-1">
                              {subscriptionOptions.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => updateSubscription(user.id, option)}
                                  disabled={updatingId === user.id || user.subscription_status === option}
                                  className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 ${
                                    user.subscription_status === option
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                                  }`}
                                >
                                  {getSubscriptionText(option)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(user.subscription_end)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCreateTime(user.created_at)}
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
                Showing <span className="font-medium">{((pagination.current - 1) * pagination.limit) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(pagination.current * pagination.limit, pagination.totalCount)}</span> of{' '}
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

