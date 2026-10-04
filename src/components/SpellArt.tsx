import { useId } from 'react';

/** Original vector spell illustrations; no external image requests. */
export default function SpellArt({ spell, className = '' }: { spell: string; className?: string }) {
  const id = useId().replace(/:/g, '');
  const fire = spell === 'fireball' || spell === 'fanTheFlames';
  const water = spell === 'waterBarrier';
  const color = fire ? '#ff8b49' : water ? '#70d5f0' : spell === 'mageBolt' ? '#f4d893' : '#b0a0ff';
  return <svg className={`spell-art ${className}`} viewBox="0 0 240 165" aria-hidden="true">
    <defs>
      <radialGradient id={`${id}bg`}><stop stopColor={color} stopOpacity=".28"/><stop offset="1" stopColor="#101017"/></radialGradient>
      <linearGradient id={`${id}core`} x1="0" y1="1" x2="1" y2="0"><stop stopColor={color}/><stop offset="1" stopColor="#fff4df"/></linearGradient>
      <filter id={`${id}glow`} x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="240" height="165" fill={`url(#${id}bg)`}/>
    <g fill="none" stroke={color} opacity=".17"><circle cx="120" cy="83" r="59"/><circle cx="120" cy="83" r="65" strokeDasharray="2 9"/><path d="M24 126L120 20L216 126ZM49 30L191 30L120 151Z"/></g>
    {fire ? <>
      <path d="M78 124C44 87 100 71 99 28C128 49 117 71 137 61C164 38 154 27 154 27C185 71 175 119 145 134Z" fill={color} filter={`url(#${id}glow)`} opacity=".65"/>
      <path d="M90 127C61 97 104 78 102 43C125 58 119 87 135 77C151 67 158 51 156 44C176 85 168 116 146 128C160 103 141 98 139 91C139 112 111 109 113 132Z" fill={`url(#${id}core)`}/>
      <path d="M116 132C104 112 130 102 128 87C148 114 142 128 130 135Z" fill="#fff5d6"/>
      {[0,1,2,3,4,5].map(n => <circle key={n} cx={65+n*22} cy={24+((n*29)%100)} r={n%2+1} fill={color}/>)}
      {spell === 'fanTheFlames' && <path d="M30 100Q65 75 80 79M34 120Q59 96 83 96M168 100Q197 93 211 70" fill="none" stroke={color} strokeWidth="2"/>}
    </> : water ? <>
      <path d="M120 25L170 49L164 95Q155 127 120 143Q85 127 76 95L70 49Z" fill={color} opacity=".3" filter={`url(#${id}glow)`}/>
      <path d="M120 29L165 51L160 92Q153 122 120 138Q87 122 80 92L75 51Z" fill="#236b89" fillOpacity=".22" stroke={color} strokeWidth="2"/>
      <path d="M120 43L150 59L146 91Q141 111 120 122Q99 111 94 91L90 59Z" fill="none" stroke={color} opacity=".5"/>
      <path d="M119 66Q95 94 120 102Q145 94 119 66Z" fill={`url(#${id}core)`}/>
      <path d="M35 105Q79 73 120 108T208 96M27 119Q65 105 90 119M157 125Q185 105 213 116" fill="none" stroke={color} opacity=".65"/>
    </> : spell === 'mindSpike' || spell === 'mageBolt' ? <>
      <path d="M147 25L103 79L129 77L92 142L158 69L130 70Z" fill={color} filter={`url(#${id}glow)`}/>
      <path d="M144 27L101 83L126 78L96 136L154 70L128 74Z" fill={`url(#${id}core)`}/>
      <g fill="none" stroke={color} opacity=".5"><path d="M73 54L89 73L75 86M164 93L178 108L163 121M131 43L114 24M103 117L70 138"/><circle cx="126" cy="80" r="43" strokeDasharray="4 12"/></g>
    </> : spell === 'counterspell' ? <>
      <circle cx="120" cy="82" r="37" fill={color} opacity=".35" filter={`url(#${id}glow)`}/>
      <g fill="none" stroke={`url(#${id}core)`} strokeWidth="2"><circle cx="120" cy="82" r="38"/><circle cx="120" cy="82" r="29" strokeDasharray="14 7"/><path d="M94 55L146 109M146 55L94 109M120 31V18M120 146V132M69 82H54M186 82H172"/></g>
      <path d="M86 45L70 38L75 55M154 117L170 126L165 109" fill="none" stroke={color}/>
    </> : <>
      <ellipse cx="120" cy="82" rx="43" ry="32" fill={color} filter={`url(#${id}glow)`} opacity=".25"/>
      <path d="M58 82Q120 20 182 82Q120 144 58 82Z" fill="#8276c4" fillOpacity=".15" stroke={color} strokeWidth="2"/>
      <circle cx="120" cy="82" r="23" fill="none" stroke={color}/><circle cx="120" cy="82" r="11" fill={`url(#${id}core)`}/>
      <path d="M120 22V36M120 128V144M76 37L84 49M164 37L156 49M75 129L83 116M165 129L157 116" stroke={color}/>
    </>}
  </svg>;
}
