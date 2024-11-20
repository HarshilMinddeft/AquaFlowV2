import React from 'react'
import Header from './sections/Header'
interface DisplayProps {}

const Display: React.FC<DisplayProps> = () => {
  return (
    <div className="bg-black min-h-screen">
      <Header />
    </div>
  )
}

export default Display
