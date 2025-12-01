'use client'

import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import AdminSidebar from '@/components/admin/AdminSidebar'
import LoginPage from '@/components/admin/LoginPage'
import { useAuth } from '@/hooks/useAuth'

const tableWrapperClass = 'mt-6 overflow-x-auto overflow-y-visible rounded-lg border border-gray-200 bg-white'
const tableClass = 'min-w-full divide-y divide-gray-200'
const thClass = 'px-4 py-3 text-left text-sm font-semibold text-gray-700 bg-gray-50'
const tdClass = 'px-4 py-3 text-sm text-gray-700'

const formatCell = (value: string | null | undefined) => {
  if (!value) {
    return <span className="text-gray-400">—</span>
  }

  if (value.length <= 80) {
    return value
  }

  return `${value.slice(0, 77)}...`
}

type TemplateRecord = {
  id: number
  logo: string | null
  title: string | null
  subject: string | null
  content: string | null
  banner: string | null
  footer: string | null
  isActive: boolean
}

const normalizeTemplate = (raw: Record<string, unknown>): TemplateRecord => ({
  id: Number(raw.id),
  logo: (raw.logo as string | null) ?? null,
  title: (raw.title as string | null) ?? null,
  subject: (raw.subject as string | null) ?? null,
  content: (raw.content as string | null) ?? null,
  banner: (raw.banner as string | null) ?? null,
  footer: (raw.footer as string | null) ?? null,
  isActive: Boolean((raw.isActive as boolean | null | undefined) ?? (raw.is_active as boolean | null | undefined) ?? false),
})

export default function TemplatePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [data, setData] = useState<TemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ id: number; top: number; left: number } | null>(null)
  const [activatingId, setActivatingId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const PAGE_SIZE = 10

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const fetchTemplates = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/v1/admin/template', {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`加载模版失败: ${response.status}`)
        }

        const body = (await response.json()) as {
          success?: boolean
          data?: { templates?: TemplateRecord[] }
          message?: string
        }

        if (cancelled) {
          return
        }

        if (body.success === false) {
          throw new Error(body.message || '加载模版失败')
        }

        const templates = (body.data?.templates ?? []).map((item) => normalizeTemplate(item as unknown as Record<string, unknown>))
        setData(templates)
        setCurrentPage(1)
      } catch (fetchError) {
        if (cancelled) {
          return
        }
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return
        }
        const message = fetchError instanceof Error ? fetchError.message : '加载模版失败'
        setError(message)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchTemplates()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isAuthenticated, isLoading])

  const closeMenu = useCallback(() => {
    setActiveMenuId(null)
    setMenuPosition(null)
  }, [])

  useEffect(() => {
    if (activeMenuId === null) {
      return
    }

    const handleDismiss = () => {
      closeMenu()
    }

    document.addEventListener('click', handleDismiss)
    window.addEventListener('scroll', handleDismiss, true)
    window.addEventListener('resize', handleDismiss)

    return () => {
      document.removeEventListener('click', handleDismiss)
      window.removeEventListener('scroll', handleDismiss, true)
      window.removeEventListener('resize', handleDismiss)
    }
  }, [activeMenuId, closeMenu])

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE))

  useEffect(() => {
    setCurrentPage((prev) => {
      const clamped = Math.min(Math.max(prev, 1), totalPages)
      return clamped === prev ? prev : clamped
    })
  }, [totalPages])

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return data.slice(start, start + PAGE_SIZE)
  }, [data, currentPage, PAGE_SIZE])

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

  const pageStart = data.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageEnd = data.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, data.length)
  const isPageJumpDisabled = loading || data.length === 0

  const handleMenuToggle = (event: ReactMouseEvent<HTMLButtonElement>, id: number) => {
    event.stopPropagation()

    if (activeMenuId === id) {
      closeMenu()
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    setActiveMenuId(id)
    setMenuPosition({
      id,
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX,
    })
  }

  const handleDelete = async (id: number) => {
    closeMenu()
    const confirmDelete = confirm('确认删除该模版？此操作不可恢复。')
    if (!confirmDelete) {
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/v1/admin/template/${id}`, {
        method: 'DELETE',
      })

      const body = (await response.json()) as {
        success?: boolean
        message?: string
      }

      if (!response.ok || body.success === false) {
        throw new Error(body.message || '删除模版失败')
      }

      setData((prev) => prev.filter((item) => item.id !== id))
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : '删除模版失败'
      setError(message)
    }
  }

  const handleSetActive = async (id: number, nextActive: boolean) => {
    if (activatingId === id) {
      return
    }

    closeMenu()
    setActivatingId(id)
    setError(null)

    try {
      const response = await fetch(`/api/v1/admin/template/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: nextActive }),
      })

      const body = (await response.json()) as {
        success?: boolean
        data?: { template?: Record<string, unknown> | null }
        message?: string
      }

      if (!response.ok || body.success === false || !body.data?.template) {
        throw new Error(body.message || '更新模版状态失败')
      }

      const updatedTemplate = normalizeTemplate(body.data.template as unknown as Record<string, unknown>)
      setData((prev) =>
        prev.map((item) => {
          if (item.id === updatedTemplate.id) {
            return { ...updatedTemplate }
          }
          if (nextActive) {
            return { ...item, isActive: false }
          }
          return item
        })
      )
    } catch (activateError) {
      const message = activateError instanceof Error ? activateError.message : '更新模版状态失败'
      setError(message)
    } finally {
      setActivatingId(null)
    }
  }

  const handleMenuEdit = () => {
    if (activeMenuId === null) {
      return
    }
    router.push(`/admin/template/${activeMenuId}/edit`)
    closeMenu()
  }

  const handleMenuDelete = () => {
    if (activeMenuId === null) {
      return
    }
    void handleDelete(activeMenuId)
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
        <main className="ml-64 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Template</h1>
              <p className="text-gray-600 mt-1">Manage email templates stored in Supabase</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/admin/template/new')}
              className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              <span className="text-lg leading-none">＋</span>
              新增模版
            </button>
          </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className={tableWrapperClass}>
          {loading ? (
            <div className="p-6 text-sm text-gray-500">正在加载模版...</div>
          ) : data.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">暂无模版，请创建新模版。</div>
          ) : (
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>ID</th>
                  <th className={thClass}>Title</th>
                  <th className={thClass}>Subject</th>
                  <th className={thClass}>Logo</th>
                  <th className={thClass}>Content</th>
                  <th className={thClass}>Banner</th>
                  <th className={thClass}>Footer</th>
                  <th className={`${thClass} text-center`}>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedData.map((item) => (
                  <tr
                    key={item.id}
                    className={`relative hover:bg-gray-50 ${item.isActive ? 'bg-green-50/60' : ''} ${
                      activeMenuId === item.id ? 'z-20' : ''
                    }`}
                  >
                    <td className={`${tdClass} font-medium text-gray-900`}>{item.id}</td>
                    <td className={tdClass}>{formatCell(item.title)}</td>
                    <td className={tdClass}>{formatCell(item.subject)}</td>
                    <td className={tdClass}>{formatCell(item.logo)}</td>
                    <td className={tdClass}>{formatCell(item.content)}</td>
                    <td className={tdClass}>{formatCell(item.banner)}</td>
                    <td className={tdClass}>{formatCell(item.footer)}</td>
                    <td className={tdClass}>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSetActive(item.id, !item.isActive)}
                          disabled={activatingId === item.id}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition ${
                            item.isActive
                              ? 'bg-green-600 text-white'
                              : 'bg-white text-black hover:bg-gray-100'
                          } ${activatingId === item.id ? 'cursor-wait opacity-70' : ''}`}
                        >
                          {activatingId === item.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
                          ) : (
                            '激活'
                          )}
                        </button>

                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(event) => handleMenuToggle(event, item.id)}
                            className={`inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-gray-600 transition ${
                              activeMenuId === item.id ? 'bg-gray-200 font-semibold text-gray-900' : 'hover:bg-gray-200 hover:text-gray-800'
                            }`}
                            aria-haspopup="menu"
                            aria-expanded={activeMenuId === item.id}
                          >
                            <span className="text-lg leading-none font-semibold">…</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        {data.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 bg-gray-50 px-6 py-4 text-sm text-gray-600">
            <div>
              Showing <span className="font-medium">{pageStart}</span> to{' '}
              <span className="font-medium">{pageEnd}</span> of{' '}
              <span className="font-medium">{data.length}</span> templates
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
                <label htmlFor="template-page-jump" className="text-sm text-gray-600">
                  Jump to
                </label>
                <input
                  id="template-page-jump"
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
      </main>
      </div>
      <MenuPortal
        isOpen={activeMenuId !== null}
        position={
          activeMenuId !== null && menuPosition?.id === activeMenuId
            ? { top: menuPosition.top, left: menuPosition.left }
            : null
        }
        onEdit={handleMenuEdit}
        onDelete={handleMenuDelete}
      />
    </>
  )
}

const MenuPortal = ({
  isOpen,
  position,
  onEdit,
  onDelete,
}: {
  isOpen: boolean
  position: { top: number; left: number } | null
  onEdit: () => void
  onDelete: () => void
}) => {
  if (typeof document === 'undefined' || !isOpen || !position) {
    return null
  }

  return createPortal(
    <div
      className="fixed z-[1000] w-32 origin-top-right rounded-md border border-gray-200 bg-white shadow-xl"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-100%)',
      }}
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <button
        type="button"
        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
        onClick={(event) => {
          event.stopPropagation()
          onEdit()
        }}
      >
        编辑
      </button>
      <button
        type="button"
        className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
      >
        删除
      </button>
    </div>,
    document.body
  )
}
