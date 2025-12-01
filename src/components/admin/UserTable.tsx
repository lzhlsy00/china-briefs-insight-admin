'use client'

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

interface UserProfile {
  id: string
  email: string
  subscription_status: string
  created_at: string | null
  subscribed: string | null
  latest_renewal: string | null
  transactions: number | null
  current_period_start: string | null
  current_period_end: string | null
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
  const [menuPosition, setMenuPosition] = useState<{ id: string; top: number; left: number } | null>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [isMounted, setIsMounted] = useState(false)
  const [pageInput, setPageInput] = useState('1')
  const MENU_WIDTH = 128
  const MENU_OFFSET = 6

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const calculateMenuPosition = (userId: string) => {
    const button = buttonRefs.current[userId]
    if (!button || typeof window === 'undefined') {
      return null
    }

    const rect = button.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const minGap = 8
    const maxLeft = Math.max(minGap, viewportWidth - MENU_WIDTH - minGap)

    return {
      top: rect.bottom + MENU_OFFSET,
      left: Math.min(Math.max(rect.left, minGap), maxLeft),
    }
  }
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

  useEffect(() => {
    if (pagination?.current) {
      setPageInput(String(pagination.current))
    }
  }, [pagination])

  // Close menu when clicking outside
  useEffect(() => {
    if (openMenuId === null) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-subscription-menu]') || target.closest('[data-subscription-toggle]')) {
        return
      }
      setOpenMenuId(null)
      setMenuPosition(null)
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null)
        setMenuPosition(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenuId])

  useEffect(() => {
    if (!openMenuId) return

    const updatePosition = () => {
      const nextPosition = calculateMenuPosition(openMenuId)
      if (!nextPosition) return

      setMenuPosition({ id: openMenuId, ...nextPosition })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [openMenuId])

  const toggleMenu = (userId: string) => {
    if (openMenuId === userId) {
      setOpenMenuId(null)
      setMenuPosition(null)
      return
    }

    setOpenMenuId(userId)
    const nextPosition = calculateMenuPosition(userId)
    if (!nextPosition) return

    setMenuPosition({ id: userId, ...nextPosition })
  }

  // Format date
  // Format creation time
  const formatCreateTime = (isoDate: string | null) => {
    if (!isoDate) return '-'
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
    const normalized = status?.toLowerCase?.() ?? 'unknown'
    switch (normalized) {
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
    const normalized = status?.toLowerCase?.() ?? 'unknown'
    switch (normalized) {
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
    setMenuPosition(null)

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

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^0-9]/g, '')
    setPageInput(value)
  }

  const handlePageJump = () => {
    if (!pagination) return
    const parsed = Number(pageInput)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageInput(String(pagination.current))
      return
    }
    const totalPages = Math.max(1, pagination.totalPages)
    const clamped = Math.min(Math.max(parsed, 1), totalPages)
    setCurrentPage(clamped)
  }

  const handlePageInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handlePageJump()
    }
  }

  // Subscription options
  const subscriptionOptions = ['free', 'pro']

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
      <div className="relative overflow-x-auto overflow-y-visible">
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
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  First Subscribe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Latest Renewal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period Start
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period End
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transactions
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
                      <div className="relative inline-block">
                        <button
                          ref={(node) => {
                            buttonRefs.current[user.id] = node
                          }}
                          type="button"
                          onClick={() => toggleMenu(user.id)}
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
                        {isMounted && openMenuId === user.id && menuPosition?.id === user.id &&
                          createPortal(
                            <div
                              className="fixed z-[1000] w-32 bg-white border border-gray-200 rounded-md shadow-lg"
                              data-subscription-menu="true"
                              style={{ top: menuPosition.top, left: menuPosition.left }}
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
                            </div>,
                            document.body
                          )
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCreateTime(user.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCreateTime(user.subscribed)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCreateTime(user.latest_renewal)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCreateTime(user.current_period_start)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCreateTime(user.current_period_end)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {user.transactions ?? 0}
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
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-2">
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
                  <span className="text-sm text-gray-600">/ {Math.max(1, pagination.totalPages)}</span>
                  <button 
                    onClick={() => handlePageChange(pagination.current + 1)}
                    disabled={!pagination.hasNext || loading}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600" htmlFor="user-page-jump">
                    Jump to
                  </label>
                  <input
                    id="user-page-jump"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pageInput}
                    onChange={handlePageInputChange}
                    onKeyDown={handlePageInputKeyDown}
                    disabled={loading}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handlePageJump}
                    disabled={loading}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
