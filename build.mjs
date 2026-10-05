(function(){
"use strict";
var $=function(s){return document.querySelector(s)};
var KEY="escape-route-check.v2";
var KM_PER_MI=1.609344;
var W=680,H=660,LAT0=20;

var state=load();
var draft=[];
var mode="route";
var selectedId=null;
var lastDeleted=null;
var toastTimer=null;
var liveHazards=[];
var liveFetchedAt=null;
var maplibre=null;

function fresh(){return {routes:[],hazards:[],settings:{every:30,last:null,buffer:3.219}}}
function load(){
  try{
    var raw=localStorage.getItem(KEY);
    if(raw){
      var s=JSON.parse(raw);
      if(s&&s.routes&&s.hazards&&s.settings){
        s.hazards=s.hazards.filter(function(h){return !h.sample});
        s.routes=s.routes.filter(function(r){return r.name!=="Example: canyon home to Burbank"});
        return s;
      }
    }
  }catch(e){}
  return fresh();
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function esc(t){var d=document.createElement("div");d.textContent=t;return d.innerHTML}
function mi(km){return (km/KM_PER_MI).toFixed(1)+" mi"}
function uid(){return "id"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)}

/* ---------- geometry ---------- */
function proj(p){return [p[1]*111.32*Math.cos(LAT0*Math.PI/180),p[0]*110.57]}
function ptSeg(p,a,b){
  var dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
  var t=l2?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2:0;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy));
}
function minDist(pts,h){
  var c=proj([h.lat,h.lon]),P=pts.map(proj),m=Infinity;
  for(var i=0;i<P.length-1;i++){m=Math.min(m,ptSeg(c,P[i],P[i+1]))}
  return m;
}
function lengthKm(pts){
  var P=pts.map(proj),s=0;
  for(var i=0;i<P.length-1;i++)s+=Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]);
  return s;
}
function analyze(pts){
  var buf=state.settings.buffer,worst=null;
  if(pts.length<2)return null;
  state.hazards.concat(liveHazards).forEach(function(h){
    var clr=minDist(pts,h)-h.r;
    if(!worst||clr<worst.clr)worst={h:h,clr:clr};
  });
  if(!worst)return {status:"clear",text:"No hazards are marked on the map."};
  if(worst.clr<0)return {status:"danger",text:"Passes through "+worst.h.name+". Choose another way out."};
  if(worst.clr<=buf)return {status:"warn",text:"Comes within "+mi(worst.clr)+" of "+worst.h.name+". Have a backup route ready."};
  return {status:"clear",text:"No marked hazard within "+mi(buf)+" of this route."};
}
var LABEL={danger:"Danger",warn:"Warning",clear:"Clear"};
function chip(a){return '<span class="chip '+a.status+'">'+LABEL[a.status]+'</span>'}

/* ---------- map ---------- */
var cv=$("#map"),ctx=cv.getContext("2d");
var KX=111.32*Math.cos(LAT0*Math.PI/180),KY=110.57;
var MIN_K=0.003,MAX_K=0.3,DEF_VIEW={lat:20,lon:0,k:0.3};
var view={lat:DEF_VIEW.lat,lon:DEF_VIEW.lon,k:DEF_VIEW.k};
var me=null;
function clampK(k){return Math.max(MIN_K,Math.min(MAX_K,k))}
function syncView(){
  if(maplibre){
    var c=maplibre.getCenter();
    view.lat=c.lat;view.lon=c.lng;
  }
}
function toXY(lat,lon){
  if(maplibre&&cv.clientWidth&&cv.clientHeight){
    var q=maplibre.project([lon,lat]);
    return [q.x*W/cv.clientWidth,q.y*H/cv.clientHeight];
  }
  return [W/2+(lon-view.lon)*KX/view.k,H/2-(lat-view.lat)*KY/view.k];
}
function toLL(x,y){
  if(maplibre&&cv.clientWidth&&cv.clientHeight){
    var q=maplibre.unproject([x*cv.clientWidth/W,y*cv.clientHeight/H]);
    return [q.lat,q.lng];
  }
  return [view.lat-(y-H/2)*view.k/KY,view.lon+(x-W/2)*view.k/KX];
}
function radiusPx(h){
  if(maplibre&&cv.clientWidth){
    var c=maplibre.project([h.lon,h.lat]);
    var e=maplibre.project([h.lon+h.r/KX,h.lat]);
    return Math.max(2,Math.abs(e.x-c.x)*W/cv.clientWidth);
  }
  return h.r/view.k;
}
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}
function statusColor(s){return s==="danger"?css("--danger"):s==="warn"?css("--warn"):css("--ok")}
function inView(q,m){return q[0]>-m&&q[0]<W+m&&q[1]>-m&&q[1]<H+m}

function drawLine(pts,color,width,dots){
  ctx.lineJoin="round";ctx.lineCap="round";
  ctx.strokeStyle=color;ctx.lineWidth=width;
  ctx.beginPath();
  pts.forEach(function(p,i){var q=toXY(p[0],p[1]);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});
  ctx.stroke();
  if(dots){
    pts.forEach(function(p,i){
      var q=toXY(p[0],p[1]);
      ctx.fillStyle=css("--surface");ctx.strokeStyle=color;ctx.lineWidth=3;
      ctx.beginPath();
      if(i===pts.length-1&&pts.length>1){ctx.rect(q[0]-8,q[1]-8,16,16)}else{ctx.arc(q[0],q[1],8,0,Math.PI*2)}
      ctx.fill();ctx.stroke();
    });
  }
}
function draw(){
  syncView();
  ctx.clearRect(0,0,W,H);
  if(!maplibre){
    ctx.fillStyle=css("--land");ctx.fillRect(0,0,W,H);
    // grid with coordinate labels
    var pxPerDegLon=KX/view.k;
    var steps=[0.001,0.0025,0.005,0.01,0.025,0.05,0.1,0.25,0.5,1];
    var step=1;
    for(var si=0;si<steps.length;si++){if(steps[si]*pxPerDegLon>=90){step=steps[si];break}}
    var dec=(String(step).split(".")[1]||"").length;
    var tl=toLL(0,0),br=toLL(W,H);
    ctx.strokeStyle=css("--grid");ctx.lineWidth=1;ctx.fillStyle=css("--muted");ctx.font="12px sans-serif";
    for(var i=Math.ceil(tl[1]/step);i*step<=br[1];i++){
      var lo=i*step,x=toXY(view.lat,lo)[0];
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();
      ctx.fillText(lo.toFixed(dec),x+3,14);
    }
    for(var j=Math.ceil(br[0]/step);j*step<=tl[0];j++){
      var la=j*step,y=toXY(la,view.lon)[1];
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();
      ctx.fillText(la.toFixed(dec),4,y-4);
    }
  }
  // hazards
  state.hazards.concat(liveHazards).forEach(function(h){
    var q=toXY(h.lat,h.lon),r=radiusPx(h),rb=radiusPx({lat:h.lat,lon:h.lon,r:h.r+state.settings.buffer});
    if(q[0]+rb<0||q[0]-rb>W||q[1]+rb<0||q[1]-rb>H)return;
    ctx.setLineDash([8,6]);ctx.strokeStyle=css("--warn");ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(q[0],q[1],rb,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=css("--danger");ctx.globalAlpha=.28;ctx.beginPath();ctx.arc(q[0],q[1],r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle=css("--danger");ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(q[0],q[1],r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=css("--ink");ctx.font="bold 13px sans-serif";ctx.fillText(h.name,q[0]-Math.min(r*0.6,80),q[1]+4);
  });
  // saved routes
  state.routes.forEach(function(r){
    var a=analyze(r.pts),sel=r.id===selectedId;
    if(sel)drawLine(r.pts,css("--surface"),13,false);
    drawLine(r.pts,statusColor(a?a.status:"clear"),sel?8:4,false);
    if(sel){
      var q=toXY(r.pts[0][0],r.pts[0][1]);
      ctx.fillStyle=css("--ink");ctx.font="bold 14px sans-serif";ctx.fillText(r.name,q[0]+10,q[1]+22);
    }
  });
  if(draft.length)drawLine(draft,css("--route"),6,true);
  // my location
  if(me){
    var m=toXY(me.lat,me.lon);
    if(inView(m,20)){
      ctx.fillStyle=css("--me");ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(m[0],m[1],20,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
      ctx.fillStyle=css("--me");ctx.strokeStyle=css("--surface");ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(m[0],m[1],8,0,Math.PI*2);ctx.fill();ctx.stroke();
    }
  }
  if(!maplibre){
    // scale bar
    var opts=[0.05,0.1,0.25,0.5,1,2,5,10,20,50],best=opts[0];
    opts.forEach(function(o){if(o*KM_PER_MI/view.k<=150)best=o});
    var len=best*KM_PER_MI/view.k;
    ctx.fillStyle=css("--surface");ctx.globalAlpha=.85;ctx.fillRect(10,H-52,len+24,42);ctx.globalAlpha=1;
    ctx.strokeStyle=css("--ink");ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(22,H-24);ctx.lineTo(22+len,H-24);ctx.moveTo(22,H-30);ctx.lineTo(22,H-18);ctx.moveTo(22+len,H-30);ctx.lineTo(22+len,H-18);ctx.stroke();
    ctx.fillStyle=css("--ink");ctx.font="bold 13px sans-serif";ctx.fillText(best+(best===1?" mile":" miles"),22,H-34);
  }
}

function fireName(a,index){
  return a.IncidentName||a.incidentname||a.FireName||a.fire_name||a.poly_IncidentName||("Active fire "+(index+1));
}
function fireRadiusKm(a){
  var acres=Number(a.TotalAcres||a.IncidentSize||a.DailyAcres||0);
  return acres>0?Math.max(.5,Math.sqrt(acres*.004046/Math.PI)):2;
}
function loadLiveFires(){
  var status=$("#fireStatus");
  if(status)status.textContent="Refreshing current fire incidents…";
  fetch("/api/fires",{cache:"no-store"}).then(function(r){
    if(!r.ok)throw new Error("fire feed unavailable");
    return r.json();
  }).then(function(payload){
    var features=Array.isArray(payload.features)?payload.features:[];
    liveHazards=features.map(function(f,i){
      var a=f.attributes||{},g=f.geometry||{};
      var lat=Number(g.y),lon=Number(g.x);
      if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
      return {id:"live-"+(a.IncidentID||i),name:fireName(a,i),lat:lat,lon:lon,r:fireRadiusKm(a),live:true,sample:false};
    }).filter(Boolean);
    liveFetchedAt=payload.fetchedAt?new Date(payload.fetchedAt):new Date();
    if(status)status.textContent=liveHazards.length+" current fire incident"+(liveHazards.length===1?"":"s")+" loaded from NIFC/WFIGS at "+liveFetchedAt.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})+".";
    renderAll();
  }).catch(function(){
    if(status)status.textContent="Live fire data could not be refreshed. Tap “Refresh live fires” to try again.";
  });
}
function initRoadMap(){
  if(maplibre||!$("#maplibre"))return;
  if(!window.maplibregl){
    $("#maplibre").style.display="none";
    cv.style.pointerEvents="auto";
    $("#mapMsg").textContent="The road map could not load. You can still use the coordinate map below.";
    return;
  }
  try{
    maplibre=new window.maplibregl.Map({
      container:"maplibre",
      style:"https://tiles.openfreemap.org/styles/liberty",
      center:[0,20],
      zoom:1.5,
      attributionControl:true,
      dragPan:true,
      scrollZoom:true,
      doubleClickZoom:true,
      touchZoomRotate:true,
      keyboard:true
    });
  }catch(e){
    maplibre=null;
    $("#maplibre").style.display="none";
    cv.style.pointerEvents="auto";
    $("#mapMsg").textContent="The road map could not load. You can still use the coordinate map below.";
    return;
  }
  cv.style.pointerEvents="none";
  maplibre.addControl(new window.maplibregl.NavigationControl(),"top-right");
  maplibre.addControl(new window.maplibregl.ScaleControl({maxWidth:120,unit:"imperial"}),"bottom-left");
  maplibre.on("load",function(){
    maplibre.resize();
    syncView();
    draw();
    loadLiveFires();
    if(!me)locate(false);
  });
  maplibre.on("move",function(){syncView();draw()});
  maplibre.on("resize",draw);
  maplibre.on("click",function(e){
    var target=e.originalEvent&&e.originalEvent.target;
    if(target&&target.closest&&target.closest(".maplibregl-ctrl"))return;
    addPoint([e.lngLat.lat,e.lngLat.lng]);
  });
}

function pointFromEvent(e){
  var r=cv.getBoundingClientRect();
  return toLL((e.clientX-r.left)*W/r.width,(e.clientY-r.top)*H/r.height);
}
function addPoint(ll){
  if(mode==="route"){
    draft.push([+ll[0].toFixed(5),+ll[1].toFixed(5)]);
    selectedId=null;
    $("#mapMsg").textContent="";
  }else{
    var r=parseFloat($("#hazR").value);
    if(!(r>0)){$("#mapMsg").textContent="Enter a hazard radius greater than 0.";return}
    var n=state.hazards.filter(function(h){return !h.sample}).length+1;
    state.hazards.push({id:uid(),name:"My hazard "+n,lat:+ll[0].toFixed(5),lon:+ll[1].toFixed(5),r:r*KM_PER_MI});
    save();
    $("#mapMsg").textContent="Hazard added. Every saved route was re-checked.";
  }
  renderAll();
}

/* pan by dragging, tap to add a point */
var drag=null;
cv.addEventListener("pointerdown",function(e){
  try{cv.setPointerCapture(e.pointerId)}catch(x){}
  drag={x:e.clientX,y:e.clientY,lat:view.lat,lon:view.lon,moved:false};
});
cv.addEventListener("pointermove",function(e){
  if(!drag)return;
  var r=cv.getBoundingClientRect(),s=W/r.width;
  var dx=(e.clientX-drag.x)*s,dy=(e.clientY-drag.y)*s;
  if(!drag.moved&&Math.hypot(dx,dy)<8)return;
  drag.moved=true;
  view.lon=drag.lon-dx*view.k/KX;
  view.lat=drag.lat+dy*view.k/KY;
  draw();
});
cv.addEventListener("pointerup",function(e){
  if(!drag)return;
  var d=drag;drag=null;
  if(!d.moved)addPoint(pointFromEvent(e));
});
cv.addEventListener("pointercancel",function(){drag=null});
cv.addEventListener("keydown",function(e){
  var stepPx=80*view.k,used=true;
  if(e.key==="ArrowLeft")view.lon-=stepPx/KX;
  else if(e.key==="ArrowRight")view.lon+=stepPx/KX;
  else if(e.key==="ArrowUp")view.lat+=stepPx/KY;
  else if(e.key==="ArrowDown")view.lat-=stepPx/KY;
  else if(e.key==="+"||e.key==="=")view.k=clampK(view.k/2);
  else if(e.key==="-")view.k=clampK(view.k*2);
  else used=false;
  if(used){e.preventDefault();draw()}
});

/* zoom, location, jump */
$("#zoomIn").addEventListener("click",function(){if(maplibre)maplibre.zoomIn();else{view.k=clampK(view.k/2);draw()}});
$("#zoomOut").addEventListener("click",function(){if(maplibre)maplibre.zoomOut();else{view.k=clampK(view.k*2);draw()}});
function fitTo(pts){
  var la=pts.map(function(p){return p[0]}),lo=pts.map(function(p){return p[1]});
  var a=Math.min.apply(null,la),b=Math.max.apply(null,la),c=Math.min.apply(null,lo),d=Math.max.apply(null,lo);
  if(maplibre){
    maplibre.fitBounds([[c,a],[d,b]],{padding:70,maxZoom:15,duration:350});
  }else{
    view.lat=(a+b)/2;view.lon=(c+d)/2;
    view.k=clampK(Math.max((d-c)*KX/W,(b-a)*KY/H)*1.5||MIN_K);
  }
}
function locate(manual){
  var msg=$("#mapMsg");
  if(!navigator.geolocation){if(manual)msg.textContent="This browser can't share your location. Pick an area or enter coordinates instead.";return}
  if(manual)msg.textContent="Finding your location…";
  navigator.geolocation.getCurrentPosition(function(p){
    me={lat:p.coords.latitude,lon:p.coords.longitude};
    if(maplibre)maplibre.flyTo({center:[me.lon,me.lat],zoom:12,duration:500});
    else{view.lat=me.lat;view.lon=me.lon;view.k=0.008}
    msg.textContent="Zoomed to your location. It stays on this device.";
    draw();
  },function(){
    msg.textContent=manual?"Couldn't get your location. Allow location access in your browser, pick an area, or enter coordinates.":"";
  },{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}
$("#locate").addEventListener("click",function(){locate(true)});

function readCoord(){
  var m=$("#coord").value.split(/[ ,]+/).filter(Boolean).map(Number);
  var msg=$("#mapMsg");
  if(m.length!==2||m.some(isNaN)||Math.abs(m[0])>90||Math.abs(m[1])>180){msg.textContent="Enter two numbers separated by a comma, like 34.09, -118.60.";return null}
  return m;
}
$("#addCoord").addEventListener("click",function(){
  var m=readCoord();if(!m)return;
  var q=toXY(m[0],m[1]);
  if(!inView(q,-20)){view.lat=m[0];view.lon=m[1]}
  addPoint(m);$("#coord").value="";
});
$("#centerCoord").addEventListener("click",function(){
  var m=readCoord();if(!m)return;
  if(maplibre)maplibre.flyTo({center:[m[1],m[0]],zoom:12,duration:500});
  else{view.lat=m[0];view.lon=m[1];if(view.k>0.05)view.k=0.02}
  $("#mapMsg").textContent="Map centered on "+m[0]+", "+m[1]+".";
  draw();
});

function setMode(m){
  mode=m;
  $("#modeRoute").setAttribute("aria-pressed",m==="route");
  $("#modeHazard").setAttribute("aria-pressed",m==="hazard");
  $("#modeRouteBox").hidden=m!=="route";
  $("#modeHazardBox").hidden=m!=="hazard";
  $("#mapMsg").textContent="";
}
$("#modeRoute").addEventListener("click",function(){setMode("route")});
$("#modeHazard").addEventListener("click",function(){setMode("hazard")});
$("#undo").addEventListener("click",function(){if(draft.length){draft.pop();renderAll()}});
$("#clear").addEventListener("click",function(){
  if(!draft.length)return;
  draft=[];selectedId=null;$("#routeName").value="";
  $("#mapMsg").textContent="Route points cleared. Tap the map to start again.";
  renderAll();
});
$("#saveRoute").addEventListener("click",function(){
  var msg=$("#mapMsg");
  if(draft.length<2){msg.textContent="Add at least two points: a start and a destination.";return}
  var name=$("#routeName").value.trim()||("Route "+(state.routes.length+1));
  var id=uid();
  state.routes.push({id:id,name:name,pts:draft.slice()});
  if(!state.settings.last)state.settings.last=new Date().toISOString();
  save();
  draft=[];$("#routeName").value="";msg.textContent="";
  selectedId=id;
  renderAll();
  showTab("routes");
});

/* ---------- delete with undo ---------- */
function toast(text){
  $("#toastText").textContent=text;$("#toast").classList.add("on");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){$("#toast").classList.remove("on");lastDeleted=null},7000);
}
function removeRoute(id){
  var i=state.routes.findIndex(function(r){return r.id===id});
  if(i<0)return;
  lastDeleted={type:"routes",item:state.routes[i],idx:i};
  state.routes.splice(i,1);
  if(selectedId===id)selectedId=null;
  save();renderAll();toast("Route deleted.");
}
function removeHazard(id){
  var i=state.hazards.findIndex(function(h){return h.id===id});
  if(i<0)return;
  lastDeleted={type:"hazards",item:state.hazards[i],idx:i};
  state.hazards.splice(i,1);
  save();renderAll();toast("Hazard removed.");
}
$("#toastUndo").addEventListener("click",function(){
  if(lastDeleted){state[lastDeleted.type].splice(lastDeleted.idx,0,lastDeleted.item);lastDeleted=null;save();renderAll()}
  $("#toast").classList.remove("on");
});

/* ---------- renders ---------- */
function renderDraft(){
  var a=analyze(draft);
  if(!draft.length){
    $("#draftInfo").textContent="Tap the map to add your start, turns, and destination. Drag anywhere to pan. Add at least 2 points to save.";
  }else if(draft.length===1){
    $("#draftInfo").textContent="1 point added. Tap the destination or another turn; add at least one more point to save.";
  }else{
    $("#draftInfo").textContent=draft.length+" points · "+mi(lengthKm(draft))+". Keep adding turns, or save the route.";
  }
  $("#draftResult").innerHTML=a?'<div class="card">'+chip(a)+" "+esc(a.text)+"</div>":"";
  $("#undo").disabled=draft.length===0;
  $("#clear").disabled=draft.length===0;
  $("#saveRoute").disabled=draft.length<2;
}
function renderHome(){
  var n=state.routes.length,box=$("#homeStatus");
  if(!n){
    box.innerHTML='<strong>No routes saved yet.</strong><p class="muted">Draw the way you would leave home in an emergency. The app checks it against the hazards on the map.</p>';
  }else{
    var c={danger:0,warn:0,clear:0};
    state.routes.forEach(function(r){var a=analyze(r.pts);if(a)c[a.status]++});
    var chips=["danger","warn","clear"].filter(function(k){return c[k]}).map(function(k){return '<span class="chip '+k+'">'+c[k]+" "+LABEL[k]+"</span>"}).join("");
    box.innerHTML='<strong>'+n+(n===1?" route saved":" routes saved")+'</strong><p>'+chips+'</p>';
  }
  $("#homeRoutes").hidden=!n;
}
function renderRoutes(){
  var box=$("#routeList");
  if(!state.routes.length){
    box.innerHTML='<div class="card"><strong>No routes saved yet.</strong><p class="muted">Draw the way you would leave home in an emergency. The app will check it against known hazards.</p></div>';
  }else{
    box.innerHTML=state.routes.map(function(r){
      var a=analyze(r.pts);
      return '<div class="card route-card'+(r.id===selectedId?" sel":"")+'"><h3>'+esc(r.name)+'</h3><p class="muted">'+mi(lengthKm(r.pts))+' · '+r.pts.length+' points</p><p>'+chip(a)+' '+esc(a.text)+'</p><div class="row"><button data-view="'+r.id+'">See on map</button><button class="danger" data-del="'+r.id+'">Delete route</button></div></div>';
    }).join("");
  }
}
function renderMapLists(){
  $("#mapRoutes").innerHTML=state.routes.map(function(r){
    return '<li><span>'+esc(r.name)+(r.id===selectedId?' <span class="muted">· highlighted</span>':'')+'</span><button class="danger" data-del="'+r.id+'">Delete</button></li>';
  }).join("")||'<li class="muted">No saved routes.</li>';
  $("#hazList").innerHTML=state.hazards.concat(liveHazards).map(function(h){
    if(h.live)return '<li><span>'+esc(h.name)+' <span class="muted">· live NIFC/WFIGS · radius '+mi(h.r)+'</span></span><span class="muted">Live</span></li>';
    return '<li><span>'+esc(h.name)+' <span class="muted">· radius '+mi(h.r)+'</span></span><button class="danger" data-hdel="'+h.id+'">Remove</button></li>';
  }).join("")||'<li class="muted">No hazards on the map.</li>';
}
function reminderState(){
  var e=+state.settings.every;
  if(!e||!state.routes.length)return null;
  var last=state.settings.last?new Date(state.settings.last):null;
  var next=last?new Date(last.getTime()+e*864e5):new Date();
  return {due:next<=new Date(),next:next,last:last};
}
function renderBanners(){
  var rs=reminderState();
  var html=rs&&rs.due?'<div class="banner" role="alert"><strong>Time to re-check your routes.</strong> Look at each status, then tap the button.<div class="row" style="margin-top:8px"><button class="primary" data-done="1">I re-checked my routes</button></div></div>':"";
  document.querySelectorAll(".dueBanner").forEach(function(el){el.innerHTML=html});
}
function renderAlerts(){
  $("#every").value=String(state.settings.every);
  var opts=[1.609,3.219,8.047];
  var best=opts.reduce(function(p,c){return Math.abs(c-state.settings.buffer)<Math.abs(p-state.settings.buffer)?c:p});
  $("#buffer").value=String(best);
  var rs=reminderState(),t;
  if(!+state.settings.every)t="Reminders are off.";
  else if(!state.routes.length)t="Save a route to start the reminder.";
  else t=(rs.due?"Your routes are due for a re-check now.":"Next reminder: "+rs.next.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})+".")+(rs.last?" Last re-checked "+rs.last.toLocaleDateString(undefined,{month:"long",day:"numeric"})+".":"");
  $("#remStatus").textContent=t;
  var nb=$("#askNotif");
  if(!("Notification" in window)){nb.hidden=true}
  else if(Notification.permission==="granted"){nb.textContent="Notifications allowed";nb.disabled=true}
  else if(Notification.permission==="denied"){nb.textContent="Notifications blocked in browser";nb.disabled=true}
}
function renderAll(){renderHome();renderRoutes();renderMapLists();renderDraft();renderBanners();renderAlerts();draw()}

/* ---------- events ---------- */
function markReviewed(){state.settings.last=new Date().toISOString();save();renderAll()}
$("#markReviewed").addEventListener("click",markReviewed);
document.addEventListener("click",function(e){
  if(e.target.closest("[data-done]"))markReviewed();
  var v=e.target.closest("[data-view]"),d=e.target.closest("[data-del]"),h=e.target.closest("[data-hdel]");
  if(v){selectedId=v.getAttribute("data-view");draft=[];var rt=state.routes.filter(function(r){return r.id===selectedId})[0];if(rt)fitTo(rt.pts);renderAll();showTab("map")}
  if(d)removeRoute(d.getAttribute("data-del"));
  if(h)removeHazard(h.getAttribute("data-hdel"));
});
$("#every").addEventListener("change",function(){state.settings.every=+this.value;if(!state.settings.last&&state.routes.length)state.settings.last=new Date().toISOString();save();renderAll()});
$("#buffer").addEventListener("change",function(){state.settings.buffer=+this.value;save();renderAll()});
$("#askNotif").addEventListener("click",function(){try{Notification.requestPermission().then(renderAlerts)}catch(e){}});
$("#refreshFires").addEventListener("click",loadLiveFires);
var triedLoc=false;
function startDrawing(){
  setMode("route");
  showTab("map");
  if(!triedLoc&&!me){triedLoc=true;locate(false)}
}
$("#homeDraw").addEventListener("click",startDrawing);
$("#routesDraw").addEventListener("click",startDrawing);
$("#homeRoutes").addEventListener("click",function(){showTab("routes")});
var wipeArm=false;
$("#wipe").addEventListener("click",function(){
  var b=this;
  if(wipeArm){state=fresh();draft=[];selectedId=null;save();wipeArm=false;b.textContent="Erase all routes and hazards";renderAll()}
  else{wipeArm=true;b.textContent="Tap again to erase everything";setTimeout(function(){wipeArm=false;b.textContent="Erase all routes and hazards"},3000)}
});
if(window.matchMedia)window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",draw);

/* ---------- tabs ---------- */
function showTab(name){
  ["home","routes","map","alerts"].forEach(function(n){$("#s-"+n).classList.toggle("on",n===name)});
  document.querySelectorAll("nav.tabs button").forEach(function(b){
    if(b.getAttribute("data-tab")===name)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  });
  window.scrollTo(0,0);
  if(name==="map"){
    initRoadMap();
    if(maplibre){setTimeout(function(){maplibre.resize();draw()},0)}
    else draw();
  }
}
document.querySelectorAll("nav.tabs button").forEach(function(b){
  b.addEventListener("click",function(){showTab(b.getAttribute("data-tab"))});
});

/* ---------- start ---------- */
renderAll();
loadLiveFires();
var rs0=reminderState();
if(rs0&&rs0.due&&"Notification" in window&&Notification.permission==="granted"){
  try{new Notification("Re-check your escape routes",{body:"Open Escape Route Check to see if any route is near a hazard."})}catch(e){}
}
})();
