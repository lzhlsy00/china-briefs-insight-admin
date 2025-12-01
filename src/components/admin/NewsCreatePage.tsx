'use client'

import { useMemo, useState } from 'react'
import { useNewsApi } from '@/hooks/useNewsApi'
import type { NewsCreatePayload, NewsItem } from '@/types/api'

const CATEGORY_OPTIONS = [
  { key: 'politics', en: 'Politics', ko: '정치' },
  { key: 'economy', en: 'Economy', ko: '경제' },
  { key: 'markets', en: 'Markets', ko: '금융시장' },
  { key: 'business', en: 'Business', ko: '비즈니스' },
  { key: 'tech', en: 'Tech', ko: '기술' },
  { key: 'ai', en: 'AI', ko: '인공지능' },
  { key: 'science', en: 'Science', ko: '과학' },
  { key: 'industry', en: 'Industry', ko: '산업' },
  { key: 'finance', en: 'Finance', ko: '금융' },
  { key: 'regulation', en: 'Regulation', ko: '규제' },
  { key: 'health', en: 'Health', ko: '건강' },
  { key: 'pharma', en: 'Pharma', ko: '의약' },
  { key: 'energy', en: 'Energy', ko: '에너지' },
  { key: 'environment', en: 'Environment', ko: '환경' },
  { key: 'real-estate', en: 'Real Estate', ko: '부동산' },
  { key: 'consumer', en: 'Consumer', ko: '소비자' },
  { key: 'retail', en: 'Retail', ko: '리테일' },
  { key: 'transport', en: 'Transport', ko: '교통' },
  { key: 'auto', en: 'Auto', ko: '자동차' },
  { key: 'culture', en: 'Culture', ko: '문화' },
  { key: 'entertainment', en: 'Entertainment', ko: '엔터테인먼트' },
  { key: 'sports', en: 'Sports', ko: '스포츠' },
  { key: 'education', en: 'Education', ko: '교육' },
  { key: 'society', en: 'Society', ko: '사회' },
  { key: 'labor', en: 'Labor', ko: '노동' },
  { key: 'security', en: 'Security', ko: '안보' },
  { key: 'global', en: 'Global', ko: '국제' },
  { key: 'data', en: 'Data', ko: '데이터' },
  { key: 'policy', en: 'Policy', ko: '정책' },
  { key: 'legal', en: 'Legal', ko: '법률' },
]

type LocaleKey = 'EN' | 'KO'

type LocalizedFields = {
  title: string
  content: string
  category: string
  aiReason: string
}

const INITIAL_LOCALIZED: Record<LocaleKey, LocalizedFields> = {
  EN: { title: '', content: '', category: '', aiReason: '' },
  KO: { title: '', content: '', category: '', aiReason: '' },
}

const COPY = {
  EN: {
    pageTitle: 'Create News',
    pageSubtitle: 'Manually add a news record',
    languageLabel: 'Language',
    aiWorthLabel: 'AI Worth',
    titleLabel: 'Title',
    titlePlaceholder: 'Enter English title',
    publishTimeLabel: 'Published At',
    publishTimeError: 'Please provide a publish time.',
    publishTimeInvalid: 'Publish time format looks invalid. Please reselect.',
    summaryLabel: 'Content Summary',
    summaryPlaceholder: 'Add an English summary…',
    categoryLabel: 'Category',
    categoryPlaceholder: 'Select a category',
    statusLabel: 'Status',
    statusDraft: 'Draft',
    statusPublish: 'Publish',
    aiReasonLabel: 'AI Reason',
    aiReasonPlaceholder: 'Explain why this story matters for AI coverage (English)',
    backToList: 'Back to List',
    cancel: 'Cancel',
    submit: 'Save News',
    saving: 'Saving…',
    missingTitle: 'Please provide at least one language version of the title.',
  },
  KO: {
    pageTitle: '뉴스 작성',
    pageSubtitle: '새로운 기사를 직접 등록하세요',
    languageLabel: '언어',
    aiWorthLabel: 'AI 가치',
    titleLabel: '제목',
    titlePlaceholder: '한글 제목을 입력하세요',
    publishTimeLabel: '발행 시각',
    publishTimeError: '발행 시각을 입력하세요.',
    publishTimeInvalid: '발행 시각 형식이 올바르지 않습니다. 다시 선택하세요.',
    summaryLabel: '요약',
    summaryPlaceholder: '한글 요약을 입력하세요…',
    categoryLabel: '카테고리',
    categoryPlaceholder: '카테고리를 선택하세요',
    statusLabel: '상태',
    statusDraft: '초안',
    statusPublish: '발행',
    aiReasonLabel: 'AI 이유',
    aiReasonPlaceholder: '이 기사가 왜 중요한지 한국어로 설명하세요',
    backToList: '목록으로',
    cancel: '취소',
    submit: '저장하기',
    saving: '저장 중…',
    missingTitle: '최소 한 언어의 제목을 입력하세요.',
  },
} as const

interface NewsCreatePageProps {
  onBack: () => void
  onCreated?: (news: NewsItem) => void
}

const toIsoInputValue = (date = new Date()) => date.toISOString().slice(0, 16)

const normalizePayloadValue = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export default function NewsCreatePage({ onBack, onCreated }: NewsCreatePageProps) {
  const [language, setLanguage] = useState<LocaleKey>('EN')
  const [localizedFields, setLocalizedFields] = useState(INITIAL_LOCALIZED)
  const [isoDateValue, setIsoDateValue] = useState<string>(toIsoInputValue())
  const [aiWorth, setAiWorth] = useState(true)
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISH'>('DRAFT')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const { createNews, error, clearError } = useNewsApi()

  const currentFields = localizedFields[language]
  const copy = COPY[language]
  const errorMessages = {
    missingTime: language === 'KO' ? COPY.KO.publishTimeError : COPY.EN.publishTimeError,
    invalidTime: language === 'KO' ? COPY.KO.publishTimeInvalid : COPY.EN.publishTimeInvalid,
  }

  const categoryOptions = useMemo(() => {
    return CATEGORY_OPTIONS.map((option) => {
      const primary = language === 'EN' ? option.en : option.ko
      const secondary = language === 'EN' ? option.ko : option.en
      return {
        key: option.key,
        value: primary,
        label: `${primary} (${secondary})`,
      }
    })
  }, [language])

  const handleLanguageChange = (value: LocaleKey) => {
    setLanguage(value)
  }

  const handleLocalizedChange = (field: keyof LocalizedFields, value: string) => {
    setLocalizedFields((prev) => ({
      ...prev,
      [language]: {
        ...prev[language],
        [field]: value,
      },
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!isoDateValue) {
      setFormError(errorMessages.missingTime)
      return
    }

    const isoDate = new Date(isoDateValue)
    if (Number.isNaN(isoDate.getTime())) {
      setFormError(errorMessages.invalidTime)
      return
    }

    const payload: NewsCreatePayload = {
      isoDate: isoDate.toISOString(),
      status,
      aiWorth,
      primaryLanguage: language,
      titleEn: normalizePayloadValue(localizedFields.EN.title),
      titleKo: normalizePayloadValue(localizedFields.KO.title),
      contentEn: normalizePayloadValue(localizedFields.EN.content),
      contentKo: normalizePayloadValue(localizedFields.KO.content),
      categoryEn: normalizePayloadValue(localizedFields.EN.category),
      categoryKo: normalizePayloadValue(localizedFields.KO.category),
      aiReasonEn: normalizePayloadValue(localizedFields.EN.aiReason),
      aiReasonKo: normalizePayloadValue(localizedFields.KO.aiReason),
    }

    if (!payload.titleEn && !payload.titleKo) {
      setFormError(copy.missingTitle)
      return
    }

    setFormError(null)
    clearError()
    setSaving(true)

    try {
      const created = await createNews(payload)
      if (created) {
        onCreated?.(created)
        onBack()
      }
    } catch (err) {
      console.error('Failed to create news', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{copy.pageTitle}</h1>
          <p className="text-gray-600 mt-1">{copy.pageSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
          disabled={saving}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>{copy.backToList}</span>
        </button>
      </div>

      {(formError || error) && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{formError || error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-700">{copy.languageLabel}</span>
            <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm">
              {(['EN', 'KO'] as LocaleKey[]).map((locale) => (
                <button
                  key={locale}
                  type="button"
                  onClick={() => handleLanguageChange(locale)}
                  className={`px-3 py-1 text-sm transition-colors duration-200 first:rounded-l-md last:rounded-r-md ${
                    language === locale ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  disabled={saving}
                >
                  {locale === 'EN' ? 'English' : '한국어'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">{copy.aiWorthLabel}</span>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={aiWorth}
                onChange={(event) => setAiWorth(event.target.checked)}
                disabled={saving}
              />
              <div
                className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                  aiWorth ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    aiWorth ? 'translate-x-6' : 'translate-x-0'
                  }`}
                ></div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {copy.titleLabel} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentFields.title}
            onChange={(event) => handleLocalizedChange('title', event.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder={copy.titlePlaceholder}
            required={!localizedFields.EN.title && !localizedFields.KO.title}
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{copy.publishTimeLabel}</label>
          <input
            type="datetime-local"
            value={isoDateValue}
            onChange={(event) => setIsoDateValue(event.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            required
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {copy.summaryLabel}
          </label>
          <textarea
            rows={6}
            value={currentFields.content}
            onChange={(event) => handleLocalizedChange('content', event.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
            placeholder={copy.summaryPlaceholder}
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{copy.categoryLabel}</label>
            <select
              value={currentFields.category}
              onChange={(event) => handleLocalizedChange('category', event.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={saving}
            >
              <option value="">{copy.categoryPlaceholder}</option>
              {categoryOptions.map((option) => (
                <option key={option.key} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{copy.statusLabel}</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'DRAFT' | 'PUBLISH')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              disabled={saving}
            >
              <option value="DRAFT">{copy.statusDraft}</option>
              <option value="PUBLISH">{copy.statusPublish}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {copy.aiReasonLabel}
          </label>
          <textarea
            rows={4}
            value={currentFields.aiReason}
            onChange={(event) => handleLocalizedChange('aiReason', event.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder={copy.aiReasonPlaceholder}
            disabled={saving}
          />
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            disabled={saving}
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            disabled={saving}
          >
            {saving ? copy.saving : copy.submit}
          </button>
        </div>
      </form>
    </div>
  )
}
