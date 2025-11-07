import { z } from 'zod'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
const OPENAI_BASE_URL = (process.env.OPENAI_API_BASE ?? process.env.OPENAI_BASE_URL)?.replace(/\/$/, '')

const responseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().min(1),
      }),
    })
  ),
})

export class PushContentGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PushContentGenerationError'
  }
}

export const generatePushContent = async (prompt: string): Promise<string> => {
  const trimmed = prompt.trim()

 if (!trimmed) {
   throw new PushContentGenerationError('生成内容失败：提示词为空')
 }

  if (!OPENAI_API_KEY) {
    throw new PushContentGenerationError('生成内容失败：未配置 OPENAI_API_KEY')
  }

  if (!OPENAI_BASE_URL) {
    throw new PushContentGenerationError('生成内容失败：未配置 OPENAI_BASE_URL')
  }

  let response: Response

  try {
    response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are an editorial assistant who writes polished bilingual newsletters for business professionals. '
              + 'Follow the user prompt closely and output Markdown suitable for an email body. '
              + 'Keep summaries concise and avoid filler.',
          },
          {
            role: 'user',
            content: trimmed,
          },
        ],
      }),
    })
  } catch (networkError) {
    const message =
      networkError instanceof Error
        ? `生成内容失败：无法访问模型接口 ${OPENAI_BASE_URL} (${networkError.message})`
        : `生成内容失败：无法访问模型接口 ${OPENAI_BASE_URL}`
    throw new PushContentGenerationError(message)
  }

  if (!response.ok) {
    const errorPayload = await response.text().catch(() => '')
    throw new PushContentGenerationError(`生成内容失败：${response.status} ${response.statusText} ${errorPayload}`.trim())
  }

  const payload = await response.json().catch(() => null)
  const parsed = responseSchema.safeParse(payload)

  if (!parsed.success) {
    throw new PushContentGenerationError('生成内容失败：AI 响应结构异常')
  }

  const content = parsed.data.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new PushContentGenerationError('生成内容失败：AI 返回为空')
  }

  return content
}
