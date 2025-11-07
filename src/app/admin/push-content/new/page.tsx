'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'
import { buildNewsPermalink } from '@/lib/newsLinks'

const baseInput =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400'
const textareaInput = `${baseInput} min-h-[120px]`

type TemplateOption = {
  id: number
  title: string
  subject: string | null
  logo: string | null
  banner: string | null
  footer: string | null
  content: string | null
}

type NewsItem = {
  id: number
  isoDate: string | null
  titleEn: string | null
  titleKo: string | null
  translationEn: string | null
  translationKo: string | null
}

type PushContentForm = {
  title: string
  subject: string
  logo: string
  banner: string
  footer: string
  content: string
  date: string
}

const initialForm: PushContentForm = {
  title: '',
  subject: '',
  logo: '',
  banner: '',
  footer: '',
  content: '',
  date: '',
}

export default function PushContentCreatePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState<PushContentForm>({ ...initialForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templateLoading, setTemplateLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('')
  const [newsModalOpen, setNewsModalOpen] = useState(false)
  const [newsLanguage, setNewsLanguage] = useState<'EN' | 'KO'>('EN')
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [newsSelected, setNewsSelected] = useState<number[]>([])
  const [newsGenerating, setNewsGenerating] = useState(false)

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchTemplates = async () => {
      try {
        setTemplateLoading(true)

        const response = await fetch('/api/v1/admin/template', {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`加载模版失败: ${response.status}`)
        }

        const body = (await response.json()) as {
          success?: boolean
          data?: { templates?: Array<Record<string, unknown>> }
          message?: string
        }

        if (cancelled) {
          return
        }

        if (body.success === false) {
          throw new Error(body.message || '加载模版失败')
        }

        const list = (body.data?.templates ?? []).map((item) => ({
          id: Number(item.id),
          title: typeof item.title === 'string' ? item.title : '',
          subject: (item.subject as string | null) ?? null,
          logo: (item.logo as string | null) ?? null,
          banner: (item.banner as string | null) ?? null,
          footer: (item.footer as string | null) ?? null,
          content: (item.content as string | null) ?? null,
        }))

        setTemplates(list)
      } catch (fetchError) {
        if (cancelled) {
          return
        }
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return
        }
        const messageText = fetchError instanceof Error ? fetchError.message : '加载模版失败'
        setError(messageText)
      } finally {
        if (!cancelled) {
          setTemplateLoading(false)
        }
      }
    }

    void fetchTemplates()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isAuthenticated, isLoading])

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
          isoDate: (item.isoDate as string | null) ?? null,
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

  const handleTemplateApply = () => {
    if (selectedTemplate === '' || templateLoading || saving) {
      return
    }

    const numericId = typeof selectedTemplate === 'number' ? selectedTemplate : Number(selectedTemplate)
    const template = templates.find((item) => item.id === numericId)
    if (!template) {
      return
    }

    setForm((prev) => ({
      ...prev,
      title: template.title ?? prev.title,
      subject: template.subject ?? prev.subject,
      logo: template.logo ?? prev.logo,
      banner: template.banner ?? prev.banner,
      footer: template.footer ?? prev.footer,
      content: template.content ?? prev.content,
    }))
  }

  const toggleNewsSelection = (id: number) => {
    setNewsSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleApplyNews = () => {
    if (newsSelected.length === 0) {
      setNewsModalOpen(false)
      return
    }

    setNewsGenerating(true)

    const selected = newsItems.filter((item) => newsSelected.includes(item.id))
    const entries = selected.map((item) => {
      const rawTitle = newsLanguage === 'EN' ? item.titleEn ?? item.titleKo ?? '' : item.titleKo ?? item.titleEn ?? ''
      const rawTranslation = newsLanguage === 'EN' ? item.translationEn ?? item.translationKo ?? '' : item.translationKo ?? item.translationEn ?? ''
      const safeTitle = rawTitle.replace(/\s+/g, ' ').trim() || '无标题'
      const normalizedTranslation = rawTranslation.replace(/\s+/g, ' ').trim()
      const safeTranslation = normalizedTranslation === '' ? '无摘要' : normalizedTranslation
      const permalink = buildNewsPermalink(item.id)
      return `"${safeTitle}"\n"${safeTranslation}"\n链接：${permalink}`
    })

    const generated = `${entries.join('\n\n')}\n\n根据以上内容生成`

    setForm((prev) => ({
      ...prev,
      content: prev.content.trim() ? `${prev.content.trimEnd()}\n\n${generated}` : generated,
    }))

    setNewsGenerating(false)
    setNewsModalOpen(false)
    setNewsSelected([])
  }

  const handleChange = (field: keyof PushContentForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (saving) {
      return
    }

    if (!form.content.trim()) {
      setError('请先填写提示词内容')
      return
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const nowDate = nowIso.slice(0, 10)
    const applyDatePlaceholder = (value: string) => value.replaceAll('{{date}}', nowDate)

    const payload = {
      title: applyDatePlaceholder(form.title),
      subject: applyDatePlaceholder(form.subject),
      logo: applyDatePlaceholder(form.logo),
      banner: applyDatePlaceholder(form.banner),
      footer: applyDatePlaceholder(form.footer),
      prompt: form.content,
      date: nowIso,
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/v1/admin/push-content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = (await response.json()) as { success?: boolean; message?: string }

      if (!response.ok || body.success === false) {
        throw new Error(body.message || '生成推送内容失败')
      }

      setMessage(body.message ?? '推送内容已生成')

      setTimeout(() => {
        router.push('/admin/push-content')
      }, 800)
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : '生成推送内容失败'
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
                <p className="text-gray-600 mt-1">填写推送邮件内容并保存，published 默认为未发布</p>
              </div>
              <button
                type="button"
                onClick={() => router.push('/admin/push-content')}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                返回列表
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">模版选择</label>
                  <select
                    value={selectedTemplate === '' ? '' : String(selectedTemplate)}
                    onChange={(event) => {
                      const value = event.target.value
                      setSelectedTemplate(value === '' ? '' : Number(value))
                    }}
                    className={`${baseInput} bg-white`}
                    disabled={templateLoading || saving}
                  >
                    <option value="">
                      {templateLoading ? '加载模版中...' : '请选择模版'}
                    </option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title || `模版 ${template.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleTemplateApply}
                  disabled={selectedTemplate === '' || saving || templateLoading}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  应用模版
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <span className="mb-2 block text-sm font-medium text-gray-700">新闻选择</span>
                  <p className="text-xs text-gray-500">从已发布新闻中挑选内容，自动填充至正文区域</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewsModalOpen(true)
                    setNewsSelected([])
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  disabled={saving}
                >
                  选择内容
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => handleChange('title', event.target.value)}
                  className={baseInput}
                  placeholder="推送标题"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(event) => handleChange('subject', event.target.value)}
                  className={baseInput}
                  placeholder="邮件主题"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Logo URL</label>
                <input
                  type="text"
                  value={form.logo}
                  onChange={(event) => handleChange('logo', event.target.value)}
                  className={baseInput}
                  placeholder="https://example.com/logo.png"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Banner</label>
                <textarea
                  value={form.banner}
                  onChange={(event) => handleChange('banner', event.target.value)}
                  className={textareaInput}
                  placeholder="顶部 Banner 内容（可选）"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Footer</label>
                <textarea
                  value={form.footer}
                  onChange={(event) => handleChange('footer', event.target.value)}
                  className={textareaInput}
                  placeholder="页脚内容"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Content</label>
                <textarea
                  value={form.content}
                  onChange={(event) => handleChange('content', event.target.value)}
                  className={textareaInput}
                  placeholder="推送正文内容"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <span className="block text-sm font-medium text-gray-700">生成时间</span>
                <p className="mt-1 text-sm text-gray-500">保存后会自动记录当前时间，无需填写。</p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/admin/push-content')}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  disabled={saving}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={saving}
                >
                  {saving ? '保存中...' : '保存推送内容'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>

      {newsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-5xl rounded-lg bg-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">选择新闻</h2>
                <p className="text-sm text-gray-500">选择要引用的新闻并插入正文</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewsLanguage('EN')}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    newsLanguage === 'EN' ? 'bg-black text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  英文
                </button>
                <button
                  type="button"
                  onClick={() => setNewsLanguage('KO')}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${
                    newsLanguage === 'KO' ? 'bg-black text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  韩文
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewsModalOpen(false)
                    setNewsSelected([])
                  }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  关闭
                </button>
              </div>
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
                      const rawTitle = newsLanguage === 'EN' ? item.titleEn ?? item.titleKo ?? '' : item.titleKo ?? item.titleEn ?? ''
                      const rawTranslation = newsLanguage === 'EN' ? item.translationEn ?? item.translationKo ?? '' : item.translationKo ?? item.translationEn ?? ''
                      const safeTitle = rawTitle.replace(/\s+/g, ' ').trim()
                      const normalizedPreview = rawTranslation.replace(/\s+/g, ' ').trim()
                      const previewText = normalizedPreview === '' ? '无摘要' : normalizedPreview
                      const displayPreview = previewText.length > 160 ? `${previewText.slice(0, 160)}...` : previewText

                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer flex-col gap-1 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{safeTitle || '无标题'}</p>
                              <p className="mt-1 text-sm text-gray-600 line-clamp-3">{displayPreview}</p>
                              {item.isoDate && (
                                <p className="mt-1 text-xs text-gray-400">{item.isoDate}</p>
                              )}
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
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                disabled={newsGenerating}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApplyNews}
                className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={newsGenerating || newsSelected.length === 0}
              >
                {newsGenerating ? '生成中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
