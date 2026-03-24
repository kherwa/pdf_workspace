import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './context/AppContext'
import { DialogProvider } from './context/DialogContext'
import App from './App'
import './index.css'

// Apply stored theme before first render to avoid flash
const storedTheme = (localStorage.getItem('pdf-viewer-theme') ?? 'dark') as 'dark' | 'light'
document.documentElement.setAttribute('data-theme', storedTheme)
document.documentElement.style.backgroundColor = storedTheme === 'dark' ? '#161616' : '#FFFFFF'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </AppProvider>
  </StrictMode>
)
