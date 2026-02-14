import type { IncomingHttpHeaders } from 'node:http'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AgentSync from 'unplugin-agent-sync/rollup'
import AutoImport from 'unplugin-auto-import/vite'
import VueComponents from 'unplugin-vue-components/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig, loadEnv } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'
import {
  HOP_BY_HOP_HEADERS,
  KEY_SOURCE_HEADER,
  resolveHeaderValue,
  resolveKeySource,
  resolveManagedApiKey,
  resolveManagedUpstreamBase,
  resolveProxyUpstreamBase,
  resolveUpstreamPath,
  UPSTREAM_BASE_HEADER,
} from './functions/api/kimi/proxyShared'

function isBodyAllowed(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD'
}

function toFetchHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers()
  Object.entries(headers).forEach(([name, value]) => {
    if (!value)
      return

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item)
          result.append(name, item)
      })
      return
    }

    result.set(name, value)
  })
  return result
}

function sendJsonError(
  res: {
    statusCode: number
    end: (chunk?: string) => void
    setHeader: (name: string, value: string) => void
  },
  status: number,
  message: string,
): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({
    ok: false,
    error: message,
  }))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const allowHttpLocalhost = true
  const managedUpstreamBase = resolveManagedUpstreamBase(
    {
      AI_MANAGED_UPSTREAM: env.AI_MANAGED_UPSTREAM,
      KIMI_UPSTREAM: env.KIMI_UPSTREAM,
    },
    { allowHttpLocalhost },
  )
  const managedApiKey = resolveManagedApiKey({
    AI_MANAGED_API_KEY: env.AI_MANAGED_API_KEY,
    KIMI_API_KEY: env.KIMI_API_KEY,
  })

  return {
    root: './app',
    envDir: path.resolve(__dirname),
    resolve: {
      alias: {
        '@clippc/': `${path.resolve(__dirname, 'packages')}/`,
        '@/': `${path.resolve(__dirname, 'app/src')}/`,
      },
    },

    server: {
      port: 3333,
    },

    plugins: [

      VueRouter({
        routesFolder: 'src/pages',
        root: './app',
      }),

      Vue(),

      AutoImport({
        imports: ['vue', '@vueuse/core', 'vue-router'],
      }),

      VueComponents(),

      UnoCSS(),

      VueDevTools(),

      AgentSync(),

      {
        name: 'clippc-ai-proxy-dev-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const rawUrl = req.url
            if (!rawUrl || !rawUrl.startsWith('/api/kimi'))
              return next()

            const inboundUrl = new URL(rawUrl, 'http://localhost')
            const rawPath = inboundUrl.pathname.replace(/^\/api\/kimi\/?/i, '')
            const keySource = resolveKeySource(resolveHeaderValue(req.headers[KEY_SOURCE_HEADER]))
            const upstreamBaseResult = resolveProxyUpstreamBase({
              keySource,
              managedUpstreamBase,
              requestedUpstreamBase: resolveHeaderValue(req.headers[UPSTREAM_BASE_HEADER]),
              allowHttpLocalhost,
            })
            if (!upstreamBaseResult.ok) {
              sendJsonError(res, 400, upstreamBaseResult.error)
              return
            }

            const requestHeaders = toFetchHeaders(req.headers)
            requestHeaders.delete('host')
            requestHeaders.delete(KEY_SOURCE_HEADER)
            requestHeaders.delete(UPSTREAM_BASE_HEADER)
            HOP_BY_HOP_HEADERS.forEach(header => requestHeaders.delete(header))

            const authorization = requestHeaders.get('authorization')?.trim()
            if (keySource !== 'byok' || !authorization) {
              if (managedApiKey) {
                requestHeaders.set('authorization', `Bearer ${managedApiKey}`)
              }
              else if (!authorization) {
                requestHeaders.delete('authorization')
              }
            }

            if (!requestHeaders.get('authorization')) {
              sendJsonError(
                res,
                500,
                '缺少 Authorization 请求头。请在请求中提供 API Key，或在服务端配置 AI_MANAGED_API_KEY（兼容旧变量 KIMI_API_KEY）。',
              )
              return
            }

            const upstreamPath = resolveUpstreamPath(rawPath)
            const upstreamUrl = new URL(upstreamPath, `${upstreamBaseResult.value}/`)
            upstreamUrl.search = inboundUrl.search

            const method = (req.method || 'GET').toUpperCase()
            const requestInit: RequestInit = {
              method,
              headers: requestHeaders,
              redirect: 'manual',
            }
            if (isBodyAllowed(method)) {
              requestInit.body = req as unknown as BodyInit
              const requestWithDuplex = requestInit as RequestInit & { duplex: 'half' }
              requestWithDuplex.duplex = 'half'
            }

            try {
              const upstreamResponse = await fetch(upstreamUrl, requestInit)
              const responseHeaders = new Headers(upstreamResponse.headers)
              HOP_BY_HOP_HEADERS.forEach(header => responseHeaders.delete(header))

              res.statusCode = upstreamResponse.status
              if (upstreamResponse.statusText)
                res.statusMessage = upstreamResponse.statusText
              responseHeaders.forEach((value, key) => {
                res.setHeader(key, value)
              })
              res.setHeader('x-clippc-ai-proxy', 'vite-dev-middleware')

              if (!upstreamResponse.body) {
                res.end()
                return
              }

              await pipeline(
                Readable.fromWeb(upstreamResponse.body as any),
                res,
              )
            }
            catch {
              if (!res.headersSent)
                sendJsonError(res, 502, '上游服务请求失败')
              else
                res.end()
            }
          })
        },
      },
    ],
  }
})
