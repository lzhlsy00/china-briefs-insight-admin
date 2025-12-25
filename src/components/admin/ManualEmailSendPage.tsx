'use client'

import React, { useState, useEffect } from 'react'

interface PushContent {
  id: number
  title: string
  local: string
  published: boolean
  date: string
}

interface SendResult {
  results?: {
    attempted: number
    delivered: number
    failed: number
    failures?: Array<{
      email: string
      error: string
      details?: unknown
    }>
  }
  [key: string]: unknown
}

export default function ManualEmailSendPage() {
  const [contents, setContents] = useState<PushContent[]>([])
  const [selectedContent, setSelectedContent] = useState<number | null>(null)
  const [testMode, setTestMode] = useState(true)
  const [ignoreLocale, setIgnoreLocale] = useState(false)
  const [forceResend, setForceResend] = useState(false)
  const [specificEmails, setSpecificEmails] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [error, setError] = useState('')

  // 加载推送内容列表
  useEffect(() => {
    fetchContents()
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

  const sendEmails = async () => {
    if (!selectedContent) {
      setError('请选择要发送的内容')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const emails = specificEmails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(e => e)

      const response = await fetch('/api/v1/admin/send-email-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: selectedContent,
          testMode,
          ignoreLocale,
          forceResend,
          specificEmails: emails.length > 0 ? emails : undefined
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.message || '发送失败')
      } else {
        setResult(data.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  const selectedContentInfo = contents.find(c => c.id === selectedContent)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">手动邮件发送工具</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：内容选择和选项 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">选择推送内容</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                推送内容
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

            {selectedContentInfo && (
              <div className="p-3 bg-gray-50 rounded-md text-sm">
                <p><strong>标题:</strong> {selectedContentInfo.title}</p>
                <p><strong>语言:</strong> {selectedContentInfo.local === 'KO' ? '韩文' : '英文'}</p>
                <p><strong>状态:</strong> {selectedContentInfo.published ? '已发布' : '未发布'}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                发送选项
              </label>
              
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    测试模式（忽略订阅状态，向所有用户发送）
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={ignoreLocale}
                    onChange={(e) => setIgnoreLocale(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    忽略语言匹配（向所有语言的用户发送）
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={forceResend}
                    onChange={(e) => setForceResend(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    强制重发（忽略已发送记录）
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                特定邮箱（可选，逗号或换行分隔）
              </label>
              <textarea
                value={specificEmails}
                onChange={(e) => setSpecificEmails(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="user1@example.com, user2@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                如果填写，将只向这些邮箱发送
              </p>
            </div>

            <button
              onClick={sendEmails}
              disabled={loading || !selectedContent}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? '发送中...' : '开始发送'}
            </button>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：结果显示 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">发送结果</h2>
          
          {result ? (
            <div className="space-y-4">
              {result.results && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-md">
                    <div className="text-2xl font-bold">{result.results.attempted}</div>
                    <div className="text-sm text-gray-600">尝试发送</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-md">
                    <div className="text-2xl font-bold text-green-600">{result.results.delivered}</div>
                    <div className="text-sm text-gray-600">发送成功</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-md">
                    <div className="text-2xl font-bold text-red-600">{result.results.failed}</div>
                    <div className="text-sm text-gray-600">发送失败</div>
                  </div>
                </div>
              )}

              {result.results?.failures && result.results.failures.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">失败详情:</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {result.results.failures.map((failure, idx) => (
                      <div key={idx} className="p-2 bg-red-50 rounded text-sm">
                        <p><strong>{failure.email}</strong></p>
                        <p className="text-red-600">{failure.error}</p>
                        {failure.details != null && (
                          <pre className="mt-1 text-xs overflow-x-auto">
                            {JSON.stringify(failure.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <h3 className="font-medium mb-2">完整响应:</h3>
                <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">还未发送邮件</p>
          )}
        </div>
      </div>
    </div>
  )
}