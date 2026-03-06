import { handleJamendoSearchRequest } from './shared'

interface JamendoContext {
  request: Request
  env: {
    JAMENDO_CLIENT_ID?: string
    JAMENDO_API_BASE?: string
  }
}

export async function onRequest(context: JamendoContext): Promise<Response> {
  return await handleJamendoSearchRequest(context.request, context.env)
}
