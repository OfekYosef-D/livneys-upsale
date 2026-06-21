import type React from 'react';
export function Card({children,className=''}:{children:React.ReactNode;className?:string}){return <div className={`rounded-[1.6rem] border border-[#eadfca] bg-white/85 shadow-sm ${className}`}>{children}</div>}
