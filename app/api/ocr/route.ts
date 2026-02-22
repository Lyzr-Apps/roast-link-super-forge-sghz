import { NextRequest, NextResponse } from 'next/server'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.LYZR_ANTHROPIC_KEY || ''

/**
 * POST /api/ocr
 *
 * Accepts a base64 image and extraction mode (post or profile).
 * Uses Claude Vision (via OpenRouter or direct Anthropic) to extract text.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { image_base64, media_type, mode } = body

    if (!image_base64) {
      return NextResponse.json({ success: false, error: 'image_base64 is required' }, { status: 400 })
    }
    if (!media_type) {
      return NextResponse.json({ success: false, error: 'media_type is required' }, { status: 400 })
    }
    if (!mode || !['post', 'profile'].includes(mode)) {
      return NextResponse.json({ success: false, error: 'mode must be "post" or "profile"' }, { status: 400 })
    }

    const prompt = mode === 'post' ? POST_EXTRACTION_PROMPT : PROFILE_EXTRACTION_PROMPT
    let extractedText = ''

    // Try OpenRouter first (supports Claude vision via OpenAI-compatible API)
    if (OPENROUTER_API_KEY) {
      try {
        extractedText = await callOpenRouter(image_base64, media_type, prompt)
      } catch (e) {
        console.error('OpenRouter failed, trying Anthropic direct:', e)
      }
    }

    // Fallback to direct Anthropic API
    if (!extractedText && ANTHROPIC_API_KEY) {
      try {
        extractedText = await callAnthropicDirect(image_base64, media_type, prompt)
      } catch (e) {
        console.error('Anthropic direct also failed:', e)
        return NextResponse.json(
          { success: false, error: e instanceof Error ? e.message : 'Vision API failed' },
          { status: 500 }
        )
      }
    }

    if (!extractedText && !OPENROUTER_API_KEY && !ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'No API key configured for vision extraction. Set OPENROUTER_API_KEY or ANTHROPIC_API_KEY.' },
        { status: 500 }
      )
    }

    if (!extractedText) {
      return NextResponse.json({ success: false, error: 'No text extracted from image' }, { status: 422 })
    }

    // Process based on mode
    if (mode === 'post') {
      return handlePostExtraction(extractedText)
    }
    return handleProfileExtraction(extractedText)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Server error during OCR'
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 })
  }
}

/**
 * Call OpenRouter API (OpenAI-compatible, supports Claude vision)
 */
async function callOpenRouter(base64: string, mediaType: string, prompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://roastmypost.ai',
      'X-Title': 'RoastMyPost AI',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMsg = `OpenRouter API failed with status ${response.status}`
    try {
      const errorData = JSON.parse(errorText)
      errorMsg = errorData?.error?.message || errorData?.message || errorMsg
    } catch {}
    throw new Error(errorMsg)
  }

  const data = await response.json()
  return data?.choices?.[0]?.message?.content || ''
}

/**
 * Call Anthropic API directly
 */
async function callAnthropicDirect(base64: string, mediaType: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMsg = `Anthropic API failed with status ${response.status}`
    try {
      const errorData = JSON.parse(errorText)
      errorMsg = errorData?.error?.message || errorData?.message || errorMsg
    } catch {}
    throw new Error(errorMsg)
  }

  const data = await response.json()
  return data?.content?.[0]?.text || ''
}

function handlePostExtraction(extractedText: string) {
  if (extractedText.includes('ERROR: Not a LinkedIn post')) {
    return NextResponse.json({
      success: false,
      error: 'This does not appear to be a LinkedIn post screenshot. Please upload a post screenshot or type your post instead.',
    })
  }
  return NextResponse.json({
    success: true,
    extracted_text: extractedText.trim(),
    mode: 'post',
  })
}

function handleProfileExtraction(extractedText: string) {
  if (extractedText.includes('"error"')) {
    try {
      const errObj = JSON.parse(extractedText)
      if (errObj.error) {
        return NextResponse.json({
          success: false,
          error: errObj.error === 'Not a LinkedIn profile'
            ? 'This does not appear to be a LinkedIn profile screenshot. Please upload a profile screenshot or enter details manually.'
            : errObj.error,
        })
      }
    } catch {}
  }

  // Try to parse structured JSON
  let profileData = null
  try {
    profileData = JSON.parse(extractedText)
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = extractedText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      try { profileData = JSON.parse(jsonMatch[1].trim()) } catch {}
    }
    // Try finding JSON boundaries
    if (!profileData) {
      const startIdx = extractedText.indexOf('{')
      const endIdx = extractedText.lastIndexOf('}')
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try { profileData = JSON.parse(extractedText.substring(startIdx, endIdx + 1)) } catch {}
      }
    }
  }

  if (!profileData) {
    return NextResponse.json({
      success: false,
      error: 'Could not parse profile data from the image. Try entering your profile details manually.',
    })
  }

  // Normalize experience
  let experienceStr = ''
  if (Array.isArray(profileData.experiences)) {
    experienceStr = profileData.experiences
      .map((exp: any) => {
        const parts = [
          exp.title && exp.company ? `${exp.title} at ${exp.company}` : (exp.title || exp.company || ''),
          exp.duration ? `(${exp.duration})` : '',
          exp.description || '',
        ].filter(Boolean)
        return parts.join('\n')
      })
      .join('\n\n')
  } else if (typeof profileData.experiences === 'string') {
    experienceStr = profileData.experiences
  } else if (typeof profileData.experience === 'string') {
    experienceStr = profileData.experience
  }

  // Normalize skills
  let skillsStr = ''
  if (Array.isArray(profileData.skills)) {
    skillsStr = profileData.skills.join(', ')
  } else if (typeof profileData.skills === 'string') {
    skillsStr = profileData.skills
  }

  return NextResponse.json({
    success: true,
    mode: 'profile',
    profile_data: {
      headline: profileData.headline || '',
      about: profileData.about || '',
      experience: experienceStr,
      skills: skillsStr,
    },
    raw_extraction: profileData,
  })
}

const POST_EXTRACTION_PROMPT = `Extract all text from this LinkedIn post screenshot.

RULES:
- Return ONLY the post text, nothing else
- Preserve line breaks and formatting exactly
- Ignore engagement metrics (likes, comments, shares, views)
- Ignore profile pictures, names, and timestamps
- Ignore "Repost" or "Shared by" text
- If you see hashtags, include them
- If you see emojis, include them
- Do NOT add any preamble or explanation

If this is NOT a LinkedIn post screenshot, return exactly: "ERROR: Not a LinkedIn post"

Extract the post text now:`

const PROFILE_EXTRACTION_PROMPT = `Analyze this LinkedIn profile screenshot and extract structured data.

Return ONLY valid JSON in this exact format (no markdown, no code blocks, no explanation):
{
  "headline": "exact headline text or null",
  "about": "full about section text or null",
  "experiences": [
    {
      "title": "job title",
      "company": "company name",
      "duration": "time period",
      "description": "full description with bullet points"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "education": [
    {
      "degree": "degree name",
      "school": "school name",
      "year": "graduation year"
    }
  ]
}

EXTRACTION RULES:
- Extract text EXACTLY as written (preserve capitalization, punctuation)
- For experiences: capture title, company, dates, and full description
- For skills: list all visible skills (ignore endorsement counts)
- If a section is not visible, use null or empty array
- Focus only on text content, ignore images/icons
- Ignore connection count, follower count, post count

If this is NOT a LinkedIn profile screenshot, return: {"error": "Not a LinkedIn profile"}

Extract the data now as JSON:`
