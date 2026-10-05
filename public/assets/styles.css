:root{
  --bg:#EDF0F2; --surface:#FFFFFF; --ink:#17212B; --muted:#56636F; --line:#CBD3DA;
  --route:#0B6E75; --on-route:#FFFFFF; --danger:#C2410C; --warn:#A16207; --ok:#2B7A4B;
  --land:#F1F3EE; --grid:#DCE2E7; --me:#2563EB;
  box-sizing:border-box; padding-top:env(safe-area-inset-top,0px); padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#10151A; --surface:#182028; --ink:#E8EDF1; --muted:#9AA7B2; --line:#2B3641;
    --route:#4FC3CC; --on-route:#0A1418; --danger:#FF8A5B; --warn:#F2C14E; --ok:#6CCB8F;
    --land:#1C252C; --grid:#232E37; --me:#6EA8FF;
  }
}
:root[data-theme="dark"]{
  --bg:#10151A; --surface:#182028; --ink:#E8EDF1; --muted:#9AA7B2; --line:#2B3641;
  --route:#4FC3CC; --on-route:#0A1418; --danger:#FF8A5B; --warn:#F2C14E; --ok:#6CCB8F;
  --land:#1C252C; --grid:#232E37; --me:#6EA8FF;
}
html{height:100%;scroll-padding-top:env(safe-area-inset-top,0px)}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:17px;line-height:1.5;min-height:100%}
h1,h2,h3{line-height:1.2;margin:0}
h1{font-size:1.2rem}
h2{font-size:1.3rem;margin-bottom:.5rem}
h3{font-size:1.05rem;margin:1.4rem 0 .4rem}
p{margin:.4rem 0}
.wrap{max-width:720px;margin:0 auto;padding:0 16px 120px}
header.top{max-width:720px;margin:0 auto;padding:16px 16px 6px}
.screen{display:none}
.screen.on{display:block}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}
.muted{color:var(--muted);font-size:.93rem}
.banner{border-left:6px solid var(--warn);background:var(--surface);border-radius:6px;padding:12px 14px;margin:12px 0;border-top:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.banner.demo{border-left-color:var(--muted)}
.hero{padding:28px 0 8px}
.hero .big{font-size:2.15rem;line-height:1.1;font-weight:700;margin:0 0 12px;letter-spacing:-.01em}
.hero p{font-size:1.1rem;max-width:34ch}
button,select,input{font:inherit;color:inherit}
button{cursor:pointer;border-radius:8px;border:1.5px solid var(--line);background:var(--surface);padding:10px 16px;min-height:44px}
button.primary{background:var(--route);color:var(--on-route);border-color:var(--route);font-weight:700}
button.danger{border-color:var(--danger);color:var(--danger)}
button.big{min-height:54px;font-size:1.1rem;padding:12px 22px}
button:focus-visible,select:focus-visible,input:focus-visible,summary:focus-visible,canvas:focus-visible{outline:3px solid var(--route);outline-offset:2px}
input[type=text],input[type=number],select{background:var(--surface);border:1.5px solid var(--line);border-radius:8px;padding:9px 12px;min-height:44px;width:100%}
label{display:block;font-weight:700;margin:10px 0 4px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.row>*{flex:0 0 auto}
.grow{flex:1 1 180px !important}
.chip{display:inline-block;font-weight:700;font-size:.9rem;padding:2px 10px;border-radius:6px;margin-right:4px}
.chip.danger{background:color-mix(in srgb,var(--danger) 18%,transparent);color:var(--danger)}
.chip.warn{background:color-mix(in srgb,var(--warn) 20%,transparent);color:var(--warn)}
.chip.clear{background:color-mix(in srgb,var(--ok) 18%,transparent);color:var(--ok)}
.route-card h3{margin:0 0 4px}
.route-card.sel{border-color:var(--route);box-shadow:0 0 0 2px var(--route)}
.seg{display:flex;border:1.5px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface)}
.seg button{flex:1;border:0;border-radius:0;min-height:44px}
.seg button[aria-pressed="true"]{background:var(--route);color:var(--on-route);font-weight:700}
.mapbox{position:relative;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--land);margin:10px 0}
#maplibre{position:absolute;inset:0;z-index:1}
canvas{position:relative;z-index:2;display:block;width:100%;height:auto;touch-action:none;cursor:crosshair}
.mapctl{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}
.mapctl button{min-width:44px}
.mapctl select{width:auto;flex:1 1 170px}
.maplibregl-ctrl-attrib{font-size:10px}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.88rem;color:var(--muted);margin:6px 0}
.legend i{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:6px}
ul.plain{list-style:none;padding:0;margin:.4rem 0}
ul.plain li{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}
ul.plain li:first-child{border-top:0}
details{margin:10px 0}
summary{cursor:pointer;font-weight:700;padding:6px 0}
nav.tabs{position:fixed;left:0;right:0;bottom:0;background:var(--surface);border-top:1px solid var(--line);display:flex;justify-content:center;padding-bottom:env(safe-area-inset-bottom,0px);z-index:5}
nav.tabs .in{display:flex;width:100%;max-width:720px}
nav.tabs button{flex:1;border:0;border-radius:0;min-height:58px;background:transparent;font-size:.95rem;padding:8px 4px}
nav.tabs button[aria-current="page"]{color:var(--route);font-weight:700;box-shadow:inset 0 3px 0 var(--route)}
#toast{position:fixed;left:12px;right:12px;bottom:calc(70px + env(safe-area-inset-bottom,0px));max-width:696px;margin:0 auto;background:var(--ink);color:var(--bg);border-radius:10px;padding:10px 14px;display:none;align-items:center;justify-content:space-between;gap:12px;z-index:6}
#toast.on{display:flex}
#toast button{background:transparent;color:inherit;border-color:currentColor;min-height:40px}
@media (prefers-reduced-motion:reduce){*{transition:none !important;animation:none !important}}
