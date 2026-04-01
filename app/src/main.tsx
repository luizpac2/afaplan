import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from './config/supabase'

// Log de versão
console.log("🚀 AFA Planner v1.1.51 Carregado");
(window as any).supabase = supabase;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
