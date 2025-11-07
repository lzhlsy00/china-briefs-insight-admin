'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'

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

const initialForm: TemplateForm = {
  logo: '',
  title: '',
  subject: '',
  content: '',
  banner: '',
  footer: '',
}

export default function TemplateCreatePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [form, setForm] = useState<TemplateForm>({ ...initialForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleChange = (field: keyof TemplateForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (saving) {
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/v1/admin/template', {
        method: 'POST',
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

      setMessage(body.message ?? '模版已保存')
      setForm({ ...initialForm })

      const templateId = Number(body.data?.template?.id ?? NaN)

      if (!Number.isNaN(templateId)) {
        const shouldActivate = confirm('模版已保存，是否设为当前模版？')

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
      }

      setTimeout(() => {
        router.push('/admin/template')
      }, 800)
    } catch (submitError) {
      const messageText = submitError instanceof Error ? submitError.message : '保存模版失败'
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
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <main className="ml-64 p-6">
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">新增模版</h1>
              <p className="text-gray-600 mt-1">填写推送邮件模版内容，并保存到 Supabase</p>
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
    </div>
  )
}
