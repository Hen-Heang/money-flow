'use client'

import React from 'react'

interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
          <span className="text-6xl">⚠️</span>
          <div>
            <h2 className="text-xl font-black mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Something went wrong
            </h2>
            <p className="text-sm opacity-50 max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {this.state.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload() }}
            className="px-6 py-3 rounded-2xl text-sm font-black text-white"
            style={{ backgroundColor: 'var(--color-accent-base)' }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
