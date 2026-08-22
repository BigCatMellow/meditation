const steps=[
[-480,"−8 hr","Dry brine","Salt the shoulder and refrigerate uncovered. 8–12 hours is ideal."],
[-45,"−45 min","Prep","Remove from fridge. Apply binder and rub. Preheat to 275°F."],
[0,"0 hr","Start cook","Put shoulder in unwrapped at 275°F. Insert temperature probe."],
[60,"1 hr","Leave it alone","Maintain 275°F. Avoid opening unnecessarily."],
[120,"2 hr","Keep cooking","Bark is beginning to develop. Maintain 275°F."],
[180,"3 hr","Check surface","Lightly spritz only if the exterior looks excessively dry."],
[240,"4 hr","Watch the bark","Internal may be around 140–155°F. Bark should be getting darker."],
[300,"5 hr","Likely stall","Internal may be around 150–165°F. Check bark."],
[360,"6 hr","Likely wrapping window","If bark is dark mahogany, fairly dry, and doesn't smear, wrap tightly. With a sugary rub, wrapping a little earlier is fine once bark is set."],
[390,"6½ hr","Raise to 300°F","Once wrapped, increase cooker temperature to 300°F."],
[420,"7 hr","Wrapped cook","Leave wrapped. Temperature should begin climbing through the stall."],
[480,"8 hr","Watch closely","As internal approaches 195–198°F, get ready to start probing."],
[540,"9 hr","Probe for tenderness","Check several spots. The probe should slide in with very little resistance."],
[600,"10 hr","Finish window","Most shoulders finish around 200–205°F, but tenderness decides."],
[660,"+1 hr","Rest / hold","Keep wrapped. Hold around 150–170°F if possible."],
[720,"+2 hr","Serve","Unwrap, save juices, pull the pork, and mix juices back in."]
];

let startMs=null,endMs=null,fired=new Set(),timer=null,activeAlarm=null,alarmRepeatTimer=null;
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");

function dtLocal(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function fmtTime(ms){return new Date(ms).toLocaleString([], {weekday:"short",hour:"numeric",minute:"2-digit"})}
function cd(ms){const past=ms<0;ms=Math.abs(ms);const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return (past?"":"in ")+(h?h+"h ":"")+m+"m "+sec+"s"+(past?" ago":"")}
function phaseFor(i){if(i<=1)return"Prep";if(i<=7)return"Smoke / Roast";if(i<=12)return"Wrapped";if(i<=13)return"Finish";return"Rest"}

function completedStepIndexes(){
  return steps.map((_,i)=>localStorage.getItem("psStep"+i)==="1"?i:null).filter(i=>i!==null);
}

async function scheduleNativeAlerts(){
  if(!startMs || !window.ShoulderNative?.scheduleCook)return;
  try{
    const result=await window.ShoulderNative.scheduleCook(startMs,steps,completedStepIndexes());
    if(result?.warning){$("status").textContent+=" · "+result.warning;}
  }catch(e){
    console.warn("Native notification scheduling failed",e);
    $("status").textContent+=" · Android alerts need permission.";
  }
}

async function cancelNativeStep(i){
  try{await window.ShoulderNative?.cancelStep?.(i)}catch(e){console.warn(e)}
}

async function cancelAllNativeAlerts(){
  try{await window.ShoulderNative?.cancelAll?.()}catch(e){console.warn(e)}
}

function render(){
  $("timeline").innerHTML="";
  steps.forEach((s,i)=>{
    const el=document.createElement("div");el.className="step";el.dataset.i=i;
    el.innerHTML=`<div class="step-time">${s[1]}</div><div><div class="step-title">${s[2]}</div><div class="step-desc">${s[3]}</div><div class="step-clock"></div></div><input class="check" type="checkbox" aria-label="Mark ${s[2]} complete">`;
    const cb=el.querySelector(".check");cb.checked=localStorage.getItem("psStep"+i)==="1";
    cb.addEventListener("change",async()=>{
      localStorage.setItem("psStep"+i,cb.checked?"1":"0");
      if(cb.checked)await cancelNativeStep(i); else await scheduleNativeAlerts();
      update();
    });
    $("timeline").appendChild(el);
  });
}

function playAlarmPulse(){
  if(!$("soundEnabled").checked)return;
  try{
    const A=window.AudioContext||window.webkitAudioContext;
    const c=new A(),o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);
    o.frequency.value=880;g.gain.value=.16;o.start();
    setTimeout(()=>{o.frequency.value=660},280);
    setTimeout(()=>{o.stop();c.close()},800);
  }catch(e){}
  if(navigator.vibrate)navigator.vibrate([300,140,300,140,500]);
}

function showBrowserNotification(title,body){
  if(!("Notification" in window))return;
  if(Notification.permission==="granted"){
    try{
      new Notification("Shoulder — "+title,{body,tag:"shoulder-cook-alert",renotify:true});
    }catch(e){}
  }
}

function alarm(i){
  if(activeAlarm!==null)return;
  activeAlarm=i;
  const s=steps[i];
  $("alarmTitle").textContent=s[2];
  $("alarmDesc").textContent=s[3];
  const modal=$("alarmModal");
  modal.style.display="flex";
  modal.classList.remove("hidden");
  playAlarmPulse();
  showBrowserNotification(s[2],s[3]);
  if(alarmRepeatTimer)clearInterval(alarmRepeatTimer);
  alarmRepeatTimer=setInterval(()=>{
    playAlarmPulse();
    showBrowserNotification(s[2],s[3]);
  },8000);
}

async function acknowledgeAlarm(){
  const acknowledged=activeAlarm;
  if(alarmRepeatTimer)clearInterval(alarmRepeatTimer);
  alarmRepeatTimer=null;
  activeAlarm=null;
  const modal=$("alarmModal");
  modal.style.display="none";
  modal.classList.add("hidden");
  if(acknowledged!==null){
    localStorage.setItem("psStep"+acknowledged,"1");
    const cb=document.querySelector(`.step[data-i="${acknowledged}"] .check`);
    if(cb)cb.checked=true;
    await cancelNativeStep(acknowledged);
    update();
  }
}

function update(){
  if(!startMs)return;
  const now=Date.now();

  let nextFuture=-1;
  let firstOverdue=-1;
  let overdueCount=0;

  document.querySelectorAll(".step").forEach((el,i)=>{
    const when=startMs+steps[i][0]*60000;
    const cb=el.querySelector(".check");

    el.querySelector(".step-clock").textContent=fmtTime(when);
    el.classList.toggle("done",cb.checked);
    el.classList.remove("active");

    if(!cb.checked){
      if(when>now && nextFuture<0) nextFuture=i;
      if(when<=now){
        overdueCount++;
        if(firstOverdue<0) firstOverdue=i;
      }
    }

    if(now>=when && !fired.has(i) && !cb.checked){
      fired.add(i);
      alarm(i);
      $("status").textContent="Alarm: "+steps[i][2];
    }
  });

  const next = nextFuture>=0 ? nextFuture : firstOverdue;

  if(next>=0){
    const when=startMs+steps[next][0]*60000;
    const s=steps[next];
    const el=document.querySelector(`.step[data-i="${next}"]`);
    if(el)el.classList.add("active");

    $("nextTitle").textContent=s[2];
    $("nextDesc").textContent=s[3];

    const remaining=when-now;
    $("countdown").textContent=remaining>0 ? cd(remaining) : "Due now";
    $("nextClock").textContent=fmtTime(when);
    $("phaseBadge").textContent=phaseFor(next);

    if(overdueCount>0 && nextFuture>=0){
      $("overdueNote").textContent=overdueCount+" earlier step"+(overdueCount===1?" is":"s are")+" overdue — check off anything you've already completed.";
      $("overdueNote").classList.remove("hidden");
    }else{
      $("overdueNote").textContent="";
      $("overdueNote").classList.add("hidden");
    }
  }else{
    $("nextTitle").textContent="Cook complete";
    $("nextDesc").textContent="All steps are marked complete.";
    $("countdown").textContent="Done";
    $("nextClock").textContent="—";
    $("phaseBadge").textContent="Complete";
    $("overdueNote").textContent="";
    $("overdueNote").classList.add("hidden");
  }

  if(endMs){
    const total=endMs-(startMs-480*60000);
    const elapsed=Math.max(0,Math.min(total,now-(startMs-480*60000)));
    const pct=Math.round(elapsed/total*100);
    $("progressBar").style.width=pct+"%";
    $("progressPct").textContent=pct+"%";
    $("progressLabel").textContent=now<startMs?"Prep":now<endMs?"Cook in progress":"Serve";
  }
}

function build(){
  const raw=$("endTime").value;
  if(!raw){$("status").textContent="Choose a serving time.";return}
  endMs=new Date(raw).getTime();
  startMs=endMs-(12*60*60000);
  localStorage.setItem("psEnd",endMs);
  localStorage.setItem("psSound",$("soundEnabled").checked?"1":"0");
  fired.clear();
  $("status").textContent="Start cooking "+fmtTime(startMs)+" · Serve "+fmtTime(endMs);
  update();
  scheduleNativeAlerts();
  if(timer)clearInterval(timer);
  timer=setInterval(update,1000);
}

$("startBtn").addEventListener("click",build);
$("testBtn").addEventListener("click",()=>{playAlarmPulse();$("status").textContent="Test alarm played."});
$("clearChecksBtn").addEventListener("click",async()=>{steps.forEach((_,i)=>localStorage.removeItem("psStep"+i));render();update();await scheduleNativeAlerts()});
$("resetBtn").addEventListener("click",async()=>{
  if(confirm("Reset serving time and all checkmarks?")){
    await cancelAllNativeAlerts();
    localStorage.clear();startMs=null;endMs=null;fired.clear();if(timer)clearInterval(timer);
    render();const d=new Date(Date.now()+24*60*60000);d.setMinutes(0,0,0);$("endTime").value=dtLocal(d);
    $("status").textContent="Reset complete. Choose a new serving time.";
    $("nextTitle").textContent="Set a serving time";$("nextDesc").textContent="Your cooking schedule will appear here.";
    $("countdown").textContent="—";$("nextClock").textContent="—";$("phaseBadge").textContent="Waiting";
    $("progressBar").style.width="0%";$("progressPct").textContent="0%";$("progressLabel").textContent="Not started";
  }
});
$("soundEnabled").addEventListener("change",()=>localStorage.setItem("psSound",$("soundEnabled").checked?"1":"0"));
$("ackBtn").addEventListener("click",acknowledgeAlarm);

$("notifyBtn").addEventListener("click",async()=>{
  if(window.ShoulderNative?.enable){
    try{
      const result=await window.ShoulderNative.enable();
      if(result?.granted){
        $("notifyBtn").textContent="Enabled";
        $("status").textContent="Android notifications enabled.";
        await scheduleNativeAlerts();
      }else{
        $("status").textContent="Android notification permission was not granted.";
      }
    }catch(e){
      console.warn(e);
      $("status").textContent="Could not enable Android notifications.";
    }
    return;
  }
  if(!("Notification" in window)){
    $("status").textContent="Notifications are not available in this browser.";
    return;
  }
  try{
    const result=await Notification.requestPermission();
    $("status").textContent=result==="granted" ? "Browser notifications enabled." : "Notification permission was not granted.";
    $("notifyBtn").textContent=result==="granted" ? "Enabled" : "Enable";
  }catch(e){
    $("status").textContent="Notifications are not available in this browser context.";
  }
});


document.querySelectorAll(".navbtn").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".navbtn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  ["Cook","Guide","Settings"].forEach(name=>$("screen"+name).classList.toggle("hidden",name!==btn.dataset.screen));
  window.scrollTo({top:0,behavior:"smooth"});
}));

render();
const ss=localStorage.getItem("psSound");if(ss!==null)$("soundEnabled").checked=ss==="1";
if("Notification" in window && Notification.permission==="granted")$("notifyBtn").textContent="Enabled";
window.addEventListener("shoulder-native-ready",async()=>{
  $("notifyBtn").textContent="Enable";
  if(startMs)await scheduleNativeAlerts();
});
const saved=Number(localStorage.getItem("psEnd"));
if(saved){
  endMs=saved;startMs=endMs-(12*60*60000);$("endTime").value=dtLocal(new Date(endMs));
  $("status").textContent="Start cooking "+fmtTime(startMs)+" · Serve "+fmtTime(endMs);
  update();timer=setInterval(update,1000);
}else{
  const d=new Date(Date.now()+24*60*60000);d.setMinutes(0,0,0);$("endTime").value=dtLocal(d);
}
