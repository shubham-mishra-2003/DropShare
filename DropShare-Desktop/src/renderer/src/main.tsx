import './assets/main.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './hooks/ThemeProvider'
import { Toaster } from 'react-hot-toast'
import { DirectoryProvider } from './hooks/DirectoryContext'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <DirectoryProvider>
        <App />
        <Toaster position='bottom-right' />
      </DirectoryProvider>
    </ThemeProvider>
  </React.StrictMode>
)
