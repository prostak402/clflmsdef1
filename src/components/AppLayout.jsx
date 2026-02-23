import SideNav from './SideNav'
import BottomNav from './BottomNav'
import './AppLayout.css'

export default function AppLayout({ children, hideNav = false }) {
  if (hideNav) {
    return <>{children}</>
  }

  return (
    <div className="app-layout">
      <SideNav />
      <main className="app-main">{children}</main>
      <BottomNav />
    </div>
  )
}
