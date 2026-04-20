'use client'

import dynamic from 'next/dynamic'

// ssr: false = server renders nothing for these components.
// This is the only reliable fix while Turbopack's persistent cache
// is frozen on an old version of Sidebar/TabBar that has href="/".
// The client always loads the current compiled code so no mismatch occurs.
const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false })
const TabBar  = dynamic(() => import('./TabBar'),  { ssr: false })

export function AppSidebar() { return <Sidebar /> }
export function AppTabBar()  { return <TabBar /> }
