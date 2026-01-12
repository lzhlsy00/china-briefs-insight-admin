'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'

const tableWrapperClass = 'mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white'
const tableClass = 'min-w-full divide-y divide-gray-200'
const thClass = 'px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-50'
const tdClass = 'px-4 py-3 text-sm text-gray-700'

type PushContentRecord = {
  id: number
  title: string | null
  date: string | null
  published: boolean | null
  local: string | null
}

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatPublished = (value: boolean | null | undefined) => {
  if (value === true) {
    return '已发布'
  }
  if (value === false) {
    return '未发布'
  }
  return '—'
}

const formatLocal = (value: string | null | undefined) => {
  if (!value) {
    return '—'
  }

  return value
}

export default function PushContentPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [records, setRecords] = useState<PushContentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const PAGE_SIZE = 10

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchPushContent = async () => {
      try {
        setLoading(true)
        setError(null)
        setSuccess(null)

        const response = await fetch('/api/v1/admin/push-content', {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`加载推送记录失败：${response.status}`)
        }

        const body = (await response.json()) as {
          success?: boolean
          data?: { pushContents?: Array<Record<string, unknown>> }
          message?: string
        }

        if (cancelled) {
          return
        }

        if (body.success === false) {
          throw new Error(body.message || '加载推送记录失败')
        }

        const list = (body.data?.pushContents ?? []).map((item) => ({
          id: Number(item.id),
          title: typeof item.title === 'string' ? item.title : null,
          date: typeof item.date === 'string' ? item.date : null,
          published: typeof item.published === 'boolean' ? item.published : null,
          local: typeof item.local === 'string' ? item.local : null,
        }))

        setRecords(list)
        setCurrentPage(1)
      } catch (fetchError) {
        if (cancelled) {
          return
        }
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return
        }
        const messageText = fetchError instanceof Error ? fetchError.message : '加载推送记录失败'
        setError(messageText)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchPushContent()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isAuthenticated, isLoading])

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage((prev) => {
      const clamped = Math.min(Math.max(prev, 1), totalPages)
      return clamped === prev ? prev : clamped
    })
  }, [totalPages])

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  const pagedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return records.slice(start, start + PAGE_SIZE)
  }, [records, currentPage])

  const handlePageChange = (page: number) => {
    const clamped = Math.min(Math.max(page, 1), totalPages)
    setCurrentPage(clamped)
  }

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^0-9]/g, '')
    setPageInput(value)
  }

  const handlePageJump = () => {
    const parsed = Number(pageInput)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageInput(String(currentPage))
      return
    }
    handlePageChange(parsed)
  }

  const handlePageInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handlePageJump()
    }
  }

  const pageStart = records.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = records.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, records.length)
  const isPageJumpDisabled = loading || records.length === 0

  const handleSend = async (id: number) => {
    if (sendingId === id) {
      return
    }

    if (!window.confirm('确定要推送这条内容给所有订阅用户吗？')) {
      return
    }

    setError(null)
    setSuccess(null)
    setSendingId(id)

    try {
      let offset = 0
      const batchSize = 10
      let totalSent = 0
      let totalRecipients = 0

      // 循环调用批量发送 API 直到所有用户都收到
      while (true) {
        const response = await fetch('/api/v1/admin/batch-email-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId: id,
            offset,
            batchSize,
            testMode: false,
            ignoreLocale: false,
            forceResend: false,
          }),
        })

        const body = await response.json() as {
          success?: boolean
          message?: string
          data?: {
            completed?: boolean
            progress?: { sent: number; total: number }
            next?: { offset: number } | null
            batch?: { results?: { delivered: number; failed: number } }
          }
        }

        if (!response.ok || body.success === false) {
          throw new Error(body.message || '推送失败')
        }

        const data = body.data
        if (data?.progress) {
          totalSent = data.progress.sent
          totalRecipients = data.progress.total
          setSuccess(`正在发送... ${totalSent}/${totalRecipients}`)
        }

        // 如果完成或者没有下一批，退出循环
        if (data?.completed || !data?.next) {
          break
        }

        offset = data.next.offset

        // 避免发送过快，每批之间等待 1 秒
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      setSuccess(`推送完成！成功发送 ${totalSent}/${totalRecipients} 封邮件`)

      // 刷新记录状态
      setRecords((prev) =>
        prev.map((record) =>
          record.id === id ? { ...record, published: true } : record
        )
      )
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : '推送失败'
      setError(messageText)
    } finally {
      setSendingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (deletingId === id) {
      return
    }

    if (!window.confirm('确定要删除这条推送内容吗？')) {
      return
    }

    setError(null)
    setSuccess(null)
    setDeletingId(id)

    try {
      const response = await fetch(`/api/v1/admin/push-content/${id}`, {
        method: 'DELETE',
      })

      const responseText = await response.text()
      const body = responseText
        ? (JSON.parse(responseText) as { success?: boolean; message?: string })
        : { success: response.ok }

      if (!response.ok || body.success === false) {
        throw new Error(body.message || '删除失败')
      }

      setRecords((prev) => prev.filter((record) => record.id !== id))
      setSuccess(body.message ?? '推送内容已删除')
    } catch (deleteError) {
      const messageText = deleteError instanceof Error ? deleteError.message : '删除失败'
      setError(messageText)
    } finally {
      setDeletingId(null)
    }
  }

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

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <main className="ml-64 p-6">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Push Content</h1>
                <p className="text-gray-600 mt-1">查看已生成的推送内容记录</p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/admin/push-content/new')}
                className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                <span className="text-lg leading-none">＋</span>
                创建推送
              </button>
            </div>
          </div>

          <div className="p-6">
            {success && (
              <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                {success}
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {!error && (
              <div className={tableWrapperClass}>
                {loading ? (
                  <div className="p-6 text-sm text-gray-500">正在加载...</div>
                ) : records.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">暂无推送记录</div>
                ) : (
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={thClass}>Title</th>
                        <th className={thClass}>Date</th>
                        <th className={thClass}>Locale</th>
                        <th className={thClass}>Published</th>
                        <th className={`${thClass} text-center`}>
                          <span className="sr-only">操作</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pagedRecords.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className={`${tdClass} font-medium text-gray-900`}>{item.title ?? '—'}</td>
                          <td className={tdClass}>{formatDate(item.date)}</td>
                          <td className={tdClass}>{formatLocal(item.local)}</td>
                          <td className={tdClass}>{formatPublished(item.published)}</td>
                          <td className={`${tdClass} text-center`}>
                            <div className="mx-auto flex w-fit items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => router.push(`/admin/push-content/${item.id}`)}
                                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
                                disabled={loading}
                              >
                                查看
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleSend(item.id)}
                                disabled={sendingId === item.id || loading}
                                className={`inline-flex items-center justify中心 gap-2 rounded-md px-3 py-1 text-xs font-semibold transition ${
                                  sendingId === item.id
                                    ? 'cursor-wait bg-gray-200 text-gray-500'
                                    : 'bg-black text-white hover:bg-gray-800'
                                }`}
                              >
                                {sendingId === item.id ? (
                                  <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                                ) : (
                                  '推送'
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(item.id)}
                                disabled={deletingId === item.id || loading}
                                className={`inline-flex items-center justify中心 gap-2 rounded-md px-3 py-1 text-xs font-semibold transition ${
                                  deletingId === item.id
                                    ? 'cursor-wait bg-gray-200 text-gray-500'
                                    : 'border border-red-300 text-red-600 hover:bg-red-50'
                                }`}
                              >
                                {deletingId === item.id ? '删除中...' : '删除'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
            {records.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-600 rounded-lg">
                <div>
                  Showing <span className="font-medium">{pageStart}</span> to{' '}
                  <span className="font-medium">{pageEnd}</span> of{' '}
                  <span className="font-medium">{records.length}</span> push contents
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || loading}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm bg-blue-600 text-white border border-blue-600 rounded-md">
                      {currentPage}
                    </span>
                    <span className="text-sm text-gray-600">/ {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || loading}
                      className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="push-content-page-jump" className="text-sm text-gray-600">
                      Jump to
                    </label>
                    <input
                      id="push-content-page-jump"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={pageInput}
                      onChange={handlePageInputChange}
                      onKeyDown={handlePageInputKeyDown}
                      disabled={isPageJumpDisabled}
                      className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
