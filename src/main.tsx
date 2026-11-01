import { createRoot } from 'react-dom/client'

import App from './App'
import './styles/app.css'
import './styles/editor.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('未找到 #root 挂载点')
}

createRoot(container).render(<App />)
