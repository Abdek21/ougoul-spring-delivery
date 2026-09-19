// Ce fichier est le point de départ de toute l'application React.
// C'est lui qui "accroche" React dans la page HTML (dans la div id="root" de index.html)

import { StrictMode } from 'react'        // Mode strict : détecte les erreurs en développement
import { createRoot } from 'react-dom/client' // Fonction pour démarrer React
import './index.css'                       // Charge le CSS global (Tailwind + polices)
import App from './App'                    // Notre composant principal

// On trouve la div id="root" dans index.html et on y injecte toute l'application
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App /> {/* Toute l'application commence ici */}
  </StrictMode>
)