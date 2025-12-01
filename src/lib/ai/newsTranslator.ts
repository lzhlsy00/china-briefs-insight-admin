import { z } from 'zod'

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENAI_BASE_URL = (process.env.OPENAI_API_BASE ?? process.env.OPENAI_BASE_URL)?.replace(/\/$/, '')
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const translationSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  aiReason: z.string().optional(),
})

export type TranslateNewsFieldsInput = {
  sourceLanguage: 'EN' | 'KO'
  targetLanguage: 'EN' | 'KO'
  fields: {
    title?: string | null
    content?: string | null
    category?: string | null
    aiReason?: string | null
  }
}

export type TranslateNewsFieldsOutput = Partial<{
  title: string
  content: string
  category: string
  aiReason: string
}>

const cleanup = (value?: string | null) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const languageLabels: Record<'EN' | 'KO', string> = {
  EN: 'English',
  KO: 'Korean',
}

export const translateNewsFields = async (
  input: TranslateNewsFieldsInput,
): Promise<TranslateNewsFieldsOutput | null> => {
  const sanitizedEntries = Object.entries(input.fields).reduce<Record<string, string>>((acc, [key, value]) => {
    const cleaned = cleanup(value as string | null)
    if (cleaned) {
      acc[key] = cleaned
    }
    return acc
  }, {})

  if (Object.keys(sanitizedEntries).length === 0) {
    return null
  }

  if (!OPENAI_API_KEY || !OPENAI_BASE_URL) {
    console.warn('OpenAI 翻译服务未配置，跳过自动翻译')
    return null
  }

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' as const },
        messages: [
          {
            role: 'system',
            content:
              'You translate editorial content accurately between English and Korean. Maintain concise, professional tone and return valid JSON only.',
          },
          {
            role: 'user',
            content:
              `Translate the following news fields from ${languageLabels[input.sourceLanguage]} to ${languageLabels[input.targetLanguage]}. ` +
              'Respond with JSON {"title"?:string,"content"?:string,"category"?:string,"aiReason"?:string}. ' +
              'If a field is missing, omit it. Input:\n' +
              JSON.stringify(sanitizedEntries, null, 2),
          },
        ],
      }),
    })

    if (!response.ok) {
      console.warn('翻译接口调用失败', response.status, await response.text())
      return null
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const content = payload.choices?.[0]?.message?.content ?? ''
    if (!content) {
      return null
    }

    let parsed: unknown = null
    try {
      parsed = JSON.parse(content)
    } catch (error) {
      console.warn('翻译结果解析失败', error)
      return null
    }

    const validated = translationSchema.safeParse(parsed)
    if (!validated.success) {
      console.warn('翻译结果不符合预期格式', validated.error.format())
      return null
    }

    const { title, content: body, category, aiReason } = validated.data
    const result: TranslateNewsFieldsOutput = {}
    if (title) {
      result.title = title.trim()
    }
    if (body) {
      result.content = body.trim()
    }
    if (category) {
      result.category = category.trim()
    }
    if (aiReason) {
      result.aiReason = aiReason.trim()
    }

    return result
  } catch (error) {
    console.warn('调用翻译服务失败', error)
    return null
  }
}
