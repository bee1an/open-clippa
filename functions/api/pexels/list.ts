import { handlePexelsListRequest } from './shared'

interface PexelsContext {
  request: Request
  env: {
    PEXELS_API_KEY?: string
    PEXELS_API_BASE?: string
  }
}

export async function onRequest(context: PexelsContext): Promise<Response> {
  return await handlePexelsListRequest(context.request, context.env)
}
