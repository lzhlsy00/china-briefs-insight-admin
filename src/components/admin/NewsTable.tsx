'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { NewsItem } from '@/types/api'
import { useNewsList, useNewsApi } from '@/hooks/useNewsApi'

interface NewsTableProps {
  onEditNews: (newsItem: NewsItem) => void
  refreshSignal?: number
}

export default function NewsTable({ onEditNews, refreshSignal }: NewsTableProps) {
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null)
  const [aiFilter, setAiFilter] = useState<'ALL' | 'TRUE' | 'FALSE'>('ALL')
  const [languageMode, setLanguageMode] = useState<'ALL' | 'EN' | 'KO' | 'CN'>('ALL')
  const [dateSortOrder, setDateSortOrder] = useState<'asc' | 'desc'>('desc')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISH' | 'DRAFT'>('ALL')
  const [titleFilterInput, setTitleFilterInput] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<Array<{ value: string; label: string }>>([])
  const [pageInput, setPageInput] = useState<string>('1')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  // 批量选择相关状态
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [daysFilter, setDaysFilter] = useState<number>(10)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [prevAiFilter, setPrevAiFilter] = useState<'ALL' | 'TRUE' | 'FALSE'>('ALL')
  const [autoDeleting, setAutoDeleting] = useState(false)
  
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

  // 格式化时间为 YYYY-MM-DD HH:mm
  const formatTime = (isoDate: string) => {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) {
      return 'Invalid date'
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    return `${year}-${month}-${day} ${hours}:${minutes}`
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

  const getDisplayFields = (news: NewsItem) => {
    let displayLanguage: 'EN' | 'KO' | 'CN' = 'EN'
    if (languageMode === 'KO') {
      displayLanguage = 'KO'
    } else if (languageMode === 'CN') {
      displayLanguage = 'CN'
    }

    let title = news.title ?? ''
    if (displayLanguage === 'KO') {
      title = news.titleKo?.trim() || news.titleEn?.trim() || news.title || ''
    } else if (displayLanguage === 'CN') {
      title = (news.title || '').trim() || news.titleEn?.trim() || news.titleKo?.trim() || ''
    } else {
      title = news.titleEn?.trim() || news.titleKo?.trim() || news.title || ''
    }

    let contentSource: string | null | undefined
    if (displayLanguage === 'KO') {
      contentSource = news.translationKo ?? news.translationEn ?? news.content
    } else if (displayLanguage === 'CN') {
      contentSource = news.content ?? news.translationEn ?? news.translationKo
    } else {
      contentSource = news.translationEn ?? news.translationKo ?? news.content
    }

    const content = (contentSource ?? '').trim()

    return { title, content }
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

  const getContentPreview = (content?: string | null) => {
    if (!content) return null

    const trimmed = content.trim()
    if (!trimmed) return null

    const maxLength = 80
    return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed
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

    const handleEscape = (event: globalThis.KeyboardEvent) => {
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

  useEffect(() => {
    if (pagination?.current) {
      setPageInput(String(pagination.current))
    }
  }, [pagination])

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^0-9]/g, '')
    setPageInput(value)
  }

  const handlePageJump = () => {
    if (!pagination) return
    const parsed = Number(pageInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setPageInput(String(pagination.current))
      return
    }
    const clamped = Math.min(Math.max(parsed, 1), pagination.total || 1)
    updateParams({ page: clamped })
  }

  const handlePageInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handlePageJump()
    }
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

  const handleLanguageChange = (value: 'ALL' | 'EN' | 'KO' | 'CN') => {
    setLanguageMode(value)
    updateParams({
      page: 1,
      language: value === 'EN' || value === 'KO' ? value : undefined,
    })
  }

  const filteredNewsList = useMemo(() => {
    if (!newsList || newsList.length === 0) return []

    if (languageMode === 'ALL') {
      return newsList
    }

    const normalize = (value?: string | null) => (value ?? '').trim()
    const predicate = languageMode === 'KO'
      ? (item: NewsItem) => Boolean(normalize(item.titleKo))
      : languageMode === 'CN'
        ? (item: NewsItem) => Boolean(normalize(item.title))
        : (item: NewsItem) => Boolean(normalize(item.titleEn))

    return newsList.filter(predicate)
  }, [newsList, languageMode])

  const normalizedTitleParam = useMemo(() => (typeof params.title === 'string' ? params.title : '').trim(), [params.title])

  useEffect(() => {
    setTitleFilterInput(typeof params.title === 'string' ? params.title : '')
  }, [params.title])

  useEffect(() => {
    setCategoryFilter(typeof params.category === 'string' ? params.category : '')
  }, [params.category])

  const resolveCategoryLabel = useCallback((item: NewsItem) => {
    if (languageMode === 'KO') {
      return item.categoryKo?.trim() || item.category?.trim() || item.categoryEn?.trim() || ''
    }
    if (languageMode === 'CN') {
      return item.category?.trim() || item.categoryEn?.trim() || item.categoryKo?.trim() || ''
    }
    return item.categoryEn?.trim() || item.category?.trim() || item.categoryKo?.trim() || ''
  }, [languageMode])

  const rawCategoryValue = useCallback((item: NewsItem) => item.category?.trim() || '', [])

  useEffect(() => {
    if (!newsList) return
    setCategoryOptions((prev) => {
      const map = new Map<string, string>()
      prev.forEach((option) => {
        map.set(option.value, option.label)
      })
      newsList.forEach((item) => {
        const value = rawCategoryValue(item)
        if (!value) {
          return
        }
        const label = resolveCategoryLabel(item) || value
        map.set(value, label)
      })
      const entries = Array.from(map.entries())
      return entries
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label))
    })
  }, [newsList, resolveCategoryLabel, rawCategoryValue])

  const lastRefreshSignalRef = useRef<number | null>(null)

  useEffect(() => {
    if (refreshSignal == null) {
      return
    }
    if (lastRefreshSignalRef.current === refreshSignal) {
      return
    }
    lastRefreshSignalRef.current = refreshSignal
    refreshNews()
  }, [refreshSignal, refreshNews])

  const applyDateSort = (order: 'asc' | 'desc') => {
    setDateSortOrder(order)
    updateParams({
      page: 1,
      sortBy: 'isoDate',
      sortOrder: order,
      secondarySortBy: undefined,
      secondarySortOrder: undefined,
    })
  }

  const handleDateSortDirection = (direction: 'asc' | 'desc') => {
    applyDateSort(direction)
  }

  const handleDateSortToggle = () => {
    const nextOrder = dateSortOrder === 'asc' ? 'desc' : 'asc'
    applyDateSort(nextOrder)
  }

  const handleStatusFilterChange = (value: 'ALL' | 'PUBLISH' | 'DRAFT') => {
    setStatusFilter(value)
    updateParams({
      page: 1,
      status: value === 'ALL' ? undefined : value,
    })
  }

  const handleTitleFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitleFilterInput(event.target.value)
  }

  const applyTitleFilter = useCallback((value: string) => {
    const trimmed = value.trim()
    updateParams({
      page: 1,
      title: trimmed.length > 0 ? trimmed : undefined,
    })
  }, [updateParams])

  useEffect(() => {
    const trimmed = titleFilterInput.trim()
    if (trimmed === normalizedTitleParam) {
      return
    }
    const handle = setTimeout(() => {
      applyTitleFilter(titleFilterInput)
    }, 400)
    return () => clearTimeout(handle)
  }, [titleFilterInput, normalizedTitleParam, applyTitleFilter])

  const handleTitleFilterKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      applyTitleFilter(titleFilterInput)
    }
  }

  const handleCategorySelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setCategoryFilter(value)
    updateParams({
      page: 1,
      category: value || undefined,
    })
  }

  // 进入选择模式
  const handleEnterSelectionMode = () => {
    setPrevAiFilter(aiFilter)
    setSelectionMode(true)
    setSelectedIds(new Set())
    // 自动筛选 AI worth 为 false 的数据
    setAiFilter('FALSE')
    // 计算时间筛选的日期：N天前表示筛选日期 <= (今天 - N天) 的内容
    const dateTo = new Date()
    dateTo.setDate(dateTo.getDate() - daysFilter)
    dateTo.setHours(23, 59, 59, 999) // 设置为当天结束时间
    updateParams({
      page: 1,
      aiWorth: false,
      dateTo: dateTo.toISOString(),
    })
  }

  // 退出选择模式
  const handleExitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    // 恢复之前的筛选条件
    setAiFilter(prevAiFilter)
    updateParams({
      page: 1,
      aiWorth: prevAiFilter === 'ALL' ? undefined : prevAiFilter === 'TRUE',
      dateTo: undefined,
    })
  }

  // 时间筛选变更
  const handleDaysFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const days = Number(event.target.value)
    setDaysFilter(days)
    // N天前表示筛选日期 <= (今天 - N天) 的内容
    const dateTo = new Date()
    dateTo.setDate(dateTo.getDate() - days)
    dateTo.setHours(23, 59, 59, 999) // 设置为当天结束时间
    updateParams({
      page: 1,
      dateTo: dateTo.toISOString(),
    })
  }

  // 切换单个选择
  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // 全选当前页
  const handleSelectAll = () => {
    const currentPageIds = filteredNewsList.map((item) => item.id)
    const allSelected = currentPageIds.every((id) => selectedIds.has(id))

    if (allSelected) {
      // 取消全选
      setSelectedIds((prev) => {
        const next = new Set(prev)
        currentPageIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      // 全选
      setSelectedIds((prev) => {
        const next = new Set(prev)
        currentPageIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的新闻')
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条新闻吗？此操作不可恢复！`)) {
      return
    }

    setBatchDeleting(true)
    try {
      const idsToDelete = Array.from(selectedIds)
      let successCount = 0
      let failCount = 0

      for (const id of idsToDelete) {
        try {
          await deleteNews(id)
          successCount++
        } catch (err) {
          console.error(`Delete news ${id} failed:`, err)
          failCount++
        }
      }

      setSelectedIds(new Set())
      refreshNews()

      if (failCount > 0) {
        alert(`删除完成：成功 ${successCount} 条，失败 ${failCount} 条`)
      } else {
        alert(`成功删除 ${successCount} 条新闻`)
      }
    } catch (err) {
      console.error('Batch delete failed:', err)
      alert('批量删除失败')
    } finally {
      setBatchDeleting(false)
    }
  }

  // 计算当前页是否全选
  const isAllSelected = useMemo(() => {
    if (filteredNewsList.length === 0) return false
    return filteredNewsList.every((item) => selectedIds.has(item.id))
  }, [filteredNewsList, selectedIds])

  // 自动清除10天前的 AI worth 为 false 的内容
  const handleAutoDelete = async () => {
    if (!confirm('确定要自动清除10天前且 AI Worth 为 False 的所有新闻吗？此操作不可恢复！')) {
      return
    }

    setAutoDeleting(true)
    try {
      // 计算10天前的日期
      const dateTo = new Date()
      dateTo.setDate(dateTo.getDate() - 10)
      dateTo.setHours(23, 59, 59, 999)

      // 先获取总数
      const countResponse = await fetch(
        `/api/v1/admin/news?aiWorth=false&dateTo=${dateTo.toISOString()}&limit=1&page=1`
      )
      const countResult = await countResponse.json()

      if (!countResult.success) {
        throw new Error(countResult.message || '获取新闻列表失败')
      }

      const totalCount = countResult.data?.pagination?.totalCount || 0

      if (totalCount === 0) {
        alert('没有找到需要清除的新闻')
        return
      }

      if (!confirm(`找到 ${totalCount} 条符合条件的新闻，确定全部删除吗？`)) {
        return
      }

      let successCount = 0
      let failCount = 0
      const limit = 50

      // 循环获取并删除所有符合条件的新闻（始终获取第一页，因为删除后数据会前移）
      while (true) {
        const response = await fetch(
          `/api/v1/admin/news?aiWorth=false&dateTo=${dateTo.toISOString()}&limit=${limit}&page=1`
        )
        const result = await response.json()

        if (!result.success || !result.data?.news) {
          break
        }

        const newsToDelete = result.data.news as Array<{ id: number }>

        if (newsToDelete.length === 0) {
          break
        }

        for (const news of newsToDelete) {
          try {
            await deleteNews(news.id)
            successCount++
          } catch (err) {
            console.error(`Delete news ${news.id} failed:`, err)
            failCount++
          }
        }

        // 因为删除后数据会减少，所以始终获取第一页
        // 如果没有更多数据了就退出
        if (newsToDelete.length < limit) {
          break
        }
      }

      refreshNews()

      if (failCount > 0) {
        alert(`自动清除完成：成功 ${successCount} 条，失败 ${failCount} 条`)
      } else {
        alert(`成功清除 ${successCount} 条新闻`)
      }
    } catch (err) {
      console.error('Auto delete failed:', err)
      alert('自动清除失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setAutoDeleting(false)
    }
  }

  const isActionDisabled = loading || deletingId !== null || statusUpdatingId !== null || batchDeleting || autoDeleting
  const isPageJumpDisabled = isActionDisabled || !pagination
  const getTimeArrowClass = (direction: 'up' | 'down') => {
    const isUp = direction === 'up'
    const isActive = (isUp && dateSortOrder === 'asc') || (!isUp && dateSortOrder === 'desc')
    return `text-[10px] leading-none ${isActive ? 'text-gray-900' : 'text-gray-300'}`
  }

  const getDateSortButtonClass = (direction: 'asc' | 'desc') =>
    `px-3 py-1 text-sm transition-colors duration-200 ${
      dateSortOrder === direction ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
    } ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`

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
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
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
              } ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isActionDisabled}
            >
              {option.label}
            </button>
          ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">Sorting</span>
          <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => handleDateSortDirection('asc')}
              className={getDateSortButtonClass('asc')}
              disabled={isActionDisabled}
            >
              Date ↑
            </button>
            <button
              onClick={() => handleDateSortDirection('desc')}
              className={getDateSortButtonClass('desc')}
              disabled={isActionDisabled}
            >
              Date ↓
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">Status</span>
          <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm">
            {[
              { label: 'All', value: 'ALL' as const },
              { label: 'Published', value: 'PUBLISH' as const },
              { label: 'Draft', value: 'DRAFT' as const },
            ].map((option, index) => (
              <button
                key={option.value}
                onClick={() => handleStatusFilterChange(option.value)}
                className={`px-3 py-1 text-sm transition-colors duration-200 ${
                  index === 0 ? 'rounded-l-md' : index === 2 ? 'rounded-r-md' : ''
                } ${
                  statusFilter === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                } ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isActionDisabled}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-700">Language</span>
          <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm">
            {[
              { label: 'All', value: 'ALL' as const },
              { label: 'English', value: 'EN' as const },
              { label: 'Korean', value: 'KO' as const },
              { label: 'Chinese', value: 'CN' as const }
            ].map((option, index) => (
              <button
                key={option.value}
                onClick={() => handleLanguageChange(option.value)}
                className={`px-3 py-1 text-sm transition-colors duration-200 ${
                  index === 0 ? 'rounded-l-md' : index === 3 ? 'rounded-r-md' : ''
                } ${
                  languageMode === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                } ${isActionDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isActionDisabled}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full rounded-lg border border-gray-200 bg-white/70 px-4 py-3">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-1 min-w-[220px] flex-col gap-1">
              <label htmlFor="news-title-filter" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Title Search
              </label>
              <div className="relative flex">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
                <input
                  id="news-title-filter"
                  type="text"
                  value={titleFilterInput}
                  onChange={handleTitleFilterChange}
                  onKeyDown={handleTitleFilterKeyDown}
                  placeholder="e.g. AI policy"
                  className="w-full rounded-l-md border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => applyTitleFilter(titleFilterInput)}
                  disabled={loading}
                  className="inline-flex items-center rounded-r-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Search
                </button>
              </div>
            </div>
            <div className="flex flex-col min-w-[200px] gap-1">
              <label htmlFor="news-category-filter" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Category
              </label>
              <select
                id="news-category-filter"
                value={categoryFilter}
                onChange={handleCategorySelectChange}
                disabled={loading || categoryOptions.length === 0}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">All</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 批量选择功能栏 */}
        <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-medium text-gray-700">管理历史数据</span>
            {!selectionMode ? (
              <>
                <button
                  type="button"
                  onClick={handleEnterSelectionMode}
                  disabled={isActionDisabled}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  选择
                </button>
                <button
                  type="button"
                  onClick={handleAutoDelete}
                  disabled={isActionDisabled}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {autoDeleting ? '清除中...' : '自动清除10天前'}
                </button>
              </>
            ) : (
              <>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    disabled={isActionDisabled || filteredNewsList.length === 0}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="ml-2 text-sm text-gray-700">全部</span>
                </label>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">时间筛选</span>
                  <select
                    value={daysFilter}
                    onChange={handleDaysFilterChange}
                    disabled={isActionDisabled}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((days) => (
                      <option key={days} value={days}>
                        {days}天前
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-sm text-gray-600">
                  已选择 <span className="font-semibold text-blue-600">{selectedIds.size}</span> 条
                </span>

                <button
                  type="button"
                  onClick={handleBatchDelete}
                  disabled={isActionDisabled || selectedIds.size === 0}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {batchDeleting ? '删除中...' : '删除'}
                </button>

                <button
                  type="button"
                  onClick={handleExitSelectionMode}
                  disabled={batchDeleting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消选择
                </button>
              </>
            )}
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
                {selectionMode && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <span className="sr-only">选择</span>
                  </th>
                )}
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
                  <button
                    type="button"
                    onClick={handleDateSortToggle}
                    disabled={isActionDisabled}
                    className={`flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 ${
                      isActionDisabled ? 'cursor-not-allowed opacity-60' : ''
                    }`}
                  >
                    <span>Time</span>
                    <span className="flex flex-col leading-none">
                      <span className={getTimeArrowClass('up')}>▲</span>
                      <span className={getTimeArrowClass('down')}>▼</span>
                    </span>
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNewsList.length === 0 ? (
                <tr>
                  <td colSpan={selectionMode ? 6 : 5} className="px-6 py-8 text-center text-gray-500">
                    No data available
                  </td>
                </tr>
              ) : (
                filteredNewsList.map((news) => {
                  const displayFields = getDisplayFields(news)
                  const preview = getContentPreview(displayFields.content)
                  const isSelected = selectedIds.has(news.id)
                  return (
                  <tr key={news.id} className={`hover:bg-gray-50 transition-colors duration-200 ${isSelected ? 'bg-blue-50' : ''}`}>
                    {selectionMode && (
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(news.id)}
                          disabled={isActionDisabled}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">
                        {displayFields.title}
                      </div>
                      {preview && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {preview}
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
                )})
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
                  <span className="text-sm text-gray-600">
                    / {pagination.total || 1}
                  </span>
                  <button 
                    onClick={() => handlePageChange(pagination.current + 1)}
                    disabled={!pagination.hasNext || loading}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600" htmlFor="page-jump">
                    Jump to
                  </label>
                  <input
                    id="page-jump"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pageInput}
                    onChange={handlePageInputChange}
                    onKeyDown={handlePageInputKeyDown}
                    disabled={isPageJumpDisabled}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={handlePageJump}
                    disabled={isPageJumpDisabled}
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
