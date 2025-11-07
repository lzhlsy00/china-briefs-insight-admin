'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const baseInput =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400'
const textareaInput = `${baseInput} min-h-[120px]`

type TemplateForm = {
  logo: string
  title: string
  subject: string
  content: string
  banner: string
  footer: string
}

type TemplateRecord = TemplateForm & { id: number }

const emptyForm: TemplateForm = {
  logo: '',
  title: '',
  subject: '',
  content: '',
  banner: '',
  footer: '',
}

const toFormValue = (raw: TemplateRecord): TemplateForm => ({
  logo: raw.logo ?? '',
  title: raw.title ?? '',
  subject: raw.subject ?? '',
  content: raw.content ?? '',
  banner: raw.banner ?? '',
  footer: raw.footer ?? '',
})

const isImageUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  try {
    const url = new URL(trimmed)
    return /\.(png|jpe?g|gif|svg|webp)$/i.test(url.pathname)
  } catch {
    return false
  }
}

export default function TemplateEditPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const rawId = params?.id
  const templateId = useMemo(() => {
    const id = rawId
    if (!id || Number.isNaN(Number(id))) {
      return null
    }
    return Number(id)
  }, [rawId])

  const [form, setForm] = useState<TemplateForm>({ ...emptyForm })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return
    }

    if (templateId === null) {
      setError('模版 ID 无效')
      setLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchTemplate = async () => {
      try {
        setLoading(true)
        setError(null)
        setMessage(null)

        const response = await fetch(`/api/v1/admin/template/${templateId}`, {
          method: 'GET',
          signal: controller.signal,
        })

        const body = (await response.json()) as {
          success?: boolean
          data?: { template: TemplateRecord | null }
          message?: string
        }

        if (cancelled) {
          return
        }

        if (!response.ok || body.success === false) {
          throw new Error(body.message || '加载模版失败')
        }

        if (!body.data?.template) {
          throw new Error('模版不存在或已被删除')
        }

        setForm(toFormValue(body.data.template))
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
          setLoading(false)
        }
      }
    }

    void fetchTemplate()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isAuthenticated, isLoading, templateId])

  const handleChange = (field: keyof TemplateForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (saving || templateId === null) {
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(`/api/v1/admin/template/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const body = (await response.json()) as {
        success?: boolean
        message?: string
        data?: { template?: Record<string, unknown> | null }
      }

      if (!response.ok || body.success === false) {
        throw new Error(body.message || '保存模版失败')
      }

      setMessage(body.message ?? '模版已更新')

      const shouldActivate = confirm('模版已更新，是否设为当前模版？')

      if (shouldActivate) {
        try {
          const activateResponse = await fetch(`/api/v1/admin/template/${templateId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isActive: true }),
          })

          const activateBody = (await activateResponse.json()) as {
            success?: boolean
            message?: string
          }

          if (!activateResponse.ok || activateBody.success === false) {
            throw new Error(activateBody.message || '设为当前模版失败')
          }

          setMessage((prev) => (prev ? `${prev}（已设为当前模版）` : '模版已设为当前'))
        } catch (activateError) {
          const activateMessage = activateError instanceof Error ? activateError.message : '设为当前模版失败'
          setError(activateMessage)
        }
      }
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : '保存模版失败'
      setError(messageText)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || loading) {
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
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">编辑模版</h1>
              <p className="text-gray-600 mt-1">更新推送邮件模版内容</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/admin/template')}
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

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Logo</label>
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
              <label className="mb-2 block text-sm font-medium text-gray-700">Title</label>
              <textarea
                value={form.title}
                onChange={(event) => handleChange('title', event.target.value)}
                className={textareaInput}
                placeholder="邮件标题（Markdown 支持）"
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Subject</label>
              <textarea
                value={form.subject}
                onChange={(event) => handleChange('subject', event.target.value)}
                className={textareaInput}
                placeholder="邮件主题"
                disabled={saving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Content</label>
              <textarea
                value={form.content}
                onChange={(event) => handleChange('content', event.target.value)}
                className={textareaInput}
                placeholder="邮件正文内容"
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

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push('/admin/template')}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={saving}
              >
                预览
              </button>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={saving}
              >
                {saving ? '保存中...' : '保存模版'}
              </button>
            </div>
          </form>
        </div>
      </main>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="relative w-full max-w-4xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">模版预览</h2>
                <p className="text-sm text-gray-500">以下为当前表单内容渲染后的效果</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                关闭
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-6 text-sm text-gray-800">
              {(['logo', 'title', 'subject', 'content', 'banner', 'footer'] as const)
                .map((key) => form[key]?.trim())
                .map((value, index) => ({ key: index, value }))
                .filter((item) => Boolean(item.value))
                .map((item) => (
                  <div key={item.key} className="prose prose-sm max-w-none">
                    {item.value && isImageUrl(item.value) ? (
                      <div className="overflow-auto">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.value}
                          alt="Template media"
                          className="block"
                          style={{ transform: 'scale(0.1666667)', transformOrigin: 'top left' }}
                        />
                      </div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none">
                        {item.value ?? ''}
                      </ReactMarkdown>
                    )}
                  </div>
                ))}

              {!form.logo && !form.title && !form.subject && !form.content && !form.banner && !form.footer && (
                <p className="text-sm text-gray-500">暂无可预览内容，请先在表单中填写模版字段。</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
