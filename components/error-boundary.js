'use client'

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something went wrong' }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#EC4899] flex items-center justify-center">
              <span className="font-display text-white font-bold">S</span>
            </div>
            <h1 className="studio-title text-lg">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">{this.state.message}</p>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-[#7C3AED] to-[#EC4899] text-white hover:opacity-90"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}