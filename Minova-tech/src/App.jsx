import { useEffect } from 'react'
import siteContent from './site-content.html?raw'
import { initializeSite } from './site.js'

function App() {
  useEffect(() => {
    initializeSite()
  }, [])

  return <div dangerouslySetInnerHTML={{ __html: siteContent }} />
}

export default App
