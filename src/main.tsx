import { createRoot } from 'react-dom/client'
import App from './App'
import { installDevApi } from './game/devApi'
import './ui/styles.css'

if (import.meta.env.DEV || new URLSearchParams(location.search).has('test')) installDevApi()

// pas de StrictMode : le double montage casserait le contrôleur physique du joueur
createRoot(document.getElementById('root')!).render(<App />)
