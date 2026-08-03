const SUPABASE_URL='https://amhdxwbbnbvwpyrxxjho.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_D7qzc4BKtWMynq8RqwzAqw_l8FVvXlT';
const cloudClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const SHARED_CLUB_ID='7c807357-d90b-4ca4-9d20-f61a82ff6065';
const CALENDAR_FUNCTION_URL=
  `${SUPABASE_URL}/functions/v1/team-calendar`;

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
    if(!('email' in p))p.email='';
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
      cloudRoot.teams.third.absences ||= [];
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
  showDashboard();
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
function setType(type){
  currentType=type;
  selectedId=null;
  document.querySelectorAll('.type-switch button').forEach(b=>b.classList.remove('active'));

  const activeButton=document.getElementById(
    type==='training'?'typeTraining':type==='game'?'typeGame':'typeCamp'
  );
  if(activeButton)activeButton.classList.add('active');

  const scheduleButton=document.getElementById('scheduleBtn');
  if(scheduleButton)scheduleButton.style.display=type==='training'?'inline-block':'none';

  const trainingHint=document.getElementById('trainingHint');
  if(trainingHint)trainingHint.style.display=type==='training'?'block':'none';

  const pdfHint=document.getElementById('pdfHint');
  if(pdfHint)pdfHint.style.display=type==='training'?'block':'none';

  const seriesPlanner=document.getElementById('seriesPlanner');
  if(seriesPlanner)seriesPlanner.style.display=type==='training'?'block':'none';

  renderAll();
}
function addEvent(){
 const date=newDate.value,time=newTime.value||'20:00',title=newTitle.value.trim();
 if(!date)return alert('Bitte Datum wählen.');

 let opponent='';
 let homeAway='';

 if(currentType==='game'){
   opponent=title;
   if(!opponent){
     alert('Bitte beim Spiel den Gegner im Feld Bezeichnung / Gegner eingeben.');
     newTitle.focus();
     return;
   }

   const answer=prompt(
     'Ist das Spiel Heim oder Auswärts?\n\nBitte H für Heim oder A für Auswärts eingeben:',
     'H'
   );

   if(answer===null)return;

   const normalized=answer.trim().toUpperCase();

   if(normalized==='H'||normalized==='HEIM'){
     homeAway='home';
   }else if(normalized==='A'||normalized==='AUSWÄRTS'||normalized==='AUSWAERTS'){
     homeAway='away';
   }else{
     alert('Bitte H für Heim oder A für Auswärts eingeben.');
     return;
   }
 }

 const id=currentType+'_'+date+'_'+time+'_'+Date.now();
 data.events.push({
   id,
   type:currentType,
   date,
   time,
   title,
   opponent,
   homeAway
 });

 data.attendance[id]={};

 if(currentType==='training'){
   for(const p of data.players)data.attendance[id][p.id]='present';
 }

 applyAbsencesToEvent(data.events.find(e=>e.id===id));
 selectedId=id;
 newTitle.value='';
 save();
}

function initializeSeriesDayTimes(){
  const checkboxes=[...document.querySelectorAll('.seriesDay')];
  if(!checkboxes.length)return;

  const sharedTime=document.getElementById('seriesTime');
  const defaultTime=sharedTime?.value||'20:00';

  if(sharedTime){
    const wrapper=sharedTime.closest('.field')||sharedTime.parentElement;
    if(wrapper)wrapper.style.display='none';
  }

  for(const checkbox of checkboxes){
    const day=Number(checkbox.value);
    const holder=checkbox.closest('.weekday-option')||checkbox.parentElement;
    if(!holder||holder.querySelector('.series-day-time'))continue;

    const timeInput=document.createElement('input');
    timeInput.type='time';
    timeInput.className='series-day-time';
    timeInput.dataset.day=String(day);
    timeInput.value=defaultTime;
    timeInput.disabled=!checkbox.checked;
    timeInput.style.width='105px';
    timeInput.style.marginLeft='6px';

    checkbox.addEventListener('change',()=>{
      timeInput.disabled=!checkbox.checked;
      if(checkbox.checked&&!timeInput.value)timeInput.value=defaultTime;
    });

    holder.appendChild(timeInput);
  }
}

function createRecurringTrainings(){
  if(currentType!=='training')return;

  const startValue=document.getElementById('seriesStart').value;
  const endValue=document.getElementById('seriesEnd').value;
  const selectedCheckboxes=[...document.querySelectorAll('.seriesDay:checked')];

  if(!startValue||!endValue){
    alert('Bitte Saisonbeginn und Saisonende auswählen.');
    return;
  }

  if(selectedCheckboxes.length===0){
    alert('Bitte mindestens einen Trainingstag auswählen.');
    return;
  }

  const start=new Date(startValue+'T12:00:00');
  const end=new Date(endValue+'T12:00:00');

  if(end<start){
    alert('Das Saisonende muss nach dem Saisonbeginn liegen.');
    return;
  }

  const weekdayConfigs=selectedCheckboxes.map(checkbox=>{
    const day=Number(checkbox.value);
    const timeInput=document.querySelector(`.series-day-time[data-day="${day}"]`);
    const time=timeInput?.value||document.getElementById('seriesTime')?.value||'20:00';

    return {
      day,
      time,
      seriesId:`series_day_${day}_${crypto.randomUUID()}`
    };
  });

  let created=0;
  let skipped=0;

  for(let date=new Date(start);date<=end;date.setDate(date.getDate()+1)){
    const config=weekdayConfigs.find(item=>item.day===date.getDay());
    if(!config)continue;

    const dateString=[
      date.getFullYear(),
      String(date.getMonth()+1).padStart(2,'0'),
      String(date.getDate()).padStart(2,'0')
    ].join('-');

    const duplicate=data.events.some(event=>
      event.type==='training' &&
      event.date===dateString &&
      event.time===config.time
    );

    if(duplicate){
      skipped++;
      continue;
    }

    const id='training_'+dateString+'_'+config.time+'_'+crypto.randomUUID();

    data.events.push({
      id,
      type:'training',
      date:dateString,
      time:config.time,
      title:'',
      seriesId:config.seriesId,
      seriesWeekday:config.day
    });

    data.attendance[id]={};

    for(const player of data.players){
      data.attendance[id][player.id]='present';
    }

    applyAbsencesToEvent(data.events[data.events.length-1]);
    created++;
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
 const seriesId='season_2026_2027';

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
   data.events.push({id,type:'training',date:ds,time,title:'',seriesId});
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
 const nameInput=document.getElementById('playerName');
 const positionInput=document.getElementById('playerPosition');
 const shotInput=document.getElementById('playerShot');
 const numberInput=document.getElementById('playerNumber');
 const birthdayInput=document.getElementById('playerBirthday');
 const emailInput=document.getElementById('playerEmail');

 if(!nameInput||!positionInput||!shotInput){
   alert('Das Spielerformular konnte nicht geladen werden. Bitte die Seite mit Ctrl + F5 neu laden.');
   return;
 }

 const name=nameInput.value.trim();
 const position=positionInput.value;
 const shot=shotInput.value;

 if(!name){
   alert('Bitte Namen eingeben.');
   nameInput.focus();
   return;
 }

 const newPlayer={
   id:'p'+Date.now(),
   name,
   role:position==='Goalie'?'Goalie':'Feldspieler',
   position,
   shot,
   jerseyNumber:numberInput?.value.trim()||'',
   birthday:birthdayInput?.value||'',
   email:emailInput?.value.trim()||''
 };

 data.players.push(newPlayer);

 for(const event of data.events){
   data.attendance[event.id] ||= {};
   data.attendance[event.id][newPlayer.id]='present';
   applyAbsencesToEvent(event);
 }

 nameInput.value='';
 if(numberInput)numberInput.value='';
 if(birthdayInput)birthdayInput.value='';
 if(emailInput)emailInput.value='';

 save();
 alert(`${newPlayer.name} wurde hinzugefügt.`);
}
function deletePlayer(id){if(!confirm('Spieler wirklich löschen?'))return;data.players=data.players.filter(p=>p.id!==id);for(const a of Object.values(data.attendance))delete a[id];save()}
function changePosition(id,position){const p=data.players.find(x=>x.id===id);if(p){p.position=position;p.role=position==='Goalie'?'Goalie':'Feldspieler';save()}}
function changeShot(id,shot){const p=data.players.find(x=>x.id===id);if(p){p.shot=shot;save()}}
function changeNumber(id,number){const p=data.players.find(x=>x.id===id);if(p){p.jerseyNumber=number;save()}}
function changeBirthday(id,birthday){const p=data.players.find(x=>x.id===id);if(p){p.birthday=birthday;save()}}
function updatePlayerEmail(id,email){
  const player=data.players.find(p=>p.id===id);
  if(!player)return;

  const normalizedEmail=(email||'').trim().toLowerCase();

  if(normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)){
    alert('Bitte eine gültige E-Mail-Adresse eingeben.');
    renderPlayers();
    return;
  }

  player.email=normalizedEmail;
  save();
}
function fmtBirthday(s){if(!s)return '–';return new Intl.DateTimeFormat('de-CH',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'))}


function filterAttendancePlayers(query){
  const normalized=(query||'').trim().toLowerCase();
  document.querySelectorAll('#attendanceList .player').forEach(row=>{
    const text=(row.dataset.search||row.textContent||'').toLowerCase();
    row.style.display=!normalized||text.includes(normalized)?'grid':'none';
  });
}

let coachCalendarMonth=new Date().toISOString().slice(0,7);
let coachCalendarType='training';

function ensureCoachPortalTheme(){
  if(document.getElementById('coachPortalAltstadtTheme'))return;

  const style=document.createElement('style');
  style.id='coachPortalAltstadtTheme';
  style.textContent=`
    #coachModeApp{
      background:
        radial-gradient(circle at 0% 0%,rgba(36,87,68,.08),transparent 25%),
        linear-gradient(180deg,#f4f8f6 0%,#fbfcfc 100%);
      color:#25302c;
      min-height:100vh;
    }

    #coachModeApp .card,
    #coachModeApp .dashboard-card,
    #coachModeApp .event,
    #coachModeApp details,
    #coachModeApp .player{
      border-color:#d8e3de !important;
      box-shadow:0 10px 26px rgba(23,63,50,.07);
      background:#fff;
    }

    #coachModeApp .card,
    #coachModeApp .dashboard-card{
      border-radius:20px !important;
    }

    #coachModeApp h1,
    #coachModeApp h2,
    #coachModeApp h3{
      color:#173f32;
      letter-spacing:-.02em;
    }

    #coachModeApp .btn{
      border-radius:12px !important;
      font-weight:800;
      transition:transform .16s ease,box-shadow .16s ease;
    }

    #coachModeApp .btn:hover{
      transform:translateY(-1px);
      box-shadow:0 8px 18px rgba(23,63,50,.12);
    }

    #coachModeApp .btn.primary{
      background:linear-gradient(135deg,#245744,#173f32) !important;
      border-color:#173f32 !important;
      color:#fff !important;
    }

    #coachModeApp .btn.soft{
      background:#fff !important;
      border-color:#d8e3de !important;
      color:#173f32 !important;
    }

    #coachModeApp .btn.ghost{
      background:#e5f0eb !important;
      color:#173f32 !important;
      border-color:transparent !important;
    }

    #coachModeApp .btn.danger{
      background:#b52a31 !important;
      border-color:#b52a31 !important;
      color:#fff !important;
    }

    #coachModeApp .tab.active,
    #coachModeApp .type-switch button.active{
      background:linear-gradient(135deg,#245744,#173f32) !important;
      color:#fff !important;
      border-color:#173f32 !important;
    }

    #coachModeApp .event.active{
      border-color:#245744 !important;
      box-shadow:0 0 0 2px rgba(36,87,68,.13);
      background:#f2f8f5 !important;
    }

    #coachModeApp input,
    #coachModeApp select,
    #coachModeApp textarea{
      border-color:#d8e3de !important;
      border-radius:11px !important;
    }

    #coachModeApp input:focus,
    #coachModeApp select:focus,
    #coachModeApp textarea:focus{
      outline:none;
      border-color:#245744 !important;
      box-shadow:0 0 0 3px rgba(36,87,68,.11);
    }

    .coach-calendar-shell{
      min-width:min(920px,92vw);
      max-width:1100px;
    }

    .coach-calendar-toolbar{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:10px;
      margin-bottom:12px;
    }

    .coach-calendar-grid{
      display:grid;
      grid-template-columns:repeat(7,minmax(0,1fr));
      gap:6px;
    }

    .coach-calendar-weekday{
      text-align:center;
      font-weight:800;
      color:#56655f;
      padding:6px 2px;
      font-size:12px;
    }

    .coach-calendar-day{
      min-height:112px;
      border:1px solid #d8e3de;
      border-radius:12px;
      padding:7px;
      background:#fff;
    }

    .coach-calendar-day.empty{
      background:#f2f5f4;
      border-color:transparent;
    }

    .coach-calendar-date{
      font-weight:900;
      color:#173f32;
      font-size:12px;
    }

    .coach-calendar-entry{
      margin-top:6px;
      padding:7px;
      border-radius:9px;
      font-size:11px;
      font-weight:750;
      line-height:1.25;
      background:#e5f0eb;
      color:#173f32;
      border:1px solid #b8d2c5;
    }

    .coach-calendar-entry.game{
      background:#eef1f2;
      color:#2f3437;
      border-color:#cfd5d8;
    }

    @media(max-width:760px){
      .coach-calendar-shell{
        min-width:900px;
      }

      #appModal .modal-content{
        overflow-x:auto;
      }
    }
  `;
  document.head.appendChild(style);
}

function coachCalendarEvents(type=coachCalendarType,month=coachCalendarMonth){
  return (data.events||[])
    .filter(event=>event.type===type&&event.date.startsWith(month))
    .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
}

function coachGameLabel(event){
  const opponent=event.opponent||event.title||'Gegner offen';
  const where=event.homeAway==='home'
    ? 'Heim'
    : event.homeAway==='away'
      ? 'Auswärts'
      : 'Ort offen';
  return `${opponent} · ${where}`;
}

function openCoachCalendar(type){
  coachCalendarType=type;
  const months=[...new Set(
    (data.events||[])
      .filter(event=>event.type===type)
      .map(event=>event.date.slice(0,7))
  )].sort();

  if(months.length&&!months.includes(coachCalendarMonth)){
    coachCalendarMonth=months[0];
  }

  openModal(`
    <div class="coach-calendar-shell">
      <div class="coach-calendar-toolbar">
        <button class="btn soft" onclick="changeCoachCalendarMonth(-1)">‹</button>
        <div style="text-align:center">
          <h2 id="coachCalendarTitle" style="margin:0"></h2>
          <div class="muted">${type==='training'?'Trainingsplan':'Spielplan'}</div>
        </div>
        <button class="btn soft" onclick="changeCoachCalendarMonth(1)">›</button>
      </div>

      <div class="row" style="justify-content:center;margin-bottom:12px">
        <button class="btn primary" onclick="downloadCoachCalendarPdf()">
          📄 Monatskalender als PDF herunterladen
        </button>
        <button class="btn soft" onclick="downloadPlayerCalendar('${type}')">
          📅 ICS herunterladen
        </button>
      </div>

      <div id="coachCalendarBody"></div>
    </div>
  `);

  renderCoachCalendar();
}

function changeCoachCalendarMonth(offset){
  const [year,month]=coachCalendarMonth.split('-').map(Number);
  const next=new Date(year,month-1+offset,1);
  coachCalendarMonth=[
    next.getFullYear(),
    String(next.getMonth()+1).padStart(2,'0')
  ].join('-');
  renderCoachCalendar();
}

function renderCoachCalendar(){
  const target=document.getElementById('coachCalendarBody');
  const title=document.getElementById('coachCalendarTitle');
  if(!target||!title)return;

  const [year,month]=coachCalendarMonth.split('-').map(Number);
  const firstDay=new Date(year,month-1,1);
  const lastDay=new Date(year,month,0);
  const events=coachCalendarEvents();

  title.textContent=new Intl.DateTimeFormat('de-CH',{
    month:'long',
    year:'numeric'
  }).format(firstDay);

  const eventMap={};
  for(const event of events){
    eventMap[event.date] ||= [];
    eventMap[event.date].push(event);
  }

  const cells=[];
  const mondayIndex=(firstDay.getDay()+6)%7;

  for(let i=0;i<mondayIndex;i++){
    cells.push('<div class="coach-calendar-day empty"></div>');
  }

  for(let day=1;day<=lastDay.getDate();day++){
    const date=[
      year,
      String(month).padStart(2,'0'),
      String(day).padStart(2,'0')
    ].join('-');

    const entries=(eventMap[date]||[]).map(event=>`
      <div class="coach-calendar-entry ${event.type==='game'?'game':''}">
        <div>${event.time||''}</div>
        <div>
          ${event.type==='game'
            ? coachGameLabel(event)
            : (event.title||'Training')}
        </div>
      </div>
    `).join('');

    cells.push(`
      <div class="coach-calendar-day">
        <div class="coach-calendar-date">${day}</div>
        ${entries}
      </div>
    `);
  }

  target.innerHTML=`
    <div class="coach-calendar-grid">
      ${['Mo','Di','Mi','Do','Fr','Sa','So']
        .map(day=>`<div class="coach-calendar-weekday">${day}</div>`)
        .join('')}
      ${cells.join('')}
    </div>
  `;
}

function downloadCoachCalendarPdf(){
  const events=coachCalendarEvents();

  if(!events.length){
    alert('In diesem Monat sind keine Termine vorhanden.');
    return;
  }

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const [year,month]=coachCalendarMonth.split('-').map(Number);
  const firstDay=new Date(year,month-1,1);
  const lastDay=new Date(year,month,0);

  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const margin=10;
  const headerHeight=22;
  const weekdaysHeight=8;
  const gridTop=margin+headerHeight+weekdaysHeight;
  const cols=7;
  const rows=Math.ceil((((firstDay.getDay()+6)%7)+lastDay.getDate())/7);
  const cellWidth=(pageWidth-margin*2)/cols;
  const cellHeight=(pageHeight-gridTop-margin)/rows;

  doc.setFillColor(23,63,50);
  doc.rect(0,0,pageWidth,26,'F');

  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold');
  doc.setFontSize(17);
  doc.text(
    `${teamDisplayName()} – ${coachCalendarType==='training'?'Trainingsplan':'Spielplan'}`,
    margin,
    11
  );

  doc.setFontSize(11);
  doc.text(
    new Intl.DateTimeFormat('de-CH',{month:'long',year:'numeric'}).format(firstDay),
    margin,
    19
  );

  doc.setTextColor(37,48,44);
  doc.setFontSize(9);

  const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So'];
  weekdays.forEach((label,index)=>{
    doc.setFont('helvetica','bold');
    doc.text(
      label,
      margin+index*cellWidth+cellWidth/2,
      margin+headerHeight+5,
      {align:'center'}
    );
  });

  const eventMap={};
  for(const event of events){
    eventMap[event.date] ||= [];
    eventMap[event.date].push(event);
  }

  const firstIndex=(firstDay.getDay()+6)%7;

  for(let day=1;day<=lastDay.getDate();day++){
    const index=firstIndex+day-1;
    const row=Math.floor(index/7);
    const col=index%7;
    const x=margin+col*cellWidth;
    const y=gridTop+row*cellHeight;

    doc.setDrawColor(216,227,222);
    doc.setFillColor(255,255,255);
    doc.roundedRect(x,y,cellWidth-1,cellHeight-1,2,2,'FD');

    doc.setTextColor(23,63,50);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.text(String(day),x+3,y+5);

    const date=[
      year,
      String(month).padStart(2,'0'),
      String(day).padStart(2,'0')
    ].join('-');

    const dayEvents=eventMap[date]||[];
    let textY=y+11;

    doc.setFontSize(7.3);

    for(const event of dayEvents.slice(0,4)){
      const label=event.type==='game'
        ? `${event.time||''} ${coachGameLabel(event)}`
        : `${event.time||''} ${event.title||'Training'}`;

      const lines=doc.splitTextToSize(safePdfText(label),cellWidth-6);

      doc.setFillColor(
        event.type==='game'?238:229,
        event.type==='game'?241:240,
        event.type==='game'?242:235
      );
      doc.roundedRect(x+2,textY-3,cellWidth-5,Math.max(6,lines.length*3.3+2),1.5,1.5,'F');

      doc.setTextColor(event.type==='game'?47:23,event.type==='game'?52:63,event.type==='game'?55:50);
      doc.setFont('helvetica','normal');
      doc.text(lines,x+4,textY);
      textY+=Math.max(7,lines.length*3.3+3);

      if(textY>y+cellHeight-4)break;
    }
  }

  doc.save(
    `${coachCalendarType==='training'?'Trainingsplan':'Spielplan'}_${coachCalendarMonth}.pdf`
  );
}

function renderEvents(){
 listTitle.textContent=labels[currentType].plural;
 const list=eventList,sorted=data.events.filter(e=>e.type===currentType).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

 const calendarToolbar=currentType==='training'||currentType==='game'
   ? `<div class="row" style="margin:0 0 12px">
        <button class="btn primary"
                onclick="openCoachCalendar('${currentType}')">
          📅 Kalenderansicht
        </button>
        <button class="btn soft"
                onclick="openCalendarSubscriptionDialog('${currentType}')">
          🔄 ${currentType==='training'?'Trainings':'Spiele'} abonnieren
        </button>
        <button class="btn soft"
                onclick="copyCalendarLink('${currentType}')">
          🔗 Link kopieren
        </button>
      </div>`
   : '';

 list.innerHTML=calendarToolbar+
   (sorted.length?'':'<p class="muted">Noch keine Termine vorhanden.</p>');
 for(const e of sorted){const a=data.attendance[e.id]||{},present=data.players.filter(p=>a[p.id]==='present').length,absent=data.players.filter(p=>a[p.id]==='absent').length;const div=document.createElement('div');div.className='event '+(selectedId===e.id?'active':'');div.onclick=()=>selectEvent(e.id);div.innerHTML=`<div class="date">${labels[e.type].icon} ${fmtDate(e.date)} · ${e.time}</div><small>${e.type==='game'
  ? `${gameOpponent(e)} · ${gameHomeAwayLabel(e)} · `
  : (e.title?e.title+' · ':'')}${present} dabei · ${absent} nicht dabei</small><button class="btn danger" style="float:right;margin-top:-34px;padding:6px 8px" onclick="event.stopPropagation();deleteEvent('${e.id}')">Löschen</button>`;list.appendChild(div)}
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
      ${e.type==='training'?`<button class="btn primary" onclick="openEventSeriesEditor('${e.id}')">Training/Serie bearbeiten</button>`:''}
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


function eventWeekday(event){
  return new Date(event.date+'T12:00:00').getDay();
}

function seriesCandidatesForEvent(event){
  const weekday=event.seriesWeekday??eventWeekday(event);

  if(event.seriesId){
    return data.events.filter(item=>
      item.type==='training' &&
      item.seriesId===event.seriesId &&
      (item.seriesWeekday??eventWeekday(item))===weekday
    );
  }

  return data.events.filter(item=>
    item.type==='training' &&
    (item.seriesWeekday??eventWeekday(item))===weekday &&
    (item.time||'')===(event.time||'') &&
    (item.title||'')===(event.title||'')
  );
}

function openEventSeriesEditor(eventId){
  const event=data.events.find(item=>item.id===eventId);
  if(!event||event.type!=='training')return;

  const candidates=seriesCandidatesForEvent(event)
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const hasSeries=candidates.length>1;
  const weekdayName=new Intl.DateTimeFormat('de-CH',{weekday:'long'})
    .format(new Date(event.date+'T12:00:00'));

  openModal(`
    <h2>${weekdayName}-Training bearbeiten</h2>
    <div class="stack">
      <div class="field">
        <label>Datum</label>
        <input id="editEventDate" type="date" value="${event.date||''}">
      </div>

      <div class="field">
        <label>Uhrzeit</label>
        <input id="editEventTime" type="time" value="${event.time||''}">
      </div>

      <div class="field">
        <label>Titel / Bezeichnung</label>
        <input id="editEventTitle" value="${event.title||''}" placeholder="Optional">
      </div>

      <div class="field">
        <label>Änderung anwenden auf</label>
        <select id="editEventScope">
          <option value="single">Nur dieses Training</option>
          ${hasSeries?`
            <option value="future">Dieses und alle zukünftigen ${weekdayName}-Trainings</option>
            <option value="all">Alle ${weekdayName}-Trainings (${candidates.length})</option>
          `:''}
        </select>
      </div>

      ${hasSeries?`
        <p class="muted">
          Bei «dieses und alle zukünftigen Trainings» werden alle Termine ab
          ${fmtDate(event.date)} angepasst. Das Datum selbst wird nur bei
          «Nur dieses Training» geändert.
        </p>
      `:''}

      <div class="row">
        <button class="btn primary" onclick="saveEventSeriesEdit('${eventId}')">
          Änderungen speichern
        </button>
        <button class="btn danger" onclick="deleteEventSeries('${eventId}')">
          Training/Serie löschen
        </button>
      </div>
    </div>
  `);
}

function saveEventSeriesEdit(eventId){
  const event=data.events.find(item=>item.id===eventId);
  if(!event)return;

  const newDate=document.getElementById('editEventDate')?.value||event.date;
  const newTime=document.getElementById('editEventTime')?.value||event.time;
  const newTitle=document.getElementById('editEventTitle')?.value.trim()||'';
  const scope=document.getElementById('editEventScope')?.value||'single';

  let targets=[event];

  if(scope!=='single'){
    const candidates=seriesCandidatesForEvent(event);
    targets=scope==='future'
      ? candidates.filter(item=>item.date>=event.date)
      : candidates;
  }

  const sharedSeriesId=event.seriesId||('series_'+event.id);

  for(const item of targets){
    item.time=newTime;
    item.title=newTitle;

    if(scope==='single'){
      item.date=newDate;
    }

    if(targets.length>1&&!item.seriesId){
      item.seriesId=sharedSeriesId;
    }

    item.seriesWeekday=event.seriesWeekday??eventWeekday(event);
    applyAbsencesToEvent(item);
  }

  closeModal();
  save();

  alert(
    targets.length===1
      ? 'Das Training wurde aktualisiert.'
      : `${targets.length} Trainings wurden aktualisiert.`
  );
}

function deleteEventSeries(eventId){
  const event=data.events.find(item=>item.id===eventId);
  if(!event)return;

  const scope=document.getElementById('editEventScope')?.value||'single';
  let targets=[event];

  if(scope!=='single'){
    const candidates=seriesCandidatesForEvent(event);
    targets=scope==='future'
      ? candidates.filter(item=>item.date>=event.date)
      : candidates;
  }

  const message=targets.length===1
    ? 'Dieses Training wirklich löschen?'
    : `${targets.length} Trainings wirklich löschen?`;

  if(!confirm(message))return;

  const ids=new Set(targets.map(item=>item.id));

  data.events=data.events.filter(item=>!ids.has(item.id));

  for(const id of ids){
    delete data.attendance[id];
    delete data.lineups[id];
    delete data.boards[id];
  }

  if(ids.has(selectedId)){
    selectedId=null;
  }

  closeModal();
  save();
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
     <input type="email" value="${p.email||''}" placeholder="E-Mail-Adresse" onchange="updatePlayerEmail('${p.id}',this.value)">
     <button class="btn soft" onclick="openPlayerAbsences('${p.id}')">Abwesenheiten</button><button class="btn soft" onclick="createPlayerAccessWithPassword('${p.id}')">Zugang erstellen</button>
     <button class="btn danger" onclick="deletePlayer('${p.id}')">Löschen</button>
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
    cloudRoot.teams.third.absences ||= [];
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
  cloudPollTimer=setInterval(async()=>{await loadCloudState();await syncPlayerStatusesIntoCoachView();},5000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&cloudUser)loadCloudState();
  });
}


let currentPlayerProfile=null;
let currentPlayerSchedule=null;

async function getCurrentPlayerProfile(){
  const {data,error}=await cloudClient
    .from('player_profiles')
    .select('id,club_id,team_key,player_ref,display_name,email')
    .eq('auth_user_id',cloudUser.id)
    .maybeSingle();

  if(error){
    console.warn(error);
    return null;
  }
  return data||null;
}




function calendarSubscriptionUrl(teamKey,type){
  const url=new URL(CALENDAR_FUNCTION_URL);
  url.searchParams.set('clubId',SHARED_CLUB_ID);
  url.searchParams.set('teamKey',teamKey);
  url.searchParams.set('type',type);
  return url.toString();
}

function webcalUrl(httpsUrl){
  return httpsUrl.replace(/^https:/i,'webcal:');
}

async function copyCalendarLink(type){
  const teamKey=activeTeamKey||currentPlayerProfile?.team_key;
  if(!teamKey)return;

  const url=calendarSubscriptionUrl(teamKey,type);

  try{
    await navigator.clipboard.writeText(url);
    alert(
      `${type==='training'?'Trainings':'Spiel'}-Kalenderlink wurde kopiert.\n\n`+
      'Diesen Link kannst du an Spieler, Staff oder Eltern weitergeben.'
    );
  }catch(_error){
    prompt('Kalenderlink kopieren:',url);
  }
}


function detectedCalendarDevice(){
  const ua=navigator.userAgent||'';
  const platform=navigator.platform||'';
  const touchMac=
    platform==='MacIntel'&&navigator.maxTouchPoints>1;

  if(/iPhone|iPad|iPod/i.test(ua)||touchMac){
    return 'apple';
  }

  if(/Android/i.test(ua)){
    return 'google';
  }

  if(/Macintosh|Mac OS X/i.test(ua)){
    return 'apple';
  }

  if(/Windows/i.test(ua)){
    return 'outlook';
  }

  return 'unknown';
}

async function addCalendarToDetectedDevice(type,teamKeyOverride=''){
  const teamKey=teamKeyOverride||activeTeamKey||currentPlayerProfile?.team_key;
  if(!teamKey)return;

  const httpsUrl=calendarSubscriptionUrl(teamKey,type);
  const device=detectedCalendarDevice();
  const calendarName=type==='training'?'Trainingskalender':'Spielkalender';

  if(device==='apple'){
    window.location.href=webcalUrl(httpsUrl);
    return;
  }

  if(device==='google'){
    try{
      await navigator.clipboard.writeText(httpsUrl);
    }catch(_error){}

    openModal(`
      <h2>${calendarName} in Google Kalender abonnieren</h2>
      <div class="stack">
        <p>
          Der Live-Kalenderlink wurde nach Möglichkeit kopiert.
          Google Kalender erlaubt das Abonnieren einer URL am zuverlässigsten
          über die Webversion.
        </p>

        <ol style="line-height:1.7;padding-left:22px">
          <li>Google Kalender im Browser öffnen.</li>
          <li>Bei «Weitere Kalender» auf das Plus klicken.</li>
          <li>«Per URL» auswählen.</li>
          <li>Diesen Link einfügen:</li>
        </ol>

        <input value="${httpsUrl}" readonly onclick="this.select()">

        <div class="row">
          <button class="btn primary" onclick="copyCalendarLink('${type}')">
            Link kopieren
          </button>
          <a class="btn soft"
             style="text-decoration:none"
             href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
             target="_blank"
             rel="noopener">
            Google Kalender öffnen
          </a>
        </div>
      </div>
    `);
    return;
  }

  if(device==='outlook'){
    openModal(`
      <h2>${calendarName} in Outlook abonnieren</h2>
      <div class="stack">
        <p>
          Wähle «Outlook öffnen». Falls Windows stattdessen eine Datei lädt,
          kopiere den Live-Link und füge ihn in Outlook unter
          «Kalender hinzufügen → Aus dem Web abonnieren» ein.
        </p>

        <a class="btn primary"
           style="text-decoration:none;text-align:center"
           href="${webcalUrl(httpsUrl)}">
          Outlook / Kalender-App öffnen
        </a>

        <button class="btn soft" onclick="copyCalendarLink('${type}')">
          Live-Link kopieren
        </button>

        <input value="${httpsUrl}" readonly onclick="this.select()">

        <div class="muted">
          Das ist ein Abonnement. Änderungen in der Hockey-App werden später
          automatisch über denselben Link geladen.
        </div>
      </div>
    `);
    return;
  }

  openCalendarSubscriptionDialog(type,teamKey);
}

function addCurrentPlayerCalendarToDevice(){
  addCalendarToDetectedDevice(
    playerPortalType,
    currentPlayerProfile?.team_key||''
  );
}

function openCalendarSubscriptionDialog(type,teamKeyOverride=''){
  const teamKey=teamKeyOverride||activeTeamKey||currentPlayerProfile?.team_key;
  if(!teamKey)return;

  const httpsUrl=calendarSubscriptionUrl(teamKey,type);
  const webcal=webcalUrl(httpsUrl);
  const googleUrl=
    'https://calendar.google.com/calendar/render?cid='+
    encodeURIComponent(httpsUrl);

  const title=type==='training'?'Trainingskalender':'Spielkalender';

  openModal(`
    <h2>${title} abonnieren</h2>
    <div class="stack">
      <p>
        Wähle ein echtes Kalender-Abonnement. Der Kalender muss nur einmal
        hinzugefügt werden; spätere Änderungen werden über denselben Live-Link
        aktualisiert.
      </p>

      <a class="btn primary"
         style="text-decoration:none;text-align:center"
         href="${webcal}">
        🍎 Apple Kalender / Outlook öffnen
      </a>

      <a class="btn soft"
         style="text-decoration:none;text-align:center"
         href="${googleUrl}"
         target="_blank"
         rel="noopener">
        🟦 In Google Kalender abonnieren
      </a>

      <button class="btn soft" onclick="copyCalendarLink('${type}')">
        🔗 Kalenderlink kopieren
      </button>

      <a class="btn ghost"
         style="text-decoration:none;text-align:center"
         href="${httpsUrl}"
         target="_blank"
         rel="noopener">
        📥 Einmalige ICS-Datei öffnen
      </a>

      <div class="muted">
        Hinweis: Kalender-Apps prüfen Änderungen in eigenen Intervallen.
        Eine Aktualisierung kann deshalb etwas verzögert erscheinen.
      </div>
    </div>
  `);
}
function escapeIcsText(value){
  return String(value??'')
    .replace(/\\/g,'\\\\')
    .replace(/\r?\n/g,'\\n')
    .replace(/,/g,'\\,')
    .replace(/;/g,'\\;');
}

function localDateTimeToIcs(date,time){
  return `${date.replaceAll('-','')}T${(time||'00:00').replace(':','')}00`;
}

function addMinutesToLocalDateTime(date,time,minutes){
  const dt=new Date(`${date}T${time||'00:00'}:00`);
  dt.setMinutes(dt.getMinutes()+minutes);

  return [
    dt.getFullYear(),
    String(dt.getMonth()+1).padStart(2,'0'),
    String(dt.getDate()).padStart(2,'0')
  ].join('')+'T'+[
    String(dt.getHours()).padStart(2,'0'),
    String(dt.getMinutes()).padStart(2,'0'),
    '00'
  ].join('');
}

function gameOpponent(event){
  return event.opponent||event.title||'Gegner noch offen';
}

function gameHomeAwayLabel(event){
  if(event.homeAway==='home')return 'Heim';
  if(event.homeAway==='away')return 'Auswärts';
  return 'Heim/Auswärts offen';
}

function calendarEventSummary(event){
  if(event.type==='training'){
    return `Training ${teamDisplayName()}`;
  }

  if(event.type==='game'){
    const opponent=gameOpponent(event);
    return event.homeAway==='away'
      ? `Auswärtsspiel bei ${opponent}`
      : event.homeAway==='home'
        ? `Heimspiel gegen ${opponent}`
        : `Spiel gegen ${opponent}`;
  }

  return event.title||'Trainingslager';
}

function calendarEventDescription(event){
  if(event.type==='training'){
    return `${teamDisplayName()} – Training`;
  }

  if(event.type==='game'){
    return [
      `${teamDisplayName()} – ${gameHomeAwayLabel(event)}`,
      `Gegner: ${gameOpponent(event)}`
    ].join('\\n');
  }

  return event.title||'Trainingslager';
}

function buildCalendarFile(events,calendarName){
  const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\\.\\d{3}Z$/,'Z');
  const lines=[
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SC Altstadt//Hockey Coach//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`
  ];

  for(const event of events){
    const duration=event.type==='game'?150:event.type==='training'?90:240;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcsText(event.id)}@sc-altstadt`,
      `DTSTAMP:${now}`,
      `DTSTART:${localDateTimeToIcs(event.date,event.time)}`,
      `DTEND:${addMinutesToLocalDateTime(event.date,event.time,duration)}`,
      `SUMMARY:${escapeIcsText(calendarEventSummary(event))}`,
      `DESCRIPTION:${escapeIcsText(calendarEventDescription(event))}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\\r\\n');
}

function downloadPlayerCalendar(type){
  const events=(currentPlayerSchedule?.events||[])
    .filter(event=>event.type===type)
    .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));

  if(!events.length){
    alert(type==='training'
      ? 'Es sind keine Trainings zum Exportieren vorhanden.'
      : 'Es sind keine Spiele zum Exportieren vorhanden.'
    );
    return;
  }

  const calendarName=type==='training'
    ? `${TEAM_NAMES[currentPlayerProfile?.team_key]||'SC Altstadt'} Trainings`
    : `${TEAM_NAMES[currentPlayerProfile?.team_key]||'SC Altstadt'} Spiele`;

  const file=buildCalendarFile(events,calendarName);
  const blob=new Blob([file],{type:'text/calendar;charset=utf-8'});
  const link=document.createElement('a');

  link.href=URL.createObjectURL(blob);
  link.download=type==='training'
    ? 'SC_Altstadt_Trainingsplan.ics'
    : 'SC_Altstadt_Spielplan.ics';

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}



function ensurePlayerPortalTheme(){
  let style=document.getElementById('playerPortalAltstadtTheme');

  if(!style){
    style=document.createElement('style');
    style.id='playerPortalAltstadtTheme';
    document.head.appendChild(style);
  }

  style.textContent=`
    :root{
      --altstadt-green:#173f32;
      --altstadt-green-2:#245744;
      --altstadt-green-soft:#e5f0eb;
      --altstadt-charcoal:#2f3437;
      --altstadt-white:#ffffff;
      --altstadt-ice:#f5f8f7;
      --altstadt-line:#d8e3de;
      --altstadt-text:#25302c;
      --altstadt-muted:#6e7974;
      --altstadt-shadow:0 16px 40px rgba(23,63,50,.10);
    }

    #playerPilotApp.player-portal{
      max-width:1500px;
      margin:0 auto;
      padding:22px;
      min-height:100vh;
      color:var(--altstadt-text);
      background:
        radial-gradient(circle at 10% 0%,rgba(36,87,68,.08),transparent 28%),
        radial-gradient(circle at 100% 10%,rgba(23,63,50,.05),transparent 25%),
        linear-gradient(180deg,#f4f8f6 0%,#fbfcfc 100%);
    }

    #playerPilotApp.player-portal::before{
      content:"";
      position:fixed;
      inset:0;
      pointer-events:none;
      opacity:.18;
      background-image:
        linear-gradient(120deg,transparent 0 48%,rgba(255,255,255,.75) 49% 51%,transparent 52%),
        linear-gradient(60deg,transparent 0 48%,rgba(23,63,50,.025) 49% 51%,transparent 52%);
      background-size:90px 90px;
    }

    #playerPilotApp .player-portal-card{
      border:1px solid rgba(23,63,50,.08);
      border-radius:24px;
      background:rgba(255,255,255,.97);
      box-shadow:var(--altstadt-shadow);
      padding:22px;
      margin-bottom:18px;
      overflow:hidden;
      position:relative;
      z-index:1;
    }

    #playerPilotApp .player-portal-card::before{
      content:"";
      position:absolute;
      inset:0 auto 0 0;
      width:5px;
      background:linear-gradient(180deg,var(--altstadt-green-2),var(--altstadt-green));
    }

    #playerPilotApp .player-portal-head{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:18px;
      flex-wrap:wrap;
    }

    #playerPilotApp h2,
    #playerPilotApp h3{
      color:var(--altstadt-green);
      letter-spacing:-.025em;
    }

    #playerPilotApp .muted{
      color:var(--altstadt-muted);
    }

    #playerPilotApp .player-role-badge{
      background:var(--altstadt-charcoal);
      color:#fff;
      border-radius:999px;
      padding:7px 12px;
      font-weight:800;
      font-size:12px;
      letter-spacing:.02em;
    }

    #playerPilotApp .btn{
      border-radius:13px;
      min-height:44px;
      font-weight:800;
      transition:
        transform .16s ease,
        box-shadow .16s ease,
        background .16s ease,
        border-color .16s ease;
    }

    #playerPilotApp .btn:hover{
      transform:translateY(-1px);
      box-shadow:0 9px 20px rgba(23,63,50,.13);
    }

    #playerPilotApp .btn.primary{
      background:linear-gradient(135deg,var(--altstadt-green-2),var(--altstadt-green));
      border-color:var(--altstadt-green);
      color:#fff;
    }

    #playerPilotApp .btn.soft{
      background:#fff;
      color:var(--altstadt-green);
      border:1px solid var(--altstadt-line);
    }

    #playerPilotApp .btn.ghost{
      background:var(--altstadt-green-soft);
      color:var(--altstadt-green);
      border:1px solid transparent;
    }

    #playerPilotApp .btn.danger{
      background:#b52a31;
      color:#fff;
      border-color:#b52a31;
    }

    #playerPilotApp #playerPortalTrainingBtn,
    #playerPilotApp #playerPortalGameBtn{
      min-height:56px;
      font-size:15px;
    }

    #playerPilotApp #playerPortalTrainingBtn.primary,
    #playerPilotApp #playerPortalGameBtn.primary{
      position:relative;
    }

    #playerPilotApp #playerPortalTrainingBtn.primary::after,
    #playerPilotApp #playerPortalGameBtn.primary::after{
      content:"";
      position:absolute;
      left:20px;
      right:20px;
      bottom:7px;
      height:3px;
      background:#fff;
      opacity:.72;
      border-radius:999px;
    }

    #playerPilotApp #playerPortalCalendar{
      border-radius:20px;
      padding:12px;
      background:
        linear-gradient(180deg,#f9fbfa,#eef4f1);
      border:1px solid var(--altstadt-line);
    }

    #playerPilotApp #playerPortalCalendar button{
      transition:transform .14s ease,box-shadow .14s ease;
    }

    #playerPilotApp #playerPortalCalendar button:hover{
      transform:translateY(-1px);
      box-shadow:0 7px 16px rgba(23,63,50,.10);
    }

    #playerPilotApp .player-email{
      color:#dce7e2;
      font-weight:700;
      font-size:12px;
      margin-top:2px;
    }

    #playerPilotApp img[alt="Teamlogo"]{
      width:132px !important;
      height:132px !important;
      padding:8px !important;
      border-radius:24px !important;
      box-shadow:0 16px 34px rgba(0,0,0,.16) !important;
      background:#fff !important;
      border:1px solid rgba(255,255,255,.45) !important;
    }

    #playerPilotApp .player-portal-card[style*="linear-gradient"]{
      background:
        linear-gradient(135deg,#173f32 0%,#245744 100%) !important;
    }

    #playerPilotApp .player-portal-card[style*="linear-gradient"]::after{
      content:"SC ALTSTADT OLTEN";
      position:absolute;
      right:24px;
      bottom:18px;
      font-size:11px;
      font-weight:900;
      letter-spacing:.16em;
      color:rgba(255,255,255,.18);
    }


    header,
    .topbar,
    .app-header{
      background:
        linear-gradient(135deg,#173f32 0%,#245744 100%) !important;
      color:#fff !important;
      border-bottom:1px solid rgba(255,255,255,.12) !important;
      box-shadow:0 10px 28px rgba(23,63,50,.18) !important;
    }

    header .brand,
    header .header-brand,
    .topbar .brand,
    .app-header .brand{
      display:flex;
      align-items:center;
      gap:12px;
    }

    #headerTeamLogo{
      width:54px !important;
      height:54px !important;
      border-radius:14px !important;
      object-fit:contain !important;
      background:#fff !important;
      padding:4px !important;
      border:1px solid rgba(255,255,255,.45) !important;
      box-shadow:0 8px 18px rgba(0,0,0,.18) !important;
    }

    #activeTeamLabel{
      color:#fff !important;
      font-weight:800 !important;
      letter-spacing:-.01em;
    }

    #cloudStatus{
      background:rgba(255,255,255,.12) !important;
      color:#fff !important;
      border:1px solid rgba(255,255,255,.22) !important;
      border-radius:999px !important;
      padding:7px 11px !important;
      font-weight:800 !important;
    }

    #cloudStatus.ok{
      background:rgba(255,255,255,.14) !important;
      color:#fff !important;
    }

    #cloudStatus.error{
      background:#b52a31 !important;
      color:#fff !important;
      border-color:#b52a31 !important;
    }

    #cloudStatus.syncing{
      background:rgba(255,255,255,.10) !important;
      color:#fff !important;
    }

    header .btn,
    .topbar .btn,
    .app-header .btn{
      background:rgba(255,255,255,.10) !important;
      color:#fff !important;
      border:1px solid rgba(255,255,255,.24) !important;
      border-radius:11px !important;
      font-weight:800 !important;
    }

    header .btn:hover,
    .topbar .btn:hover,
    .app-header .btn:hover{
      background:rgba(255,255,255,.18) !important;
      transform:translateY(-1px);
    }

    #logoutBtn{
      background:#fff !important;
      color:#173f32 !important;
      border-color:#fff !important;
    }

    #logoutBtn:hover{
      background:#edf4f1 !important;
    }


    @media(max-width:720px){
      #playerPilotApp.player-portal{
        padding:12px;
      }

      #playerPilotApp .player-portal-card{
        border-radius:19px;
        padding:16px;
      }

      #playerPilotApp .player-portal-head{
        align-items:flex-start;
      }

      #playerPilotApp img[alt="Teamlogo"]{
        width:104px !important;
        height:104px !important;
      }

      #playerPilotApp #playerPortalCalendar{
        overflow-x:auto;
      }
    }
  `;
}


function openCalendarHelp(){
  openModal(`
    <h2>Hilfe zum Kalenderexport</h2>

    <div class="stack">
      <div style="
        padding:12px;
        border-radius:12px;
        background:#f4f8fc;
        border:1px solid var(--line);
      ">
        <strong>Was ist der Mehrwert?</strong>
        <p style="margin-bottom:0">
          Du kannst Trainings und Spiele zusätzlich in deinem privaten Kalender
          anzeigen lassen. So siehst du die Termine zusammen mit Arbeit,
          Familie und anderen persönlichen Terminen.
        </p>
      </div>

      <div>
        <h3 style="margin-bottom:5px">1. Einmaliger Download</h3>
        <p class="muted">
          Beim ICS-Download wird der aktuelle Trainings- oder Spielplan einmalig
          übernommen. Spätere Änderungen werden dabei nicht automatisch aktualisiert.
        </p>
      </div>

      <div>
        <h3 style="margin-bottom:5px">2. Live-Kalender abonnieren</h3>
        <p class="muted">
          Bei einem Abonnement bleibt derselbe Kalenderlink gespeichert.
          Neue Termine und spätere Änderungen können dadurch automatisch
          in deinem privaten Kalender erscheinen.
        </p>
      </div>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
        gap:10px;
      ">
        <div style="padding:12px;border:1px solid var(--line);border-radius:12px">
          <strong>🍎 iPhone / iPad</strong>
          <p class="muted" style="margin-bottom:0">
            Kalender abonnieren antippen und anschliessend in Apple Kalender
            auf «Abonnieren» bestätigen.
          </p>
        </div>

        <div style="padding:12px;border:1px solid var(--line);border-radius:12px">
          <strong>🤖 Android / Google</strong>
          <p class="muted" style="margin-bottom:0">
            Den Live-Link kopieren und in Google Kalender über
            «Weitere Kalender → Per URL» hinzufügen.
          </p>
        </div>

        <div style="padding:12px;border:1px solid var(--line);border-radius:12px">
          <strong>💻 Windows / Outlook</strong>
          <p class="muted" style="margin-bottom:0">
            In Outlook «Kalender hinzufügen → Aus dem Web abonnieren»
            wählen und den Live-Link einfügen.
          </p>
        </div>
      </div>

      <div style="
        padding:12px;
        border-radius:12px;
        background:#fff8e6;
        border:1px solid #ead59b;
      ">
        <strong>Wichtig</strong>
        <p style="margin-bottom:0">
          Kalender-Apps aktualisieren externe Abos in eigenen Intervallen.
          Änderungen können deshalb mit etwas Verzögerung erscheinen.
        </p>
      </div>

      <button class="btn primary" onclick="closeModal()">Verstanden</button>
    </div>
  `);
}

function playerPortalEventStatus(eventId){
  return currentPlayerSchedule?.statuses?.[eventId]||'present';
}

function playerPortalEventReason(eventId){
  return currentPlayerSchedule?.reasons?.[eventId]||'';
}

function playerPortalStatusPresentation(status){
  if(status==='present'){
    return {label:'Dabei',background:'#e8f7ee',color:'#13733f',border:'#7ac99b'};
  }

  if(status==='absent'){
    return {label:'Nicht dabei',background:'#fdeaea',color:'#a12727',border:'#e59a9a'};
  }

  return {label:'Unsicher',background:'#fff4cc',color:'#8a6500',border:'#e2c65f'};
}

let playerPortalType='training';
let playerPortalMonth=new Date().toISOString().slice(0,7);

async function loadPlayerPortal(){
  ensurePlayerPortalTheme();
  const app=document.getElementById('playerPilotApp');
  const coach=document.getElementById('coachModeApp');

  coach.classList.add('hidden');
  app.classList.remove('hidden');
  app.className='player-portal';

  document.getElementById('teamScreen')?.classList.add('hidden');
  document.getElementById('teamSwitchBtn').style.display='none';
  document.getElementById('settingsBtn').style.display='none';

  const {data:payload,error}=await cloudClient.rpc('get_my_player_schedule');

  if(error){
    app.innerHTML=`
      <div class="player-portal-card">
        <h2>Spielerportal</h2>
        <p class="danger">Daten konnten nicht geladen werden: ${error.message}</p>
      </div>`;
    return;
  }

  currentPlayerSchedule=payload;

  const profile=payload?.profile||currentPlayerProfile;
  const events=(payload?.events||[]).sort((a,b)=>
    (a.date+(a.time||'')).localeCompare(b.date+(b.time||''))
  );

  const teamName=TEAM_NAMES[profile.team_key]||'SC Altstadt';
  const teamLogo=profile.team_key==='second'
    ? (cloudRoot.teams?.second?.settings?.logo||defaultLogoData('2'))
    : (cloudRoot.teams?.third?.settings?.logo||defaultLogoData('3'));

  document.getElementById('activeTeamLabel').textContent=
    `${teamName} · Spielerportal`;

  const headerLogo=document.getElementById('headerTeamLogo');
  if(headerLogo)headerLogo.src=teamLogo;

  setCloudStatus('Synchronisiert','ok');

  const nextTraining=events.find(event=>event.type==='training')||null;
  const nextGame=events.find(event=>event.type==='game')||null;

  function dashboardCard(event,title,icon){
    if(!event){
      return `
        <div style="
          border:1px solid var(--line);
          border-radius:16px;
          padding:16px;
          background:#fff;
        ">
          <div style="font-size:22px">${icon}</div>
          <h3 style="margin:7px 0">${title}</h3>
          <div class="muted">Kein kommender Termin vorhanden.</div>
        </div>`;
    }

    const status=playerPortalEventStatus(event.id);
    const presentation=playerPortalStatusPresentation(status);
    const reason=playerPortalEventReason(event.id);

    return `
      <button
        onclick="openPlayerPortalEvent('${event.id}')"
        style="
          width:100%;
          text-align:left;
          border:1px solid var(--line);
          border-radius:16px;
          padding:16px;
          background:#fff;
          cursor:pointer;
          box-shadow:0 8px 24px rgba(16,36,63,.06);
        ">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <div>
            <div style="font-size:22px">${icon}</div>
            <h3 style="margin:7px 0 4px">${title}</h3>
            <strong>${fmtDate(event.date)} · ${event.time||''}</strong>
            ${event.title?`<div class="muted">${event.title}</div>`:''}
          </div>

          <span style="
            align-self:flex-start;
            padding:6px 10px;
            border-radius:999px;
            background:${presentation.background};
            color:${presentation.color};
            border:1px solid ${presentation.border};
            font-size:12px;
            font-weight:800;
            white-space:nowrap;
          ">
            ${presentation.label}
          </span>
        </div>

        ${reason?`
          <div style="
            margin-top:10px;
            padding:8px 10px;
            border-radius:10px;
            background:#fdeaea;
            color:#922;
            font-size:13px;
          ">
            <strong>Grund:</strong> ${reason}
          </div>
        `:''}
      </button>`;
  }

  app.innerHTML=`
    <div class="player-portal-card" style="
      background:
        linear-gradient(135deg,rgba(11,31,54,.98),rgba(21,58,99,.96));
      color:#fff;
      border:none;
    ">
      <div style="
        position:absolute;
        right:-40px;
        top:-60px;
        width:180px;
        height:180px;
        border-radius:50%;
        background:rgba(255,255,255,.10);
      "></div>
      <div class="player-portal-head" style="position:relative;z-index:1">
        <div style="display:flex;align-items:center;gap:12px">
          <img
            src="${teamLogo}"
            alt="Teamlogo"
            style="
              width:64px;
              height:64px;
              object-fit:contain;
              border-radius:16px;
              border:1px solid var(--line);
              background:#fff;
              padding:5px;
            ">
          <div>
            <h2 style="margin:0;color:#fff">Hallo ${profile.display_name} 👋</h2>
            <div style="color:rgba(255,255,255,.78)">${teamName}</div>
            <div class="player-email">${cloudUser.email||''}</div>
          </div>
        </div>

        <button class="btn soft" style="
          background:rgba(255,255,255,.13);
          color:#fff;
          border-color:rgba(255,255,255,.26);
        " onclick="openCalendarHelp()">
          ❓ Hilfe Kalenderexport
        </button>
      </div>
    </div>

    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
      gap:14px;
      margin-bottom:14px;
    ">
      ${dashboardCard(nextTraining,'Nächstes Training','🏒')}
      ${dashboardCard(nextGame,'Nächstes Spiel','🥅')}
    </div>

    <div class="player-portal-card">
      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
        margin-bottom:14px;
      ">
        <button
          id="playerPortalTrainingBtn"
          class="btn ${playerPortalType==='training'?'primary':'soft'}"
          onclick="setPlayerPortalType('training')">
          🏒 Trainings
        </button>

        <button
          id="playerPortalGameBtn"
          class="btn ${playerPortalType==='game'?'primary':'soft'}"
          onclick="setPlayerPortalType('game')">
          🥅 Spiele
        </button>
      </div>

      <div style="
        display:grid;
        grid-template-columns:1fr auto;
        gap:10px;
        margin-bottom:14px;
      ">
        <button
          id="playerPortalAutoCalendarBtn"
          class="btn primary"
          style="padding:13px;font-size:15px"
          onclick="addCurrentPlayerCalendarToDevice()">
          📲 ${playerPortalType==='training'
            ? 'Trainings zu meinem Kalender hinzufügen'
            : 'Spiele zu meinem Kalender hinzufügen'}
        </button>

        <button class="btn soft" onclick="openCalendarHelp()">
          Hilfe
        </button>
      </div>

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:8px;
        margin-bottom:12px;
      ">
        <button class="btn soft" onclick="changePlayerPortalMonth(-1)">‹</button>
        <h2 id="playerPortalMonthTitle" style="margin:0;text-align:center"></h2>
        <button class="btn soft" onclick="changePlayerPortalMonth(1)">›</button>
      </div>

      <div style="
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-bottom:12px;
        font-size:12px;
      ">
        <span style="padding:5px 9px;border-radius:999px;background:#e8f7ee;color:#13733f;font-weight:700">
          Grün = Dabei
        </span>
        <span style="padding:5px 9px;border-radius:999px;background:#fdeaea;color:#a12727;font-weight:700">
          Rot = Nicht dabei
        </span>
        <span style="padding:5px 9px;border-radius:999px;background:#fff4cc;color:#8a6500;font-weight:700">
          Gelb = Unsicher
        </span>
      </div>

      <div id="playerPortalCalendar"></div>
    </div>
  `;

  renderPlayerPortalCalendar();
}

function setPlayerPortalType(type){
  playerPortalType=type;
  document.getElementById('playerPortalTrainingBtn').className=
    'btn '+(type==='training'?'primary':'soft');
  document.getElementById('playerPortalGameBtn').className=
    'btn '+(type==='game'?'primary':'soft');

  const autoButton=document.getElementById('playerPortalAutoCalendarBtn');
  if(autoButton){
    autoButton.textContent=type==='training'
      ? '📲 Trainings zu meinem Kalender hinzufügen'
      : '📲 Spiele zu meinem Kalender hinzufügen';
  }

  renderPlayerPortalCalendar();
}

function changePlayerPortalMonth(offset){
  const [year,month]=playerPortalMonth.split('-').map(Number);
  const next=new Date(year,month-1+offset,1);
  playerPortalMonth=[
    next.getFullYear(),
    String(next.getMonth()+1).padStart(2,'0')
  ].join('-');
  renderPlayerPortalCalendar();
}

function playerPortalStatus(eventId){
  return currentPlayerSchedule?.statuses?.[eventId]||'present';
}

function playerPortalReason(eventId){
  return currentPlayerSchedule?.reasons?.[eventId]||'';
}

function playerPortalStatusStyle(status){
  if(status==='present'){
    return {
      background:'#e8f7ee',
      border:'#7ac99b',
      color:'#13733f',
      label:'Dabei'
    };
  }

  if(status==='absent'){
    return {
      background:'#fdeaea',
      border:'#e59a9a',
      color:'#a12727',
      label:'Nicht dabei'
    };
  }

  return {
    background:'#fff4cc',
    border:'#e2c65f',
    color:'#8a6500',
    label:'Unsicher'
  };
}

function renderPlayerPortalCalendar(){
  const target=document.getElementById('playerPortalCalendar');
  const title=document.getElementById('playerPortalMonthTitle');
  if(!target||!title||!currentPlayerSchedule)return;

  const [year,month]=playerPortalMonth.split('-').map(Number);
  const firstDay=new Date(year,month-1,1);
  const lastDay=new Date(year,month,0);

  title.textContent=new Intl.DateTimeFormat('de-CH',{
    month:'long',
    year:'numeric'
  }).format(firstDay);

  const events=(currentPlayerSchedule.events||[])
    .filter(event=>
      event.type===playerPortalType &&
      event.date.startsWith(playerPortalMonth)
    )
    .sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));

  const eventMap={};
  for(const event of events){
    eventMap[event.date] ||= [];
    eventMap[event.date].push(event);
  }

  const mondayIndex=(firstDay.getDay()+6)%7;
  const cells=[];

  for(let i=0;i<mondayIndex;i++){
    cells.push('<div style="min-height:92px;background:#f7f9fb;border-radius:10px"></div>');
  }

  for(let day=1;day<=lastDay.getDate();day++){
    const date=[
      year,
      String(month).padStart(2,'0'),
      String(day).padStart(2,'0')
    ].join('-');

    const dayEvents=eventMap[date]||[];

    const items=dayEvents.map(event=>{
      const status=playerPortalStatus(event.id);
      const style=playerPortalStatusStyle(status);
      const reason=playerPortalReason(event.id);

      return `
        <button
          onclick="openPlayerPortalEvent('${event.id}')"
          style="
            width:100%;
            text-align:left;
            border:1px solid ${style.border};
            background:${style.background};
            color:${style.color};
            border-radius:8px;
            padding:7px;
            margin-top:5px;
            font-size:11px;
            font-weight:750;
            cursor:pointer;
          ">
          <div>
            ${event.time||''}
            ${event.type==='game'
              ? ` · ${gameOpponent(event)} · ${gameHomeAwayLabel(event)}`
              : (event.title?' · '+event.title:'')}
          </div>
          <div style="font-size:10px;margin-top:2px">${style.label}</div>
          ${reason?`<div style="font-size:10px;margin-top:2px">Grund: ${reason}</div>`:''}
        </button>
      `;
    }).join('');

    cells.push(`
      <div style="
        min-height:92px;
        border:1px solid var(--line);
        border-radius:10px;
        padding:6px;
        background:#fff;
      ">
        <div style="font-weight:800;font-size:12px">${day}</div>
        ${items}
      </div>
    `);
  }

  target.innerHTML=`
    <div style="
      display:grid;
      grid-template-columns:repeat(7,minmax(0,1fr));
      gap:5px;
      font-size:11px;
      margin-bottom:6px;
      text-align:center;
      font-weight:750;
      color:#586579;
    ">
      <div>Mo</div>
      <div>Di</div>
      <div>Mi</div>
      <div>Do</div>
      <div>Fr</div>
      <div>Sa</div>
      <div>So</div>
    </div>

    <div style="
      display:grid;
      grid-template-columns:repeat(7,minmax(0,1fr));
      gap:5px;
      overflow-x:auto;
    ">
      ${cells.join('')}
    </div>

    ${events.length?'':`
      <p class="muted" style="margin-top:14px">
        In diesem Monat sind keine ${playerPortalType==='training'?'Trainings':'Spiele'} eingetragen.
      </p>
    `}
  `;
}

function openPlayerPortalEvent(eventId){
  const event=(currentPlayerSchedule?.events||[]).find(item=>item.id===eventId);
  if(!event)return;

  const status=playerPortalStatus(eventId);
  const reason=playerPortalReason(eventId);
  const typeLabel=event.type==='training'?'Training':'Spiel';

  openModal(`
    <h2>${typeLabel}</h2>
    <div class="stack">
      <div>
        <strong>${fmtDate(event.date)} · ${event.time||''}</strong>
        ${event.type==='game'
          ? `<div class="muted">Gegner: ${gameOpponent(event)} · ${gameHomeAwayLabel(event)}</div>`
          : (event.title?`<div class="muted">${event.title}</div>`:'')}
      </div>

      ${reason?`
        <div style="
          padding:10px;
          border-radius:10px;
          background:#fdeaea;
          color:#922;
        ">
          <strong>Abwesenheitsgrund:</strong> ${reason}
        </div>
      `:''}

      <div class="row">
        <button
          class="btn ${status==='present'?'success':'soft'}"
          onclick="requestOwnPlayerStatus('${event.id}','present')">
          Dabei
        </button>

        <button
          class="btn ${status==='absent'?'danger':'soft'}"
          onclick="requestOwnPlayerStatus('${event.id}','absent')">
          Nicht dabei
        </button>

        <button
          class="btn ${status==='open'?'on-unknown':'soft'}"
          onclick="requestOwnPlayerStatus('${event.id}','open')">
          Unsicher
        </button>
      </div>
    </div>
  `);
}

function requestOwnPlayerStatus(eventId,status){
  if(status!=='absent'){
    closeModal();
    saveOwnPlayerStatus(eventId,status,'');
    return;
  }

  const existingReason=playerPortalReason(eventId);

  openModal(`
    <h2>Nicht dabei</h2>
    <div class="stack">
      <p>Bitte gib den Grund für deine Abwesenheit an.</p>

      <div class="field">
        <label>Abwesenheitsgrund</label>
        <input
          id="ownAbsenceReason"
          value="${existingReason}"
          placeholder="z. B. Ferien, Arbeit, verletzt, krank">
      </div>

      <div class="row">
        <button class="btn danger" onclick="confirmOwnAbsence('${eventId}')">
          Nicht dabei speichern
        </button>
        <button class="btn ghost" onclick="closeModal()">
          Abbrechen
        </button>
      </div>
    </div>
  `);

  requestAnimationFrame(()=>{
    const input=document.getElementById('ownAbsenceReason');
    if(input){
      input.focus();
      input.select();
    }
  });
}

function confirmOwnAbsence(eventId){
  const reason=document.getElementById('ownAbsenceReason')?.value.trim()||'';

  if(!reason){
    alert('Bitte einen Abwesenheitsgrund eingeben.');
    return;
  }

  closeModal();
  saveOwnPlayerStatus(eventId,'absent',reason);
}


async function saveOwnPlayerStatus(eventId,status,reason=''){
  const {error}=await cloudClient.rpc('set_my_player_status',{
    target_event_id:eventId,
    new_status:status,
    absence_reason:status==='absent'?reason:null
  });

  if(error){
    alert('Status konnte nicht gespeichert werden: '+error.message);
    return;
  }

  await loadPlayerPortal();
}

async function syncPlayerStatusesIntoCoachView(){
  if(!cloudUser||currentPlayerProfile)return;

  const {data:rows,error}=await cloudClient
    .from('player_event_status')
    .select('event_id,status,player_profiles!inner(player_ref,team_key,club_id)')
    .eq('player_profiles.club_id',SHARED_CLUB_ID);

  if(error){
    console.warn(error);
    return;
  }

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

async function createOrUpdatePlayerLogin(playerId){
  if(!activeTeamKey)return;
  const player=data.players.find(p=>p.id===playerId);
  if(!player)return;

  const email=(player.email||'').trim().toLowerCase();
  if(!email){
    alert('Bitte beim Spieler zuerst eine E-Mail-Adresse eintragen.');
    return;
  }

  const {error}=await cloudClient.from('player_profiles').upsert({
    club_id:SHARED_CLUB_ID,
    team_key:activeTeamKey,
    player_ref:player.id,
    display_name:player.name,
    email
  },{onConflict:'club_id,email'});

  if(error){
    alert('Spielerzugang konnte nicht vorbereitet werden: '+error.message);
    return;
  }

  alert(
    'Spielerzugang vorbereitet. Lade diese E-Mail nun in Supabase Authentication ein:\n\n'+
    email
  );
}


async function readEdgeFunctionError(error,result){
  if(result?.error)return result.error;

  const response=error?.context;
  if(response){
    try{
      const payload=await response.clone().json();
      if(payload?.error)return payload.error;
      if(payload?.message)return payload.message;
    }catch(_jsonError){
      try{
        const text=await response.text();
        if(text)return text;
      }catch(_textError){}
    }
  }

  return error?.message||'Unbekannter Fehler';
}

async function createPlayerAccessWithPassword(playerId){
  const player=data.players.find(p=>p.id===playerId);
  if(!player)return;

  const email=(player.email||'').trim().toLowerCase();
  if(!email){
    alert('Bitte zuerst eine Spieler-E-Mail hinterlegen.');
    return;
  }

  const startPassword=prompt(
    `Startpasswort für ${player.name} (mindestens 8 Zeichen):`
  );
  if(!startPassword)return;

  if(startPassword.length<8){
    alert('Das Startpasswort muss mindestens 8 Zeichen lang sein.');
    return;
  }

  try{
    const {data:result,error}=await cloudClient.functions.invoke(
      'manage-player-user',
      {
        headers:{
          apikey:SUPABASE_PUBLISHABLE_KEY
        },
        body:{
          action:'create',
          clubId:SHARED_CLUB_ID,
          teamKey:activeTeamKey,
          playerRef:player.id,
          displayName:player.name,
          email,
          startPassword
        }
      }
    );

    if(error||!result?.ok){
      const message=await readEdgeFunctionError(error,result);
      alert('Zugang konnte nicht erstellt werden:\n\n'+message);
      return;
    }

    alert(
      `Zugang erstellt.\n\nE-Mail: ${email}\nStartpasswort: ${startPassword}`
    );
  }catch(error){
    alert(
      'Zugang konnte nicht erstellt werden:\n\n'+
      (error instanceof Error?error.message:String(error))
    );
  }
}

async function forceFirstPasswordChange(){
  if(cloudUser?.user_metadata?.force_password_change!==true)return false;
  const password=prompt('Bitte beim ersten Login ein neues Passwort mit mindestens 8 Zeichen festlegen:');
  if(!password)return true;
  if(password.length<8){alert('Mindestens 8 Zeichen.');return true;}
  const metadata={...(cloudUser.user_metadata||{}),force_password_change:false};
  const {data,error}=await cloudClient.auth.updateUser({password,data:metadata});
  if(error){alert(error.message);return true;}
  cloudUser=data.user;
  alert('Passwort wurde geändert.');
  return false;
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

  currentPlayerProfile=await getCurrentPlayerProfile();

  if(currentPlayerProfile){
    await loadPlayerPortal();
    cloudReady=true;
    clearInterval(cloudPollTimer);
    cloudPollTimer=setInterval(loadPlayerPortal,5000);
    return;
  }

  document.getElementById('coachModeApp').classList.remove('hidden');
  ensureCoachPortalTheme();
  document.getElementById('playerPilotApp').classList.add('hidden');
  await loadCloudState({initial:true});
  
  await syncPlayerStatusesIntoCoachView();
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


function hideAllMainViews(){
  document.querySelectorAll('.app-view').forEach(v=>v.classList.add('hidden'));
  const dashboard=document.getElementById('dashboardView');
  const availability=document.getElementById('availabilityView');
  if(dashboard)dashboard.classList.add('hidden');
  if(availability)availability.classList.add('hidden');
}

function upcomingEvents(type){
  const today=new Date().toISOString().slice(0,10);
  return (data.events||[])
    .filter(e=>e.type===type && e.date>=today)
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}

function availabilityCountsForEvent(event){
  const attendance=data.attendance?.[event.id]||{};
  const present=data.players.filter(p=>(attendance[p.id]||'present')==='present');
  return {
    total:present.length,
    forwards:present.filter(p=>p.position==='Stürmer').length,
    defenders:present.filter(p=>p.position==='Verteidiger').length,
    goalies:present.filter(p=>p.position==='Goalie').length
  };
}

function showDashboard(){
  if(!activeTeamKey)return;
  hideAllMainViews();
  const view=document.getElementById('dashboardView');
  view.classList.remove('hidden');

  const nextTraining=upcomingEvents('training')[0];
  const nextGame=upcomingEvents('game')[0];
  const currentEvent=nextTraining||nextGame;
  const counts=currentEvent?availabilityCountsForEvent(currentEvent):{total:0,forwards:0,defenders:0,goalies:0};

  const absenceItems=(data.absences||[])
    .filter(a=>a.end>=new Date().toISOString().slice(0,10))
    .sort((a,b)=>a.start.localeCompare(b.start))
    .slice(0,8);

  view.innerHTML=`<div class="dashboard-grid">
    <div class="dashboard-card">
      <h3>Nächstes Training</h3>
      ${nextTraining?`<strong>${fmtDate(nextTraining.date)}</strong><div class="muted">${nextTraining.time}${nextTraining.title?' · '+nextTraining.title:''}</div>`:'<div class="muted">Kein kommendes Training</div>'}
    </div>
    <div class="dashboard-card">
      <h3>Nächstes Spiel</h3>
      ${nextGame?`<strong>${fmtDate(nextGame.date)}</strong><div class="muted">${nextGame.time}${nextGame.title?' · '+nextGame.title:''}</div>`:'<div class="muted">Kein kommendes Spiel</div>'}
    </div>
    <div class="dashboard-card" style="grid-column:1/-1">
      <h3>Verfügbarkeit beim nächsten Termin</h3>
      <div class="dashboard-kpis">
        <div class="dashboard-kpi"><strong>${counts.total}</strong><span>Total</span></div>
        <div class="dashboard-kpi"><strong>${counts.forwards}</strong><span>Stürmer</span></div>
        <div class="dashboard-kpi"><strong>${counts.defenders}</strong><span>Verteidiger</span></div>
        <div class="dashboard-kpi"><strong>${counts.goalies}</strong><span>Goalies</span></div>
      </div>
    </div>
    <div class="dashboard-card" style="grid-column:1/-1">
      <h3>Kommende Abwesenheiten</h3>
      ${absenceItems.length?absenceItems.map(a=>{
        const p=data.players.find(x=>x.id===a.playerId);
        return `<div class="absence-item"><div><strong>${p?.name||'Unbekannt'}</strong><div class="absence-meta">${fmtDate(a.start)} bis ${fmtDate(a.end)}</div></div><span class="reason-pill">${a.reason}</span></div>`;
      }).join(''):'<div class="muted">Keine kommenden Abwesenheiten</div>'}
    </div>
  </div>`;
}

function showAvailability(){
  if(!activeTeamKey)return;
  hideAllMainViews();
  const view=document.getElementById('availabilityView');
  view.classList.remove('hidden');
  renderAvailabilityView();
}

function renderAvailabilityView(){
  const view=document.getElementById('availabilityView');
  if(!view)return;
  data.absences ||= [];

  const rows=[...data.absences]
    .sort((a,b)=>a.start.localeCompare(b.start))
    .map(a=>{
      const p=data.players.find(x=>x.id===a.playerId);
      return `<tr>
        <td>${p?.name||'Unbekannt'}</td>
        <td>${fmtDate(a.start)}</td>
        <td>${fmtDate(a.end)}</td>
        <td><span class="reason-pill">${a.reason}</span></td>
        <td><button class="btn danger" onclick="deleteAvailability('${a.id}')">Löschen</button></td>
      </tr>`;
    }).join('');

  view.innerHTML=`<div class="card">
    <div class="section-head">
      <div><h2>Verfügbarkeiten</h2><p>Abwesenheitszeiträume des gesamten Kaders</p></div>
    </div>
    <div class="availability-toolbar">
      <div class="field"><label>Spieler</label><select id="availabilityPlayer">${data.players.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
      <div class="field"><label>Von</label><input id="availabilityStart" type="date"></div>
      <div class="field"><label>Bis</label><input id="availabilityEnd" type="date"></div>
      <div class="field"><label>Grund</label><input id="availabilityReason" placeholder="Ferien, Arbeit, WK, verletzt …"></div>
      <button class="btn primary" onclick="addAvailability()">Hinzufügen</button>
    </div>
    ${rows?`<div style="overflow:auto"><table class="availability-table"><thead><tr><th>Spieler</th><th>Von</th><th>Bis</th><th>Grund</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="availability-empty">Noch keine Abwesenheiten eingetragen.</div>'}
  </div>`;
}

function addAvailability(){
  const playerId=document.getElementById('availabilityPlayer').value;
  const start=document.getElementById('availabilityStart').value;
  const end=document.getElementById('availabilityEnd').value;
  const reason=document.getElementById('availabilityReason').value.trim()||'Abwesend';
  if(!playerId||!start||!end)return alert('Bitte Spieler, Von und Bis ausfüllen.');
  if(end<start)return alert('Das Bis-Datum muss nach dem Von-Datum liegen.');

  data.absences ||= [];
  data.absences.push({id:'absence_'+crypto.randomUUID(),playerId,start,end,reason});
  applyAllAbsences();
  save();
  renderAvailabilityView();
}

function deleteAvailability(id){
  data.absences=(data.absences||[]).filter(a=>a.id!==id);
  recalculateAttendanceFromAbsences();
  save();
  renderAvailabilityView();
}

function renderAll(){if(!activeTeamKey)return;renderEvents();renderSelected();renderPlayers();renderStats();renderQuickPlanner()}
renderAll();
initCloud();
requestAnimationFrame(initializeSeriesDayTimes);
