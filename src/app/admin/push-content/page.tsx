'use client'

import { useEffect, useState } from 'react'
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

  const handleSend = async (id: number) => {
    if (sendingId === id) {
      return
    }

    setError(null)
    setSuccess(null)
    setSendingId(id)

    try {
      const response = await fetch(`/api/v1/admin/push-content/${id}/send`, {
        method: 'POST',
      })

      const responseText = await response.text()
      const body = responseText
        ? (JSON.parse(responseText) as { success?: boolean; message?: string })
        : { success: response.ok }

      if (!response.ok || body.success === false) {
        throw new Error(body.message || '推送失败')
      }

      setSuccess(body.message ?? '推送任务已触发')
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
                      {records.map((item) => (
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
          </div>
        </div>
      </main>
    </div>
  )
}
