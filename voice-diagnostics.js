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
 const timeoutMs=Number.isFinite(options.timeoutMs)?options.timeoutMs:15000,startTime=now(),events=[];
 let recognition=null,timeoutId=null,finishId=null,active=false,closed=false,resultSeen=false,errorCode='';
 const emit=(name,event={})=>{if(closed)return;const item={ms:Math.max(0,Math.round(now()-startTime)),name};if(event.error)item.error=cleanMessage(event.error);if(event.message)item.message=cleanMessage(event.message);events.push(item);callbacks.onEvent?.(item,events.slice())};
 const finish=reason=>{if(closed)return;closed=true;active=false;if(timeoutId!==null)clearTimer(timeoutId);if(finishId!==null)clearTimer(finishId);recognition=null;callbacks.onFinish?.({reason,error:errorCode,resultSeen,events:events.slice()})};
 const finishSoon=(reason,delay=800)=>{if(finishId!==null)clearTimer(finishId);finishId=setTimer(()=>finish(reason),delay)};
 const fail=(code,event={})=>{if(closed)return;const nextCode=code||'unknown';emit('error',{error:nextCode,message:event.message});if(errorCode==='timeout'||errorCode==='aborted')return;errorCode=nextCode;callbacks.onError?.({code:errorCode,message:errorMessage(errorCode),detail:cleanMessage(event.message)});finishSoon(errorCode)};
 const start=()=>{
  if(active||closed)return false;
  active=true;try{recognition=new Recognition()}catch(e){fail('start-failed',{message:e?.message});return false}
  recognition.lang='ja-JP';recognition.interimResults=false;recognition.maxAlternatives=1;
  recognition.onstart=e=>{emit('start',e);callbacks.onState?.('recognizing')};
  recognition.onaudiostart=e=>{emit('audiostart',e);callbacks.onState?.('audio')};
  recognition.onsoundstart=e=>emit('soundstart',e);
  recognition.onspeechstart=e=>{emit('speechstart',e);callbacks.onState?.('speech')};
  recognition.onspeechend=e=>emit('speechend',e);
  recognition.onsoundend=e=>emit('soundend',e);
  recognition.onaudioend=e=>emit('audioend',e);
  recognition.onresult=e=>{if(closed)return;emit('result');resultSeen=true;let transcript='';try{transcript=String(e.results?.[0]?.[0]?.transcript||'')}catch(_){ }callbacks.onResult?.(transcript);callbacks.onState?.('result');try{recognition.stop()}catch(_){ }if(!closed)finishSoon('result',1500)};
  recognition.onerror=e=>fail(e?.error||'unknown',e||{});
  recognition.onend=e=>{if(closed)return;emit('end',e);finish(errorCode||(resultSeen?'result':'ended'))};
  timeoutId=setTimer(()=>{if(closed)return;errorCode='timeout';emit('timeout',{error:'timeout'});callbacks.onError?.({code:'timeout',message:errorMessage('timeout'),detail:''});try{recognition.abort()}catch(_){ }if(!closed)finishSoon('timeout',500)},timeoutMs);
  try{recognition.start();emit('requested');callbacks.onState?.('requested');return true}catch(e){fail('start-failed',{message:e?.message});return false}
 };
 const cancel=()=>{if(closed)return false;errorCode='aborted';emit('cancel',{error:'aborted'});callbacks.onError?.({code:'aborted',message:errorMessage('aborted'),detail:''});try{recognition?.abort()}catch(_){ }if(!closed)finishSoon('aborted',500);return true};
 return {start,cancel,isActive:()=>active&&!closed,isClosed:()=>closed,getEvents:()=>events.slice()};
}
root.ChapioVoice={createController,errorMessage,cleanMessage};
})(typeof window!=='undefined'?window:globalThis);
