(() => {
  "use strict";
  const STORE_KEY = "nana-data-v1";
  const DEFAULT_ITEMS = [
    ["pañales","Pañales","🧷"],["toallitas","Toallitas húmedas","🫧"],["biberon","Biberón","🍼"],
    ["ropa","Ropa de cambio","👕"],["chupon","Chupón","🧸"],["manta","Manta","🧣"],
    ["crema","Crema","🧴"],["babero","Babero","🥣"],["juguete","Juguete","🪇"]
  ].map(([id,name,emoji])=>({id,name,emoji,photo:"",packed:false,custom:false}));
  const EMOJIS = ["🧷","🫧","🍼","👕","🧸","🧣","🧴","🥣","🪇","🐻","🧦","🧢","🧻","🧼","🧃","🥄","🧸","🩹","🌞","🧥","🧦","🪥","📚","🧺","💧","🍎","🧸","🛏️","🍼","🎒"];
  const TEMPLATES = {
    parque:{title:"Un rato en el parque",items:["pañales","toallitas","ropa","biberon","manta","juguete","crema","babero"]},
    pediatra:{title:"Visita al pediatra",items:["pañales","toallitas","ropa","biberon","crema"]},
    viaje:{title:"Viaje largo",items:["pañales","toallitas","biberon","ropa","chupon","manta","crema","babero","juguete"]},
    dia:{title:"Todo el día fuera",items:["pañales","toallitas","biberon","ropa","chupon","manta","crema","babero","juguete"]}
  };
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const uid = () => "nana-" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let data = loadData();
  let currentFilter = "todos", selectedTripId = null, currentEmoji = "🧸", pendingPhoto = null;
  let voicePreview = [], templateCurrent = null, toastTimer = null;

  function loadData(){
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return {items:DEFAULT_ITEMS.map(x=>({...x})),trips:[]};
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.trips)) throw new Error("Formato de datos inválido");
      return {items:parsed.items,trips:parsed.trips};
    } catch(err) {
      console.error("NANA: no se pudieron leer los datos guardados.",err);
      return {items:DEFAULT_ITEMS.map(x=>({...x})),trips:[],storageError:true};
    }
  }
  function saveData(){
    try {
      localStorage.setItem(STORE_KEY,JSON.stringify({items:data.items,trips:data.trips}));
      return true;
    } catch(err) {
      console.error("NANA: no se pudieron guardar los datos.",err);
      toast(err && err.name==="QuotaExceededError" ? "El almacenamiento está lleno. Elimina una foto grande e inténtalo de nuevo." : "No se pudieron guardar los cambios. Revisa el almacenamiento del navegador.");
      return false;
    }
  }
  function toast(message){
    const el=$("#toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),3300);
  }
  function navigate(view){
    $$(".view").forEach(el=>el.classList.toggle("active",el.id==="view-"+view));
    $$(".nav-link").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
    if(view==="salidas") renderTrips();
    if(view==="voz") updateVoiceTargets();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function itemById(id){return data.items.find(x=>x.id===id)}
  function getCounts(items=data.items){const packed=items.filter(x=>x.packed).length;return {packed,total:items.length,pending:items.length-packed,pct:items.length?Math.round(packed/items.length*100):0}}
  function itemVisual(item){return item.photo?`<img src="${item.photo}" alt="" loading="lazy">`:escapeHTML(item.emoji||"📦")}
  function renderHome(){
    const c=getCounts();
    $("#home-packed").textContent=c.packed;$("#home-total").textContent=`/ ${c.total} objetos`;
    $("#home-progress-label").textContent=`${c.pct}% listo`;$("#home-progress-bar").style.width=c.pct+"%";
    $("#home-progress-message").textContent=c.pct===100&&c.total?"¡Todo listo para salir!":c.packed?`Ya tienes ${c.packed} ${c.packed===1?"objeto listo":"objetos listos"}. ¡Vas muy bien!`:"Cada pequeño detalle cuenta.";
    const essentials=data.items.slice(0,6);
    $("#home-essentials").innerHTML=essentials.length?essentials.map(i=>`<div class="mini-item ${i.packed?"done":""}" title="${escapeHTML(i.name)}">${itemVisual(i)}</div>`).join(""):`<p class="muted">Añade tus primeros objetos.</p>`;
    const upcoming=[...data.trips].filter(t=>t.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
    if(upcoming){const d=parseDate(upcoming.date);const c2=getCounts(upcoming.items);$("#home-next-trip").innerHTML=`<div class="trip-date">${escapeHTML(formatDate(upcoming.date))}</div><h3>${escapeHTML(upcoming.name)}</h3><p class="muted">${c2.packed} de ${c2.total} objetos listos</p>`;}
    else $("#home-next-trip").innerHTML='<p class="muted">Todavía no hay salidas planeadas.</p>';
  }
  function renderItems(){
    const counts=getCounts();
    $("#count-all").textContent=counts.total;$("#count-pending").textContent=counts.pending;$("#count-packed").textContent=counts.packed;
    $("#bag-progress-text").textContent=`${counts.packed} de ${counts.total} empacados`;
    $("#bag-progress-bar").style.width=counts.pct+"%";
    $$(".filter").forEach(b=>b.classList.toggle("active",b.dataset.filter===currentFilter));
    const list=data.items.filter(i=>currentFilter==="todos"||(currentFilter==="empacados"?i.packed:!i.packed));
    $("#items-grid").innerHTML=list.map(i=>`<article class="item-card ${i.packed?"packed":""}" data-item-card="${escapeHTML(i.id)}">
      <button class="item-check" data-toggle-item="${escapeHTML(i.id)}" aria-label="${i.packed?"Marcar pendiente":"Marcar empacado"}">${i.packed?"✓":"✓"}</button>
      <button class="item-emoji" data-toggle-item="${escapeHTML(i.id)}" aria-label="Cambiar estado de ${escapeHTML(i.name)}">${itemVisual(i)}</button>
      <strong class="item-name">${escapeHTML(i.name)}</strong><span class="item-state">${i.packed?"✓ Empacado":"Pendiente"}</span>
      <div class="item-actions"><button class="tiny-action" data-edit-item="${escapeHTML(i.id)}">Editar</button><button class="tiny-action" data-delete-item="${escapeHTML(i.id)}">Eliminar</button></div></article>`).join("");
    $("#items-empty").classList.toggle("hidden",list.length>0);
    renderHome();
  }
  function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
  function parseDate(s){return new Date(`${s}T12:00:00`)}
  function formatDate(s){if(!s)return "Fecha por definir";return parseDate(s).toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"})}
  function shortDate(s){if(!s)return {day:"—",month:"fecha"};const d=parseDate(s);return {day:d.getDate(),month:d.toLocaleDateString("es-MX",{month:"short"})}}
  function renderTrips(){
    const trips=[...data.trips].sort((a,b)=>a.date.localeCompare(b.date));
    $("#trips-list").innerHTML=trips.length?trips.map(t=>{const d=shortDate(t.date),c=getCounts(t.items);return `<button class="trip-card ${selectedTripId===t.id?"selected":""}" data-select-trip="${escapeHTML(t.id)}"><span class="trip-date-box"><strong>${d.day}</strong><span>${escapeHTML(d.month)}</span></span><span class="trip-card-copy"><strong>${escapeHTML(t.name)}</strong><small>${escapeHTML(formatDate(t.date))} · ${c.packed}/${c.total} listos</small><span class="trip-card-progress"><span style="width:${c.pct}%"></span></span></span><span class="trip-card-arrow">↗</span></button>`}).join(""):`<div class="panel"><p class="muted">Aún no tienes salidas. Crea una y arma un checklist independiente para cada plan.</p><button class="btn btn-dark" id="empty-create-trip">＋ Crear salida</button></div>`;
    const active=data.trips.find(t=>t.id===selectedTripId);
    if(active) renderTripDetail(active); else if(!trips.length) renderEmptyDetail(); else {selectedTripId=trips[0].id;renderTrips();return;}
    renderHome();
  }
  function renderEmptyDetail(){
    $("#trip-detail").innerHTML=`<div class="detail-empty"><span class="big-symbol">↗</span><h3>Tu próxima aventura empieza aquí</h3><p>Selecciona una salida o crea una nueva para organizar lo que necesitas.</p><button class="btn btn-dark" id="detail-create">Crear una salida</button></div>`;
  }
  function renderTripDetail(t){
    const c=getCounts(t.items);
    $("#trip-detail").innerHTML=`<div class="detail-title-row"><div><span class="eyebrow">${escapeHTML(formatDate(t.date))}</span><h2>${escapeHTML(t.name)}</h2><span class="pill">${c.packed===c.total&&c.total?"Todo listo":`${c.pending} ${c.pending===1?"objeto pendiente":"objetos pendientes"}`}</span></div><div class="detail-actions"><button class="icon-action" data-edit-trip="${escapeHTML(t.id)}">Editar</button><button class="icon-action" data-share-trip="${escapeHTML(t.id)}">Compartir ↗</button><button class="icon-action" data-delete-trip="${escapeHTML(t.id)}" aria-label="Eliminar salida">×</button></div></div>
    ${t.notes?`<div class="trip-notes">${escapeHTML(t.notes)}</div>`:""}
    <div class="detail-progress"><div class="progress-label"><span>Preparación</span><strong>${c.pct}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${c.pct}%"></div></div></div>
    <div class="panel-top"><span>Tu checklist</span><button class="text-button" data-add-trip-item="${escapeHTML(t.id)}">＋ Agregar objeto</button></div>
    <div class="detail-list">${t.items.length?t.items.map(i=>`<label class="detail-item ${i.packed?"checked":""}"><input type="checkbox" data-trip-toggle="${escapeHTML(t.id)}" data-trip-item="${escapeHTML(i.id)}" ${i.packed?"checked":""}><span class="detail-emoji">${itemVisual(i)}</span><span>${escapeHTML(i.name)}</span>${i.quantity&&i.quantity>1?`<small>×${i.quantity}</small>`:""}</label>`).join(""):`<p class="muted">Esta salida no tiene objetos todavía. Añade los que vas a necesitar.</p>`}</div>
    <div class="detail-footer"><span class="muted">${c.packed} empacados · ${c.pending} pendientes</span><button class="btn btn-light btn-small" data-share-trip="${escapeHTML(t.id)}">Compartir lista ↗</button></div>`;
  }
  function openItemDialog(id=null){
    const form=$("#item-form");form.reset();$("#item-id").value=id||"";pendingPhoto=null;$("#photo-preview").innerHTML="";
    const item=id?itemById(id):null;$("#item-dialog-title").textContent=item?"Editar objeto":"Agregar objeto";
    $("#item-name").value=item?.name||"";currentEmoji=item?.emoji||"🧸";$("#item-emoji").value=currentEmoji;
    if(item?.photo){pendingPhoto=item.photo;$("#photo-preview").innerHTML=`<img src="${item.photo}" alt="Vista previa de la fotografía guardada">`;}
    renderEmojiPicker();$("#item-dialog").showModal();
  }
  function renderEmojiPicker(){
    $("#emoji-picker").innerHTML=EMOJIS.map((e,i)=>`<button type="button" class="emoji-choice ${e===currentEmoji?"selected":""}" data-emoji="${escapeHTML(e)}" aria-label="Elegir ${escapeHTML(e)}">${e}</button>`).join("");
  }
  function compressImage(file){
    return new Promise((resolve,reject)=>{
      if(!file.type.startsWith("image/"))return reject(new Error("El archivo debe ser una imagen."));
      if(file.size>12*1024*1024)return reject(new Error("La imagen original supera 12 MB. Elige una más pequeña."));
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error("No se pudo leer la fotografía."));
      reader.onload=()=>{const img=new Image();img.onerror=()=>reject(new Error("No se pudo abrir la imagen."));
        img.onload=()=>{const max=700,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement("canvas");canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
          let result=canvas.toDataURL("image/jpeg",.72);
          if(result.length>480000)result=canvas.toDataURL("image/jpeg",.52);
          if(result.length>480000)return reject(new Error("La foto sigue siendo demasiado grande. Elige una imagen más pequeña."));
          resolve(result);
        };img.src=reader.result;};
      reader.readAsDataURL(file);
    });
  }
  async function saveItemFromForm(e){
    e.preventDefault();const id=$("#item-id").value,name=$("#item-name").value.trim();if(!name)return;
    const old=id?itemById(id):null;const file=$("#item-photo").files[0];
    let photo=pendingPhoto||"";
    if(file){try{photo=await compressImage(file)}catch(err){toast(err.message);return}}
    const item={id:id||uid(),name,emoji:currentEmoji,photo,packed:old?.packed||false,custom:true};
    if(old){data.items=data.items.map(x=>x.id===id?item:x);data.trips.forEach(t=>t.items.forEach((x,index)=>{if(x.id===id){t.items[index]={...x,name,emoji:currentEmoji,photo}}}));}
    else data.items.push(item);
    if(saveData()){ $("#item-dialog").close();renderAll();renderTrips();toast(old?"Objeto actualizado.":"Objeto agregado.");}
  }
  function deleteItem(id){
    const item=itemById(id);if(!item)return;
    if(!confirm(`¿Eliminar “${item.name}” de tu pañalera? También se quitará de las listas de salidas.`))return;
    data.items=data.items.filter(x=>x.id!==id);data.trips.forEach(t=>t.items=t.items.filter(x=>x.id!==id));
    if(saveData()){renderAll();renderTrips();toast("Objeto eliminado.");}
  }
  function openTripDialog(id=null){
    const t=id?data.trips.find(x=>x.id===id):null;$("#trip-form").reset();$("#trip-id").value=id||"";
    $("#trip-dialog-title").textContent=t?"Editar salida":"Crear una salida";$("#trip-name").value=t?.name||"";
    $("#trip-date").value=t?.date||today();$("#trip-notes").value=t?.notes||"";
    renderTripChoices(t?.items.map(x=>x.id)||data.items.map(x=>x.id));$("#trip-dialog").showModal();
  }
  function renderTripChoices(selected){
    $("#trip-item-choices").innerHTML=data.items.length?data.items.map(i=>`<label class="choice-row"><input type="checkbox" value="${escapeHTML(i.id)}" ${selected.includes(i.id)?"checked":""}><span class="choice-emoji">${itemVisual(i)}</span><span>${escapeHTML(i.name)}</span></label>`).join(""):'<p class="muted">Todavía no hay objetos. Usa “Crear objeto nuevo”.</p>';
  }
  function saveTripFromForm(e){
    e.preventDefault();const id=$("#trip-id").value,name=$("#trip-name").value.trim(),date=$("#trip-date").value,notes=$("#trip-notes").value.trim();
    const chosen=$$("#trip-item-choices input:checked").map(x=>x.value);
    const old=id?data.trips.find(x=>x.id===id):null;
    const items=chosen.map(itemId=>{const prior=old?.items.find(x=>x.id===itemId);const base=itemById(itemId);return base?{...base,packed:prior?.packed||false}:null}).filter(Boolean);
    const trip={id:id||uid(),name,date,notes,items,createdAt:old?.createdAt||Date.now()};
    if(old)data.trips=data.trips.map(x=>x.id===id?trip:x);else data.trips.push(trip);
    if(saveData()){$("#trip-dialog").close();selectedTripId=trip.id;renderTrips();toast(old?"Salida actualizada.":"Salida creada.");}
  }
  function deleteTrip(id){
    const t=data.trips.find(x=>x.id===id);if(!t)return;
    if(!confirm(`¿Eliminar la salida “${t.name}” y su checklist?`))return;
    data.trips=data.trips.filter(x=>x.id!==id);if(selectedTripId===id)selectedTripId=null;
    if(saveData()){renderTrips();renderHome();toast("Salida eliminada.");}
  }
  function addItemToTrip(tripId,itemId,quantity=1){
    const t=data.trips.find(x=>x.id===tripId),base=itemById(itemId);if(!t||!base)return false;
    if(t.items.some(x=>x.id===itemId)){toast(`${base.name} ya está en esta salida.`);return false;}
    t.items.push({...base,packed:false,quantity:quantity>1?quantity:1});return true;
  }
  function buildShareText(t){
    const c=getCounts(t.items),packed=t.items.filter(x=>x.packed),pending=t.items.filter(x=>!x.packed);
    return `NANA · ${t.name}\nFecha: ${formatDate(t.date)}\nPreparación: ${c.pct}% (${c.packed}/${c.total})\n\nEMPACADOS\n${packed.length?packed.map(x=>`✓ ${x.name}${x.quantity>1?` ×${x.quantity}`:""}`).join("\n"):"Ninguno"}\n\nPENDIENTES\n${pending.length?pending.map(x=>`○ ${x.name}${x.quantity>1?` ×${x.quantity}`:""}`).join("\n"):"Ninguno"}${t.notes?`\n\nNotas: ${t.notes}`:""}`;
  }
  async function shareText(text){
    if(navigator.share){try{await navigator.share({title:"Lista NANA",text});return}catch(err){if(err.name==="AbortError")return;}}
    try{await navigator.clipboard.writeText(text);toast("Lista copiada al portapapeles.");}
    catch(err){window.prompt("Copia tu lista:",text);}
  }
  function updateVoiceTargets(){
    const select=$("#voice-target"),old=select.value;
    select.innerHTML='<option value="general">Mi pañalera</option>'+[...data.trips].sort((a,b)=>a.date.localeCompare(b.date)).map(t=>`<option value="${escapeHTML(t.id)}">${escapeHTML(t.name)} · ${escapeHTML(formatDate(t.date))}</option>`).join("");
    if([...select.options].some(o=>o.value===old))select.value=old;
  }
  const SYNONYMS=[
    {id:"pañales",words:["pañal","pañales"],quantity:true},
    {id:"toallitas",words:["toallita","toallitas","toallitas húmedas","toallitas humedas"]},
    {id:"biberon",words:["biberón","biberon","mamila","mamila"]},
    {id:"ropa",words:["muda","mudas","ropa de cambio","cambio de ropa","ropita","body","bodys"] ,quantity:true},
    {id:"chupon",words:["chupón","chupon","chupete"]},
    {id:"manta",words:["manta","mantita","cobija","muselina"]},
    {id:"crema",words:["crema","pomada","pomada para rozaduras"]},
    {id:"babero",words:["babero","baberos"] ,quantity:true},
    {id:"juguete",words:["juguete","juguetes","osito","peluche"]},
    {id:null, name:"Gel antibacterial",emoji:"🧴",words:["gel antibacterial","gel desinfectante"]},
    {id:null, name:"Agua",emoji:"💧",words:["agua","botella de agua"]},
    {id:null, name:"Snacks",emoji:"🍎",words:["snack","snacks","colación","colacion","fruta"]},
    {id:null, name:"Cambiador",emoji:"🧺",words:["cambiador","tapete cambiador"]},
    {id:null, name:"Bolsas para ropa sucia",emoji:"🛍️",words:["bolsa para ropa sucia","bolsas para ropa sucia","bolsa sucia"]},
    {id:null, name:"Documentos del bebé",emoji:"📄",words:["cartilla","documentos","cartilla de vacunación","cartilla de vacunacion"]},
    {id:null, name:"Protector solar",emoji:"☀️",words:["protector solar","bloqueador"]},
    {id:null, name:"Medicamentos indicados",emoji:"🩹",words:["medicamento","medicamentos","medicina"]},
    {id:null, name:"Pañuelo",emoji:"🧻",words:["pañuelo","pañuelos","kleenex"]}
  ];
  const NUMBERS={"un":1,"una":1,"uno":1,"dos":2,"tres":3,"cuatro":4,"cinco":5,"seis":6,"siete":7,"ocho":8,"nueve":9,"diez":10};
  function quantityBefore(text,position){
    const before=text.slice(Math.max(0,position-24),position).toLowerCase().trim();
    const m=before.match(/(?:^|\s)(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:de\s+)?$/);
    if(!m)return 1;return Number(m[1])||NUMBERS[m[1]]||1;
  }
  function analyzeText(raw){
    const text=raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const found=new Map();
    SYNONYMS.forEach(s=>{
      const words=s.words.map(w=>w.normalize("NFD").replace(/[\u0300-\u036f]/g,"")).sort((a,b)=>b.length-a.length);
      for(const word of words){
        const escaped=word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
        const re=new RegExp(`\\b${escaped}\\b`,"g");let match;
        while((match=re.exec(text))){
          const base=s.id?itemById(s.id):null;
          const key=s.id||s.name;
          const qty=s.quantity?quantityBefore(text,match.index):1;
          if(!found.has(key))found.set(key,{key,id:base?.id||null,name:base?.name||s.name,emoji:base?.emoji||s.emoji||"📦",quantity:qty});
          else found.get(key).quantity=Math.max(found.get(key).quantity,qty);
        }
      }
    });
    // Match user-created objects by their exact names as well.
    data.items.filter(x=>x.custom).forEach(i=>{
      const name=i.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      if(name.length>1&&text.includes(name)&&!found.has(i.id))found.set(i.id,{key:i.id,id:i.id,name:i.name,emoji:i.emoji,quantity:1});
    });
    return [...found.values()];
  }
  function renderVoicePreview(){
    $("#preview-count").textContent=`${voicePreview.length} ${voicePreview.length===1?"objeto":"objetos"}`;
    $("#voice-preview").innerHTML=voicePreview.length?voicePreview.map((x,i)=>`<div class="preview-row"><span class="preview-emoji">${escapeHTML(x.emoji)}</span><strong>${escapeHTML(x.name)}</strong><input type="number" min="1" max="99" value="${x.quantity||1}" data-preview-qty="${i}" aria-label="Cantidad de ${escapeHTML(x.name)}"><button class="remove-preview" data-remove-preview="${i}" aria-label="Quitar ${escapeHTML(x.name)}">×</button></div>`).join(""):'<p class="muted">No he identificado objetos todavía. Prueba con nombres como pañales, biberón o manta.</p>';
    $("#confirm-voice").disabled=!voicePreview.length;
  }
  function confirmVoiceItems(){
    if(!voicePreview.length)return;const target=$("#voice-target").value;let added=0;
    for(const p of voicePreview){
      let base=p.id?itemById(p.id):data.items.find(i=>i.name.toLowerCase()===p.name.toLowerCase());
      if(!base){base={id:uid(),name:p.name,emoji:p.emoji,photo:"",packed:false,custom:true};data.items.push(base);}
      if(target==="general"){
        // General checklist is a set of objects; quantity is retained as metadata when useful.
        if(!base.packed)base.packed=false;
        base.quantity=p.quantity>1?p.quantity:undefined;
        added++;
      } else if(addItemToTrip(target,base.id,p.quantity))added++;
    }
    if(saveData()){renderAll();renderTrips();updateVoiceTargets();voicePreview=[];renderVoicePreview();$("#voice-input").value="";toast(`${added} objeto(s) añadidos.`);}
  }
  function localAnswer(question){
    const q=question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    let key="dia";
    if(/pediatr|doctor|medic|consulta/.test(q))key="pediatra";
    else if(/parque|jugar|exterior/.test(q))key="parque";
    else if(/viaje|carretera|largo|avion|avión/.test(q))key="viaje";
    else if(/dia fuera|todo el dia|todo el día|horas|duracion|duración/.test(q))key="dia";
    else if(/organizar|ordenar|acomodar/.test(q))return {text:"Una idea práctica: agrupa los objetos por uso. Deja pañales, toallitas y cambiador juntos; la muda en una bolsa aparte; y biberón y babero en un módulo fácil de limpiar. Ajusta todo a la edad y rutina de tu bebé.",key:null};
    else if(/edad|meses|bebe|bebé/.test(q))return {text:"Depende de la edad, alimentación, clima y duración de la salida. Lleva lo que tu bebé usa habitualmente y consulta con su pediatra antes de añadir medicamentos o productos especiales. ¿A dónde van y por cuánto tiempo?",key:null};
    else if(!/llevo|llevar|necesito|preparo|preparar|lista|que|qué|salida/.test(q))return {text:"Puedo ayudarte con listas para el parque, el pediatra, un viaje o un día fuera de casa. ¿Cuál es tu plan?",key:null};
    const t=TEMPLATES[key],suggestions=t.items.map(id=>itemById(id)).filter(Boolean);
    return {text:`Para ${t.title.toLowerCase()}, puedes considerar estos esenciales. Adáptalos a la edad, duración y necesidades de tu bebé. ¿Quieres añadir algunos a tu lista?`,key,items:suggestions.map(i=>({id:i.id,name:i.name,emoji:i.emoji}))};
  }
  function addChatMessage(text,who="bot",suggestion=null){
    const el=document.createElement("div");el.className=`message ${who==="user"?"user-message":"bot-message"}`;el.textContent=text;
    if(suggestion?.items?.length){
      const chips=document.createElement("div");chips.className="suggestion-items";
      suggestion.items.slice(0,8).forEach(i=>{const span=document.createElement("span");span.textContent=`${i.emoji} ${i.name}`;chips.appendChild(span)});el.appendChild(chips);
      const button=document.createElement("button");button.className="message-action";button.textContent="Elegir objetos para añadir";button.addEventListener("click",()=>openTemplateDialog(suggestion.key));el.appendChild(button);
    }
    $("#chat-messages").appendChild(el);$("#chat-messages").scrollTop=$("#chat-messages").scrollHeight;
  }
  function sendChat(question){
    const q=question.trim();if(!q)return;addChatMessage(q,"user");$("#chat-input").value="";
    const answer=localAnswer(q);addChatMessage(answer.text,"bot",answer.key?{key:answer.key,items:answer.items}:null);
  }
  function openTemplateDialog(key){
    const t=TEMPLATES[key];if(!t)return;templateCurrent=key;$("#template-dialog-title").textContent=t.title;
    $("#template-dialog-items").innerHTML=t.items.map(id=>itemById(id)).filter(Boolean).map(i=>`<label class="template-check"><input type="checkbox" value="${escapeHTML(i.id)}" checked><span class="template-emoji">${itemVisual(i)}</span><span>${escapeHTML(i.name)}</span></label>`).join("");
    $("#template-dialog").showModal();
  }
  function addTemplateSelected(){
    if(!templateCurrent)return;const ids=$$("#template-dialog-items input:checked").map(x=>x.value);
    const tripId=$("#voice-target").value;
    let added=0;
    if(tripId!=="general"&&data.trips.some(t=>t.id===tripId)){ids.forEach(id=>{if(addItemToTrip(tripId,id))added++});}
    else ids.forEach(id=>{if(itemById(id))added++});
    if(saveData()){$("#template-dialog").close();renderAll();renderTrips();toast(tripId==="general"?`${added} sugerencias seleccionadas. Tu lista general ya contiene estos objetos.`:`${added} objeto(s) añadidos a la salida.`);}
  }
  function renderAll(){renderItems();renderTrips();updateVoiceTargets()}
  // Navigation and common delegated controls.
  $$(".nav-link").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  $$("[data-go]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.go)));
  $$(".filter").forEach(b=>b.addEventListener("click",()=>{currentFilter=b.dataset.filter;renderItems()}));
  $("#items-grid").addEventListener("click",e=>{
    const toggle=e.target.closest("[data-toggle-item]");if(toggle){const i=itemById(toggle.dataset.toggleItem);if(i){i.packed=!i.packed;if(saveData())renderItems()}return}
    const edit=e.target.closest("[data-edit-item]");if(edit){openItemDialog(edit.dataset.editItem);return}
    const del=e.target.closest("[data-delete-item]");if(del)deleteItem(del.dataset.deleteItem);
  });
  $("#add-item-open").addEventListener("click",()=>openItemDialog());
  $("#item-form").addEventListener("submit",saveItemFromForm);
  $("#item-photo").addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;compressImage(f).then(src=>{pendingPhoto=src;$("#photo-preview").innerHTML=`<img src="${src}" alt="Vista previa de la fotografía">`;}).catch(err=>{e.target.value="";toast(err.message)})});
  $("#emoji-picker").addEventListener("click",e=>{const b=e.target.closest("[data-emoji]");if(!b)return;currentEmoji=b.dataset.emoji;$("#item-emoji").value=currentEmoji;renderEmojiPicker()});
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).close()));
  $("#add-trip-open").addEventListener("click",()=>openTripDialog());
  $("#detail-create").addEventListener("click",()=>openTripDialog());
  $("#trips-list").addEventListener("click",e=>{if(e.target.closest("#empty-create-trip")){openTripDialog();return}const b=e.target.closest("[data-select-trip]");if(b){selectedTripId=b.dataset.selectTrip;renderTrips()}});
  $("#trip-form").addEventListener("submit",saveTripFromForm);
  $("#trip-add-custom").addEventListener("click",()=>{const name=prompt("¿Cómo se llama el nuevo objeto?");if(!name?.trim())return;const obj={id:uid(),name:name.trim().slice(0,60),emoji:"🧸",photo:"",packed:false,custom:true};data.items.push(obj);renderTripChoices([...$$("#trip-item-choices input:checked").map(x=>x.value),obj.id]);saveData();});
  $("#trip-detail").addEventListener("click",e=>{
    const edit=e.target.closest("[data-edit-trip]");if(edit){openTripDialog(edit.dataset.editTrip);return}
    const del=e.target.closest("[data-delete-trip]");if(del){deleteTrip(del.dataset.deleteTrip);return}
    const share=e.target.closest("[data-share-trip]");if(share){const t=data.trips.find(x=>x.id===share.dataset.shareTrip);if(t)shareText(buildShareText(t));return}
    const add=e.target.closest("[data-add-trip-item]");if(add){const t=data.trips.find(x=>x.id===add.dataset.addTripItem);if(!t)return;const available=data.items.filter(i=>!t.items.some(x=>x.id===i.id));if(!available.length){toast("Todos tus objetos ya están en esta salida.");return}const choice=prompt("Escribe el nombre del objeto que quieres añadir:\n"+available.map(i=>i.name).join(", "));if(!choice)return;const match=available.find(i=>i.name.toLowerCase()===choice.trim().toLowerCase());if(!match){toast("No encontré ese objeto. Puedes crear uno desde Editar salida.");return}if(addItemToTrip(t.id,match.id)&&saveData())renderTrips();}
  });
  $("#trip-detail").addEventListener("change",e=>{const cb=e.target.closest("[data-trip-toggle]");if(!cb)return;const t=data.trips.find(x=>x.id===cb.dataset.tripToggle),i=t?.items.find(x=>x.id===cb.dataset.tripItem);if(i){i.packed=cb.checked;if(saveData())renderTrips()}});
  $("#trip-detail").addEventListener("change",e=>{const cb=e.target.closest("[data-trip-toggle]");if(cb){const t=data.trips.find(x=>x.id===cb.dataset.tripToggle),i=t?.items.find(x=>x.id===cb.dataset.tripItem);if(i)i.packed=cb.checked;}});
  $("#voice-target").addEventListener("change",()=>{});
  $("#analyze-button").addEventListener("click",()=>{voicePreview=analyzeText($("#voice-input").value);renderVoicePreview();$("#voice-status").textContent=voicePreview.length?`Identifiqué ${voicePreview.length} tipo(s) de objeto. Revisa nombres y cantidades.`:"No encontré objetos conocidos. Prueba mencionar pañales, toallitas, biberón, ropa, manta o juguete.";});
  $("#voice-preview").addEventListener("click",e=>{const b=e.target.closest("[data-remove-preview]");if(b){voicePreview.splice(Number(b.dataset.removePreview),1);renderVoicePreview()}});
  $("#voice-preview").addEventListener("change",e=>{const input=e.target.closest("[data-preview-qty]");if(input){voicePreview[Number(input.dataset.previewQty)].quantity=Math.max(1,Math.min(99,Number(input.value)||1));input.value=voicePreview[Number(input.dataset.previewQty)].quantity;}});
  $("#confirm-voice").addEventListener("click",confirmVoiceItems);
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SpeechRecognition){
    $("#mic-button").addEventListener("click",()=>{
      try{const rec=new SpeechRecognition();rec.lang="es-MX";rec.interimResults=false;rec.maxAlternatives=1;$("#voice-status").textContent="Te escucho…";rec.onresult=e=>{$("#voice-input").value=($("#voice-input").value+" "+e.results[0][0].transcript).trim();$("#voice-status").textContent="Dictado recibido. Pulsa “Analizar lista” para revisar.";};rec.onerror=e=>{$("#voice-status").textContent="No se pudo completar el dictado. Puedes escribir o usar el dictado de tu teclado.";};rec.onend=()=>{};rec.start();}catch(err){$("#voice-status").textContent="No se pudo iniciar el micrófono. Puedes escribir tu lista.";}
    });
  }else{
    $("#mic-button").addEventListener("click",()=>toast("Este navegador no admite reconocimiento de voz aquí. Puedes escribir o usar el dictado de tu teclado."));
    $("#mic-button").title="Reconocimiento de voz no disponible en este navegador";
  }
  $("#chat-form").addEventListener("submit",e=>{e.preventDefault();sendChat($("#chat-input").value)});
  $$("[data-question]").forEach(b=>b.addEventListener("click",()=>sendChat(b.dataset.question)));
  $$("[data-template]").forEach(b=>b.addEventListener("click",()=>openTemplateDialog(b.dataset.template)));
  $("#template-add-selected").addEventListener("click",addTemplateSelected);
  // Templates added to the general list already exist there; notify honestly rather than imply duplicate creation.
  if(data.storageError)toast("No pudimos leer los datos guardados. Se abrió una lista inicial; revisa el almacenamiento del navegador antes de hacer cambios.");
  renderAll();
})();