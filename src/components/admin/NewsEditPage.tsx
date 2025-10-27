'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { NewsItem, NewsUpdateData } from '@/types/api'
import { useNewsApi } from '@/hooks/useNewsApi'

interface NewsEditPageProps {
  newsItem: NewsItem
  onBack: () => void
  onSave: (updatedNews: NewsItem) => void
}

export default function NewsEditPage({ newsItem, onBack, onSave }: NewsEditPageProps) {
  const [formData, setFormData] = useState<NewsUpdateData>({})
  const [languageMode, setLanguageMode] = useState<'EN' | 'KO'>('EN')
  const [saving, setSaving] = useState(false)
  const { updateNews, error, clearError } = useNewsApi()

  useEffect(() => {
    if (newsItem) {
      setFormData({
        title: newsItem.title,
        content: newsItem.content || '',
        category: newsItem.category || '',
        status: newsItem.status,
        titleKo: newsItem.titleKo ?? '',
        titleEn: newsItem.titleEn ?? '',
        translationKo: newsItem.translationKo ?? '',
        translationEn: newsItem.translationEn ?? '',
      })
      clearError()
    }
  }, [newsItem, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsItem) return

    setSaving(true)
    try {
      const updatedNews = await updateNews(newsItem.id, formData)
      if (updatedNews) {
        onSave(updatedNews)
        onBack()
      }
    } catch (err) {
          console.error('Update news failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = <K extends keyof NewsUpdateData>(field: K, value: NewsUpdateData[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }


  const handleLanguageToggle = (value: 'EN' | 'KO') => {
    setLanguageMode(value)
  }

  const handleLocalizedChange = (field: 'title' | 'content', value: string) => {
    if (languageMode === 'KO') {
      if (field === 'title') {
        handleInputChange('titleKo', value)
      } else {
        handleInputChange('translationKo', value)
      }
    } else {
      if (field === 'title') {
        handleInputChange('titleEn', value)
      } else {
        handleInputChange('translationEn', value)
      }
    }
  }


  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* 头部 */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit News</h1>
          <p className="text-gray-600 mt-1">Modify news information</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          disabled={saving}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to List</span>
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* 编辑表单 */}
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          {/* Language Toggle */}
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700">Language</span>
            <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => handleLanguageToggle('EN')}
                className={`px-3 py-1 text-sm transition-colors duration-200 first:rounded-l-md last:rounded-r-md ${languageMode === 'EN' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                disabled={saving}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLanguageToggle('KO')}
                className={`px-3 py-1 text-sm transition-colors duration-200 first:rounded-l-md last:rounded-r-md ${languageMode === 'KO' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                disabled={saving}
              >
                Korean
              </button>
            </div>
          </div>

          {/* Localized Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {languageMode === 'KO' ? 'Title (Korean)' : 'Title (English)'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={languageMode === 'KO' ? (formData.titleKo ?? '') : (formData.titleEn ?? '')}
              onChange={(e) => handleLocalizedChange('title', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder={languageMode === 'KO' ? '请输入韩文标题' : 'Please enter English title'}
              required
              disabled={saving}
            />
          </div>

          {/* Localized Content Snippet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {languageMode === 'KO' ? 'Content Summary (Korean)' : 'Content Summary (English)'}
            </label>
            <textarea
              value={languageMode === 'KO' ? (formData.translationKo ?? '') : (formData.translationEn ?? '')}
              onChange={(e) => handleLocalizedChange('content', e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              placeholder={languageMode === 'KO' ? '请输入韩文摘要...' : 'Please enter English summary...'}
              disabled={saving}
            />
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Markdown Preview</span>
                {(languageMode === 'KO' ? (formData.translationKo ?? '') : (formData.translationEn ?? '')).trim().length === 0 && (
                  <span className="text-xs text-gray-400">No content</span>
                )}
              </div>
              <div className="mt-2 px-4 py-3 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  className="prose prose-sm max-w-none text-gray-800"
                >
                  {languageMode === 'KO'
                    ? (formData.translationKo ?? '') || ''
                    : (formData.translationEn ?? '') || ''}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Original Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Original title from RSS"
              required
              disabled={saving}
            />
          </div>

          {/* Original Content Snippet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Original Content Summary
            </label>
            <textarea
              value={formData.content || ''}
              onChange={(e) => handleInputChange('content', e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
              placeholder="Summary pulled from RSS feed..."
              disabled={saving}
            />
          </div>

          {/* AI Worth (只读) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Value Assessment <span className="text-gray-400">(System assessment, read-only)</span>
            </label>
            <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm">
              {newsItem.aiWorth === null ? (
                <span className="text-gray-500">Not assessed</span>
              ) : newsItem.aiWorth ? (
                <span className="text-green-600 font-medium">✓ Valuable</span>
              ) : (
                <span className="text-red-600 font-medium">✗ Not valuable</span>
              )}
            </div>
          </div>

          {/* AI Reason (只读) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Assessment Reason <span className="text-gray-400">(System generated, read-only)</span>
            </label>
            <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm min-h-[80px]">
              {newsItem.aiReason ? (
                <p className="text-gray-700">{newsItem.aiReason}</p>
              ) : (
                <span className="text-gray-500">No assessment reason available</span>
              )}
            </div>
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="e.g.: Technology, Finance, Sports, etc."
                disabled={saving}
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status || 'DRAFT'}
                onChange={(e) => handleInputChange('status', e.target.value as 'DRAFT' | 'PUBLISH')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                required
                disabled={saving}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISH">Published</option>
              </select>
            </div>
          </div>

          {/* 新闻基本信息 (只读显示) */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-3">News Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">News ID:</span>
                <span className="text-gray-900">{newsItem.id}</span>
              </div>
              <div>
                <span className="text-gray-500">Published Time:</span>
                <span className="text-gray-900">
                  {new Date(newsItem.isoDate).toLocaleString('zh-CN')}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-gray-500">Original Link:</span>
                <a 
                  href={newsItem.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline break-all ml-1"
                >
                  {newsItem.link}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
