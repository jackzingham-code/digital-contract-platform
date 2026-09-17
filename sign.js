const shareToken=location.pathname.split("/").filter(Boolean).pop();
let contract=null, signer="second", mode="draw";
const $=id=>document.getElementById(id);
async function api(url,options={}){const r=await fetch(url,{headers:{"Content-Type":"application/json"},...options});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Something went wrong");return d}
async function load(){try{contract=await api("/api/sign/"+shareToken);render()}catch(e){$("signLoading").textContent=e.message}}
function render(){
 $("signLoading").classList.add("hidden");$("signApp").classList.remove("hidden");
 $("signTitle").textContent=contract.title;
 $("signStatus").innerHTML=`<span class="status ${contract.status==="fully_signed"?"full":contract.status==="waiting"?"wait":"partial"}">${statusText(contract.status)}</span>`;
 $("signedPaper").innerHTML=renderPaper(contract);
 $("firstChoice").textContent=(contract.firstName||"First person")+(contract.firstSignature?" ✓":"");
 $("secondChoice").textContent=(contract.secondName||"Second person")+(contract.secondSignature?" ✓":"");
 $("firstChoice").classList.toggle("active",signer==="first");$("secondChoice").classList.toggle("active",signer==="second");
 const already=signer==="first"?contract.firstSignature:contract.secondSignature;
 $("signButton").disabled=!!already||contract.status==="fully_signed";
 $("signHelp").textContent=already?"This party has already signed.":contract.status==="fully_signed"?"Both parties have signed.":`You are signing as ${signer==="first"?contract.firstName:contract.secondName}.`;
}
function statusText(s){return {draft:"Draft",waiting:"Waiting for signature",partially_signed:"Partially signed",fully_signed:"Fully signed"}[s]||s}
function chooseSigner(s){signer=s;render()}
function renderPaper(c){return `<h1>${esc(c.title)}</h1><div class="contract-meta">Date: ${esc(c.contractDate)} · Contract ID: ${esc(c.id)}</div><p><strong>First person:</strong> ${esc(c.firstName)}</p><p><strong>Second person:</strong> ${esc(c.secondName)}</p><div>${c.content}</div><div class="signature-block">${sigBox(c.firstName,c.firstSignature)}${sigBox(c.secondName,c.secondSignature)}</div>`}
function sigBox(label,s){return `<div class="signature-box"><div><strong>${esc(label)}</strong></div>${s?`<img class="signature-image" src="${esc(s.signature)}"><div class="small">Signed ${fmt(s.signedAt)} by ${esc(s.name)}</div>`:"<div class='small'>Waiting for signature</div>"}</div>`}
function sigMode(m){mode=m;document.querySelectorAll(".sig-tabs button").forEach((b,i)=>b.classList.toggle("active",(m==="draw"&&i===0)||(m==="type"&&i===1)));$("sigCanvas").classList.toggle("hidden",m!=="draw");$("typedSig").classList.toggle("hidden",m!=="type")}
const canvas=$("sigCanvas"),ctx=canvas.getContext("2d");let drawing=false,last=null;
function pos(e){const r=canvas.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return{x:(p.clientX-r.left)*canvas.width/r.width,y:(p.clientY-r.top)*canvas.height/r.height}}
canvas.addEventListener("pointerdown",e=>{drawing=true;last=pos(e);canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!drawing)return;const p=pos(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle="#17202a";ctx.lineWidth=3;ctx.lineCap="round";ctx.stroke();last=p});
canvas.addEventListener("pointerup",()=>drawing=false);canvas.addEventListener("pointercancel",()=>drawing=false);
function clearSig(){ctx.clearRect(0,0,canvas.width,canvas.height);$("typedSig").value=""}
async function signContract(){
 const name=$("signerName").value.trim();
 const signature=mode==="draw"?canvas.toDataURL("image/png"):$("typedSig").value.trim();
 if(!name||!signature||(mode==="draw"&&!hasInk()))return alert("Enter your name and add your signature.");
 try{contract=await api("/api/sign/"+shareToken,{method:"POST",body:JSON.stringify({signer,name,signature})});render();$("signerName").value="";clearSig()}catch(e){alert(e.message)}
}
function hasInk(){const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;for(let i=3;i<d.length;i+=4)if(d[i]>0)return true;return false}
function fmt(x){return x?new Date(x).toLocaleString():""}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
sigMode("draw");load();