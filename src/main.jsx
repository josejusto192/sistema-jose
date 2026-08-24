import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { DialogProvider } from './components/Dialog.jsx'
import './index.css'
import './styles/workspace.css'
import './styles/overlays.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

function mount(Component) {
  root.render(
    <ErrorBoundary>
      <DialogProvider>
        <Component />
      </DialogProvider>
    </ErrorBoundary>
  )
}

const designPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has('design-preview')

if (designPreview) {
  import('./dev/DesignPreview.jsx').then(({ default: DesignPreview }) => mount(DesignPreview))
} else {
  mount(App)
}
