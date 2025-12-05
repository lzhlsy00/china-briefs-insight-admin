'use client'

import { useRef, useState, useEffect, type ChangeEvent } from 'react'
import { useNewsApi } from '@/hooks/useNewsApi'
import type { NewsCreatePayload, NewsItem, NewsUpdateData } from '@/types/api'
import { newsApi } from '@/services/newsApi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import Image from 'next/image'

const CATEGORY_OPTIONS = [
  { key: 'politics', en: 'Politics', ko: '정치', cn: '政治' },
  { key: 'economy', en: 'Economy', ko: '경제', cn: '经济' },
  { key: 'markets', en: 'Markets', ko: '금융시장', cn: '市场' },
  { key: 'business', en: 'Business', ko: '비즈니스', cn: '商业' },
  { key: 'tech', en: 'Tech', ko: '기술', cn: '科技' },
  { key: 'ai', en: 'AI', ko: '인공지능', cn: '人工智能' },
  { key: 'science', en: 'Science', ko: '과학', cn: '科学' },
  { key: 'industry', en: 'Industry', ko: '산업', cn: '工业' },
  { key: 'finance', en: 'Finance', ko: '금융', cn: '金融' },
  { key: 'regulation', en: 'Regulation', ko: '규제', cn: '法规' },
  { key: 'health', en: 'Health', ko: '건강', cn: '健康' },
  { key: 'pharma', en: 'Pharma', ko: '의약', cn: '制药' },
  { key: 'energy', en: 'Energy', ko: '에너지', cn: '能源' },
  { key: 'environment', en: 'Environment', ko: '환경', cn: '环境' },
  { key: 'real-estate', en: 'Real Estate', ko: '부동산', cn: '房地产' },
  { key: 'consumer', en: 'Consumer', ko: '소비자', cn: '消费者' },
  { key: 'retail', en: 'Retail', ko: '리테일', cn: '零售' },
  { key: 'transport', en: 'Transport', ko: '교통', cn: '运输' },
  { key: 'auto', en: 'Auto', ko: '자동차', cn: '自动' },
  { key: 'culture', en: 'Culture', ko: '문화', cn: '文化' },
  { key: 'entertainment', en: 'Entertainment', ko: '엔터테인먼트', cn: '娱乐' },
  { key: 'sports', en: 'Sports', ko: '스포츠', cn: '体育' },
  { key: 'education', en: 'Education', ko: '교육', cn: '教育' },
  { key: 'society', en: 'Society', ko: '사회', cn: '社会' },
  { key: 'labor', en: 'Labor', ko: '노동', cn: '劳动' },
  { key: 'security', en: 'Security', ko: '안보', cn: '安全' },
  { key: 'global', en: 'Global', ko: '국제', cn: '全球' },
  { key: 'data', en: 'Data', ko: '데이터', cn: '数据' },
  { key: 'policy', en: 'Policy', ko: '정책', cn: '政策' },
  { key: 'legal', en: 'Legal', ko: '법률', cn: '法律' },
]

const chineseCategoryOptions = CATEGORY_OPTIONS.map((option) => ({ key: option.key, label: option.cn }))

const englishCategoryOptions = CATEGORY_OPTIONS.map((option) => ({ key: option.key, label: option.en }))
const koreanCategoryOptions = CATEGORY_OPTIONS.map((option) => ({ key: option.key, label: option.ko }))

const findCategoryByChinese = (label: string) => CATEGORY_OPTIONS.find((option) => option.cn === label)

interface NewsEditPageProps {
  newsItem: NewsItem
  onBack: () => void
  onSave: (updatedNews: NewsItem) => void
}

type FormFields = {
  titleCn: string
  contentCn: string
  categoryCn: string
  aiReasonCn: string
  titleEn: string
  contentEn: string
  categoryEn: string
  aiReasonEn: string
  titleKo: string
  contentKo: string
  categoryKo: string
  aiReasonKo: string
  heroImageUrl: string
}

const INITIAL_FIELDS: FormFields = {
  titleCn: '',
  contentCn: '',
  categoryCn: '',
  aiReasonCn: '',
  titleEn: '',
  contentEn: '',
  categoryEn: '',
  aiReasonEn: '',
  titleKo: '',
  contentKo: '',
  categoryKo: '',
  aiReasonKo: '',
  heroImageUrl: '',
}

const normalizeValue = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const HERO_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
const HERO_IMAGE_MAX_SIZE = 2 * 1024 * 1024

export default function NewsEditPage({ newsItem, onBack, onSave }: NewsEditPageProps) {
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS)
  const [isoDateValue, setIsoDateValue] = useState<string>(new Date().toISOString().slice(0, 16))
  const [aiWorth, setAiWorth] = useState<'true' | 'false'>('true')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISH'>('DRAFT')
  const [savingChinese, setSavingChinese] = useState(false)
  const [savingEnglish, setSavingEnglish] = useState(false)
  const [savingKorean, setSavingKorean] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [englishMessage, setEnglishMessage] = useState<string | null>(null)
  const [koreanMessage, setKoreanMessage] = useState<string | null>(null)
  const [showEnglishPreview, setShowEnglishPreview] = useState(false)
  const [showKoreanPreview, setShowKoreanPreview] = useState(false)
  const { updateNews, error, clearError } = useNewsApi()

  const [publishMessage, setPublishMessage] = useState<string | null>(null)
  const [heroImageError, setHeroImageError] = useState<string | null>(null)
  const [heroImageUploading, setHeroImageUploading] = useState(false)
  const heroImageInputRef = useRef<HTMLInputElement | null>(null)

  const anySaving = savingChinese || savingEnglish || savingKorean || heroImageUploading

  useEffect(() => {
    if (newsItem) {
      populateFormFromNews(newsItem)
    }
  }, [newsItem])

  const populateFormFromNews = (news: NewsItem) => {
    setFields({
      titleCn: news.title ?? '',
      contentCn: news.content ?? '',
      categoryCn: news.category ?? '',
      aiReasonCn: news.aiReason ?? '',
      titleEn: news.titleEn ?? '',
      contentEn: news.translationEn ?? '',
      categoryEn: news.categoryEn ?? '',
      aiReasonEn: news.aiReasonEn ?? '',
      titleKo: news.titleKo ?? '',
      contentKo: news.translationKo ?? '',
      categoryKo: news.categoryKo ?? '',
      aiReasonKo: news.aiReasonKo ?? '',
      heroImageUrl: news.heroImageUrl ?? '',
    })
    const parsedDate = new Date(news.isoDate)
    if (!Number.isNaN(parsedDate.getTime())) {
      const offset = parsedDate.getTimezoneOffset()
      const local = new Date(parsedDate.getTime() - offset * 60000)
      setIsoDateValue(local.toISOString().slice(0, 16))
    }
    setAiWorth(news.aiWorth === false ? 'false' : 'true')
    setStatus(news.status)
  }

  const handleFieldChange = (field: keyof FormFields, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }))
  }

  const handleChineseCategoryChange = (value: string) => {
    const matched = findCategoryByChinese(value)
    setFields((prev) => ({
      ...prev,
      categoryCn: value,
      categoryEn: matched ? matched.en : prev.categoryEn,
      categoryKo: matched ? matched.ko : prev.categoryKo,
    }))
  }

  const handleHeroImageRemove = () => {
    setHeroImageError(null)
    setFields((prev) => ({ ...prev, heroImageUrl: '' }))
  }

  const uploadHeroImage = async (file: File) => {
    try {
      setHeroImageError(null)
      setHeroImageUploading(true)

      if (!file.type.startsWith('image/')) {
        throw new Error('仅支持上传图片文件')
      }
      if (file.size > HERO_IMAGE_MAX_SIZE) {
        throw new Error('图片大小不能超过 2MB')
      }

      const response = await newsApi.getHeroImageUploadUrl({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
      })

      if (!response.success || !response.data) {
        throw new Error(response.message || '获取上传链接失败')
      }

      const uploadInfo = response.data

      const uploadResult = await fetch(uploadInfo.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true',
        },
        body: file,
      })

      if (!uploadResult.ok) {
        throw new Error('封面图片上传失败，请重试')
      }

      const finalUrl = uploadInfo.publicUrl
      if (!finalUrl) {
        throw new Error('未能生成封面图片访问地址，请检查存储桶权限')
      }

      setFields((prev) => ({ ...prev, heroImageUrl: finalUrl }))
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : '封面图片上传失败'
      setHeroImageError(message)
    } finally {
      setHeroImageUploading(false)
      if (heroImageInputRef.current) {
        heroImageInputRef.current.value = ''
      }
    }
  }

  const handleHeroImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    await uploadHeroImage(file)
  }

  const handleSaveChinese = async (event?: React.FormEvent) => {
    if (event) event.preventDefault()

    if (!isoDateValue) {
      setFormError('请填写发布时间')
      return
    }

    const isoDate = new Date(isoDateValue)
    if (Number.isNaN(isoDate.getTime())) {
      setFormError('发布时间格式不正确，请重新选择')
      return
    }

    if (!fields.titleCn.trim()) {
      setFormError('请填写中文标题')
      return
    }

    const payload: NewsCreatePayload = {
      isoDate: isoDate.toISOString(),
      status,
      aiWorth: aiWorth === 'true',
      titleCn: normalizeValue(fields.titleCn),
      contentCn: normalizeValue(fields.contentCn),
      categoryCn: normalizeValue(fields.categoryCn),
      aiReasonCn: normalizeValue(fields.aiReasonCn),
      titleEn: normalizeValue(fields.titleEn),
      titleKo: normalizeValue(fields.titleKo),
      contentEn: normalizeValue(fields.contentEn),
      contentKo: normalizeValue(fields.contentKo),
      categoryEn: normalizeValue(fields.categoryEn),
      categoryKo: normalizeValue(fields.categoryKo),
      aiReasonEn: normalizeValue(fields.aiReasonEn),
      aiReasonKo: normalizeValue(fields.aiReasonKo),
      heroImageUrl: normalizeValue(fields.heroImageUrl),
    }

    setFormError(null)
    setSuccessMessage(null)
    setEnglishMessage(null)
    setKoreanMessage(null)
    clearError()
    setSavingChinese(true)

    try {
      const updatePayload: NewsUpdateData = {
        isoDate: isoDate.toISOString(),
        status,
        aiWorth: payload.aiWorth,
        title: payload.titleCn,
        content: payload.contentCn,
        category: payload.categoryCn,
        aiReason: payload.aiReasonCn,
        titleEn: payload.titleEn,
        titleKo: payload.titleKo,
        translationEn: payload.contentEn,
        translationKo: payload.contentKo,
        categoryEn: payload.categoryEn,
        categoryKo: payload.categoryKo,
        aiReasonEn: payload.aiReasonEn,
        aiReasonKo: payload.aiReasonKo,
        heroImageUrl: payload.heroImageUrl ?? null,
      }
      const updated = await updateNews(newsItem.id, updatePayload)
      if (updated) {
        populateFormFromNews(updated)
        setSuccessMessage('中文内容已保存')
        onSave(updated)
      }
    } catch (err) {
      console.error('Failed to save Chinese content', err)
      setFormError('中文内容保存失败')
    } finally {
      setSavingChinese(false)
    }
  }

  const handleSaveTranslation = async (locale: 'EN' | 'KO') => {
    setFormError(null)
    clearError()
    if (locale === 'EN') {
      setEnglishMessage(null)
      setSavingEnglish(true)
    } else {
      setKoreanMessage(null)
      setSavingKorean(true)
    }

    const updatePayload: NewsUpdateData = {}
    if (locale === 'EN') {
      updatePayload.titleEn = normalizeValue(fields.titleEn) ?? null
      updatePayload.translationEn = normalizeValue(fields.contentEn) ?? null
      updatePayload.categoryEn = normalizeValue(fields.categoryEn) ?? null
      updatePayload.aiReasonEn = normalizeValue(fields.aiReasonEn) ?? null
    } else {
      updatePayload.titleKo = normalizeValue(fields.titleKo) ?? null
      updatePayload.translationKo = normalizeValue(fields.contentKo) ?? null
      updatePayload.categoryKo = normalizeValue(fields.categoryKo) ?? null
      updatePayload.aiReasonKo = normalizeValue(fields.aiReasonKo) ?? null
    }

    try {
      const updated = await updateNews(newsItem.id, updatePayload)
      if (updated) {
        setFields((prev) => {
          if (locale === 'EN') {
            return {
              ...prev,
              titleEn: updated.titleEn ?? prev.titleEn,
              contentEn: updated.translationEn ?? prev.contentEn,
              categoryEn: updated.categoryEn ?? prev.categoryEn,
              aiReasonEn: updated.aiReasonEn ?? prev.aiReasonEn,
            }
          }

          return {
            ...prev,
            titleKo: updated.titleKo ?? prev.titleKo,
            contentKo: updated.translationKo ?? prev.contentKo,
            categoryKo: updated.categoryKo ?? prev.categoryKo,
            aiReasonKo: updated.aiReasonKo ?? prev.aiReasonKo,
          }
        })

        if (locale === 'EN') {
          setEnglishMessage('英文内容已保存')
        } else {
          setKoreanMessage('韩文内容已保存')
        }
        onSave(updated)
      }
    } catch (err) {
      console.error('Failed to save translation', err)
      setFormError(locale === 'EN' ? '英文内容保存失败' : '韩文内容保存失败')
    } finally {
      if (locale === 'EN') {
        setSavingEnglish(false)
      } else {
        setSavingKorean(false)
      }
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit News</h1>
            <p className="text-gray-600 mt-1">编辑新闻内容。</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            disabled={anySaving}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to List</span>
          </button>
        </div>

        {(formError || error) && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{formError || error}</p>
          </div>
        )}

        {publishMessage && (
          <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-blue-700 text-sm">{publishMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSaveChinese} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Worth</label>
              <select
                value={aiWorth}
                onChange={(event) => setAiWorth(event.target.value as 'true' | 'false')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                disabled={anySaving}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as 'DRAFT' | 'PUBLISH')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                disabled={anySaving}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISH">Publish</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Published At</label>
              <input
                type="datetime-local"
                value={isoDateValue}
                onChange={(event) => setIsoDateValue(event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                required
                disabled={anySaving}
              />
            </div>
          </div>

          <section className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">封面图片</h2>
                <p className="text-sm text-gray-500">上传一张 16:9 封面图，默认展示在正文顶部。</p>
              </div>
              {fields.heroImageUrl && (
                <button
                  type="button"
                  onClick={handleHeroImageRemove}
                  className="text-sm text-red-600 hover:text-red-800"
                  disabled={heroImageUploading || savingChinese}
                >
                  移除图片
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative aspect-video rounded-xl border border-dashed border-gray-300 bg-gray-50 overflow-hidden">
                {fields.heroImageUrl ? (
                  <Image
                    src={fields.heroImageUrl}
                    alt="封面图预览"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                    暂无封面图
                  </div>
                )}
                {heroImageUploading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm text-blue-600">
                    上传中...
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <input
                  ref={heroImageInputRef}
                  type="file"
                  accept={HERO_IMAGE_ACCEPT}
                  className="hidden"
                  onChange={handleHeroImageChange}
                  disabled={heroImageUploading || savingChinese}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => heroImageInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    disabled={heroImageUploading || savingChinese}
                  >
                    {fields.heroImageUrl ? '重新上传' : '上传封面图'}
                  </button>
                  {fields.heroImageUrl && (
                    <a
                      href={fields.heroImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                    >
                      查看原图
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-500">支持 JPG、PNG、WebP；文件大小不超过 2MB。</p>
                {heroImageError && <p className="text-xs text-red-600">{heroImageError}</p>}
              </div>
            </div>
          </section>

          <section className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">中文内容</h2>
              <p className="text-sm text-gray-500">录入标题、摘要、分类与 AI 理由后保存以创建/更新记录。</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">标题 (CN)</label>
              <input
                type="text"
                value={fields.titleCn}
                onChange={(event) => handleFieldChange('titleCn', event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                placeholder="请输入中文标题"
                disabled={savingChinese}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">内容 (CN)</label>
              <textarea
                rows={5}
                value={fields.contentCn}
                onChange={(event) => handleFieldChange('contentCn', event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                placeholder="请输入中文内容摘要"
                disabled={savingChinese}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">分类 (CN)</label>
              <div className="relative">
                <select
                  value={fields.categoryCn}
                  onChange={(event) => handleChineseCategoryChange(event.target.value)}
                  className="w-full appearance-none px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm pr-10"
                  disabled={savingChinese}
                >
                  <option value="">请选择中文分类</option>
                  {chineseCategoryOptions.map((option) => (
                    <option key={option.key} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 12.5a.75.75 0 01-.53-.22L5.22 8.03a.75.75 0 011.06-1.06L10 10.69l3.72-3.72a.75.75 0 011.06 1.06l-4.25 4.25a.75.75 0 01-.53.22z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI 理由 (CN)</label>
              <textarea
                rows={4}
                value={fields.aiReasonCn}
                onChange={(event) => handleFieldChange('aiReasonCn', event.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                placeholder="请输入中文 AI 理由"
                disabled={savingChinese}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={savingChinese}
              >
                {savingChinese ? 'Saving…' : '保存中文内容'}
              </button>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">English Content</h2>
                  <p className="text-sm text-gray-500">自动填充后可修订，保存仅更新英文字段。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEnglishPreview(true)}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  disabled={savingEnglish || savingChinese}
                >
                  预览
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title (EN)</label>
                <input
                  type="text"
                  value={fields.titleEn}
                  onChange={(event) => handleFieldChange('titleEn', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  placeholder="Enter English title"
                  disabled={savingChinese || savingEnglish}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Summary (EN)</label>
                <textarea
                  rows={5}
                  value={fields.contentEn}
                  onChange={(event) => handleFieldChange('contentEn', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  placeholder="Add English summary..."
                  disabled={savingChinese || savingEnglish}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category (EN)</label>
                <select
                  value={fields.categoryEn}
                  onChange={(event) => handleFieldChange('categoryEn', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  disabled={savingChinese || savingEnglish}
                >
                  <option value="">Select a category</option>
                  {englishCategoryOptions.map((option) => (
                    <option key={option.key} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">AI Reason (EN)</label>
                <textarea
                  rows={4}
                  value={fields.aiReasonEn}
                  onChange={(event) => handleFieldChange('aiReasonEn', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  placeholder="Explain why this story matters"
                  disabled={savingChinese || savingEnglish}
                />
              </div>
              {englishMessage && <p className="text-sm text-green-600">{englishMessage}</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveTranslation('EN')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={savingEnglish || savingChinese}
                >
                  {savingEnglish ? 'Saving…' : '保存英文内容'}
                </button>
              </div>
            </section>

            <section className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">한국어 콘텐츠</h2>
                  <p className="text-sm text-gray-500">审核完修改后保存即可更新韩文字段。</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKoreanPreview(true)}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  disabled={savingKorean || savingChinese}
                >
                  预览
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">제목 (KO)</label>
                <input
                  type="text"
                  value={fields.titleKo}
                  onChange={(event) => handleFieldChange('titleKo', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  placeholder="한글 제목을 입력하세요"
                  disabled={savingChinese || savingKorean}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">요약 (KO)</label>
                <textarea
                  rows={5}
                  value={fields.contentKo}
                  onChange={(event) => handleFieldChange('contentKo', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  placeholder="한글 요약을 입력하세요"
                  disabled={savingChinese || savingKorean}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">분류 (KO)</label>
                <select
                  value={fields.categoryKo}
                  onChange={(event) => handleFieldChange('categoryKo', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  disabled={savingChinese || savingKorean}
                >
                  <option value="">분류를 선택하세요</option>
                  {koreanCategoryOptions.map((option) => (
                    <option key={option.key} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">AI 이유 (KO)</label>
                <textarea
                  rows={4}
                  value={fields.aiReasonKo}
                  onChange={(event) => handleFieldChange('aiReasonKo', event.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus-border-transparent text-sm"
                  placeholder="이 기사가 중요한 이유를 설명하세요"
                  disabled={savingChinese || savingKorean}
                />
              </div>
              {koreanMessage && <p className="text-sm text-green-600">{koreanMessage}</p>}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSaveTranslation('KO')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={savingKorean || savingChinese}
                >
                  {savingKorean ? 'Saving…' : '저장 (한글)'}
                </button>
              </div>
            </section>
          </div>
        </form>
      </div>

      {showEnglishPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">English Preview</h3>
              <button
                onClick={() => setShowEnglishPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">{fields.titleEn || 'No Title'}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{fields.categoryEn || 'Uncategorized'}</span>
                <span>{new Date(isoDateValue).toLocaleDateString()}</span>
              </div>
              {fields.heroImageUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={fields.heroImageUrl}
                    alt={fields.titleEn}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="prose prose-blue max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {fields.contentEn || 'No Content'}
                </ReactMarkdown>
              </div>
              {fields.aiReasonEn && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">AI Insight</h4>
                  <p className="text-sm text-blue-800">{fields.aiReasonEn}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showKoreanPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Korean Preview</h3>
              <button
                onClick={() => setShowKoreanPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h1 className="text-2xl font-bold text-gray-900">{fields.titleKo || '제목 없음'}</h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{fields.categoryKo || '미분류'}</span>
                <span>{new Date(isoDateValue).toLocaleDateString()}</span>
              </div>
              {fields.heroImageUrl && (
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={fields.heroImageUrl}
                    alt={fields.titleKo}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="prose prose-blue max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {fields.contentKo || '내용 없음'}
                </ReactMarkdown>
              </div>
              {fields.aiReasonKo && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">AI 인사이트</h4>
                  <p className="text-sm text-blue-800">{fields.aiReasonKo}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
