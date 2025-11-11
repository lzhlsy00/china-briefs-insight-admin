'use client'

import { FormEvent, use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'

const baseInput =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400'
const textareaInput = `${baseInput} min-h-[120px]`

type PushContentRecord = {
  id: number
  title: string | null
  subject: string | null
  logo: string | null
  banner: string | null
  footer: string | null
  content: string | null
  date: string | null
  published: boolean | null
  local: string | null
}

type PushContentForm = {
  title: string
  subject: string
  logo: string
  banner: string
  footer: string
  content: string
  date: string
  local: string
}

type PageProps = {
  params: Promise<{ id: string }>
}

const initialFormState: PushContentForm = {
  title: '',
  subject: '',
  logo: '',
  banner: '',
  footer: '',
  content: '',
  date: '',
  local: 'zh-CN',
}

const normalizeString = (value: string | null | undefined) => value ?? ''

const toDatetimeLocal = (value: string | null | undefined) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 16)
}

export default function PushContentDetailPage({ params }: PageProps) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const resolvedParams = use(params)
  const recordId = useMemo(() => Number(resolvedParams.id), [resolvedParams.id])

  const [form, setForm] = useState<PushContentForm>({ ...initialFormState })
  const [published, setPublished] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (Number.isNaN(recordId)) {
      setLoadError('无效的推送内容 ID')
      setLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchRecord = async () => {
      try {
        setLoading(true)
        setLoadError(null)

        const response = await fetch(`/api/v1/admin/push-content/${recordId}`, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`加载推送内容失败: ${response.status}`)
        }

        const body = (await response.json()) as {
          success?: boolean
          data?: { pushContent?: PushContentRecord }
          message?: string
        }

        if (cancelled) return

        if (body.success === false) {
          throw new Error(body.message || '加载推送内容失败')
        }

        const record = body.data?.pushContent
        if (!record) {
          throw new Error('未找到推送内容')
        }

        setForm({
          title: normalizeString(record.title),
          subject: normalizeString(record.subject),
          logo: normalizeString(record.logo),
          banner: normalizeString(record.banner),
          footer: normalizeString(record.footer),
          content: normalizeString(record.content),
          date: toDatetimeLocal(record.date),
          local: normalizeString(record.local) || 'zh-CN',
        })
        setPublished(typeof record.published === 'boolean' ? record.published : null)
      } catch (fetchError) {
        if (cancelled) return
        const messageText = fetchError instanceof Error ? fetchError.message : '加载推送内容失败'
        setLoadError(messageText)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchRecord()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [recordId])

  const handleChange = (field: keyof PushContentForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (saving || loading || Number.isNaN(recordId)) {
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(`/api/v1/admin/push-content/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          subject: form.subject || null,
          logo: form.logo || null,
          banner: form.banner || null,
          footer: form.footer || null,
          content: form.content,
          date: form.date ? new Date(form.date).toISOString() : null,
          local: form.local || 'zh-CN',
        }),
      })

      const body = (await response.json()) as { success?: boolean; message?: string }

      if (!response.ok || body.success === false) {
        throw new Error(body.message || '保存推送内容失败')
      }

      setMessage(body.message ?? '推送内容已更新')
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : '保存推送内容失败'
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

  if (Number.isNaN(recordId)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="rounded-lg bg-white px-6 py-10 shadow-md text-center text-gray-700">
          无效的推送内容 ID
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <main className="ml-64 p-6">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                查看推送内容
                {published === null ? null : published ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    已发布
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    未发布
                  </span>
                )}
              </h1>
              <p className="text-gray-600 mt-1">查看并更新推送内容信息</p>
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
            {loading && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                正在加载推送内容...
              </div>
            )}

            {loadError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                {loadError}
              </div>
            )}

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

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => handleChange('title', event.target.value)}
                className={baseInput}
                placeholder="推送标题"
                disabled={saving || loading}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Locale</label>
              <input
                type="text"
                value={form.local}
                onChange={(event) => handleChange('local', event.target.value)}
                className={baseInput}
                placeholder="例如：zh-CN、en-US"
                disabled={saving || loading}
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
                disabled={saving || loading}
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
                disabled={saving || loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Banner</label>
              <textarea
                value={form.banner}
                onChange={(event) => handleChange('banner', event.target.value)}
                className={textareaInput}
                placeholder="顶部 Banner 内容（可选）"
                disabled={saving || loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Footer</label>
              <textarea
                value={form.footer}
                onChange={(event) => handleChange('footer', event.target.value)}
                className={textareaInput}
                placeholder="页脚内容"
                disabled={saving || loading}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Content</label>
              <textarea
                value={form.content}
                onChange={(event) => handleChange('content', event.target.value)}
                className={textareaInput}
                placeholder="推送正文内容"
                disabled={saving || loading}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Date</label>
              <input
                type="datetime-local"
                value={form.date}
                onChange={(event) => handleChange('date', event.target.value)}
                className={baseInput}
                disabled={saving || loading}
              />
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
                disabled={saving || loading}
              >
                {saving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
