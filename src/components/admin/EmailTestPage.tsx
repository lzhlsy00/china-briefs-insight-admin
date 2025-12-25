'use client'

import React, { useState } from 'react'

export default function EmailTestPage() {
  const [email, setEmail] = useState('')
  const [locale, setLocale] = useState<'EN' | 'KO'>('EN')
  const [testType, setTestType] = useState<'resend' | 'full'>('resend')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')

  const runTest = async () => {
    if (!email) {
      setError('请输入测试邮箱')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/v1/admin/test-email-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, testType })
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.message || '测试失败')
      } else {
        setResult(data.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">邮件发送测试工具</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              测试邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="test@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              语言
            </label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'EN' | 'KO')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="EN">English</option>
              <option value="KO">Korean</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              测试类型
            </label>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as 'resend' | 'full')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="resend">仅测试 Resend API</option>
              <option value="full">完整测试（包括 Supabase Function）</option>
            </select>
          </div>

          <button
            onClick={runTest}
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '测试中...' : '开始测试'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">测试结果</h2>
          <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}