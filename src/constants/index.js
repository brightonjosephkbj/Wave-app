export const API = 'https://wave-backened-production.up.railway.app';
export const QUALITY_OPTIONS = ['144p','240p','360p','480p','720p','1080p','1440p','2160p','128kbps','192kbps','320kbps'];
export const FORMAT_OPTIONS = ['mp4','mp3','webm','m4a','mkv','flac','ogg','opus','aac'];
export const THEMES = {
  default: { name:'Default', primary:'#7c6dfa', primary2:'#b06dfa', accent:'#00e5ff', accent2:'#ff6d9d', bg:'#06060f', bg2:'#0c0c1a', card:'#111127', border:'#1e1e3a', text:'#f0f0ff', sub:'#7070a0', success:'#00e676', danger:'#ff4c4c', glow:'rgba(124,109,250,0.2)' },
  ocean:   { name:'Ocean',   primary:'#0066ff', primary2:'#0099ff', accent:'#00e5ff', accent2:'#80dfff', bg:'#020814', bg2:'#040d1e', card:'#081428', border:'#0a2040', text:'#e0f0ff', sub:'#5080a0', success:'#00e676', danger:'#ff4c4c', glow:'rgba(0,102,255,0.2)' },
  sunset:  { name:'Sunset',  primary:'#ff6b35', primary2:'#ff4500', accent:'#ffd700', accent2:'#ff9f43', bg:'#0f0800', bg2:'#1a0e00', card:'#1f1200', border:'#3a2200', text:'#fff5e0', sub:'#a07050', success:'#00e676', danger:'#ff4c4c', glow:'rgba(255,107,53,0.2)' },
  forest:  { name:'Forest',  primary:'#00c853', primary2:'#009624', accent:'#76ff03', accent2:'#b9f6ca', bg:'#010f04', bg2:'#011a06', card:'#021f08', border:'#0a3d10', text:'#e0ffe8', sub:'#507060', success:'#00e676', danger:'#ff4c4c', glow:'rgba(0,200,83,0.2)' },
  rose:    { name:'Rose',    primary:'#e91e8c', primary2:'#c2185b', accent:'#ff6d9d', accent2:'#f8bbd9', bg:'#0f0009', bg2:'#1a0012', card:'#200018', border:'#3a0028', text:'#ffe0f0', sub:'#a05080', success:'#00e676', danger:'#ff4c4c', glow:'rgba(233,30,140,0.2)' },
  neon:    { name:'Neon',    primary:'#39ff14', primary2:'#00cc00', accent:'#ccff00', accent2:'#b3ff66', bg:'#010f00', bg2:'#021a00', card:'#031f00', border:'#083a00', text:'#e0ffe0', sub:'#508050', success:'#00e676', danger:'#ff4c4c', glow:'rgba(57,255,20,0.2)' },
  cyber:   { name:'Cyber',   primary:'#ff00ff', primary2:'#cc00cc', accent:'#00ffff', accent2:'#ff80ff', bg:'#050005', bg2:'#0a000a', card:'#100010', border:'#280028', text:'#ffe0ff', sub:'#805080', success:'#00e676', danger:'#ff4c4c', glow:'rgba(255,0,255,0.2)' },
  galaxy:  { name:'Galaxy',  primary:'#6a0dad', primary2:'#3d0066', accent:'#c0c0ff', accent2:'#9090ff', bg:'#05000f', bg2:'#0a001a', card:'#100020', border:'#200040', text:'#f0e0ff', sub:'#806090', success:'#00e676', danger:'#ff4c4c', glow:'rgba(106,13,173,0.2)' },
  gold:    { name:'Gold',    primary:'#ffc107', primary2:'#ff8f00', accent:'#ff9800', accent2:'#ffe082', bg:'#0f0c00', bg2:'#1a1400', card:'#201800', border:'#3a2e00', text:'#fff8e0', sub:'#a09050', success:'#00e676', danger:'#ff4c4c', glow:'rgba(255,193,7,0.2)' },
  ice:     { name:'Ice',     primary:'#00bcd4', primary2:'#0097a7', accent:'#80deea', accent2:'#e0f7fa', bg:'#010c0f', bg2:'#02141a', card:'#031a20', border:'#063040', text:'#e0f8ff', sub:'#507080', success:'#00e676', danger:'#ff4c4c', glow:'rgba(0,188,212,0.2)' },
};
export const SEARCH_SITES = [
  { id:'youtube', name:'YouTube', icon:'▶️' },
  { id:'soundcloud', name:'SoundCloud', icon:'☁️' },
  { id:'dailymotion', name:'Dailymotion', icon:'📺' },
  { id:'reddit', name:'Reddit', icon:'🔴' },
  { id:'tiktok', name:'TikTok', icon:'🎵' },
  { id:'vimeo', name:'Vimeo', icon:'🎬' },
];
export const BROWSER_QUICK_LINKS = [
  { name:'DuckDuckGo', url:'https://duckduckgo.com', icon:'🦆' },
  { name:'SoundCloud', url:'https://soundcloud.com', icon:'☁️' },
  { name:'AudioMack',  url:'https://audiomack.com',  icon:'🎵' },
  { name:'Vimeo',      url:'https://vimeo.com',      icon:'🎬' },
  { name:'Archive',    url:'https://archive.org/details/audio', icon:'📦' },
  { name:'Dailymotion',url:'https://dailymotion.com', icon:'📺' },
];
export const EQ_PRESETS = {
  flat:      { name:'Flat',       bands:[0,0,0,0,0,0,0,0,0,0] },
  bass:      { name:'Bass Boost', bands:[6,5,4,3,2,0,0,0,0,0] },
  rock:      { name:'Rock',       bands:[5,4,3,2,0,-1,-1,0,3,4] },
  pop:       { name:'Pop',        bands:[-1,0,2,3,3,2,0,-1,-1,-1] },
  jazz:      { name:'Jazz',       bands:[0,0,0,3,3,3,0,0,3,3] },
  classical: { name:'Classical',  bands:[0,0,0,0,0,0,-3,-4,-4,-5] },
  hiphop:    { name:'Hip-Hop',    bands:[5,4,2,4,0,-1,0,0,4,4] },
  electronic:{ name:'Electronic', bands:[4,3,0,0,-2,0,3,4,4,4] },
  vocal:     { name:'Vocal',      bands:[-3,-2,0,2,4,4,3,2,-1,-2] },
  acoustic:  { name:'Acoustic',   bands:[3,3,2,1,0,0,1,1,2,2] },
};
