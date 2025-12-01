'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useSendEmailLogs } from '@/hooks/useSendEmailLogs'

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

type DeliveryState = boolean | 'mixed' | null

const DeliveryStatus = ({ delivered }: { delivered: DeliveryState }) => {
  let label = 'Unknown'
  let style = 'bg-gray-100 text-gray-700'

  if (delivered === true) {
    label = 'Delivered'
    style = 'bg-green-100 text-green-700'
  } else if (delivered === false) {
    label = 'Failed'
    style = 'bg-red-100 text-red-700'
  } else if (delivered === 'mixed') {
    label = 'Mixed'
    style = 'bg-yellow-100 text-yellow-700'
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${style}`}>
      {label}
    </span>
  )
}

export const SendEmailTable = () => {
  const { records, loading, error, pagination, setPage, reload } = useSendEmailLogs()
  const [modalInfo, setModalInfo] = useState<{ title: string; emails: string[] } | null>(null)
  const [pageInput, setPageInput] = useState('1')

  useEffect(() => {
    if (pagination.page) {
      setPageInput(String(pagination.page))
    }
  }, [pagination.page])

  const groupedRecords = useMemo(() => {
    const map = new Map<string, {
      title: string
      latestTimestamp: number | null
      latestRawDate: string | null
      deliveryStates: Array<boolean | null>
      emails: string[]
    }>()

    records.forEach((record) => {
      const groupKey = record.title ?? 'Untitled'
      const existing = map.get(groupKey)
      const timestamp = record.date ? new Date(record.date).getTime() : null

      if (existing) {
        if (timestamp !== null && !Number.isNaN(timestamp)) {
          if (existing.latestTimestamp === null || timestamp > existing.latestTimestamp) {
            existing.latestTimestamp = timestamp
            existing.latestRawDate = record.date
          }
        }
        existing.deliveryStates.push(record.isDelivered)
        existing.emails.push(record.userMail ?? '-')
      } else {
        map.set(groupKey, {
          title: groupKey,
          latestTimestamp: timestamp !== null && !Number.isNaN(timestamp) ? timestamp : null,
          latestRawDate: timestamp !== null && !Number.isNaN(timestamp) ? record.date : null,
          deliveryStates: [record.isDelivered],
          emails: [record.userMail ?? '-'],
        })
      }
    })

    return Array.from(map.values()).map((group) => {
      const hasDelivered = group.deliveryStates.some((state) => state === true)
      const hasFailed = group.deliveryStates.some((state) => state === false)

      const delivered: DeliveryState = hasDelivered && hasFailed
        ? 'mixed'
        : hasDelivered
          ? true
          : hasFailed
            ? false
            : null

      return {
        title: group.title,
        date: group.latestRawDate,
        delivered,
        emails: group.emails,
      }
    })
  }, [records])

  const tableContent = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
            Loading...
          </td>
        </tr>
      )
    }

    if (error) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-4 text-center">
            <div className="text-red-500 mb-3">{error}</div>
            <button
              type="button"
              onClick={() => reload()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </td>
        </tr>
      )
    }

    if (groupedRecords.length === 0) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
            No records found
          </td>
        </tr>
      )
    }

    return groupedRecords.map((group) => (
      <tr key={group.title} className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{group.title}</td>
        <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(group.date)}</td>
        <td className="px-6 py-4">
          <DeliveryStatus delivered={group.delivered} />
        </td>
        <td className="px-6 py-4 text-sm">
          <button
            type="button"
            onClick={() => setModalInfo({ title: group.title, emails: group.emails })}
            className="px-3 py-1 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
          >
            查看
          </button>
        </td>
      </tr>
    ))
  }, [groupedRecords, loading, error, reload])

  const goToPage = (target: number) => {
    if (target < 1 || target > pagination.totalPages) {
      return
    }
    setPage(target)
  }

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^0-9]/g, '')
    setPageInput(value)
  }

  const handlePageJump = () => {
    const parsed = Number(pageInput)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setPageInput(String(pagination.page))
      return
    }
    const clamped = Math.min(Math.max(parsed, 1), Math.max(1, pagination.totalPages))
    setPage(clamped)
  }

  const handlePageInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handlePageJump()
    }
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivery Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Email</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tableContent}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
        <div>
          Page {pagination.page} of {Math.max(pagination.totalPages, 1)} · {pagination.totalCount} records
        </div>
        <div className="flex items-center gap-3">
          <div className="space-x-2">
            <button
              type="button"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="send-email-jump" className="text-sm text-gray-600">
              Jump to
            </label>
            <input
              id="send-email-jump"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pageInput}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              disabled={loading}
              className="w-16 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={handlePageJump}
              disabled={loading}
              className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </div>
        </div>
      </div>

      {modalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h2 className="text-lg font-semibold text-gray-900">{modalInfo.title} · 用户邮箱</h2>
              <button
                type="button"
                onClick={() => setModalInfo(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto px-5 py-4 space-y-2">
              {modalInfo.emails.map((email, index) => (
                <div key={`${email}-${index}`} className="text-sm text-gray-700">
                  {email}
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-gray-200 px-5 py-3">
              <button
                type="button"
                onClick={() => setModalInfo(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
