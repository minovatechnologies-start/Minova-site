import { useEffect } from 'react'
import siteContent from './site-content.html?raw'
import siteLogo from '../site logo.jpeg'
import { initializeSite } from './site.js'

function App() {
  useEffect(() => {
    initializeSite()
  }, [])

  const content = siteContent.replaceAll('site logo.jpeg', siteLogo)

  return <div dangerouslySetInnerHTML={{ __html: content }} />
}

export default App
