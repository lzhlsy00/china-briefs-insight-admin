'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type SendEmailRecord = {
  userMail: string | null
  title: string | null
  date: string | null
  isDelivered: boolean | null
  mailContentId: number | null
  createdAt: string | null
}

type SendEmailResponse = {
  success: boolean
  data?: {
    records: SendEmailRecord[]
    pagination: {
      current: number
      limit: number
      totalCount: number
      totalPages: number
    }
  }
  message?: string
}

export const useSendEmailLogs = (initialPage = 1, initialLimit = 20) => {
  const [records, setRecords] = useState<SendEmailRecord[]>([])
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async (targetPage = page, targetLimit = limit) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(targetLimit),
      })

      const response = await fetch(`/api/v1/admin/send-email?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = (await response.json()) as SendEmailResponse
      if (!payload.success || !payload.data) {
        throw new Error(payload.message || 'Failed to load send email logs')
      }

      setRecords(payload.data.records)
      setPage(payload.data.pagination.current)
      setLimit(payload.data.pagination.limit)
      setTotalPages(payload.data.pagination.totalPages)
      setTotalCount(payload.data.pagination.totalCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    void fetchLogs(initialPage, initialLimit)
  }, [fetchLogs, initialPage, initialLimit])

  const reload = useCallback(() => {
    void fetchLogs(page, limit)
  }, [fetchLogs, page, limit])

  const info = useMemo(() => ({
    page,
    limit,
    totalPages,
    totalCount,
  }), [page, limit, totalPages, totalCount])

  return {
    records,
    loading,
    error,
    pagination: info,
    setPage,
    setLimit,
    reload,
  }
}

