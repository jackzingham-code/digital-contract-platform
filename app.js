let ownerToken = localStorage.getItem("contract_owner_token");
let contracts = [];
let currentId = null;
let filter = "all";
const $ = id => document.getElementById(id);

async function api(url, options={}) {
  const r = await fetch(url, {headers: {"Content-Type":"application/json"}, ...options});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

async function loadContracts() {
  if (!ownerToken) { renderList(); return; }
  contracts = await api(`/api/contracts?ownerToken=${encodeURIComponent(ownerToken)}`);
  renderList();
}
function setFilter(f){filter=f;document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.filter===f));renderList()}
function statusText(s){return {draft:"Draft",waiting:"Waiting for signature",partially_signed:"Partially signed",fully_signed:"Fully signed"}[s]||s}
function renderList(){
  const counts={all:contracts.length,draft:0,waiting:0,partially_signed:0,fully_signed:0};
  contracts.forEach(c=>counts[c.status]++);
  $("countAll").textContent=counts.all||"";
  $("countDraft").textContent=counts.draft||"";
  $("countWaiting").textContent=counts.waiting||"";
  $("countPartial").textContent=counts.partially_signed||"";
  $("countFull").textContent=counts.fully_signed||"";
  const rows=contracts.filter(c=>filter==="all"||c.status===filter);
  $("contractList").innerHTML=rows.length?rows.map(c=>`
    <div class="contract-row" onclick="openContract('${c.id}')">
      <div><div class="contract-name">${esc(c.title||"Untitled contract")}</div><div class="small">${esc(c.id)}</div></div>
      <div>${esc(c.secondName||"No second party")}<div class="small">Other person</div></div>
      <div>${fmt(c.createdAt)}<div class="small">Created</div></div>
      <div>${fmt(c.updatedAt)}<div class="small">Updated</div></div>
      <div><span class="status ${c.status==='fully_signed'?'full':c.status==='waiting'?'wait':c.status==='partially_signed'?'partial':''}">${statusText(c.status)}</span></div>
    </div>`).join(""):`<div class="editor-pane"><p>No contracts in this view.</p><button class="btn primary" onclick="newContract()">Create your first contract</button></div>`;
}
function newContract(){
  currentId=null;
  $("dashboardView").classList.add("hidden");$("editorView").classList.remove("hidden");
  $("title").value="";$("contractDate").value=new Date().toISOString().slice(0,10);$("firstName").value="";$("secondName").value="";$("content").innerHTML="";
  $("lockLabel").textContent="";$("sendBtn").textContent="Send for Signature";$("sendBtn").disabled=false;updatePreview();
}
async function openContract(id){
  const c=await api(`/api/contracts/${id}?ownerToken=${encodeURIComponent(ownerToken)}`);
  currentId=id;$("dashboardView").classList.add("hidden");$("editorView").classList.remove("hidden");
  $("title").value=c.title;$("contractDate").value=c.contractDate;$("firstName").value=c.firstName;$("secondName").value=c.secondName;$("content").innerHTML=c.content;
  const locked=c.status!=="draft";
  ["title","contractDate","firstName","secondName","content"].forEach(x=>$(x).disabled=locked);
  $("sendBtn").disabled=locked;$("sendBtn").textContent=c.status==="draft"?"Send for Signature":"Contract sent";
  $("lockLabel").innerHTML=locked?'<span class="lock">Locked after first signature</span>':"";
  updatePreview(c);
}
async function saveContract(){
  if(!currentId){const d=await api("/api/contracts",{method:"POST",body:JSON.stringify({ownerToken,title:$("title").value,contractDate:$("contractDate").value,firstName:$("firstName").value,secondName:$("secondName").value,content:$("content").innerHTML})});ownerToken=d.ownerToken;localStorage.setItem("contract_owner_token",ownerToken);currentId=d.contract.id}
  else await api(`/api/contracts/${currentId}`,{method:"PUT",body:JSON.stringify({ownerToken,title:$("title").value,contractDate:$("contractDate").value,firstName:$("firstName").value,secondName:$("secondName").value,content:$("content").innerHTML})});
  $("saveStatus").textContent="Saved "+new Date().toLocaleTimeString();
  await loadContracts();updatePreview();
}
async function sendForSignature(){
  await saveContract();
  const c=await api(`/api/contracts/${currentId}/send`,{method:"POST",body:JSON.stringify({ownerToken})});
  await loadContracts();openContract(currentId);toast("Contract sent. Copy the private link and send it to the second person.");
}
async function copyShareLink(){
  if(!currentId){await saveContract()}
  const c=contracts.find(x=>x.id===currentId)||await api(`/api/contracts/${currentId}?ownerToken=${encodeURIComponent(ownerToken)}`);
  await navigator.clipboard.writeText(location.origin+c.shareUrl);toast("Private signing link copied.");
}
function updatePreview(c){
  c=c||{title:$("title").value,contractDate:$("contractDate").value,firstName:$("firstName").value,secondName:$("secondName").value,content:$("content").innerHTML};
  $("preview").innerHTML=renderPaper(c);
}
function renderPaper(c){
 return `<h1>${esc(c.title||"Untitled contract")}</h1><div class="contract-meta">Date: ${esc(c.contractDate||"")} · Contract ID: ${esc(c.id||"Draft")}</div><p><strong>First person:</strong> ${esc(c.firstName||"")}</p><p><strong>Second person:</strong> ${esc(c.secondName||"")}</p><div>${c.content||"<p>Your contract terms will appear here.</p>"}</div>${signatureHtml(c)}`;
}
function signatureHtml(c){
 if(!c.firstSignature&&!c.secondSignature)return "";
 return `<div class="signature-block">${sigBox(c.firstName,c.firstSignature)}${sigBox(c.secondName,c.secondSignature)}</div>`;
}
function sigBox(label,s){return `<div class="signature-box"><div>${esc(label||"First party")}</div>${s?`<img class="signature-image" src="${esc(s.signature)}"><div class="small">Signed ${fmt(s.signedAt)} by ${esc(s.name)}</div>`:"<div class='small'>Waiting for signature</div>"}</div>`}
function formatText(cmd,arg){document.execCommand(cmd,false,arg);$("content").focus();updatePreview()}
$("content").addEventListener("input",updatePreview);
function showDashboard(){$("editorView").classList.add("hidden");$("dashboardView").classList.remove("hidden");loadContracts()}
function fmt(x){return x?new Date(x).toLocaleString():""}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(t){$("toast").textContent=t;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",3000)}
loadContracts();