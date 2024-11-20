import React from 'react'
import MenuIcon from '../assets/icon-menu.svg'

interface HeaderProps {}

const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="py-4 border-b border-gray-500">
      <div className="container">
        <div className="flex justify-between">
          <div>
            <img src="/logoD.webp" alt="logo" width={40} height={50} className="cursor-default animate-pulse" />
          </div>
          <div className="flex gap-4 items-center">
            <button className="text-white py-2 px-3 rounded-lg font-medium text-sm bg-gradient-to-b from-[#190d2e] to-[#4a208a] shadow-[0px_0px_12px_#8c45ff]">
              Launch App
            </button>
            <img src={MenuIcon} alt="logo" />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
