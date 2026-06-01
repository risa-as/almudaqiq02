'use client'
import { Bot, User, RotateCcw } from 'lucide-react'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  toolsInvoked?: string[]
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
}

export function ChatMessage({ role, content, toolsInvoked, isLoading, isError, onRetry }: ChatMessageProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-start gap-2 my-1.5">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div
            className="p-3 rounded-2xl rounded-tl-sm text-sm text-white leading-relaxed"
            style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)' }}
          >
            {content}
          </div>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
            style={{ background: 'rgba(9,75,159,0.2)' }}
          >
            <User className="w-3.5 h-3.5 text-blue-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end gap-2 my-1.5">
      <div className="flex items-start gap-2 max-w-[90%]">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
          style={{ background: 'rgba(14,99,212,0.2)' }}
        >
          <Bot className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div
          className="rounded-2xl rounded-tr-sm text-sm leading-relaxed"
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'var(--border-color)'}`,
            padding: '10px 14px',
          }}
        >
          {isLoading ? (
            <div className="flex gap-1.5 items-center py-1 px-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              <p
                className="whitespace-pre-wrap"
                style={{ color: isError ? '#f87171' : 'var(--text-primary)' }}
              >
                {content}
              </p>
              {isError && onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171',
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                  حاول مرة أخرى
                </button>
              )}
              {toolsInvoked && toolsInvoked.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {[...new Set(toolsInvoked)].map(tool => (
                    <span
                      key={tool}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: 'rgba(9,75,159,0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(9,75,159,0.2)',
                      }}
                    >
                      {tool.replace('get_', '').replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
