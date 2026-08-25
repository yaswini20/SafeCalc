import React, { useState } from 'react';
import { Eye, EyeOff, Shield, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login(){
  const {login,register}=useAuth(); const [mode,setMode]=useState('login'); const [show,setShow]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const [f,setF]=useState({name:'',email:'',phone:'',password:'',mpin:''}); const set=(k,v)=>setF(x=>({...x,[k]:v}));
  const submit=async e=>{e.preventDefault();setError('');setLoading(true);try{let r;if(mode==='login') r=await login(f.email,f.password); else {if(f.mpin.length!==4||!/^\d{4}$/.test(f.mpin)) throw new Error('MPIN must be exactly 4 digits.'); r=await register(f);} if(!r.success)setError(r.message||'Please check your details.');}catch(e){setError(e.message||'Unable to continue.')}finally{setLoading(false)}};
  return <div className="auth-page"><div className="auth-glow one"/><div className="auth-glow two"/><div className="auth-card"><div className="auth-brand"><div className="brand-mark"><Shield size={22}/></div><div><strong>Safe Calc</strong><span>PERSONAL SAFETY COMPANION</span></div></div><div className="auth-heading"><span>SECURE ACCESS</span><h1>{mode==='login'?'Welcome back':'Create your safety account'}</h1><p>{mode==='login'?'Sign in to manage your travel safety dashboard.':'Set up your account, emergency MPIN and trusted contacts.'}</p></div>{error&&<div className="form-error">{error}</div>}<form onSubmit={submit} className="auth-form">
    {mode==='register'&&<><label>Full name<input value={f.name} onChange={e=>set('name',e.target.value)} required placeholder="Your name"/></label><label>Phone number<input value={f.phone} onChange={e=>set('phone',e.target.value)} required placeholder="+91 98765 43210"/></label></>}
    <label>Email<input type="email" value={f.email} onChange={e=>set('email',e.target.value)} required placeholder="you@example.com"/></label>
    <label>Password<div className="password-wrap"><input type={show?'text':'password'} value={f.password} onChange={e=>set('password',e.target.value)} required placeholder="••••••••"/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
    {mode==='register'&&<label>4-digit safety MPIN<input inputMode="numeric" maxLength={4} value={f.mpin} onChange={e=>set('mpin',e.target.value.replace(/\D/g,'').slice(0,4))} required placeholder="••••"/></label>}
    <button className="auth-submit" disabled={loading}>{loading?'Please wait…':mode==='login'?'Sign in':'Create account'}<ArrowRight size={17}/></button>
  </form><button className="mode-switch" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?"Don't have an account? Create one":"Already have an account? Sign in"}</button></div></div>;
}
