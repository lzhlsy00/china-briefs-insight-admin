'use client'

import React, { useState, useEffect } from 'react'

interface PushContent {
  id: number
  title: string
  local: string
  published: boolean
  date: string
}

interface Queue {
  queueId: number
  contentId: number
  status: string
  progress: string
  results: {
    attempted: number
    delivered: number
    failed: number
    failures: Array<{ email: string; error: string }>
  }
  startedAt: string
  lastSentAt?: string
}

export default function EmailQueuePage() {
  const [contents, setContents] = useState<PushContent[]>([])
  const [selectedContent, setSelectedContent] = useState<number | null>(null)
  const [testMode, setTestMode] = useState(true)
  const [ignoreLocale, setIgnoreLocale] = useState(false)
  const [forceResend, setForceResend] = useState(false)
  const [loading, setLoading] = useState(false)
  const [queues, setQueues] = useState<Queue[]>([])
  const [currentQueueId, setCurrentQueueId] = useState<number | null>(null)
  const [error, setError] = useState('')

  // 加载内容列表
  useEffect(() => {
    fetchContents()
  }, [])

  // 定期刷新队列状态
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueues()
    }, 2000) // 每2秒刷新一次

    return () => clearInterval(interval)
  }, [])

  const fetchContents = async () => {
    try {
      const response = await fetch('/api/v1/admin/push-content?limit=20')
      const data = await response.json()
      if (data.success) {
        setContents(data.data.records || [])
      }
    } catch (err) {
      console.error('加载内容失败:', err)
    }
  }

  const fetchQueues = async () => {
    try {
      const response = await fetch('/api/v1/admin/email-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' })
      })
      const data = await response.json()
      if (data.success) {
        setQueues(data.data.queues || [])
      }
    } catch (err) {
      console.error('获取队列状态失败:', err)
    }
  }

  const createQueue = async () => {
    if (!selectedContent) {
      setError('请选择要发送的内容')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/v1/admin/email-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          contentId: selectedContent,
          options: {
            testMode,
            ignoreLocale,
            forceResend
          }
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.message || '创建队列失败')
      } else {
        setCurrentQueueId(data.data.queueId)
        await fetchQueues()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  const pauseQueue = async (queueId: number) => {
    await fetch('/api/v1/admin/email-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', queueId })
    })
    await fetchQueues()
  }

  const resumeQueue = async (queueId: number) => {
    await fetch('/api/v1/admin/email-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume', queueId })
    })
    await fetchQueues()
  }

  const clearQueues = async () => {
    await fetch('/api/v1/admin/email-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' })
    })
    await fetchQueues()
  }

  const selectedContentInfo = contents.find(c => c.id === selectedContent)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">邮件队列发送系统</h1>
      
      {/* 创建新队列 */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">创建发送队列</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择推送内容
            </label>
            <select
              value={selectedContent || ''}
              onChange={(e) => setSelectedContent(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">选择内容...</option>
              {contents.map(content => (
                <option key={content.id} value={content.id}>
                  [{content.local}] {content.title} - {content.date}
                  {content.published && ' (已发布)'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => setTestMode(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">测试模式（忽略订阅状态）</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={ignoreLocale}
                onChange={(e) => setIgnoreLocale(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">忽略语言匹配</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={forceResend}
                onChange={(e) => setForceResend(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">强制重发</span>
            </label>
          </div>
        </div>

        {selectedContentInfo && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
            <p><strong>内容:</strong> {selectedContentInfo.title}</p>
            <p><strong>语言:</strong> {selectedContentInfo.local === 'KO' ? '韩文' : '英文'}</p>
            <p className="text-orange-600 mt-2">
              ⚠️ 创建队列后，系统将每3秒自动发送一封邮件，直到所有邮件发送完成
            </p>
          </div>
        )}

        <button
          onClick={createQueue}
          disabled={loading || !selectedContent}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? '创建中...' : '创建发送队列'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* 队列列表 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">活动队列</h2>
          <button
            onClick={clearQueues}
            className="text-sm px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            清除已完成队列
          </button>
        </div>
        
        {queues.length === 0 ? (
          <p className="text-gray-500">暂无活动队列</p>
        ) : (
          <div className="space-y-4">
            {queues.map(queue => {
              const isCurrentQueue = queue.queueId === currentQueueId
              const statusColor = {
                running: 'bg-green-100 text-green-800',
                paused: 'bg-yellow-100 text-yellow-800',
                completed: 'bg-gray-100 text-gray-800'
              }[queue.status] || 'bg-gray-100 text-gray-800'

              return (
                <div 
                  key={queue.queueId} 
                  className={`border rounded-lg p-4 ${isCurrentQueue ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-sm text-gray-500">队列 #{queue.queueId}</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs ${statusColor}`}>
                        {queue.status}
                      </span>
                    </div>
                    <div className="space-x-2">
                      {queue.status === 'running' && (
                        <button
                          onClick={() => pauseQueue(queue.queueId)}
                          className="text-sm px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          暂停
                        </button>
                      )}
                      {queue.status === 'paused' && (
                        <button
                          onClick={() => resumeQueue(queue.queueId)}
                          className="text-sm px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          继续
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                    <div>
                      <p className="text-xs text-gray-500">进度</p>
                      <p className="font-medium">{queue.progress}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">成功</p>
                      <p className="font-medium text-green-600">{queue.results.delivered}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">失败</p>
                      <p className="font-medium text-red-600">{queue.results.failed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">最后发送</p>
                      <p className="text-sm">{queue.lastSentAt ? new Date(queue.lastSentAt).toLocaleTimeString() : '-'}</p>
                    </div>
                  </div>

                  {queue.results.failures.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-red-600">
                        查看失败详情 ({queue.results.failures.length})
                      </summary>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {queue.results.failures.map((failure, idx) => (
                          <div key={idx} className="text-xs p-1 bg-red-50 rounded mb-1">
                            {failure.email}: {failure.error}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}