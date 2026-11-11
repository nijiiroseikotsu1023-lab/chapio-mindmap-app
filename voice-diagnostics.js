(function(root){
'use strict';
const ERROR_MESSAGES={
 'not-allowed':'マイクまたは音声認識の利用が許可されていません。ブラウザとサイトの権限を確認してください。',
 'service-not-allowed':'このブラウザでは音声認識サービスを利用できません。Safariまたは標準キーボードの音声入力をお試しください。',
 'no-speech':'音声を検出できませんでした。静かな場所でもう一度ゆっくり話してください。',
 'audio-capture':'マイクを利用できません。他の録音アプリを閉じ、端末のマイク設定を確認してください。',
 'network':'音声認識サービスとの通信に失敗しました。通信状態を確認してください。',
 'aborted':'音声入力はキャンセルされました。',
 'language-not-supported':'日本語の音声認識を利用できません。',
 'bad-grammar':'音声認識の設定を処理できませんでした。',
 'phrases-not-supported':'この端末では音声認識の語句設定を利用できません。',
 'timeout':'15秒以内に音声認識を開始・完了できませんでした。標準キーボードの音声入力も利用できます。',
 'start-failed':'音声認識を開始できませんでした。少し待ってから再試行してください。'
};
function errorMessage(code){return ERROR_MESSAGES[code]||`音声認識でエラーが発生しました（${code||'unknown'}）。標準キーボードの音声入力も利用できます。`}
function cleanMessage(value){return String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160)}
function createController(Recognition,callbacks={},options={}){
 if(typeof Recognition!=='function')throw new TypeError('SpeechRecognition constructor is required');
 const now=options.now||(()=>performance.now()),setTimer=options.setTimer||setTimeout,clearTimer=options.clearTimer||clearTimeout;
 const timeoutMs=Number.isFinite(options.timeoutMs)?options.timeoutMs:15000,endWaitMs=Number.isFinite(options.endWaitMs)?options.endWaitMs:2000,quietMs=Number.isFinite(options.quietMs)?options.quietMs:400;
 const sessionId=cleanMessage(options.sessionId||'S?'),startTime=now(),events=[];
 let recognition=null,mainTimer=null,endTimer=null,quietTimer=null,active=false,closed=false,terminalStarted=false,resultSeen=false,errorCode='',intendedReason='ended',phase='idle';
 const emit=(name,event={})=>{if(closed)return;const item={sessionId,ms:Math.max(0,Math.round(now()-startTime)),name};if(event.error)item.error=cleanMessage(event.error);if(event.message)item.message=cleanMessage(event.message);events.push(item);callbacks.onEvent?.(item,events.slice())};
 const setPhase=value=>{phase=value;callbacks.onState?.(value)};
 const clearMainTimer=()=>{if(mainTimer!==null){clearTimer(mainTimer);mainTimer=null}};
 const clearEndTimer=()=>{if(endTimer!==null){clearTimer(endTimer);endTimer=null}};
 const detach=()=>{if(!recognition)return;recognition.onstart=null;recognition.onaudiostart=null;recognition.onsoundstart=null;recognition.onspeechstart=null;recognition.onspeechend=null;recognition.onsoundend=null;recognition.onaudioend=null;recognition.onresult=null;recognition.onerror=null;recognition.onend=null;recognition=null};
 const finishAfterQuiet=(reason,endObserved,forcedRelease)=>{if(closed||phase==='releasing'||phase==='ready')return;clearMainTimer();clearEndTimer();setPhase('releasing');emit('releasing',{message:endObserved?'onend-observed':'forced-release-no-end'});detach();quietTimer=setTimer(()=>{if(closed)return;setPhase('ready');emit('ready',{message:`quiet-${quietMs}ms`});closed=true;active=false;callbacks.onFinish?.({sessionId,reason,error:errorCode,resultSeen,endObserved,forcedRelease,events:events.slice()})},quietMs)};
 const forceRelease=()=>{if(closed)return;const reason=resultSeen?'result-forced-release-no-end':`${intendedReason||errorCode||'ended'}-forced-release-no-end`;emit('forced-release-no-end',{error:errorCode||undefined,message:'WebKit onend was not observed'});finishAfterQuiet(reason,false,true)};
 const waitForEnd=(reason,method)=>{if(closed||terminalStarted)return;terminalStarted=true;intendedReason=reason;clearMainTimer();setPhase(method==='stop'?'stopping':'aborting');emit(method==='stop'?'stop-requested':'abort-requested',{error:errorCode||undefined});endTimer=setTimer(forceRelease,endWaitMs);try{recognition?.[method]()}catch(e){emit(`${method}-exception`,{message:e?.message})}};
 const fail=(code,event={})=>{if(closed)return;const nextCode=code||'unknown';if(terminalStarted){emit('late-error-ignored',{error:nextCode,message:event.message});return}errorCode=nextCode;emit('error',{error:errorCode,message:event.message});callbacks.onError?.({code:errorCode,message:errorMessage(errorCode),detail:cleanMessage(event.message)});waitForEnd(errorCode,'abort')};
 const start=()=>{
  if(active||closed||phase==='releasing')return false;
  active=true;setPhase('requesting');try{recognition=new Recognition()}catch(e){fail('start-failed',{message:e?.message});return false}
  recognition.lang='ja-JP';recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onstart=e=>{if(terminalStarted)return emit('late-start-ignored',e);emit('start',e);setPhase('recognizing')};
  recognition.onaudiostart=e=>{if(terminalStarted)return emit('late-audiostart-ignored',e);emit('audiostart',e);setPhase('audio')};
  recognition.onsoundstart=e=>emit(terminalStarted?'late-soundstart-ignored':'soundstart',e);
  recognition.onspeechstart=e=>{if(terminalStarted)return emit('late-speechstart-ignored',e);emit('speechstart',e);setPhase('speech')};
  recognition.onspeechend=e=>emit('speechend',e);
  recognition.onsoundend=e=>emit('soundend',e);
  recognition.onaudioend=e=>emit('audioend',e);
  recognition.onresult=e=>{if(closed)return;if(terminalStarted){emit('late-result-ignored');return}clearMainTimer();emit('result');resultSeen=true;let transcript='';try{transcript=String(e.results?.[0]?.[0]?.transcript||'')}catch(_){ }callbacks.onResult?.(transcript);setPhase('result');waitForEnd('result','stop')};
  recognition.onerror=e=>fail(e?.error||'unknown',e||{});
  recognition.onend=e=>{if(closed||phase==='releasing'||phase==='ready')return;clearMainTimer();clearEndTimer();emit('end');const reason=resultSeen?'result':(errorCode||intendedReason||'ended');finishAfterQuiet(reason,true,false)};
  mainTimer=setTimer(()=>{if(closed||terminalStarted)return;errorCode='timeout';emit('timeout',{error:'timeout'});callbacks.onError?.({code:'timeout',message:errorMessage('timeout'),detail:''});waitForEnd('timeout','abort')},timeoutMs);
  try{recognition.start();emit('requested');setPhase('requested');return true}catch(e){fail('start-failed',{message:e?.message});return false}
 };
 const cancel=()=>{if(closed||terminalStarted)return false;errorCode='aborted';emit('cancel',{error:'aborted'});callbacks.onError?.({code:'aborted',message:errorMessage('aborted'),detail:''});waitForEnd('aborted','abort');return true};
 return {start,cancel,isActive:()=>active&&!closed,isClosed:()=>closed,getEvents:()=>events.slice(),getPhase:()=>phase,getSessionId:()=>sessionId};
}
root.ChapioVoice={createController,errorMessage,cleanMessage};
})(typeof window!=='undefined'?window:globalThis);
