'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'
import { buildNewsPermalink } from '@/lib/newsLinks'

const baseButton =
  'inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60'

type NewsItem = {
  id: number
  slug: string | null
  isoDate: string | null
  title: string | null
  content: string | null
  titleEn: string | null
  titleKo: string | null
  translationEn: string | null
  translationKo: string | null
}

type SelectedNews = {
  id: number
  title: string
  summary: string
  link: string | null
}

const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

export default function PushContentCreatePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [newsModalOpen, setNewsModalOpen] = useState(false)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [newsSelected, setNewsSelected] = useState<number[]>([])

  const [selectedNews, setSelectedNews] = useState<SelectedNews[]>([])

  useEffect(() => {
    if (!newsModalOpen) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchNews = async () => {
      try {
        setNewsLoading(true)
        setNewsError(null)

        const response = await fetch('/api/v1/admin/news?status=PUBLISH&limit=100&sortBy=isoDate&sortOrder=desc', {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`加载新闻失败: ${response.status}`)
        }

        const body = (await response.json()) as {
          success?: boolean
          data?: { news?: Array<Record<string, unknown>> }
          message?: string
        }

        if (cancelled) {
          return
        }

        if (body.success === false) {
          throw new Error(body.message || '加载新闻失败')
        }

        const list = (body.data?.news ?? []).map((item) => ({
          id: Number(item.id),
          slug: typeof item.slug === 'string' ? item.slug.trim() || null : null,
          isoDate: (item.isoDate as string | null) ?? null,
          title: (item.title as string | null) ?? null,
          content: (item.content as string | null) ?? null,
          titleEn: (item.titleEn as string | null) ?? (item['title-en'] as string | null) ?? (item.title as string | null) ?? null,
          titleKo: (item.titleKo as string | null) ?? (item['title-ko'] as string | null) ?? null,
          translationEn: (item.translationEn as string | null) ?? (item['translation-en'] as string | null) ?? null,
          translationKo: (item.translationKo as string | null) ?? (item['translation-ko'] as string | null) ?? null,
        }))

        setNewsItems(list)
      } catch (fetchError) {
        if (cancelled) {
          return
        }
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return
        }
        const messageText = fetchError instanceof Error ? fetchError.message : '加载新闻失败'
        setNewsError(messageText)
      } finally {
        if (!cancelled) {
          setNewsLoading(false)
        }
      }
    }

    void fetchNews()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [newsModalOpen])

  const toggleNewsSelection = (id: number) => {
    setNewsSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleApplyNews = () => {
    if (newsSelected.length === 0) {
      setNewsModalOpen(false)
      return
    }

    const uniqueIds = Array.from(new Set(newsSelected))
    const selected = uniqueIds
      .map((id) => newsItems.find((item) => item.id === id))
      .filter((item): item is NewsItem => Boolean(item))

    const mapped: SelectedNews[] = selected.map((item) => {
      const title = normalize(item.title) || normalize(item.titleEn) || normalize(item.titleKo) || '未命名新闻'
      const summary = normalize(item.content) || normalize(item.translationEn) || normalize(item.translationKo) || '暂无摘要'
      const permalink = buildNewsPermalink({
        id: item.id,
        title: item.title || item.titleEn || item.titleKo || `新闻-${item.id}`,
        locale: 'en',
      })
      return { id: item.id, title, summary, link: permalink }
    })

    setSelectedNews(mapped)
    setNewsSelected([])
    setNewsModalOpen(false)
  }

  const handleRemoveSelected = (id: number) => {
    setSelectedNews((prev) => prev.filter((item) => item.id !== id))
  }

  const selectedNewsIds = useMemo(() => selectedNews.map((item) => item.id), [selectedNews])

  const handleGenerate = async () => {
    if (selectedNewsIds.length === 0) {
      setError('请先选择要生成的新闻内容')
      return
    }

    if (saving) {
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/v1/push/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsIds: selectedNewsIds }),
      })

      const body = (await response.json()) as { success?: boolean; message?: string }

      if (!response.ok || body.success === false) {
        throw new Error(body.message || '生成推送内容失败')
      }

      setMessage(body.message ?? '推送内容已生成，将自动跳转')

      setTimeout(() => {
        router.push('/admin/push-content')
      }, 1000)
    } catch (generateError) {
      const messageText = generateError instanceof Error ? generateError.message : '生成推送内容失败'
      setError(messageText)
    } finally {
      setSaving(false)
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
    <>
      <div className="min-h-screen bg-gray-100">
        <AdminSidebar />
        <main className="ml-64 p-6">
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">创建推送内容</h1>
                <p className="text-gray-600 mt-1">人工挑选新闻，系统自动生成中韩双语推送。</p>
              </div>
              <button type="button" onClick={() => router.push('/admin/push-content')} className={baseButton}>
                返回列表
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
                  {message}
                </div>
              )}

              <div className="flex flex-col gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                <span className="text-sm font-semibold text-gray-900">操作说明</span>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>点击「选择内容」挑选新闻，系统仅展示标题与摘要字段。</li>
                  <li>确认后，下方列表会展示已选条目，可按需移除。</li>
                  <li>点击「生成推送内容」即调用 AI，自动生成英文与韩文两份推送。</li>
                </ol>
              </div>

              <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">新闻选择</p>
                  <p className="text-xs text-gray-500">当前已选择 {selectedNews.length} 条</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewsModalOpen(true)
                    setNewsSelected(selectedNewsIds)
                  }}
                  className={baseButton}
                  disabled={saving}
                >
                  选择内容
                </button>
              </div>

              <div className="rounded-lg border border-gray-200">
                {selectedNews.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-gray-500">尚未选择任何新闻</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {selectedNews.map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.summary}</p>
                            {item.link && (
                              <a
                                href={item.link}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex text-xs text-blue-600 hover:underline"
                              >
                                查看原文
                              </a>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSelected(item.id)}
                            className="text-xs text-gray-500 hover:text-red-500"
                          >
                            移除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={saving || selectedNews.length === 0}
                  className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {saving ? '生成中...' : '生成推送内容'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {newsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-5xl rounded-lg bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">选择新闻</h2>
                <p className="text-sm text-gray-500">仅显示标题与摘要，便于人工筛选</p>
              </div>
              <button type="button" onClick={() => setNewsModalOpen(false)} className={baseButton}>
                关闭
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
              {newsError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                  {newsError}
                </div>
              )}

              {!newsError && (
                <div className="space-y-4 text-sm text-gray-700">
                  {newsLoading ? (
                    <div className="py-10 text-center text-gray-500">正在加载新闻...</div>
                  ) : newsItems.length === 0 ? (
                    <div className="py-10 text-center text-gray-500">暂无可用新闻</div>
                  ) : (
                    newsItems.map((item) => {
                      const title = normalize(item.title) || normalize(item.titleEn) || normalize(item.titleKo) || '未命名新闻'
                      const summary = normalize(item.content) || normalize(item.translationEn) || normalize(item.translationKo) || '暂无摘要'
                      const preview = summary.length > 160 ? `${summary.slice(0, 160)}...` : summary

                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer flex-col gap-1 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{title}</p>
                              <p className="mt-1 text-sm text-gray-600 line-clamp-3">{preview}</p>
                              {item.isoDate && <p className="mt-1 text-xs text-gray-400">{item.isoDate}</p>}
                            </div>
                            <input
                              type="checkbox"
                              checked={newsSelected.includes(item.id)}
                              onChange={() => toggleNewsSelection(item.id)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                            />
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setNewsModalOpen(false)
                  setNewsSelected([])
                }}
                className={baseButton}
                disabled={newsLoading}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApplyNews}
                className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={newsSelected.length === 0}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
