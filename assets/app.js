const SUPABASE_URL='https://amhdxwbbnbvwpyrxxjho.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_D7qzc4BKtWMynq8RqwzAqw_l8FVvXlT';
const cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const SHARED_CLUB_ID='7c807357-d90b-4ca4-9d20-f61a82ff6065';
const DEFAULT_PLAYERS=[{"name": "Noah Bürgi", "role": "Feldspieler", "position": "Stürmer", "shot": "Links"}, {"name": "Philipp Holliger", "role": "Feldspieler", "position": "Verteidiger", "shot": "Links"}, {"name": "Benjamin Ansbach", "role": "Feldspieler", "position": "Stürmer", "shot": "Rechts"}, {"name": "Samuel Wyss", "role": "Feldspieler", "position": "Verteidiger", "shot": "Links"}, {"name": "Michael Kiefer", "role": "Feldspieler", "position": "Stürmer", "shot": "Links"}, {"name": "Noël Bauer", "role": "Feldspieler", "position": "Stürmer", "shot": "Rechts"}, {"name": "Dario Neira", "role": "Feldspieler", "position": "Verteidiger", "shot": "Links"}, {"name": "Dominik Ramel", "role": "Feldspieler", "position": "Stürmer", "shot": "Links"}, {"name": "Levin Hug", "role": "Feldspieler", "position": "Verteidiger", "shot": "Rechts"}, {"name": "Jannick Gasche", "role": "Feldspieler", "position": "Stürmer", "shot": "Links"}, {"name": "Lukas Walser", "role": "Feldspieler", "position": "Verteidiger", "shot": "Links"}, {"name": "Colin Trotter", "role": "Feldspieler", "position": "Stürmer", "shot": "Rechts"}, {"name": "Julian Gysin", "role": "Feldspieler", "position": "Verteidiger", "shot": "Links"}, {"name": "Silvano Renggli", "role": "Feldspieler", "position": "Stürmer", "shot": "Links"}, {"name": "Stefano Peloso", "role": "Feldspieler", "position": "Verteidiger", "shot": "Rechts"}, {"name": "Gianluca Bruno", "role": "Feldspieler", "position": "Stürmer", "shot": "Links"}, {"name": "Pascal Sahli", "role": "Feldspieler", "position": "Verteidiger", "shot": "Links"}, {"name": "Marc Sahli", "role": "Feldspieler", "position": "Stürmer", "shot": "Rechts"}];
const EMPTY_TEAM_DATA=()=>({
 players:DEFAULT_PLAYERS.map((p,i)=>({id:'p'+(i+1),...p})),
 events:[],
 attendance:{},
 lineups:{},
 boards:{},
 absences:[],
 settings:{logo:'',teamName:'',coachName:''}
});
function normalizeTeamData(teamData){
  const normalized=teamData||EMPTY_TEAM_DATA();
  normalized.players ||= [];
  normalized.events ||= [];
  normalized.attendance ||= {};
  normalized.lineups ||= {};
  normalized.boards ||= {};
  normalized.absences ||= [];
  normalized.settings ||= {logo:'',teamName:'',coachName:''};
  for(const p of normalized.players){
    if(!('jerseyNumber' in p))p.jerseyNumber='';
    if(!('birthday' in p))p.birthday='';
  }
  for(const e of normalized.events){
    if(e.type==='training'){
      normalized.attendance[e.id] ||= {};
      for(const p of normalized.players){
        if(!(p.id in normalized.attendance[e.id]))normalized.attendance[e.id][p.id]='present';
      }
    }
  }
  return normalized;
}
let data=normalizeTeamData(JSON.parse(localStorage.getItem('hockeyCoachData_v13')||'null')||EMPTY_TEAM_DATA());
let cloudRoot={teams:{second:data,third:{players:[],events:[],attendance:{},lineups:{},boards:{},settings:{logo:'',teamName:'',coachName:''}}}};
let activeTeamKey=null;

let currentType='training',selectedId=null;
let cloudUser=null;
let cloudReady=false;
let cloudSaveTimer=null;
let cloudSaving=false;
let lastCloudUpdated='';
let cloudPollTimer=null;
const labels={
 training:{plural:'Trainings',single:'Training',icon:'🏒'},
 game:{plural:'Spiele',single:'Spiel',icon:'🥅'},
 camp:{plural:'Trainingslager',single:'Trainingslager',icon:'🏕️'}
};
const TEAM_NAMES={
  second:'SC Altstadt 2. Liga',
  third:'SC Altstadt 3. Liga'
};
const TEAM_COACHES={
  second:'Diego Schwarzenbach',
  third:'Sandro Zorzin'
};
function showTeamSelection(){
  if(cloudUser){
    refreshTeamLogos();
    document.getElementById('teamScreen').classList.remove('hidden');
  }
}
function selectTeam(teamKey){
  activeTeamKey=teamKey;
  cloudRoot.teams ||= {};

  if(!cloudRoot.teams[teamKey]){
    cloudRoot.teams[teamKey]=teamKey==='third'
      ? {players:[],events:[],attendance:{},lineups:{},boards:{},settings:{logo:'',teamName:'',coachName:''}}
      : EMPTY_TEAM_DATA();
  }

  if(teamKey==='second'){
    cloudRoot.teams[teamKey]=normalizeTeamData(cloudRoot.teams[teamKey]);
  }else{
    const third=cloudRoot.teams[teamKey];
    third.players ||= [];
    third.events ||= [];
    third.attendance ||= {};
    third.lineups ||= {};
    third.boards ||= {};
    third.absences ||= [];
    third.settings ||= {logo:'',teamName:'',coachName:''};
  }

  data=cloudRoot.teams[teamKey];
  data.absences ||= [];
  applyAllAbsences();
  localStorage.setItem('hockeyCoachActiveTeam',teamKey);
  localStorage.setItem('hockeyCoachData_v13',JSON.stringify(data));
  document.getElementById('teamScreen').classList.add('hidden');
  document.getElementById('activeTeamLabel').textContent=`${TEAM_NAMES[teamKey]} · Coach ${TEAM_COACHES[teamKey]}`;
  document.getElementById('teamSwitchBtn').style.display='inline-block';
  document.getElementById('settingsBtn').style.display='inline-block';
  selectedId=null;
  refreshTeamLogos();
  renderAll();
}

function refreshTeamLogos(){
  const secondLogo=cloudRoot.teams?.second?.settings?.logo||'';
  const thirdLogo=cloudRoot.teams?.third?.settings?.logo||'';
  const s=document.getElementById('teamLogoSecond');
  const t=document.getElementById('teamLogoThird');
  if(s){s.src=secondLogo||defaultLogoData('2');s.style.display='block';}
  if(t){t.src=thirdLogo||defaultLogoData('3');t.style.display='block';}
  if(activeTeamKey){
    const h=document.getElementById('headerTeamLogo');
    if(h){h.src=data.settings?.logo||defaultLogoData(activeTeamKey==='second'?'2':'3');}
  }
}
function defaultLogoData(label){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="22" fill="#10243f"/><text x="60" y="50" text-anchor="middle" font-size="36">🏒</text><text x="60" y="88" text-anchor="middle" font-family="Arial" font-size="28" fill="white">${label}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

function openModal(content){
  const modal=document.getElementById('appModal');
  const target=document.getElementById('modalContent');
  if(!modal||!target)return;
  target.innerHTML=content;
  modal.classList.remove('hidden');
}
function closeModal(){
  const modal=document.getElementById('appModal');
  if(modal)modal.classList.add('hidden');
}
function closeModalOnBackdrop(event){
  if(event.target?.id==='appModal')closeModal();
}


function showSettingsPanel(){
  if(!activeTeamKey){
    alert('Bitte zuerst eine Mannschaft auswählen.');
    return;
  }
  data.settings ||= {logo:'',teamName:'',coachName:''};
  const panel=document.getElementById('settingsPanel');
  const nameInput=document.getElementById('settingsTeamName');
  const coachInput=document.getElementById('settingsCoachName');
  const preview=document.getElementById('settingsLogoPreview');
  const fileInput=document.getElementById('settingsLogoFile');

  nameInput.value=data.settings.teamName||TEAM_NAMES[activeTeamKey];
  coachInput.value=data.settings.coachName||TEAM_COACHES[activeTeamKey];
  preview.src=data.settings.logo||defaultLogoData(activeTeamKey==='second'?'2':'3');
  fileInput.value='';

  fileInput.onchange=function(){
    const file=this.files?.[0];
    if(!file)return;
    if(file.size>1024*1024){
      alert('Das Logo darf maximal 1 MB gross sein.');
      this.value='';
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{preview.src=reader.result;};
    reader.readAsDataURL(file);
  };

  panel.classList.remove('hidden');
}
function hideSettingsPanel(){
  document.getElementById('settingsPanel')?.classList.add('hidden');
}
function closeSettingsOnBackdrop(event){
  if(event.target?.id==='settingsPanel')hideSettingsPanel();
}
function saveSettingsPanel(){
  if(!activeTeamKey)return;
  const name=document.getElementById('settingsTeamName').value.trim();
  const coach=document.getElementById('settingsCoachName').value.trim();
  const preview=document.getElementById('settingsLogoPreview');

  data.settings ||= {logo:'',teamName:'',coachName:''};
  data.settings.teamName=name||TEAM_NAMES[activeTeamKey];
  data.settings.coachName=coach||TEAM_COACHES[activeTeamKey];

  if(preview?.src?.startsWith('data:')){
    data.settings.logo=preview.src;
  }

  TEAM_NAMES[activeTeamKey]=data.settings.teamName;
  TEAM_COACHES[activeTeamKey]=data.settings.coachName;
  document.getElementById('activeTeamLabel').textContent=
    `${TEAM_NAMES[activeTeamKey]} · Coach ${TEAM_COACHES[activeTeamKey]}`;

  refreshTeamLogos();
  hideSettingsPanel();
  save();
}
function removeSettingsLogo(){
  if(!activeTeamKey)return;
  data.settings ||= {logo:'',teamName:'',coachName:''};
  data.settings.logo='';
  document.getElementById('settingsLogoPreview').src=
    defaultLogoData(activeTeamKey==='second'?'2':'3');
  refreshTeamLogos();
  save();
}

function openTeamSettings(){
  if(!activeTeamKey)return;
  data.settings ||= {logo:'',teamName:'',coachName:''};
  const teamName=data.settings.teamName||TEAM_NAMES[activeTeamKey];
  const coachName=data.settings.coachName||TEAM_COACHES[activeTeamKey];
  openModal(`<h2>Mannschaftseinstellungen</h2>
    <div class="stack team-settings">
      <div class="field"><label>Mannschaftsname</label><input id="settingsTeamName" value="${teamName}"></div>
      <div class="field"><label>Coach</label><input id="settingsCoachName" value="${coachName}"></div>
      <div class="logo-upload-row">
        <img id="settingsLogoPreview" class="logo-preview" src="${data.settings.logo||defaultLogoData(activeTeamKey==='second'?'2':'3')}">
        <div class="field">
          <label>Logo hochladen</label>
          <input id="settingsLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange="previewTeamLogo(this)">
          <span class="muted">Empfohlen: quadratisch, PNG oder JPG, maximal 1 MB.</span>
        </div>
      </div>
      <button class="btn primary" onclick="saveTeamSettings()">Speichern</button>
      <button class="btn danger" onclick="removeTeamLogo()">Logo entfernen</button>
    </div>`);
}
function previewTeamLogo(input){
  const file=input.files?.[0];
  if(!file)return;
  if(file.size>1024*1024){alert('Das Logo darf maximal 1 MB gross sein.');input.value='';return;}
  const reader=new FileReader();
  reader.onload=()=>{document.getElementById('settingsLogoPreview').src=reader.result;};
  reader.readAsDataURL(file);
}
function saveTeamSettings(){
  const name=document.getElementById('settingsTeamName').value.trim();
  const coach=document.getElementById('settingsCoachName').value.trim();
  const preview=document.getElementById('settingsLogoPreview');
  data.settings ||= {logo:'',teamName:'',coachName:''};
  data.settings.teamName=name||TEAM_NAMES[activeTeamKey];
  data.settings.coachName=coach||TEAM_COACHES[activeTeamKey];
  if(preview?.src?.startsWith('data:'))data.settings.logo=preview.src;
  TEAM_NAMES[activeTeamKey]=data.settings.teamName;
  TEAM_COACHES[activeTeamKey]=data.settings.coachName;
  document.getElementById('activeTeamLabel').textContent=`${TEAM_NAMES[activeTeamKey]} · Coach ${TEAM_COACHES[activeTeamKey]}`;
  closeModal();
  refreshTeamLogos();
  save();
}
function removeTeamLogo(){
  data.settings ||= {};
  data.settings.logo='';
  refreshTeamLogos();
  closeModal();
  save();
}


function save(){
  if(activeTeamKey){
    cloudRoot.teams ||= {};
    cloudRoot.teams[activeTeamKey]=data;
  }
  localStorage.setItem('hockeyCoachData_v13',JSON.stringify(data));
  renderAll();
  scheduleCloudSave();
}
function fmtDate(s){return new Intl.DateTimeFormat('de-CH',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'))}
function fmtDateLong(s){return new Intl.DateTimeFormat('de-CH',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'))}
function showTab(tab,btn){for(const id of ['events','players','stats'])document.getElementById(id+'Tab').classList.toggle('hidden',id!==tab);document.querySelectorAll('.tab').forEach(b=>b.className='btn soft tab');btn.className='btn primary tab';renderAll()}
function setType(type){currentType=type;selectedId=null;document.querySelectorAll('.type-switch button').forEach(b=>b.classList.remove('active'));document.getElementById(type==='training'?'typeTraining':type==='game'?'typeGame':'typeCamp').classList.add('active');document.getElementById('scheduleBtn').style.display=type==='training'?'inline-block':'none';document.getElementById('trainingHint').style.display=type==='training'?'block':'none';renderAll()}
function addEvent(){
 const date=newDate.value,time=newTime.value||'20:00',title=newTitle.value.trim();
 if(!date)return alert('Bitte Datum wählen.');
 const id=currentType+'_'+date+'_'+time+'_'+Date.now();
 data.events.push({id,type:currentType,date,time,title});
 data.attendance[id]={};
 if(currentType==='training'){
   for(const p of data.players) data.attendance[id][p.id]='present';
 }
 applyAbsencesToEvent(data.events.find(e=>e.id===id));selectedId=id;newTitle.value='';save()
}

function createRecurringTrainings(){
  if(currentType!=='training')return;

  const startValue=document.getElementById('seriesStart').value;
  const endValue=document.getElementById('seriesEnd').value;
  const time=document.getElementById('seriesTime').value||'20:00';
  const selectedDays=[...document.querySelectorAll('.seriesDay:checked')].map(input=>Number(input.value));

  if(!startValue||!endValue){
    alert('Bitte Saisonbeginn und Saisonende auswählen.');
    return;
  }
  if(selectedDays.length===0){
    alert('Bitte mindestens einen Trainingstag auswählen.');
    return;
  }

  const start=new Date(startValue+'T12:00:00');
  const end=new Date(endValue+'T12:00:00');

  if(end<start){
    alert('Das Saisonende muss nach dem Saisonbeginn liegen.');
    return;
  }

  let created=0;
  let skipped=0;

  for(let date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
    if(!selectedDays.includes(date.getDay()))continue;

    const dateString=[
      date.getFullYear(),
      String(date.getMonth()+1).padStart(2,'0'),
      String(date.getDate()).padStart(2,'0')
    ].join('-');

    const duplicate=data.events.some(event=>
      event.type==='training' &&
      event.date===dateString &&
      event.time===time
    );

    if(duplicate){
      skipped++;
      continue;
    }

    const id='training_'+dateString+'_'+time+'_'+crypto.randomUUID();
    data.events.push({
      id,
      type:'training',
      date:dateString,
      time,
      title:''
    });

    data.attendance[id]={};
    for(const player of data.players){
      data.attendance[id][player.id]='present';
    }
    applyAbsencesToEvent(data.events[data.events.length-1]);created++;
  }

  save();
  alert(
    `${created} Trainings wurden erstellt.`+
    (skipped?` ${skipped} bereits vorhandene Termine wurden übersprungen.`:'')
  );
}

function generateSeasonTrainings(){
 if(currentType!=='training')return;
 const start=new Date('2026-08-13T12:00:00');
 const end=new Date('2027-03-31T12:00:00');
 let created=0;

 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
   if(![1,4].includes(d.getDay()))continue;

   const ds=[
     d.getFullYear(),
     String(d.getMonth()+1).padStart(2,'0'),
     String(d.getDate()).padStart(2,'0')
   ].join('-');

   const existing=data.events.find(e=>e.type==='training'&&e.date===ds);
   if(existing){
     data.attendance[existing.id] ||= {};
     for(const p of data.players){
       if(!(p.id in data.attendance[existing.id])) data.attendance[existing.id][p.id]='present';
     }
     continue;
   }

   const time='20:00';
   const id='training_'+ds+'_'+time+'_'+Date.now()+'_'+created;
   data.events.push({id,type:'training',date:ds,time,title:''});
   data.attendance[id]={};
   for(const p of data.players) data.attendance[id][p.id]='present';
   created++;
 }

 save();
 alert(created
   ? created+' Saisontrainings wurden erstellt. Alle Spieler sind standardmässig dabei.'
   : 'Alle Saisontrainings sind bereits vorhanden.'
 );
}
function selectEvent(id){
  selectedId=id;
  renderAll();

  requestAnimationFrame(()=>{
    const card=document.getElementById('selectedCard');
    if(!card)return;

    card.classList.remove('training-selected-flash');
    void card.offsetWidth;
    card.classList.add('training-selected-flash');

    if(window.matchMedia('(max-width: 800px)').matches){
      card.scrollIntoView({behavior:'smooth',block:'start'});
    }else{
      const search=document.getElementById('attendanceSearch');
      if(search)search.focus({preventScroll:true});
    }
  });
}
function deleteEvent(id){if(!confirm('Termin wirklich löschen?'))return;data.events=data.events.filter(e=>e.id!==id);delete data.attendance[id];delete data.lineups[id];delete data.boards[id];if(selectedId===id)selectedId=null;save()}
function setStatus(pid,status){
  if(!selectedId)return;
  data.attendance[selectedId]||={};
  data.attendance[selectedId][pid]=status;
  if(status!=='present' && data.lineups?.[selectedId]) clearPlayerFromLineup(selectedId,pid);
  save()
}
function setAllAttendance(eventId,status){
  data.attendance[eventId] ||= {};
  for(const p of data.players){
    data.attendance[eventId][p.id]=status;
    if(status!=='present'&&data.lineups?.[eventId])clearPlayerFromLineup(eventId,p.id);
  }
  save();
}

function addPlayer(){
 const name=playerName.value.trim(),position=playerPosition.value,shot=playerShot.value;
 if(!name)return alert('Bitte Namen eingeben.');
 const newPlayer={
   id:'p'+Date.now(),
   name,
   role:position==='Goalie'?'Goalie':'Feldspieler',
   position,
   shot,
   jerseyNumber:playerNumber.value.trim(),
   birthday:playerBirthday.value
 };
 data.players.push(newPlayer);

 for(const e of data.events){
   if(e.type==='training'){
     data.attendance[e.id] ||= {};
     data.attendance[e.id][newPlayer.id]='present';
   }
 }

 playerName.value='';playerNumber.value='';playerBirthday.value='';save()
}
function deletePlayer(id){if(!confirm('Spieler wirklich löschen?'))return;data.players=data.players.filter(p=>p.id!==id);for(const a of Object.values(data.attendance))delete a[id];save()}
function changePosition(id,position){const p=data.players.find(x=>x.id===id);if(p){p.position=position;p.role=position==='Goalie'?'Goalie':'Feldspieler';save()}}
function changeShot(id,shot){const p=data.players.find(x=>x.id===id);if(p){p.shot=shot;save()}}
function changeNumber(id,number){const p=data.players.find(x=>x.id===id);if(p){p.jerseyNumber=number;save()}}
function changeBirthday(id,birthday){const p=data.players.find(x=>x.id===id);if(p){p.birthday=birthday;save()}}
function fmtBirthday(s){if(!s)return '–';return new Intl.DateTimeFormat('de-CH',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'))}


function filterAttendancePlayers(query){
  const normalized=(query||'').trim().toLowerCase();
  document.querySelectorAll('#attendanceList .player').forEach(row=>{
    const text=(row.dataset.search||row.textContent||'').toLowerCase();
    row.style.display=!normalized||text.includes(normalized)?'grid':'none';
  });
}
function renderEvents(){
 listTitle.textContent=labels[currentType].plural;
 const list=eventList,sorted=data.events.filter(e=>e.type===currentType).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 list.innerHTML=sorted.length?'':'<p class="muted">Noch keine Termine vorhanden.</p>';
 for(const e of sorted){const a=data.attendance[e.id]||{},present=data.players.filter(p=>a[p.id]==='present').length,absent=data.players.filter(p=>a[p.id]==='absent').length;const div=document.createElement('div');div.className='event '+(selectedId===e.id?'active':'');div.onclick=()=>selectEvent(e.id);div.innerHTML=`<div class="date">${labels[e.type].icon} ${fmtDate(e.date)} · ${e.time}</div><small>${e.title?e.title+' · ':''}${present} dabei · ${absent} nicht dabei</small><button class="btn danger" style="float:right;margin-top:-34px;padding:6px 8px" onclick="event.stopPropagation();deleteEvent('${e.id}')">Löschen</button>`;list.appendChild(div)}
}
function renderSelected(){
 const e=data.events.find(x=>x.id===selectedId);
 if(!e){selectedTitle.textContent='Termin auswählen';selectedBody.innerHTML='<span class="muted">Wähle links einen Termin aus.</span>';return}
 selectedTitle.textContent=`${labels[e.type].single}: ${fmtDate(e.date)} · ${e.time}`;
 const a=data.attendance[e.id]||{},present=data.players.filter(p=>a[p.id]==='present'),absent=data.players.filter(p=>a[p.id]==='absent'),unknown=data.players.filter(p=>!a[p.id]||a[p.id]==='unknown');
 const forwards=present.filter(p=>p.position==='Stürmer').length,defenders=present.filter(p=>p.position==='Verteidiger').length,goalies=present.filter(p=>p.position==='Goalie').length,left=present.filter(p=>p.shot==='Links').length,right=present.filter(p=>p.shot==='Rechts').length;
 selectedBody.innerHTML=`${e.title?`<p><strong>${e.title}</strong></p>`:''}
<div class="counts">
  <div class="count present"><b>${present.length}</b>Dabei</div>
  <div class="count absent"><b>${absent.length}</b>Nicht dabei</div>
  <div class="count unknown"><b>${unknown.length}</b>Offen</div>
</div>
<p><strong>${forwards} Stürmer · ${defenders} Verteidiger · ${goalies} Goalies</strong></p>
<p class="muted">${left} Linksschützen · ${right} Rechtsschützen</p>

<div class="attendance-quick">
  <div class="attendance-quick-head">
    <strong>Spieler auswählen</strong>
    <div class="muted">Klicke direkt auf den Status eines Spielers.</div>
    <input id="attendanceSearch" class="player-search" type="search" placeholder="Spieler suchen …" oninput="filterAttendancePlayers(this.value)">
    <div class="row" style="margin-top:8px">
      <button class="btn soft" onclick="setAllAttendance('${e.id}','present')">Alle dabei</button>
      <button class="btn ghost" onclick="setAllAttendance('${e.id}','open')">Alle offen</button>
      <button class="btn soft" onclick="downloadEventReport('${e.id}')">${e.type==='training'?'Trainingsrapport':e.type==='game'?'Spielrapport':'Lager-Rapport'} herunterladen</button>
    </div>
  </div>
  <div id="attendanceList" class="attendance-quick-list"></div>
</div>

<details class="collapse-section" open>
  <summary>Aufstellung – 4 Linien</summary>
  <div class="collapse-body">
    <p class="muted">Es erscheinen nur Spieler, die für diesen Termin als „dabei“ markiert sind.</p>
    <div id="playerPool" class="player-pool"></div>
    <div id="lineupBoard" class="lineup-board" style="margin-top:10px"></div>
  </div>
</details>

<details class="collapse-section">
  <summary>Coachboard</summary>
  <div class="collapse-body">
    <div class="coachboard-toolbar">
      <button class="btn soft" onclick="addBoardPlayer('${e.id}','home')">+ Eigener Spieler</button>
      <button class="btn soft" onclick="addBoardPlayer('${e.id}','away')">+ Gegner</button>
      <button class="btn soft" onclick="addBoardPuck('${e.id}')">+ Scheibe</button>
      <button class="btn soft" id="drawBtn" onclick="toggleDrawMode('${e.id}')">Zeichnen</button>
      <button class="btn ghost" onclick="clearBoardDrawings('${e.id}')">Zeichnung löschen</button>
      <button class="btn danger" onclick="resetBoard('${e.id}')">Board leeren</button>
    </div>
    <div class="coachboard-shell">
      <div id="coachboard" class="coachboard">
        <canvas id="boardCanvas" class="board-canvas"></canvas>
      </div>
      <textarea id="boardNote" class="coachboard-note" placeholder="Notizen zum System oder zur Übung" onchange="saveBoardNote('${e.id}',this.value)"></textarea>
    </div>
  </div>
</details>`;
 renderLineup(e.id);
 renderCoachboard(e.id);
 for(const p of data.players){const s=a[p.id]||'unknown',row=document.createElement('div');row.className='player';row.dataset.search=`${p.name} ${p.position||p.role} ${p.jerseyNumber||''}`;row.innerHTML=`<div><div class="name">${p.name}${absenceReason(e.id,p.id)?`<span class="absence-badge">${absenceReason(e.id,p.id)}</span>`:''}</div><div class="role">${p.position||p.role} · Schuss ${p.shot||'–'}${p.jerseyNumber?' · #'+p.jerseyNumber:''}${p.birthday?' · '+fmtBirthday(p.birthday):''}</div></div><div class="status"><button class="${s==='present'?'on-present':''}" onclick="setStatus('${p.id}','present')">✓</button><button class="${s==='absent'?'on-absent':''}" onclick="setStatus('${p.id}','absent')">✕</button><button class="${s==='unknown'?'on-unknown':''}" onclick="setStatus('${p.id}','unknown')">?</button></div>`;attendanceList.appendChild(row)}
}

function ensureAbsences(){data.absences ||= []}
function playerAbsences(playerId){ensureAbsences();return data.absences.filter(a=>a.playerId===playerId).sort((a,b)=>a.start.localeCompare(b.start))}
function openAbsenceOverview(){
  ensureAbsences();
  const items=[...data.absences].sort((a,b)=>a.start.localeCompare(b.start));
  const list=items.length?items.map(a=>{
    const p=data.players.find(x=>x.id===a.playerId);
    return `<div class="absence-item"><div><strong>${p?.name||'Unbekannt'}</strong><div class="absence-meta">${fmtDate(a.start)} bis ${fmtDate(a.end)} · ${a.reason}</div></div><button class="btn danger" onclick="deleteAbsence('${a.id}')">Löschen</button></div>`;
  }).join(''):'<div class="muted">Keine Abwesenheiten vorhanden.</div>';
  openModal(`<h2>Abwesenheitsübersicht</h2><div class="absence-list">${list}</div>`);
}
function openPlayerAbsences(playerId){
  const p=data.players.find(x=>x.id===playerId);if(!p)return;
  const items=playerAbsences(playerId);
  const list=items.length?items.map(a=>`<div class="absence-item"><div><strong>${fmtDate(a.start)} bis ${fmtDate(a.end)}</strong><div class="absence-meta">${a.reason}</div></div><button class="btn danger" onclick="deleteAbsence('${a.id}')">Löschen</button></div>`).join(''):'<div class="muted">Noch keine Abwesenheiten.</div>';
  openModal(`<h2>Abwesenheiten – ${p.name}</h2><div class="absence-panel"><div class="absence-form"><input id="absenceStart" type="date"><input id="absenceEnd" type="date"><input id="absenceReason" placeholder="Grund, z. B. Ferien"><button class="btn primary" onclick="addAbsence('${playerId}')">Hinzufügen</button></div><div class="absence-list">${list}</div></div>`);
}
function addAbsence(playerId){
  const start=document.getElementById('absenceStart').value,end=document.getElementById('absenceEnd').value,reason=document.getElementById('absenceReason').value.trim()||'Abwesend';
  if(!start||!end)return alert('Bitte Von- und Bis-Datum eingeben.');
  if(end<start)return alert('Das Bis-Datum muss nach dem Von-Datum liegen.');
  ensureAbsences();data.absences.push({id:'absence_'+crypto.randomUUID(),playerId,start,end,reason});
  applyAllAbsences();save();openPlayerAbsences(playerId);
}
function deleteAbsence(id){
  const item=(data.absences||[]).find(a=>a.id===id);
  data.absences=(data.absences||[]).filter(a=>a.id!==id);
  recalculateAttendanceFromAbsences();save();
  if(item)openPlayerAbsences(item.playerId);
}
function absenceForEvent(playerId,date){return (data.absences||[]).find(a=>a.playerId===playerId&&date>=a.start&&date<=a.end)||null}
function applyAbsencesToEvent(event){
  data.attendance[event.id] ||= {};
  for(const p of data.players){
    const a=absenceForEvent(p.id,event.date);
    if(a){data.attendance[event.id][p.id]='absent';data.attendance[event.id][p.id+'_reason']=a.reason;if(data.lineups?.[event.id])clearPlayerFromLineup(event.id,p.id)}
    else if(!(p.id in data.attendance[event.id]))data.attendance[event.id][p.id]='present';
  }
}
function applyAllAbsences(){for(const e of data.events)applyAbsencesToEvent(e)}
function recalculateAttendanceFromAbsences(){
  for(const e of data.events){data.attendance[e.id] ||= {};for(const p of data.players){const a=absenceForEvent(p.id,e.date),rk=p.id+'_reason';if(a){data.attendance[e.id][p.id]='absent';data.attendance[e.id][rk]=a.reason}else if(rk in data.attendance[e.id]){delete data.attendance[e.id][rk];data.attendance[e.id][p.id]='present'}}}
}
function absenceReason(eventId,playerId){return (data.attendance[eventId]||{})[playerId+'_reason']||''}

function renderPlayers(){
 playerAdminList.innerHTML='';
 for(const p of data.players){
   const row=document.createElement('div');
   row.className='player';
   row.innerHTML=`<div><div class="name">${p.name}</div><div class="role">${p.position||p.role} · Schuss ${p.shot||'–'}${p.jerseyNumber?' · #'+p.jerseyNumber:''}${p.birthday?' · '+fmtBirthday(p.birthday):''}</div></div>
   <div class="row">
     <select onchange="changePosition('${p.id}',this.value)">
       <option ${p.position==='Stürmer'?'selected':''}>Stürmer</option>
       <option ${p.position==='Verteidiger'?'selected':''}>Verteidiger</option>
       <option ${p.position==='Goalie'?'selected':''}>Goalie</option>
     </select>
     <select onchange="changeShot('${p.id}',this.value)">
       <option ${p.shot==='Links'?'selected':''}>Links</option>
       <option ${p.shot==='Rechts'?'selected':''}>Rechts</option>
     </select>
     <input style="width:80px" type="number" min="0" max="99" value="${p.jerseyNumber||''}" placeholder="Nr." onchange="changeNumber('${p.id}',this.value)">
     <input type="date" value="${p.birthday||''}" onchange="changeBirthday('${p.id}',this.value)">
     <button class="btn soft" onclick="openPlayerAbsences('${p.id}')">Abwesenheiten</button><button class="btn danger" onclick="deletePlayer('${p.id}')">Löschen</button>
   </div>`;
   playerAdminList.appendChild(row)
 }
}
function renderStats(){
 let html='<table class="stats-table"><thead><tr><th>Spieler</th><th>Nr.</th><th>Geburtstag</th><th>Position</th><th>Schuss</th><th>Dabei</th><th>Nicht dabei</th><th>Quote</th></tr></thead><tbody>';
 for(const p of data.players){
   let yes=0,no=0;
   for(const e of data.events){
     const s=(data.attendance[e.id]||{})[p.id];
     if(s==='present')yes++;
     if(s==='absent')no++
   }
   const total=yes+no,rate=total?Math.round(yes/total*100):0;
   html+=`<tr><td>${p.name}</td><td>${p.jerseyNumber||'–'}</td><td>${fmtBirthday(p.birthday)}</td><td>${p.position||p.role}</td><td>${p.shot||'–'}</td><td>${yes}</td><td>${no}</td><td>${rate}%</td></tr>`
 }
 html+='</tbody></table>';
 stats.innerHTML=html
}
const LINE_POSITIONS=[
  {key:'LD',label:'Verteidiger links'},
  {key:'RD',label:'Verteidiger rechts'},
  {key:'LW',label:'Stürmer links'},
  {key:'C',label:'Center'},
  {key:'RW',label:'Stürmer rechts'}
];
const GOALIE_POSITIONS=[
  {key:'G1',label:'Goalie 1'},
  {key:'G2',label:'Goalie 2'}
];
function ensureLineup(eventId){
  data.lineups[eventId] ||= {};
  data.lineups[eventId].goalies ||= {G1:null,G2:null};
  for(const g of GOALIE_POSITIONS) if(!(g.key in data.lineups[eventId].goalies)) data.lineups[eventId].goalies[g.key]=null;
  for(let line=1;line<=4;line++){
    data.lineups[eventId][line] ||= {};
    for(const pos of LINE_POSITIONS) if(!(pos.key in data.lineups[eventId][line])) data.lineups[eventId][line][pos.key]=null;
  }
}
function makeSlot(eventId,line,posKey,label,pid,isGoalie=false){
  const slot=document.createElement('div');
  slot.className='slot';
  const player=data.players.find(p=>p.id===pid);
  slot.innerHTML=`<div class="slot-label">${label}</div>${player?`<div class="assigned">${player.name}</div><button class="remove" onclick="removeFromLineup('${eventId}','${line}','${posKey}',${isGoalie})">Entfernen</button>`:'<div class="muted">Spieler hierher ziehen</div>'}`;
  slot.addEventListener('dragover',ev=>{ev.preventDefault();slot.classList.add('dragover')});
  slot.addEventListener('dragleave',()=>slot.classList.remove('dragover'));
  slot.addEventListener('drop',ev=>{
    ev.preventDefault();slot.classList.remove('dragover');
    const draggedPid=ev.dataTransfer.getData('text/plain');
    assignToLineup(eventId,line,posKey,draggedPid,isGoalie);
  });
  return slot;
}
function renderLineup(eventId){
  ensureLineup(eventId);
  const lineup=data.lineups[eventId];
  const used=new Set();
  for(const g of GOALIE_POSITIONS){const pid=lineup.goalies[g.key];if(pid)used.add(pid)}
  for(let line=1;line<=4;line++) for(const pos of LINE_POSITIONS){const pid=lineup[line][pos.key];if(pid)used.add(pid)}

  const pool=document.getElementById('playerPool');
  const board=document.getElementById('lineupBoard');
  if(!pool||!board)return;

  pool.innerHTML='';
  const attendance=data.attendance[eventId]||{};
  const eligiblePlayers=data.players.filter(p=>attendance[p.id]==='present');

  if(!eligiblePlayers.length){
    pool.innerHTML='<div class="muted">Noch keine Spieler als „dabei“ markiert.</div>';
  }

  for(const p of eligiblePlayers){
    const item=document.createElement('div');
    item.className='drag-player'+(used.has(p.id)?' used':'');
    item.textContent=p.name;
    item.draggable=!used.has(p.id);
    item.dataset.playerId=p.id;
    item.addEventListener('dragstart',ev=>{
      if(used.has(p.id)){ev.preventDefault();return}
      ev.dataTransfer.setData('text/plain',p.id)
    });
    pool.appendChild(item);
  }

  board.innerHTML='';
  const rink=document.createElement('div');
  rink.className='lineup-rink';

  const goalies=document.createElement('div');
  goalies.className='goalies-zone';
  for(const g of GOALIE_POSITIONS){
    const card=document.createElement('div');
    card.className='goalie-card';
    card.innerHTML=`<h3>${g.label}</h3>`;
    card.appendChild(makeSlot(eventId,'goalies',g.key,g.label,lineup.goalies[g.key],true));
    goalies.appendChild(card);
  }
  rink.appendChild(goalies);

  for(let line=1;line<=4;line++){
    const row=document.createElement('div');
    row.className='line-row';
    row.innerHTML=`<h3>${line}. Linie</h3>`;

    const defense=document.createElement('div');
    defense.className='defense-row';
    defense.appendChild(makeSlot(eventId,line,'LD','Verteidiger links',lineup[line].LD));
    defense.appendChild(makeSlot(eventId,line,'RD','Verteidiger rechts',lineup[line].RD));

    const forwards=document.createElement('div');
    forwards.className='forward-row';
    forwards.appendChild(makeSlot(eventId,line,'LW','Stürmer links',lineup[line].LW));
    forwards.appendChild(makeSlot(eventId,line,'C','Center',lineup[line].C));
    forwards.appendChild(makeSlot(eventId,line,'RW','Stürmer rechts',lineup[line].RW));

    row.appendChild(defense);
    row.appendChild(forwards);
    rink.appendChild(row);
  }
  board.appendChild(rink);
}
function clearPlayerFromLineup(eventId,pid){
  ensureLineup(eventId);
  for(const g of GOALIE_POSITIONS) if(data.lineups[eventId].goalies[g.key]===pid) data.lineups[eventId].goalies[g.key]=null;
  for(let l=1;l<=4;l++) for(const p of LINE_POSITIONS) if(data.lineups[eventId][l][p.key]===pid) data.lineups[eventId][l][p.key]=null;
}
function assignToLineup(eventId,line,pos,pid,isGoalie=false){
  ensureLineup(eventId);
  clearPlayerFromLineup(eventId,pid);
  if(isGoalie) data.lineups[eventId].goalies[pos]=pid;
  else data.lineups[eventId][line][pos]=pid;
  save();
}
function removeFromLineup(eventId,line,pos,isGoalie=false){
  ensureLineup(eventId);
  if(isGoalie) data.lineups[eventId].goalies[pos]=null;
  else data.lineups[eventId][line][pos]=null;
  save();
}
function lineupReport(eventId){
  ensureLineup(eventId);
  const pname=pid=>{const p=data.players.find(x=>x.id===pid);return p?p.name:'–'};
  let out='<h3>Goalies</h3><table><tr><th>Goalie 1</th><th>Goalie 2</th></tr>';
  out+=`<tr><td>${pname(data.lineups[eventId].goalies.G1)}</td><td>${pname(data.lineups[eventId].goalies.G2)}</td></tr></table>`;
  out+='<h3>Aufstellung</h3><table><tr><th>Linie</th><th>LV</th><th>RV</th><th>LF</th><th>C</th><th>RF</th></tr>';
  for(let line=1;line<=4;line++){
    const name=key=>pname(data.lineups[eventId][line][key]);
    out+=`<tr><td>${line}</td><td>${name('LD')}</td><td>${name('RD')}</td><td>${name('LW')}</td><td>${name('C')}</td><td>${name('RW')}</td></tr>`;
  }
  return out+'</table>';
}


let boardDrawMode=false;
let boardDrawing=false;
let boardLast=null;

function ensureBoard(eventId){
  data.boards[eventId] ||= {items:[],drawing:'',note:''};
  if(!Array.isArray(data.boards[eventId].items)) data.boards[eventId].items=[];
  if(typeof data.boards[eventId].drawing!=='string') data.boards[eventId].drawing='';
  if(typeof data.boards[eventId].note!=='string') data.boards[eventId].note='';
}
function addBoardPlayer(eventId,team){
  ensureBoard(eventId);
  const count=data.boards[eventId].items.filter(x=>x.type==='player'&&x.team===team).length+1;
  data.boards[eventId].items.push({id:'bp'+Date.now()+Math.random(),type:'player',team,label:String(count),x:team==='home'?25:70,y:50});
  save()
}
function addBoardPuck(eventId){
  ensureBoard(eventId);
  data.boards[eventId].items.push({id:'puck'+Date.now(),type:'puck',x:50,y:50});
  save()
}
function removeBoardItem(eventId,itemId){
  ensureBoard(eventId);
  data.boards[eventId].items=data.boards[eventId].items.filter(x=>x.id!==itemId);
  save()
}
function renderCoachboard(eventId){
  ensureBoard(eventId);
  const board=document.getElementById('coachboard');
  const canvas=document.getElementById('boardCanvas');
  const note=document.getElementById('boardNote');
  if(!board||!canvas||!note)return;

  board.querySelectorAll('.board-player,.board-puck').forEach(x=>x.remove());
  note.value=data.boards[eventId].note||'';

  for(const item of data.boards[eventId].items){
    const el=document.createElement('div');
    el.dataset.itemId=item.id;
    if(item.type==='player'){
      el.className='board-player '+item.team;
      el.textContent=item.label||'';
      el.title='Doppelklick zum Löschen';
    }else{
      el.className='board-puck';
      el.title='Doppelklick zum Löschen';
    }
    el.style.left=`calc(${item.x}% - ${item.type==='player'?21:9}px)`;
    el.style.top=`calc(${item.y}% - ${item.type==='player'?21:9}px)`;
    el.addEventListener('dblclick',()=>removeBoardItem(eventId,item.id));
    makeBoardItemDraggable(eventId,item,el,board);
    board.appendChild(el);
  }
  setupCanvas(eventId,board,canvas);
}
function makeBoardItemDraggable(eventId,item,el,board){
  let dragging=false;
  const move=ev=>{
    if(!dragging)return;
    const rect=board.getBoundingClientRect();
    const clientX=ev.touches?ev.touches[0].clientX:ev.clientX;
    const clientY=ev.touches?ev.touches[0].clientY:ev.clientY;
    item.x=Math.max(0,Math.min(100,(clientX-rect.left)/rect.width*100));
    item.y=Math.max(0,Math.min(100,(clientY-rect.top)/rect.height*100));
    el.style.left=`calc(${item.x}% - ${item.type==='player'?21:9}px)`;
    el.style.top=`calc(${item.y}% - ${item.type==='player'?21:9}px)`;
  };
  const stop=()=>{if(dragging){dragging=false;document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',stop);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',stop);save()}};
  el.addEventListener('mousedown',ev=>{if(boardDrawMode)return;dragging=true;ev.preventDefault();document.addEventListener('mousemove',move);document.addEventListener('mouseup',stop)});
  el.addEventListener('touchstart',ev=>{if(boardDrawMode)return;dragging=true;document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',stop)},{passive:true});
}
function setupCanvas(eventId,board,canvas){
  const rect=board.getBoundingClientRect();
  canvas.width=Math.max(1,Math.round(rect.width));
  canvas.height=Math.max(1,Math.round(rect.height));
  const ctx=canvas.getContext('2d');
  if(data.boards[eventId].drawing){
    const img=new Image();
    img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);
    img.src=data.boards[eventId].drawing;
  }
  canvas.classList.toggle('draw-mode',boardDrawMode);
  canvas.onpointerdown=ev=>{
    if(!boardDrawMode)return;
    boardDrawing=true;
    boardLast={x:ev.offsetX,y:ev.offsetY};
  };
  canvas.onpointermove=ev=>{
    if(!boardDrawMode||!boardDrawing)return;
    ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#10243f';
    ctx.beginPath();ctx.moveTo(boardLast.x,boardLast.y);ctx.lineTo(ev.offsetX,ev.offsetY);ctx.stroke();
    boardLast={x:ev.offsetX,y:ev.offsetY};
  };
  canvas.onpointerup=()=>{
    if(!boardDrawing)return;
    boardDrawing=false;
    data.boards[eventId].drawing=canvas.toDataURL('image/png');
    localStorage.setItem('hockeyCoachData_v13',JSON.stringify(data));
  };
  canvas.onpointerleave=canvas.onpointerup;
}
function toggleDrawMode(eventId){
  boardDrawMode=!boardDrawMode;
  const btn=document.getElementById('drawBtn');
  if(btn)btn.classList.toggle('active',boardDrawMode);
  renderCoachboard(eventId)
}
function clearBoardDrawings(eventId){
  ensureBoard(eventId);
  data.boards[eventId].drawing='';
  save()
}
function resetBoard(eventId){
  if(!confirm('Coachboard wirklich leeren?'))return;
  data.boards[eventId]={items:[],drawing:'',note:''};
  save()
}
function saveBoardNote(eventId,value){
  ensureBoard(eventId);
  data.boards[eventId].note=value;
  localStorage.setItem('hockeyCoachData_v13',JSON.stringify(data));scheduleCloudSave()
}


function safePdfText(value){
  return String(value ?? '').replace(/[^\x20-\x7EÀ-ÿ]/g,'');
}
function pdfStatusGroups(eventId){
  const attendance=data.attendance[eventId]||{};
  const groups={present:[],absent:[],open:[]};
  for(const p of data.players){
    const status=attendance[p.id]||'open';
    groups[status].push(p);
  }
  return groups;
}
function pdfPlayerRow(p){
  return [
    p.jerseyNumber||'–',
    p.name,
    fmtBirthday(p.birthday),
    p.position||p.role||'–',
    p.shot||'–'
  ];
}
function pdfLineupRows(eventId){
  ensureLineup(eventId);
  const pname=pid=>{
    const p=data.players.find(x=>x.id===pid);
    return p?p.name:'–';
  };
  const rows=[];
  rows.push(['Goalies',pname(data.lineups[eventId].goalies.G1),pname(data.lineups[eventId].goalies.G2),'','','']);
  for(let line=1;line<=4;line++){
    rows.push([
      String(line),
      pname(data.lineups[eventId][line].LD),
      pname(data.lineups[eventId][line].RD),
      pname(data.lineups[eventId][line].LW),
      pname(data.lineups[eventId][line].C),
      pname(data.lineups[eventId][line].RW)
    ]);
  }
  return rows;
}

function teamDisplayName(){
  return data.settings?.teamName||TEAM_NAMES[activeTeamKey]||'SC Altstadt';
}
function teamCoachName(){
  return data.settings?.coachName||TEAM_COACHES[activeTeamKey]||'';
}
function addLogoToPdf(doc,x=14,y=8,w=22,h=22){
  const logo=data.settings?.logo;
  if(!logo)return false;
  try{
    const format=logo.includes('image/png')?'PNG':logo.includes('image/webp')?'WEBP':'JPEG';
    doc.addImage(logo,format,x,y,w,h);
    return true;
  }catch(err){
    console.warn('Logo konnte nicht ins PDF eingefügt werden',err);
    return false;
  }
}

function addPdfHeader(doc,title,event){
  const hasLogo=addLogoToPdf(doc,14,8,22,22);
  const x=hasLogo?40:14;
  doc.setFont('helvetica','bold');
  doc.setFontSize(18);
  doc.text(teamDisplayName(),x,16);
  doc.setFontSize(14);
  doc.text(title,x,24);
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  if(teamCoachName())doc.text(`Coach: ${teamCoachName()}`,x,30);
  if(event){
    doc.text(`Datum: ${fmtDateLong(event.date)}`,14,36);
    doc.text(`Zeit: ${event.time}`,14,42);
    if(event.title)doc.text(`Bezeichnung: ${safePdfText(event.title)}`,14,48);
  }
}
function addSectionTitle(doc,text,y){
  doc.setFont('helvetica','bold');
  doc.setFontSize(12);
  doc.text(text,14,y);
  return y+4;
}
function addAttendanceTables(doc,event,startY){
  const groups=pdfStatusGroups(event.id);
  let y=startY;

  const summary=`Dabei: ${groups.present.length}   Nicht dabei: ${groups.absent.length}   Offen: ${groups.open.length}`;
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.text(summary,14,y);
  y+=6;

  const sections=[
    ['Dabei',groups.present],
    ['Nicht dabei',groups.absent],
    ['Offen',groups.open]
  ];

  for(const [title,players] of sections){
    y=addSectionTitle(doc,title,y+3);
    doc.autoTable({
      startY:y,
      head:[['Nr.','Spieler','Geburtstag','Position','Schuss']],
      body:players.length?players.map(pdfPlayerRow):[['–','–','–','–','–']],
      margin:{left:14,right:14},
      styles:{fontSize:8,cellPadding:2},
      headStyles:{fillColor:[16,36,63]},
      theme:'grid'
    });
    y=doc.lastAutoTable.finalY+4;
    if(y>255){
      doc.addPage();
      y=18;
    }
  }
  return y;
}
function addLineupTable(doc,event,startY){
  let y=startY;
  y=addSectionTitle(doc,'Aufstellung',y+3);
  doc.autoTable({
    startY:y,
    head:[['Linie','LV','RV','LF','C','RF']],
    body:pdfLineupRows(event.id),
    margin:{left:14,right:14},
    styles:{fontSize:8,cellPadding:2},
    headStyles:{fillColor:[31,95,153]},
    theme:'grid'
  });
  return doc.lastAutoTable.finalY+5;
}
function addCoachboardInfo(doc,event,startY){
  ensureBoard(event.id);
  const board=data.boards[event.id];
  let y=startY;
  if(y>245){doc.addPage();y=18}
  y=addSectionTitle(doc,'Coachboard',y+3);

  if(board.drawing){
    try{
      const imgWidth=180;
      const imgHeight=90;
      if(y+imgHeight>280){doc.addPage();y=18}
      doc.addImage(board.drawing,'PNG',14,y,imgWidth,imgHeight);
      y+=imgHeight+5;
    }catch(err){
      console.warn('Coachboard-Bild konnte nicht eingefügt werden',err);
    }
  }else{
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.text('Keine Coachboard-Zeichnung vorhanden.',14,y+4);
    y+=9;
  }

  if(board.note){
    const lines=doc.splitTextToSize('Notizen: '+safePdfText(board.note),180);
    if(y+lines.length*5>280){doc.addPage();y=18}
    doc.setFontSize(9);
    doc.text(lines,14,y);
    y+=lines.length*5;
  }
  return y;
}
function addEventToPdf(doc,event,isFirst=true){
  if(!isFirst)doc.addPage();
  const title=`${labels[event.type].single}-Rapport`;
  addPdfHeader(doc,title,event);
  let y=event.title?50:44;
  y=addAttendanceTables(doc,event,y);
  if(y>245){doc.addPage();y=18}
  y=addLineupTable(doc,event,y);
  addCoachboardInfo(doc,event,y);
}
function downloadEventReport(id){
  const event=data.events.find(x=>x.id===id);
  if(!event)return;
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  addEventToPdf(doc,event,true);
  doc.save(`${labels[event.type].single}_${event.date}.pdf`);
}
function downloadCategoryReport(){
  const events=data.events
    .filter(e=>e.type===currentType)
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  if(!events.length)return alert('Noch keine Termine vorhanden.');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  events.forEach((event,index)=>addEventToPdf(doc,event,index===0));
  doc.save(`${labels[currentType].plural}_Rapport.pdf`);
}
function downloadAllReport(){
  const events=[...data.events].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  if(!events.length)return alert('Noch keine Termine vorhanden.');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  events.forEach((event,index)=>addEventToPdf(doc,event,index===0));
  doc.save('Gesamtrapport_Hockey.pdf');
}


let quickMonth='2026-08';

function monthLabel(month){
  const [year,mon]=month.split('-').map(Number);
  return new Intl.DateTimeFormat('de-CH',{month:'long',year:'numeric'}).format(new Date(year,mon-1,1));
}
function availableTrainingMonths(){
  return [...new Set(
    data.events.filter(e=>e.type==='training').map(e=>e.date.slice(0,7))
  )].sort();
}
function setQuickMonth(month){quickMonth=month;renderQuickPlanner()}
function toggleQuickAttendance(eventId,playerId){
  data.attendance[eventId] ||= {};
  const current=data.attendance[eventId][playerId]||'present';
  data.attendance[eventId][playerId]=current==='absent'?'present':'absent';
  if(data.attendance[eventId][playerId]!=='present'&&data.lineups?.[eventId]){
    clearPlayerFromLineup(eventId,playerId);
  }
  save();
}
function renderQuickPlanner(){
  const el=document.getElementById('quickPlanner');
  if(!el)return;
  if(currentType!=='training'){el.innerHTML='';return}

  const months=availableTrainingMonths();
  if(!months.length){
    el.innerHTML='<div class="empty">Erstelle zuerst die Saisontrainings.</div>';
    return;
  }
  if(!months.includes(quickMonth))quickMonth=months[0];

  const trainings=data.events
    .filter(e=>e.type==='training'&&e.date.startsWith(quickMonth))
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

  let html=`<h2>Schnellplanung</h2>
  <div class="quick-toolbar">
    <select onchange="setQuickMonth(this.value)">
      ${months.map(m=>`<option value="${m}" ${m===quickMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}
    </select>
    <span class="quick-legend">Klick auf eine Zelle: grün = dabei, rot = abgemeldet</span>
  </div>
  <div class="quick-table-wrap"><table class="quick-table"><thead><tr><th>Spieler</th>`;

  for(const t of trainings){
    const d=new Date(t.date+'T12:00:00');
    html+=`<th>${String(d.getDate()).padStart(2,'0')}.<br><span class="muted">${d.toLocaleDateString('de-CH',{weekday:'short'})}</span></th>`;
  }
  html+='</tr></thead><tbody>';

  for(const p of data.players){
    html+=`<tr><td><strong>${p.name}</strong><br><span class="muted">${p.position||p.role}${p.jerseyNumber?' · #'+p.jerseyNumber:''}</span></td>`;
    for(const t of trainings){
      const status=(data.attendance[t.id]||{})[p.id]||'present';
      const cls=status==='absent'?'absent':status==='open'?'open':'present';
      const symbol=status==='absent'?'✕':status==='open'?'?':'✓';
      html+=`<td><button class="quick-cell ${cls}" onclick="toggleQuickAttendance('${t.id}','${p.id}')">${symbol}</button></td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table></div>';
  el.innerHTML=html;
}

function downloadMonthlyTrainingPdf(){
  const trainings=data.events
    .filter(e=>e.type==='training')
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

  if(!trainings.length){
    alert('Noch keine Trainings vorhanden.');
    return;
  }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const months=[...new Set(trainings.map(t=>t.date.slice(0,7)))].sort();

  months.forEach((month,pageIndex)=>{
    if(pageIndex>0)doc.addPage('a4','landscape');

    const monthTrainings=trainings.filter(t=>t.date.startsWith(month));
    const pageWidth=doc.internal.pageSize.getWidth();

    const hasLogo=addLogoToPdf(doc,10,6,18,18);
    const titleX=hasLogo?34:14;
    doc.setFont('helvetica','bold');
    doc.setFontSize(16);
    doc.text(`${teamDisplayName()} - Trainingsuebersicht ${monthLabel(month)}`,titleX,14);

    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    if(teamCoachName())doc.text(`Coach: ${teamCoachName()}`,titleX,19);
    doc.text('DA = Spieler nimmt teil    AB = Spieler ist abgemeldet',14,24);

    const dateLabels=monthTrainings.map(t=>{
      const d=new Date(t.date+'T12:00:00');
      return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    });

    const head=['Spieler',...dateLabels];

    const body=data.players.map(p=>[
      `${p.jerseyNumber?'#'+p.jerseyNumber+' ':''}${p.name}`,
      ...monthTrainings.map(t=>{
        const status=(data.attendance[t.id]||{})[p.id]||'present';
        return status==='absent'?'AB':'DA';
      })
    ]);

    const playerColWidth=50;
    const remainingWidth=pageWidth-20-playerColWidth;
    const trainingColWidth=Math.max(13,remainingWidth/Math.max(1,monthTrainings.length));

    doc.autoTable({
      startY:29,
      head:[head],
      body,
      margin:{left:10,right:10},
      tableWidth:'auto',
      styles:{
        fontSize:7.2,
        cellPadding:1.3,
        halign:'center',
        valign:'middle',
        overflow:'linebreak'
      },
      columnStyles:{
        0:{halign:'left',cellWidth:playerColWidth}
      },
      didParseCell:function(cell){
        if(cell.column.index>0){
          cell.cell.styles.cellWidth=trainingColWidth;
        }
        if(cell.section==='body'&&cell.column.index>0){
          if(cell.cell.raw==='AB'){
            cell.cell.styles.textColor=[190,40,40];
            cell.cell.styles.fontStyle='bold';
            cell.cell.styles.fillColor=[255,240,240];
          }else{
            cell.cell.styles.textColor=[20,120,65];
          }
        }
      },
      headStyles:{
        fillColor:[16,36,63],
        textColor:[255,255,255],
        fontStyle:'bold',
        fontSize:7
      },
      alternateRowStyles:{
        fillColor:[247,249,252]
      },
      theme:'grid'
    });

    let y=doc.lastAutoTable.finalY+6;

    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text('Anzahl anwesende Spieler pro Training',10,y);
    y+=4;

    function presentPlayers(training){
      const record=data.attendance[training.id]||{};
      return data.players.filter(p=>(record[p.id]||'present')==='present');
    }

    const summaryBody=[
      ['Stuermer',...monthTrainings.map(t=>presentPlayers(t).filter(p=>p.position==='Stürmer').length)],
      ['Verteidiger',...monthTrainings.map(t=>presentPlayers(t).filter(p=>p.position==='Verteidiger').length)],
      ['Goalies',...monthTrainings.map(t=>presentPlayers(t).filter(p=>p.position==='Goalie').length)],
      ['Total',...monthTrainings.map(t=>presentPlayers(t).length)]
    ];

    doc.autoTable({
      startY:y,
      head:[['Position',...dateLabels]],
      body:summaryBody,
      margin:{left:10,right:10},
      styles:{
        fontSize:7.5,
        cellPadding:1.5,
        halign:'center',
        valign:'middle'
      },
      columnStyles:{
        0:{halign:'left',cellWidth:playerColWidth,fontStyle:'bold'}
      },
      didParseCell:function(cell){
        if(cell.column.index>0){
          cell.cell.styles.cellWidth=trainingColWidth;
        }
        if(cell.section==='body'&&cell.row.index===3){
          cell.cell.styles.fontStyle='bold';
          cell.cell.styles.fillColor=[232,240,248];
        }
      },
      headStyles:{
        fillColor:[31,95,153],
        textColor:[255,255,255],
        fontStyle:'bold'
      },
      theme:'grid'
    });

    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-CH')}`,pageWidth-45,202);
  });

  doc.save('Trainingsuebersicht_Monate.pdf');
}

function exportCSV(){
 const rows=[['Spieler','Trikotnummer','Geburtstag','Position','Schusshand','Dabei','Nicht dabei','Quote %']];
 for(const p of data.players){
   let yes=0,no=0;
   for(const e of data.events){
     const s=(data.attendance[e.id]||{})[p.id];
     if(s==='present')yes++;
     if(s==='absent')no++
   }
   const total=yes+no;
   rows.push([p.name,p.jerseyNumber||'',p.birthday||'',p.position||p.role,p.shot||'',yes,no,total?Math.round(yes/total*100):0])
 }
 const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');
 const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
 a.download='hockey_anwesenheit.csv';
 a.click()
}

function setCloudStatus(text,type=''){
  const el=document.getElementById('cloudStatus');
  if(!el)return;
  el.textContent=text;
  el.className='cloud-status'+(type?' '+type:'');
}
function showAuthMessage(text,isError=false){
  const el=document.getElementById('authMessage');
  el.textContent=text;
  el.className='auth-message show';
  el.style.background=isError?'#fdeaea':'#f3f6f9';
  el.style.color=isError?'#9e2525':'#405064';
}
async function cloudSignUp(){
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  if(!email||password.length<6){showAuthMessage('Bitte E-Mail und ein Passwort mit mindestens 6 Zeichen eingeben.',true);return}
  showAuthMessage('Konto wird erstellt …');
  const {data:result,error}=await cloudClient.auth.signUp({email,password});
  if(error){showAuthMessage(error.message,true);return}
  if(result.session){
    showAuthMessage('Konto erstellt. Die App wird geladen.');
  }else{
    showAuthMessage('Konto erstellt. Bitte bestätige zuerst die E-Mail, die Supabase dir geschickt hat.');
  }
}
async function cloudSignIn(){
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  if(!email||!password){showAuthMessage('Bitte E-Mail und Passwort eingeben.',true);return}
  showAuthMessage('Anmeldung läuft …');
  const {error}=await cloudClient.auth.signInWithPassword({email,password});
  if(error){showAuthMessage('Anmeldung fehlgeschlagen: '+error.message,true)}
}
async function cloudSignOut(){
  await cloudClient.auth.signOut();
}
function scheduleCloudSave(){
  if(!cloudReady||!cloudUser)return;
  clearTimeout(cloudSaveTimer);
  setCloudStatus('Änderungen werden gespeichert …','syncing');
  cloudSaveTimer=setTimeout(pushCloudState,700);
}
async function pushCloudState(){
  if(!cloudReady||!cloudUser||cloudSaving)return;
  cloudSaving=true;
  const now=new Date().toISOString();
  if(activeTeamKey)cloudRoot.teams[activeTeamKey]=data;
  const payload={club_id:SHARED_CLUB_ID,data:cloudRoot,updated_at:now};
  const {error}=await cloudClient.from('club_state').upsert(payload,{onConflict:'club_id'});
  cloudSaving=false;
  if(error){
    setCloudStatus('Cloud-Fehler','error');
    console.error(error);
    return;
  }
  lastCloudUpdated=now;
  setCloudStatus('Synchronisiert','ok');
}
async function loadCloudState({initial=false}={}){
  if(!cloudUser)return;
  setCloudStatus(initial?'Cloud-Daten werden geladen …':'Prüfe Cloud …','syncing');
  const {data:row,error}=await cloudClient.from('club_state').select('data,updated_at').eq('club_id',SHARED_CLUB_ID).maybeSingle();
  if(error){
    setCloudStatus('Cloud-Fehler','error');
    console.error(error);
    return;
  }
  if(row?.data){
    if(initial||(!cloudSaving&&row.updated_at&&row.updated_at!==lastCloudUpdated)){
      if(row.data.teams){
        cloudRoot=row.data;
      }else{
        cloudRoot={teams:{second:normalizeTeamData(row.data),third:{players:[],events:[],attendance:{},lineups:{},boards:{},settings:{logo:'',teamName:'',coachName:''}}}};
      }
      cloudRoot.teams ||= {};
      cloudRoot.teams.second=normalizeTeamData(cloudRoot.teams.second||EMPTY_TEAM_DATA());
      cloudRoot.teams.third=cloudRoot.teams.third||{players:[],events:[],attendance:{},lineups:{},boards:{},settings:{logo:'',teamName:'',coachName:''}};
      cloudRoot.teams.third.players ||= [];
      cloudRoot.teams.third.events ||= [];
      cloudRoot.teams.third.attendance ||= {};
      cloudRoot.teams.third.lineups ||= {};
      cloudRoot.teams.third.boards ||= {};
    third.absences ||= [];
      cloudRoot.teams.third.settings ||= {logo:'',teamName:'',coachName:''};
      lastCloudUpdated=row.updated_at||'';
      if(activeTeamKey){
        data=cloudRoot.teams[activeTeamKey];
        localStorage.setItem('hockeyCoachData_v13',JSON.stringify(data));
        renderAll();
      }
    }
    setCloudStatus('Synchronisiert','ok');
  }else{
    cloudRoot={teams:{second:normalizeTeamData(data),third:{players:[],events:[],attendance:{},lineups:{},boards:{},settings:{logo:'',teamName:'',coachName:''}}}};
    await pushCloudState();
  }
}
function startCloudPolling(){
  clearInterval(cloudPollTimer);
  cloudPollTimer=setInterval(async()=>{await loadCloudState();await overlayPilotStatusForCoach();},5000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&cloudUser)loadCloudState();
  });
}

const PLAYER_PILOT_EMAIL='diego.schwarzenbach@olten.ch';

function isPilotPlayerLogin(){
  return (cloudUser?.email||'').toLowerCase()===PLAYER_PILOT_EMAIL.toLowerCase();
}

async function loadPlayerPilot(){
  const app=document.getElementById('playerPilotApp');
  const coach=document.getElementById('coachModeApp');
  coach.classList.add('hidden');
  app.classList.remove('hidden');
  document.getElementById('teamScreen').classList.add('hidden');
  document.getElementById('teamSwitchBtn').style.display='none';
  document.getElementById('settingsBtn').style.display='none';
  document.getElementById('activeTeamLabel').textContent='SC Altstadt 2. Liga · Spielerzugang';
  setCloudStatus('Synchronisiert','ok');

  const {data:payload,error}=await cloudClient.rpc('get_my_player_schedule');
  if(error){
    app.innerHTML=`<div class="player-pilot-card"><h2>Spielerzugang</h2><p class="danger">Daten konnten nicht geladen werden: ${error.message}</p></div>`;
    return;
  }

  const profile=payload?.profile||{display_name:'Diego Schwarzenbach (Test)',team_key:'second'};
  const events=payload?.events||[];
  const statuses=payload?.statuses||{};

  app.innerHTML=`<div class="player-pilot-card">
    <div class="player-pilot-head">
      <div><h2 style="margin:0">Hallo ${profile.display_name}</h2><div class="muted">SC Altstadt 2. Liga</div></div>
      <span class="player-pilot-badge">Spielerzugang</span>
    </div>
    <p>Du kannst ausschliesslich deine eigene Teilnahme ändern.</p>
  </div>
  <div class="player-pilot-card">
    <h2>Nächste Termine</h2>
    ${events.length?events.map(event=>{
      const status=statuses[event.id]||'present';
      const type=event.type==='training'?'Training':event.type==='game'?'Spiel':'Trainingslager';
      return `<div class="player-pilot-event">
        <div><strong>${type} · ${fmtDate(event.date)}</strong><span>${event.time||''}${event.title?' · '+event.title:''}</span></div>
        <div class="player-pilot-actions">
          <button class="${status==='present'?'success':'soft'}" onclick="savePilotStatus('${event.id}','present')">Dabei</button>
          <button class="${status==='absent'?'danger':'soft'}" onclick="savePilotStatus('${event.id}','absent')">Nicht dabei</button>
          <button class="${status==='open'?'on-unknown':'soft'}" onclick="savePilotStatus('${event.id}','open')">Offen</button>
        </div>
      </div>`;
    }).join(''):'<p class="muted">Keine kommenden Termine vorhanden.</p>'}
  </div>`;
}

async function savePilotStatus(eventId,status){
  const {error}=await cloudClient.rpc('set_my_player_status',{target_event_id:eventId,new_status:status});
  if(error){
    alert('Status konnte nicht gespeichert werden: '+error.message);
    return;
  }
  await loadPlayerPilot();
}

function ensurePilotPlayerInCoachData(){
  const team=cloudRoot.teams?.second;
  if(!team)return;
  let player=team.players.find(p=>p.id==='test-diego-player');
  if(!player){
    player={
      id:'test-diego-player',
      name:'Diego Schwarzenbach (Test)',
      role:'Feldspieler',
      position:'Stürmer',
      shot:'Links',
      jerseyNumber:'',
      birthday:'',
      email:PLAYER_PILOT_EMAIL
    };
    team.players.push(player);
    for(const event of team.events||[]){
      team.attendance[event.id] ||= {};
      team.attendance[event.id][player.id] ||= 'present';
    }
    cloudRoot.teams.second=team;
  }
}

async function overlayPilotStatusForCoach(){
  if(!cloudUser||isPilotPlayerLogin())return;
  const {data:rows,error}=await cloudClient.from('player_event_status')
    .select('event_id,status,player_profiles!inner(player_ref,team_key)')
    .eq('player_profiles.club_id',SHARED_CLUB_ID);
  if(error){console.warn(error);return;}
  let changed=false;
  for(const row of rows||[]){
    const profile=row.player_profiles;
    const team=cloudRoot.teams?.[profile.team_key];
    if(!team||!profile.player_ref)continue;
    team.attendance[row.event_id] ||= {};
    if(team.attendance[row.event_id][profile.player_ref]!==row.status){
      team.attendance[row.event_id][profile.player_ref]=row.status;
      changed=true;
    }
  }
  if(changed&&activeTeamKey){
    data=cloudRoot.teams[activeTeamKey];
    localStorage.setItem('hockeyCoachData_v13',JSON.stringify(data));
    renderAll();
  }
}

async function handleCloudSession(session){
  cloudUser=session?.user||null;
  const authScreen=document.getElementById('authScreen');
  const logoutBtn=document.getElementById('logoutBtn');
  if(!cloudUser){
    cloudReady=false;
    authScreen.classList.remove('hidden');
    logoutBtn.style.display='none';
    setCloudStatus('Nicht angemeldet');
    clearInterval(cloudPollTimer);
    activeTeamKey=null;
    document.getElementById('teamScreen').classList.add('hidden');
    document.getElementById('teamSwitchBtn').style.display='none';
    document.getElementById('settingsBtn').style.display='none';
    return;
  }
  authScreen.classList.add('hidden');
  logoutBtn.style.display='inline-block';
  cloudReady=false;

  if(isPilotPlayerLogin()){
    await loadPlayerPilot();
    cloudReady=true;
    clearInterval(cloudPollTimer);
    cloudPollTimer=setInterval(loadPlayerPilot,5000);
    return;
  }

  document.getElementById('coachModeApp').classList.remove('hidden');
  document.getElementById('playerPilotApp').classList.add('hidden');
  await loadCloudState({initial:true});
  ensurePilotPlayerInCoachData();
  await overlayPilotStatusForCoach();
  cloudReady=true;
  setCloudStatus('Synchronisiert','ok');
  startCloudPolling();
  const remembered=localStorage.getItem('hockeyCoachActiveTeam');
  refreshTeamLogos();
  if(remembered&&cloudRoot.teams?.[remembered])selectTeam(remembered);
  else document.getElementById('teamScreen').classList.remove('hidden');
}
async function initCloud(){
  const {data:{session}}=await cloudClient.auth.getSession();
  await handleCloudSession(session);
  cloudClient.auth.onAuthStateChange(async(event,session)=>{
    if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'){
      await handleCloudSession(session);
    }
  });
}

function renderAll(){if(!activeTeamKey)return;renderEvents();renderSelected();renderPlayers();renderStats();renderQuickPlanner()}
renderAll();
initCloud();
