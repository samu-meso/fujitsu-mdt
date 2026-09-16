import {useEffect,useRef,useState} from 'react'
import {Bell,TriangleAlert,X,Send} from 'lucide-react'
import {usePortalAlerts} from './usePortalAlerts'
import {date} from './api'
import {useAlertSound} from './useAlertSound'

export default function PortalAlerts({userId}:{userId:string}){
  const {members,alerts,error,send,acknowledge}=usePortalAlerts(userId)
  const composer=useRef<HTMLDialogElement>(null),incoming=useRef<HTMLDialogElement>(null)
  const [recipient,setRecipient]=useState(''),[kind,setKind]=useState<'emergency'|'info'>('emergency'),[message,setMessage]=useState('')
  const [busy,setBusy]=useState(false),[sendError,setSendError]=useState(''),[ackError,setAckError]=useState(''),[notice,setNotice]=useState('')
  const alert=alerts[0]
  const {ready,unlock,preview}=useAlertSound(alert?.id,alert?.kind)
  useEffect(()=>{if(alert){if(!incoming.current?.open)incoming.current?.showModal()}else incoming.current?.close()},[alert])
  async function confirm(){
    if(!alert||busy)return
    setBusy(true);setAckError('')
    try{await acknowledge(alert.id)}catch(e){setAckError((e as Error).message)}finally{setBusy(false)}
  }
  return <div className="portal-alerts">
    <button className="button secondary portal-alert-button" onClick={()=>{setSendError('');setNotice('');composer.current?.showModal()}}><Bell size={16}/><span>Alert</span><i>{members.length}</i></button>
    <dialog ref={composer} className="detail-dialog alert-dialog" aria-label="Invia alert"><div className="alert-dialog-heading"><h2><Bell size={20}/>Invia un alert</h2><button className="icon-button" aria-label="Chiudi alert" onClick={()=>composer.current?.close()}><X size={20}/></button></div><p className="muted">{members.length} {members.length===1?'altro membro online':'altri membri online'} · GPS non necessario</p>
      {error&&<p className="error-banner" role="alert">{error}</p>}
      {notice&&<p className="alert-success" role="status">{notice}</p>}
      {!ready&&<button type="button" className="button secondary" data-sound-control onClick={()=>void unlock()}>Attiva suoni</button>}<p className="hint" role="status">{ready?'Suoni attivi':'Tocca Attiva suoni per abilitare i suoni'}</p><div className="alert-sound-tests"><button type="button" className="text-button" data-sound-control onClick={()=>void preview('info')}>Prova suono avviso</button><button type="button" className="text-button" data-sound-control onClick={()=>void preview('emergency')}>Prova suono emergenza</button></div>
      <form className="detail-form" onSubmit={async e=>{
        e.preventDefault();setBusy(true);setSendError('');setNotice('')
        try{await send(recipient,kind,message);setNotice('Alert inviato al destinatario.');setMessage('')}catch(e){setSendError((e as Error).message)}finally{setBusy(false)}
      }}><label>Destinatario<select aria-label="Destinatario alert" required value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">{members.length?'Seleziona un membro':'Nessun altro membro online'}</option>{members.map(member=><option key={member.user_id} value={member.user_id}>{member.profiles.username}</option>)}</select></label><label>Tipo di alert<select aria-label="Tipo di alert" value={kind} onChange={e=>setKind(e.target.value as typeof kind)}><option value="emergency">Emergenza</option><option value="info">Avviso</option></select></label><label>Messaggio<textarea aria-label="Messaggio alert" required minLength={3} maxLength={500} rows={4} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Descrivi cosa sta succedendo…"/></label>{sendError&&<p className="error-banner" role="alert">{sendError}</p>}<button className="button primary" disabled={busy||!members.some(member=>member.user_id===recipient)}><Send size={16}/>{busy?'Invio…':'Invia alert'}</button></form>
    </dialog>
    <dialog ref={incoming} className={`detail-dialog alert-dialog received-alert ${alert?.kind==='emergency'?'emergency':''}`} aria-label="Alert ricevuto" onCancel={e=>{e.preventDefault();void confirm()}}>{alert&&<><div className="alert-dialog-heading"><h2>{alert.kind==='emergency'?<TriangleAlert size={24}/>:<Bell size={24}/>} {alert.kind==='emergency'?'Emergenza':'Avviso'}</h2></div><p className="muted">Da {alert.profiles.username} · {date(alert.created_at)}</p><p className="received-alert-message" role="alert">{alert.message}</p><button type="button" className="button secondary" data-sound-control onClick={()=>void preview(alert.kind)}>Riproduci suono</button>{!ready&&<p className="hint" role="status">Audio bloccato: tocca Riproduci suono.</p>}{ackError&&<p role="alert" className="error-banner">{ackError}</p>}<button className="button primary" disabled={busy} onClick={()=>void confirm()}>{busy?'Conferma…':'Ho letto'}</button>{alerts.length>1&&<p className="muted">Altri {alerts.length-1} alert in attesa</p>}</>}</dialog>
  </div>
}
