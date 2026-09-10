// Local test harness: production renderers, event handlers and mutations, memory-only transport.
import * as mediaUI from './media-choice-ui.js';
import {workflowMarkup} from './task-progress-ui.js';
export function installMediaValidationFixture({document,window,source,clientSource,role='admin',afterRender=()=>{}}) {
  const profile={uid:`test-${role}`,role,displayLabel:role==='admin'?'Communications test':'Direction test'};
  const eventId='test-first',mediaId='test-photo-current';
  const row={id:mediaId,eventId,kind:'image',url:'https://example.org/photo.jpg',label:'Échantillonnage au Massawippi · proposition actuelle',previewUrl:'./media-previews/2026-09-10/s4d6-terrain-mesure-photo-reelle-v3-preview.webp',archived:false,publicationBlocked:true,rightsStatus:'Droits à confirmer'};
  const side=(actorRole,ids=[])=>({status:ids.length?'selected':'none',mediaIds:ids,actorUid:ids.length?'test-admin':'',actorLabel:ids.length?'Communications test':'',actorRole,decidedAt:ids.length?1:null});
  const decision={eventId,schemaVersion:2,communications:side('admin',[mediaId]),direction:side('director'),override:{active:false,mediaIds:[],reason:'',actorUid:'',actorLabel:'',actorRole:'',decidedAt:null},agreement:{status:'pending',mediaIds:[],divergent:false},textGateStage:'media_review',updatedBy:'test-admin',updatedByLabel:'Communications test',updatedAt:1,lastMutationId:'initial'};
  const state={profile,workflows:new Map([[eventId,{eventId,stage:'media_review'}]]),mediaByEvent:new Map([[eventId,[row,{...row,id:'test-photo-second',label:'Autre proposition interne'}]]]),mediaDecisions:new Map([[eventId,decision]]),commentsByEvent:new Map(),mediaContextLoading:new Set()};
  const card=document.querySelector(`[data-item-id="${eventId}"]`);
  card.querySelector('.cockpit-media').innerHTML='<summary>Médias <span data-media-count></span></summary><div class="cockpit-media-body"><p data-media-selection-note></p><div class="cockpit-media-gallery" data-media-gallery></div><div data-media-nav></div></div>';
  const workflow=card.querySelector('.cockpit-workflow');
  workflow.outerHTML=workflowMarkup({id:eventId});
  const events=[],archives=[],writes=[];
  const env={...mediaUI,document,window,state,queueMicrotask,crypto:globalThis.crypto,db:{},requireWritable:()=>{},recordConfirmedWrites:()=>{},doc:(_db,collection,id)=>`${collection}/${id || 'test-archive'}`,collection:(_db,name)=>name,serverTimestamp:()=>Date.now(),
    runTransaction:async(_db,run)=>{
      const pending=[];
      const result=await run({get:async ref=>{const [collection,id]=ref.split('/');const data=collection==='mediaLinks'?state.mediaByEvent.get(eventId).find(row=>row.id===id):collection==='workflowStates'?state.workflows.get(id):state.mediaDecisions.get(id);return {exists:()=>!!data,data:()=>data};},set:(ref,data)=>pending.push({ref,data})});
      for(const write of pending){writes.push(write);const [collection,id]=write.ref.split('/');if(collection==='mediaDecisions')state.mediaDecisions.set(id,write.data);else if(collection==='workflowStates')state.workflows.set(id,write.data);else archives.push(write.data);}
      rerender();return result;
    },
    activateEventContext:()=>{},getPlanItem:()=>({id:eventId,title:'La qualité de l’eau se suit sur le terrain',date:'Jeudi 10 septembre'}),stateTimestampMillis:()=>0,safeMediaUrl:v=>v,mediaPreviewUrl:row=>row.previewUrl,esc:mediaUI.escapeMarkup || (v=>String(v||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')),
    workflowTextApprovedStages:new Set(['content_approved','media_in_progress','media_review','media_changes_requested','final_approved','scheduled','published']),mediaKindIcons:{image:'Photo'},mediaStageLabels:{},canEdit:()=>true,setupMediaNavigation:()=>{},ripple:()=>{},responsibilitySummary:()=>'',recordActionTask:async()=>{},setPersonalActionItemState:async()=>{},toast:(message,error)=>{events.push({message,error});const status=document.querySelector('[data-test-result]');if(status)status.textContent=message;}
  };
  const part=(text,from,to)=>text.slice(text.indexOf(from),text.indexOf(to,text.indexOf(from))).replaceAll('export async function','async function').replaceAll('export function','function');
  const code=part(clientSource,'function changeArchiveEntry(','\nexport ')+'\n'+part(clientSource,'const workflowStages =','\nexport function subscribeWorkflowStates')+'\n'+part(clientSource,'const MAX_MEDIA_CHOICES','\nexport function subscribeMediaDecisions')+'\n'+part(source,'function renderMediaForCard(','\nfunction setupMediaNavigation(')+'\n'+part(source,'function renderWorkflow(','\nfunction renderCommentThread(')+'\n'+part(source,'function enhanceCardEvents(','\nfunction clearPrivateContent(');
  const actual=new Function(...Object.keys(env),code+'\nreturn {renderWorkflow,renderMediaForCard,enhanceCardEvents};')(...Object.values(env));
  function rerender(){actual.renderMediaForCard(card);actual.renderWorkflow(card);afterRender();}
  actual.enhanceCardEvents();rerender();
  return {state,card,events,writes,archives,rerender,eventId,mediaId};
}
