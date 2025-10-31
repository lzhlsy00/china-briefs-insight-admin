'use client'

import { useMemo } from 'react'
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

const DeliveryStatus = ({ delivered }: { delivered: boolean | null }) => {
  const status = delivered === true ? 'Delivered' : delivered === false ? 'Failed' : 'Unknown'
  const style = delivered === true
    ? 'bg-green-100 text-green-700'
    : delivered === false
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-700'

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${style}`}>
      {status}
    </span>
  )
}

export const SendEmailTable = () => {
  const { records, loading, error, pagination, setPage, reload } = useSendEmailLogs()

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

    if (records.length === 0) {
      return (
        <tr>
          <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
            No records found
          </td>
        </tr>
      )
    }

    return records.map((record, index) => (
      <tr key={`${record.userMail}-${record.createdAt}-${index}`} className="hover:bg-gray-50">
        <td className="px-6 py-4 text-sm text-gray-700">{record.userMail ?? '-'}</td>
        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{record.title ?? 'Untitled'}</td>
        <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(record.date)}</td>
        <td className="px-6 py-4">
          <DeliveryStatus delivered={record.isDelivered} />
        </td>
      </tr>
    ))
  }, [records, loading, error, reload])

  const goToPage = (target: number) => {
    if (target < 1 || target > pagination.totalPages) {
      return
    }
    setPage(target)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tableContent}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm text-gray-600">
        <div>
          Page {pagination.page} of {Math.max(pagination.totalPages, 1)} · {pagination.totalCount} records
        </div>
        <div className="space-x-2">
          <button
            type="button"
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-3 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

