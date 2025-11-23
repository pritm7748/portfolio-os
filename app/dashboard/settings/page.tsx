// app/dashboard/settings/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Upload, User, Lock, AlertCircle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // Profile State
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  // Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data, error, status } = await supabase
        .from('profiles')
        .select(`username, full_name, avatar_url`)
        .eq('id', user.id)
        .single()

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        setUsername(data.username || '')
        setFullName(data.full_name || '')
        setAvatarUrl(data.avatar_url)
      }
    } catch (error) {
      console.error('Error loading profile details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      setAvatarFile(null)
      return
    }
    const file = event.target.files[0]
    setAvatarFile(file)
    // Create a preview URL
    setAvatarUrl(URL.createObjectURL(file))
  }

  async function updateProfile() {
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')

      let finalAvatarUrl = avatarUrl

      // 1. Upload Image if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop()
        const filePath = `${user.id}/${Math.random()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarFile, { upsert: true })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)
        
        finalAvatarUrl = publicUrl
      }

      // 2. Update Profile Data
      const updates = {
        id: user.id,
        username,
        full_name: fullName,
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('profiles').upsert(updates)
      if (error) throw error
      
      // Force a router refresh so the layout header updates the image
      router.refresh()
      alert('Profile updated successfully!')

    } catch (error: any) {
      alert('Error updating profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function updatePassword() {
    setPasswordMsg(null)
    if (newPassword !== confirmPassword) {
        setPasswordMsg({ type: 'error', text: "Passwords don't match" })
        return
    }
    if (newPassword.length < 6) {
        setPasswordMsg({ type: 'error', text: "Password must be at least 6 characters" })
        return
    }

    try {
        setSaving(true)
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw error
        setPasswordMsg({ type: 'success', text: "Password updated successfully" })
        setNewPassword('')
        setConfirmPassword('')
    } catch (error: any) {
        setPasswordMsg({ type: 'error', text: error.message })
    } finally {
        setSaving(false)
    }
  }


  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600"/></div>
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Account Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your profile details and security.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        
        {/* --- SECTION 1: Public Profile --- */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Public Profile</h3>
            </div>

            <div className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex flex-col items-center gap-4">
                    <div className="relative h-32 w-32 rounded-full border-4 border-slate-100 bg-slate-50 overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                        {avatarUrl ? (
                             <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                             <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-600">
                                 <User className="h-16 w-16" />
                             </div>
                        )}
                        {/* Hidden file input */}
                        <input 
                           type="file" 
                           ref={fileInputRef} 
                           onChange={handleFileChange} 
                           accept="image/*" 
                           className="hidden" 
                        />
                    </div>
                    <button 
                       onClick={() => fileInputRef.current?.click()}
                       type="button" 
                       className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                        <Upload className="h-4 w-4" />
                        Change Photo
                    </button>
                </div>

                {/* Form Fields */}
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                        <input type="text" value={user?.email} disabled className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500" />
                        <p className="mt-1 text-xs text-slate-400">Email cannot be changed.</p>
                    </div>
                    
                    <div>
                        <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Username</label>
                        <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white" placeholder="johndoe" />
                    </div>
                    
                    <div>
                        <label htmlFor="fullname" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                        <input id="fullname" type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white" placeholder="John Doe" />
                    </div>
                </div>

                <button onClick={updateProfile} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                    {saving && avatarFile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Profile Information
                </button>
            </div>
        </div>

        {/* --- SECTION 2: Security --- */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 h-fit">
            <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <Lock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Security</h3>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="newpass" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
                        <input id="newpass" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white" />
                    </div>
                    
                    <div>
                        <label htmlFor="confirmpass" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
                        <input id="confirmpass" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white" />
                    </div>
                </div>

                {passwordMsg && (
                    <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {passwordMsg.type === 'success' ? <CheckCircle className="h-4 w-4"/> : <AlertCircle className="h-4 w-4"/>}
                        {passwordMsg.text}
                    </div>
                )}

                <button onClick={updatePassword} disabled={saving || !newPassword} className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600">
                    {saving && !avatarFile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Update Password
                </button>
            </div>
        </div>
      </div>
    </div>
  )
}